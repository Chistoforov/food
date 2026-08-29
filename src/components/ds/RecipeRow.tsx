import { KeyboardEvent, useState } from 'react'
import { ImageIcon } from 'lucide-react'
import { Icon } from './Icon'

export type MatchTier = 'complete' | 'missing_one' | 'missing_many'

interface RecipeRowProps {
  name: string
  category?: string | null
  imageUrl?: string | null
  matched: number
  total: number
  tier: MatchTier
  lang?: 'ru' | 'pt'
  onClick?: () => void
  first?: boolean
}

const TIER_STYLE: Record<MatchTier, { bg: string; fg: string }> = {
  complete: { bg: 'rgba(45,135,90,0.14)', fg: '#256a48' },
  missing_one: { bg: 'rgba(200,150,60,0.14)', fg: '#8a5b0e' },
  missing_many: { bg: 'rgba(150,150,150,0.14)', fg: 'var(--text-tertiary)' },
}

export function RecipeRow({
  name,
  category,
  imageUrl,
  matched,
  total,
  tier,
  lang = 'ru',
  onClick,
  first = false,
}: RecipeRowProps) {
  const [hover, setHover] = useState(false)
  const interactive = typeof onClick === 'function'
  const missing = total - matched
  const tierStyle = TIER_STYLE[tier]
  const label =
    tier === 'complete'
      ? lang === 'pt' ? 'Tudo em casa' : 'Всё есть'
      : tier === 'missing_one'
        ? lang === 'pt' ? 'Falta 1' : 'Не хватает 1'
        : lang === 'pt' ? `Faltam ${missing}` : `Не хватает ${missing}`

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
        flexDirection: 'column',
        gap: 'var(--space-4)',
        padding: 'var(--space-6) var(--space-7)',
        borderTop: first ? 'none' : '1px solid var(--line-hairline)',
        background: hover && interactive ? 'var(--surface-hover)' : 'transparent',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'background-color var(--dur-instant) var(--ease-standard)',
      }}
    >
      <span
        style={{
          font: 'var(--type-row-title)',
          color: 'var(--text-primary)',
          wordBreak: 'break-word',
        }}
      >
        {name}
      </span>

      <div
        style={{
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          background: 'var(--surface-sunken)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <ImageIcon size={28} strokeWidth={1.5} color="var(--text-disabled)" />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          {category && (
            <span style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)' }}>{category}</span>
          )}
          <span style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)' }}>
            {matched}/{total} {lang === 'pt' ? 'ingredientes' : 'ингр.'}
          </span>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 10px',
            borderRadius: 999,
            background: tierStyle.bg,
            color: tierStyle.fg,
            font: 'var(--type-meta)',
            whiteSpace: 'nowrap',
            flex: 'none',
          }}
        >
          {label}
        </span>
        {interactive && <Icon name="chevron-right" size={16} color="var(--stone-300)" />}
      </div>
    </div>
  )
}
