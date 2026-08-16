import { ReactNode, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open?: boolean
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  closeLabel?: string
  wide?: boolean
}

export function Modal({ open = true, title, children, footer, onClose, closeLabel = 'Закрыть', wide = false }: ModalProps) {
  useEffect(() => {
    if (!open) return
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
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        background: 'var(--surface-scrim)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: wide ? 560 : 480,
          maxHeight: '92%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface-raised)',
          borderTopLeftRadius: 'var(--radius-sheet)',
          borderTopRightRadius: 'var(--radius-sheet)',
          boxShadow: 'var(--shadow-sheet)',
          animation: 'pantry-sheet-in var(--dur-sheet) var(--ease-out)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-6)',
            padding: 'var(--space-6) var(--space-7)',
            borderBottom: '1px solid var(--line-hairline)',
            flex: 'none',
          }}
        >
          <span style={{ font: 'var(--fw-semibold) var(--fs-17)/var(--lh-snug) var(--font-sans)' }}>{title}</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              minHeight: 36,
              padding: '0 var(--space-4)',
              border: 'none',
              background: 'transparent',
              font: 'var(--type-label)',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            {closeLabel}
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>{children}</div>
        {footer && (
          <div
            style={{
              flex: 'none',
              display: 'flex',
              gap: 'var(--space-5)',
              padding: 'var(--space-6) var(--space-7)',
              borderTop: '1px solid var(--line-hairline)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
