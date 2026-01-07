-- This script checks if the factsheet-pdfs bucket exists
-- Note: Buckets cannot be created via SQL - they must be created through the Supabase UI
-- 
-- To create the bucket:
-- 1. Go to your Supabase project dashboard
-- 2. Navigate to Storage in the left sidebar
-- 3. Click "New bucket"
-- 4. Name: factsheet-pdfs (must be exactly this name)
-- 5. Toggle "Public bucket" to ON
-- 6. Click "Create bucket"
--
-- After creating the bucket, run the storage-policies.sql script to set up permissions

-- Check if bucket exists (this will return an error if it doesn't exist)
SELECT 
  id,
  name,
  public,
  created_at
FROM storage.buckets
WHERE name = 'factsheet-pdfs';
