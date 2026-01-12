-- Verify the function exists with new parameters and refresh PostgREST cache
-- Run this in Supabase SQL Editor

-- 1. Check if function exists with new parameters
SELECT 
  routine_name,
  routine_type,
  data_type as return_type,
  -- Get parameter names
  (
    SELECT string_agg(parameter_name || ' ' || data_type, ', ' ORDER BY ordinal_position)
    FROM information_schema.parameters
    WHERE specific_schema = 'public'
      AND specific_name = routines.specific_name
  ) as parameters
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'upsert_file_upload_tracking';

-- 2. If the function doesn't have the new parameters, recreate it
-- Run Step 5 from schema-file-upload-tracking.sql again

-- 3. Refresh PostgREST schema cache (this is done automatically, but you can trigger it)
-- PostgREST automatically refreshes when you make changes, but sometimes you need to wait a few seconds
-- Or you can restart your Supabase project to force a refresh

-- 4. Verify the function signature matches what we expect
SELECT 
  parameter_name,
  data_type,
  parameter_default,
  ordinal_position
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND specific_name = (
    SELECT specific_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
      AND routine_name = 'upsert_file_upload_tracking'
  )
ORDER BY ordinal_position;
