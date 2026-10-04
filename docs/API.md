# FocusMentor API

Base URL: `/api`

## Auth

### `POST /auth/login`

```json
{ "email": "mentor@example.com", "password": "ChangeMe123!" }
```

Sets `fm_mentor_token` (httpOnly) and `fm_csrf` cookies. Response:

```json
{ "mentor": { "id": "...", "email": "...", "name": "..." }, "csrfToken": "..." }
```

### `POST /auth/logout` (mentor)

### `GET /auth/me` (mentor)

### `POST /auth/ws-ticket` (mentor)

Optional `?sessionId=`. Returns `{ "ticket": "...", "expiresInSeconds": 120 }`.

## Students

- `GET /students`
- `POST /students` `{ "name": "Alex", "email": "optional@x.com" }`
- `GET /students/:id`

## Sessions

### `POST /sessions`

```json
{
  "studentId": "uuid",
  "durationMinutes": 60,
  "config": {
    "allowedApps": ["Code.exe"],
    "blockedApps": ["Discord.exe"],
    "enableSessionSummary": false
  }
}
```

Returns session including one-time `pairingCode` (`ABCD-1234`).

### `POST /sessions/join` (student agent, public)

```json
{ "pairingCode": "ABCD-1234" }
```

Response:

```json
{
  "token": "<student JWT>",
  "sessionId": "uuid",
  "expiresAt": "...",
  "config": { "...": "..." },
  "student": { "id": "...", "name": "..." },
  "domainMatchingSupported": false
}
```

Pairing codes are single-use and cleared after join.

### `GET /sessions` / `GET /sessions/:id`

### `POST /sessions/:id/end` / `POST /sessions/end` `{ "sessionId": "..." }`

### `GET /config?sessionId=` / `GET /sessions/:id/config`

### `PATCH /sessions/:id/config`

## Settings

- `GET /settings`
- `PUT /settings`

## Health

- `GET /health`
- `GET /ready`

## WebSocket `/ws`

Client → server:

| type | payload |
|------|---------|
| `join_session` | `sessionId`, `token` |
| `state_change` | `state`, `currentApp`, `processName`, `timestamp` |
| `heartbeat` | `timestamp` |
| `leave_session` | — |

Server → client:

| type | notes |
|------|-------|
| `join_ack` | role, expiresAt, optional config |
| `student_connected` / `student_disconnected` | mentor |
| `student_state` | mentor live card |
| `config_update` | students |
| `session_end` | reason |
| `error` | code, message |

`state_change` rejects URLs and absolute file paths.
