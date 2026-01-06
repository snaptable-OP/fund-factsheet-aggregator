-- Add columns for storing individual fund saves (1st run, 2nd run, AI guided adjustments, ground truth)
-- Run this in Supabase SQL Editor

DO $$ 
BEGIN
  -- Add first_run_data column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'funds' AND column_name = 'first_run_data'
  ) THEN
    ALTER TABLE funds ADD COLUMN first_run_data JSONB;
  END IF;

  -- Add ai_guided_adjustments_data column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'funds' AND column_name = 'ai_guided_adjustments_data'
  ) THEN
    ALTER TABLE funds ADD COLUMN ai_guided_adjustments_data JSONB;
  END IF;

  -- Add ai_guided_adjustments_saved_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'funds' AND column_name = 'ai_guided_adjustments_saved_at'
  ) THEN
    ALTER TABLE funds ADD COLUMN ai_guided_adjustments_saved_at TIMESTAMPTZ;
  END IF;

  -- Add ground_truth_saved_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'funds' AND column_name = 'ground_truth_saved_at'
  ) THEN
    ALTER TABLE funds ADD COLUMN ground_truth_saved_at TIMESTAMPTZ;
  END IF;

  -- Add first_run_saved_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'funds' AND column_name = 'first_run_saved_at'
  ) THEN
    ALTER TABLE funds ADD COLUMN first_run_saved_at TIMESTAMPTZ;
  END IF;

  -- Add second_run_saved_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'funds' AND column_name = 'second_run_saved_at'
  ) THEN
    ALTER TABLE funds ADD COLUMN second_run_saved_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create indexes for faster queries on saved timestamps
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'funds' AND indexname = 'idx_funds_ai_guided_saved_at'
  ) THEN
    CREATE INDEX idx_funds_ai_guided_saved_at ON funds(ai_guided_adjustments_saved_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'funds' AND indexname = 'idx_funds_ground_truth_saved_at'
  ) THEN
    CREATE INDEX idx_funds_ground_truth_saved_at ON funds(ground_truth_saved_at);
  END IF;
END $$;
