import type { QualityMeasurement } from '../../../shared/types'
import { QualityChip } from './QualityChip'

interface MetricCardProps {
  label: string
  measurement: QualityMeasurement | null
  /** How to format an untrusted value: hide it, or show it struck through. */
  fallback?: string
}

/**
 * One live metric. Core Feature-2 rule in code:
 * the number is only shown when measurement.quality === 'valid'.
 * Otherwise the card explains the state instead of showing an untrustworthy
 * value.
 */
export function MetricCard({ label, measurement, fallback = '—' }: MetricCardProps): React.JSX.Element {
  const trusted = measurement?.quality === 'valid'

  return (
    <div className="card metric-card">
      <div className="metric-head">
        <span className="metric-label">{label}</span>
        {measurement && <QualityChip status={measurement.quality} />}
      </div>
      <div className={`metric-value ${trusted ? '' : 'metric-untrusted'}`} aria-live="polite">
        {measurement && trusted ? measurement.value.toFixed(1) : fallback}
      </div>
      <div className="metric-unit muted">{measurement?.unit ?? 'Awaiting signal'}</div>
    </div>
  )
}
