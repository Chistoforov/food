import { CSSProperties, HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padded?: boolean
  inset?: boolean
  style?: CSSProperties
}

export function Card({ children, padded = true, inset = false, style, ...rest }: CardProps) {
  return (
    <div
      style={{
        background: 'var(--surface-card)',
        border: '1px solid var(--line-hairline)',
        borderRadius: inset ? 0 : 'var(--radius-md)',
        borderLeftWidth: inset ? 0 : 1,
        borderRightWidth: inset ? 0 : 1,
        padding: padded ? 'var(--space-6) var(--space-7)' : 0,
        overflow: 'hidden',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}
