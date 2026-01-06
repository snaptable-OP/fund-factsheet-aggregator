-- Migration Script: Convert existing funds table to normalized schema
-- This script migrates data from the old schema to the new normalized schema
-- Run this AFTER creating the normalized schema (schema-normalized.sql)

-- Step 1: Migrate fund names to funds_normalized table
INSERT INTO funds_normalized (id, fund_name, created_at, updated_at)
SELECT 
  gen_random_uuid() as id,
  fund_name,
  MIN(created_at) as created_at,
  MAX(updated_at) as updated_at
FROM funds
WHERE fund_name IS NOT NULL
GROUP BY fund_name
ON CONFLICT (fund_name) DO NOTHING;

-- Step 2: Migrate first_run_data
INSERT INTO fund_data (fund_id, run_type, data, saved_at, created_at, updated_at)
SELECT 
  fn.id as fund_id,
  'first_run' as run_type,
  f.first_run_data as data,
  COALESCE(f.first_run_saved_at, f.created_at) as saved_at,
  f.created_at,
  f.updated_at
FROM funds f
INNER JOIN funds_normalized fn ON f.fund_name = fn.fund_name
WHERE f.first_run_data IS NOT NULL
ON CONFLICT (fund_id, run_type) DO UPDATE
  SET 
    data = EXCLUDED.data,
    saved_at = EXCLUDED.saved_at,
    updated_at = EXCLUDED.updated_at;

-- Step 3: Migrate second_run_data (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'funds' AND column_name = 'second_run_data'
  ) THEN
    INSERT INTO fund_data (fund_id, run_type, data, saved_at, created_at, updated_at)
    SELECT 
      fn.id as fund_id,
      'second_run' as run_type,
      f.second_run_data::jsonb as data,
      COALESCE(f.second_run_saved_at, f.created_at) as saved_at,
      f.created_at,
      f.updated_at
    FROM funds f
    INNER JOIN funds_normalized fn ON f.fund_name = fn.fund_name
    WHERE f.second_run_data IS NOT NULL
    ON CONFLICT (fund_id, run_type) DO UPDATE
      SET 
        data = EXCLUDED.data,
        saved_at = EXCLUDED.saved_at,
        updated_at = EXCLUDED.updated_at;
  END IF;
END $$;

-- Step 4: Migrate ai_guided_adjustments_data
INSERT INTO fund_data (fund_id, run_type, data, saved_at, created_at, updated_at)
SELECT 
  fn.id as fund_id,
  'ai_guided_adjustments' as run_type,
  f.ai_guided_adjustments_data as data,
  COALESCE(f.ai_guided_adjustments_saved_at, f.created_at) as saved_at,
  f.created_at,
  f.updated_at
FROM funds f
INNER JOIN funds_normalized fn ON f.fund_name = fn.fund_name
WHERE f.ai_guided_adjustments_data IS NOT NULL
ON CONFLICT (fund_id, run_type) DO UPDATE
  SET 
    data = EXCLUDED.data,
    saved_at = EXCLUDED.saved_at,
    updated_at = EXCLUDED.updated_at;

-- Step 5: Migrate ground_truth_data (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'funds' AND column_name = 'ground_truth_data'
  ) THEN
    INSERT INTO fund_data (fund_id, run_type, data, saved_at, created_at, updated_at)
    SELECT 
      fn.id as fund_id,
      'ground_truth' as run_type,
      f.ground_truth_data::jsonb as data,
      COALESCE(f.ground_truth_saved_at, f.created_at) as saved_at,
      f.created_at,
      f.updated_at
    FROM funds f
    INNER JOIN funds_normalized fn ON f.fund_name = fn.fund_name
    WHERE f.ground_truth_data IS NOT NULL
    ON CONFLICT (fund_id, run_type) DO UPDATE
      SET 
        data = EXCLUDED.data,
        saved_at = EXCLUDED.saved_at,
        updated_at = EXCLUDED.updated_at;
  END IF;
END $$;

-- Step 6: Verify migration
SELECT 
  'Migration Summary' as summary,
  (SELECT COUNT(*) FROM funds_normalized) as total_funds,
  (SELECT COUNT(*) FROM fund_data) as total_fund_data_records,
  (SELECT COUNT(DISTINCT run_type) FROM fund_data) as unique_run_types;
