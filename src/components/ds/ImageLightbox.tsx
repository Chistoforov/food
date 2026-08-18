import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ImageLightboxProps {
  url: string
  alt?: string
  onClose: () => void
}

export function ImageLightbox({ url, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return createPortal(
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
        background: 'rgba(0,0,0,0.85)',
        cursor: 'zoom-out',
      }}
    >
      <img
        src={url}
        alt={alt || ''}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          background: '#fff',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          cursor: 'zoom-out',
        }}
      />
    </div>,
    document.body,
  )
}
