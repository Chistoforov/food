import { ChangeEvent, useState } from 'react'

interface SearchFieldProps {
  value: string
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  onClear?: () => void
  placeholder?: string
  clearLabel?: string
}

export function SearchField({ value, onChange, onClear, placeholder = 'Найти продукт', clearLabel = 'Сброс' }: SearchFieldProps) {
  const [focus, setFocus] = useState(false)
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        minHeight: 'var(--tap-min)',
        padding: '0 var(--space-4) 0 var(--space-6)',
        background: 'var(--surface-card)',
        border: `1px solid ${focus ? 'var(--stone-500)' : 'var(--line-strong)'}`,
        borderRadius: 'var(--radius-sm)',
        transition: 'border-color var(--dur-fast) var(--ease-standard)',
      }}
    >
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        type="search"
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          font: 'var(--type-body)',
          color: 'var(--text-primary)',
          padding: 'var(--space-4) 0',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          style={{
            flex: 'none',
            minHeight: 36,
            padding: '0 var(--space-4)',
            border: 'none',
            background: 'transparent',
            font: 'var(--type-meta)',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            borderRadius: 'var(--radius-xs)',
          }}
        >
          {clearLabel}
        </button>
      )}
    </div>
  )
}
