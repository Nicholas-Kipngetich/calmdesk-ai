import { useEffect, useState } from 'react'
import type { SessionSummary } from '../../../shared/types'

/**
 * Session history (Phase 6).
 * Reads LOCAL session summaries from the main-process store via the
 * allowlisted IPC bridge. Shows what was measured and how confident the
 * session was - and where the data lives - with honest labels for demo
 * sessions and sessions that produced no trusted readings.
 */

function formatClock(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}m ${String(s).padStart(2, '0')}s`
}

function modeLabel(mode: SessionSummary['mode']): string {
  return mode === 'focus' ? 'Focus' : mode === 'breathing' ? 'Breathing' : 'Break'
}

export function HistoryView(): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null)

  useEffect(() => {
    let active = true
    window.calmdesk
      .listSessions()
      .then((list) => {
        if (active) setSessions(list)
      })
      .catch(() => {
        if (active) setSessions(null)
      })
    return () => {
      active = false
    }
  }, [])

  const deleteAll = async (): Promise<void> => {
    if (sessions === null) return
    await window.calmdesk.clearHistory()
    // Confirm the deletion actually happened, then adopt the result.
    try {
      setSessions(await window.calmdesk.listSessions())
    } catch {
      setSessions([])
    }
  }

  if (sessions === null) {
    return (
      <section className="view">
        <header className="view-head">
          <div>
            <h2 className="view-title">Session history</h2>
            <p className="view-subtitle muted">Your own data · only you</p>
          </div>
        </header>
        <div className="card guidance-card">
          <p className="guidance-text">History could not be loaded. You can try again.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="view">
      <header className="view-head">
        <div>
          <h2 className="view-title">Session history</h2>
          <p className="view-subtitle muted">
            {sessions.length === 0
              ? 'No sessions recorded yet'
              : `${sessions.length} session${sessions.length === 1 ? '' : 's'} · stored locally, never uploaded`}
          </p>
        </div>
        {sessions.length > 0 && (
          <div className="head-actions">
            <button type="button" className="btn btn-danger" onClick={() => void deleteAll()}>
              Delete all history
            </button>
          </div>
        )}
      </header>

      {sessions.length === 0 ? (
        <div className="card guidance-card">
          <p className="guidance-text">
            When you finish a monitoring session, a summary (duration, average breathing
            and pulse, signal quality) is saved here on this computer only - never
            uploaded. Raw frames, video, and images are never stored at all.
          </p>
        </div>
      ) : (
        <div className="history-list">
          {sessions.map((s) => (
            <div key={s.id} className="card history-card">
              <div className="history-row">
                <div>
                  <span className="history-when">{formatClock(s.startedAt)}</span>
                  <span className="history-mode">{modeLabel(s.mode)}</span>
                  {s.source === 'demo' && (
                    <span className="quality-chip demo-chip">
                      <span className="quality-dot" aria-hidden="true" />
                      Demo
                    </span>
                  )}
                  {s.status === 'interrupted' && (
                    <span className="history-interrupted">interrupted</span>
                  )}
                </div>
                <span className="history-duration">{formatDuration(s.durationSeconds)}</span>
              </div>
              <div className="history-row history-details">
                <span className="muted">
                  Breathing:{' '}
                  <strong>
                    {s.avgBreathing !== null ? `${s.avgBreathing} breaths/min` : 'no valid readings'}
                  </strong>
                </span>
                <span className="muted">
                  Pulse:{' '}
                  <strong>
                    {s.avgPulse !== null ? `${s.avgPulse} bpm` : 'no valid readings'}
                  </strong>
                </span>
                <span className="muted">
                  Good signal: <strong>{s.validSeconds}s</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
