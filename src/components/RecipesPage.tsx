import { useEffect, useMemo, useState } from 'react'
import { Card, SearchField, FilterChip, RecipeRow, EmptyState, Button, type MatchTier } from './ds'
import { useLanguage } from '../contexts/LanguageContext'
import { SupabaseService } from '../services/supabaseService'
import type { Recipe, RecipeIngredient } from '../lib/supabase'
import RecipeSheet from './RecipeSheet'

interface RecipesPageProps {
  availableTypes: Set<string>
}

const PAGE_SIZE = 20
const TIER_PRIORITY: Record<MatchTier, number> = { complete: 0, missing_one: 1, missing_many: 2 }

const RecipesPage: React.FC<RecipesPageProps> = ({ availableTypes }) => {
  const { language } = useLanguage()
  const lang: 'ru' | 'pt' = language
  const [q, setQ] = useState('')
  const [tierFilter, setTierFilter] = useState<'all' | MatchTier>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(true)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [ingredientsByRecipe, setIngredientsByRecipe] = useState<Map<number, RecipeIngredient[]>>(new Map())
  const [openId, setOpenId] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        const recs = await SupabaseService.getRecipes()
        if (cancelled) return
        setRecipes(recs)
        if (recs.length === 0) {
          setIngredientsByRecipe(new Map())
          return
        }
        const ings = await SupabaseService.getRecipeIngredients(recs.map((r) => r.id))
        if (cancelled) return
        const map = new Map<number, RecipeIngredient[]>()
        for (const ing of ings) {
          const list = map.get(ing.recipe_id) ?? []
          list.push(ing)
          map.set(ing.recipe_id, list)
        }
        setIngredientsByRecipe(map)
      } catch (err) {
        console.error('recipes fetch failed:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [q, tierFilter])

  const t = lang === 'pt'
    ? {
        search: 'Encontrar receita', clear: 'Limpar',
        all: 'Todas', complete: 'Tudo em casa', missing_one: 'Falta 1', missing_many: 'Faltam 2+',
        emptyTitle: 'Sem receitas', emptyDesc: 'A base de receitas ainda está a ser preenchida.',
        noMatchTitle: 'Nada encontrado', noMatchDesc: 'Tenta outro nome ou remove o filtro.',
        loadMore: 'Mostrar mais', loading: 'A carregar…',
      }
    : {
        search: 'Найти рецепт', clear: 'Сброс',
        all: 'Все', complete: 'Всё есть', missing_one: 'Не хватает 1', missing_many: 'Не хватает 2+',
        emptyTitle: 'Пока нет рецептов', emptyDesc: 'База рецептов ещё заполняется.',
        noMatchTitle: 'Ничего не найдено', noMatchDesc: 'Попробуй другое название или сними фильтр.',
        loadMore: 'Показать ещё', loading: 'Загрузка…',
      }

  // Вычисляем tier для каждого рецепта.
  type Ranked = { recipe: Recipe; ingredients: RecipeIngredient[]; matched: number; total: number; tier: MatchTier }
  const ranked: Ranked[] = useMemo(() => {
    return recipes.map((r) => {
      const ings = ingredientsByRecipe.get(r.id) ?? []
      const total = ings.length
      const matched = ings.reduce((n, ing) => {
        if (ing.product_type && availableTypes.has(ing.product_type)) return n + 1
        return n
      }, 0)
      const missing = total - matched
      const tier: MatchTier = missing === 0 && total > 0 ? 'complete' : missing === 1 ? 'missing_one' : 'missing_many'
      return { recipe: r, ingredients: ings, matched, total, tier }
    })
  }, [recipes, ingredientsByRecipe, availableTypes])

  const counts = useMemo(() => {
    const c: Record<'all' | MatchTier, number> = { all: ranked.length, complete: 0, missing_one: 0, missing_many: 0 }
    for (const r of ranked) c[r.tier] += 1
    return c
  }, [ranked])

  const needle = q.trim().toLowerCase()
  const rows = ranked
    .filter((r) => {
      if (tierFilter !== 'all' && r.tier !== tierFilter) return false
      if (needle) {
        const hay = [r.recipe.name_pt, r.recipe.name_ru ?? '', r.recipe.category ?? ''].join(' ').toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
    .sort((a, b) => {
      const pa = TIER_PRIORITY[a.tier]
      const pb = TIER_PRIORITY[b.tier]
      if (pa !== pb) return pa - pb
      if (a.matched !== b.matched) return b.matched - a.matched
      const an = (lang === 'ru' ? a.recipe.name_ru || a.recipe.name_pt : a.recipe.name_pt).toLowerCase()
      const bn = (lang === 'ru' ? b.recipe.name_ru || b.recipe.name_pt : b.recipe.name_pt).toLowerCase()
      return an.localeCompare(bn)
    })

  const openRecipe = openId != null ? ranked.find((r) => r.recipe.id === openId) : null

  return (
    <div style={{ padding: '0 var(--gutter-mobile) var(--space-12)', maxWidth: 'var(--content-max)', margin: '0 auto' }}>
      <div style={{ paddingTop: 'var(--space-3)' }}>
        <SearchField value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ('')} placeholder={t.search} clearLabel={t.clear} />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-4)', overflowX: 'auto', padding: 'var(--space-6) 0' }}>
        <FilterChip selected={tierFilter === 'all'} count={counts.all} onClick={() => setTierFilter('all')}>{t.all}</FilterChip>
        <FilterChip selected={tierFilter === 'complete'} count={counts.complete} onClick={() => setTierFilter('complete')}>{t.complete}</FilterChip>
        <FilterChip selected={tierFilter === 'missing_one'} count={counts.missing_one} onClick={() => setTierFilter('missing_one')}>{t.missing_one}</FilterChip>
        <FilterChip selected={tierFilter === 'missing_many'} count={counts.missing_many} onClick={() => setTierFilter('missing_many')}>{t.missing_many}</FilterChip>
      </div>

      {loading && recipes.length === 0 ? (
        <Card><EmptyState title={t.loading} /></Card>
      ) : recipes.length === 0 ? (
        <Card><EmptyState title={t.emptyTitle} description={t.emptyDesc} /></Card>
      ) : rows.length === 0 ? (
        <Card><EmptyState title={t.noMatchTitle} description={t.noMatchDesc} /></Card>
      ) : (
        <Card padded={false}>
          {rows.slice(0, visibleCount).map((r, i) => (
            <RecipeRow
              key={r.recipe.id}
              first={i === 0}
              name={lang === 'ru' ? (r.recipe.name_ru || r.recipe.name_pt) : r.recipe.name_pt}
              category={r.recipe.category}
              imageUrl={r.recipe.image_url}
              matched={r.matched}
              total={r.total}
              tier={r.tier}
              lang={lang}
              onClick={() => setOpenId(r.recipe.id)}
            />
          ))}
        </Card>
      )}

      {!loading && rows.length > visibleCount && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-8)' }}>
          <Button onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>{t.loadMore}</Button>
        </div>
      )}

      {openRecipe && (
        <RecipeSheet
          recipe={openRecipe.recipe}
          ingredients={openRecipe.ingredients}
          availableTypes={availableTypes}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

export default RecipesPage
