# CalmDesk AI

> **A workspace that responds to you.**

CalmDesk AI is an intelligent desktop wellness and self-awareness companion built for the
[Presage SmartSpectra SDK Challenge](https://dev.to/devteam/join-the-presage-smartspectra-sdk-challenge-3000-in-prizes-across-10-winners).
It uses live physiological signals (breathing rate, pulse rate) captured through your camera via the
**Presage SmartSpectra SDK** to adapt your workspace and guide optional breathing exercises.

*(This README is a skeleton — it will be completed in Phase 8 with full documentation, screenshots,
demo video, and setup instructions.)*

## Status

**Phase 1 of 8 — Development environment setup** ✅

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Development environment | ✅ Complete |
| 2 | Electron + React foundation | ✅ Complete |
| 3 | User interface | ✅ Complete |
| 4 | SmartSpectra integration | ✅ Complete — official renderer SDK wired, camera preview live; live authorized session pending a network/lighting-friendly environment (see `docs/INTEGRATION-NOTES.md`) |
| 5 | Intelligent adaptation | ✅ Complete |
| 6 | Session history & privacy | ✅ Complete |
| 7 | Testing | ⬜ Not started |
| 8 | Final presentation | ⬜ Not started |

## Tech Stack

- **Electron** — desktop application framework
- **React** — frontend user interface
- **TypeScript** — application logic and type safety
- **Node.js** — runtime and backend processes
- **Presage SmartSpectra SDK** — live physiological measurements
- **Recharts** — visualization of physiological measurements
- **SQLite** — not used; see "Local data storage" below

## Important Notes

### Local data storage (Phase 6)

- Session history stores **summaries only** (duration, mode, averages over trusted
  readings, good-signal seconds). Raw camera frames, video, and images are **never
  stored**.
- Data lives locally in the app's data folder (shown in Settings → data location):
  `privacy.json` (consent + history preference) and `session-history.json`.
- **No SQLite/native database**: plain, inspectable JSON keeps the app buildable
  everywhere with zero native-module friction, and makes "what do you store?" a
  file anyone can open.
- Consent is explicit and blocking: the app explains everything on first launch;
  declining keeps the app usable but disables monitoring. Consent and history
  recording are both toggleable, and "Delete all history" truly empties the store.
- SmartSpectra SDK **telemetry is disabled** (`enableTelemetry: false`).

- CalmDesk AI is **not a medical application**. It does not diagnose, treat, or detect medical or
  psychological conditions.
- Camera access requires **explicit user consent** before monitoring begins.
- No raw video is recorded or stored.
- API keys are kept out of source code and out of this public repository.

## Repository

Public repository: https://github.com/Nicholas-Kipngetich/calmdesk-ai
