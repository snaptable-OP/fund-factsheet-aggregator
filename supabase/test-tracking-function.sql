-- Test the tracking function directly
-- Run this in Supabase SQL Editor to verify the function works

-- Test 1: Insert a new record
SELECT * FROM upsert_file_upload_tracking(
  'Test Fund Name',
  'test-file.pdf',
  NOW(),
  NOW(),
  '{"id": "test-1", "fundName": "Test Fund Name", "fund_factsheet_as_of_date": "2024-12-31"}'::jsonb
);

-- Test 2: Check if the record was created
SELECT * FROM fund_file_upload_tracking 
WHERE fund_name = 'Test Fund Name' 
  AND source_file = 'test-file.pdf';

-- Test 3: Update the record (add second run data)
SELECT * FROM upsert_file_upload_tracking(
  'Test Fund Name',
  'test-file.pdf',
  NULL, -- Don't update file_uploaded_at
  NULL, -- Don't update first_run_completed_at
  NULL, -- Don't update first_run_data
  NOW(), -- Add second_run_completed_at
  '{"id": "test-2", "fundName": "Test Fund Name", "secondRun": true}'::jsonb -- Add second_run_data
);

-- Test 4: Verify the update
SELECT 
  fund_name,
  source_file,
  file_uploaded_at,
  first_run_completed_at,
  first_run_data IS NOT NULL as has_first_run_data,
  second_run_completed_at,
  second_run_data IS NOT NULL as has_second_run_data
FROM fund_file_upload_tracking 
WHERE fund_name = 'Test Fund Name' 
  AND source_file = 'test-file.pdf';

-- Clean up test data (optional)
-- DELETE FROM fund_file_upload_tracking WHERE fund_name = 'Test Fund Name' AND source_file = 'test-file.pdf';
