/**
 * Normalize Windows executable names to privacy-safe display labels.
 * Never includes window titles, paths, or URLs.
 */
const APP_ALIASES: Record<string, string> = {
  'code.exe': 'VS Code',
  'code - insid.exe': 'VS Code',
  code: 'VS Code',
  codium: 'VSCodium',
  'devenv.exe': 'Visual Studio',
  'windowsterminal.exe': 'Terminal',
  'xfce4-terminal': 'Terminal',
  'gnome-terminal-': 'Terminal',
  konsole: 'Terminal',
  'cmd.exe': 'Command Prompt',
  'powershell.exe': 'PowerShell',
  'pwsh.exe': 'PowerShell',
  'chrome.exe': 'Browser',
  'google-chrome': 'Browser',
  chromium: 'Browser',
  'chromium-browse': 'Browser',
  'msedge.exe': 'Browser',
  'firefox.exe': 'Browser',
  'firefox-esr': 'Browser',
  firefox: 'Browser',
  'brave.exe': 'Browser',
  'discord.exe': 'Discord',
  discord: 'Discord',
  'steam.exe': 'Steam',
  'leagueclient.exe': 'League of Legends',
  'slack.exe': 'Slack',
  'notion.exe': 'Notion',
  'explorer.exe': 'File Explorer',
  'notepad.exe': 'Notepad',
  'notepad++.exe': 'Notepad++',
};

export function normalizeProcessName(processName: string): string {
  return processName.trim().toLowerCase();
}

export function displayNameForProcess(processName: string): string {
  const key = normalizeProcessName(processName);
  if (APP_ALIASES[key]) {
    return APP_ALIASES[key];
  }
  // Strip .exe and present a simple label — never a path.
  const base = processName.split(/[/\\]/).pop() ?? processName;
  return base.replace(/\.exe$/i, '') || 'Unknown';
}

export function isBrowserProcess(processName: string): boolean {
  return displayNameForProcess(processName) === 'Browser';
}

export function matchesAppList(processName: string, list: string[]): boolean {
  const normalized = normalizeProcessName(processName);
  return list.some((entry) => normalizeProcessName(entry) === normalized);
}
