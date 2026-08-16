interface ReceiptItemRowProps {
  name: string
  originalName?: string | null
  pricePaid?: string | null
  priceNow?: string | null
  lang?: 'ru' | 'pt'
  first?: boolean
}

export function ReceiptItemRow({ name, originalName, pricePaid, priceNow, lang = 'ru', first = false }: ReceiptItemRowProps) {
  const display = lang === 'pt' ? originalName || name : name || originalName || ''
  const delta = priceNow && priceNow !== pricePaid
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-6)',
        padding: 'var(--space-5) var(--space-7)',
        borderTop: first ? 'none' : '1px solid var(--line-hairline)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ font: 'var(--type-body-sm)', color: 'var(--text-primary)' }}>{display}</div>
        {lang !== 'pt' && originalName && (
          <div
            style={{
              font: 'var(--type-original)',
              color: 'var(--text-disabled)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {originalName}
          </div>
        )}
      </div>
      {pricePaid && (
        <div style={{ flex: 'none', textAlign: 'right' }}>
          <div className="tnum" style={{ font: 'var(--type-num)', color: 'var(--text-primary)' }}>{pricePaid}</div>
          {delta && (
            <div className="tnum" style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)' }}>
              {(lang === 'pt' ? 'hoje ' : 'сейчас ') + priceNow}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
