import type { Competitor, Insight, Target, TargetType } from '../shared/types';
import { dbh, getSettings, mapInsight } from './db';
import { daysAgoIso, nowIso, startOfWeekIso, uid } from './lib/util';
import { DEMO_PROFILES, renderDemoContent } from './services/demo';
import { CAPABILITIES, CAPABILITY_STATUS } from './services/capabilities';
import { generateDigestMarkdown } from './services/analysis';
import { ingestPage } from './services/pipeline';

const TARGET_TYPES: TargetType[] = ['pricing', 'changelog', 'landing'];

const SCENARIOS: Record<string, { variants: number[]; days: number[]; frequency: Target['frequency'] }> = {
  pricing: { variants: [0, 1, 2], days: [20, 12, 3], frequency: 'daily' },
  changelog: { variants: [0, 1, 2], days: [19, 11, 2], frequency: 'weekly' },
  landing: { variants: [0, 1], days: [10, 1], frequency: 'weekly' },
};

function pageTitle(name: string, type: TargetType): string {
  if (type === 'pricing') return `${name} Pricing`;
  if (type === 'changelog') return `${name} Changelog`;
  if (type === 'landing') return `${name} — Homepage`;
  return `${name} — ${type}`;
}

export async function seedIfEmpty(): Promise<boolean> {
  const count = Number(dbh.one<{ n: number }>('SELECT COUNT(*) AS n FROM competitors')?.n ?? 0);
  if (count > 0) return false;
  console.info('[seed] Creating demo workspace…');
  const settings = getSettings();

  for (const [profileIndex, profile] of DEMO_PROFILES.entries()) {
    const competitor: Competitor = {
      id: uid('cmp_'),
      name: profile.name,
      domain: profile.domain,
      industry: profile.industry,
      tier: profile.tier,
      description: profile.description,
      color: profile.color,
      createdAt: daysAgoIso(180 - profileIndex * 7, 10),
    };
    dbh.run(
      `INSERT INTO competitors (id, name, domain, industry, tier, description, color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      competitor.id,
      competitor.name,
      competitor.domain,
      competitor.industry,
      competitor.tier,
      competitor.description,
      competitor.color,
      competitor.createdAt,
    );

    const statuses = CAPABILITY_STATUS[profile.name] ?? [];
    for (const [capIndex, capability] of CAPABILITIES.entries()) {
      dbh.run(
        'INSERT OR IGNORE INTO features (id, competitor_id, name, category, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
        uid('ftr_'),
        competitor.id,
        capability.name,
        capability.category,
        statuses[capIndex] ?? 'none',
        '',
      );
    }

    for (const type of TARGET_TYPES) {
      const scenario = SCENARIOS[type];
      const targetId = uid('tgt_');
      dbh.run(
        `INSERT INTO targets (id, competitor_id, type, url, frequency, enabled, last_status)
         VALUES (?, ?, ?, ?, ?, 1, 'pending')`,
        targetId,
        competitor.id,
        type,
        `https://${profile.domain}/${type === 'landing' ? '' : type}`,
        scenario.frequency,
      );
      const targetRow = dbh.one<Record<string, unknown>>('SELECT * FROM targets WHERE id = ?', targetId)!;
      const target: Target = {
        id: String(targetRow.id),
        competitorId: String(targetRow.competitor_id),
        type: String(targetRow.type) as TargetType,
        url: String(targetRow.url),
        frequency: String(targetRow.frequency) as Target['frequency'],
        enabled: 1,
        lastScrapedAt: null,
        nextScrapeAt: null,
        lastStatus: 'pending',
        lastError: null,
      };

      for (const [index, variant] of scenario.variants.entries()) {
        const capturedAt = daysAgoIso(scenario.days[index], 8 + index);
        const markdown = renderDemoContent(profile, type, variant);
        await ingestPage({
          competitor,
          target,
          page: {
            title: pageTitle(profile.name, type),
            markdown,
            screenshotUrl: null,
            mode: 'seed',
            provider: 'seed',
            wordCount: markdown.split(/\s+/).length,
          },
          capturedAt,
          settings,
          useLlm: false,
          notify: false,
          latencyMs: 38_000 + ((profileIndex * 7919 + index * 4271) % 55_000),
        });
      }

      const latestSnapshot = dbh.one<{ id: string; captured_at: string }>(
        'SELECT id, captured_at FROM snapshots WHERE target_id = ? ORDER BY captured_at DESC LIMIT 1',
        targetId,
      );
      if (latestSnapshot) {
        const startedAt = latestSnapshot.captured_at;
        const finishedAt = new Date(new Date(startedAt).getTime() + 46_000).toISOString();
        dbh.run(
          `INSERT INTO scrape_runs (id, competitor_id, target_id, trigger, status, started_at, finished_at, error, snapshot_id, latency_ms, mode)
           VALUES (?, ?, ?, 'seed', 'success', ?, ?, NULL, ?, ?, 'seed')`,
          uid('run_'),
          competitor.id,
          targetId,
          startedAt,
          finishedAt,
          latestSnapshot.id,
          46_000,
        );
      }

      const newest = scenario.days[scenario.days.length - 1];
      const next = new Date();
      next.setUTCDate(next.getUTCDate() + (scenario.frequency === 'daily' ? 1 : 6 - (profileIndex % 4)));
      next.setUTCHours(7 + (profileIndex % 6), (profileIndex * 13) % 60, 0, 0);
      dbh.run(
        'UPDATE targets SET last_scraped_at = ?, next_scrape_at = ?, last_status = ? WHERE id = ?',
        daysAgoIso(newest, 9),
        next.toISOString(),
        'success',
        targetId,
      );
    }
  }

  const highImpact = dbh.all<Record<string, unknown>>(
    `SELECT i.*, c.name AS competitor_name, c.color AS competitor_color
     FROM insights i JOIN competitors c ON c.id = i.competitor_id
     WHERE i.impact = 'high' ORDER BY i.created_at DESC LIMIT 3`,
  );
  highImpact.forEach((row, index) => {
    const insight = mapInsight(row);
    const createdAt = new Date(new Date(insight.createdAt).getTime() + 90_000).toISOString();
    dbh.run('UPDATE insights SET notified = 1 WHERE id = ?', insight.id);
    dbh.run(
      `INSERT INTO notifications (id, insight_id, competitor_id, channel, destination, status, detail, payload, created_at)
       VALUES (?, ?, ?, 'slack', 'demo workspace', 'simulated', ?, '', ?)`,
      uid('ntf_'),
      insight.id,
      insight.competitorId,
      'Simulated delivery — connect a Slack webhook in Settings to send real alerts',
      createdAt,
    );
    if (index === 1) {
      dbh.run(
        `INSERT INTO notifications (id, insight_id, competitor_id, channel, destination, status, detail, payload, created_at)
         VALUES (?, ?, ?, 'email', 'leadership@competepulse.app', 'simulated', ?, '', ?)`,
        uid('ntf_'),
        insight.id,
        insight.competitorId,
        'Simulated delivery — configure Resend to email the briefing list',
        createdAt,
      );
    }
  });

  // Two historical weekly briefings so the Digest tab has context on first load.
  const currentWeek = new Date(startOfWeekIso());
  for (let weeksBack = 2; weeksBack >= 1; weeksBack--) {
    const start = new Date(currentWeek.getTime() - weeksBack * 7 * 86400000);
    const end = new Date(start.getTime() + 7 * 86400000);
    const rows = dbh.all<Record<string, unknown>>(
      `SELECT i.*, c.name AS competitor_name, c.color AS competitor_color
       FROM insights i JOIN competitors c ON c.id = i.competitor_id
       WHERE i.created_at >= ? AND i.created_at < ? ORDER BY i.created_at DESC`,
      start.toISOString(),
      end.toISOString(),
    );
    const insights: Insight[] = rows.map(mapInsight);
    if (!insights.length) continue;
    const content = await generateDigestMarkdown({
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      insights,
      productName: settings.ourProduct,
      useLlm: false,
    });
    dbh.run(
      `INSERT INTO digests (id, week_start, week_end, title, content_md, created_at, insight_count, high_impact_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      uid('dgt_'),
      start.toISOString(),
      end.toISOString(),
      `Competitive Intelligence Briefing — ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      content,
      new Date(end.getTime() + 8 * 3600000).toISOString(),
      insights.length,
      insights.filter((i) => i.impact === 'high').length,
    );
  }

  console.info('[seed] Demo workspace ready:', `${DEMO_PROFILES.length} competitors, 18 monitored pages`);
  return true;
}

/** Used by `npm run scan` to force a scan against every enabled target. */
export async function ensureSeeded(): Promise<void> {
  await seedIfEmpty();
  void nowIso;
}
