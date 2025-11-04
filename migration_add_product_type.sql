-- Migration: Add product_type field to products table
-- This field will store the generic product category (e.g., "молоко", "хлеб", "плавленный сыр")
-- to group different brands of the same product type

-- Add product_type column
ALTER TABLE products
ADD COLUMN product_type VARCHAR(255);

-- Create index for faster queries by product_type
CREATE INDEX idx_products_product_type ON products(product_type);

-- Create index for queries filtering by both family_id and product_type
CREATE INDEX idx_products_family_product_type ON products(family_id, product_type);

-- Add comment to explain the field
COMMENT ON COLUMN products.product_type IS 'Generic product category (e.g., "молоко", "хлеб", "сыр плавленный") - used to group different brands of the same product type for better forecasting';

