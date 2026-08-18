import { LikeButtons } from './LikeButtons'
import { ListRow } from './ListRow'
import { PhotoButton } from './PhotoButton'
import { StatusBadge } from './StatusBadge'
import { ForecastStatus } from './StatusDot'

interface ProductRowProps {
  name: string
  originalName?: string | null
  productType?: string | null
  status?: ForecastStatus
  lang?: 'ru' | 'pt'
  likeStatus?: -1 | 1 | null
  imageUrl?: string | null
  onLikeToggle?: (next: -1 | 1 | null) => void
  onClick?: () => void
  first?: boolean
}

export function ProductRow({
  name,
  originalName,
  productType,
  status = 'ok',
  lang = 'ru',
  likeStatus = null,
  imageUrl = null,
  onLikeToggle,
  onClick,
  first = false,
}: ProductRowProps) {
  const display = lang === 'pt' ? originalName || name : name || originalName || ''
  const sub = lang === 'pt' ? null : originalName
  const badge = status === 'calculating' ? (
    <span style={{ font: 'var(--type-meta)', color: 'var(--text-disabled)' }}>
      {lang === 'pt' ? 'a calcular…' : 'считается…'}
    </span>
  ) : (
    <StatusBadge status={status} lang={lang} dot={status !== 'irregular'} />
  )
  const right = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      {onLikeToggle && <LikeButtons likeStatus={likeStatus} lang={lang} onToggle={onLikeToggle} />}
      {imageUrl && <PhotoButton url={imageUrl} alt={display} lang={lang} />}
      {badge}
    </div>
  )
  return (
    <ListRow first={first} onClick={onClick} muted={status === 'irregular'} right={right}>
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
          {display}
        </span>
        <span style={{ display: 'flex', gap: 'var(--space-4)', minWidth: 0 }}>
          {productType && (
            <span style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)', flex: 'none' }}>{productType}</span>
          )}
          {sub && (
            <span
              style={{
                font: 'var(--type-original)',
                color: 'var(--text-disabled)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {sub}
            </span>
          )}
        </span>
      </div>
    </ListRow>
  )
}
