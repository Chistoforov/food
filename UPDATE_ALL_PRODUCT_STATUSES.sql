-- ============================================================================
-- UPDATE ALL PRODUCT STATUSES FOR ALL FAMILIES
-- This script:
-- 1. Recalculates product_type_stats cache for all families
-- 2. Updates status for ALL products based on the cache
-- ============================================================================

-- Step 1: Recalculate cache for all families
DO $$
DECLARE
  v_family_record RECORD;
BEGIN
  RAISE NOTICE 'Recalculating product_type_stats cache for all families...';
  
  FOR v_family_record IN
    SELECT DISTINCT family_id FROM products
  LOOP
    PERFORM recalculate_product_type_stats(v_family_record.family_id);
    RAISE NOTICE 'Recalculated cache for family_id=%', v_family_record.family_id;
  END LOOP;
  
  RAISE NOTICE 'Cache recalculation complete!';
  RAISE NOTICE '';
END $$;

-- Step 2: Update ALL product statuses based on cache
DO $$
DECLARE
  v_total_updated INTEGER := 0;
  v_updated_count INTEGER := 0;
  v_type_record RECORD;
BEGIN
  RAISE NOTICE 'Updating product statuses...';
  RAISE NOTICE '';
  
  FOR v_type_record IN
    SELECT family_id, product_type, status
    FROM product_type_stats
    ORDER BY family_id, product_type
  LOOP
    UPDATE products
    SET status = v_type_record.status,
        updated_at = NOW()
    WHERE family_id = v_type_record.family_id
      AND product_type = v_type_record.product_type
      AND status != v_type_record.status;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    IF v_updated_count > 0 THEN
      RAISE NOTICE 'Family % | Type "%" → status "%" | Updated % products', 
        v_type_record.family_id, v_type_record.product_type, 
        v_type_record.status, v_updated_count;
      v_total_updated := v_total_updated + v_updated_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Total products updated: %', v_total_updated;
END $$;

-- Step 3: Verify results for your family
SELECT 
  p.product_type,
  p.status AS product_status,
  pts.status AS cache_status,
  COUNT(*) AS product_count,
  MAX(p.last_purchase) AS most_recent_purchase,
  CURRENT_DATE - MAX(p.last_purchase) AS days_since_last
FROM products p
LEFT JOIN product_type_stats pts 
  ON p.family_id = pts.family_id AND p.product_type = pts.product_type
WHERE p.family_id = 1
  AND p.product_type IS NOT NULL
  AND p.product_type != ''
GROUP BY p.product_type, p.status, pts.status
ORDER BY most_recent_purchase DESC NULLS LAST;

