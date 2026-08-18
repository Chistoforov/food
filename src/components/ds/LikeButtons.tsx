import { MouseEvent } from 'react'
import { Heart, ThumbsDown } from 'lucide-react'

const HEART_COLOR = '#e11d48'
const DISLIKE_COLOR = '#78716c'

interface LikeButtonProps {
  active: boolean
  variant: 'like' | 'dislike'
  lang: 'ru' | 'pt'
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
}

function LikeButton({ active, variant, lang, onClick }: LikeButtonProps) {
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

interface LikeButtonsProps {
  likeStatus: -1 | 1 | null
  lang: 'ru' | 'pt'
  onToggle: (next: -1 | 1 | null) => void
}

export function LikeButtons({ likeStatus, lang, onToggle }: LikeButtonsProps) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <LikeButton
        variant="like"
        active={likeStatus === 1}
        lang={lang}
        onClick={(e) => {
          e.stopPropagation()
          onToggle(likeStatus === 1 ? null : 1)
        }}
      />
      <LikeButton
        variant="dislike"
        active={likeStatus === -1}
        lang={lang}
        onClick={(e) => {
          e.stopPropagation()
          onToggle(likeStatus === -1 ? null : -1)
        }}
      />
    </div>
  )
}
