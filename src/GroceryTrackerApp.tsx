import { useEffect, useMemo, useState } from 'react'
import { AppHeader, Banner, TabBar } from './components/ds'
import { useMonthlyStats, useProducts, useReceipts } from './hooks/useSupabaseData'
import { SupabaseService } from './services/supabaseService'
import { useAuth } from './contexts/AuthContext'
import { useLanguage } from './contexts/LanguageContext'
import { clearAppCache } from './utils/cacheHelper'
import LoginPage from './components/LoginPage'
import AccountPage from './components/AccountPage'
import HomePage, { formatUpdated } from './components/HomePage'
import ProductsPage, { type ProcessedProduct } from './components/ProductsPage'
import ProductSheet from './components/ProductSheet'
import ReceiptSheet from './components/ReceiptSheet'
import RecipesPage from './components/RecipesPage'
import { Receipt } from './lib/supabase'
import { EMPTY_TRANSLATIONS, type TypeTranslationMaps } from './lib/typeI18n'

type Tab = 'home' | 'products' | 'recipes' | 'account'

type DbStatus = 'ending-soon' | 'ok' | 'calculating' | 'irregular'
type TypeStats = Record<string, { status: DbStatus; productCount: number }>

const TAB_STORAGE = 'groceryTrackerActiveTab'

const useOnlineStatus = () => {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

const GroceryTrackerApp = () => {
  const { user, profile, loading: authLoading } = useAuth()
  const { language } = useLanguage()
  const lang: 'ru' | 'pt' = language

  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-9)' }}>
        <Banner tone="error">
          Переменные окружения Supabase не настроены. Проверьте .env.local
        </Banner>
      </div>
    )
  }

  useEffect(() => {
    const needsReset = localStorage.getItem('needs_cache_reset')
    if (needsReset === 'true' && profile?.family_id) {
      localStorage.removeItem('needs_cache_reset')
      clearAppCache(profile.family_id, true)
        .then(() => window.location.reload())
        .catch((err) => console.error('cache reset failed:', err))
    }
  }, [profile])

  const [tab, setTab] = useState<Tab>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(TAB_STORAGE) : null
    return saved === 'products' || saved === 'account' || saved === 'recipes' ? saved : 'home'
  })

  useEffect(() => {
    try {
      localStorage.setItem(TAB_STORAGE, tab)
    } catch {
      /* noop */
    }
  }, [tab])

  const familyId = profile?.family_id ?? 0
  const online = useOnlineStatus()

  const { products, loading: productsLoading, updateProduct: mutateProduct, refetch: refetchProducts } = useProducts(familyId)
  const { receipts } = useReceipts(familyId)
  const { stats: monthlyStats } = useMonthlyStats(familyId)

  const [typeStats, setTypeStats] = useState<TypeStats>({})
  const [endingCountsByType, setEndingCountsByType] = useState<Record<string, number>>({})
  const [typeTranslations, setTypeTranslations] = useState<TypeTranslationMaps>(EMPTY_TRANSLATIONS)
  const [productImages, setProductImages] = useState<Map<number, string>>(new Map())

  useEffect(() => {
    if (!familyId) return
    SupabaseService.getProductTypeStats(familyId)
      .then((s) => setTypeStats(s))
      .catch((err) => console.error('type stats failed:', err))
    SupabaseService.getEndingSoonCountsByType(familyId)
      .then((m) => setEndingCountsByType(m))
      .catch((err) => console.error('ending counts failed:', err))
    SupabaseService.getProductTypeTranslations()
      .then((t) => setTypeTranslations(t))
      .catch((err) => console.error('translations failed:', err))
    SupabaseService.getProductImageMap(familyId)
      .then((m) => setProductImages(m))
      .catch((err) => console.error('product images failed:', err))
  }, [familyId])

  const [sheet, setSheet] = useState<
    | { kind: 'product'; product: ProcessedProduct }
    | { kind: 'receipt'; receipt: Receipt }
    | null
  >(null)

  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [receiptsMonthFilter, setReceiptsMonthFilter] = useState<string | null>(null)

  const processedProducts: ProcessedProduct[] = useMemo(
    () =>
      products.map((product) => ({
        id: product.id,
        name: product.name,
        nameRu: product.name_ru ?? null,
        originalName: product.original_name,
        product_type: product.product_type,
        lastPurchase: product.last_purchase,
        avgDays: product.avg_days,
        predictedEnd: product.predicted_end,
        status: product.status as DbStatus,
        purchaseCount: product.purchase_count,
        likeStatus: product.like_status ?? null,
        imageUrl: productImages.get(product.id) ?? null,
      })),
    [products, productImages],
  )

  const endingCount = useMemo(
    () => Object.values(typeStats).filter((s) => s.status === 'ending-soon').length,
    [typeStats],
  )

  const availableTypes = useMemo(() => {
    const set = new Set<string>()
    for (const p of processedProducts) {
      if (p.status !== 'ending-soon' && p.product_type) set.add(p.product_type)
    }
    return set
  }, [processedProducts])

  const lastSyncHours = useMemo(() => {
    if (receipts.length === 0) return null
    const newest = receipts.reduce((acc, r) => (new Date(r.date) > new Date(acc.date) ? r : acc), receipts[0])
    const diffMs = Date.now() - new Date(newest.date).getTime()
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)))
  }, [receipts])

  const openTypeOnProducts = (type: string) => {
    setTypeFilter(type)
    setTab('products')
  }

  const openMonthOnAccount = (monthKey: string) => {
    setReceiptsMonthFilter(monthKey)
    setTab('account')
  }

  const openProduct = (p: ProcessedProduct) => setSheet({ kind: 'product', product: p })
  const openReceipt = (r: Receipt) => setSheet({ kind: 'receipt', receipt: r })

  const handleSetLikeStatus = async (id: number, next: -1 | 1 | null) => {
    try {
      await SupabaseService.setLikeStatus(id, next)
      await mutateProduct(id, { like_status: next })
    } catch (err) {
      console.error('setLikeStatus failed:', err)
    }
  }

  const handleProductSaved = async () => {
    await refetchProducts()
    if (familyId) {
      SupabaseService.getProductTypeStats(familyId).then(setTypeStats).catch(() => {})
      SupabaseService.getEndingSoonCountsByType(familyId).then(setEndingCountsByType).catch(() => {})
    }
  }

  const handleMarkTypeBought = async (type: string) => {
    if (!familyId) return
    setTypeFilter(null)
    void (async () => {
      try {
        const n = await SupabaseService.addVirtualPurchaseForType(type, familyId)
        if (n === 0) {
          alert(lang === 'pt' ? 'Sem produtos deste tipo.' : 'Нет продуктов этого типа.')
          return
        }
        await new Promise((r) => setTimeout(r, 400))
        await SupabaseService.recalculateProductTypeStats(familyId)
        // SQL-функция calculate_product_type_status учитывает только реальные покупки
        // (quantity > 0) и не сдвигает статус типа после виртуальной покупки.
        // Форсированно ставим кэш типа в 'ok', пока пользователь не купит реально.
        await SupabaseService.markTypeStatsOk(familyId, type)
        const [fresh, freshEnding] = await Promise.all([
          SupabaseService.getProductTypeStats(familyId),
          SupabaseService.getEndingSoonCountsByType(familyId),
          refetchProducts(),
        ])
        setTypeStats(fresh)
        setEndingCountsByType(freshEnding)
      } catch (err) {
        console.error('mark bought failed:', err)
        alert(lang === 'pt' ? 'Não foi possível guardar.' : 'Не удалось сохранить.')
      }
    })()
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-page)' }}>
        <span style={{ font: 'var(--type-body-sm)', color: 'var(--text-tertiary)' }}>…</span>
      </div>
    )
  }

  if (!user) return <LoginPage />

  if (!profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-page)', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <span style={{ font: 'var(--type-body-sm)', color: 'var(--text-tertiary)' }}>
          {lang === 'pt' ? 'A preparar a tua conta…' : 'Готовим твой аккаунт…'}
        </span>
      </div>
    )
  }

  const titles = lang === 'pt'
    ? { home: 'Início', products: 'Produtos', recipes: 'Receitas', account: 'Conta', productsCount: (n: number) => `${n} produtos` }
    : { home: 'Дом', products: 'Продукты', recipes: 'Рецепты', account: 'Аккаунт', productsCount: (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'продукт' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'продукта' : 'продуктов'}` }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--surface-page)' }}>
      <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {tab === 'home' && (
          <>
            <AppHeader title={titles.home} subtitle={formatUpdated(lastSyncHours, lang)} />
            <HomePage
              productTypeStats={typeStats}
              endingCountsByType={endingCountsByType}
              typeTranslations={typeTranslations}
              receipts={receipts}
              monthlyStats={monthlyStats}
              activeMonthKey={receiptsMonthFilter}
              offline={!online}
              onRetry={() => window.location.reload()}
              onOpenType={openTypeOnProducts}
              onOpenMonth={openMonthOnAccount}
            />
          </>
        )}
        {tab === 'products' && (
          <>
            <AppHeader title={titles.products} subtitle={processedProducts.length > 0 ? titles.productsCount(processedProducts.length) : undefined} />
            <ProductsPage
              products={processedProducts}
              loading={productsLoading}
              typeTranslations={typeTranslations}
              filterType={typeFilter}
              onMarkTypeBought={handleMarkTypeBought}
              onClearTypeFilter={() => setTypeFilter(null)}
              onOpenProduct={openProduct}
              onSetLikeStatus={handleSetLikeStatus}
            />
          </>
        )}
        {tab === 'recipes' && (
          <>
            <AppHeader title={titles.recipes} />
            <RecipesPage availableTypes={availableTypes} />
          </>
        )}
        {tab === 'account' && (
          <AccountPage
            receipts={receipts}
            monthlyStats={monthlyStats}
            monthFilter={receiptsMonthFilter}
            onSetMonthFilter={setReceiptsMonthFilter}
            familyId={familyId}
            onOpenReceipt={openReceipt}
          />
        )}
      </div>

      <TabBar
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        items={[
          { value: 'home', label: titles.home, badge: endingCount || undefined },
          { value: 'products', label: titles.products },
          { value: 'recipes', label: titles.recipes },
          { value: 'account', label: titles.account },
        ]}
      />

      {sheet?.kind === 'product' && (
        <ProductSheet
          product={sheet.product}
          familyId={familyId}
          typeTranslations={typeTranslations}
          onClose={() => setSheet(null)}
          onSaved={async (updates) => {
            await mutateProduct(sheet.product.id, updates as any)
            handleProductSaved()
          }}
        />
      )}
      {sheet?.kind === 'receipt' && (
        <ReceiptSheet
          receipt={sheet.receipt}
          familyId={familyId}
          onClose={() => setSheet(null)}
          onSetLikeStatus={handleSetLikeStatus}
        />
      )}
    </div>
  )
}

export default GroceryTrackerApp
