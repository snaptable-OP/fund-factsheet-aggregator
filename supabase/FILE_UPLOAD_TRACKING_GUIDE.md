# File Upload Tracking Table Guide

## Overview

The `fund_file_upload_tracking` table tracks timestamps for each fund per file upload. This allows you to see when files were uploaded and when each run (1st, 2nd, 3rd), AI-guided adjustments, and ground truth were completed for each fund.

## Table Structure

The table stores:
- **fund_name**: Name of the fund
- **source_file**: The PDF file name that was uploaded
- **file_uploaded_at**: Date and time when the file was uploaded
- **first_run_completed_at**: Date and time when 1st run finished
- **second_run_completed_at**: Date and time when 2nd run finished
- **third_run_completed_at**: Date and time when 3rd run finished
- **ai_guided_adjustments_saved_at**: Date and time when AI-guided adjustments were saved
- **ground_truth_saved_at**: Date and time when ground truth was saved

## Key Features

1. **One row per fund per file upload**: If the same fund appears in multiple file uploads, each upload gets its own row
2. **Automatic timestamp tracking**: Timestamps are automatically recorded when:
   - A file is uploaded (file_uploaded_at)
   - 1st run completes (first_run_completed_at)
   - 2nd run completes (second_run_completed_at)
   - 3rd run completes (third_run_completed_at)
   - AI-guided adjustments are saved (ai_guided_adjustments_saved_at)
   - Ground truth is saved (ground_truth_saved_at)

## Setup

1. Run the SQL script in Supabase SQL Editor:
   ```sql
   -- Run: supabase/schema-file-upload-tracking.sql
   ```

2. The table and function will be created automatically.

## Usage

### Query all tracking data

```sql
SELECT * FROM fund_file_upload_tracking
ORDER BY file_uploaded_at DESC, fund_name;
```

### Query with duration calculations

```sql
SELECT * FROM fund_upload_timeline
ORDER BY file_uploaded_at DESC;
```

This view includes calculated durations:
- `first_run_duration_seconds`: Time from file upload to 1st run completion
- `second_run_duration_seconds`: Time from 1st run to 2nd run completion
- `third_run_duration_seconds`: Time from 2nd run to 3rd run completion

### Query specific fund

```sql
SELECT * FROM fund_file_upload_tracking
WHERE fund_name = 'Your Fund Name'
ORDER BY file_uploaded_at DESC;
```

### Query funds from specific file

```sql
SELECT * FROM fund_file_upload_tracking
WHERE source_file = 'your-file.pdf'
ORDER BY fund_name;
```

## How It Works

The tracking is automatically handled by the application:

1. **File Upload**: When a PDF is uploaded, `file_uploaded_at` and `first_run_completed_at` are recorded
2. **2nd Run**: When 2nd run verification completes, `second_run_completed_at` is updated
3. **3rd Run**: When 3rd run verification completes, `third_run_completed_at` is updated
4. **AI-Guided Adjustments**: When AI-guided adjustments are saved, `ai_guided_adjustments_saved_at` is updated
5. **Ground Truth**: When ground truth is saved, `ground_truth_saved_at` is updated

## Notes

- The table uses `(fund_name, source_file)` as a unique constraint, so the same fund from different file uploads will have separate rows
- Timestamps are stored in UTC and can be converted to your local timezone in queries
- The tracking function uses partial updates - only non-NULL parameters will update their respective fields
