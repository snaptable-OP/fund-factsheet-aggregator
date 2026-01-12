-- Migration script to add JSONB data columns and rate columns to existing fund_file_upload_tracking table
-- Run this in Supabase SQL Editor if you already have the table created

-- Add new columns to existing table
ALTER TABLE fund_file_upload_tracking
  ADD COLUMN IF NOT EXISTS first_run_data JSONB,
  ADD COLUMN IF NOT EXISTS second_run_data JSONB,
  ADD COLUMN IF NOT EXISTS third_run_data JSONB,
  ADD COLUMN IF NOT EXISTS ai_guided_adjustments_data JSONB,
  ADD COLUMN IF NOT EXISTS ground_truth_data JSONB,
  ADD COLUMN IF NOT EXISTS consistency_rate JSONB,
  ADD COLUMN IF NOT EXISTS accuracy_rate JSONB;

-- Note: The function upsert_file_upload_tracking will need to be recreated
-- Run the updated schema-file-upload-tracking.sql to update the function
