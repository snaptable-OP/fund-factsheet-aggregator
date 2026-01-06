# Normalized Database Schema Guide

## Overview

This document describes the normalized database schema for the Fund Factsheet Aggregator. The normalized design separates fund metadata from run-specific data, making it easier to manage multiple runs and data types.

## Schema Design

### Tables

#### 1. `funds_normalized`
Stores basic fund information (one row per unique fund).

**Columns:**
- `id` (UUID, Primary Key): Unique identifier for the fund
- `fund_name` (TEXT, Unique): Name of the fund
- `created_at` (TIMESTAMPTZ): When the fund record was created
- `updated_at` (TIMESTAMPTZ): When the fund record was last updated

#### 2. `fund_data`
Stores all run-specific data (multiple rows per fund, one per run type).

**Columns:**
- `id` (UUID, Primary Key): Unique identifier for the data record
- `fund_id` (UUID, Foreign Key): References `funds_normalized.id`
- `run_type` (TEXT): Type of run - one of:
  - `first_run`
  - `second_run`
  - `third_run`
  - `ai_guided_adjustments`
  - `ground_truth`
- `data` (JSONB): Complete fund data as JSON
- `saved_at` (TIMESTAMPTZ): When this data was saved
- `created_at` (TIMESTAMPTZ): When the record was created
- `updated_at` (TIMESTAMPTZ): When the record was last updated

**Constraints:**
- `UNIQUE(fund_id, run_type)`: Ensures only one record per fund per run type

## Benefits of Normalized Design

1. **Scalability**: Easy to add new run types without altering table structure
2. **Flexibility**: Can store different data structures per run type
3. **Query Efficiency**: Easy to query all runs for a fund or all funds for a run type
4. **Data Integrity**: Foreign key constraints ensure data consistency
5. **Cleaner Schema**: No need for multiple columns per run type

## Helper Functions

### `upsert_fund_data(p_fund_name, p_run_type, p_data)`
Upserts (insert or update) fund data for a specific run type.

**Example:**
```sql
SELECT * FROM upsert_fund_data(
  'My Fund Name',
  'ai_guided_adjustments',
  '{"fundName": "My Fund", "returns": {...}}'::jsonb
);
```

### `get_fund_data_by_run_type(p_fund_name, p_run_type)`
Retrieves fund data for a specific fund and run type.

**Example:**
```sql
SELECT * FROM get_fund_data_by_run_type('My Fund Name', 'ground_truth');
```

## Views

### `funds_with_data`
A view that aggregates all run data for each fund.

**Example Query:**
```sql
SELECT * FROM funds_with_data WHERE fund_name = 'My Fund Name';
```

## Migration Steps

1. **Create the normalized schema:**
   ```sql
   -- Run schema-normalized.sql in Supabase SQL Editor
   ```

2. **Migrate existing data:**
   ```sql
   -- Run migration-to-normalized.sql in Supabase SQL Editor
   ```

3. **Update application code:**
   - Update API routes to use the new schema
   - Update queries to use the new table structure

4. **Test thoroughly:**
   - Verify all data migrated correctly
   - Test saving new data
   - Test loading existing data

5. **Optional: Archive old table:**
   ```sql
   -- After verifying everything works, you can rename the old table
   ALTER TABLE funds RENAME TO funds_old;
   ```

## Example Queries

### Get all runs for a fund
```sql
SELECT 
  fd.run_type,
  fd.data,
  fd.saved_at
FROM fund_data fd
INNER JOIN funds_normalized f ON fd.fund_id = f.id
WHERE f.fund_name = 'My Fund Name'
ORDER BY fd.saved_at DESC;
```

### Get all funds with a specific run type
```sql
SELECT 
  f.fund_name,
  fd.data,
  fd.saved_at
FROM funds_normalized f
INNER JOIN fund_data fd ON f.id = fd.fund_id
WHERE fd.run_type = 'ground_truth'
ORDER BY fd.saved_at DESC;
```

### Get latest data for each run type for a fund
```sql
SELECT DISTINCT ON (fd.run_type)
  fd.run_type,
  fd.data,
  fd.saved_at
FROM fund_data fd
INNER JOIN funds_normalized f ON fd.fund_id = f.id
WHERE f.fund_name = 'My Fund Name'
ORDER BY fd.run_type, fd.saved_at DESC;
```

## API Changes Required

The following API endpoints need to be updated:

1. **`/api/save-fund`**: Update to use `upsert_fund_data()` function or direct inserts
2. **`/api/load-saved-timestamps`**: Update to query `fund_data` table
3. **`/api/process-factsheets`**: May need updates if it stores run data

## Advantages Over Current Schema

| Current Schema | Normalized Schema |
|----------------|-------------------|
| Multiple columns per run type | Single `run_type` column |
| Hard to add new run types | Easy to add new run types |
| Wide table with many NULLs | Narrow, focused tables |
| Complex queries for comparisons | Simple JOIN queries |
| Data duplication | Normalized, no duplication |
