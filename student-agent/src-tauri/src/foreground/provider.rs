use serde::Serialize;
#[cfg(target_os = "linux")]
use std::process::Command;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ForegroundInfo {
    /// Executable basename only.
    pub process_name: String,
    /// Privacy-safe normalized display label.
    pub display_name: String,
    /// Local debug information. This field is never sent to the backend.
    pub window_title: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DetectionCapability {
    pub supported: bool,
    pub platform: String,
    pub session_type: String,
    pub data_source: String,
    pub message: Option<String>,
}

pub trait ForegroundProvider: Send + Sync {
    fn current(&self) -> Result<Option<ForegroundInfo>, String>;
    fn capability(&self) -> DetectionCapability;
}

#[cfg(windows)]
mod windows_impl {
    use super::{DetectionCapability, ForegroundInfo, ForegroundProvider};
    use crate::foreground::normalize::display_name_for_process;
    use std::path::Path;
    use windows::Win32::Foundation::{CloseHandle, HWND, MAX_PATH};
    use windows::Win32::System::ProcessStatus::GetModuleFileNameExW;
    use windows::Win32::System::Threading::{
        OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
    };

    pub struct WindowsForegroundProvider;

    impl ForegroundProvider for WindowsForegroundProvider {
        fn current(&self) -> Result<Option<ForegroundInfo>, String> {
            unsafe {
                let hwnd: HWND = GetForegroundWindow();
                if hwnd.0.is_null() {
                    return Ok(None);
                }

                let mut pid: u32 = 0;
                GetWindowThreadProcessId(hwnd, Some(&mut pid));
                if pid == 0 {
                    return Ok(None);
                }

                let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, false, pid)
                    .map_err(|error| format!("OpenProcess failed: {error}"))?;
                let mut buf = [0u16; MAX_PATH as usize];
                let len = GetModuleFileNameExW(handle, None, &mut buf);
                let _ = CloseHandle(handle);
                if len == 0 {
                    return Err("GetModuleFileNameExW returned no executable path".into());
                }

                let path = String::from_utf16_lossy(&buf[..len as usize]);
                let process_name = Path::new(&path)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown.exe")
                    .to_string();
                let display_name = display_name_for_process(&process_name);
                let title_len = GetWindowTextLengthW(hwnd);
                let window_title = if title_len > 0 {
                    let mut title = vec![0u16; title_len as usize + 1];
                    let copied = GetWindowTextW(hwnd, &mut title);
                    (copied > 0).then(|| String::from_utf16_lossy(&title[..copied as usize]))
                } else {
                    None
                };

                Ok(Some(ForegroundInfo {
                    process_name,
                    display_name,
                    window_title,
                }))
            }
        }

        fn capability(&self) -> DetectionCapability {
            DetectionCapability {
                supported: true,
                platform: "windows".into(),
                session_type: "win32".into(),
                data_source: "live".into(),
                message: None,
            }
        }
    }
}

#[cfg(windows)]
pub fn platform_provider() -> Box<dyn ForegroundProvider> {
    Box::new(windows_impl::WindowsForegroundProvider)
}

#[cfg(target_os = "linux")]
pub fn platform_provider() -> Box<dyn ForegroundProvider> {
    let session_type = std::env::var("XDG_SESSION_TYPE")
        .unwrap_or_default()
        .to_ascii_lowercase();
    let wayland = std::env::var_os("WAYLAND_DISPLAY").is_some() || session_type == "wayland";
    if wayland {
        return Box::new(UnsupportedForegroundProvider::new(
            "linux",
            "wayland",
            "Wayland does not expose a portable global active-window API. Use an X11 session or a compositor-specific integration.",
        ));
    }

    if std::env::var_os("DISPLAY").is_none() {
        return Box::new(UnsupportedForegroundProvider::new(
            "linux",
            if session_type.is_empty() {
                "unknown"
            } else {
                &session_type
            },
            "No X11 DISPLAY is available.",
        ));
    }

    if Command::new("xdotool").arg("--version").output().is_err() {
        return Box::new(UnsupportedForegroundProvider::new(
            "linux",
            "x11",
            "X11 was detected, but xdotool is not installed.",
        ));
    }

    Box::new(X11ForegroundProvider)
}

#[cfg(target_os = "linux")]
pub struct X11ForegroundProvider;

#[cfg(target_os = "linux")]
impl ForegroundProvider for X11ForegroundProvider {
    fn current(&self) -> Result<Option<ForegroundInfo>, String> {
        let window_id = command_output("xdotool", &["getactivewindow"])?;
        if window_id.is_empty() || window_id == "0" {
            return Ok(None);
        }

        let pid = command_output("xdotool", &["getwindowpid", &window_id])?;
        let window_title = command_output("xdotool", &["getwindowname", &window_id]).ok();
        let process_name = process_name_for_pid(&pid)
            .or_else(|_| command_output("xdotool", &["getwindowclassname", &window_id]))?;
        let process_name = process_name.trim().to_string();
        if process_name.is_empty() {
            return Err("The active X11 window did not expose a process name".into());
        }

        Ok(Some(ForegroundInfo {
            display_name: crate::foreground::normalize::display_name_for_process(&process_name),
            process_name,
            window_title: window_title.filter(|title| !title.is_empty()),
        }))
    }

    fn capability(&self) -> DetectionCapability {
        DetectionCapability {
            supported: true,
            platform: "linux".into(),
            session_type: "x11".into(),
            data_source: "live".into(),
            message: Some("Live X11 foreground detection via xdotool.".into()),
        }
    }
}

#[cfg(target_os = "linux")]
fn process_name_for_pid(pid: &str) -> Result<String, String> {
    let output = command_output("ps", &["-p", pid, "-o", "comm="])?;
    output
        .lines()
        .next()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .ok_or_else(|| format!("Could not resolve process name for PID {pid}"))
}

#[cfg(target_os = "linux")]
fn command_output(program: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|error| format!("Failed to run {program}: {error}"))?;
    if !output.status.success() {
        let error = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if error.is_empty() {
            format!("{program} exited with {}", output.status)
        } else {
            error
        });
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[cfg(not(any(windows, target_os = "linux")))]
pub fn platform_provider() -> Box<dyn ForegroundProvider> {
    Box::new(UnsupportedForegroundProvider::new(
        std::env::consts::OS,
        "unknown",
        "Foreground detection is not implemented for this operating system.",
    ))
}

pub struct UnsupportedForegroundProvider {
    capability: DetectionCapability,
}

impl UnsupportedForegroundProvider {
    #[allow(dead_code)]
    fn new(platform: &str, session_type: &str, message: &str) -> Self {
        Self {
            capability: DetectionCapability {
                supported: false,
                platform: platform.into(),
                session_type: session_type.into(),
                data_source: "unavailable".into(),
                message: Some(message.into()),
            },
        }
    }
}

impl ForegroundProvider for UnsupportedForegroundProvider {
    fn current(&self) -> Result<Option<ForegroundInfo>, String> {
        Err(self
            .capability
            .message
            .clone()
            .unwrap_or_else(|| "Foreground detection is unavailable".into()))
    }

    fn capability(&self) -> DetectionCapability {
        self.capability.clone()
    }
}

/// Test-only detector. It cannot be selected by a production build.
#[cfg(test)]
pub struct ScriptedProvider {
    pub next: parking_lot::Mutex<Option<ForegroundInfo>>,
}

#[cfg(test)]
impl ForegroundProvider for ScriptedProvider {
    fn current(&self) -> Result<Option<ForegroundInfo>, String> {
        Ok(self.next.lock().clone())
    }

    fn capability(&self) -> DetectionCapability {
        DetectionCapability {
            supported: true,
            platform: "test".into(),
            session_type: "test".into(),
            data_source: "test".into(),
            message: None,
        }
    }
}
