import { CSSProperties, ReactNode } from 'react'

interface SectionHeaderProps {
  children: ReactNode
  count?: number
  action?: ReactNode
  style?: CSSProperties
}

export function SectionHeader({ children, count, action, style }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        padding: 'var(--space-8) 0 var(--space-4)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)' }}>
        <span
          style={{
            font: 'var(--type-section)',
            letterSpacing: 'var(--ls-caps)',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}
        >
          {children}
        </span>
        {count != null && (
          <span className="tnum" style={{ font: 'var(--type-meta)', color: 'var(--text-disabled)' }}>
            {count}
          </span>
        )}
      </div>
      {action}
    </div>
  )
}
