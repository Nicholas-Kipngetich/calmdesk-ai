import { useEffect, useState } from 'react'

/** Break Mode (Feature 4): a calm 5-minute rest timer. */
const BREAK_SECONDS = 5 * 60

export function BreakView(): React.JSX.Element {
  const [remaining, setRemaining] = useState(BREAK_SECONDS)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false)
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [running])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const progress = 1 - remaining / BREAK_SECONDS
  const complete = remaining === 0

  return (
    <section className="view view-center">
      <header className="view-head view-head-narrow">
        <div>
          <h2 className="view-title">Break mode</h2>
          <p className="view-subtitle muted">Step away from the screen · 5 minutes</p>
        </div>
      </header>

      <div className="break-stage">
        <div className="break-time" aria-live="off">
          {complete
            ? 'Welcome back.'
            : `${minutes}:${String(seconds).padStart(2, '0')}`}
        </div>
        <div className="break-bar" aria-hidden="true">
          <div className="break-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className="head-actions">
          {complete ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setRemaining(BREAK_SECONDS)
              }}
            >
              Start another break
            </button>
          ) : running ? (
            <button type="button" className="btn" onClick={() => setRunning(false)}>
              Pause
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setRunning(true)}>
              {remaining === BREAK_SECONDS ? 'Start break' : 'Resume'}
            </button>
          )}
          <button
            type="button"
            className="btn"
            disabled={remaining === BREAK_SECONDS}
            onClick={() => {
              setRunning(false)
              setRemaining(BREAK_SECONDS)
            }}
          >
            Reset
          </button>
        </div>
        <p className="breath-text muted">
          Nothing is recorded during a break. This timer is purely local.
        </p>
      </div>
    </section>
  )
}
