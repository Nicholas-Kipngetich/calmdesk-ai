# DEV post draft — CalmDesk AI

> Draft author's notes (delete before publishing):
> 1. **Scrub this conversation/transcripts of the API key before publishing.**
> 2. Insert real screenshots where marked, and the demo video embed at the top.
> 3. Tag: `#presagechallenge` (+ `#devchallenge`, `#electron`, `#typescript`, `#privacy`).

---

**Title:** I built a workspace that responds to your breathing — CalmDesk AI, a Remote Phase
Presage submission

Cover image: dashboard screenshot.

## The idea

Your laptop already has a sensor pointed at you all day: the webcam. Presage's
SmartSpectra SDK turns that camera into a non-contact physiological monitor — real
breathing rate and pulse from live video, analysed on-device.

I wanted to use that not for another wellness dashboard nobody opens, but for
something that quietly acts on your state: **a workspace that responds to you.**

**CalmDesk AI** is a Windows Electron app that:

1. **Watches how you actually are** — live breathing and pulse via the camera, with
   a live preview so you always know what's captured.
2. **Adapts the guidance to your own biology** — the breathing guide's pacing is
   derived from your last *trusted* measured rate: slightly slower than you are now,
   longer exhale. Not a canned 4-7-8 template.
3. **Never shows a number it can't back up** — this became the app's design core
   (more below).
4. **Protects privacy end to end** — consent gate, summary-only local history,
   one-click deletion, telemetry off.

[INSERT: dashboard screenshot with valid readings]

[INSERT: breathing guide with "Adaptive pacing · from your measured X BPM" chip]

## The design decision that shaped everything: don't trust, verify

Physiological data is uncannily believable. A wrong number presented confidently
undermines trust forever. So I enforced a hard rule: **the UI may never present a
reading as valid unless the SDK says so.**

Concretely:

- Confidence starts at 0 and only becomes meaningful after the analysis window
  fills (~30s breathing, ~12s pulse). Until then the UI says "Processing…" — never
  a number. And I do exactly what the official docs state.
- `stable: false` is treated like a validation warning → rendered "untrustworthy."
- Non-OK validation codes surface **the SDK's own hint string verbatim** ("Use a
  camera mode that provides at least 25 frames per second" etc.) — quality feedback
  stays honest and traceable to the source of truth.
- Every stored summary average is computed from VALID measurements only. A session
  where nothing was trusted is recorded as... nothing: `no valid readings`. No
  made-up numbers, ever.
- The demo/offline fallback source passes through the exact same contract and is
  unmistakably labelled everywhere it appears, including in stored history.

[INSERT: capture-quality card / validation hint screenshot]

## Architecture: the official pattern, hardened

CalmDesk uses the official Electron integration as its skeleton — the SDK's
`bindSmartSpectraIpc` in the main process, the preload bridge bundled in the
sandboxed preload (sandboxed preloads can't `require()` external packages, so
`@smartspectra/node-sdk/preload` is bundled rather than externalized — a real
gotcha), and the renderer-side SDK acquiring the camera via `getUserMedia`.

On top of that:

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
  `webviewTag: false`
- camera granted only to the app's own page, media-only
- my own IPC is a six-channel explicit allowlist (`app:info`, `app:config`,
  `privacy:get/set`, `history:append/list/clear`), typed end to end,
  with main-process validation of renderer payloads
- the API key lives in a gitignored `.env`, read only in main, delivered only via
  the `app:config` channel at runtime

[INSERT: consent gate screenshot]

## What I built on top: privacy as a feature, not a checkbox

- **Consent is a blocking, readable gate** — what the camera does, what is
  (and isn't) stored, telemetry off, not-a-medical-device — all in one screen,
  persisted so it runs once. Decline and the app stays usable without monitoring.
- **History stores summaries only**: duration, mode, averages over trusted
  readings, seconds of good signal. No frames, no video, no images. Ever.
- **Deletions are real**: "Delete all history" empties the store (verified
  on-disk during development).
- The data folder path is **shown in the app**, and it's just two JSON files
  (`privacy.json`, `session-history.json`) — deliberately no SQLite/native DB:
  anyone can inspect exactly what's stored.

## Honest dev diary: the debugging story judges might enjoy

- **First-run provisioning takes ~45–60s** (device key provisioning before
  authorization). I raised my IPC ack timeout so the first session succeeds
  instead of timing out.
- **A late-arriving SDK error crashed my UI** during teardown: the SDK calls event
  callbacks without a `this` receiver, so an ordinary method lost its binding. All
  handlers are now arrow properties, and teardown hardening includes
  "ignore events that arrive after teardown begins."
- **Windows certificate revocation over port 80**: on networks that block
  *all* plain-HTTP, the SDK's authorization could never complete
  (`CERT_TRUST_REVOCATION_STATUS_UNKNOWN` from schannel → `POST /device/pair`
  revocation of `.amazontrust.com` endpoints). Diagnosing this took one
  methodical network switch + `curl.exe` + DNS-cache comparison, and it's now
  documented in the repo so others don't lose an afternoon to it.
- **A dark room silently halves your fps.** The SDK's `FRAME_RATE_TOO_LOW` hint
  says one of the causes plainly: lighting. Readings in dim rooms aren't just
  inaccurate, they can fall below the camera-mode threshold the SDK requires.
- **HMR + a running SDK session = weird states.** Vite hot-reloading a context
  file while monitoring crashed with confusing "must be used inside Provider"
  errors — a class of dev-only pain that led me to build the app-wide error
  boundary, so any remaining unknown failure shows a calm recovery card with
  "Reload app" instead of a dead window.

[INSERT: error boundary screenshot]

## What's next

- Trend charts (Recharts) over your own history — self-comparison only
- A "workspace auto-switch" when sustained elevation is detected over a longer window
- More validation-code-specific coaching

## Not a medical device

SmartSpectra metrics are general wellness information per Presage's docs.
CalmDesk AI displays them for self-awareness only and never diagnoses or treats.

---

**Links** — repo: `https://github.com/Nicholas-Kipngetich/calmdesk-ai` ·
auto-integration notes: `docs/INTEGRATION-NOTES.md`

Used: `@smartspectra/node-sdk` (breathing + pulse, official Electron pattern),
`breathingMetrics` bundle, validation-status and confidence APIs, telemetry opt-out,
demo-mode fallback for offline testing.
