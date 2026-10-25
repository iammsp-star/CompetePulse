-- ====================================================================
-- CompetePulse - Supabase PostgreSQL Database Schema
-- ====================================================================
-- Tables:
--  1. competitors: Stores monitored companies / brands
--  2. monitored_targets: URLs tracked for changes (e.g. pricing, features)
--  3. snapshots: Scraped page content history & cryptographic hashes
--  4. insights: AI-generated strategic analysis from diffs
-- ====================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables in reverse order if needed (clean reinstall)
-- DROP TABLE IF EXISTS insights CASCADE;
-- DROP TABLE IF EXISTS snapshots CASCADE;
-- DROP TABLE IF EXISTS monitored_targets CASCADE;
-- DROP TABLE IF EXISTS competitors CASCADE;

-- 1. COMPETITORS TABLE
CREATE TABLE IF NOT EXISTS competitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    category VARCHAR(100) DEFAULT 'SaaS',
    description TEXT,
    logo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MONITORED TARGETS TABLE
CREATE TABLE IF NOT EXISTS monitored_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    target_type VARCHAR(50) DEFAULT 'pricing', -- 'pricing', 'features', 'changelog', 'homepage', 'other'
    check_frequency VARCHAR(50) DEFAULT 'hourly', -- 'hourly', 'daily', 'weekly'
    last_scraped_at TIMESTAMPTZ,
    last_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'active', 'changed', 'error'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SNAPSHOTS TABLE
CREATE TABLE IF NOT EXISTS snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id UUID NOT NULL REFERENCES monitored_targets(id) ON DELETE CASCADE,
    content_markdown TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL, -- SHA-256 hex digest
    http_status INTEGER DEFAULT 200,
    metadata JSONB DEFAULT '{}'::jsonb,
    scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. INSIGHTS TABLE
CREATE TABLE IF NOT EXISTS insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_id UUID NOT NULL REFERENCES monitored_targets(id) ON DELETE CASCADE,
    competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL, -- 'pricing_change', 'feature_launch', 'messaging_shift', 'other'
    impact_level VARCHAR(20) NOT NULL, -- 'HIGH', 'MEDIUM', 'LOW'
    summary TEXT NOT NULL,
    key_takeaways JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of 3 bullet points
    suggested_counter_action TEXT NOT NULL,
    diff_content TEXT,
    old_hash VARCHAR(64),
    new_hash VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_monitored_targets_comp ON monitored_targets(competitor_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_target_scraped ON snapshots(target_id, scraped_at DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_hash ON snapshots(content_hash);
CREATE INDEX IF NOT EXISTS idx_insights_competitor ON insights(competitor_id);
CREATE INDEX IF NOT EXISTS idx_insights_target ON insights(target_id);
CREATE INDEX IF NOT EXISTS idx_insights_created_at ON insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_impact ON insights(impact_level);

-- Row Level Security (RLS) setup
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitored_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE insights ENABLE ROW LEVEL SECURITY;

-- Permissive public policies for client and server actions
CREATE POLICY "Public full access to competitors" ON competitors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to monitored_targets" ON monitored_targets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to snapshots" ON snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access to insights" ON insights FOR ALL USING (true) WITH CHECK (true);

-- ====================================================================
-- Initial Seed Data (Optional for immediate testing)
-- ====================================================================

INSERT INTO competitors (id, name, domain, category, description)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'Acme Cloud Analytics', 'acmecloud.io', 'Analytics & Observability', 'Leading enterprise observability and real-time event analytics suite.'),
    ('a0000000-0000-0000-0000-000000000002', 'DevVortex Technologies', 'devvortex.com', 'Developer Tools', 'Collaborative CI/CD pipeline optimization and automated developer workflows.'),
    ('a0000000-0000-0000-0000-000000000003', 'OmniCRM Global', 'omnicrm.app', 'Sales & CRM', 'AI-assisted enterprise sales orchestration and customer tracking platform.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO monitored_targets (id, competitor_id, url, target_type, check_frequency, last_status, last_scraped_at)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'https://acmecloud.io/pricing', 'pricing', 'hourly', 'changed', NOW() - INTERVAL '2 hours'),
    ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'https://devvortex.com/features', 'features', 'daily', 'changed', NOW() - INTERVAL '5 hours'),
    ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'https://omnicrm.app/pricing', 'pricing', 'daily', 'active', NOW() - INTERVAL '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO insights (id, target_id, competitor_id, category, impact_level, summary, key_takeaways, suggested_counter_action, created_at)
VALUES
    (
        'c0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000001',
        'a0000000-0000-0000-0000-000000000001',
        'pricing_change',
        'HIGH',
        'Acme Cloud shifted their entry Pro tier from $49/mo to $89/mo while unbundling real-time log ingestion into a paid add-on. They also discontinued their unlimited free trial in favor of a 14-day time-limited trial.',
        '["Pro tier increased by 81% from $49 to $89/month.", "Real-time log ingestion now costs an extra $0.10/GB over 50GB limit.", "Free tier capped strictly at 10,000 monthly events."]',
        'Launch a targeted landing page highlighting our transparent $49 flat pricing with all-inclusive log ingestion to capture dissatisfied Acme customers.',
        NOW() - INTERVAL '2 hours'
    ),
    (
        'c0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000002',
        'feature_launch',
        'MEDIUM',
        'DevVortex rolled out an AI-assisted pull request review bot and announced native integration with GitLab Enterprise. They are aggressively repositioning towards enterprise engineering teams.',
        '["New AI PR Reviewer tool included in Enterprise plan.", "Native GitLab Enterprise on-prem connector launched.", "Updated hero tagline from Developer Velocity to Enterprise AI DevSecOps."]',
        'Fast-track our own automated PR summarizer in Q4 and publish a side-by-side comparison matrix on security and compliance.',
        NOW() - INTERVAL '5 hours'
    )
ON CONFLICT (id) DO NOTHING;
