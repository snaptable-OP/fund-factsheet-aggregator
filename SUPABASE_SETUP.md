# Supabase Setup Guide

Follow these steps to set up Supabase for the Fund Factsheet Aggregator.

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in (or create an account)
2. Click **"New Project"** button
3. Fill in the project details:
   - **Name**: `fund-factsheet-aggregator` (or your preferred name)
   - **Database Password**: Create a strong password (⚠️ **SAVE THIS PASSWORD** - you'll need it!)
   - **Region**: Choose the region closest to you
4. Click **"Create new project"**
5. Wait 2-3 minutes for the project to be created

## Step 2: Get Supabase Credentials

1. Once your project is ready, go to **Settings** → **API** (in the left sidebar)
2. You'll see two important values:
   - **Project URL** (e.g., `https://xxxxxxxxxxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)
3. Copy both values - you'll need them for the `.env.local` file

## Step 3: Create Storage Bucket

1. Go to **Storage** in the left sidebar
2. Click **"New bucket"** button
3. Fill in:
   - **Name**: `factsheet-pdfs` (must be exactly this name)
   - **Public bucket**: Toggle this **ON** (important!)
4. Click **"Create bucket"**

## Step 4: Set Up Database Schema

1. Go to **SQL Editor** in the left sidebar
2. Click **"New query"** button
3. Open the file `supabase/schema.sql` from this project
4. Copy **ALL** the contents of that file
5. Paste it into the SQL Editor
6. Click **"Run"** button (or press `Cmd+Enter` / `Ctrl+Enter`)
7. You should see "Success. No rows returned"
8. Verify: Go to **Table Editor** → You should see the `funds` table

## Step 5: Set Up Storage Policies

1. Go back to **SQL Editor**
2. Click **"New query"** again
3. Open the file `supabase/storage-policies.sql` from this project
4. Copy **ALL** the contents of that file
5. Paste it into the SQL Editor
6. Click **"Run"** button
7. You should see "Success. No rows returned"

## Step 6: Configure Environment Variables

1. In your project root, create a file named `.env.local`
2. Copy the contents from `.env.local.example`
3. Replace the placeholder values with your actual Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

4. Save the file

## Step 7: Test the Setup

1. Restart your Next.js dev server:
   ```bash
   # Stop the current server (Ctrl+C)
   npm run dev
   ```

2. Try uploading a sample factsheet PDF
3. Check Supabase:
   - **Storage** → `factsheet-pdfs` bucket → You should see uploaded PDFs
   - **Table Editor** → `funds` table → You should see fund data entries

## Troubleshooting

### "Failed to upload PDF" error
- Make sure the storage bucket is named exactly `factsheet-pdfs`
- Make sure the bucket is set to **Public**
- Make sure you ran the storage policies SQL

### "Failed to store fund data" error
- Make sure you ran the schema.sql file
- Check that the `funds` table exists in Table Editor
- Verify your environment variables are correct

### "Invalid API key" error
- Double-check your `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`
- Make sure there are no extra spaces or quotes
- Restart your dev server after changing `.env.local`

## Next Steps

Once Supabase is set up, you can:
- Upload factsheet PDFs and they'll be stored in Supabase Storage
- Fund data will be automatically saved to the database
- View all processed funds in the Supabase Table Editor

