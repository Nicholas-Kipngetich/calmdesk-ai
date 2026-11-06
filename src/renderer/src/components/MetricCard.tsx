import type { QualityMeasurement } from '../../../shared/types'
import { QualityChip } from './QualityChip'

interface MetricCardProps {
  label: string
  measurement: QualityMeasurement | null
  fallback?: string
}

/**
 * One live metric. Core Feature-2 rules in code:
 *  - the number is only shown when measurement.quality === 'valid'
 *  - SDK confidence and stability are surfaced next to trusted values,
 *    so the user can see WHY a reading is trustworthy.
 */
export function MetricCard({ label, measurement, fallback = '—' }: MetricCardProps): React.JSX.Element {
  const trusted = measurement?.quality === 'valid'
  const confidence =
    measurement?.confidence !== undefined ? Math.round(measurement.confidence) : null

  return (
    <div className="card metric-card">
      <div className="metric-head">
        <span className="metric-label">{label}</span>
        {measurement && <QualityChip status={measurement.quality} />}
      </div>
      <div className={`metric-value ${trusted ? '' : 'metric-untrusted'}`} aria-live="polite">
        {measurement && trusted ? measurement.value.toFixed(1) : fallback}
      </div>
      <div className="metric-unit muted">
        {measurement && trusted
          ? `${measurement.unit}${confidence !== null ? ` · confidence ${confidence}%${measurement.stable === false ? ' · unstable' : ''}` : ''}`
          : (measurement?.unit ?? 'Awaiting signal')}
      </div>
    </div>
  )
}
