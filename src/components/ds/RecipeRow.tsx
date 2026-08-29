import { ListRow } from './ListRow'
import { PhotoButton } from './PhotoButton'

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
  const missing = total - matched
  const tierStyle = TIER_STYLE[tier]
  const label =
    tier === 'complete'
      ? lang === 'pt' ? 'Tudo em casa' : 'Всё есть'
      : tier === 'missing_one'
        ? lang === 'pt' ? 'Falta 1' : 'Не хватает 1'
        : lang === 'pt' ? `Faltam ${missing}` : `Не хватает ${missing}`

  const right = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      {imageUrl && <PhotoButton url={imageUrl} alt={name} lang={lang} />}
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
        }}
      >
        {label}
      </span>
    </div>
  )

  return (
    <ListRow first={first} onClick={onClick} right={right}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span
          style={{
            font: 'var(--type-row-title)',
            color: 'var(--text-primary)',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </span>
        <span style={{ display: 'flex', gap: 'var(--space-4)', minWidth: 0 }}>
          {category && (
            <span style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)', flex: 'none' }}>{category}</span>
          )}
          <span style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)' }}>
            {matched}/{total} {lang === 'pt' ? 'ingredientes' : 'ингр.'}
          </span>
        </span>
      </div>
    </ListRow>
  )
}
