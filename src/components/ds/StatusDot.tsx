import { CSSProperties } from 'react'

export type ForecastStatus = 'ending_soon' | 'ok' | 'irregular' | 'calculating'

const DOT: Record<ForecastStatus, string> = {
  ending_soon: 'var(--status-ending-dot)',
  ok: 'var(--status-ok-dot)',
  irregular: 'var(--status-irregular-dot)',
  calculating: 'var(--stone-200)',
}

interface StatusDotProps {
  status?: ForecastStatus
  size?: number
  style?: CSSProperties
}

export function StatusDot({ status = 'ok', size = 7, style }: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        flex: 'none',
        width: size,
        height: size,
        borderRadius: 'var(--radius-pill)',
        background: DOT[status],
        ...style,
      }}
    />
  )
}
