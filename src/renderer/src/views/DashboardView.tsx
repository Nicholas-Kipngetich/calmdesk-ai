import { useMonitoring } from '../state/MonitoringContext'
import { MetricCard } from '../components/MetricCard'
import { PreviewCard } from '../components/PreviewCard'
import { QualityChip } from '../components/QualityChip'
import type { MonitoringStatus, SignalQualityStatus } from '../../../shared/types'

function formatSession(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Feature 1/2: explain the capture state in the user's language.
 * SmartSpectra's official hint strings are surfaced verbatim when present;
 * these lines cover the remaining lifecycle states.
 */
function guidanceText(status: MonitoringStatus, quality: SignalQualityStatus, hint: string | null): string {
  switch (status) {
    case 'idle':
    case 'stopping':
      return 'Start monitoring to begin capturing your breathing and pulse signals through the camera.'
    case 'starting':
      return 'Preparing the signal pipeline — keep your face centred.'
    case 'error':
      return 'Signal capture stopped with an error. You can try again below.'
    case 'monitoring':
      if (hint && quality === 'poor') return hint
      switch (quality) {
        case 'processing':
          return hint ?? 'Stabilising your signal. Sit still, keep your face centred, and keep lighting even.'
        case 'valid':
          return 'Signal quality is good — the readings above can be trusted.'
        case 'poor':
          return 'We are not confident in the current reading. Sit still, brighten your lighting, and centre your face in the camera view.'
        case 'camera-unavailable':
          return 'No camera is available. Make sure a webcam is connected and camera access is allowed.'
        case 'unavailable':
          return 'No signal is currently available.'
      }
      return 'Preparing the signal pipeline — keep your face centred.'
  }
  return 'Preparing the signal pipeline — keep your face centred.'
}

export function DashboardView(): React.JSX.Element {
  const { status, errorMessage, frame, stream, sessionSeconds, startMonitoring, stopMonitoring } =
    useMonitoring()

  const live = status === 'monitoring' || status === 'starting'
  const quality: SignalQualityStatus =
    status === 'idle'
      ? 'unavailable'
      : status === 'error'
        ? 'unavailable'
        : (frame?.overallQuality ?? 'processing')

  return (
    <section className="view">
      <header className="view-head">
        <div>
          <h2 className="view-title">Focus workspace</h2>
          <p className="view-subtitle muted">Live SmartSpectra signals · nothing is recorded or stored</p>
        </div>
        <div className="head-actions">
          {live ? (
            <button type="button" className="btn btn-danger" onClick={stopMonitoring}>
              Stop monitoring
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={startMonitoring}>
              {status === 'error' ? 'Try again' : 'Start monitoring'}
            </button>
          )}
        </div>
      </header>

      {status === 'error' && errorMessage && (
        <div className="card error-card">
          <p className="guidance-text">
            <strong>Signal issue:</strong> {errorMessage}
          </p>
        </div>
      )}

      <div className="cards-row">
        <MetricCard label="Breathing rate" measurement={frame?.breathingRate ?? null} />
        <MetricCard label="Pulse rate" measurement={frame?.pulseRate ?? null} />
        <div className="card metric-card">
          <div className="metric-head">
            <span className="metric-label">Session</span>
          </div>
          <div className="metric-value metric-value-small" aria-live="off">
            {status === 'monitoring' ? formatSession(sessionSeconds) : formatSession(0)}
          </div>
          <div className="metric-unit muted">elapsed time</div>
        </div>
      </div>

      <div className="cards-row">
        <PreviewCard stream={stream} />

        <div className="card guidance-card">
          <div className="guidance-head">
            <QualityChip status={quality} />
            <span className="metric-label">Capture quality</span>
          </div>
          <p className="guidance-text">
            {guidanceText(status, quality, frame?.validation?.hint ?? null)}
          </p>
        </div>
      </div>
    </section>
  )
}
