import { useState } from 'react'
import type { ViewKey } from '../../shared/types'
import { MonitoringProvider, useMonitoring } from './state/MonitoringContext'
import { Sidebar } from './components/Sidebar'
import { ConsentGate } from './components/ConsentGate'
import { DashboardView } from './views/DashboardView'
import { BreathingView } from './views/BreathingView'
import { BreakView } from './views/BreakView'
import { HistoryView } from './views/HistoryView'
import { SettingsView } from './views/SettingsView'

/** Each activity maps to a workspace mode (Feature 4). */
const VIEW_TO_MODE: Partial<Record<ViewKey, 'focus' | 'breathing' | 'break'>> = {
  dashboard: 'focus',
  breathing: 'breathing',
  break: 'break'
}

function Shell(): React.JSX.Element {
  const { setMode, quiet, privacy, updatePrivacy } = useMonitoring()
  const [view, setView] = useState<ViewKey>('dashboard')

  const selectView = (next: ViewKey): void => {
    setView(next)
    const linkedMode = VIEW_TO_MODE[next]
    if (linkedMode) setMode(linkedMode)
  }

  return (
    <div className="layout" data-ambience={quiet ? 'quiet' : currentAmbience(view)}>
      <Sidebar view={view} onSelect={selectView} />
      <main className="content">
        {view === 'dashboard' && <DashboardView onNavigate={selectView} />}
        {view === 'breathing' && <BreathingView />}
        {view === 'break' && <BreakView />}
        {view === 'history' && <HistoryView />}
        {view === 'settings' && <SettingsView />}
      </main>
      <ConsentGate
        privacy={privacy}
        onDecide={(consented) => {
          void updatePrivacy({ consented })
        }}
      />
    </div>
  )
}

function currentAmbience(view: ViewKey): string {
  return VIEW_TO_MODE[view] ?? 'focus'
}

export default function App(): React.JSX.Element {
  return (
    <MonitoringProvider>
      <Shell />
    </MonitoringProvider>
  )
}
