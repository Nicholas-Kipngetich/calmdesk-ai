import { useEffect, useRef, useState } from 'react'
import { useMonitoring } from '../state/MonitoringContext'
import { QualityChip } from '../components/QualityChip'

/**
 * Adaptive Breathing Workspace (Features 3 + 6a).
 *
 * Two clearly separated things on this screen:
 *  1. MEASURED breathing  - what the camera currently observes (only shown
 *     when trusted, and clearly blank when not).
 *  2. EXERCISE            - an optional, user-controlled guided pattern.
 *     Pacing ADAPTS to the last valid measured rate: slightly slower than
 *     the user's current breathing (×0.85), clamped to a calm 6–12 BPM,
 *     with a longer exhale (60% of the cycle). When no trusted measurement
 *     exists it falls back to the fixed 4s in / 6s out pattern, and the
 *     chip always tells the user which mode is active.
 */

const FALLBACK_INHALE_SECONDS = 4
const FALLBACK_EXHALE_SECONDS = 6

type BreathPhase = 'idle' | 'inhale' | 'exhale'

/**
 * Derive inhale/exhale durations (seconds) from a valid measured breathing
 * rate. Returns null when there is no trusted measurement, so the caller
 * can fall back to the fixed pattern and label it honestly.
 */
function adaptivePacing(
  measuredBpm: number | null
): { inhale: number; exhale: number; sourceBpm: number } | null {
  if (measuredBpm === null || !Number.isFinite(measuredBpm) || measuredBpm <= 0) return null
  // Guide slightly slower than the user's current breathing, clamped to a
  // calm range. This is a standard paced-breathing target, not therapy.
  const targetBpm = Math.min(12, Math.max(6, Math.round(measuredBpm * 0.85)))
  const cycleSeconds = 60 / targetBpm
  // ~40% inhale / 60% exhale keeps the calming longer-outbreath shape.
  return {
    inhale: Math.round(cycleSeconds * 0.4 * 10) / 10,
    exhale: Math.round(cycleSeconds * 0.6 * 10) / 10,
    sourceBpm: measuredBpm
  }
}

export function BreathingView(): React.JSX.Element {
  const { frame } = useMonitoring()
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState<BreathPhase>(running ? 'inhale' : 'idle')

  const measured = frame?.breathingRate ?? null
  const measuredTrusted = measured?.quality === 'valid'

  // The pacing is applied at the START of each breath cycle, not mid-phase:
  // restarting a timer mid-exhale would jerk the animation. A ref carries the
  // newest derived pacing into the cycle loop while the effect stays mounted.
  const adaptive =
    measured && measuredTrusted ? adaptivePacing(measured.value) : null
  const pacing = adaptive
    ? { inhale: adaptive.inhale, exhale: adaptive.exhale }
    : { inhale: FALLBACK_INHALE_SECONDS, exhale: FALLBACK_EXHALE_SECONDS }
  const pacingRef = useRef(pacing)
  pacingRef.current = pacing

  useEffect(() => {
    if (!running) {
      setPhase('idle')
      return
    }
    let cancelled = false
    const timers: number[] = []

    const cycle = (): void => {
      if (cancelled) return
      // Read the latest pacing here so adaptations land between breaths.
      const { inhale, exhale } = pacingRef.current
      setPhase('inhale')
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return
          setPhase('exhale')
          timers.push(window.setTimeout(cycle, exhale * 1000))
        }, inhale * 1000)
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

  // Transition duration follows the active phase so the circle's motion
  // matches the (possibly adaptive) pacing, not a hardcoded duration.
  const transitionDuration =
    phase === 'exhale' ? `${pacing.exhale}s` : `${pacing.inhale}s`

  return (
    <section className="view view-center">
      <header className="view-head view-head-narrow">
        <div>
          <h2 className="view-title">Breathing mode</h2>
          <p className="view-subtitle muted">Optional · you are in control of your own pace</p>
        </div>
      </header>

      <div className="breathing-stage">
        <div
          className={`breath-circle ${phase}`}
          style={{ transitionDuration }}
          aria-hidden="true"
        >
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
              {adaptive
                ? `Adaptive pacing · from your measured ${adaptive.sourceBpm.toFixed(0)} BPM`
                : 'Fixed pattern · 4s in / 6s out'}
            </span>
          </div>
          <p className="guidance-text">
            {adaptive ? (
              <>
                The guide is paced at{' '}
                <strong>
                  {pacing.inhale}s in / {pacing.exhale}s out
                </strong>{' '}
                - slightly slower than your measured breathing, with a longer
                exhale. The pacing holds steady during the session so the
                rhythm does not wobble; you choose whether to follow it.
              </>
            ) : (
              <>
                The guided circle follows a calming fixed rhythm with a longer
                exhale - you choose whether to follow it. Once the camera
                produces a <strong>valid</strong> measured breathing rate, the
                pacing will adapt to it and be labelled as adapted.
              </>
            )}{' '}
            This exercise is <strong>not</strong> your measured breathing.
          </p>
        </div>
      </div>
    </section>
  )
}
