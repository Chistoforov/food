import { MouseEvent, useState } from 'react'
import { ImageIcon } from 'lucide-react'
import { ImageLightbox } from './ImageLightbox'

interface PhotoButtonProps {
  url: string
  alt?: string
  lang?: 'ru' | 'pt'
}

export function PhotoButton({ url, alt, lang = 'ru' }: PhotoButtonProps) {
  const [open, setOpen] = useState(false)
  const label = lang === 'pt' ? 'Ver foto' : 'Показать фото'
  return (
    <>
      <button
        type="button"
        onClick={(e: MouseEvent<HTMLButtonElement>) => {
          e.stopPropagation()
          setOpen(true)
        }}
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
          color: 'var(--text-disabled)',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <ImageIcon size={18} strokeWidth={1.75} />
      </button>
      {open && <ImageLightbox url={url} alt={alt} onClose={() => setOpen(false)} />}
    </>
  )
}
