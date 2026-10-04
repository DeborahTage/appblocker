# Privacy commitments

FocusMentor is designed for live coding lesson awareness without invasive surveillance.

## Hard prohibitions

The student agent and backend must never:

- Record the screen or capture screenshots
- Record audio
- Capture keystrokes
- Read clipboard contents
- Read arbitrary files or inspect code being written
- Inspect browser history
- Store raw window titles or URLs
- Force-close or terminate student applications

`handleBlockedApp()` is an intentional no-op placeholder for future soft-nudge review only.

## Allowed signals

During an **active, consented lesson session** only:

1. Foreground process executable name
2. Normalized display label (e.g. Browser, VS Code)
3. Focus state machine value
4. Timestamps for state changes / heartbeats

## Consent

On first launch the student must click **I Agree** after seeing the required disclosures. Consent is stored locally on the student device. Monitoring APIs remain disabled until consent is granted.

## Session scoping

Outside a lesson session the agent:

- Does not poll foreground apps
- Does not open a WebSocket
- Does not reconnect
- Does not log telemetry
- Holds no session config in memory

Ending a session immediately stops polling, disconnects the socket, and clears session memory.

## Optional summaries

If a mentor enables session summary, only aggregates are retained, for example:

```json
{
  "onTaskPercent": 82,
  "awayPercent": 12,
  "blockedPercent": 6,
  "apps": [
    { "appName": "VS Code", "minutes": 42 },
    { "appName": "Discord", "minutes": 5 }
  ]
}
```

Summaries delete after configurable retention (default 24h, max 168h).

## Domain lists

Configuration may include `allowedDomains` / `blockedDomains` for future platform work. The Windows MVP does **not** match domains because doing so would require reading window titles or URLs.
