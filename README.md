# CalmDesk AI

> **A workspace that responds to you.**

CalmDesk AI is a privacy-first desktop wellness companion for Windows, built for the
[Presage SmartSpectra SDK Challenge](https://dev.to/devteam/join-the-presage-smartspectra-sdk-challenge-3000-in-prizes-across-10-winners).

It reads **breathing rate** and **pulse rate** from your webcam through the on-device
**Presage SmartSpectra SDK** — and adapts your workspace to what it can *trust*:

- **Never displays an untrusted reading.** Numbers appear only when the SDK's
  confidence is real (post-warm-up, valid stability); everything else is labelled
  honestly as "Processing…" or "unreliable".
- **Adapts the breathing guide to you**, not to a fixed template: the pacing is
  derived from your last valid measured breathing rate (slightly slower, longer
  exhale), always labelled "adapted from your measurement".
- **Offers, never forces**: when your measured breathing stays elevated, the app
  suggests a short guided pause — dismissible, optional.
- **Protects your privacy end to end**: explicit consent before any camera access,
  summary-only local history, one-click deletion, and zero telemetry.

---

## What it does

| Feature | Where | What makes it different |
|---|---|---|
| Live breathing + pulse monitoring, camera preview | Dashboard | Camera framing and quality feedback are surfaced in plain language (exact SDK hints), with confidence and stability shown next to trusted values |
| Workspace modes | Sidebar | Focus / Breathing / Break ambience switches, plus a global Quiet mode that slows every animation down |
| Adaptive breathing guide | Breathing view | Pacing derived from your measured rate (~linear: slightly slower, 40% inhale / 60% exhale), fixed-calm fallback clearly labelled when no trusted signal exists |
| Elevated-breathing suggestion | Dashboard | Offer (not nag) after sustained trusted elevation; restarts only on new sustained evidence after dismissal |
| Break timer | Break view | 5-minute local-only timer with progress bar |
| Session history | History view | Summary-only records (duration, mode, averages over trusted readings, seconds of good signal), stored locally, one-click "delete all" |
| Consent & privacy controls | Settings | Blocking first-run consent gate, withdrawable at any time; history on/off; exact data-folder path disclosed; emergency stop |
| Resilience | Everywhere | App-wide error boundary with a calm recovery screen; missing-preload guards; IPC input validation in main |

## Architecture

```
                  ┌────────────────────────────────────────────────────┐
                  │                    Renderer (React)                │
                  │  SmartSpectraSDK (@smartspectra/node-sdk/renderer) │
                  │   • getUserMedia camera capture + preview stream   │
                  │   • 'metrics' → decoded → SignalFrame              │
                  │   • 'validationStatus' → SDK hint shown verbatim   │
                  │   • 'error' → graceful degrade + cardio fallback   │
                  └───────────────┬────────────────────────────────────┘
       typed, allowlisted IPC     │ private MessagePort (official bridge)
       (app / privacy / history)  ▼
                  ┌────────────────────────────────────────────────────┐
                  │  Preload ( sandboxed, contextIsolation: true )     │
                  │  '@smartspectra/node-sdk/preload' + tiny API       │
                  └───────────────┬────────────────────────────────────┘
                                  ▼
                  ┌────────────────────────────────────────────────────┐
                  │                    Main process (Node)             │
                  │  bindSmartSpectraIpc(window) → native SDK session  │
                  │  Camera permission gate (media only, own page)     │
                  │  Local privacy store: privacy.json +               │
                  │    session-history.json (summary-only, capped)     │
                  └────────────────────────────────────────────────────┘
```

Security posture: `contextIsolation: true` · `nodeIntegration: false` ·
`sandbox: true` · `webviewTag: false` · explicit IPC allowlist (six plus the
SDK bridge) · renderer input validated in main · camera granted only to the
app's own page.

**Trust rules** (from Presage's official guidance, enforced in code):

1. Confidence 0 = window not filled (~30 s breathing, ~12 s pulse) → "Processing…"
2. `stable === false` is treated like a validation warning → untrusted
3. Non-OK validation codes → SDK's own hint surfaced verbatim
4. Averages stored/read on-screen come from **valid** measurements only
5. Demo data can never masquerade as live: explicit banner + session tag

## Tech stack

- **Electron + React + TypeScript** — app framework, UI, type-safe contracts
- **@smartspectra/node-sdk** (v3) — live physiological measurements (official
  renderer/preload/main integration pattern)
- **Node.js** — main-process persistence (plain JSON store, no native modules)
- **Recharts** — planned for upcoming trend charts; current UI uses native
  components only

## Getting started

Prerequisites: Node.js ≥ 18, npm, Windows (the SDK is built for Windows/macOS/Linux;
development was done on Windows 11).

```bash
npm install
```

Then add your Presage API key to a **gitignored** `.env` file in the project root:

```
SMARTSPECTRA_API_KEY=your_key_here
```

Run it:

```bash
npm run dev
```

On first launch the app asks for explicit consent before any camera use
(declining keeps the app functional but monitoring off). No key? The error card
offers **demo mode** — a clearly-labelled simulated source so every downstream
feature works offline.

### Environment note (networks + Windows cert checks)

The SmartSpectra native runtime verifies Presage's API servers using Windows
(schannel) certificate revocation checks over **plain HTTP port 80**
(`crl/ocsp` Amazon Trust Services endpoints). On networks that block all
outbound port-80 HTTP, authorization cannot complete — verified and documented
in [`docs/INTEGRATION-NOTES.md`](docs/INTEGRATION-NOTES.md) with reproduction
steps. On an unfiltered network (e.g. a phone hotspot) first-start provisioning
completes and live metrics flow. This is a network-policy quirk, not an SDK
defect — we document it because judges may hit it too.

## Privacy & data storage

- Session history = **summaries only** (never frames/video/images), stored in
  the app's data folder: `privacy.json` (consent + preference) and
  `session-history.json` (capped at 500 records). The exact path is shown in
  Settings.
- **No SQLite/native database** on purpose: inspectable JSON, zero
  native-module build friction, and "what do you store?" becomes a file anyone
  can open.
- SDK **telemetry is disabled** (`enableTelemetry: false`).
- Camera access is consent-gated and preferencable; consent is withdrawable.
- CalmDesk AI is **not a medical application**; it never diagnoses or treats.

## Quality & testing

- **TypeScript strict typecheck** across main, preload, and renderer
  (`npm run typecheck`) is the build-time gate (no ESLint planned; the type
  contract plus the hardening below is the quality strategy).
- **Error boundary** wraps the entire app (provider included): unexpected
  errors show a calm recovery screen with Reload instead of a blank window;
  renderer crashes cannot destroy on-disk data.
- **Sandboxed-IPC hardening**: every `window.calmdesk` call site guards a
  missing preload bridge; the main process validates IPC payload shapes before
  touching the store.

### State matrix exercised during development

| Scenario | Expected UI behaviour |
|---|---|
| Monitoring starts | "Processing…" until the metric window fills — no numbers shown |
| Signal valid | Trusted numbers + confidence/stability surfaced |
| Capture quality degrades | Guidance with the SDK's own hint string, readings marked untrusted |
| Auth/network fails at start | Clear error card with built-in demo fallback |
| Demo source active | Explicit "demo" banner + demo tag on any stored session |
| Consent withdrawn | Monitoring refuses to start with a clear message; app stays usable |
| History off / all deleted | Sessions not recorded / store emptied, on-disk verified |
| Renderer crash | Error boundary recovery screen, history intact on disk |

## Repository

Public repository: https://github.com/Nicholas-Kipngetich/calmdesk-ai »

## License

MIT — see the `author` field in `package.json` and any LICENSE notice added
before submission.
