-- Remove the unique constraint to allow multiple uploads of the same file
-- Run this in Supabase SQL Editor

-- Drop the existing unique constraint
ALTER TABLE fund_file_upload_tracking
  DROP CONSTRAINT IF EXISTS fund_file_upload_tracking_fund_name_source_file_key;

-- Note: After removing the constraint, each file upload will create a new row
-- even if it's the same file name. You can query by file_uploaded_at to get
-- the most recent upload for a specific fund and file.
