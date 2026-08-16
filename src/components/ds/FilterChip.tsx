import { ReactNode } from 'react'

interface FilterChipProps {
  children: ReactNode
  selected?: boolean
  count?: number
  onClick?: () => void
}

export function FilterChip({ children, selected = false, count, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        minHeight: 34,
        padding: '0 var(--space-6)',
        font: 'var(--type-meta)',
        fontWeight: 'var(--fw-medium)',
        color: selected ? 'var(--text-inverse)' : 'var(--text-secondary)',
        background: selected ? 'var(--stone-900)' : 'var(--surface-card)',
        border: `1px solid ${selected ? 'var(--stone-900)' : 'var(--line-strong)'}`,
        borderRadius: 'var(--radius-pill)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard)',
      }}
    >
      {children}
      {count != null && (
        <span className="tnum" style={{ opacity: 0.6 }}>
          {count}
        </span>
      )}
    </button>
  )
}
