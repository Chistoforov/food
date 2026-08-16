import { ReactNode } from 'react'

type Tone = 'neutral' | 'error' | 'info'

const TONE: Record<Tone, { fg: string; bg: string; line: string }> = {
  neutral: { fg: 'var(--text-secondary)', bg: 'var(--surface-sunken)', line: 'var(--line-hairline)' },
  error: { fg: 'var(--error-fg)', bg: 'var(--error-bg)', line: 'var(--error-line)' },
  info: { fg: 'var(--text-secondary)', bg: 'var(--surface-card)', line: 'var(--line-strong)' },
}

interface BannerProps {
  children: ReactNode
  tone?: Tone
  action?: ReactNode
}

export function Banner({ children, tone = 'neutral', action }: BannerProps) {
  const t = TONE[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-6)',
        padding: 'var(--space-5) var(--space-7)',
        font: 'var(--type-body-sm)',
        color: t.fg,
        background: t.bg,
        border: `1px solid ${t.line}`,
        borderRadius: 'var(--radius-sm)',
      }}
    >
      <span style={{ minWidth: 0 }}>{children}</span>
      {action && <span style={{ flex: 'none' }}>{action}</span>}
    </div>
  )
}
