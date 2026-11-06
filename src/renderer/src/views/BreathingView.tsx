import { useEffect, useState } from 'react'
import { useMonitoring } from '../state/MonitoringContext'
import { QualityChip } from '../components/QualityChip'

/**
 * Adaptive Breathing Workspace (Feature 3).
 *
 * Two clearly separated things on this screen:
 *  1. MEASURED breathing  - what the camera currently observes (only shown
 *     when trusted, and clearly stateless when not).
 *  2. EXERCISE            - an optional, user-controlled guided pattern with
 *     a fixed calming rhythm. It is NOT the user's measured pattern.
 *     In Phase 5, exercise pacing will adapt to valid measurements.
 */

const INHALE_SECONDS = 4
const EXHALE_SECONDS = 6

type BreathPhase = 'idle' | 'inhale' | 'exhale'

export function BreathingView(): React.JSX.Element {
  const { frame } = useMonitoring()
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState<BreathPhase>(running ? 'inhale' : 'idle')

  const measured = frame?.breathingRate ?? null
  const measuredTrusted = measured?.quality === 'valid'

  useEffect(() => {
    if (!running) {
      setPhase('idle')
      return
    }
    let cancelled = false
    const timers: number[] = []

    const cycle = (): void => {
      if (cancelled) return
      setPhase('inhale')
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return
          setPhase('exhale')
          timers.push(window.setTimeout(cycle, EXHALE_SECONDS * 1000))
        }, INHALE_SECONDS * 1000)
      )
    }
    cycle()

    return () => {
      cancelled = true
      timers.forEach((t) => window.clearTimeout(t))
    }
  }, [running])

  const phaseText =
    phase === 'inhale'
      ? 'Breathe in…'
      : phase === 'exhale'
        ? 'Breathe out, slowly…'
        : 'Press start whenever you are ready.'

  return (
    <section className="view view-center">
      <header className="view-head view-head-narrow">
        <div>
          <h2 className="view-title">Breathing mode</h2>
          <p className="view-subtitle muted">Optional · you are in control of your own pace</p>
        </div>
      </header>

      <div className="breathing-stage">
        <div className={`breath-circle ${phase}`} aria-hidden="true">
          <div className="breath-core" />
        </div>
        <p className="breath-text" aria-live="polite">
          {phaseText}
        </p>
        <button
          type="button"
          className="btn btn-primary breath-toggle"
          onClick={() => setRunning((r) => !r)}
        >
          {running ? 'Stop breathing guide' : 'Start breathing guide'}
        </button>
      </div>

      <div className="cards-row breathing-insight">
        <div className="card metric-card">
          <div className="metric-head">
            <span className="metric-label">Measured breathing</span>
            {frame && <QualityChip status={measured?.quality ?? 'unavailable'} />}
          </div>
          <div className="metric-value">
            {measured && measuredTrusted ? measured.value.toFixed(1) : '—'}
          </div>
          <div className="metric-unit muted">
            {measured && measuredTrusted
              ? measured.unit
              : 'shown only when the signal is valid'}
          </div>
        </div>

        <div className="card guidance-card">
          <div className="metric-head">
            <span className="metric-label">Exercise pacing</span>
            <span className="quality-chip quality-exercise">
              <span className="quality-dot" aria-hidden="true" />
              Fixed pattern · 4s in / 6s out
            </span>
          </div>
          <p className="guidance-text">
            The guided circle follows a calming rhythm with a longer exhale - you choose
            whether to follow it. This is <strong>not</strong> your measured breathing.
            As a next step, the pacing will adapt to valid camera measurements.
          </p>
        </div>
      </div>
    </section>
  )
}
