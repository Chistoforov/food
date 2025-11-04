-- ============================================================================
-- MANUAL STATUS UPDATE
-- Run this manually once a week (or whenever you want)
-- Takes 1-2 seconds to complete
-- ============================================================================

SELECT update_all_product_statuses();

-- View updated products
SELECT 
  product_type,
  status,
  COUNT(*) as count,
  MAX(last_purchase) as most_recent
FROM products
WHERE family_id = 1
GROUP BY product_type, status
ORDER BY most_recent DESC NULLS LAST;

