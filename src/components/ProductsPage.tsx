import { useState } from 'react'
import { Card, SearchField, FilterChip, ProductRow, EmptyState, Button, type ForecastStatus } from './ds'
import { useLanguage } from '../contexts/LanguageContext'

type DbStatus = 'ending-soon' | 'ok' | 'calculating' | 'irregular'

const toForecast = (s: DbStatus): ForecastStatus => (s === 'ending-soon' ? 'ending_soon' : s)

export interface ProcessedProduct {
  id: number
  name: string
  nameRu?: string | null
  originalName?: string
  product_type?: string
  lastPurchase: string
  avgDays: number | null
  predictedEnd: string | null
  status: DbStatus
  purchaseCount: number
}

interface ProductsPageProps {
  products: ProcessedProduct[]
  loading: boolean
  hasMore: boolean
  loadMore?: (limit: number) => Promise<void>
  loadingMore: boolean
  typeTranslations: Record<string, string>
  filterType?: string | null
  onClearTypeFilter?: () => void
  onOpenProduct: (product: ProcessedProduct) => void
}

const FILTERS: ForecastStatus[] = ['ending_soon', 'ok', 'irregular', 'calculating']

const ProductsPage: React.FC<ProductsPageProps> = ({
  products,
  loading,
  hasMore,
  loadMore,
  loadingMore,
  typeTranslations,
  filterType,
  onClearTypeFilter,
  onOpenProduct,
}) => {
  const { language } = useLanguage()
  const lang: 'ru' | 'pt' = language
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | ForecastStatus>('all')

  const displayType = (pt?: string) => (pt ? (lang === 'ru' && typeTranslations[pt]) || pt : '')

  const t = lang === 'pt'
    ? { search: 'Encontrar produto', clear: 'Limpar', all: 'Todos', emptyTitle: 'Ainda vazio', emptyDesc: 'Pede para te adicionarem à família — os dados aparecem sozinhos.', noMatchTitle: 'Nada encontrado', noMatchDesc: 'Tenta outro nome ou remove o filtro.', loadMore: 'Mostrar mais', loading: 'A carregar…', products: (n: number) => (n === 1 ? '1 produto' : `${n} produtos`) }
    : { search: 'Найти продукт', clear: 'Сброс', all: 'Все', emptyTitle: 'Пока пусто', emptyDesc: 'Попроси добавить тебя в семью — данные появятся сами.', noMatchTitle: 'Ничего не найдено', noMatchDesc: 'Попробуй другое название или сними фильтр.', loadMore: 'Показать ещё', loading: 'Загрузка…', products: (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'продукт' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'продукта' : 'продуктов'}` }

  const filterLabels: Record<'all' | ForecastStatus, string> = lang === 'pt'
    ? { all: 'Todos', ending_soon: 'A acabar', ok: 'Suficiente', irregular: 'Irregular', calculating: 'A calcular' }
    : { all: 'Все', ending_soon: 'Заканчивается', ok: 'В норме', irregular: 'Нерегулярно', calculating: 'Считается' }

  const needle = q.trim().toLowerCase()
  const rows = products.filter((p) => {
    const forecast = toForecast(p.status)
    if (filterType && p.product_type !== filterType) return false
    if (filter !== 'all' && forecast !== filter) return false
    if (needle) {
      const hay = [p.name, p.nameRu ?? '', p.originalName ?? '', p.product_type ?? ''].join(' ').toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })

  const counts: Record<'all' | ForecastStatus, number> = { all: products.length, ending_soon: 0, ok: 0, irregular: 0, calculating: 0 }
  products.forEach((p) => {
    counts[toForecast(p.status)] += 1
  })

  return (
    <div style={{ padding: '0 var(--gutter-mobile) var(--space-12)', maxWidth: 'var(--content-max)', margin: '0 auto' }}>
      <div style={{ paddingTop: 'var(--space-3)' }}>
        <SearchField value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} placeholder={t.search} clearLabel={t.clear} />
      </div>

      {filterType && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-4)',
            padding: 'var(--space-5) var(--space-6)',
            marginTop: 'var(--space-6)',
            background: 'var(--surface-sunken)',
            border: '1px solid var(--line-hairline)',
            borderRadius: 'var(--radius-sm)',
            font: 'var(--type-body-sm)',
            color: 'var(--text-secondary)',
          }}
        >
          <span>{displayType(filterType)}</span>
          {onClearTypeFilter && (
            <button
              type="button"
              onClick={onClearTypeFilter}
              style={{ border: 'none', background: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', font: 'var(--type-meta)' }}
            >
              {t.clear}
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-4)', overflowX: 'auto', padding: 'var(--space-6) 0' }}>
        <FilterChip selected={filter === 'all'} count={counts.all} onClick={() => setFilter('all')}>
          {filterLabels.all}
        </FilterChip>
        {FILTERS.map((k) => (
          <FilterChip key={k} selected={filter === k} count={counts[k]} onClick={() => setFilter(k)}>
            {filterLabels[k]}
          </FilterChip>
        ))}
      </div>

      {loading && products.length === 0 ? (
        <Card>
          <EmptyState title={t.loading} />
        </Card>
      ) : products.length === 0 ? (
        <Card>
          <EmptyState title={t.emptyTitle} description={t.emptyDesc} />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title={t.noMatchTitle} description={t.noMatchDesc} />
        </Card>
      ) : (
        <Card padded={false}>
          {rows.map((p, i) => (
            <ProductRow
              key={p.id}
              first={i === 0}
              name={p.nameRu || p.name}
              originalName={p.originalName || p.name}
              productType={p.product_type ? displayType(p.product_type) : null}
              status={toForecast(p.status)}
              lang={lang}
              onClick={() => onOpenProduct(p)}
            />
          ))}
        </Card>
      )}

      {!loading && hasMore && rows.length > 0 && loadMore && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-8)' }}>
          <Button onClick={() => loadMore(20)} disabled={loadingMore}>
            {loadingMore ? t.loading : t.loadMore}
          </Button>
        </div>
      )}
    </div>
  )
}

export default ProductsPage
