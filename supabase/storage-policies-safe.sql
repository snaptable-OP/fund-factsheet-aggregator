-- Storage Policies for factsheet-pdfs bucket (Safe version - handles existing policies)
-- Run this in Supabase SQL Editor to allow public uploads

-- Drop existing policies if they exist, then recreate them
DROP POLICY IF EXISTS "Allow public uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow public updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes" ON storage.objects;

-- Allow public to insert (upload) files
CREATE POLICY "Allow public uploads"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'factsheet-pdfs');

-- Allow public to read files
CREATE POLICY "Allow public reads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'factsheet-pdfs');

-- Allow public to update files (optional, for upserts)
CREATE POLICY "Allow public updates"
ON storage.objects
FOR UPDATE
TO public
USING (bucket_id = 'factsheet-pdfs')
WITH CHECK (bucket_id = 'factsheet-pdfs');

-- Allow public to delete files (optional)
CREATE POLICY "Allow public deletes"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'factsheet-pdfs');


