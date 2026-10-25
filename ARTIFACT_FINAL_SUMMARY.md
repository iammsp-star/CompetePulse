# CompetePulse - Final Summary

## Quick Start Guide

### 1. Install Dependencies (Already Done)
`ash
npm install
`

### 2. Environment Configuration
The app includes .env.local with placeholders. Update with your API keys:

`env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
OPENAI_API_KEY=your-openai-api-key-here
FIRECRAWL_API_KEY=your-firecrawl-api-key-here
`

**Note:** The app has intelligent fallback modes - it works without API keys using in-memory data, simulated scraping, and heuristic AI analysis.

### 3. Database Setup (Supabase)
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor in your Supabase dashboard
3. Copy and paste the contents of schema.sql
4. Run the SQL script to create all tables, indexes, RLS policies, and seed data
5. Get your project URL and anon key from Project Settings > API
6. Update .env.local with these values

### 4. Start Development Server
`ash
npm run dev
`
Open [http://localhost:3000](http://localhost:3000)

### 5. Build for Production
`ash
npm run build
npm start
`

## Features

### Dashboard
- **KPI Summary Bar**: Track total competitors, pages scraped, high-impact changes, and AI insights
- **AI Strategic Feed**: View AI-generated insights with impact badges, summaries, key takeaways, and suggested counter-actions
- **Monitored Competitors Tab**: Manage competitors and manually trigger analysis
- **Dark/Light Mode**: Toggle theme with persistent preference
- **Filtering & Search**: Filter insights by impact level, category, or search terms

### Core Functionality
- **Quick Add Competitor**: Modal form to add competitor name and target URL
- **Run Analysis**: One-click scraping and AI analysis per competitor
- **SHA-256 Change Detection**: Only runs AI when content actually changes (saves API costs)
- **Firecrawl Integration**: Scrapes pages with markdown output
- **OpenAI GPT-4o**: Generates strategic insights with structured output
- **Diff Viewer**: View raw text differences between snapshots
- **Smart Fallbacks**: Works offline/demo mode without API keys

## API Keys Guide

| Service | Where to Get | Purpose |
|---------|--------------|---------|
| [Supabase](https://supabase.com) | Project Settings > API | Database storage |
| [OpenAI](https://platform.openai.com/api-keys) | API Keys page | AI analysis with GPT-4o |
| [Firecrawl](https://www.firecrawl.dev) | Dashboard > API Keys | Web scraping |

## Testing
The app has been tested with:
- ? Dashboard loads correctly with seeded data
- ? API endpoints respond properly
- ? Analysis flow works (scrape ? hash check ? AI analysis)
- ? Fallback mechanisms function without API keys
- ? UI is responsive and polished

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Lucide icons
- **Database**: Supabase PostgreSQL
- **Scraping**: Firecrawl API
- **AI**: OpenAI GPT-4o via OpenAI SDK
- **Utilities**: crypto (SHA-256), diff, zod
