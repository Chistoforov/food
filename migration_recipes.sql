-- ============================================================================
-- Migration: Recipes (Pingo Doce receitas)
-- Дата: 2026-08-18
-- Контекст: план /Users/d.chistoforov/.claude/plans/curious-pondering-hammock.md
--
-- Что делает:
--   1. Таблица `recipes` — глобальный каталог рецептов с pingodoce.pt/receitas/
--   2. Таблица `recipe_ingredients` — ингредиенты рецептов, с product_type для
--      матчинга на «что есть дома» (product_type_stats).
--
-- Обе таблицы глобальные (без family_id): рецепты одни на всех пользователей,
-- матчинг с продуктами конкретной семьи вычисляется на клиенте.
--
-- Идемпотентно (IF NOT EXISTS): можно накатить несколько раз.
-- ============================================================================

-- pg_trgm расширение уже включено migration_pd_pivot.sql — здесь только используем.

-- ============================================================================
-- 1. Рецепты
-- ============================================================================

CREATE TABLE IF NOT EXISTS recipes (
  id           SERIAL PRIMARY KEY,
  external_id  TEXT UNIQUE NOT NULL,      -- slug из URL, напр. "overnight-oats-de-banana"
  url          TEXT NOT NULL,             -- канонический URL на pingodoce.pt
  name_pt      TEXT NOT NULL,             -- название с сайта
  name_ru      TEXT,                      -- перевод через Haiku
  image_url    TEXT,                      -- внешний URL (как в catalog_products)
  category     TEXT,                      -- recipeCategory из JSON-LD (Sopas, Massas, ...)
  sitemap_lastmod TIMESTAMPTZ,            -- <lastmod> из sitemap — для инкрементального синка
  scraped_at   TIMESTAMPTZ,               -- когда последний раз тянули детальную страницу
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipes_name_pt_trgm ON recipes USING gin (name_pt gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_scraped_at ON recipes(scraped_at);
CREATE INDEX IF NOT EXISTS idx_recipes_sitemap_lastmod ON recipes(sitemap_lastmod);

DROP TRIGGER IF EXISTS update_recipes_updated_at ON recipes;
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. Ингредиенты рецептов
-- ============================================================================

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id             SERIAL PRIMARY KEY,
  recipe_id      INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL,        -- порядок внутри рецепта (0-based)
  raw_text       TEXT NOT NULL,           -- "2 c. de sopa azeite virgem extra"
  name_pt        TEXT NOT NULL,           -- "azeite virgem extra" (после парсинга)
  name_ru        TEXT,                    -- "оливковое масло" (через Haiku)
  quantity_text  TEXT,                    -- "2 c. de sopa" (не нормализуем)
  product_type   TEXT,                    -- ключ product_type_stats.product_type, nullable
  UNIQUE (recipe_id, position)
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_type ON recipe_ingredients(product_type);

-- ============================================================================
-- 3. RLS (как у catalog_products — global-read для authenticated, writes через
-- service-role в скраперах)
-- ============================================================================

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recipes readable by authenticated" ON recipes;
CREATE POLICY "recipes readable by authenticated" ON recipes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "recipe_ingredients readable by authenticated" ON recipe_ingredients;
CREATE POLICY "recipe_ingredients readable by authenticated" ON recipe_ingredients
  FOR SELECT TO authenticated USING (true);
