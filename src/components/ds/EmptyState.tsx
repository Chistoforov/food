import { ReactNode } from 'react'

interface EmptyStateProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-5)',
        padding: 'var(--space-12) var(--space-8)',
        textAlign: 'center',
      }}
    >
      <div style={{ font: 'var(--type-row-title)', color: 'var(--text-primary)' }}>{title}</div>
      {description && (
        <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-tertiary)', maxWidth: 320 }}>{description}</div>
      )}
      {action && <div style={{ marginTop: 'var(--space-3)' }}>{action}</div>}
    </div>
  )
}
