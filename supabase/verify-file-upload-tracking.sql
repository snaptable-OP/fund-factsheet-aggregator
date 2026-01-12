-- Verification script to check if file upload tracking table and function exist
-- Run this in Supabase SQL Editor

-- 1. Check if the table exists
SELECT 
  table_name,
  table_type,
  (SELECT COUNT(*) FROM information_schema.columns 
   WHERE table_schema = 'public' 
   AND table_name = 'fund_file_upload_tracking') as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'fund_file_upload_tracking';

-- 2. Check if the function exists
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'upsert_file_upload_tracking';

-- 3. Check table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'fund_file_upload_tracking'
ORDER BY ordinal_position;

-- 4. Check if there are any records
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT fund_name) as unique_funds,
  COUNT(DISTINCT source_file) as unique_files
FROM fund_file_upload_tracking;

-- 5. View recent records (if any)
SELECT 
  fund_name,
  source_file,
  file_uploaded_at,
  first_run_completed_at,
  second_run_completed_at,
  third_run_completed_at,
  ai_guided_adjustments_saved_at,
  ground_truth_saved_at,
  created_at
FROM fund_file_upload_tracking
ORDER BY created_at DESC
LIMIT 10;

-- 6. Test the function with sample data (optional - uncomment to test)
/*
SELECT * FROM upsert_file_upload_tracking(
  'Test Fund Name',
  'test-file.pdf',
  NOW(),
  NOW(),
  NULL,
  NULL,
  NULL,
  NULL
);
*/
