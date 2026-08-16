import { CSSProperties, ReactNode } from 'react'

interface AppHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  style?: CSSProperties
}

export function AppHeader({ title, subtitle, right, style }: AppHeaderProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 'var(--space-6)',
        padding: 'var(--space-8) var(--gutter-mobile) var(--space-6)',
        background: 'var(--surface-page)',
        boxShadow: 'var(--shadow-sticky)',
        ...style,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1 style={{ margin: 0, font: 'var(--type-screen-title)', letterSpacing: 'var(--ls-tight)', color: 'var(--text-primary)' }}>
          {title}
        </h1>
        {subtitle && <div style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {right && <div style={{ flex: 'none', paddingBottom: 2 }}>{right}</div>}
    </header>
  )
}
