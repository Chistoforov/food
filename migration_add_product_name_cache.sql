-- Migration: Add product name cache table
-- Purpose: Cache translations of original product names to ensure consistency
-- When the same original name appears in different receipts, we use the cached translation

-- Table to store cached translations of product names
CREATE TABLE IF NOT EXISTS product_name_cache (
  id SERIAL PRIMARY KEY,
  original_name VARCHAR(500) NOT NULL,           -- Original name from receipt (as is)
  normalized_original VARCHAR(500) NOT NULL,     -- Normalized version for matching (lowercase, trimmed)
  translated_name VARCHAR(255) NOT NULL,         -- Russian translated name
  product_type VARCHAR(255),                     -- Product type/category
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,  -- Cache per family
  usage_count INTEGER DEFAULT 1,                 -- How many times this translation was used
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: one cache entry per normalized name per family
  UNIQUE(normalized_original, family_id)
);

-- Index for fast lookups
CREATE INDEX idx_product_name_cache_normalized ON product_name_cache(normalized_original, family_id);
CREATE INDEX idx_product_name_cache_family ON product_name_cache(family_id);

-- Trigger for automatic updated_at
CREATE TRIGGER update_product_name_cache_updated_at 
  BEFORE UPDATE ON product_name_cache
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Function to normalize product name for matching
-- Converts to lowercase, removes extra spaces, removes special characters
CREATE OR REPLACE FUNCTION normalize_product_name(input_name VARCHAR)
RETURNS VARCHAR AS $$
BEGIN
  -- Convert to lowercase, trim, and normalize spaces
  RETURN LOWER(TRIM(REGEXP_REPLACE(input_name, '\s+', ' ', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to get cached translation or NULL if not found
CREATE OR REPLACE FUNCTION get_cached_translation(
  p_original_name VARCHAR,
  p_family_id INTEGER
)
RETURNS TABLE (
  translated_name VARCHAR,
  product_type VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pnc.translated_name,
    pnc.product_type
  FROM product_name_cache pnc
  WHERE pnc.normalized_original = normalize_product_name(p_original_name)
    AND pnc.family_id = p_family_id
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to save translation to cache
CREATE OR REPLACE FUNCTION save_translation_cache(
  p_original_name VARCHAR,
  p_translated_name VARCHAR,
  p_product_type VARCHAR,
  p_family_id INTEGER
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO product_name_cache (
    original_name,
    normalized_original,
    translated_name,
    product_type,
    family_id,
    usage_count
  )
  VALUES (
    p_original_name,
    normalize_product_name(p_original_name),
    p_translated_name,
    p_product_type,
    p_family_id,
    1
  )
  ON CONFLICT (normalized_original, family_id) 
  DO UPDATE SET
    usage_count = product_name_cache.usage_count + 1,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Populate cache with existing products
-- This will create cache entries from all existing products
INSERT INTO product_name_cache (
  original_name,
  normalized_original,
  translated_name,
  product_type,
  family_id,
  usage_count
)
SELECT DISTINCT ON (normalize_product_name(original_name), family_id)
  original_name,
  normalize_product_name(original_name),
  name,
  product_type,
  family_id,
  purchase_count
FROM products
WHERE original_name IS NOT NULL 
  AND original_name != ''
ORDER BY normalize_product_name(original_name), family_id, updated_at DESC;

COMMENT ON TABLE product_name_cache IS 'Кэш переводов названий продуктов для обеспечения консистентности между чеками';
COMMENT ON COLUMN product_name_cache.original_name IS 'Оригинальное название с чека (как есть)';
COMMENT ON COLUMN product_name_cache.normalized_original IS 'Нормализованная версия для сопоставления (lowercase, trimmed)';
COMMENT ON COLUMN product_name_cache.translated_name IS 'Русское переведенное название';
COMMENT ON COLUMN product_name_cache.product_type IS 'Тип/категория продукта для группировки';
COMMENT ON COLUMN product_name_cache.usage_count IS 'Сколько раз этот перевод был использован';

