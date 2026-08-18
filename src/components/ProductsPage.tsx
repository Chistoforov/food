import { useEffect, useState } from 'react'
import { Card, SearchField, FilterChip, ProductRow, EmptyState, Button, type ForecastStatus } from './ds'
import { useLanguage } from '../contexts/LanguageContext'
import { displayType as displayTypeUtil, type TypeTranslationMaps } from '../lib/typeI18n'

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
  likeStatus?: -1 | 1 | null
  imageUrl?: string | null
}

interface ProductsPageProps {
  products: ProcessedProduct[]
  loading: boolean
  typeTranslations: TypeTranslationMaps
  filterType?: string | null
  onMarkTypeBought?: (type: string) => Promise<void>
  onClearTypeFilter?: () => void
  onOpenProduct: (product: ProcessedProduct) => void
  onSetLikeStatus?: (productId: number, next: -1 | 1 | null) => void
}

const FILTERS: ForecastStatus[] = ['ending_soon', 'ok', 'irregular', 'calculating']
const PAGE_SIZE = 10

const STATUS_PRIORITY: Record<ForecastStatus, number> = {
  ending_soon: 0,
  calculating: 1,
  ok: 2,
  irregular: 3,
}

const ProductsPage: React.FC<ProductsPageProps> = ({
  products,
  loading,
  typeTranslations,
  filterType,
  onMarkTypeBought,
  onClearTypeFilter,
  onOpenProduct,
  onSetLikeStatus,
}) => {
  const { language } = useLanguage()
  const lang: 'ru' | 'pt' = language
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<'all' | ForecastStatus>('all')
  const [marking, setMarking] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Сбрасываем клиентскую пагинацию при смене фильтров/поиска
  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [q, filter, filterType])

  const displayType = (type?: string) => (type ? displayTypeUtil(type, lang, typeTranslations) : '')

  const t = lang === 'pt'
    ? { search: 'Encontrar produto', clear: 'Limpar', clearFilter: 'Limpar filtro', bought: 'Comprado', boughtDoing: 'A guardar…', all: 'Todos', emptyTitle: 'Ainda vazio', emptyDesc: 'Pede para te adicionarem à família — os dados aparecem sozinhos.', noMatchTitle: 'Nada encontrado', noMatchDesc: 'Tenta outro nome ou remove o filtro.', loadMore: 'Mostrar mais', loading: 'A carregar…', products: (n: number) => (n === 1 ? '1 produto' : `${n} produtos`) }
    : { search: 'Найти продукт', clear: 'Сброс', clearFilter: 'Снять фильтр', bought: 'Куплено', boughtDoing: 'Сохраняю…', all: 'Все', emptyTitle: 'Пока пусто', emptyDesc: 'Попроси добавить тебя в семью — данные появятся сами.', noMatchTitle: 'Ничего не найдено', noMatchDesc: 'Попробуй другое название или сними фильтр.', loadMore: 'Показать ещё', loading: 'Загрузка…', products: (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'продукт' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'продукта' : 'продуктов'}` }

  const filterLabels: Record<'all' | ForecastStatus, string> = lang === 'pt'
    ? { all: 'Todos', ending_soon: 'A acabar', ok: 'Suficiente', irregular: 'Irregular', calculating: 'A calcular' }
    : { all: 'Все', ending_soon: 'Заканчивается', ok: 'В норме', irregular: 'Нерегулярно', calculating: 'Считается' }

  const needle = q.trim().toLowerCase()
  const rows = products
    .filter((p) => {
      const forecast = toForecast(p.status)
      if (filterType && p.product_type !== filterType) return false
      if (filter !== 'all' && forecast !== filter) return false
      if (needle) {
        const hay = [p.name, p.nameRu ?? '', p.originalName ?? '', p.product_type ?? ''].join(' ').toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    .sort((a, b) => {
      const pa = STATUS_PRIORITY[toForecast(a.status)]
      const pb = STATUS_PRIORITY[toForecast(b.status)]
      if (pa !== pb) return pa - pb
      const la = a.lastPurchase ? Date.parse(a.lastPurchase) : 0
      const lb = b.lastPurchase ? Date.parse(b.lastPurchase) : 0
      return lb - la
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
            padding: 'var(--space-3) var(--space-3) var(--space-3) var(--space-6)',
            marginTop: 'var(--space-6)',
            background: 'var(--surface-sunken)',
            border: '1px solid var(--line-hairline)',
            borderRadius: 'var(--radius-sm)',
            font: 'var(--type-body-sm)',
            color: 'var(--text-secondary)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayType(filterType)}</span>
            {onClearTypeFilter && (
              <button
                type="button"
                onClick={onClearTypeFilter}
                aria-label={t.clearFilter}
                title={t.clearFilter}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 18,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </span>
          {onMarkTypeBought && (
            <button
              type="button"
              disabled={marking}
              onClick={async () => {
                try {
                  setMarking(true)
                  await onMarkTypeBought(filterType)
                } finally {
                  setMarking(false)
                }
              }}
              style={{
                minHeight: 32,
                padding: '0 var(--space-6)',
                border: '1px solid var(--stone-900)',
                background: 'var(--stone-900)',
                color: 'var(--text-inverse)',
                font: 'var(--type-label)',
                borderRadius: 'var(--radius-sm)',
                cursor: marking ? 'default' : 'pointer',
                opacity: marking ? 0.6 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {marking ? t.boughtDoing : t.bought}
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
          {rows.slice(0, visibleCount).map((p, i) => (
            <ProductRow
              key={p.id}
              first={i === 0}
              name={p.nameRu || p.name}
              originalName={p.originalName || p.name}
              productType={p.product_type ? displayType(p.product_type) : null}
              status={toForecast(p.status)}
              lang={lang}
              likeStatus={p.likeStatus ?? null}
              imageUrl={p.imageUrl ?? null}
              onLikeToggle={onSetLikeStatus ? (next) => onSetLikeStatus(p.id, next) : undefined}
              onClick={() => onOpenProduct(p)}
            />
          ))}
        </Card>
      )}

      {!loading && rows.length > visibleCount && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-8)' }}>
          <Button onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
            {t.loadMore}
          </Button>
        </div>
      )}
    </div>
  )
}

export default ProductsPage
