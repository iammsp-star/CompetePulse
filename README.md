# CompetePulse

AI-powered competitive intelligence platform that monitors competitor pricing, features, and messaging changes with automated scraping, change detection, and strategic insights.

**[Live Demo](https://competepulse-demo.vercel.app)** | **[GitHub Repository](https://github.com/iammsp-star/CompetePulse)**

## Features

- **Automated Competitor Monitoring** - Track competitor websites with Firecrawl scraping
- **SHA-256 Change Detection** - Only analyze when content actually changes
- **AI-Powered Insights** - GPT-4o generates strategic analysis and counter-recommendations
- **Gap Analysis Tool** - Compare your website against competitors to find weaknesses and strengths
- **Interactive Dashboard** - Clean UI with dark/light mode, KPIs, and filtering
- **Smart Fallbacks** - Works in demo mode without API keys

## Quick Start

`ash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your API keys to .env.local

# Set up Supabase database
# Run schema.sql in your Supabase SQL Editor

# Start development server
npm run dev
`

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Tech Stack

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Database:** Supabase PostgreSQL
- **Scraping:** Firecrawl API
- **AI:** OpenAI GPT-4o
- **Icons:** Lucide React

## Environment Variables

`env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_key
FIRECRAWL_API_KEY=your_firecrawl_key
`

## License

MIT
