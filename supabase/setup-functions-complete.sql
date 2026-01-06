-- Complete setup script for fund data functions
-- Run this in Supabase SQL Editor to ensure all required functions exist
-- This fixes the syntax error in normalize_fund_name_for_matching and sets up upsert_fund_data

-- Step 1: Create/Replace normalize_fund_name_for_matching function (FIXED VERSION)
-- This function normalizes fund names for matching (removes trailing numbers, extra spaces, lowercases)
CREATE OR REPLACE FUNCTION normalize_fund_name_for_matching(p_name TEXT)
RETURNS TEXT AS $$
DECLARE
  normalized TEXT;
BEGIN
  IF p_name IS NULL OR p_name = '' THEN
    RETURN '';
  END IF;
  
  normalized := TRIM(p_name);
  
  -- Remove trailing numbers and spaces (e.g., "Fund 8" -> "Fund")
  normalized := REGEXP_REPLACE(normalized, '\s+\d+$', '');
  
  -- Remove extra whitespace
  normalized := REGEXP_REPLACE(normalized, '\s+', ' ', 'g');
  
  -- Convert to lowercase for comparison (matches frontend)
  normalized := LOWER(TRIM(normalized));
  
  RETURN normalized;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 2: Create/Replace upsert_fund_data function (FINAL VERSION - fixes ambiguous column reference)
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
  v_normalized_name TEXT;
  v_existing_fund_id UUID;
  v_result_fund_id UUID;
  v_result_saved_at TIMESTAMPTZ;
BEGIN
  -- Normalize the fund name (matches frontend logic)
  v_normalized_name := normalize_fund_name_for_matching(p_fund_name);
  
  IF v_normalized_name = '' THEN
    RAISE EXCEPTION 'Fund name cannot be empty after normalization';
  END IF;
  
  -- Strategy 1: Try exact match on normalized name
  SELECT id INTO v_existing_fund_id
  FROM funds_normalized
  WHERE normalize_fund_name_for_matching(fund_name) = v_normalized_name
  LIMIT 1;
  
  -- Strategy 2: If no exact match, try substring matching (one contains the other)
  -- This handles cases like "Fund ABC" vs "Fund ABC " or "Fund" vs "Fund 8"
  IF v_existing_fund_id IS NULL THEN
    SELECT id INTO v_existing_fund_id
    FROM funds_normalized
    WHERE 
      -- One normalized name contains the other
      (normalize_fund_name_for_matching(fund_name) LIKE '%' || v_normalized_name || '%'
       OR v_normalized_name LIKE '%' || normalize_fund_name_for_matching(fund_name) || '%')
      -- Avoid false matches: names should be reasonably similar in length
      AND ABS(LENGTH(normalize_fund_name_for_matching(fund_name)) - LENGTH(v_normalized_name)) <= 30
    ORDER BY 
      -- Prefer shorter names (more likely to be canonical/1st run)
      LENGTH(normalize_fund_name_for_matching(fund_name)) ASC,
      -- Then by creation date (older = more likely to be 1st run)
      created_at ASC
    LIMIT 1;
  END IF;
  
  -- Strategy 3: If still no match, create new fund entry
  IF v_existing_fund_id IS NULL THEN
    INSERT INTO funds_normalized (fund_name)
    VALUES (p_fund_name) -- Store original name for display
    RETURNING id INTO v_fund_id;
  ELSE
    v_fund_id := v_existing_fund_id;
    -- Update the fund's updated_at timestamp
    UPDATE funds_normalized
    SET updated_at = NOW()
    WHERE id = v_fund_id;
  END IF;
  
  -- Upsert fund data - use explicit column references
  -- First try to update existing record
  UPDATE fund_data
  SET 
    data = p_data,
    saved_at = v_saved_at,
    updated_at = NOW()
  WHERE fund_data.fund_id = v_fund_id 
    AND fund_data.run_type = p_run_type;
  
  -- If no row was updated, insert new record
  IF NOT FOUND THEN
    INSERT INTO fund_data (fund_id, run_type, data, saved_at)
    VALUES (v_fund_id, p_run_type, p_data, v_saved_at)
    RETURNING fund_data.fund_id, fund_data.saved_at INTO v_result_fund_id, v_result_saved_at;
  ELSE
    -- Get the updated values
    SELECT fund_data.fund_id, fund_data.saved_at 
    INTO v_result_fund_id, v_result_saved_at
    FROM fund_data
    WHERE fund_data.fund_id = v_fund_id 
      AND fund_data.run_type = p_run_type;
  END IF;
  
  -- Return the result
  RETURN QUERY SELECT v_result_fund_id, v_result_saved_at;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Add index for faster normalized name lookups (if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_funds_normalized_name_normalized 
ON funds_normalized(normalize_fund_name_for_matching(fund_name));

-- Verification: Check if functions were created successfully
SELECT 
  'Functions created successfully!' as status,
  (SELECT COUNT(*) FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name = 'normalize_fund_name_for_matching') as normalize_function_exists,
  (SELECT COUNT(*) FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name = 'upsert_fund_data') as upsert_function_exists;
