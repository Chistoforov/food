-- ============================================================================
-- IMPROVED TRIGGER: Auto-update product statuses
-- This trigger will:
-- 1. Recalculate product_type_stats cache (as before)
-- 2. UPDATE all products of that type with the new status (NEW!)
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_single_product_type_stats(
  p_family_id INTEGER,
  p_product_type VARCHAR(255)
)
RETURNS VOID AS $$
DECLARE
  v_status VARCHAR(20);
  v_product_count INTEGER;
  v_updated_count INTEGER;
BEGIN
  -- Skip if product_type is null or empty
  IF p_product_type IS NULL OR p_product_type = '' THEN
    RETURN;
  END IF;
  
  -- Calculate status for this type
  v_status := calculate_product_type_status(p_family_id, p_product_type);
  
  -- Count products of this type
  SELECT COUNT(*) INTO v_product_count
  FROM products
  WHERE family_id = p_family_id 
    AND product_type = p_product_type;
  
  -- If no products of this type exist, delete the cache entry
  IF v_product_count = 0 THEN
    DELETE FROM product_type_stats
    WHERE family_id = p_family_id
      AND product_type = p_product_type;
    RETURN;
  END IF;
  
  -- Upsert into product_type_stats
  INSERT INTO product_type_stats (family_id, product_type, status, product_count, last_calculated)
  VALUES (p_family_id, p_product_type, v_status, v_product_count, NOW())
  ON CONFLICT (family_id, product_type) 
  DO UPDATE SET 
    status = EXCLUDED.status,
    product_count = EXCLUDED.product_count,
    last_calculated = NOW(),
    updated_at = NOW();
  
  -- 🆕 NEW: Update all products of this type with the new status
  UPDATE products
  SET status = v_status,
      updated_at = NOW()
  WHERE family_id = p_family_id
    AND product_type = p_product_type
    AND status != v_status;  -- Only update if different
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  
  RAISE NOTICE 'Type "%" (family %): cache_status=%, products_updated=%', 
    p_product_type, p_family_id, v_status, v_updated_count;
END;
$$ LANGUAGE plpgsql;

-- The trigger function remains the same
CREATE OR REPLACE FUNCTION trigger_recalculate_product_type_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate stats for the affected product type(s)
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.product_type IS NOT NULL AND NEW.product_type != '' THEN
      PERFORM recalculate_single_product_type_stats(NEW.family_id, NEW.product_type);
    END IF;
  END IF;
  
  IF TG_OP = 'UPDATE' AND OLD.product_type IS DISTINCT FROM NEW.product_type THEN
    IF OLD.product_type IS NOT NULL AND OLD.product_type != '' THEN
      PERFORM recalculate_single_product_type_stats(OLD.family_id, OLD.product_type);
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    IF OLD.product_type IS NOT NULL AND OLD.product_type != '' THEN
      PERFORM recalculate_single_product_type_stats(OLD.family_id, OLD.product_type);
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify the trigger is working
SELECT 
  tgname AS trigger_name,
  tgrelid::regclass::text AS table_name,
  tgfoid::regproc::text AS function_name,
  tgenabled AS is_enabled
FROM pg_trigger
WHERE tgname = 'trigger_product_type_stats_on_product_change';

