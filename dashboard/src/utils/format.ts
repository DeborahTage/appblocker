export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function signalEmoji(state: string): string {
  switch (state) {
    case 'OnTask':
      return '🟢';
    case 'Away':
    case 'Waiting':
      return '🟡';
    case 'BlockedAppDetected':
      return '🔴';
    default:
      return '⚪';
  }
}

export function getCsrfFromCookie(): string | undefined {
  const match = document.cookie.match(/(?:^|;\s*)fm_csrf=([^;]+)/);
  return match?.[1];
}
