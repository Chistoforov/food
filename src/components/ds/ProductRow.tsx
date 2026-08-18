import { MouseEvent } from 'react'
import { Heart, ThumbsDown } from 'lucide-react'
import { ListRow } from './ListRow'
import { StatusBadge } from './StatusBadge'
import { ForecastStatus } from './StatusDot'

const HEART_COLOR = '#e11d48'
const DISLIKE_COLOR = '#78716c'

interface ProductRowProps {
  name: string
  originalName?: string | null
  productType?: string | null
  status?: ForecastStatus
  lang?: 'ru' | 'pt'
  likeStatus?: -1 | 1 | null
  onLikeToggle?: (next: -1 | 1 | null) => void
  onClick?: () => void
  first?: boolean
}

const LikeButton = ({
  active,
  variant,
  onClick,
  lang,
}: {
  active: boolean
  variant: 'like' | 'dislike'
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
  lang: 'ru' | 'pt'
}) => {
  const label = variant === 'like'
    ? (lang === 'pt' ? 'Gosto' : 'Нравится')
    : (lang === 'pt' ? 'Não gosto' : 'Не нравится')
  const color = active
    ? (variant === 'like' ? HEART_COLOR : DISLIKE_COLOR)
    : 'var(--text-disabled)'
  const Icon = variant === 'like' ? Heart : ThumbsDown
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        border: 'none',
        background: 'transparent',
        color,
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <Icon size={18} strokeWidth={1.75} fill={active ? color : 'none'} />
    </button>
  )
}

export function ProductRow({
  name,
  originalName,
  productType,
  status = 'ok',
  lang = 'ru',
  likeStatus = null,
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
      {onLikeToggle && (
        <>
          <LikeButton
            variant="like"
            active={likeStatus === 1}
            lang={lang}
            onClick={(e) => {
              e.stopPropagation()
              onLikeToggle(likeStatus === 1 ? null : 1)
            }}
          />
          <LikeButton
            variant="dislike"
            active={likeStatus === -1}
            lang={lang}
            onClick={(e) => {
              e.stopPropagation()
              onLikeToggle(likeStatus === -1 ? null : -1)
            }}
          />
        </>
      )}
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
