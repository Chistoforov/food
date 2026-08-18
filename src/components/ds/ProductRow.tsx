import { LikeButtons } from './LikeButtons'
import { ListRow } from './ListRow'
import { PhotoButton } from './PhotoButton'
import { StatusDot, ForecastStatus } from './StatusDot'

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
  const showDot = status === 'ok' || status === 'ending_soon' || status === 'calculating'

  const hasIcons = Boolean(onLikeToggle) || Boolean(imageUrl)
  const right = hasIcons ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      {onLikeToggle && <LikeButtons likeStatus={likeStatus} lang={lang} onToggle={onLikeToggle} />}
      {imageUrl && <PhotoButton url={imageUrl} alt={display} lang={lang} />}
    </div>
  ) : null

  return (
    <ListRow first={first} onClick={onClick} muted={status === 'irregular'} right={right}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-3)', minWidth: 0 }}>
          {showDot && (
            <StatusDot status={status} size={8} style={{ alignSelf: 'center', flex: 'none' }} />
          )}
          <span
            style={{
              font: 'var(--type-row-title)',
              color: 'var(--text-primary)',
              wordBreak: 'break-word',
            }}
          >
            {display}
          </span>
        </span>
        {(productType || sub) && (
          <span style={{ display: 'flex', gap: 'var(--space-4)', minWidth: 0, flexWrap: 'wrap' }}>
            {productType && (
              <span style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)', flex: 'none' }}>{productType}</span>
            )}
            {sub && (
              <span
                style={{
                  font: 'var(--type-original)',
                  color: 'var(--text-disabled)',
                  wordBreak: 'break-word',
                }}
              >
                {sub}
              </span>
            )}
          </span>
        )}
      </div>
    </ListRow>
  )
}
