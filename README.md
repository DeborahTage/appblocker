# FocusMentor

Privacy-first live coding lesson focus monitoring.

Mentors see whether a student is **on task** during an active lesson. The student agent shares **only** the foreground application name and focus state — never screens, keystrokes, files, URLs, or code.

## Monorepo

```
packages/contracts   Shared TypeScript contracts (Zod)
backend              Express + ws + Prisma/PostgreSQL
dashboard            Mentor dashboard (Vite/React/Tailwind)
student-agent        Tauri v2 native student agent (Windows + Linux/X11)
docs                 Architecture, API, privacy, roadmap
```

## Quick start

### Prerequisites

- Node.js 22+
- pnpm 9 (`npm i -g pnpm@9.15.0`)
- Docker (for PostgreSQL) or a local Postgres 16
- For the desktop agent: Rust stable + Tauri prerequisites
  - Windows: Visual Studio C++ / WebView2
  - Linux/X11: WebKitGTK 4.1, GTK 3, `pkg-config`, and `xdotool`

### 1. Install

```bash
pnpm install
pnpm --filter @focusmentor/contracts build
```

### 2. Database

```bash
cp backend/.env.example backend/.env
docker compose up -d postgres
cd backend && pnpm exec prisma migrate deploy && pnpm exec prisma generate
pnpm seed
```

Default mentor: `mentor@example.com` / `ChangeMe123!`

### 3. Run backend + dashboard

```bash
pnpm dev:backend
pnpm dev:dashboard
```

- API: http://localhost:4000/api/health  
- Dashboard: http://localhost:5173  

### 4. Student agent (native only)

Live monitoring requires the native Tauri app. The browser preview never joins sessions and never invents activity.

```bash
cp student-agent/.env.example student-agent/.env
pnpm --filter @focusmentor/student-agent tauri dev
```

Linux notes:

- Supported for development on **X11** sessions (`XDG_SESSION_TYPE=x11`) using `xdotool`.
- Many **Wayland** sessions are unsupported. The agent reports that clearly instead of falling back to fake data.
- Window titles appear only on the local Debug page and are never sent to the backend.

After joining a lesson, the mentor dashboard Live Data indicator should switch to `LIVE DATA` only after a real native `state_change` event arrives.

## Privacy guarantees

See [docs/PRIVACY.md](docs/PRIVACY.md). Highlights:

- Consent required before any monitoring
- Monitoring only inside an active lesson session
- No screen/audio/keyboard/clipboard/file capture
- No forced app termination (`handleBlockedApp` is a TODO placeholder)
- Domain matching unsupported on the MVP agent
- Window titles may be shown locally in Debug mode only; they are never transmitted or stored

## Deployment

| Component | Target |
|-----------|--------|
| Backend | Render (`render.yaml` + `backend/Dockerfile`) |
| Dashboard | Vercel (`dashboard/vercel.json`) |
| Student agent | GitHub Releases (Windows NSIS/MSI via Actions) |

Set `CORS_ORIGINS` to your Vercel URL and use HTTPS cookies (`COOKIE_SECURE=true`, `COOKIE_SAME_SITE=none` when cross-site).

## Scripts

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Privacy](docs/PRIVACY.md)
- [Database](docs/DATABASE.md)
- [Roadmap](docs/ROADMAP.md)
- [Verification](docs/VERIFICATION.md)

## Verification notes

- JS unit/integration tests run on Linux CI.
- Rust `cargo test` / Clippy / Windows installer builds run on `windows-latest` in the release workflow.
- Agent CPU/memory targets (&lt;1% idle outside session, &lt;50MB) must be validated on representative Windows hardware.
