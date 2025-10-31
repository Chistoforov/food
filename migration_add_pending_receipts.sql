-- Migration: Add pending_receipts table for background receipt processing
-- This allows users to upload receipts and close the app while processing continues

-- Create pending_receipts table
CREATE TABLE IF NOT EXISTS pending_receipts (
  id SERIAL PRIMARY KEY,
  family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  parsed_data JSONB, -- Store parsed receipt data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  attempts INTEGER DEFAULT 0
);

-- Add indexes for optimization
CREATE INDEX IF NOT EXISTS idx_pending_receipts_family_id ON pending_receipts(family_id);
CREATE INDEX IF NOT EXISTS idx_pending_receipts_status ON pending_receipts(status);
CREATE INDEX IF NOT EXISTS idx_pending_receipts_created_at ON pending_receipts(created_at);

-- Enable Row Level Security
ALTER TABLE pending_receipts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only see their family's pending receipts
CREATE POLICY "Users can view their family's pending receipts"
  ON pending_receipts FOR SELECT
  USING (family_id IN (SELECT id FROM families WHERE id = family_id));

CREATE POLICY "Users can insert pending receipts for their family"
  ON pending_receipts FOR INSERT
  WITH CHECK (family_id IN (SELECT id FROM families WHERE id = family_id));

CREATE POLICY "Users can update their family's pending receipts"
  ON pending_receipts FOR UPDATE
  USING (family_id IN (SELECT id FROM families WHERE id = family_id));

-- Function to cleanup old pending receipts (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_pending_receipts()
RETURNS void AS $$
BEGIN
  DELETE FROM pending_receipts
  WHERE created_at < NOW() - INTERVAL '7 days'
  AND status IN ('completed', 'failed');
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE pending_receipts IS 'Queue for background receipt processing';
COMMENT ON COLUMN pending_receipts.status IS 'pending - waiting to be processed, processing - currently being processed, completed - successfully processed, failed - processing failed';
COMMENT ON COLUMN pending_receipts.image_url IS 'URL to receipt image in Supabase Storage';
COMMENT ON COLUMN pending_receipts.parsed_data IS 'JSON data parsed from receipt (items, total, date)';
COMMENT ON COLUMN pending_receipts.attempts IS 'Number of processing attempts (for retry logic)';

