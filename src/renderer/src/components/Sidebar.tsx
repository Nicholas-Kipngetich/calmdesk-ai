import type { ViewKey } from '../../../shared/types'
import { useMonitoring } from '../state/MonitoringContext'

const NAV: Array<{ key: ViewKey; label: string; hint: string }> = [
  { key: 'dashboard', label: 'Dashboard', hint: 'Focus workspace' },
  { key: 'breathing', label: 'Breathing', hint: 'Guided breathing' },
  { key: 'break', label: 'Break', hint: 'Rest timer' },
  { key: 'history', label: 'History', hint: 'Your sessions · Phase 6' },
  { key: 'settings', label: 'Settings', hint: 'Privacy · Phase 6' }
]

interface SidebarProps {
  view: ViewKey
  onSelect: (view: ViewKey) => void
}

export function Sidebar({ view, onSelect }: SidebarProps): React.JSX.Element {
  const { status, quiet, setQuiet } = useMonitoring()

  const statusLine =
    status === 'monitoring'
      ? 'Monitoring live'
      : status === 'starting'
        ? 'Starting…'
        : 'Monitoring off'

  return (
    <nav className="sidebar" aria-label="Main navigation">
      <div className="sidebar-brand" aria-hidden="true">
        <div className="brand-mark">
          <div className="brand-ring" />
          <div className="brand-core" />
        </div>
        <span className="sidebar-brand-name">CalmDesk AI</span>
      </div>

      <ul className="nav">
        {NAV.map((item) => (
          <li key={item.key}>
            <button
              type="button"
              className={`nav-item ${view === item.key ? 'nav-active' : ''}`}
              onClick={() => onSelect(item.key)}
            >
              <span className="nav-label">{item.label}</span>
              <span className="nav-hint">{item.hint}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar-foot">
        <div className="monitor-line">
          <span className={`monitor-pulse ${status === 'monitoring' ? 'live' : ''}`} aria-hidden="true" />
          <span className={status === 'monitoring' ? '' : 'muted'}>{statusLine}</span>
        </div>
        <label className="quiet-toggle">
          <input
            type="checkbox"
            checked={quiet}
            onChange={(e) => setQuiet(e.target.checked)}
          />
          Quiet workspace
        </label>
      </div>
    </nav>
  )
}
