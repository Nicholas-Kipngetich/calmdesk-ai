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
import type {
  AppConfig,
  MonitoringStatus,
  SessionMode,
  SignalFrame,
  SignalSource
} from '../../../shared/types'
import { SmartSpectraSource } from '../sources/smartSpectraSource'

/**
 * MonitoringContext - the single source of truth for live signal state,
 * the session clock, workspace ambience, and error surfaces.
 *
 * Phase 4: backed by the real SmartSpectra adapter through the secure
 * preload bridge. Configuration (the Presage API key) is fetched once via
 * the allowlisted 'app:config' IPC channel.
 */

interface MonitoringContextValue {
  status: MonitoringStatus
  errorMessage: string | null
  frame: SignalFrame | null
  stream: MediaStream | null
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
  const configRef = useRef<AppConfig | null>(null)
  const [status, setStatus] = useState<MonitoringStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [frame, setFrame] = useState<SignalFrame | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [sessionSeconds, setSessionSeconds] = useState(0)
  const [mode, setModeState] = useState<SessionMode>('focus')
  const [quiet, setQuiet] = useState(false)

  // Load runtime configuration once (API key via private IPC).
  useEffect(() => {
    let active = true
    const api = window.calmdesk
    if (!api) {
      // Preload bridge unavailable - config stays empty; Start monitoring
      // will surface a clear error instead of crashing the UI.
      configRef.current = { apiKey: '', telemetryEnabled: false }
      return
    }
    api
      .getConfig()
      .then((config) => {
        if (active) configRef.current = config
      })
      .catch(() => {
        if (active) configRef.current = { apiKey: '', telemetryEnabled: false }
      })
    return () => {
      active = false
    }
  }, [])

  const startMonitoring = useCallback(async (): Promise<void> => {
    if (sourceRef.current) return
    setStatus('starting')
    setFrame(null)
    setStream(null)
    setSessionSeconds(0)
    setErrorMessage(null)

    // Config may still be loading on first launch.
    if (!configRef.current) await new Promise((resolve) => setTimeout(resolve, 400))

    try {
      const apiKey = configRef.current?.apiKey ?? ''
      if (!apiKey) {
        throw new Error('API key missing. Create .env with SMARTSPECTRA_API_KEY (see README).')
      }
      const source: SignalSource = new SmartSpectraSource({
        apiKey,
        onFatalError: (message) => {
          setErrorMessage(message)
          setStatus('error')
        },
        onStream: setStream
      })
      const unsubscribe = source.subscribe(setFrame)
      sourceRef.current = source
      await source.start()
      // Stopped while starting? Tear the source down again.
      if (sourceRef.current !== source) {
        unsubscribe()
        source.stop()
        setStatus('idle')
        return
      }
      setStatus('monitoring')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err))
      setStatus('error')
      sourceRef.current = null
      setStream(null)
    }
  }, [])

  const stopMonitoring = useCallback((): void => {
    sourceRef.current?.stop()
    sourceRef.current = null
    setFrame(null)
    setStream(null)
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

  // Safety net: release the camera if the app unmounts.
  useEffect(() => {
    return () => {
      sourceRef.current?.stop()
      sourceRef.current = null
    }
  }, [])

  const value = useMemo<MonitoringContextValue>(
    () => ({
      status,
      errorMessage,
      frame,
      stream,
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
    [
      status,
      errorMessage,
      frame,
      stream,
      sessionSeconds,
      mode,
      quiet,
      startMonitoring,
      stopMonitoring,
      setMode,
      setQuiet
    ]
  )

  return <MonitoringContext.Provider value={value}>{children}</MonitoringContext.Provider>
}

export function useMonitoring(): MonitoringContextValue {
  const ctx = useContext(MonitoringContext)
  if (!ctx) throw new Error('useMonitoring must be used inside <MonitoringProvider>')
  return ctx
}
