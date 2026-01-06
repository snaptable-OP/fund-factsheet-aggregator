-- Verification queries to test the normalized schema setup
-- Run these in Supabase SQL Editor to verify everything is working

-- 1. Check that tables exist
SELECT 
  'Tables Check' as check_type,
  COUNT(*) FILTER (WHERE table_name = 'funds_normalized') as funds_normalized_exists,
  COUNT(*) FILTER (WHERE table_name = 'fund_data') as fund_data_exists,
  COUNT(*) FILTER (WHERE table_name = 'funds_with_data') as funds_with_data_exists
FROM information_schema.tables
WHERE table_schema = 'public';

-- 2. Check that functions exist
SELECT 
  'Functions Check' as check_type,
  COUNT(*) FILTER (WHERE routine_name = 'normalize_fund_name_for_matching') as normalize_function_exists,
  COUNT(*) FILTER (WHERE routine_name = 'upsert_fund_data') as upsert_function_exists,
  COUNT(*) FILTER (WHERE routine_name = 'get_fund_data_by_run_type') as get_function_exists
FROM information_schema.routines
WHERE routine_schema = 'public';

-- 3. Check that indexes exist
SELECT 
  'Indexes Check' as check_type,
  COUNT(*) FILTER (WHERE indexname = 'idx_funds_normalized_fund_name') as fund_name_index,
  COUNT(*) FILTER (WHERE indexname = 'idx_fund_data_fund_id') as fund_id_index,
  COUNT(*) FILTER (WHERE indexname = 'idx_funds_normalized_name_normalized') as normalized_name_index
FROM pg_indexes
WHERE schemaname = 'public';

-- 4. Test the normalization function
SELECT 
  'Normalization Test' as check_type,
  normalize_fund_name_for_matching('Fund ABC') as test1,
  normalize_fund_name_for_matching('Fund ABC ') as test2,
  normalize_fund_name_for_matching('Fund 8') as test3,
  normalize_fund_name_for_matching('Fund') as test4;

-- Expected results:
-- test1 and test2 should both return 'fund abc'
-- test3 and test4 should both return 'fund'

-- 5. View current data (if any exists)
SELECT 
  f.id as fund_id,
  f.fund_name,
  COUNT(fd.id) as run_count,
  STRING_AGG(DISTINCT fd.run_type, ', ' ORDER BY fd.run_type) as run_types
FROM funds_normalized f
LEFT JOIN fund_data fd ON f.id = fd.fund_id
GROUP BY f.id, f.fund_name
ORDER BY f.created_at DESC
LIMIT 10;
