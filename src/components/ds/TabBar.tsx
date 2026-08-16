import { CSSProperties, ReactNode } from 'react'

export interface TabItem {
  value: string
  label: ReactNode
  badge?: number
}

interface TabBarProps {
  value: string
  onChange: (value: string) => void
  items: TabItem[]
  style?: CSSProperties
}

export function TabBar({ value, onChange, items, style }: TabBarProps) {
  return (
    <nav
      style={{
        display: 'grid',
        gridAutoFlow: 'column',
        gridAutoColumns: '1fr',
        height: 'var(--tabbar-height)',
        flex: 'none',
        background: 'var(--surface-card)',
        borderTop: '1px solid var(--line-hairline)',
        ...style,
      }}
    >
      {items.map((it) => {
        const on = it.value === value
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            aria-current={on ? 'page' : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-3)',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              font: 'var(--type-label)',
              fontWeight: on ? 'var(--fw-semibold)' : 'var(--fw-regular)',
              color: on ? 'var(--text-primary)' : 'var(--text-tertiary)',
              boxShadow: on ? 'inset 0 -2px 0 var(--stone-900)' : 'none',
              transition: 'color var(--dur-fast) var(--ease-standard)',
            }}
          >
            {it.label}
            {it.badge != null && it.badge > 0 && (
              <span
                className="tnum"
                style={{
                  font: 'var(--type-meta)',
                  fontWeight: 'var(--fw-medium)',
                  color: 'var(--status-ending-fg)',
                  background: 'var(--status-ending-bg)',
                  border: '1px solid var(--status-ending-line)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '0 5px',
                }}
              >
                {it.badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
