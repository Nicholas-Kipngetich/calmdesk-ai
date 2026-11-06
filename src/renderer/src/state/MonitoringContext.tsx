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
  PrivacySettings,
  SessionMode,
  SessionSummary,
  SignalFrame,
  SignalSource
} from '../../../shared/types'
import { SmartSpectraSource } from '../sources/smartSpectraSource'
import { DemoSignalSource } from '../sources/demoSignalSource'

/**
 * MonitoringContext - the single source of truth for live signal state,
 * the session clock, workspace ambience, error surfaces, privacy settings,
 * and local history recording (Phase 6).
 */

interface MonitoringContextValue {
  status: MonitoringStatus
  errorMessage: string | null
  frame: SignalFrame | null
  stream: MediaStream | null
  sessionSeconds: number
  mode: SessionMode
  quiet: boolean
  /** True while the clearly-labelled offline demo source is active. */
  demoMode: boolean
  /** Privacy settings from the main process store (null until loaded). */
  privacy: PrivacySettings | null
  updatePrivacy: (patch: Partial<Omit<PrivacySettings, 'dataPath'>>) => Promise<void>
  startMonitoring: () => void
  startDemoMonitoring: () => void
  stopMonitoring: () => void
  setMode: (mode: SessionMode) => void
  setQuiet: (quiet: boolean) => void
}

const MonitoringContext = createContext<MonitoringContextValue | null>(null)

/**
 * Per-session statistics collector. Counts frames and VALID seconds, and
 * averages only trusted measurements - a session with no valid readings is
 * recorded honestly as "no readings" (nulls), never with made-up averages.
 */
interface SessionCollector {
  source: 'live' | 'demo'
  mode: SessionMode
  startedAt: number
  frames: number
  /** Distinct seconds in which the overall signal was valid. */
  validSecondTimestamps: Set<number>
  breathing: number[]
  pulse: number[]
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  const sum = values.reduce((a, b) => a + b, 0)
  return Math.round((sum / values.length) * 10) / 10
}

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
  const [demoMode, setDemoMode] = useState(false)
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null)

  const privacyRef = useRef<PrivacySettings | null>(null)
  const collectorRef = useRef<SessionCollector | null>(null)
  const modeRef = useRef<SessionMode>('focus')

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
    api
      .getPrivacy()
      .then((p) => {
        if (active) {
          privacyRef.current = p
          setPrivacy(p)
        }
      })
      .catch(() => {
        if (active) {
          const fallback: PrivacySettings = {
            consented: false,
            historyEnabled: true,
            dataPath: ''
          }
          privacyRef.current = fallback
          setPrivacy(fallback)
        }
      })
    return () => {
      active = false
    }
  }, [])

  /** Persist a privacy change in the main-process store (and locally). */
  const updatePrivacy = useCallback(
    async (patch: Partial<Omit<PrivacySettings, 'dataPath'>>): Promise<void> => {
      const api = window.calmdesk
      if (!api) return
      try {
        const next = await api.setPrivacy(patch)
        privacyRef.current = next
        setPrivacy(next)
      } catch {
        // Settings persistence must never crash the UI.
      }
    },
    []
  )

  const beginCollection = (source: 'live' | 'demo', sessionMode: SessionMode): void => {
    collectorRef.current = {
      source,
      mode: sessionMode,
      startedAt: Date.now(),
      frames: 0,
      validSecondTimestamps: new Set<number>(),
      breathing: [],
      pulse: []
    }
  }

  const pushFrame = (frameData: SignalFrame): void => {
    const c = collectorRef.current
    if (!c) return
    c.frames += 1
    if (frameData.overallQuality === 'valid') {
      c.validSecondTimestamps.add(Math.floor(frameData.timestamp / 1000))
    }
    // ONLY trusted measurements enter the stored averages.
    if (frameData.breathingRate?.quality === 'valid') {
      c.breathing.push(frameData.breathingRate.value)
    }
    if (frameData.pulseRate?.quality === 'valid') {
      c.pulse.push(frameData.pulseRate.value)
    }
  }

  const finalizeSession = useCallback((sessionStatus: 'completed' | 'interrupted'): void => {
    const c = collectorRef.current
    collectorRef.current = null
    if (!c) return
    const endedAt = Date.now()
    const summary: SessionSummary = {
      id: crypto.randomUUID(),
      source: c.source,
      mode: c.mode,
      startedAt: c.startedAt,
      endedAt,
      durationSeconds: Math.max(1, Math.round((endedAt - c.startedAt) / 1000)),
      frames: c.frames,
      validSeconds: c.validSecondTimestamps.size,
      avgBreathing: average(c.breathing),
      avgPulse: average(c.pulse),
      status: sessionStatus
    }
    // History is best-effort: it must never block or crash the UI.
    if (privacyRef.current?.historyEnabled !== false) {
      void window.calmdesk?.appendSession(summary).catch(() => {})
    }
  }, [])

  const startMonitoring = useCallback(async (): Promise<void> => {
    if (sourceRef.current) return
    setStatus('starting')
    setFrame(null)
    setStream(null)
    setSessionSeconds(0)
    setErrorMessage(null)

    // Config and privacy preferences may still be loading on first launch.
    if (!configRef.current || !privacyRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 400))
    }

    // Consent gate (Phase 6): no camera capture without explicit consent.
    if (!privacyRef.current?.consented) {
      setStatus('idle')
      throw new Error(
        'Camera consent required. Review your privacy choice in Settings first.'
      )
    }

    try {
      const apiKey = configRef.current?.apiKey ?? ''
      if (!apiKey) {
        throw new Error('API key missing. Create .env with SMARTSPECTRA_API_KEY (see README).')
      }
      beginCollection('live', modeRef.current)
      const source: SignalSource = new SmartSpectraSource({
        apiKey,
        onFatalError: (message) => {
          // A fatal event ends THIS session; record what was observed so far.
          finalizeSession('interrupted')
          setErrorMessage(message)
          setStatus('error')
        },
        onStream: setStream
      })
      const unsubscribe = source.subscribe((f) => {
        pushFrame(f)
        setFrame(f)
      })
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
  }, [finalizeSession])

  const stopMonitoring = useCallback((): void => {
    finalizeSession('completed')
    sourceRef.current?.stop()
    sourceRef.current = null
    setFrame(null)
    setStream(null)
    setDemoMode(false)
    setStatus('idle')
  }, [finalizeSession])

  /**
   * Clearly-labelled offline fallback (Phase 5 development + resilience UX):
   * the same SignalFrame contract goes through the UI, but the dashboard
   * shows an explicit Demo banner so demo data can never masquerade as a
   * live measurement. Demo sessions ARE recorded, always tagged 'demo',
   * because demo data can never masquerade as a live measurement.
   */
  const startDemoMonitoring = useCallback((): void => {
    if (sourceRef.current) return
    beginCollection('demo', modeRef.current)
    const source = new DemoSignalSource()
    sourceRef.current = source
    source.subscribe((f) => {
      pushFrame(f)
      setFrame(f)
    })
    source.start()
    setStatus('monitoring')
    setDemoMode(true)
    setErrorMessage(null)
  }, [])

  const setMode = useCallback((next: SessionMode): void => {
    modeRef.current = next
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
      demoMode,
      privacy,
      updatePrivacy,
      startMonitoring: () => {
        void startMonitoring()
      },
      startDemoMonitoring,
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
      demoMode,
      privacy,
      updatePrivacy,
      startMonitoring,
      startDemoMonitoring,
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
