-- ============================================================================
-- TEST: Check if the improved trigger is working
-- ============================================================================

-- Step 1: Check current status of products
SELECT 
  '=== BEFORE UPDATE ===' AS info,
  name, product_type, status, last_purchase
FROM products
WHERE family_id = 1 AND product_type IN ('сок', 'йогурт')
ORDER BY name;

-- Step 2: Simulate a product update (this will trigger the function)
-- This just updates the updated_at timestamp, triggering the recalculation
UPDATE products
SET updated_at = NOW()
WHERE id = (
  SELECT id FROM products
  WHERE family_id = 1 
    AND product_type = 'сок'
    AND name LIKE '%апельсиновый%'
  LIMIT 1
);

-- Step 3: Check status after update (should still be correct)
SELECT 
  '=== AFTER UPDATE ===' AS info,
  name, product_type, status, last_purchase,
  CURRENT_DATE - last_purchase AS days_ago
FROM products
WHERE family_id = 1 AND product_type IN ('сок', 'йогурт')
ORDER BY name;

-- Step 4: Verify trigger exists and is active
SELECT 
  '=== TRIGGER STATUS ===' AS info,
  tgname AS trigger_name,
  tgrelid::regclass::text AS table_name,
  tgfoid::regproc::text AS function_name,
  tgenabled AS is_enabled
FROM pg_trigger
WHERE tgname = 'trigger_product_type_stats_on_product_change';

-- Summary
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ If you see status="ok" for products purchased today, everything works!';
  RAISE NOTICE '✅ The trigger will automatically update statuses when you add receipts.';
  RAISE NOTICE '';
  RAISE NOTICE 'CRON is NOT needed if you add receipts regularly (every 2-5 days).';
  RAISE NOTICE '';
END $$;

