import type { SignalQualityStatus } from '../../../shared/types'

/** User-facing wording for each signal-confidence state. */
export const QUALITY_LABELS: Record<SignalQualityStatus, string> = {
  valid: 'Signal valid',
  processing: 'Processing…',
  poor: 'Poor signal',
  'camera-unavailable': 'Camera unavailable',
  unavailable: 'No signal'
}

interface QualityChipProps {
  status: SignalQualityStatus
}

/** Small pill showing signal confidence with a colour-coded dot. */
export function QualityChip({ status }: QualityChipProps): React.JSX.Element {
  return (
    <span className={`quality-chip quality-${status}`} role="status">
      <span className="quality-dot" aria-hidden="true" />
      {QUALITY_LABELS[status]}
    </span>
  )
}
