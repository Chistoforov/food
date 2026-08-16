import { ListRow } from './ListRow'

interface ReceiptRowProps {
  date: string
  store?: string
  total: string
  itemCount: number
  lang?: 'ru' | 'pt'
  onClick?: () => void
  first?: boolean
}

export function ReceiptRow({ date, store, total, itemCount, lang = 'ru', onClick, first = false }: ReceiptRowProps) {
  const items = lang === 'pt' ? `${itemCount} art.` : `${itemCount} поз.`
  return (
    <ListRow
      first={first}
      onClick={onClick}
      right={<span className="tnum" style={{ font: 'var(--type-num)', color: 'var(--text-primary)' }}>{total}</span>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ font: 'var(--type-row-title)', color: 'var(--text-primary)' }}>{store || date}</span>
        <span className="tnum" style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)' }}>
          {store ? `${date} · ${items}` : items}
        </span>
      </div>
    </ListRow>
  )
}
