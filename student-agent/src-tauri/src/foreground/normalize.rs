use std::collections::HashMap;
use std::sync::OnceLock;

fn aliases() -> &'static HashMap<&'static str, &'static str> {
    static MAP: OnceLock<HashMap<&'static str, &'static str>> = OnceLock::new();
    MAP.get_or_init(|| {
        HashMap::from([
            ("code.exe", "VS Code"),
            ("code", "VS Code"),
            ("codium", "VSCodium"),
            ("devenv.exe", "Visual Studio"),
            ("windowsterminal.exe", "Terminal"),
            ("xfce4-terminal", "Terminal"),
            ("gnome-terminal-", "Terminal"),
            ("konsole", "Terminal"),
            ("cmd.exe", "Command Prompt"),
            ("powershell.exe", "PowerShell"),
            ("pwsh.exe", "PowerShell"),
            ("chrome.exe", "Browser"),
            ("google-chrome", "Browser"),
            ("chromium", "Browser"),
            ("chromium-browse", "Browser"),
            ("msedge.exe", "Browser"),
            ("firefox.exe", "Browser"),
            ("firefox-esr", "Browser"),
            ("firefox", "Browser"),
            ("brave.exe", "Browser"),
            ("discord.exe", "Discord"),
            ("steam.exe", "Steam"),
            ("leagueclient.exe", "League of Legends"),
            ("slack.exe", "Slack"),
            ("notion.exe", "Notion"),
            ("explorer.exe", "File Explorer"),
            ("notepad.exe", "Notepad"),
        ])
    })
}

pub fn normalize_process_name(process_name: &str) -> String {
    let normalized = process_name.trim().to_ascii_lowercase();
    normalized
        .strip_suffix(".exe")
        .unwrap_or(&normalized)
        .to_string()
}

pub fn display_name_for_process(process_name: &str) -> String {
    let raw_key = process_name.trim().to_ascii_lowercase();
    if let Some(label) = aliases().get(raw_key.as_str()) {
        return (*label).to_string();
    }
    let base = process_name
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(process_name);
    base.trim_end_matches(".exe")
        .trim_end_matches(".EXE")
        .to_string()
}

pub fn matches_app_list(process_name: &str, list: &[String]) -> bool {
    let normalized = normalize_process_name(process_name);
    list.iter()
        .any(|entry| normalize_process_name(entry) == normalized)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_known_apps() {
        assert_eq!(display_name_for_process("Code.exe"), "VS Code");
        assert_eq!(display_name_for_process("chrome.exe"), "Browser");
    }

    #[test]
    fn strips_paths() {
        assert_eq!(
            display_name_for_process(r"C:\Program Files\App\foo.exe"),
            "foo"
        );
    }

    #[test]
    fn matches_lists_case_insensitively() {
        let list = vec!["Code.exe".into()];
        assert!(matches_app_list("code.exe", &list));
    }
}
