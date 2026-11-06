import { useEffect, useState } from 'react'
import type { AppInfo } from '../../shared/types'

/**
 * CalmDesk AI - first React surface.
 *
 * A minimal "foundation verified" screen. It exercises the full secure
 * pipeline: React (renderer) -> calmdesk bridge (preload) -> ipcMain
 * (main process) -> back, rendering the response. If this screen shows real
 * data, the entire architecture is proven end-to-end.
 */
function App(): React.JSX.Element {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    window.calmdesk
      .getAppInfo()
      .then(setAppInfo)
      .catch((err) => console.error('Failed to load app info:', err))
  }, [])

  return (
    <div className="app-shell">
      <header className="brand">
        <div className="brand-mark" aria-hidden="true">
          <div className="brand-ring" />
          <div className="brand-core" />
        </div>
        <div>
          <h1 className="brand-name">CalmDesk AI</h1>
          <p className="brand-tagline">A workspace that responds to you.</p>
        </div>
      </header>

      <main>
        <section className="card">
          <h2 className="card-title">Foundation status</h2>
          {appInfo ? (
            <dl className="status-list">
              <div className="status-row">
                <dt>Secure bridge (preload IPC)</dt>
                <dd className="status-ok">Connected</dd>
              </div>
              <div className="status-row">
                <dt>App version</dt>
                <dd>{appInfo.version}</dd>
              </div>
              <div className="status-row">
                <dt>Electron</dt>
                <dd>{appInfo.electron}</dd>
              </div>
              <div className="status-row">
                <dt>Main process Node.js</dt>
                <dd>{appInfo.node}</dd>
              </div>
              <div className="status-row">
                <dt>Platform</dt>
                <dd>{appInfo.platform}</dd>
              </div>
              <div className="status-row">
                <dt>Renderer Node.js access</dt>
                <dd className="status-ok">Disabled (by design)</dd>
              </div>
              <div className="status-row">
                <dt>Context isolation</dt>
                <dd className="status-ok">Enabled</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">Connecting to the main process…</p>
          )}
        </section>

        <section className="card card-ghost">
          <h2 className="card-title">Next phases</h2>
          <ul className="roadmap">
            <li>
              <strong>Phase 3</strong> — Dashboard, workspace modes, breathing animation
            </li>
            <li>
              <strong>Phase 4</strong> — SmartSpectra live signals
            </li>
            <li>
              <strong>Phase 5</strong> — Signal-confidence intelligence &amp; adaptive workspace
            </li>
          </ul>
        </section>
      </main>

      <footer className="footer muted">
        Not a medical application. CalmDesk AI does not diagnose or treat any condition.
      </footer>
    </div>
  )
}

export default App
