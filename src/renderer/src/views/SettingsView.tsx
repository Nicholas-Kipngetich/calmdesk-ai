import { useEffect, useState } from 'react'
import { useMonitoring } from '../state/MonitoringContext'

/**
 * Settings & privacy (Phase 6).
 * Real controls over the local privacy store, plus the disclosures we make
 * about what leaves this machine (almost nothing) and what gets stored
 * (session summaries only).
 */
export function SettingsView(): React.JSX.Element {
  const { privacy, updatePrivacy, startMonitoring, stopMonitoring, status } = useMonitoring()
  const [confirmDelete, setConfirmDelete] = useState<'idle' | 'armed'>('idle')

  useEffect(() => {
    // Dis-arm the destructive button if the user moves on.
    return () => setConfirmDelete('idle')
  }, [])

  const deleteAllHistory = async (): Promise<void> => {
    if (confirmDelete !== 'armed') {
      setConfirmDelete('armed')
      return
    }
    await window.calmdesk.clearHistory()
    setConfirmDelete('idle')
  }

  const historyOn = privacy?.historyEnabled !== false

  return (
    <section className="view">
      <header className="view-head">
        <div>
          <h2 className="view-title">Settings &amp; privacy</h2>
          <p className="view-subtitle muted">You stay in control</p>
        </div>
        <div className="head-actions">
          {status === 'monitoring' ? (
            <button type="button" className="btn btn-danger" onClick={stopMonitoring}>
              Emergency stop
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={startMonitoring}>
              Start monitoring
            </button>
          )}
        </div>
      </header>

      <div className="card settings-card">
        <h3 className="card-title">Camera consent</h3>
        <p className="guidance-text">
          {privacy?.consented ? (
            <>
              Private. Monitoring is enabled. You can withdraw consent - monitoring will
              then refuse to start until you re-grant it here.
            </>
          ) : (
            <>
              Not granted yet or withdrawn. The app stays usable, but camera monitoring
              is disabled until you consent.
            </>
          )}
        </p>
        <div className="head-actions">
          {privacy?.consented ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                void updatePrivacy({ consented: false })
              }}
            >
              Withdraw camera consent
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                void updatePrivacy({ consented: true })
              }}
            >
              Grant camera consent
            </button>
          )}
        </div>
      </div>

      <div className="card settings-card">
        <h3 className="card-title">Local session history</h3>
        <p className="guidance-text">
          {historyOn ? (
            <>
              <strong>On.</strong> Finished sessions are summarized (duration, averages
              over trusted readings only) and stored locally. Raw frames, video, and
              images are never stored.
            </>
          ) : (
            <>
              <strong>Off.</strong> Nothing from your sessions is written to disk.
            </>
          )}
        </p>
        <div className="head-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              void updatePrivacy({ historyEnabled: !historyOn })
            }}
          >
            {historyOn ? 'Turn history off' : 'Turn history on'}
          </button>
          <button type="button" className="btn btn-danger" onClick={() => void deleteAllHistory()}>
            {confirmDelete === 'armed' ? 'Click again to delete everything' : 'Delete all history'}
          </button>
        </div>
        {privacy?.dataPath && (
          <p className="guidance-text muted">
            Data location (on your computer only):{' '}
            <code>{privacy.dataPath}</code>
          </p>
        )}
      </div>

      <div className="card settings-card">
        <h3 className="card-title">Telemetry &amp; data disclosure</h3>
        <ul className="roadmap">
          <li>
            SDK telemetry is <strong>disabled</strong> (<code>enableTelemetry: false</code>).
          </li>
          <li>
            Camera frames are analysed by the on-device SmartSpectra pipeline; CalmDesk
            never uploads video or images, and stores none.
          </li>
          <li>
            With your API key, the SDK contacts Presage's authorization servers to verify
            usage - required by the SDK's terms; no measurement content is uploaded by
            CalmDesk AI.
          </li>
          <li>
            Session history lives in this app's data folder (above) and never leaves it
            unless you delete or copy it yourself.
          </li>
          <li>
            Readings are <strong>general wellness information, not a medical device</strong>;
            they never diagnose or treat anything.
          </li>
        </ul>
      </div>
    </section>
  )
}
