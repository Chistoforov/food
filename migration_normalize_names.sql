-- ============================================================================
-- Migration: normalize_pd_name + materialized normalized_name columns
-- Дата: 2026-08-08
-- Цель: улучшить fuzzy match raw name с чека → catalog_products.name.
-- Без normalize match rate = 79%; с normalize = 87%.
--
-- Что делает:
--   1. Функция normalize_pd_name(text): убирает PD-shorthand (CCP, CPG10, ...),
--      вес/размер (500G, 125GR, 1L, 75CL), диапазоны (25-35mm), punctuation,
--      разворачивает аббревиатуры (QJ→queijo, V.→vinho, FLC→flocos, INT→integral).
--   2. Колонка normalized_name на products и catalog_products с trigger'ом
--      автоматического обновления при INSERT/UPDATE name.
--   3. GIN pg_trgm индекс на catalog_products.normalized_name — для быстрых
--      similarity-запросов при матчинге.
--
-- Применение (через mcp__supabase__apply_migration с name = 'add_normalized_name_columns'):
--   уже применено 2026-08-08.
-- ============================================================================

CREATE OR REPLACE FUNCTION normalize_pd_name(s TEXT) RETURNS TEXT AS $$
DECLARE r TEXT;
BEGIN
  IF s IS NULL THEN RETURN NULL; END IF;
  r := LOWER(s);
  r := REGEXP_REPLACE(r, '\yqj\.?\y|\yqjo\y', 'queijo', 'gi');
  r := REGEXP_REPLACE(r, '\yv\.\y', 'vinho', 'gi');
  r := REGEXP_REPLACE(r, '\yflc\y', 'flocos', 'gi');
  r := REGEXP_REPLACE(r, '\yint\y', 'integral', 'gi');
  r := REGEXP_REPLACE(r, '\yemb\.?\y', 'embalado', 'gi');
  r := REGEXP_REPLACE(r, '\ybov\.?\y', 'bovino', 'gi');
  r := REGEXP_REPLACE(r, '(\d+([,.]\d+)?)(kg|gr|g|cl|ml|l|un|mm|cm)([a-z])', '\1\3 \4', 'gi');
  r := REGEXP_REPLACE(r, '\y(ccp|ccg|cpp\d*|cpg\d*|sdr|sk|cc|pd|cv)\y', ' ', 'gi');
  r := REGEXP_REPLACE(r, '\d+([,.]\d+)?\s*(kg|gr|g|cl|ml|l|un|m|mm|cm|x|t|dg)\y', ' ', 'gi');
  r := REGEXP_REPLACE(r, '\d+-\d+\s*(mm|cm|kg|g)?', ' ', 'gi');
  r := REGEXP_REPLACE(r, '\y\d+([,.]\d+)?x?\y', ' ', 'g');
  r := REGEXP_REPLACE(r, '[''`\.\/\\\-\%\(\)]', ' ', 'g');
  r := REGEXP_REPLACE(r, '\s+', ' ', 'g');
  RETURN TRIM(r);
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

ALTER TABLE catalog_products ADD COLUMN IF NOT EXISTS normalized_name TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS normalized_name TEXT;

UPDATE catalog_products SET normalized_name = normalize_pd_name(name);
UPDATE products SET normalized_name = normalize_pd_name(name);

CREATE INDEX IF NOT EXISTS idx_catalog_products_normalized_trgm
  ON catalog_products USING gin (normalized_name gin_trgm_ops);

CREATE OR REPLACE FUNCTION trigger_set_normalized_name() RETURNS TRIGGER AS $$
BEGIN
  NEW.normalized_name := normalize_pd_name(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS set_normalized_name_catalog ON catalog_products;
CREATE TRIGGER set_normalized_name_catalog
  BEFORE INSERT OR UPDATE OF name ON catalog_products
  FOR EACH ROW EXECUTE FUNCTION trigger_set_normalized_name();

DROP TRIGGER IF EXISTS set_normalized_name_products ON products;
CREATE TRIGGER set_normalized_name_products
  BEFORE INSERT OR UPDATE OF name ON products
  FOR EACH ROW EXECUTE FUNCTION trigger_set_normalized_name();

-- ============================================================================
-- Backfill product_history.catalog_product_id + products.product_type
-- ============================================================================

-- Ниже — SQL для backfill, применялся один раз 2026-08-08.
-- Для повторного применения (например после catalog-sync добавил новые продукты):
-- сначала запустить, потом посмотреть matched vs total, скорректировать threshold.
--
-- BEGIN;
--   CREATE TEMP TABLE tmp_matches AS
--   SELECT DISTINCT ON (p.id)
--     p.id AS product_id, cp.id AS catalog_product_id, cp.category2, cp.s AS sim
--   FROM products p
--   CROSS JOIN LATERAL (
--     SELECT id, category2, similarity(normalized_name, p.normalized_name) AS s
--     FROM catalog_products
--     WHERE normalized_name % p.normalized_name
--       AND similarity(normalized_name, p.normalized_name) > 0.35
--     ORDER BY s DESC LIMIT 1
--   ) cp
--   WHERE p.family_id = 1;
--
--   UPDATE product_history ph SET catalog_product_id = m.catalog_product_id
--     FROM tmp_matches m WHERE ph.product_id = m.product_id;
--   UPDATE products p SET product_type = m.category2
--     FROM tmp_matches m WHERE p.id = m.product_id AND m.category2 IS NOT NULL;
-- COMMIT;
