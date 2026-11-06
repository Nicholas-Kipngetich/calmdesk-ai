/**
 * CalmDesk AI - shared contracts.
 *
 * Types here are intentionally free of any Electron imports so both the
 * main/preload TypeScript project and the renderer project can import them.
 */

export interface AppInfo {
  name: string
  tagline: string
  version: string
  electron: string
  node: string
  platform: string
}

/** Runtime configuration delivered to the renderer over private IPC. */
export interface AppConfig {
  /** Presage SmartSpectra API key (from .env; never committed). */
  apiKey: string
  /** Always false in CalmDesk AI - disclosed in README and settings UI. */
  telemetryEnabled: boolean
}

/* ---------------- Signals & measurements ---------------- */

/**
 * Confidence states for live signals.
 * The UI must never present a measurement as trustworthy unless
 * its quality is 'valid'.
 */
export type SignalQualityStatus =
  | 'valid' // reading is trusted
  | 'processing' // capturing; model warming up / settling
  | 'poor' // captured but unreliable
  | 'camera-unavailable' // no camera / permission denied
  | 'unavailable' // monitoring off / no measurement available

/**
 * One measurement at a point in time, with its confidence.
 * `confidence` (0-100) and `stable` come from the SmartSpectra metrics
 * payload. Per official docs, confidence starts at 0 and only becomes
 * meaningful once a metric's analysis window fills (breathing 30s,
 * pulse 12s) - so readings before that are 'processing', never 'valid'.
 */
export interface QualityMeasurement {
  value: number
  unit: string
  /** ms since Unix epoch */
  timestamp: number
  quality: SignalQualityStatus
  confidence?: number
  stable?: boolean
}

/** The SDK's live capture feedback, surfaced verbatim (official hint string). */
export interface ValidationInfo {
  /** Raw SmartSpectra ValidationCode value. */
  code: number
  hint: string
}

/**
 * One full update from a signal source.
 * In Phase 4, real SmartSpectra events are converted into these frames.
 */
export interface SignalFrame {
  timestamp: number
  overallQuality: SignalQualityStatus
  breathingRate: QualityMeasurement | null
  pulseRate: QualityMeasurement | null
  validation: ValidationInfo | null
}

export type MonitoringStatus =
  | 'idle'
  | 'starting'
  | 'monitoring'
  | 'stopping'
  | 'error'

/**
 * Any provider of signal frames. Implemented by DemoSignalSource (offline
 * fallback) and the SmartSpectraSource (real SDK, Phase 4) with identical
 * behaviour.
 */
export interface SignalSource {
  start(): Promise<void>
  stop(): void
  /** Returns an unsubscribe function. */
  subscribe(listener: (frame: SignalFrame) => void): () => void
}

/* ---------------- Workspace ---------------- */

export type SessionMode = 'focus' | 'breathing' | 'break'

export type ViewKey = 'dashboard' | 'breathing' | 'break' | 'history' | 'settings'
