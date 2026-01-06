-- Fix for ambiguous fund_id column reference error (Version 2)
-- Run this in Supabase SQL Editor

-- Replace the upsert_fund_data function with fixed version
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
  
  -- Upsert fund data - use table alias to avoid ambiguity
  INSERT INTO fund_data AS fd (fund_id, run_type, data, saved_at)
  VALUES (v_fund_id, p_run_type, p_data, v_saved_at)
  ON CONFLICT (fund_id, run_type) DO UPDATE
    SET 
      data = EXCLUDED.data,
      saved_at = EXCLUDED.saved_at,
      updated_at = NOW()
  RETURNING fd.fund_id, fd.saved_at INTO v_result_fund_id, v_result_saved_at;
  
  -- Return the result
  RETURN QUERY SELECT v_result_fund_id, v_result_saved_at;
END;
$$ LANGUAGE plpgsql;
