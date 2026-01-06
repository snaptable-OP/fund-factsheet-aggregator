-- Verification script to check if upsert_fund_data function exists and works
-- Run this in Supabase SQL Editor

-- 1. Check if the function exists
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'upsert_fund_data';

-- 2. Check if normalize_fund_name_for_matching function exists (required dependency)
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'normalize_fund_name_for_matching';

-- 3. Check if the tables exist
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('funds_normalized', 'fund_data')
ORDER BY table_name;

-- 4. Test the function with sample data (optional - uncomment to test)
/*
SELECT * FROM upsert_fund_data(
  'Test Fund Name',
  'second_run',
  '{"id": "test-1", "fundName": "Test Fund Name", "fund_factsheet_as_of_date": "2024-12-31", "launchDate": "2020-01-01", "investmentObjective": "Test objective", "returns": {}, "assetClasses": [], "top10Holdings": [], "sourceFile": "test.pdf", "processedAt": "2024-01-01T00:00:00Z"}'::jsonb
);
*/

-- 5. Check recent fund_data entries by run_type
SELECT 
  run_type,
  COUNT(*) as count,
  MAX(saved_at) as latest_saved_at
FROM fund_data
GROUP BY run_type
ORDER BY run_type;

-- 6. Check if there are any recent entries (last 24 hours)
SELECT 
  run_type,
  COUNT(*) as count
FROM fund_data
WHERE saved_at > NOW() - INTERVAL '24 hours'
GROUP BY run_type
ORDER BY run_type;
