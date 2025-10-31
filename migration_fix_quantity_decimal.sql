-- Migration to fix quantity field type from INTEGER to DECIMAL
-- This fixes the "invalid input syntax for type integer: '0.14'" error
-- when processing receipts with fractional quantities

-- Update product_history table to support decimal quantities
ALTER TABLE product_history 
ALTER COLUMN quantity TYPE DECIMAL(10,3);

-- Update the comment to reflect the change
COMMENT ON COLUMN product_history.quantity IS 'Product quantity (supports decimal values like 0.14 kg, 1.5 L, etc.)';

-- Verify the change
SELECT column_name, data_type, numeric_precision, numeric_scale 
FROM information_schema.columns 
WHERE table_name = 'product_history' AND column_name = 'quantity';

