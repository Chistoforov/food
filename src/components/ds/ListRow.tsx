import { CSSProperties, KeyboardEvent, ReactNode, useState } from 'react'
import { Icon } from './Icon'

interface ListRowProps {
  children: ReactNode
  right?: ReactNode
  onClick?: () => void
  chevron?: boolean
  first?: boolean
  muted?: boolean
  style?: CSSProperties
}

export function ListRow({ children, right, onClick, chevron, first = false, muted = false, style }: ListRowProps) {
  const [hover, setHover] = useState(false)
  const interactive = typeof onClick === 'function'
  const showChevron = chevron ?? interactive

  const handleKey = interactive
    ? (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }
    : undefined

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKey}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-6)',
        minHeight: 'var(--row-min-height)',
        padding: 'var(--space-6) var(--space-7)',
        borderTop: first ? 'none' : '1px solid var(--line-hairline)',
        background: hover && interactive ? 'var(--surface-hover)' : 'transparent',
        cursor: interactive ? 'pointer' : 'default',
        opacity: muted ? 0.66 : 1,
        transition: 'background-color var(--dur-instant) var(--ease-standard)',
        ...style,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {right && (
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>{right}</div>
      )}
      {showChevron && <Icon name="chevron-right" size={16} color="var(--stone-300)" />}
    </div>
  )
}
