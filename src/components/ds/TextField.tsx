import { ChangeEvent, CSSProperties, ReactNode, useId, useState } from 'react'

interface TextFieldProps {
  label?: ReactNode
  hint?: ReactNode
  value?: string
  defaultValue?: string
  placeholder?: string
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  invalid?: boolean
  id?: string
  style?: CSSProperties
}

export function TextField({ label, hint, value, defaultValue, placeholder, onChange, disabled = false, invalid = false, id, style }: TextFieldProps) {
  const [focus, setFocus] = useState(false)
  const generated = useId()
  const fid = id ?? generated
  return (
    <label htmlFor={fid} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', ...style }}>
      {label && <span style={{ font: 'var(--type-label)', color: 'var(--text-secondary)' }}>{label}</span>}
      <input
        id={fid}
        value={value}
        defaultValue={defaultValue}
        placeholder={placeholder}
        disabled={disabled}
        onChange={onChange}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          minHeight: 'var(--tap-min)',
          padding: '0 var(--space-6)',
          font: 'var(--type-body)',
          color: 'var(--text-primary)',
          background: disabled ? 'var(--surface-sunken)' : 'var(--surface-card)',
          border: `1px solid ${invalid ? 'var(--error-line)' : focus ? 'var(--stone-500)' : 'var(--line-strong)'}`,
          borderRadius: 'var(--radius-sm)',
          outline: 'none',
          width: '100%',
          transition: 'border-color var(--dur-fast) var(--ease-standard)',
        }}
      />
      {hint && (
        <span style={{ font: 'var(--type-meta)', color: invalid ? 'var(--error-fg)' : 'var(--text-tertiary)' }}>{hint}</span>
      )}
    </label>
  )
}
