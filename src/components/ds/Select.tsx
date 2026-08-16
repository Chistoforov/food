import { ChangeEvent, ReactNode, useId } from 'react'
import { Icon } from './Icon'

interface Option {
  value: string
  label: string
}

interface SelectProps {
  label?: ReactNode
  value: string
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void
  options: Option[]
  disabled?: boolean
  id?: string
}

export function Select({ label, value, onChange, options, disabled = false, id }: SelectProps) {
  const generated = useId()
  const fid = id ?? generated
  return (
    <label htmlFor={fid} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {label && <span style={{ font: 'var(--type-label)', color: 'var(--text-secondary)' }}>{label}</span>}
      <span style={{ position: 'relative', display: 'block' }}>
        <select
          id={fid}
          value={value}
          onChange={onChange}
          disabled={disabled}
          style={{
            appearance: 'none',
            WebkitAppearance: 'none',
            width: '100%',
            minHeight: 'var(--tap-min)',
            padding: '0 var(--space-10) 0 var(--space-6)',
            font: 'var(--type-body)',
            color: 'var(--text-primary)',
            background: disabled ? 'var(--surface-sunken)' : 'var(--surface-card)',
            border: '1px solid var(--line-strong)',
            borderRadius: 'var(--radius-sm)',
            outline: 'none',
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span
          style={{
            position: 'absolute',
            right: 'var(--space-6)',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        >
          <Icon name="chevron-down" size={16} color="var(--stone-400)" />
        </span>
      </span>
    </label>
  )
}
