-- File Upload Tracking Table
-- Tracks timestamps for each fund per file upload
-- This allows the same fund to appear in multiple file uploads with separate tracking
-- Run this in Supabase SQL Editor

-- Step 1: Create the file upload tracking table
CREATE TABLE IF NOT EXISTS fund_file_upload_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_name TEXT NOT NULL,
  source_file TEXT NOT NULL, -- The PDF file name that was uploaded
  file_uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_run_completed_at TIMESTAMPTZ,
  first_run_data JSONB, -- JSONB data from 1st run
  second_run_completed_at TIMESTAMPTZ,
  second_run_data JSONB, -- JSONB data from 2nd run
  third_run_completed_at TIMESTAMPTZ,
  third_run_data JSONB, -- JSONB data from 3rd run
  ai_guided_adjustments_saved_at TIMESTAMPTZ,
  ai_guided_adjustments_data JSONB, -- JSONB data from AI-guided adjustments
  ground_truth_saved_at TIMESTAMPTZ,
  ground_truth_data JSONB, -- JSONB data from ground truth
  consistency_rate JSONB, -- Stores consistency rates: { secondRun: { accuracy, totalFields, differences }, thirdRun: { accuracy, totalFields, differences } }
  accuracy_rate JSONB, -- Stores F1 scores: { firstRun: { precision, recall, f1 }, secondRun: {...}, thirdRun: {...}, aiGuidedAdjustments: {...} }
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Note: No unique constraint - allows multiple uploads of the same file
  -- Each upload creates a new row, tracked by file_uploaded_at timestamp
);

-- Step 2: Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_fund_file_upload_tracking_fund_name ON fund_file_upload_tracking(fund_name);
CREATE INDEX IF NOT EXISTS idx_fund_file_upload_tracking_source_file ON fund_file_upload_tracking(source_file);
CREATE INDEX IF NOT EXISTS idx_fund_file_upload_tracking_uploaded_at ON fund_file_upload_tracking(file_uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_fund_file_upload_tracking_fund_source ON fund_file_upload_tracking(fund_name, source_file);

-- Step 3: Enable Row Level Security (RLS)
ALTER TABLE fund_file_upload_tracking ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies (allow all operations)
DROP POLICY IF EXISTS "Allow all operations on fund_file_upload_tracking" ON fund_file_upload_tracking;
CREATE POLICY "Allow all operations on fund_file_upload_tracking" ON fund_file_upload_tracking
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Step 5: Create helper function to upsert file upload tracking
-- This function allows partial updates - only non-NULL parameters will update their respective fields
CREATE OR REPLACE FUNCTION upsert_file_upload_tracking(
  p_fund_name TEXT,
  p_source_file TEXT,
  p_file_uploaded_at TIMESTAMPTZ DEFAULT NULL,
  p_first_run_completed_at TIMESTAMPTZ DEFAULT NULL,
  p_first_run_data JSONB DEFAULT NULL,
  p_second_run_completed_at TIMESTAMPTZ DEFAULT NULL,
  p_second_run_data JSONB DEFAULT NULL,
  p_third_run_completed_at TIMESTAMPTZ DEFAULT NULL,
  p_third_run_data JSONB DEFAULT NULL,
  p_ai_guided_adjustments_saved_at TIMESTAMPTZ DEFAULT NULL,
  p_ai_guided_adjustments_data JSONB DEFAULT NULL,
  p_ground_truth_saved_at TIMESTAMPTZ DEFAULT NULL,
  p_ground_truth_data JSONB DEFAULT NULL,
  p_consistency_rate JSONB DEFAULT NULL,
  p_accuracy_rate JSONB DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  fund_name TEXT,
  source_file TEXT,
  file_uploaded_at TIMESTAMPTZ,
  first_run_completed_at TIMESTAMPTZ,
  first_run_data JSONB,
  second_run_completed_at TIMESTAMPTZ,
  second_run_data JSONB,
  third_run_completed_at TIMESTAMPTZ,
  third_run_data JSONB,
  ai_guided_adjustments_saved_at TIMESTAMPTZ,
  ai_guided_adjustments_data JSONB,
  ground_truth_saved_at TIMESTAMPTZ,
  ground_truth_data JSONB,
  consistency_rate JSONB,
  accuracy_rate JSONB
) AS $$
DECLARE
  v_id UUID;
  v_file_uploaded_at TIMESTAMPTZ;
  v_fund_name TEXT;
  v_source_file TEXT;
  v_first_run_completed_at TIMESTAMPTZ;
  v_first_run_data JSONB;
  v_second_run_completed_at TIMESTAMPTZ;
  v_second_run_data JSONB;
  v_third_run_completed_at TIMESTAMPTZ;
  v_third_run_data JSONB;
  v_ai_guided_adjustments_saved_at TIMESTAMPTZ;
  v_ai_guided_adjustments_data JSONB;
  v_ground_truth_saved_at TIMESTAMPTZ;
  v_ground_truth_data JSONB;
  v_consistency_rate JSONB;
  v_accuracy_rate JSONB;
BEGIN
  -- Use provided file_uploaded_at or NOW() if this is a new record (p_file_uploaded_at is NULL)
  -- For updates, if p_file_uploaded_at is NULL, we'll keep the existing value in the UPDATE clause
  v_file_uploaded_at := COALESCE(p_file_uploaded_at, NOW());
  
  -- Insert or update the tracking record
  INSERT INTO fund_file_upload_tracking (
    fund_name,
    source_file,
    file_uploaded_at,
    first_run_completed_at,
    first_run_data,
    second_run_completed_at,
    second_run_data,
    third_run_completed_at,
    third_run_data,
    ai_guided_adjustments_saved_at,
    ai_guided_adjustments_data,
    ground_truth_saved_at,
    ground_truth_data,
    consistency_rate,
    accuracy_rate
  )
  VALUES (
    p_fund_name,
    p_source_file,
    v_file_uploaded_at,
    p_first_run_completed_at,
    p_first_run_data,
    p_second_run_completed_at,
    p_second_run_data,
    p_third_run_completed_at,
    p_third_run_data,
    p_ai_guided_adjustments_saved_at,
    p_ai_guided_adjustments_data,
    p_ground_truth_saved_at,
    p_ground_truth_data,
    p_consistency_rate,
    p_accuracy_rate
  )
  ON CONFLICT ON CONSTRAINT fund_file_upload_tracking_fund_name_source_file_key DO UPDATE
  SET
    -- Only update file_uploaded_at if it's being set (not null)
    file_uploaded_at = COALESCE(EXCLUDED.file_uploaded_at, fund_file_upload_tracking.file_uploaded_at),
    -- Update run timestamps and data only if provided (not null)
    first_run_completed_at = COALESCE(EXCLUDED.first_run_completed_at, fund_file_upload_tracking.first_run_completed_at),
    first_run_data = COALESCE(EXCLUDED.first_run_data, fund_file_upload_tracking.first_run_data),
    second_run_completed_at = COALESCE(EXCLUDED.second_run_completed_at, fund_file_upload_tracking.second_run_completed_at),
    second_run_data = COALESCE(EXCLUDED.second_run_data, fund_file_upload_tracking.second_run_data),
    third_run_completed_at = COALESCE(EXCLUDED.third_run_completed_at, fund_file_upload_tracking.third_run_completed_at),
    third_run_data = COALESCE(EXCLUDED.third_run_data, fund_file_upload_tracking.third_run_data),
    ai_guided_adjustments_saved_at = COALESCE(EXCLUDED.ai_guided_adjustments_saved_at, fund_file_upload_tracking.ai_guided_adjustments_saved_at),
    ai_guided_adjustments_data = COALESCE(EXCLUDED.ai_guided_adjustments_data, fund_file_upload_tracking.ai_guided_adjustments_data),
    ground_truth_saved_at = COALESCE(EXCLUDED.ground_truth_saved_at, fund_file_upload_tracking.ground_truth_saved_at),
    ground_truth_data = COALESCE(EXCLUDED.ground_truth_data, fund_file_upload_tracking.ground_truth_data),
    consistency_rate = COALESCE(EXCLUDED.consistency_rate, fund_file_upload_tracking.consistency_rate),
    accuracy_rate = COALESCE(EXCLUDED.accuracy_rate, fund_file_upload_tracking.accuracy_rate),
    updated_at = NOW()
  RETURNING 
    fund_file_upload_tracking.id,
    fund_file_upload_tracking.fund_name,
    fund_file_upload_tracking.source_file,
    fund_file_upload_tracking.file_uploaded_at,
    fund_file_upload_tracking.first_run_completed_at,
    fund_file_upload_tracking.first_run_data,
    fund_file_upload_tracking.second_run_completed_at,
    fund_file_upload_tracking.second_run_data,
    fund_file_upload_tracking.third_run_completed_at,
    fund_file_upload_tracking.third_run_data,
    fund_file_upload_tracking.ai_guided_adjustments_saved_at,
    fund_file_upload_tracking.ai_guided_adjustments_data,
    fund_file_upload_tracking.ground_truth_saved_at,
    fund_file_upload_tracking.ground_truth_data,
    fund_file_upload_tracking.consistency_rate,
    fund_file_upload_tracking.accuracy_rate
  INTO 
    v_id,
    v_fund_name,
    v_source_file,
    v_file_uploaded_at,
    v_first_run_completed_at,
    v_first_run_data,
    v_second_run_completed_at,
    v_second_run_data,
    v_third_run_completed_at,
    v_third_run_data,
    v_ai_guided_adjustments_saved_at,
    v_ai_guided_adjustments_data,
    v_ground_truth_saved_at,
    v_ground_truth_data,
    v_consistency_rate,
    v_accuracy_rate;
  
  -- Return the result
  RETURN QUERY SELECT 
    v_id,
    v_fund_name,
    v_source_file,
    v_file_uploaded_at,
    v_first_run_completed_at,
    v_first_run_data,
    v_second_run_completed_at,
    v_second_run_data,
    v_third_run_completed_at,
    v_third_run_data,
    v_ai_guided_adjustments_saved_at,
    v_ai_guided_adjustments_data,
    v_ground_truth_saved_at,
    v_ground_truth_data,
    v_consistency_rate,
    v_accuracy_rate;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create a view for easy querying
-- Drop the view first if it exists (to handle column changes)
DROP VIEW IF EXISTS fund_upload_timeline;

CREATE VIEW fund_upload_timeline AS
SELECT 
  id,
  fund_name,
  source_file,
  file_uploaded_at,
  first_run_completed_at,
  first_run_data,
  second_run_completed_at,
  second_run_data,
  third_run_completed_at,
  third_run_data,
  ai_guided_adjustments_saved_at,
  ai_guided_adjustments_data,
  ground_truth_saved_at,
  ground_truth_data,
  consistency_rate,
  accuracy_rate,
  created_at,
  updated_at,
  -- Calculate time differences
  CASE 
    WHEN first_run_completed_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (first_run_completed_at - file_uploaded_at))
    ELSE NULL
  END as first_run_duration_seconds,
  CASE 
    WHEN second_run_completed_at IS NOT NULL AND first_run_completed_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (second_run_completed_at - first_run_completed_at))
    ELSE NULL
  END as second_run_duration_seconds,
  CASE 
    WHEN third_run_completed_at IS NOT NULL AND second_run_completed_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (third_run_completed_at - second_run_completed_at))
    ELSE NULL
  END as third_run_duration_seconds
FROM fund_file_upload_tracking
ORDER BY file_uploaded_at DESC, fund_name;
