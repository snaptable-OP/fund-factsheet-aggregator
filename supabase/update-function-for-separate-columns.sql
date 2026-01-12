-- Update the function to use separate columns instead of JSONB
-- Run this after running migrate-rates-to-columns.sql

DROP FUNCTION IF EXISTS public.upsert_file_upload_tracking;

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
  -- Consistency rates (2 separate columns)
  p_consistency_rate_second_run NUMERIC(5,2) DEFAULT NULL,
  p_consistency_rate_third_run NUMERIC(5,2) DEFAULT NULL,
  -- Accuracy rates (4 separate columns - F1 scores)
  p_accuracy_rate_first_run NUMERIC(5,2) DEFAULT NULL,
  p_accuracy_rate_second_run NUMERIC(5,2) DEFAULT NULL,
  p_accuracy_rate_third_run NUMERIC(5,2) DEFAULT NULL,
  p_accuracy_rate_ai_guided_adjustments NUMERIC(5,2) DEFAULT NULL
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
  consistency_rate_second_run NUMERIC(5,2),
  consistency_rate_third_run NUMERIC(5,2),
  accuracy_rate_first_run NUMERIC(5,2),
  accuracy_rate_second_run NUMERIC(5,2),
  accuracy_rate_third_run NUMERIC(5,2),
  accuracy_rate_ai_guided_adjustments NUMERIC(5,2)
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
  v_consistency_rate_second_run NUMERIC(5,2);
  v_consistency_rate_third_run NUMERIC(5,2);
  v_accuracy_rate_first_run NUMERIC(5,2);
  v_accuracy_rate_second_run NUMERIC(5,2);
  v_accuracy_rate_third_run NUMERIC(5,2);
  v_accuracy_rate_ai_guided_adjustments NUMERIC(5,2);
BEGIN
  v_file_uploaded_at := COALESCE(p_file_uploaded_at, NOW());
  
  INSERT INTO fund_file_upload_tracking (
    fund_name, source_file, file_uploaded_at,
    first_run_completed_at, first_run_data,
    second_run_completed_at, second_run_data,
    third_run_completed_at, third_run_data,
    ai_guided_adjustments_saved_at, ai_guided_adjustments_data,
    ground_truth_saved_at, ground_truth_data,
    consistency_rate_second_run, consistency_rate_third_run,
    accuracy_rate_first_run, accuracy_rate_second_run, accuracy_rate_third_run, accuracy_rate_ai_guided_adjustments
  )
  VALUES (
    p_fund_name, p_source_file, v_file_uploaded_at,
    p_first_run_completed_at, p_first_run_data,
    p_second_run_completed_at, p_second_run_data,
    p_third_run_completed_at, p_third_run_data,
    p_ai_guided_adjustments_saved_at, p_ai_guided_adjustments_data,
    p_ground_truth_saved_at, p_ground_truth_data,
    p_consistency_rate_second_run, p_consistency_rate_third_run,
    p_accuracy_rate_first_run, p_accuracy_rate_second_run, p_accuracy_rate_third_run, p_accuracy_rate_ai_guided_adjustments
  )
  ON CONFLICT ON CONSTRAINT fund_file_upload_tracking_fund_name_source_file_key DO UPDATE
  SET
    file_uploaded_at = COALESCE(EXCLUDED.file_uploaded_at, fund_file_upload_tracking.file_uploaded_at),
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
    consistency_rate_second_run = COALESCE(EXCLUDED.consistency_rate_second_run, fund_file_upload_tracking.consistency_rate_second_run),
    consistency_rate_third_run = COALESCE(EXCLUDED.consistency_rate_third_run, fund_file_upload_tracking.consistency_rate_third_run),
    accuracy_rate_first_run = COALESCE(EXCLUDED.accuracy_rate_first_run, fund_file_upload_tracking.accuracy_rate_first_run),
    accuracy_rate_second_run = COALESCE(EXCLUDED.accuracy_rate_second_run, fund_file_upload_tracking.accuracy_rate_second_run),
    accuracy_rate_third_run = COALESCE(EXCLUDED.accuracy_rate_third_run, fund_file_upload_tracking.accuracy_rate_third_run),
    accuracy_rate_ai_guided_adjustments = COALESCE(EXCLUDED.accuracy_rate_ai_guided_adjustments, fund_file_upload_tracking.accuracy_rate_ai_guided_adjustments),
    updated_at = NOW()
  RETURNING 
    fund_file_upload_tracking.id, fund_file_upload_tracking.fund_name, fund_file_upload_tracking.source_file,
    fund_file_upload_tracking.file_uploaded_at, fund_file_upload_tracking.first_run_completed_at, fund_file_upload_tracking.first_run_data,
    fund_file_upload_tracking.second_run_completed_at, fund_file_upload_tracking.second_run_data,
    fund_file_upload_tracking.third_run_completed_at, fund_file_upload_tracking.third_run_data,
    fund_file_upload_tracking.ai_guided_adjustments_saved_at, fund_file_upload_tracking.ai_guided_adjustments_data,
    fund_file_upload_tracking.ground_truth_saved_at, fund_file_upload_tracking.ground_truth_data,
    fund_file_upload_tracking.consistency_rate_second_run, fund_file_upload_tracking.consistency_rate_third_run,
    fund_file_upload_tracking.accuracy_rate_first_run, fund_file_upload_tracking.accuracy_rate_second_run,
    fund_file_upload_tracking.accuracy_rate_third_run, fund_file_upload_tracking.accuracy_rate_ai_guided_adjustments
  INTO 
    v_id, v_fund_name, v_source_file, v_file_uploaded_at,
    v_first_run_completed_at, v_first_run_data, v_second_run_completed_at, v_second_run_data,
    v_third_run_completed_at, v_third_run_data, v_ai_guided_adjustments_saved_at, v_ai_guided_adjustments_data,
    v_ground_truth_saved_at, v_ground_truth_data,
    v_consistency_rate_second_run, v_consistency_rate_third_run,
    v_accuracy_rate_first_run, v_accuracy_rate_second_run, v_accuracy_rate_third_run, v_accuracy_rate_ai_guided_adjustments;
  
  RETURN QUERY SELECT 
    v_id, v_fund_name, v_source_file, v_file_uploaded_at,
    v_first_run_completed_at, v_first_run_data, v_second_run_completed_at, v_second_run_data,
    v_third_run_completed_at, v_third_run_data, v_ai_guided_adjustments_saved_at, v_ai_guided_adjustments_data,
    v_ground_truth_saved_at, v_ground_truth_data,
    v_consistency_rate_second_run, v_consistency_rate_third_run,
    v_accuracy_rate_first_run, v_accuracy_rate_second_run, v_accuracy_rate_third_run, v_accuracy_rate_ai_guided_adjustments;
END;
$$ LANGUAGE plpgsql;
