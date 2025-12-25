-- ============================================================================
-- SQL FUNCTION FOR CRON JOB
-- This function can be called from API to update all product statuses
-- ============================================================================

CREATE OR REPLACE FUNCTION update_all_product_statuses()
RETURNS json AS $$
DECLARE
  v_family_record RECORD;
  v_type_record RECORD;
  v_total_updated INTEGER := 0;
  v_updated_count INTEGER := 0;
  v_families_count INTEGER := 0;
BEGIN
  -- Recalculate cache for all families
  FOR v_family_record IN
    SELECT DISTINCT family_id FROM products
  LOOP
    PERFORM recalculate_product_type_stats(v_family_record.family_id);
    v_families_count := v_families_count + 1;
  END LOOP;
  
  -- Update all product statuses based on cache
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
    v_total_updated := v_total_updated + v_updated_count;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'families_processed', v_families_count,
    'products_updated', v_total_updated,
    'timestamp', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION update_all_product_statuses() TO anon, authenticated;

-- Add comment
COMMENT ON FUNCTION update_all_product_statuses() IS 
'Updates product statuses for all families. 
Called by CRON job daily at 1:00 AM.
Returns JSON with statistics.';













