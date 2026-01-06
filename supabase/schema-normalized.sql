-- Normalized Database Schema for Fund Factsheet Aggregator
-- This design separates fund metadata from run-specific data
-- Run this in Supabase SQL Editor

-- Step 1: Create the normalized funds table (basic fund information only)
CREATE TABLE IF NOT EXISTS funds_normalized (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Create fund_data table (stores all run types)
CREATE TABLE IF NOT EXISTS fund_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_id UUID NOT NULL REFERENCES funds_normalized(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL CHECK (run_type IN ('first_run', 'second_run', 'third_run', 'ai_guided_adjustments', 'ground_truth')),
  data JSONB NOT NULL, -- Full fund data as JSON
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure one record per fund per run_type (can update, but not duplicate)
  UNIQUE(fund_id, run_type)
);

-- Step 3: Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_funds_normalized_fund_name ON funds_normalized(fund_name);
CREATE INDEX IF NOT EXISTS idx_fund_data_fund_id ON fund_data(fund_id);
CREATE INDEX IF NOT EXISTS idx_fund_data_run_type ON fund_data(run_type);
CREATE INDEX IF NOT EXISTS idx_fund_data_saved_at ON fund_data(saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_fund_data_fund_run ON fund_data(fund_id, run_type);

-- Step 4: Enable Row Level Security (RLS)
ALTER TABLE funds_normalized ENABLE ROW LEVEL SECURITY;
ALTER TABLE fund_data ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies (allow all operations)
DROP POLICY IF EXISTS "Allow all operations on funds_normalized" ON funds_normalized;
CREATE POLICY "Allow all operations on funds_normalized" ON funds_normalized
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on fund_data" ON fund_data;
CREATE POLICY "Allow all operations on fund_data" ON fund_data
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Step 6: Create a view for easy querying (optional, for backward compatibility)
CREATE OR REPLACE VIEW funds_with_data AS
SELECT 
  f.id as fund_id,
  f.fund_name,
  f.created_at as fund_created_at,
  f.updated_at as fund_updated_at,
  -- Use JSON aggregation to get all run types
  jsonb_object_agg(
    fd.run_type, 
    jsonb_build_object(
      'data', fd.data,
      'saved_at', fd.saved_at
    )
  ) FILTER (WHERE fd.id IS NOT NULL) as run_data
FROM funds_normalized f
LEFT JOIN fund_data fd ON f.id = fd.fund_id
GROUP BY f.id, f.fund_name, f.created_at, f.updated_at;

-- Step 7: Create helper function to get fund data by run type
CREATE OR REPLACE FUNCTION get_fund_data_by_run_type(
  p_fund_name TEXT,
  p_run_type TEXT
)
RETURNS TABLE (
  fund_id UUID,
  fund_name TEXT,
  data JSONB,
  saved_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.fund_name,
    fd.data,
    fd.saved_at
  FROM funds_normalized f
  INNER JOIN fund_data fd ON f.id = fd.fund_id
  WHERE f.fund_name = p_fund_name
    AND fd.run_type = p_run_type;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create helper function to upsert fund data
CREATE OR REPLACE FUNCTION upsert_fund_data(
  p_fund_name TEXT,
  p_run_type TEXT,
  p_data JSONB
)
RETURNS TABLE (
  fund_id UUID,
  saved_at TIMESTAMPTZ
) AS $$
DECLARE
  v_fund_id UUID;
  v_saved_at TIMESTAMPTZ := NOW();
BEGIN
  -- Get or create fund
  INSERT INTO funds_normalized (fund_name)
  VALUES (p_fund_name)
  ON CONFLICT (fund_name) DO UPDATE
    SET updated_at = NOW()
  RETURNING id INTO v_fund_id;
  
  -- If fund already exists, get its ID
  IF v_fund_id IS NULL THEN
    SELECT id INTO v_fund_id FROM funds_normalized WHERE fund_name = p_fund_name;
  END IF;
  
  -- Upsert fund data
  INSERT INTO fund_data (fund_id, run_type, data, saved_at)
  VALUES (v_fund_id, p_run_type, p_data, v_saved_at)
  ON CONFLICT (fund_id, run_type) DO UPDATE
    SET 
      data = EXCLUDED.data,
      saved_at = EXCLUDED.saved_at,
      updated_at = NOW()
  RETURNING fund_id, saved_at INTO v_fund_id, v_saved_at;
  
  RETURN QUERY SELECT v_fund_id, v_saved_at;
END;
$$ LANGUAGE plpgsql;
