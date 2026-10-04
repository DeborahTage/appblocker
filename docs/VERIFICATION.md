# Verification report

Date: 2026-07-18

## Mock / simulation audit findings (removed)

| Location | Issue | Resolution |
|----------|-------|------------|
| `student-agent/src/lib/browserSession.ts` | Browser demo rotated hardcoded apps (`Code.exe`, `chrome.exe`, `Discord.exe`) on a 2s timer | Deleted |
| `student-agent/src/hooks/useTauri.ts` | Silent browser join fallback | Browser join now fails loudly; native Tauri required |
| `student-agent/src-tauri/src/foreground/provider.rs` | Non-Windows stub always returned `VS Code` | Replaced with real X11 provider or explicit unsupported capability |
| Dashboard live cards | Appeared to show “mock” apps because simulated agent events were real WebSocket frames | Dashboard now labels `LIVE DATA` only after validated native `state_change` events |

## Checks run in this environment

| Check | Result |
|-------|--------|
| `pnpm --filter @focusmentor/contracts build` | Pass |
| `pnpm --filter @focusmentor/{backend,dashboard,student-agent} typecheck` | Pass |
| `pnpm --filter @focusmentor/{contracts,backend,dashboard,student-agent} test` | Pass |
| `pnpm --filter @focusmentor/{backend,dashboard,student-agent} lint` | Pass |
| `cargo check --target x86_64-pc-windows-gnu` for the Student Agent | Pass (2026-07-18) |
| Desktop session probe | `XDG_SESSION_TYPE=x11`, `DISPLAY=:0.0`, `xdotool` present; active window/process readable |
| Native Linux Tauri link | Blocked until system packages are installed (`pkg-config`, WebKitGTK 4.1, GTK 3) — needs `sudo apt` |
| Full live e2e (Tauri → backend → dashboard) | Paused for user testing once Linux Tauri deps are installed |

## How to verify live data end-to-end

1. Keep backend + dashboard running.
2. Install Linux Tauri deps if needed:

```bash
sudo apt update
sudo apt install -y pkg-config libwebkit2gtk-4.1-dev libgtk-3-dev \
  libayatana-appindicator3-dev librsvg2-dev patchelf xdotool
```

3. Launch the native agent:

```bash
source "$HOME/.cargo/env"
pnpm --filter @focusmentor/student-agent tauri dev
```

4. Create a mentor session, copy the pairing code, join from the Tauri window.
5. Confirm:

- Student Debug page shows real process/window title/local state
- Backend logs `Received native Student Agent state_change`
- Dashboard card shows `● LIVE DATA`

## Privacy notes for this pass

- Window titles are local debug-only.
- WebSocket payloads still send only `currentApp`, `processName`, focus state, and timestamps.
- Unsupported environments fail closed with a visible message. They do not invent activity.
