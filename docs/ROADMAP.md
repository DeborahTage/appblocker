# Roadmap

## Delivered (MVP)

- Phase 1: Windows foreground detection (process name only)
- Phase 2: Backend relay + mentor dashboard live cards
- Phase 3: Consent, pairing, JWT, session lifecycle, tray, reconnect backoff
- Phase 4: Allow/block lists, notifications, optional aggregate summaries

## Near-term

- Redis adapter for multi-instance live state
- Mentor invite/password reset flows
- Signed Windows installer certificates in CI
- Stronger idle CPU verification harness on Windows hardware

## Platform expansion

- macOS / Linux `ForegroundProvider` implementations
- Optional consented browser extension that reports **hostname only** (changes privacy scope; requires new consent copy)

## Explicit non-goals

- Screen recording, keylogging, file inspection
- Hard application blocking / process kill
- Permanent surveillance outside lesson sessions
