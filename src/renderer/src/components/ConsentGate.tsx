import type { PrivacySettings } from '../../../shared/types'

/**
 * ConsentGate (Feature: privacy & consent).
 *
 * Blocks the workspace with an explicit, readable explanation until the
 * user makes an informed camera decision. Persisted by the main process
 * (privacy.json), so it runs exactly once per data folder unless the user
 * changes their mind in Settings.
 *
 * Declining keeps the app usable (workspace, timers, guides) but monitoring
 * stays disabled until consent is granted here or in Settings.
 */

interface ConsentGateProps {
  privacy: PrivacySettings | null
  onDecide: (consented: boolean) => void
}

export function ConsentGate({ privacy, onDecide }: ConsentGateProps): React.JSX.Element | null {
  // Null = still loading; do not flash the dialog during startup.
  if (!privacy || privacy.consented) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="card modal-card">
        <h3 id="consent-title" className="card-title">
          Before we begin
        </h3>
        <div className="consent-body">
          <p className="guidance-text">
            CalmDesk AI reads your breathing and pulse <strong>through your camera</strong>,
            using the on-device SmartSpectra pipeline. Here is exactly what that means:
          </p>
          <ul className="roadmap">
            <li>
              <strong>Camera stays local.</strong> Frames are analysed on your machine by
              the SDK pipeline; CalmDesk never uploads video or images.
            </li>
            <li>
              <strong>No telemetry.</strong> The SDK's telemetry is disabled
              (<code>enableTelemetry: false</code>), disclosed in the README.
            </li>
            <li>
              <strong>History is optional and local.</strong> Session summaries (duration,
              averages) are stored only in this app's data folder, and only if you leave
              history enabled. One click deletes everything.
            </li>
            <li>
              <strong>Not a medical device.</strong> Readings are wellness information,
              never diagnosis or treatment.
            </li>
          </ul>
        </div>
        <div className="head-actions">
          <button type="button" className="btn btn-primary" onClick={() => onDecide(true)}>
            I understand - use my camera
          </button>
          <button type="button" className="btn" onClick={() => onDecide(false)}>
            Not now
          </button>
        </div>
        <p className="guidance-text muted consent-fineprint">
          You can change this any time in Settings. "Not now" keeps the app available
          without monitoring.
        </p>
      </div>
    </div>
  )
}
