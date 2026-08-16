import { ButtonHTMLAttributes, CSSProperties, ReactNode, useState } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  children: ReactNode
  variant?: Variant
  size?: Size
  block?: boolean
  style?: CSSProperties
}

const BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-3)',
  font: 'var(--type-label)',
  border: '1px solid transparent',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  textAlign: 'center',
  whiteSpace: 'nowrap',
  transition: 'background-color var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard), border-color var(--dur-fast) var(--ease-standard)',
}

const SIZES: Record<Size, CSSProperties> = {
  sm: { minHeight: 32, padding: '0 var(--space-5)', fontSize: 'var(--fs-13)' },
  md: { minHeight: 'var(--tap-min)', padding: '0 var(--space-7)', fontSize: 'var(--fs-14)' },
  lg: { minHeight: 50, padding: '0 var(--space-8)', fontSize: 'var(--fs-15)' },
}

const VARIANTS: Record<Variant, CSSProperties> = {
  primary: { background: 'var(--stone-900)', color: 'var(--text-inverse)', borderColor: 'var(--stone-900)' },
  secondary: { background: 'var(--surface-card)', color: 'var(--text-primary)', borderColor: 'var(--line-strong)' },
  ghost: { background: 'transparent', color: 'var(--text-secondary)', borderColor: 'transparent' },
  danger: { background: 'var(--surface-card)', color: 'var(--text-danger)', borderColor: 'var(--red-100)' },
}

const HOVER: Record<Variant, CSSProperties> = {
  primary: { background: 'var(--stone-700)', borderColor: 'var(--stone-700)' },
  secondary: { background: 'var(--surface-hover)' },
  ghost: { background: 'var(--surface-hover)', color: 'var(--text-primary)' },
  danger: { background: 'var(--red-50)' },
}

export function Button({ children, variant = 'secondary', size = 'md', block = false, disabled = false, type = 'button', style, ...rest }: ButtonProps) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type={type}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...BASE,
        ...SIZES[size],
        ...VARIANTS[variant],
        ...(hover && !disabled ? HOVER[variant] : null),
        width: block ? '100%' : undefined,
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'default' : 'pointer',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
