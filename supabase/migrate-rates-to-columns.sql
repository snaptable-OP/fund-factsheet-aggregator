-- Migration script to change consistency_rate and accuracy_rate from JSONB to separate columns
-- Run this in Supabase SQL Editor

-- Add new columns for consistency rates (2 columns)
ALTER TABLE fund_file_upload_tracking
  ADD COLUMN IF NOT EXISTS consistency_rate_second_run NUMERIC(5,2), -- Accuracy percentage for 2nd run
  ADD COLUMN IF NOT EXISTS consistency_rate_third_run NUMERIC(5,2); -- Accuracy percentage for 3rd run

-- Add new columns for accuracy rates (4 columns - F1 scores)
ALTER TABLE fund_file_upload_tracking
  ADD COLUMN IF NOT EXISTS accuracy_rate_first_run NUMERIC(5,2), -- F1 score for 1st run vs ground truth
  ADD COLUMN IF NOT EXISTS accuracy_rate_second_run NUMERIC(5,2), -- F1 score for 2nd run vs ground truth
  ADD COLUMN IF NOT EXISTS accuracy_rate_third_run NUMERIC(5,2), -- F1 score for 3rd run vs ground truth
  ADD COLUMN IF NOT EXISTS accuracy_rate_ai_guided_adjustments NUMERIC(5,2); -- F1 score for AI guided adjustments vs ground truth

-- Note: We'll keep the old JSONB columns for now (can drop them later if needed)
-- The function will be updated to use the new columns
