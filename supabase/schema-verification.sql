-- Add columns for 2nd run and ground truth data to funds table
-- Run this in Supabase SQL Editor

-- Check if columns exist before adding them
DO $$ 
BEGIN
  -- Add second_run_data column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'funds' AND column_name = 'second_run_data'
  ) THEN
    ALTER TABLE funds ADD COLUMN second_run_data JSONB;
  END IF;

  -- Add ground_truth_data column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'funds' AND column_name = 'ground_truth_data'
  ) THEN
    ALTER TABLE funds ADD COLUMN ground_truth_data JSONB;
  END IF;

  -- Add verification_status column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'funds' AND column_name = 'verification_status'
  ) THEN
    ALTER TABLE funds ADD COLUMN verification_status TEXT DEFAULT 'pending';
  END IF;
END $$;

-- Create index for verification status if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'funds' AND indexname = 'idx_funds_verification_status'
  ) THEN
    CREATE INDEX idx_funds_verification_status ON funds(verification_status);
  END IF;
END $$;

