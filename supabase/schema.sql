-- Fund Factsheet Aggregator Database Schema
-- Run this in Supabase SQL Editor

-- Step 1: Drop existing table if it exists
DROP TABLE IF EXISTS funds CASCADE;

-- Step 2: Create funds table with new schema
CREATE TABLE funds (
  id TEXT PRIMARY KEY,
  fund_name TEXT NOT NULL,
  fund_factsheet_as_of_date TEXT NOT NULL,
  fund_launch_date TEXT NOT NULL,
  fund_investment_objective TEXT,
  return_1_year_annualized NUMERIC,
  return_3_year_annualized NUMERIC,
  return_5_year_annualized NUMERIC,
  return_since_launch_annualized NUMERIC,
  calendar_year_return_2024 NUMERIC,
  calendar_year_return_2023 NUMERIC,
  calendar_year_return_2022 NUMERIC,
  asset_classes JSONB, -- Array of {class: string, allocation_percent: number}
  top_10_holdings JSONB, -- Array of {name: string, allocation_percent: number}
  source_file TEXT NOT NULL,
  image_url TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 3: Create indexes for faster queries
CREATE INDEX idx_funds_fund_name ON funds(fund_name);
CREATE INDEX idx_funds_factsheet_date ON funds(fund_factsheet_as_of_date DESC);
CREATE INDEX idx_funds_launch_date ON funds(fund_launch_date DESC);

-- Step 4: Enable Row Level Security (RLS)
ALTER TABLE funds ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policy (allow all operations)
DROP POLICY IF EXISTS "Allow all operations on funds" ON funds;

CREATE POLICY "Allow all operations on funds" ON funds
  FOR ALL
  USING (true)
  WITH CHECK (true);

