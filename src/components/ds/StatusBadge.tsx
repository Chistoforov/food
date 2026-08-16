import { CSSProperties } from 'react'
import { StatusDot, ForecastStatus } from './StatusDot'

const TONE: Record<ForecastStatus, { fg: string; bg: string; line: string }> = {
  ending_soon: { fg: 'var(--status-ending-fg)', bg: 'var(--status-ending-bg)', line: 'var(--status-ending-line)' },
  ok: { fg: 'var(--status-ok-fg)', bg: 'var(--status-ok-bg)', line: 'var(--status-ok-line)' },
  irregular: { fg: 'var(--status-irregular-fg)', bg: 'var(--status-irregular-bg)', line: 'var(--line-hairline)' },
  calculating: { fg: 'var(--status-calculating-fg)', bg: 'var(--status-calculating-bg)', line: 'var(--line-hairline)' },
}

const LABEL: Record<'ru' | 'pt', Record<ForecastStatus, string>> = {
  ru: { ending_soon: 'Заканчивается', ok: 'В норме', irregular: 'Нерегулярно', calculating: 'Считается' },
  pt: { ending_soon: 'A acabar', ok: 'Suficiente', irregular: 'Irregular', calculating: 'A calcular' },
}

interface StatusBadgeProps {
  status?: ForecastStatus
  lang?: 'ru' | 'pt'
  label?: string
  dot?: boolean
  style?: CSSProperties
}

export function StatusBadge({ status = 'ok', lang = 'ru', label, dot = true, style }: StatusBadgeProps) {
  const tone = TONE[status]
  const text = label ?? LABEL[lang][status]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: '3px var(--space-4)',
        font: 'var(--type-meta)',
        fontWeight: 'var(--fw-medium)',
        color: tone.fg,
        background: tone.bg,
        border: `1px solid ${tone.line}`,
        borderRadius: 'var(--radius-xs)',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {dot && <StatusDot status={status} size={6} />}
      {text}
    </span>
  )
}
