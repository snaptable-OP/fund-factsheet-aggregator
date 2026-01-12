-- Find the constraint name for the unique constraint
-- Run this first to get the exact constraint name

SELECT 
  conname as constraint_name,
  contype as constraint_type
FROM pg_constraint
WHERE conrelid = 'fund_file_upload_tracking'::regclass
  AND contype = 'u'  -- 'u' = unique constraint
ORDER BY conname;
