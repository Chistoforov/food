import { Card, SectionHeader, StockRow, EmptyState, Banner, Button, MonthSpendCard, type ForecastStatus } from './ds'
import { MonthlyStats, Receipt } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { displayType as displayTypeUtil, type TypeTranslationMaps } from '../lib/typeI18n'

type DbStatus = 'ending-soon' | 'ok' | 'calculating' | 'irregular'

const toForecast = (s: DbStatus): ForecastStatus => (s === 'ending-soon' ? 'ending_soon' : s)

interface HomePageProps {
  productTypeStats: Record<string, { status: DbStatus; productCount: number }>
  endingCountsByType: Record<string, number>
  typeTranslations: TypeTranslationMaps
  receipts: Receipt[]
  monthlyStats: MonthlyStats[]
  offline: boolean
  onRetry: () => void
  onOpenType: (type: string) => void
}

const formatUpdated = (hours: number | null, lang: 'ru' | 'pt') => {
  if (hours == null) return undefined
  if (lang === 'pt') {
    if (hours < 1) return 'atualizado agora'
    return `atualizado há ${hours} h`
  }
  if (hours < 1) return 'обновлено только что'
  return `обновлено ${hours} ч назад`
}

const HomePage: React.FC<HomePageProps> = ({
  productTypeStats,
  endingCountsByType,
  typeTranslations,
  receipts,
  monthlyStats,
  offline,
  onRetry,
  onOpenType,
}) => {
  const { language } = useLanguage()
  const lang: 'ru' | 'pt' = language

  const displayType = (type: string) => displayTypeUtil(type, lang, typeTranslations)

  const entries = Object.entries(productTypeStats)
    .map(([type, s]) => ({ type, status: toForecast(s.status), count: s.productCount }))
    .filter((g) => g.status !== 'irregular' && g.status !== 'calculating')
    .sort((a, b) => b.count - a.count)

  const ending = entries.filter((g) => g.status === 'ending_soon')
  const ok = entries.filter((g) => g.status === 'ok')

  const empty = entries.length === 0 && receipts.length === 0

  const titles = lang === 'pt'
    ? { home: 'Início', endingSoon: 'A acabar', ok: 'Suficiente', offline: 'Sem rede. Últimos dados exibidos.', retry: 'Repetir', emptyTitle: 'Ainda vazio', emptyDesc: 'Pede para te adicionarem à família — os dados aparecem sozinhos.' }
    : { home: 'Дом', endingSoon: 'Заканчивается', ok: 'В норме', offline: 'Нет сети. Показаны последние данные.', retry: 'Повторить', emptyTitle: 'Пока пусто', emptyDesc: 'Попроси добавить тебя в семью — данные появятся сами.' }

  return (
    <>
      {offline && (
        <div style={{ padding: 'var(--space-6) var(--gutter-mobile) 0' }}>
          <Banner tone="error" action={<Button size="sm" onClick={onRetry}>{titles.retry}</Button>}>
            {titles.offline}
          </Banner>
        </div>
      )}

      <div style={{ padding: '0 var(--gutter-mobile) var(--space-12)', maxWidth: 'var(--content-max)', margin: '0 auto' }}>
        {empty ? (
          <Card style={{ marginTop: 'var(--space-9)' }}>
            <EmptyState title={titles.emptyTitle} description={titles.emptyDesc} />
          </Card>
        ) : (
          <>
            <MonthSpendCard stats={monthlyStats} lang={lang} />
            {ending.length > 0 && (
              <>
                <SectionHeader count={ending.length}>{titles.endingSoon}</SectionHeader>
                <Card padded={false}>
                  {ending.map((g, i) => (
                    <StockRow
                      key={g.type}
                      first={i === 0}
                      name={displayType(g.type)}
                      skuCount={g.count}
                      endingCount={endingCountsByType[g.type]}
                      status={g.status}
                      lang={lang}
                      onClick={() => onOpenType(g.type)}
                    />
                  ))}
                </Card>
              </>
            )}

            {ok.length > 0 && (
              <>
                <SectionHeader count={ok.length}>{titles.ok}</SectionHeader>
                <Card padded={false}>
                  {ok.map((g, i) => (
                    <StockRow
                      key={g.type}
                      first={i === 0}
                      name={displayType(g.type)}
                      skuCount={g.count}
                      status={g.status}
                      lang={lang}
                      onClick={() => onOpenType(g.type)}
                    />
                  ))}
                </Card>
              </>
            )}

          </>
        )}
      </div>
    </>
  )
}

export { formatUpdated }
export default HomePage
