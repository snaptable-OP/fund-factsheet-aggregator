# Fund Factsheet Aggregator - Complete Setup Guide

This guide will walk you through setting up the Fund Factsheet Aggregator project from scratch.

## Table of Contents
1. [Supabase Setup](#supabase-setup)
2. [Data Parser API Setup](#data-parser-api-setup)
3. [GitHub Setup](#github-setup)
4. [Vercel Deployment](#vercel-deployment)
5. [Environment Variables](#environment-variables)

---

## 1. Supabase Setup

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in:
   - **Name**: `fund-factsheet-aggregator` (or your preferred name)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
4. Click "Create new project"
5. Wait for project to be created (2-3 minutes)

### Step 2: Get Supabase Credentials

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)

### Step 3: Create Storage Bucket

1. Go to **Storage** in left sidebar
2. Click **"New bucket"**
3. Name: `factsheet-pdfs`
4. Set to **Public** (toggle ON)
5. Click **"Create bucket"**

### Step 4: Set Up Database Schema

1. Go to **SQL Editor** in left sidebar
2. Click **"New query"**
3. Copy and paste the contents of `supabase/schema.sql`
4. Click **"Run"** (or press Cmd/Ctrl + Enter)
5. Verify: Go to **Table Editor** → You should see the `funds` table

### Step 5: Set Up Storage Policies

1. Go back to **SQL Editor**
2. Copy and paste the contents of `supabase/storage-policies.sql`
3. Click **"Run"**
4. Verify: Try uploading a test file in Storage (should work without errors)

---

## 2. Data Parser API Setup

### Step 1: Configure Your Parser API

Your parser API should accept POST requests with this format:

**Request:**
```json
{
  "image": "https://your-supabase-url.com/storage/v1/object/public/factsheet-pdfs/..."
}
```

**Expected Response:**
```json
{
  "fund_name": "Example Fund",
  "fund_factsheet_as_of_date": "2024-12-31",
  "fund_launch_date": "2020-01-15",
  "fund_investment_objective": "Long-term capital appreciation",
  "return_1_year_annualized": 12.5,
  "return_3_year_annualized": 15.3,
  "return_5_year_annualized": 14.8,
  "return_since_launch_annualized": 16.2,
  "calendar_year_return_2024": 12.5,
  "calendar_year_return_2023": 18.3,
  "calendar_year_return_2022": -5.2,
  "asset_classes": [
    {"class": "Equities", "allocation_percent": 60},
    {"class": "Fixed Income", "allocation_percent": 30},
    {"class": "Cash", "allocation_percent": 10}
  ],
  "top_10_holdings": [
    {"name": "Apple Inc", "allocation_percent": 5.2},
    {"name": "Microsoft Corp", "allocation_percent": 4.8},
    ...
  ]
}
```

### Step 2: Get API Credentials

- **API URL**: Your parser API endpoint
- **API Key**: Your authentication token (if required)

---

## 3. GitHub Setup

### Step 1: Create GitHub Repository

1. Go to [github.com](https://github.com)
2. Click **"New repository"**
3. Name: `fund-factsheet-aggregator`
4. Set to **Private** (or Public, your choice)
5. **Don't** initialize with README, .gitignore, or license
6. Click **"Create repository"**

### Step 2: Push Code to GitHub

1. Open terminal in your project directory:
   ```bash
   cd /Users/annieliang/fund-factsheet-aggregator
   ```

2. Initialize Git (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Fund Factsheet Aggregator"
   ```

3. Add remote and push:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/fund-factsheet-aggregator.git
   git branch -M main
   git push -u origin main
   ```

   Replace `YOUR_USERNAME` with your GitHub username.

---

## 4. Vercel Deployment

### Step 1: Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click **"Add New..."** → **"Project"**
4. Import your `fund-factsheet-aggregator` repository
5. Configure:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `.` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

### Step 2: Add Environment Variables

Before deploying, add these environment variables in Vercel:

1. Go to **Settings** → **Environment Variables**
2. Add each variable:

   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   DATA_PARSER_API_URL=your_parser_api_url
   DATA_PARSER_API_KEY=your_parser_api_key
   ```

3. Make sure to add them for:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

4. Click **"Save"**

### Step 3: Deploy

1. Click **"Deploy"**
2. Wait for deployment to complete (2-3 minutes)
3. Your app will be live at: `https://fund-factsheet-aggregator.vercel.app`

### Step 4: Disable Preview Protection (Optional)

If your site requires login:

1. Go to **Settings** → **Deployment Protection**
2. Set **Preview Deployment Protection** to **"None"**
3. Set **Production Deployment Protection** to **"None"**
4. Click **"Save"**

---

## 5. Environment Variables

Create a `.env.local` file in your project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Data Parser API Configuration
DATA_PARSER_API_URL=https://your-parser-api.com/api/parse
DATA_PARSER_API_KEY=your_api_key_here
```

**Important:** 
- Never commit `.env.local` to Git (it's already in `.gitignore`)
- Add these same variables in Vercel (Settings → Environment Variables)

---

## 6. Testing

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Open: `http://localhost:3000`

3. Upload a fund factsheet image

4. Verify:
   - Image uploads to Supabase Storage
   - Data is parsed by your API
   - Data appears in Supabase Database
   - Dashboard displays the fund information

---

## Troubleshooting

### "Supabase is not configured"
- Check `.env.local` file exists
- Verify environment variables are set correctly
- Restart dev server after adding variables

### "Failed to upload image"
- Check Supabase Storage bucket exists and is public
- Verify storage policies are set correctly
- Check Supabase credentials

### "Parser API error"
- Verify API URL is correct
- Check API key is valid
- Test API endpoint directly with Postman/curl

### "No fund data returned"
- Check parser API response format matches expected schema
- Check browser console for errors
- Verify API is returning valid JSON

---

## Next Steps

- Customize the dashboard UI
- Add more data fields if needed
- Set up custom domain in Vercel
- Configure email notifications (optional)

---

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check Vercel deployment logs
3. Check Supabase logs
4. Verify all environment variables are set correctly

