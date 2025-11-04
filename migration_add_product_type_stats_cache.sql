-- Migration: Add product_type_stats table for caching product type statuses
-- This table will store pre-calculated statuses for each product type to avoid
-- expensive calculations on every page load

-- Create product_type_stats table
CREATE TABLE IF NOT EXISTS product_type_stats (
  id SERIAL PRIMARY KEY,
  family_id INTEGER NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  product_type VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('ending-soon', 'ok', 'calculating')),
  product_count INTEGER DEFAULT 0,
  last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(family_id, product_type)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_product_type_stats_family_id ON product_type_stats(family_id);
CREATE INDEX IF NOT EXISTS idx_product_type_stats_product_type ON product_type_stats(product_type);
CREATE INDEX IF NOT EXISTS idx_product_type_stats_status ON product_type_stats(status);

-- Trigger for updated_at
CREATE TRIGGER update_product_type_stats_updated_at 
  BEFORE UPDATE ON product_type_stats
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate status for a product type
-- This implements the "2-day rule" - products cannot show "ending-soon" within 2 days of purchase
CREATE OR REPLACE FUNCTION calculate_product_type_status(
  p_family_id INTEGER,
  p_product_type VARCHAR(255)
) RETURNS VARCHAR(20) AS $$
DECLARE
  v_status VARCHAR(20) := 'calculating';
  v_has_recent_purchase BOOLEAN := false;
  v_product_record RECORD;
  v_history_count INTEGER;
  v_avg_days DECIMAL;
  v_last_purchase_date DATE;
  v_predicted_end DATE;
  v_days_since_purchase INTEGER;
  v_days_until_end INTEGER;
  v_today DATE;
BEGIN
  v_today := CURRENT_DATE;
  
  -- Check if any product of this type was purchased recently (< 2 days ago)
  FOR v_product_record IN
    SELECT id, last_purchase
    FROM products
    WHERE family_id = p_family_id 
      AND product_type = p_product_type
      AND last_purchase IS NOT NULL
  LOOP
    v_days_since_purchase := v_today - v_product_record.last_purchase;
    
    IF v_days_since_purchase < 2 THEN
      v_has_recent_purchase := true;
      EXIT; -- Found a recent purchase, no need to check further
    END IF;
  END LOOP;
  
  -- If there's a recent purchase, status is always 'ok' (2-day rule)
  IF v_has_recent_purchase THEN
    RETURN 'ok';
  END IF;
  
  -- Get all products of this type
  SELECT COUNT(*) INTO v_history_count
  FROM product_history ph
  JOIN products p ON ph.product_id = p.id
  WHERE p.family_id = p_family_id 
    AND p.product_type = p_product_type;
  
  -- Need at least 2 purchases to calculate
  IF v_history_count < 2 THEN
    RETURN 'calculating';
  END IF;
  
  -- Calculate average days between purchases for this type
  WITH purchase_intervals AS (
    SELECT 
      date,
      LAG(date) OVER (ORDER BY date) AS prev_date
    FROM product_history ph
    JOIN products p ON ph.product_id = p.id
    WHERE p.family_id = p_family_id 
      AND p.product_type = p_product_type
  )
  SELECT AVG(date - prev_date)::DECIMAL
  INTO v_avg_days
  FROM purchase_intervals
  WHERE prev_date IS NOT NULL AND (date - prev_date) > 0;
  
  IF v_avg_days IS NULL THEN
    RETURN 'calculating';
  END IF;
  
  -- Find the most recent purchase of any product of this type
  SELECT MAX(last_purchase) INTO v_last_purchase_date
  FROM products
  WHERE family_id = p_family_id 
    AND product_type = p_product_type;
  
  IF v_last_purchase_date IS NULL THEN
    RETURN 'calculating';
  END IF;
  
  -- Calculate predicted end date
  v_predicted_end := v_last_purchase_date + v_avg_days::INTEGER;
  v_days_until_end := v_predicted_end - v_today;
  
  -- Determine status: ending-soon if <= 2 days until predicted end
  IF v_days_until_end <= 2 THEN
    RETURN 'ending-soon';
  ELSE
    RETURN 'ok';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate all product type stats for a family
CREATE OR REPLACE FUNCTION recalculate_product_type_stats(p_family_id INTEGER)
RETURNS VOID AS $$
DECLARE
  v_type_record RECORD;
  v_status VARCHAR(20);
  v_product_count INTEGER;
BEGIN
  -- Get all unique product types for this family
  FOR v_type_record IN
    SELECT DISTINCT product_type
    FROM products
    WHERE family_id = p_family_id 
      AND product_type IS NOT NULL
      AND product_type != ''
  LOOP
    -- Calculate status for this type
    v_status := calculate_product_type_status(p_family_id, v_type_record.product_type);
    
    -- Count products of this type
    SELECT COUNT(*) INTO v_product_count
    FROM products
    WHERE family_id = p_family_id 
      AND product_type = v_type_record.product_type;
    
    -- Upsert into product_type_stats
    INSERT INTO product_type_stats (family_id, product_type, status, product_count, last_calculated)
    VALUES (p_family_id, v_type_record.product_type, v_status, v_product_count, NOW())
    ON CONFLICT (family_id, product_type) 
    DO UPDATE SET 
      status = EXCLUDED.status,
      product_count = EXCLUDED.product_count,
      last_calculated = NOW(),
      updated_at = NOW();
  END LOOP;
  
  -- Remove product types that no longer exist
  DELETE FROM product_type_stats
  WHERE family_id = p_family_id
    AND product_type NOT IN (
      SELECT DISTINCT product_type
      FROM products
      WHERE family_id = p_family_id 
        AND product_type IS NOT NULL
        AND product_type != ''
    );
END;
$$ LANGUAGE plpgsql;

-- Trigger function to recalculate product type stats after product changes
CREATE OR REPLACE FUNCTION trigger_recalculate_product_type_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate stats for the affected product type(s)
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.product_type IS NOT NULL AND NEW.product_type != '' THEN
      PERFORM recalculate_product_type_stats(NEW.family_id);
    END IF;
  END IF;
  
  IF TG_OP = 'UPDATE' AND OLD.product_type IS DISTINCT FROM NEW.product_type THEN
    -- If product_type changed, recalculate for both old and new types
    IF OLD.product_type IS NOT NULL AND OLD.product_type != '' THEN
      PERFORM recalculate_product_type_stats(OLD.family_id);
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    IF OLD.product_type IS NOT NULL AND OLD.product_type != '' THEN
      PERFORM recalculate_product_type_stats(OLD.family_id);
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate product type stats when products are updated
CREATE TRIGGER trigger_product_type_stats_on_product_change
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_product_type_stats();

-- Trigger function to recalculate product type stats after receipt processing
CREATE OR REPLACE FUNCTION trigger_recalculate_product_type_stats_on_receipt()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate all product type stats for the family when a receipt is processed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status = 'processed') THEN
    PERFORM recalculate_product_type_stats(NEW.family_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate product type stats when receipts are processed
CREATE TRIGGER trigger_product_type_stats_on_receipt_processed
  AFTER INSERT OR UPDATE ON receipts
  FOR EACH ROW
  WHEN (NEW.status = 'processed')
  EXECUTE FUNCTION trigger_recalculate_product_type_stats_on_receipt();

-- Initial population: calculate stats for all existing families
DO $$
DECLARE
  v_family_record RECORD;
BEGIN
  FOR v_family_record IN
    SELECT id FROM families WHERE is_active = true
  LOOP
    PERFORM recalculate_product_type_stats(v_family_record.id);
  END LOOP;
END $$;

-- Add comment
COMMENT ON TABLE product_type_stats IS 'Cached statuses for product types to avoid expensive calculations on every page load. Updated automatically via triggers and cron jobs.';

