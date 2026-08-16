import { ListRow } from './ListRow'
import { StatusBadge } from './StatusBadge'
import { ForecastStatus } from './StatusDot'

const SKU = {
  ru: (n: number) => {
    const mod10 = n % 10
    const mod100 = n % 100
    const suffix = mod10 === 1 && mod100 !== 11
      ? 'товар'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)
        ? 'товара'
        : 'товаров'
    return `${n} ${suffix}`
  },
  pt: (n: number) => `${n} ${n === 1 ? 'produto' : 'produtos'}`,
}

const DAYS = {
  ru: (d: number) => (d <= 0 ? 'уже кончилось' : `≈ ${d} дн.`),
  pt: (d: number) => (d <= 0 ? 'já acabou' : `≈ ${d} d.`),
}

interface StockRowProps {
  name: string
  skuCount?: number
  status?: ForecastStatus
  daysLeft?: number | null
  lang?: 'ru' | 'pt'
  onClick?: () => void
  first?: boolean
}

export function StockRow({ name, skuCount = 1, status = 'ok', daysLeft, lang = 'ru', onClick, first = false }: StockRowProps) {
  const calculating = status === 'calculating'
  const right = calculating ? (
    <span style={{ font: 'var(--type-meta)', color: 'var(--text-disabled)' }}>
      {lang === 'pt' ? 'a calcular…' : 'считается…'}
    </span>
  ) : (
    <StatusBadge status={status} lang={lang} />
  )
  return (
    <ListRow first={first} onClick={onClick} muted={status === 'irregular'} right={right}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
        <span className="tnum" style={{ font: 'var(--type-meta)', color: 'var(--text-tertiary)' }}>
          {SKU[lang](skuCount)}
          {!calculating && daysLeft != null ? ` · ${DAYS[lang](daysLeft)}` : ''}
        </span>
      </div>
    </ListRow>
  )
}
