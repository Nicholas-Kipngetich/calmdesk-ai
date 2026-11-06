import type {
  QualityMeasurement,
  SignalFrame,
  SignalQualityStatus,
  SignalSource
} from '../../../shared/types'

/**
 * DemoSignalSource (Phase 3 only - replaced by SmartSpectra in Phase 4).
 *
 * Simulates the exact behaviour of a real physiological capture pipeline so
 * every UI state can be built and tested now:
 *
 *   ticks 0-3   : 'processing'  (pipeline warming up)
 *   ticks 4-27  : 'valid'       (trusted readings)
 *   every ~28s  : 'poor' for ~5s (capture conditions degrade)
 *
 * Values wander through realistic human ranges (breathing 11-19 BPM,
 * pulse 62-79 BPM) instead of being flat or exaggerated.
 */

const TICK_MS = 1000
const WARMUP_TICKS = 4
const POOR_EVERY_TICKS = 28
const POOR_DURATION_TICKS = 5

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export class DemoSignalSource implements SignalSource {
  private listeners = new Set<(frame: SignalFrame) => void>()
  private timer: number | null = null
  private ticks = 0
  private quality: SignalQualityStatus = 'processing'
  private breathing = 14.5
  private pulse = 71

  start(): void {
    if (this.timer !== null) return
    this.timer = window.setInterval(() => this.tick(), TICK_MS)
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
  }

  subscribe(listener: (frame: SignalFrame) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private tick(): void {
    this.ticks += 1

    if (this.quality === 'processing' && this.ticks >= WARMUP_TICKS) {
      this.quality = 'valid'
    }
    if (this.quality === 'valid' && this.ticks % POOR_EVERY_TICKS === 0) {
      this.quality = 'poor'
    }
    if (this.quality === 'poor' && this.ticks % POOR_EVERY_TICKS >= POOR_DURATION_TICKS) {
      this.quality = 'valid'
    }

    this.breathing = clamp(this.breathing + this.drift(0.6), 11, 19)
    this.pulse = clamp(this.pulse + this.drift(0.9), 62, 79)

    const timestamp = Date.now()
    const breathingRate: QualityMeasurement = {
      value: Math.round(this.breathing * 10) / 10,
      unit: 'breaths/min',
      timestamp,
      quality: this.quality
    }
    const pulseRate: QualityMeasurement = {
      value: Math.round(this.pulse * 10) / 10,
      unit: 'bpm',
      timestamp,
      quality: this.quality
    }

    const frame: SignalFrame = {
      timestamp,
      overallQuality: this.quality,
      breathingRate,
      pulseRate
    }

    for (const listener of this.listeners) listener(frame)
  }

  private drift(maxStep: number): number {
    return (Math.random() - 0.5) * 2 * maxStep
  }
}
