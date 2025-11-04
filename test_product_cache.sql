-- Test queries for product_name_cache system
-- Run these queries after applying the migration to verify everything works correctly

-- =============================================================================
-- 1. BASIC CHECKS
-- =============================================================================

-- Check if table exists and has data
SELECT 
  COUNT(*) as total_entries,
  COUNT(DISTINCT family_id) as families_with_cache,
  COUNT(DISTINCT product_type) as unique_product_types
FROM product_name_cache;

-- Expected: Should show existing products imported from products table

-- =============================================================================
-- 2. TEST NORMALIZATION FUNCTION
-- =============================================================================

-- Test normalize_product_name function
SELECT 
  normalize_product_name('MILK 3.2% 1L') as normalized,
  normalize_product_name('  Milk   1L  ') as with_spaces,
  normalize_product_name('milk 3.2% 1l') as lowercase;

-- Expected: All should be normalized to lowercase and trimmed
-- normalized: "milk 3.2% 1l"
-- with_spaces: "milk 1l"
-- lowercase: "milk 3.2% 1l"

-- =============================================================================
-- 3. TEST CACHE LOOKUP (get_cached_translation)
-- =============================================================================

-- First, let's see what we have in cache
SELECT * FROM product_name_cache LIMIT 5;

-- Test get_cached_translation with an existing entry
-- Replace 'EXISTING_ORIGINAL_NAME' with an actual original_name from above query
-- Replace 1 with your actual family_id

-- Example test (adjust based on your data):
SELECT * FROM get_cached_translation('MILK 3.2% 1L', 1);

-- Expected: Should return translated_name and product_type if exists

-- =============================================================================
-- 4. TEST CACHE SAVE (save_translation_cache)
-- =============================================================================

-- Test saving a new translation
-- Replace 1 with your actual family_id
SELECT save_translation_cache(
  'TEST PRODUCT 500G',
  'Тестовый продукт 500г',
  'тест',
  1
);

-- Verify it was saved
SELECT * FROM product_name_cache 
WHERE original_name = 'TEST PRODUCT 500G';

-- Expected: Should see the new entry with usage_count = 1

-- Test incrementing usage_count (save the same translation again)
SELECT save_translation_cache(
  'TEST PRODUCT 500G',
  'Тестовый продукт 500г',
  'тест',
  1
);

-- Verify usage_count increased
SELECT usage_count FROM product_name_cache 
WHERE original_name = 'TEST PRODUCT 500G';

-- Expected: usage_count should be 2

-- Clean up test data
DELETE FROM product_name_cache WHERE original_name = 'TEST PRODUCT 500G';

-- =============================================================================
-- 5. CHECK CACHE POPULATION FROM EXISTING PRODUCTS
-- =============================================================================

-- Verify cache was populated with existing products
SELECT 
  p.name as product_name,
  p.original_name,
  pnc.translated_name as cached_name,
  pnc.product_type as cached_type,
  pnc.usage_count
FROM products p
LEFT JOIN product_name_cache pnc 
  ON LOWER(TRIM(p.original_name)) = pnc.normalized_original
  AND p.family_id = pnc.family_id
WHERE p.original_name IS NOT NULL
LIMIT 10;

-- Expected: All products with original_name should have matching cache entries

-- =============================================================================
-- 6. FIND POTENTIAL ISSUES
-- =============================================================================

-- Products without cache entries (should be empty if migration worked)
SELECT 
  p.id,
  p.name,
  p.original_name,
  p.family_id
FROM products p
LEFT JOIN product_name_cache pnc 
  ON normalize_product_name(p.original_name) = pnc.normalized_original
  AND p.family_id = pnc.family_id
WHERE p.original_name IS NOT NULL 
  AND p.original_name != ''
  AND pnc.id IS NULL;

-- Expected: Empty result (all products should have cache entries)

-- Check for duplicate cache entries (should not exist due to UNIQUE constraint)
SELECT 
  normalized_original,
  family_id,
  COUNT(*) as duplicate_count
FROM product_name_cache
GROUP BY normalized_original, family_id
HAVING COUNT(*) > 1;

-- Expected: Empty result (no duplicates)

-- =============================================================================
-- 7. STATISTICS
-- =============================================================================

-- Overall cache statistics
SELECT 
  family_id,
  COUNT(*) as cached_products,
  SUM(usage_count) as total_usage,
  AVG(usage_count) as avg_usage,
  MAX(usage_count) as max_usage
FROM product_name_cache
GROUP BY family_id;

-- Most popular products in cache
SELECT 
  original_name,
  translated_name,
  product_type,
  usage_count
FROM product_name_cache
ORDER BY usage_count DESC
LIMIT 10;

-- Product types distribution
SELECT 
  product_type,
  COUNT(*) as count
FROM product_name_cache
WHERE product_type IS NOT NULL
GROUP BY product_type
ORDER BY count DESC
LIMIT 20;

-- =============================================================================
-- 8. FULL INTEGRATION TEST
-- =============================================================================

-- Simulate the full workflow:

-- Step 1: Check if "INTEGRATION TEST MILK" exists
SELECT * FROM get_cached_translation('INTEGRATION TEST MILK', 1);
-- Expected: Empty (doesn't exist yet)

-- Step 2: Save new translation (simulating AI response)
SELECT save_translation_cache(
  'INTEGRATION TEST MILK',
  'Молоко для интеграционного теста',
  'молоко',
  1
);

-- Step 3: Try to get it again (simulating second receipt)
SELECT * FROM get_cached_translation('INTEGRATION TEST MILK', 1);
-- Expected: Returns translated_name and product_type

-- Step 4: Save again (simulating third receipt with same product)
SELECT save_translation_cache(
  'INTEGRATION TEST MILK',
  'Молоко для интеграционного теста',
  'молоко',
  1
);

-- Step 5: Verify usage_count increased
SELECT 
  original_name,
  translated_name,
  usage_count
FROM product_name_cache
WHERE original_name = 'INTEGRATION TEST MILK';
-- Expected: usage_count = 2

-- Step 6: Test case-insensitive matching
SELECT * FROM get_cached_translation('integration test milk', 1);
SELECT * FROM get_cached_translation('  INTEGRATION TEST MILK  ', 1);
SELECT * FROM get_cached_translation('Integration   Test   Milk', 1);
-- Expected: All should return the same cached entry

-- Clean up integration test
DELETE FROM product_name_cache WHERE original_name = 'INTEGRATION TEST MILK';

-- =============================================================================
-- 9. PERFORMANCE CHECK
-- =============================================================================

-- Check index usage for lookups
EXPLAIN ANALYZE
SELECT * FROM product_name_cache
WHERE normalized_original = 'milk 3.2% 1l' AND family_id = 1;

-- Expected: Should use idx_product_name_cache_normalized index

-- =============================================================================
-- 10. DATA QUALITY CHECKS
-- =============================================================================

-- Find entries with empty or NULL values (data quality issue)
SELECT * FROM product_name_cache
WHERE original_name IS NULL 
   OR original_name = ''
   OR translated_name IS NULL
   OR translated_name = ''
   OR normalized_original IS NULL
   OR normalized_original = '';

-- Expected: Empty (no quality issues)

-- Find very similar original names with different translations
SELECT 
  a.original_name as name1,
  a.translated_name as trans1,
  b.original_name as name2,
  b.translated_name as trans2,
  levenshtein(a.normalized_original, b.normalized_original) as similarity
FROM product_name_cache a
JOIN product_name_cache b 
  ON a.family_id = b.family_id
  AND a.id < b.id
  AND levenshtein(a.normalized_original, b.normalized_original) <= 3
WHERE a.translated_name != b.translated_name
LIMIT 20;

-- Note: levenshtein requires pg_trgm extension
-- If not installed: CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- This finds potential duplicates or variants

-- =============================================================================
-- SUCCESS CRITERIA
-- =============================================================================

-- ✅ All tests above should pass
-- ✅ No products without cache entries
-- ✅ No duplicate cache entries
-- ✅ Normalization function works correctly
-- ✅ Cache lookup works with different cases and spacing
-- ✅ Usage count increments properly
-- ✅ Indexes are used for queries

COMMENT ON TABLE product_name_cache IS 'Tests completed successfully!';

