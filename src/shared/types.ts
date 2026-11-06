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

/** One measurement at a point in time, together with its confidence. */
export interface QualityMeasurement {
  value: number
  unit: string
  /** ms since Unix epoch */
  timestamp: number
  quality: SignalQualityStatus
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
}

export type MonitoringStatus =
  | 'idle'
  | 'starting'
  | 'monitoring'
  | 'stopping'
  | 'error'

/**
 * Any provider of signal frames. Implemented by DemoSignalSource (Phase 3)
 * and, later, the SmartSpectra adapter (Phase 4) with identical behaviour.
 */
export interface SignalSource {
  start(): void
  stop(): void
  /** Returns an unsubscribe function. */
  subscribe(listener: (frame: SignalFrame) => void): () => void
}

/* ---------------- Workspace ---------------- */

export type SessionMode = 'focus' | 'breathing' | 'break'

export type ViewKey = 'dashboard' | 'breathing' | 'break' | 'history' | 'settings'
