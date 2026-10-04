//! Focus state machine. Emits updates only when the focus state changes.

use crate::config::SessionConfig;
use crate::foreground::{matches_app_list, ForegroundInfo};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum FocusState {
    Disconnected,
    Waiting,
    OnTask,
    Away,
    BlockedAppDetected,
    SessionEnded,
}

impl FocusState {
    pub fn tray_color(&self) -> &'static str {
        match self {
            FocusState::OnTask => "green",
            FocusState::Away | FocusState::Waiting => "yellow",
            FocusState::BlockedAppDetected => "red",
            FocusState::Disconnected | FocusState::SessionEnded => "gray",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct StateSnapshot {
    pub state: FocusState,
    pub current_app: Option<String>,
    pub process_name: Option<String>,
}

pub struct FocusStateMachine {
    current: FocusState,
    last_app: Option<String>,
    last_process: Option<String>,
}

impl FocusStateMachine {
    pub fn new() -> Self {
        Self {
            current: FocusState::Disconnected,
            last_app: None,
            last_process: None,
        }
    }

    pub fn current(&self) -> FocusState {
        self.current
    }

    pub fn snapshot(&self) -> StateSnapshot {
        StateSnapshot {
            state: self.current,
            current_app: self.last_app.clone(),
            process_name: self.last_process.clone(),
        }
    }

    pub fn force(&mut self, state: FocusState) -> Option<StateSnapshot> {
        if self.current == state && state != FocusState::SessionEnded {
            return None;
        }
        self.current = state;
        if matches!(state, FocusState::Disconnected | FocusState::SessionEnded) {
            self.last_app = None;
            self.last_process = None;
        }
        Some(self.snapshot())
    }

    /// Evaluate a foreground sample against in-memory session config.
    /// Domain lists are ignored — domain matching is unsupported.
    pub fn evaluate(
        &mut self,
        info: Option<&ForegroundInfo>,
        config: &SessionConfig,
    ) -> Option<StateSnapshot> {
        let Some(info) = info else {
            return self.transition(FocusState::Away, None, None);
        };

        let process = &info.process_name;
        let display = &info.display_name;

        if matches_app_list(process, &config.blocked_apps) {
            return self.transition(
                FocusState::BlockedAppDetected,
                Some(display.clone()),
                Some(process.clone()),
            );
        }

        if config.allowed_apps.is_empty() || matches_app_list(process, &config.allowed_apps) {
            return self.transition(
                FocusState::OnTask,
                Some(display.clone()),
                Some(process.clone()),
            );
        }

        self.transition(
            FocusState::Away,
            Some(display.clone()),
            Some(process.clone()),
        )
    }

    fn transition(
        &mut self,
        next: FocusState,
        app: Option<String>,
        process: Option<String>,
    ) -> Option<StateSnapshot> {
        if self.current == next && self.last_app == app && self.last_process == process {
            return None;
        }
        // Only emit when the focus *state* changes (or app changes within same state for mentor UX).
        let state_changed = self.current != next;
        let app_changed = self.last_app != app;
        self.current = next;
        self.last_app = app;
        self.last_process = process;
        if state_changed || app_changed {
            Some(self.snapshot())
        } else {
            None
        }
    }
}

impl Default for FocusStateMachine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::foreground::ForegroundInfo;

    fn cfg(allowed: &[&str], blocked: &[&str]) -> SessionConfig {
        SessionConfig {
            allowed_apps: allowed.iter().map(|s| (*s).to_string()).collect(),
            blocked_apps: blocked.iter().map(|s| (*s).to_string()).collect(),
            allowed_domains: vec![],
            blocked_domains: vec![],
            enable_session_summary: false,
            summary_retention_hours: 24,
        }
    }

    #[test]
    fn detects_on_task_and_blocked() {
        let mut sm = FocusStateMachine::new();
        let config = cfg(&["Code.exe"], &["Discord.exe"]);
        let code = ForegroundInfo {
            process_name: "Code.exe".into(),
            display_name: "VS Code".into(),
            window_title: Some("lesson.rs - FocusMentor".into()),
        };
        let snap = sm.evaluate(Some(&code), &config).unwrap();
        assert_eq!(snap.state, FocusState::OnTask);

        let discord = ForegroundInfo {
            process_name: "Discord.exe".into(),
            display_name: "Discord".into(),
            window_title: Some("Discord".into()),
        };
        let snap = sm.evaluate(Some(&discord), &config).unwrap();
        assert_eq!(snap.state, FocusState::BlockedAppDetected);
    }

    #[test]
    fn no_emit_when_unchanged() {
        let mut sm = FocusStateMachine::new();
        let config = cfg(&["Code.exe"], &[]);
        let code = ForegroundInfo {
            process_name: "Code.exe".into(),
            display_name: "VS Code".into(),
            window_title: None,
        };
        assert!(sm.evaluate(Some(&code), &config).is_some());
        assert!(sm.evaluate(Some(&code), &config).is_none());
    }
}
