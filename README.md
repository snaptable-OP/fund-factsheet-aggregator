# Fund Factsheet Aggregator

A comprehensive web application for aggregating and comparing fund factsheet data including returns, asset allocation, and holdings.

## Features

- 📊 **Comprehensive Fund Data Dashboard**
  - Fund name, launch date, and investment objective
  - Annualized returns (1 year, 3 year, 5 year, since launch)
  - Calendar year returns (2022, 2023, 2024)
  - Asset classes with allocation percentages
  - Top 10 holdings with allocation percentages

- 📤 **Image Upload & Processing**
  - Drag-and-drop or click to upload factsheet images
  - Automatic data extraction via parser API
  - Storage in Supabase

- 📈 **Data Comparison**
  - Side-by-side fund comparison
  - Sortable by name, launch date, or factsheet date
  - Export to Excel functionality

- 🎨 **Modern UI**
  - Responsive design
  - Dark mode support
  - Clean, professional interface

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Deployment**: Vercel

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/fund-factsheet-aggregator.git
   cd fund-factsheet-aggregator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your credentials
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## Setup Guide

For detailed setup instructions, see [SETUP_GUIDE.md](./SETUP_GUIDE.md)

## Project Structure

```
fund-factsheet-aggregator/
├── app/
│   ├── api/
│   │   └── process-factsheets/    # API route for processing factsheets
│   ├── globals.css                 # Global styles
│   └── page.tsx                    # Main page
├── components/
│   └── funds/
│       ├── file-upload.tsx         # File upload component
│       ├── funds-dashboard.tsx      # Dashboard component
│       └── processing-status.tsx   # Status indicator
├── lib/
│   └── supabase/
│       ├── client.ts              # Client-side Supabase
│       └── server.ts               # Server-side Supabase
├── supabase/
│   ├── schema.sql                  # Database schema
│   └── storage-policies.sql        # Storage policies
├── types/
│   └── fund.ts                    # TypeScript types
└── SETUP_GUIDE.md                 # Complete setup guide
```

## Data Schema

The application expects the following data structure from the parser API:

- Fund identification: name, launch date, factsheet date, investment objective
- Returns: 1/3/5 year annualized, since launch, calendar years 2022-2024
- Asset classes: array of class names and allocation percentages
- Holdings: top 10 holdings with names and allocation percentages

See `types/fund.ts` for the complete TypeScript interface.

## License

MIT
