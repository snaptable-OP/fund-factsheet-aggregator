-- Force refresh the upsert_file_upload_tracking function
-- This will update PostgREST's schema cache
-- Run this in Supabase SQL Editor

-- Drop and recreate the function to force PostgREST to refresh its cache
DROP FUNCTION IF EXISTS public.upsert_file_upload_tracking;

-- Now recreate it with all the new parameters
CREATE FUNCTION upsert_file_upload_tracking(
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

-- Verify the function was created
SELECT 
  'Function created successfully!' as status,
  routine_name,
  (
    SELECT COUNT(*) 
    FROM information_schema.parameters 
    WHERE specific_schema = 'public' 
      AND specific_name = routines.specific_name
  ) as parameter_count
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'upsert_file_upload_tracking';
