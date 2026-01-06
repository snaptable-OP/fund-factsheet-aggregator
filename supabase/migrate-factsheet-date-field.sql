-- Migration script to rename old field names to fund_factsheet_as_of_date
-- in existing JSONB data stored in fund_data table
-- Run this in Supabase SQL Editor if you have existing data with the old field name

-- Update all fund_data records that have the old field name
UPDATE fund_data
SET data = jsonb_set(
  data - 'factsheetAsOfDate',  -- Remove old field
  '{fund_factsheet_as_of_date}',  -- Add new field
  data->'factsheetAsOfDate'  -- Copy value from old field
)
WHERE data ? 'factsheetAsOfDate'  -- Only update rows that have the old field
  AND NOT (data ? 'fund_factsheet_as_of_date');  -- Don't update if new field already exists

-- Also migrate from the_date_the_fund_info_is_as_of to fund_factsheet_as_of_date
UPDATE fund_data
SET data = jsonb_set(
  data - 'the_date_the_fund_info_is_as_of',  -- Remove old field
  '{fund_factsheet_as_of_date}',  -- Add new field
  data->'the_date_the_fund_info_is_as_of'  -- Copy value from old field
)
WHERE data ? 'the_date_the_fund_info_is_as_of'  -- Only update rows that have the old field
  AND NOT (data ? 'fund_factsheet_as_of_date');  -- Don't update if new field already exists

-- Also migrate from the_date_the_fund_info_is_as_at to fund_factsheet_as_of_date
UPDATE fund_data
SET data = jsonb_set(
  data - 'the_date_the_fund_info_is_as_at',  -- Remove old field
  '{fund_factsheet_as_of_date}',  -- Add new field
  data->'the_date_the_fund_info_is_as_at'  -- Copy value from old field
)
WHERE data ? 'the_date_the_fund_info_is_as_at'  -- Only update rows that have the old field
  AND NOT (data ? 'fund_factsheet_as_of_date');  -- Don't update if new field already exists

-- Also migrate from the_as_of_date_of_the_fund_factsheet_as_stated to fund_factsheet_as_of_date
UPDATE fund_data
SET data = jsonb_set(
  data - 'the_as_of_date_of_the_fund_factsheet_as_stated',  -- Remove old field
  '{fund_factsheet_as_of_date}',  -- Add new field
  data->'the_as_of_date_of_the_fund_factsheet_as_stated'  -- Copy value from old field
)
WHERE data ? 'the_as_of_date_of_the_fund_factsheet_as_stated'  -- Only update rows that have the old field
  AND NOT (data ? 'fund_factsheet_as_of_date');  -- Don't update if new field already exists

-- Verify the migration
-- Run this query to check if any old field names still exist:
-- SELECT COUNT(*) FROM fund_data WHERE data ? 'factsheetAsOfDate' OR data ? 'the_date_the_fund_info_is_as_of' OR data ? 'the_date_the_fund_info_is_as_at' OR data ? 'the_as_of_date_of_the_fund_factsheet_as_stated';

-- If the count is 0, the migration was successful!
