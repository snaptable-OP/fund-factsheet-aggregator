-- Verify factsheet-pdfs bucket configuration
-- Run this in Supabase SQL Editor to check bucket setup

-- Check if bucket exists and its configuration
SELECT 
  id,
  name,
  public as is_public,
  created_at,
  updated_at
FROM storage.buckets
WHERE name = 'factsheet-pdfs';

-- Check storage policies for the bucket
SELECT 
  policyname as policy_name,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%factsheet%'
ORDER BY policyname;

-- If the bucket doesn't exist, you'll see an error
-- If the bucket exists but is not public, you'll see is_public = false
-- If policies are missing, the second query will return no rows
