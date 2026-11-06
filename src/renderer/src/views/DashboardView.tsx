import { useMonitoring } from '../state/MonitoringContext'
import { MetricCard } from '../components/MetricCard'
import { QualityChip } from '../components/QualityChip'
import type { MonitoringStatus, SignalQualityStatus } from '../../../shared/types'

function formatSession(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Feature 2: explain how to improve capture conditions whenever the current
 * signal state is not trustworthy. Handles both monitoring statuses and
 * signal-quality states from one place.
 */
function guidanceText(status: MonitoringStatus, quality: SignalQualityStatus): string {
  switch (status) {
    case 'idle':
    case 'stopping':
      return 'Start monitoring to begin capturing your breathing and pulse signals through the camera.'
    case 'starting':
      return 'Preparing the signal pipeline — keep your face centred.'
    case 'error':
      return 'Something went wrong while capturing signals.'
    case 'monitoring':
      switch (quality) {
        case 'processing':
          return 'Stabilising your signal. Sit still, keep your face centred, and keep lighting even.'
        case 'valid':
          return 'Signal quality is good — the readings above can be trusted.'
        case 'poor':
          return 'We are not confident in the current reading. To improve capture: sit still, brighten your lighting, and centre your face in the camera view.'
        case 'camera-unavailable':
          return 'No camera is available. Make sure a webcam is connected and camera access is allowed.'
        case 'unavailable':
          return 'No signal is currently available.'
      }
  }
  return 'Preparing the signal pipeline — keep your face centred.'
}

export function DashboardView(): React.JSX.Element {
  const { status, frame, sessionSeconds, startMonitoring, stopMonitoring } = useMonitoring()

  const quality: SignalQualityStatus =
    status === 'idle' ? 'unavailable' : status === 'starting' ? 'processing' : (frame?.overallQuality ?? 'processing')

  const live = status === 'monitoring' || status === 'starting'

  return (
    <section className="view">
      <header className="view-head">
        <div>
          <h2 className="view-title">Focus workspace</h2>
          <p className="view-subtitle muted">
            Demo signal source · live SmartSpectra capture arrives in Phase 4
          </p>
        </div>
        <div className="head-actions">
          {live ? (
            <button type="button" className="btn btn-danger" onClick={stopMonitoring}>
              Stop monitoring
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={startMonitoring}>
              Start monitoring
            </button>
          )}
        </div>
      </header>

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

      <div className="card guidance-card">
        <div className="guidance-head">
          <QualityChip status={quality} />
          <span className="metric-label">Capture quality</span>
        </div>
        <p className="guidance-text">{guidanceText(status, quality)}</p>
      </div>
    </section>
  )
}
