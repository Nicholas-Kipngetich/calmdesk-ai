import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import type { ReactNode } from 'react'
import type { MonitoringStatus, SessionMode, SignalFrame, SignalSource } from '../../../shared/types'
import { DemoSignalSource } from '../sources/demoSignalSource'

/**
 * MonitoringContext - the single source of truth for live signal state,
 * the session clock, and workspace ambience.
 *
 * Renderer-only in Phase 3 (demo source). In Phase 4 the same interface is
 * fed by the SmartSpectra adapter through the secure preload bridge.
 */

interface MonitoringContextValue {
  status: MonitoringStatus
  frame: SignalFrame | null
  sessionSeconds: number
  mode: SessionMode
  quiet: boolean
  startMonitoring: () => void
  stopMonitoring: () => void
  setMode: (mode: SessionMode) => void
  setQuiet: (quiet: boolean) => void
}

const MonitoringContext = createContext<MonitoringContextValue | null>(null)

export function MonitoringProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const sourceRef = useRef<SignalSource | null>(null)
  const [status, setStatus] = useState<MonitoringStatus>('idle')
  const [frame, setFrame] = useState<SignalFrame | null>(null)
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const [mode, setModeState] = useState<SessionMode>('focus')
  const [quiet, setQuiet] = useState(false)

  const startMonitoring = useCallback(async (): Promise<void> => {
    if (sourceRef.current) return
    setStatus('starting')
    setFrame(null)
    setSessionSeconds(0)

    // Simulated warm-up so the full UX (starting -> processing -> live) is
    // testable before the real SDK arrives in Phase 4.
    await new Promise((resolve) => setTimeout(resolve, 1400))

    // Stopped while starting? Respect that.
    if (sourceRef.current) return

    const source = new DemoSignalSource()
    sourceRef.current = source
    source.subscribe(setFrame)
    source.start()
    setStatus('monitoring')
  }, [])

  const stopMonitoring = useCallback((): void => {
    sourceRef.current?.stop()
    sourceRef.current = null
    setFrame(null)
    setStatus('idle')
  }, [])

  const setMode = useCallback((next: SessionMode): void => {
    setModeState(next)
  }, [])

  // Session clock: ticks only while monitoring is live.
  useEffect(() => {
    if (status !== 'monitoring') return
    const id = window.setInterval(() => setSessionSeconds((s) => s + 1), 1000)
    return () => window.clearInterval(id)
  }, [status])

  const value = useMemo<MonitoringContextValue>(
    () => ({
      status,
      frame,
      sessionSeconds,
      mode,
      quiet,
      startMonitoring: () => {
        void startMonitoring()
      },
      stopMonitoring,
      setMode,
      setQuiet
    }),
    [status, frame, sessionSeconds, mode, quiet, startMonitoring, stopMonitoring, setMode, setQuiet]
  )

  return <MonitoringContext.Provider value={value}>{children}</MonitoringContext.Provider>
}

export function useMonitoring(): MonitoringContextValue {
  const ctx = useContext(MonitoringContext)
  if (!ctx) throw new Error('useMonitoring must be used inside <MonitoringProvider>')
  return ctx
}
