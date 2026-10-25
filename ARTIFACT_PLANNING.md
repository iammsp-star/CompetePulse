# CompetePulse - Planning Document

## Project Overview
CompetePulse is an AI Competitor Research & Intelligence Tool built with Next.js 14, TypeScript, Tailwind CSS, Shadcn UI patterns, Supabase, Firecrawl, and OpenAI GPT-4o.

## Architecture Plan

### Folder Structure
`
+-- app/                    # Next.js App Router
¦   +-- api/               # API routes
¦   ¦   +-- analyze/       # Scrape + AI analysis endpoint
¦   ¦   +-- competitors/   # CRUD for competitors
¦   ¦   +-- insights/      # Fetch insights
¦   ¦   +-- status/        # System status
¦   +-- globals.css        # Global styles with themes
¦   +-- layout.tsx         # Root layout
¦   +-- page.tsx           # Dashboard page
+-- components/            # React components
¦   +-- AddCompetitorModal.tsx
¦   +-- CompetitorCard.tsx
¦   +-- DiffViewerModal.tsx
¦   +-- InsightCard.tsx
¦   +-- KpiSummary.tsx
¦   +-- Navbar.tsx
+-- lib/                   # Utilities and core logic
¦   +-- ai.ts             # OpenAI GPT-4o analysis
¦   +-- scraper.ts        # Firecrawl + SHA-256 diff engine
¦   +-- supabase.ts       # DB client + fallbacks
¦   +-- utils.ts          # Helper functions
+-- schema.sql            # Supabase schema
+-- .env.local            # Environment variables
`

## Core Features Implementation

### 1. Scraper & Diff Engine
- **Firecrawl Integration**: Fetches page markdown using @mendable/firecrawl-js
- **SHA-256 Hashing**: Computes content hash to detect changes
- **Smart Fallbacks**: Falls back to web fetch or intelligent simulation if APIs unavailable
- **Diff Generation**: Uses diff package to create unified diffs
- **Change Detection**: Only runs AI analysis if content hash differs

### 2. AI Analysis
- **OpenAI GPT-4o**: Structured JSON output with schema validation
- **Heuristic Fallback**: Rule-based analysis when API unavailable
- **Output Schema**: category, impact_level, summary, key_takeaways[], suggested_counter_action

### 3. Dashboard UI
- **Dark/Light Mode**: Theme toggle with CSS variables
- **KPI Summary**: Total competitors, pages scraped, high impact changes, total insights
- **Quick Add Modal**: Form to add competitor name and target URL
- **Competitor Cards**: Display with \"Run Analysis\" button for manual triggering
- **Insights Feed**: Impact badges (HIGH/MEDIUM/LOW), summary, takeaways, diff viewer
- **Filtering**: Search, impact filter, category filter

### 4. Data Layer
- **Supabase PostgreSQL**: Primary database with RLS
- **In-Memory Fallback**: Works without database/API keys for demo
- **Tables**: competitors, monitored_targets, snapshots, insights

## Implementation Status
? All core features implemented and tested
? Dev server running on http://localhost:3000
? API endpoints functional
? UI components complete
? Fallback mechanisms in place
