import { ReactNode } from 'react'

interface Option {
  value: string
  label: ReactNode
}

interface SegmentedControlProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
}

export function SegmentedControl({ value, onChange, options }: SegmentedControlProps) {
  return (
    <div
      role="group"
      style={{
        display: 'inline-flex',
        padding: 2,
        gap: 2,
        background: 'var(--surface-sunken)',
        border: '1px solid var(--line-hairline)',
        borderRadius: 'var(--radius-sm)',
      }}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={on}
            style={{
              minHeight: 36,
              minWidth: 56,
              padding: '0 var(--space-6)',
              font: 'var(--type-label)',
              fontWeight: on ? 'var(--fw-semibold)' : 'var(--fw-medium)',
              color: on ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: on ? 'var(--surface-card)' : 'transparent',
              border: `1px solid ${on ? 'var(--line-hairline)' : 'transparent'}`,
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer',
              transition: 'background-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard)',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
