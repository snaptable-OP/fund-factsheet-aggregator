-- Enhanced upsert function with fuzzy matching for fund names
-- This ensures funds with similar names (e.g., "Guaranteed Fund" vs "Guaranteed Portfolio")
-- get linked to the same fund_id, matching the frontend pairing logic

-- First, create a function to normalize fund names (matches frontend logic)
CREATE OR REPLACE FUNCTION normalize_fund_name(p_name TEXT)
RETURNS TEXT AS $$
BEGIN
  IF p_name IS NULL OR p_name = '' THEN
    RETURN '';
  END IF;
  
  -- Remove trailing numbers and spaces (e.g., "Fund 8" -> "Fund")
  DECLARE
    normalized TEXT := TRIM(p_name);
  BEGIN
    -- Remove trailing numbers and spaces pattern like " 8", " 123", etc.
    normalized := REGEXP_REPLACE(normalized, '\s+\d+$', '');
    
    -- Remove extra whitespace
    normalized := REGEXP_REPLACE(normalized, '\s+', ' ', 'g');
    
    -- Convert to lowercase for comparison (matches frontend)
    normalized := LOWER(TRIM(normalized));
    
    RETURN normalized;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Enhanced upsert function that tries to find similar fund names
CREATE OR REPLACE FUNCTION upsert_fund_data_with_fuzzy_matching(
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
  v_existing_fund_name TEXT;
BEGIN
  -- Normalize the fund name
  v_normalized_name := normalize_fund_name(p_fund_name);
  
  IF v_normalized_name = '' THEN
    RAISE EXCEPTION 'Fund name cannot be empty after normalization';
  END IF;
  
  -- First, try exact match on normalized name
  SELECT id INTO v_existing_fund_id
  FROM funds_normalized
  WHERE normalize_fund_name(fund_name) = v_normalized_name
  LIMIT 1;
  
  -- If no exact match, try fuzzy matching (substring match)
  -- This handles cases like "Fund ABC" vs "Fund ABC " or "Fund" vs "Fund 8"
  IF v_existing_fund_id IS NULL THEN
    SELECT id INTO v_existing_fund_id
    FROM funds_normalized
    WHERE 
      -- One name contains the other (normalized)
      (normalize_fund_name(fund_name) LIKE '%' || v_normalized_name || '%'
       OR v_normalized_name LIKE '%' || normalize_fund_name(fund_name) || '%')
      -- And they're reasonably similar in length (avoid false matches)
      AND ABS(LENGTH(normalize_fund_name(fund_name)) - LENGTH(v_normalized_name)) <= 20
    ORDER BY 
      -- Prefer shorter names (more likely to be canonical)
      LENGTH(normalize_fund_name(fund_name)) ASC,
      -- Then by creation date (older = more likely to be 1st run)
      created_at ASC
    LIMIT 1;
  END IF;
  
  -- If still no match, create new fund entry
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
