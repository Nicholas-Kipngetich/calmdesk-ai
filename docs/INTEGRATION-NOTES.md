# CalmDesk AI — SmartSpectra Integration Notes

This document records how CalmDesk AI integrates the **Presage SmartSpectra SDK**
(`@smartspectra/node-sdk` v3.4.0), which official APIs it uses, and the
environment requirements discovered during development. It exists to make our
SDK usage transparent and verifiable.

## Official sources used

- Node.js/Electron docs: https://smartspectra.presagetech.com/docs/nodejs
- API reference: https://smartspectra.presagetech.com/docs/nodejs/api-reference
- Metrics guide: https://smartspectra.presagetech.com/docs/nodejs/metrics
- Measurement quality guide: https://smartspectra.presagetech.com/docs/measurement-quality
- Telemetry & privacy: https://smartspectra.presagetech.com/docs/telemetry-and-privacy
- Official Electron sample: https://github.com/Presage-Security/SmartSpectra/tree/main/nodejs/samples/electron-quickstart

## Integration architecture (the official Electron pattern)

```
Renderer (React)
  SmartSpectraSDK from '@smartspectra/node-sdk/renderer'
    - acquires the camera via getUserMedia (Electron shows the OS prompt + LED)
    - emits 'streamAvailable' -> our visible camera preview
    - emits 'metrics'  -> decoded via '@smartspectra/node-sdk/messages'
    - emits 'validationStatus' (code, timestamp, official hint string)
    - emits 'error'    -> graceful UI states + cardio fallback
        | (frames ship over a private MessagePort)
Preload
  '@smartspectra/node-sdk/preload' bundled inside our sandboxed preload
Main process
  bindSmartSpectraIpc(window) from '@smartspectra/node-sdk/main'
    - owns the native SDK session (per renderer connection)
    - teardown automatic on window close
```

Security settings: `contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true`. Camera permission is granted by an explicit
`setPermissionRequestHandler` only to the app's own page, media-only.

## What CalmDesk requests

- Metric bundles: `breathingMetrics` always; `MetricType.PULSE_RATE` added when
  the API key supports cardio (graceful fallback to breathing-only otherwise).
- `enableTelemetry: false` — SDK telemetry is DISABLED (privacy-first; the
  official opt-out, disclosed also in README).
- CSP updated per official docs to allow `blob:` workers (`worker-src`),
  `blob:` images/media for the preview.

## Trust rules implemented (from official guidance)

- Confidence starts at 0 and becomes meaningful only after the metric window
  fills (~30s breathing, ~12s pulse). Readings before that are shown as
  "Processing…", never as valid numbers.
- `stable === false` is treated like a validation warning.
- Non-OK `validationStatus` codes degrade the reading and surface the SDK's
  official hint string verbatim (e.g. "Center your face in the frame.").
- IPC ack timeout raised to 60s to tolerate first-time server provisioning
  on a brand-new API key (~45–60s observed).

## Environment requirements found during development

Windows verification of the Presage servers uses standard Windows (schannel)
certificate revocation checks over plain HTTP (port 80) to
`crl/ocsp.r2m04.amazontrust.com` (Amazon Trust Services). On networks where
outbound port-80 HTTP is blocked entirely (we verified even
`http://www.msftconnecttest.com` times out), usage verification cannot complete
(`CERT_TRUST_REVOCATION_STATUS_UNKNOWN`), and the first session fails with a
clear error. On an unfiltered network (e.g. a phone hotspot), first-start
provisioning completes and live metrics flow. This is a network policy issue,
not an SDK defect; we document it because judges may face it too.

## Not a medical device

Per Presage's official guidance, SDK metrics are for general wellness and
informational purposes only and are not FDA-cleared. CalmDesk AI displays
them for self-awareness only and never diagnoses or treats anything.
