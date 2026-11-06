import {
  SmartSpectraErrorCode,
  SmartSpectraSDK,
  MetricType,
  ValidationCode,
  breathingMetrics
} from '@smartspectra/node-sdk/renderer'
import type {
  ProcessingStatusValue,
  SmartSpectraErrorCodeValue,
  ValidationCodeValue
} from '@smartspectra/node-sdk/renderer'
import { decodeMetrics } from '@smartspectra/node-sdk/messages'
import type {
  QualityMeasurement,
  SignalFrame,
  SignalQualityStatus,
  SignalSource,
  ValidationInfo
} from '../../../shared/types'

/**
 * SmartSpectraSource (Phase 4) - the real signal source.
 *
 * Wraps the official renderer-side SmartSpectra SDK and converts its events
 * into the SignalFrame contract the UI already speaks:
 *
 *   'streamAvailable'  -> optional preview stream callback
 *   'processingStatus' -> heartbeat emission (no state of its own here)
 *   'validationStatus' -> official hint strings + quality states
 *   'metrics'          -> breathing + pulse readings with confidence/stable
 *   'error'            -> heart-friendly error handling incl. cardio fallback
 *
 * Trust rules (from official docs):
 *   - confidence starts at 0 and only becomes meaningful once the metric
 *     window fills (~30s breathing, ~12s pulse): never surface before that.
 *   - `stable === false` behaves like a validation warning.
 *   - non-OK validation codes degrade the reading; official hint strings
 *     are surfaced verbatim to the user.
 */

const HEARTBEAT_MS = 500

/** Validation codes that mean "reading is currently unreliable". */
const BLOCKING_VALIDATION: ReadonlySet<number> = new Set<number>([
  ValidationCode.kNoFaceFound,
  ValidationCode.kMultipleFacesFound,
  ValidationCode.kFaceNotCentered,
  ValidationCode.kFaceNotForward,
  ValidationCode.kFaceTooClose,
  ValidationCode.kFaceTooFar,
  ValidationCode.kFaceTooHigh,
  ValidationCode.kFaceTooLow,
  ValidationCode.kChestNotVisible,
  ValidationCode.kTooDark,
  ValidationCode.kTooBright,
  ValidationCode.kExcessiveMotion
])

/** Validation codes that are transient ("give it a moment"). */
const SETTLING_VALIDATION: ReadonlySet<number> = new Set<number>([
  ValidationCode.kCameraTuning,
  ValidationCode.kFrameRateTooLow
])

/* Decoded protobuf payload shape (subset we consume). */
interface SampleLike {
  value?: number
  confidence?: number
  stable?: boolean
  timestamp?: number
}
interface MetricsLike {
  breathing?: { rate?: SampleLike[] }
  cardio?: { pulseRate?: SampleLike[] }
}

export interface SmartSpectraSourceOptions {
  apiKey: string
  onFatalError: (message: string) => void
  onStream?: (stream: MediaStream | null) => void
}

interface Latest {
  breathing: QualityMeasurement | null
  pulse: QualityMeasurement | null
  validation: ValidationInfo | null
}

export class SmartSpectraSource implements SignalSource {
  private listeners = new Set<(frame: SignalFrame) => void>()
  private sdk: SmartSpectraSDK | null = null
  private active = false
  private heartbeat: number | null = null
  private latest: Latest = { breathing: null, pulse: null, validation: null }
  /** Falls back to breathing-only when the API key lacks cardio metrics. */
  private pulseEnabled = true
  private readonly apiKey: string
  private readonly onFatalError: (message: string) => void
  private readonly onStream?: (stream: MediaStream | null) => void

  constructor(options: SmartSpectraSourceOptions) {
    this.apiKey = options.apiKey
    this.onFatalError = options.onFatalError
    this.onStream = options.onStream
  }

  async start(): Promise<void> {
    if (this.sdk) return
    if (!this.apiKey) {
      throw new Error(
        'SmartSpectra API key is missing. Create a .env file with SMARTSPECTRA_API_KEY (see README).'
      )
    }
    await this.createSession()
    this.heartbeat = window.setInterval(() => this.emit(), HEARTBEAT_MS)
  }

  stop(): void {
    this.active = false
    if (this.heartbeat !== null) {
      window.clearInterval(this.heartbeat)
      this.heartbeat = null
    }
    const sdk = this.sdk
    this.sdk = null
    this.latest = { breathing: null, pulse: null, validation: null }
    this.onStream?.(null)
    if (sdk) {
      void (async () => {
        try {
          await sdk.stop()
          sdk.destroy()
        } catch {
          sdk.destroy()
        }
      })()
    }
  }

  subscribe(listener: (frame: SignalFrame) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /* ---------------- internals ---------------- */

  private async createSession(): Promise<void> {
    const sdk = new SmartSpectraSDK({
      apiKey: this.apiKey,
      // Breathing bundle always; pulse only when supported by the plan.
      requestedMetrics: this.pulseEnabled
        ? [...breathingMetrics, MetricType.PULSE_RATE]
        : [...breathingMetrics],
      // Privacy-first (Feature 6): telemetry disabled, disclosed in README.
      // First-start server provisioning can legitimately take ~45-60s on a
      // new API key, so the official IPC ack timeout is generous.
      enableTelemetry: false,
      sendTimeoutMs: 60000
    })

    sdk.on('streamAvailable', (stream: MediaStream) => this.onStream?.(stream))
    sdk.on('processingStatus', this.onProcessingStatus)
    sdk.on('validationStatus', this.onValidationStatus)
    sdk.on('metrics', this.onMetrics)
    sdk.on('error', this.onSdkError)

    this.sdk = sdk
    this.active = true
    try {
      await sdk.start()
    } catch (err) {
      this.sdk = null
      this.active = false
      throw err instanceof Error ? err : new Error(String(err))
    }
  }

  private onProcessingStatus = (_status: ProcessingStatusValue): void => {
    if (!this.active || !this.sdk) return
    // Processing status changes are surfaced through the heartbeat frame.
    this.emit()
  }

  private onValidationStatus = (code: ValidationCodeValue, _ts: number, hint: string): void => {
    if (!this.active || !this.sdk) return
    // Debounce per official guidance: update only when the code changes.
    if (this.latest.validation?.code === code) return
    this.latest.validation = { code, hint }
    this.emit()
  }

  private onMetrics = (buf: Uint8Array, _ts: number): void => {
    if (!this.active || !this.sdk) return
    try {
      const decoded = decodeMetrics(buf as never) as unknown as MetricsLike | Buffer
      if (!decoded || typeof decoded !== 'object' || decoded instanceof Buffer) return
      const metrics = decoded as MetricsLike

      const breath = metrics.breathing?.rate?.at(-1)
      const pulse = metrics.cardio?.pulseRate?.at(-1)

      if (breath) this.latest.breathing = this.toMeasurement(breath, 'breaths/min')
      if (pulse) this.latest.pulse = this.toMeasurement(pulse, 'bpm')
      this.emit()
    } catch {
      // Malformed payload - ignore this frame; SDK continues.
    }
  }

  private toMeasurement(sample: SampleLike, unit: string): QualityMeasurement {
    const value = typeof sample.value === 'number' ? sample.value : NaN
    return {
      value,
      unit,
      timestamp: Date.now(),
      quality: 'valid', // provisional; qualityOf() re-evaluates per emit
      confidence: typeof sample.confidence === 'number' ? sample.confidence : undefined,
      stable: typeof sample.stable === 'boolean' ? sample.stable : undefined
    }
  }

  // Web SDK event callbacks receive the handler without a `this` receiver,
  // so all handlers are arrow properties, not prototype methods.
  private onSdkError = async (
    code: SmartSpectraErrorCodeValue,
    message: string,
    retryable: boolean
  ): Promise<void> => {
    // Late events can arrive while/after teardown - ignore them.
    if (!this.active || !this.sdk) return
    // Graceful degradation: a key without cardio support fails around
    // configuration time. Retry once, breathing-only.
    if (this.pulseEnabled && code === SmartSpectraErrorCode.kConfigurationFailed) {
      this.pulseEnabled = false
      const sdk = this.sdk
      this.sdk = null
      this.latest = { breathing: null, pulse: null, validation: null }
      this.onStream?.(null)
      try {
        if (sdk) {
          await sdk.stop()
          sdk.destroy()
        }
        await this.createSession()
        return
      } catch {
        this.onFatalError('Signal pipeline failed to start without pulse metrics.')
        return
      }
    }

    if (retryable) {
      // Transient engine hiccup: stay in processing; SDK usually recovers.
      this.latest.validation = null
      this.latest.breathing = null
      this.latest.pulse = null
      return
    }
    this.onFatalError(message || 'SmartSpectra pipeline error.')
  }

  /* ---------------- frame assembly ---------------- */

  private qualityOf(mm: QualityMeasurement | null): SignalQualityStatus | null {
    if (!mm) return null
    const validation = this.latest.validation
    if (validation) {
      if (BLOCKING_VALIDATION.has(validation.code)) return 'poor'
      if (SETTLING_VALIDATION.has(validation.code)) return 'processing'
    }
    if (mm.stable === false) return 'poor'
    // Official warm-up semantics: confidence 0 = window not filled yet.
    if (typeof mm.confidence === 'number') {
      return mm.confidence > 0 ? 'valid' : 'processing'
    }
    return 'processing'
  }

  private emit(): void {
    const breathingQuality = this.qualityOf(this.latest.breathing)
    const pulseQuality = this.pulseEnabled ? this.qualityOf(this.latest.pulse) : null

    let overall: SignalQualityStatus
    if (breathingQuality === 'poor' || pulseQuality === 'poor') overall = 'poor'
    else if (breathingQuality === 'valid' || pulseQuality === 'valid') overall = 'valid'
    else overall = 'processing'

    const frame: SignalFrame = {
      timestamp: Date.now(),
      overallQuality: overall,
      breathingRate: this.latest.breathing
        ? { ...this.latest.breathing, quality: breathingQuality ?? 'processing' }
        : null,
      pulseRate: this.latest.pulse
        ? { ...this.latest.pulse, quality: pulseQuality ?? 'processing' }
        : null,
      validation: this.latest.validation
    }

    for (const listener of this.listeners) listener(frame)
  }
}
