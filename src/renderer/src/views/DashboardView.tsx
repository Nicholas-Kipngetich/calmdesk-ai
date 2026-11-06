import { useEffect, useRef, useState } from 'react'
import { useMonitoring } from '../state/MonitoringContext'
import { MetricCard } from '../components/MetricCard'
import { PreviewCard } from '../components/PreviewCard'
import { QualityChip } from '../components/QualityChip'
import type { MonitoringStatus, SignalQualityStatus, ViewKey } from '../../../shared/types'

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

/**
 * Feature 5 (adaptive prompt): if a VALID measured breathing rate stays
 * elevated (>= 16 breaths/min) across a sustained window of consecutive
 * frames, offer - never force - the breathing guide. Dismissible; no
 * auto-navigation; grounded only in trusted measurements.
 */
const ELEVATED_BPM = 16
const SUSTAINED_FRAMES = 20

interface DashboardViewProps {
  onNavigate?: (view: ViewKey) => void
}

export function DashboardView({ onNavigate }: DashboardViewProps): React.JSX.Element {
  const {
    status,
    errorMessage,
    frame,
    stream,
    sessionSeconds,
    demoMode,
    startMonitoring,
    startDemoMonitoring,
    stopMonitoring
  } = useMonitoring()
  const [suggestBreathing, setSuggestBreathing] = useState(false)
  const elevatedFrames = useRef(0)

  useEffect(() => {
    const br = frame?.breathingRate
    const elevated = br?.quality === 'valid' && br.value >= ELEVATED_BPM
    elevatedFrames.current = elevated ? elevatedFrames.current + 1 : 0
    // Suggest only once the elevation is SUSTAINED; stay silent otherwise.
    if (elevatedFrames.current >= SUSTAINED_FRAMES) setSuggestBreathing(true)
  }, [frame])

  const dismissSuggestion = (): void => {
    // Reset the counter so the dismissed card does not instantly reappear
    // while the same sustained elevation continues.
    elevatedFrames.current = 0
    setSuggestBreathing(false)
  }

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

      {demoMode && status === 'monitoring' && (
        <div className="card demo-banner">
          <p className="guidance-text">
            <strong>Demo signal source active.</strong> These numbers are simulated and clearly
            labelled — they are not camera measurements. Start real monitoring again whenever
            you like.
          </p>
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div className="card error-card">
          <p className="guidance-text">
            <strong>Signal issue:</strong> {errorMessage}
          </p>
          <div className="head-actions error-actions">
            <button type="button" className="btn" onClick={startDemoMonitoring}>
              Continue in demo mode
            </button>
          </div>
        </div>
      )}

      {suggestBreathing && status === 'monitoring' && (
        <div className="card suggest-card">
          <p className="guidance-text">
            Your measured breathing has been <strong>elevated</strong> for a while. A short
            guided pause can help you reset — it's entirely optional.
          </p>
          <div className="head-actions error-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onNavigate?.('breathing')}
            >
              Open breathing guide
            </button>
            <button type="button" className="btn" onClick={dismissSuggestion}>
              Dismiss
            </button>
          </div>
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
        <PreviewCard stream={demoMode ? null : stream} />

        <div className="card guidance-card">
          <div className="guidance-head">
            <QualityChip status={quality} />
            <span className="metric-label">Capture quality</span>
          </div>
          <p className="guidance-text">
            {demoMode
              ? 'Demo mode: simulated signal timeline (processing → valid → occasional poor patch) so every state can be exercised offline.'
              : guidanceText(status, quality, frame?.validation?.hint ?? null)}
          </p>
        </div>
      </div>
    </section>
  )
}
