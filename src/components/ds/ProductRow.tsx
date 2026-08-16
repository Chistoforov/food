import { ListRow } from './ListRow'
import { StatusBadge } from './StatusBadge'
import { ForecastStatus } from './StatusDot'

interface ProductRowProps {
  name: string
  originalName?: string | null
  productType?: string | null
  status?: ForecastStatus
  lang?: 'ru' | 'pt'
  onClick?: () => void
  first?: boolean
}

export function ProductRow({ name, originalName, productType, status = 'ok', lang = 'ru', onClick, first = false }: ProductRowProps) {
  const display = lang === 'pt' ? originalName || name : name || originalName || ''
  const sub = lang === 'pt' ? null : originalName
  const right = status === 'calculating' ? (
    <span style={{ font: 'var(--type-meta)', color: 'var(--text-disabled)' }}>
      {lang === 'pt' ? 'a calcular…' : 'считается…'}
    </span>
  ) : (
    <StatusBadge status={status} lang={lang} dot={status !== 'irregular'} />
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
