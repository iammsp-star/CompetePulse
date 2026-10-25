import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Category, Competitor, Impact, Settings, Target, TargetType } from '../shared/types';
import {
  dbh,
  feedInsights,
  getCompetitor,
  getDiff,
  getInsight,
  getSettings,
  getSnapshot,
  getStats,
  listCompetitors,
  listRuns,
  listTargets,
  mapDiff,
  mapFeature,
  mapInsight,
  mapNotification,
  saveSettings,
  DEFAULT_SETTINGS,
} from './db';
import { nowIso, startOfWeekIso, uid } from './lib/util';
import { scanCompetitor, scanTarget } from './services/pipeline';
import { answerFromResults, providerStatus } from './services/analysis';
import { embedTexts, embeddingsProvider } from './services/embeddings';
import { searchChunks } from './services/vectorStore';
import { deliverInsight, testSlack } from './services/notify';
import { createDigest, currentWeekRange, insightsInRange, previousWeekRange } from './services/digest';
import { diffMarkdown } from './services/diff';

const router = Router();

type Handler = (req: Request, res: Response) => Promise<unknown> | unknown;
const wrap = (handler: Handler) => (req: Request, res: Response) => {
  Promise.resolve(handler(req, res)).catch((error: unknown) => {
    console.error('[api]', error);
    if (!res.headersSent) res.status(500).json({ error: (error as Error).message || 'Internal error' });
  });
};

const tiers = z.enum(['tier1', 'tier2', 'tier3']);
const frequencies = z.enum(['daily', 'weekly', 'on_demand']);
const targetTypes = z.enum(['pricing', 'changelog', 'blog', 'landing', 'docs']);
const impacts = z.enum(['high', 'medium', 'low']);
const categories = z.enum(['pricing', 'feature', 'messaging', 'partnership', 'other']);
const PALETTE = ['#6ee7b7', '#60a5fa', '#c084fc', '#f59e0b', '#f472b6', '#94a3b8', '#2dd4bf', '#fb7185'];

const competitorSchema = z.object({
  name: z.string().trim().min(1).max(80),
  domain: z.string().trim().min(3).max(160),
  industry: z.string().trim().max(80).optional().default(''),
  tier: tiers.default('tier2'),
  description: z.string().trim().max(400).optional().default(''),
  urls: z
    .object({
      pricing: z.string().url().optional(),
      changelog: z.string().url().optional(),
      landing: z.string().url().optional(),
      blog: z.string().url().optional(),
      docs: z.string().url().optional(),
    })
    .optional(),
  frequency: frequencies.optional(),
});

const targetSchema = z.object({
  competitorId: z.string().min(1),
  type: targetTypes,
  url: z.string().url(),
  frequency: frequencies.default('weekly'),
});

function competitorMentionedIn(query: string): string | undefined {
  const lower = query.toLowerCase();
  const matches = listCompetitors().filter((competitor) => {
    const name = competitor.name.toLowerCase();
    if (lower.includes(name)) return true;
    const first = name.split(/\s+/)[0];
    return first.length >= 4 && lower.includes(first);
  });
  return matches.length === 1 ? matches[0].id : undefined;
}

function normalizeDomain(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./i, '')
    .toLowerCase();
}

function sanitize<T>(schema: z.ZodType<T>, value: unknown, res: Response): T | null {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
    return null;
  }
  return parsed.data;
}

function addTarget(competitorId: string, type: TargetType, url: string, frequency: Target['frequency'] = 'weekly') {
  const id = uid('tgt_');
  dbh.run(
    `INSERT INTO targets (id, competitor_id, type, url, frequency, enabled, last_status) VALUES (?, ?, ?, ?, ?, 1, 'pending')`,
    id,
    competitorId,
    type,
    url,
    frequency,
  );
  return id;
}

router.get('/health', (_req, res) => {
  const count = Number(dbh.one<{ n: number }>('SELECT COUNT(*) AS n FROM competitors')?.n ?? 0);
  res.json({ ok: true, competitors: count, time: nowIso(), providers: providerStatus() });
});

/* ---------------------------------- stats --------------------------------- */

router.get('/stats', (_req, res) => {
  res.json(getStats());
});

/* ------------------------------- competitors ------------------------------ */

router.get('/competitors', (_req, res) => {
  res.json({ competitors: listCompetitors() });
});

router.get(
  '/competitors/:id',
  wrap((req, res) => {
    const competitor = getCompetitor(req.params.id);
    if (!competitor) return res.status(404).json({ error: 'Competitor not found' });
    const snapshots = dbh
      .all<Record<string, unknown>>(
        `SELECT s.*, EXISTS(SELECT 1 FROM diffs d WHERE d.snapshot_id = s.id) AS has_diff
         FROM snapshots s WHERE s.competitor_id = ? ORDER BY s.captured_at DESC LIMIT 80`,
        competitor.id,
      )
      .map((row) => ({
        id: String(row.id),
        competitorId: String(row.competitor_id),
        targetId: String(row.target_id),
        capturedAt: String(row.captured_at),
        title: String(row.title),
        contentMd: String(row.content_md),
        contentHash: String(row.content_hash),
        wordCount: Number(row.word_count),
        screenshotUrl: row.screenshot_url ? String(row.screenshot_url) : null,
        mode: String(row.mode),
        changed: Number(row.changed),
        hasDiff: Boolean(row.has_diff),
      }));
    const insights = dbh
      .all<Record<string, unknown>>(
        `SELECT i.*, c.name AS competitor_name, c.color AS competitor_color
         FROM insights i JOIN competitors c ON c.id = i.competitor_id
         WHERE i.competitor_id = ? ORDER BY i.created_at DESC LIMIT 80`,
        competitor.id,
      )
      .map(mapInsight);
    const features = dbh
      .all<Record<string, unknown>>('SELECT * FROM features WHERE competitor_id = ? ORDER BY category, name', competitor.id)
      .map(mapFeature);
    const targets = competitor.targets ?? listTargets(competitor.id);
    res.json({
      competitor: { ...competitor, targets },
      targets,
      snapshots,
      insights,
      features,
      runs: listRuns(competitor.id, 20),
    });
  }),
);

router.post(
  '/competitors',
  wrap((req, res) => {
    const data = sanitize(competitorSchema, req.body, res);
    if (!data) return;
    const domain = normalizeDomain(data.domain);
    const id = uid('cmp_');
    const count = Number(dbh.one<{ n: number }>('SELECT COUNT(*) AS n FROM competitors')?.n ?? 0);
    const color = PALETTE[count % PALETTE.length];
    dbh.run(
      `INSERT INTO competitors (id, name, domain, industry, tier, description, color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      data.name,
      domain,
      data.industry ?? '',
      data.tier ?? 'tier2',
      data.description ?? '',
      color,
      nowIso(),
    );
    const frequency = data.frequency ?? 'weekly';
    const urls = data.urls ?? {};
    addTarget(id, 'pricing', urls.pricing ?? `https://${domain}/pricing`, data.frequency ?? 'daily');
    addTarget(id, 'changelog', urls.changelog ?? `https://${domain}/changelog`, frequency);
    addTarget(id, 'landing', urls.landing ?? `https://${domain}/`, frequency);
    for (const type of ['blog', 'docs'] as const) {
      if (urls[type]) addTarget(id, type, urls[type]!, frequency);
    }
    res.status(201).json({ competitor: getCompetitor(id) });
  }),
);

router.patch(
  '/competitors/:id',
  wrap((req, res) => {
    const existing = getCompetitor(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Competitor not found' });
    const schema = competitorSchema.partial().omit({ urls: true, frequency: true });
    const data = sanitize(schema, req.body, res);
    if (!data) return;
    const fields: string[] = [];
    const params: (string | null)[] = [];
    for (const key of ['name', 'industry', 'tier', 'description'] as const) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(data[key] as string);
      }
    }
    if (data.domain !== undefined) {
      fields.push('domain = ?');
      params.push(normalizeDomain(data.domain));
    }
    if (fields.length) {
      dbh.run(`UPDATE competitors SET ${fields.join(', ')} WHERE id = ?`, ...params, existing.id);
    }
    res.json({ competitor: getCompetitor(existing.id) });
  }),
);

router.delete('/competitors/:id', (req, res) => {
  const existing = getCompetitor(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Competitor not found' });
  dbh.run(
    'DELETE FROM notifications WHERE competitor_id = ? OR insight_id IN (SELECT id FROM insights WHERE competitor_id = ?)',
    existing.id,
    existing.id,
  );
  dbh.run('DELETE FROM scrape_runs WHERE competitor_id = ?', existing.id);
  dbh.run('DELETE FROM competitors WHERE id = ?', existing.id);
  res.json({ ok: true });
});

/* --------------------------------- targets -------------------------------- */

router.get('/targets', (req, res) => {
  res.json({ targets: listTargets(req.query.competitorId ? String(req.query.competitorId) : undefined) });
});

router.post(
  '/targets',
  wrap((req, res) => {
    const data = sanitize(targetSchema, req.body, res);
    if (!data) return;
    if (!getCompetitor(data.competitorId)) return res.status(404).json({ error: 'Competitor not found' });
    const id = addTarget(data.competitorId, data.type, data.url, data.frequency);
    res.status(201).json({ target: listTargets().find((t) => t.id === id) });
  }),
);

router.patch(
  '/targets/:id',
  wrap((req, res) => {
    const schema = z
      .object({ url: z.string().url(), frequency: frequencies, enabled: z.boolean() })
      .partial();
    const data = sanitize(schema, req.body, res);
    if (!data) return;
    const existing = dbh.one<Record<string, unknown>>('SELECT * FROM targets WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Target not found' });
    const fields: string[] = [];
    const params: (string | number | null)[] = [];
    if (data.url !== undefined) {
      fields.push('url = ?');
      params.push(data.url);
    }
    if (data.frequency !== undefined) {
      fields.push('frequency = ?');
      params.push(data.frequency);
    }
    if (data.enabled !== undefined) {
      fields.push('enabled = ?');
      params.push(data.enabled ? 1 : 0);
    }
    if (fields.length) dbh.run(`UPDATE targets SET ${fields.join(', ')} WHERE id = ?`, ...params, String(existing.id));
    res.json({ target: listTargets().find((t) => t.id === String(existing.id)) });
  }),
);

router.delete('/targets/:id', (req, res) => {
  const existing = dbh.one<Record<string, unknown>>('SELECT * FROM targets WHERE id = ?', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Target not found' });
  dbh.run('DELETE FROM diffs WHERE target_id = ?', String(existing.id));
  dbh.run('DELETE FROM insights WHERE target_id = ?', String(existing.id));
  dbh.run('DELETE FROM chunks WHERE target_id = ?', String(existing.id));
  dbh.run('DELETE FROM snapshots WHERE target_id = ?', String(existing.id));
  dbh.run('DELETE FROM targets WHERE id = ?', String(existing.id));
  res.json({ ok: true });
});

/* ---------------------------------- scans --------------------------------- */

router.post(
  '/scan',
  wrap(async (req, res) => {
    const schema = z.object({
      competitorId: z.string().optional(),
      targetId: z.string().optional(),
    });
    const data = sanitize(schema, req.body ?? {}, res);
    if (!data) return;
    if (data.targetId) {
      try {
        const outcome = await scanTarget(data.targetId, 'manual');
        return res.json({
          results: [
            {
              run: outcome.run,
              changed: outcome.changed,
              unchanged: outcome.unchanged,
              insights: outcome.insights.length,
              snapshotId: outcome.snapshot?.id ?? null,
            },
          ],
          insights: outcome.insights,
        });
      } catch (error) {
        return res.status(502).json({ error: (error as Error).message });
      }
    }

    const competitors = data.competitorId
      ? listCompetitors().filter((c) => c.id === data.competitorId)
      : listCompetitors();
    if (!competitors.length) return res.status(404).json({ error: 'Competitor not found' });
    const results: unknown[] = [];
    let insightCount = 0;
    for (const competitor of competitors.slice(0, 8)) {
      const outcomes = await scanCompetitor(competitor.id, 'manual');
      for (const outcome of outcomes) {
        insightCount += outcome.insights.length;
        results.push({
          competitor: competitor.name,
          run: outcome.run,
          changed: outcome.changed,
          unchanged: outcome.unchanged,
          insights: outcome.insights.length,
          snapshotId: outcome.snapshot?.id ?? null,
        });
      }
    }
    res.json({ results, insights: insightCount, scanned: results.length });
  }),
);

router.get('/runs', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 30) || 30, 100);
  const rows = dbh.all<Record<string, unknown>>(
    `SELECT r.*, c.name AS competitor_name, t.type AS target_type
     FROM scrape_runs r
     LEFT JOIN competitors c ON c.id = r.competitor_id
     LEFT JOIN targets t ON t.id = r.target_id
     ORDER BY r.started_at DESC LIMIT ?`,
    limit,
  );
  res.json({
    runs: rows.map((row) => ({
      id: String(row.id),
      competitorId: String(row.competitor_id),
      targetId: String(row.target_id),
      trigger: String(row.trigger),
      status: String(row.status),
      startedAt: String(row.started_at),
      finishedAt: row.finished_at ? String(row.finished_at) : null,
      error: row.error ? String(row.error) : null,
      snapshotId: row.snapshot_id ? String(row.snapshot_id) : null,
      latencyMs: row.latency_ms == null ? null : Number(row.latency_ms),
      mode: row.mode ? String(row.mode) : null,
      competitorName: row.competitor_name ? String(row.competitor_name) : 'Unknown',
      targetType: row.target_type ? String(row.target_type) : 'page',
    })),
  });
});

/* ------------------------------ intelligence ------------------------------ */

router.get('/feed', (req, res) => {
  const query = req.query;
  const items = feedInsights({
    competitorId: query.competitorId ? String(query.competitorId) : undefined,
    impact: query.impact ? String(query.impact) : undefined,
    category: query.category ? String(query.category) : undefined,
    targetType: query.targetType ? String(query.targetType) : undefined,
    days: query.days ? Number(query.days) : undefined,
    search: query.search ? String(query.search) : undefined,
    limit: query.limit ? Number(query.limit) : 120,
  });
  res.json({ insights: items, total: items.length });
});

router.get(
  '/insights/:id',
  wrap((req, res) => {
    const insight = dbh.one<Record<string, unknown>>(
      `SELECT i.*, c.name AS competitor_name, c.color AS competitor_color
       FROM insights i JOIN competitors c ON c.id = i.competitor_id WHERE i.id = ?`,
      req.params.id,
    );
    if (!insight) return res.status(404).json({ error: 'Insight not found' });
    res.json({ insight: mapInsight(insight) });
  }),
);

router.post(
  '/insights/:id/notify',
  wrap(async (req, res) => {
    const insight = getInsight(req.params.id);
    if (!insight) return res.status(404).json({ error: 'Insight not found' });
    const competitor = getCompetitor(insight.competitorId);
    const notifications = await deliverInsight(
      { ...insight, competitorName: competitor?.name ?? insight.competitorName, competitorColor: competitor?.color },
      getSettings(),
    );
    res.json({ notifications, insight: getInsight(insight.id) });
  }),
);

router.get(
  '/snapshots/:id',
  wrap((req, res) => {
    const snapshot = getSnapshot(req.params.id);
    if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
    const diff = dbh.one<Record<string, unknown>>('SELECT * FROM diffs WHERE snapshot_id = ?', snapshot.id);
    const previous = diff && diff.previous_snapshot_id ? getSnapshot(String(diff.previous_snapshot_id)) : null;
    res.json({ snapshot, diff: diff ? mapDiff(diff) : null, previous });
  }),
);

router.get(
  '/diffs/:id',
  wrap((req, res) => {
    const diff = getDiff(req.params.id);
    if (!diff) return res.status(404).json({ error: 'Diff not found' });
    const snapshot = getSnapshot(diff.snapshotId);
    const previous = diff.previousSnapshotId ? getSnapshot(diff.previousSnapshotId) : null;
    res.json({ diff, snapshot, previous });
  }),
);

router.get('/search', (_req, res) => {
  res.status(405).json({ error: 'Use POST /api/search' });
});

router.post(
  '/search',
  wrap(async (req, res) => {
    const schema = z.object({ query: z.string().trim().min(2).max(400), competitorId: z.string().optional(), limit: z.number().optional() });
    const data = sanitize(schema, req.body, res);
    if (!data) return;
    const embedded = await embedTexts([data.query]);
    const competitorId = data.competitorId ?? competitorMentionedIn(data.query);
    const results = await searchChunks(embedded.vectors[0], {
      competitorId,
      limit: data.limit ?? 10,
      queryText: data.query,
    });
    res.json({ results, provider: embedded.provider, model: embedded.model, competitorId });
  }),
);

router.post(
  '/ask',
  wrap(async (req, res) => {
    const schema = z.object({ question: z.string().trim().min(3).max(600), competitorId: z.string().optional() });
    const data = sanitize(schema, req.body, res);
    if (!data) return;
    const embedded = await embedTexts([data.question]);
    const competitorId = data.competitorId ?? competitorMentionedIn(data.question);
    const results = await searchChunks(embedded.vectors[0], {
      competitorId,
      limit: 8,
      queryText: data.question,
    });
    const answer = await answerFromResults(data.question, results);
    res.json({ ...answer, results });
  }),
);

/* --------------------------------- matrix --------------------------------- */

router.get('/matrix', (_req, res) => {
  const competitors = listCompetitors().map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    tier: c.tier,
    industry: c.industry,
    features: dbh
      .all<Record<string, unknown>>('SELECT * FROM features WHERE competitor_id = ? ORDER BY category, name', c.id)
      .map(mapFeature),
  }));
  const settings = getSettings();
  res.json({ competitors, ourProduct: settings.ourProduct, statuses: ['ga', 'beta', 'planned', 'none'] });
});

router.post(
  '/features',
  wrap((req, res) => {
    const schema = z.object({
      competitorId: z.string(),
      name: z.string().trim().min(1).max(80),
      category: z.string().trim().min(1).max(60).default('Core'),
      status: z.enum(['ga', 'beta', 'planned', 'none']).default('none'),
      notes: z.string().max(300).optional().default(''),
    });
    const data = sanitize(schema, req.body, res);
    if (!data) return;
    if (!getCompetitor(data.competitorId)) return res.status(404).json({ error: 'Competitor not found' });
    const existing = dbh.one<{ id: string }>(
      'SELECT id FROM features WHERE competitor_id = ? AND lower(name) = lower(?)',
      data.competitorId,
      data.name,
    );
    if (existing) return res.status(409).json({ error: 'That feature already exists for this competitor' });
    const id = uid('ftr_');
    dbh.run(
      'INSERT INTO features (id, competitor_id, name, category, status, notes) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      data.competitorId,
      data.name,
      data.category ?? 'Core',
      data.status ?? 'none',
      data.notes ?? '',
    );
    res.status(201).json({ feature: mapFeature(dbh.one<Record<string, unknown>>('SELECT * FROM features WHERE id = ?', id)!) });
  }),
);

router.patch(
  '/features/:id',
  wrap((req, res) => {
    const schema = z
      .object({ status: z.enum(['ga', 'beta', 'planned', 'none']), notes: z.string().max(300), name: z.string().max(80), category: z.string().max(60) })
      .partial();
    const data = sanitize(schema, req.body, res);
    if (!data) return;
    const existing = dbh.one<Record<string, unknown>>('SELECT * FROM features WHERE id = ?', req.params.id);
    if (!existing) return res.status(404).json({ error: 'Feature not found' });
    const fields: string[] = [];
    const params: string[] = [];
    for (const key of ['status', 'notes', 'name', 'category'] as const) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(data[key]!);
      }
    }
    if (fields.length) dbh.run(`UPDATE features SET ${fields.join(', ')} WHERE id = ?`, ...params, String(existing.id));
    res.json({ feature: mapFeature(dbh.one<Record<string, unknown>>('SELECT * FROM features WHERE id = ?', String(existing.id))!) });
  }),
);

router.delete('/features/:id', (req, res) => {
  dbh.run('DELETE FROM features WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

/* --------------------------------- digests -------------------------------- */

router.get('/digests', (_req, res) => {
  const rows = dbh
    .all<Record<string, unknown>>('SELECT * FROM digests ORDER BY created_at DESC LIMIT 20')
    .map((row) => ({
      id: String(row.id),
      weekStart: String(row.week_start),
      weekEnd: String(row.week_end),
      title: String(row.title),
      contentMd: String(row.content_md),
      createdAt: String(row.created_at),
      insightCount: Number(row.insight_count),
      highImpactCount: Number(row.high_impact_count),
    }));
  res.json({
    digests: rows,
    currentWeek: currentWeekRange(),
    previousWeek: previousWeekRange(),
    currentWeekInsights: insightsInRange(currentWeekRange()).length,
  });
});

router.post(
  '/digests/generate',
  wrap(async (req, res) => {
    const schema = z.object({
      range: z.enum(['current', 'previous', 'all']).optional().default('current'),
      send: z.boolean().optional().default(false),
      weekStart: z.string().datetime().optional(),
    });
    const data = sanitize(schema, req.body ?? {}, res);
    if (!data) return;
    let range = data.range === 'previous' ? previousWeekRange() : currentWeekRange();
    if (data.range === 'all') {
      const now = new Date();
      range = { weekStart: new Date(now.getTime() - 90 * 86400000).toISOString(), weekEnd: now.toISOString() };
    }
    if (data.weekStart) {
      const start = new Date(data.weekStart);
      range = { weekStart: start.toISOString(), weekEnd: new Date(start.getTime() + 7 * 86400000).toISOString() };
    }
    const result = await createDigest({ range, send: data.send });
    res.status(201).json(result);
  }),
);

router.post(
  '/digests/:id/send',
  wrap(async (req, res) => {
    const row = dbh.one<Record<string, unknown>>('SELECT * FROM digests WHERE id = ?', req.params.id);
    if (!row) return res.status(404).json({ error: 'Digest not found' });
    const { sendDigestNotification } = await import('./services/notify');
    const notifications = await sendDigestNotification(String(row.content_md), String(row.title), getSettings());
    res.json({ notifications });
  }),
);

/* ----------------------------- notifications ------------------------------ */

router.get('/notifications', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 60) || 60, 200);
  const rows = dbh.all<Record<string, unknown>>(
    `SELECT n.*, i.title AS insight_title, c.name AS competitor_name
     FROM notifications n
     LEFT JOIN insights i ON i.id = n.insight_id
     LEFT JOIN competitors c ON c.id = n.competitor_id
     ORDER BY n.created_at DESC LIMIT ?`,
    limit,
  );
  res.json({ notifications: rows.map(mapNotification) });
});

/* --------------------------------- settings ------------------------------- */

router.get('/settings', (_req, res) => {
  res.json({ settings: getSettings(), defaults: DEFAULT_SETTINGS, providers: providerStatus() });
});

router.put(
  '/settings',
  wrap((req, res) => {
    const schema = z
      .object({
        ourProduct: z.string().trim().min(1).max(80),
        slackWebhook: z.string().url().or(z.literal('')),
        alertMinImpact: impacts,
        emailRecipients: z.string().max(500),
        emailFrom: z.string().email(),
        digestEnabled: z.boolean(),
        digestDay: z.string().min(3).max(12),
        digestHour: z.string().regex(/^\d{2}:\d{2}$/),
        sensitivity: z.number().min(0.2).max(3),
        demoFallback: z.boolean(),
        schedulerEnabled: z.boolean(),
      })
      .partial();
    const data = sanitize(schema, req.body, res);
    if (!data) return;
    const settings = saveSettings(data as Partial<Settings>);
    res.json({ settings, providers: providerStatus() });
  }),
);

router.post(
  '/settings/test-slack',
  wrap(async (req, res) => {
    const webhook = z.string().url().safeParse(req.body?.webhook);
    const target = webhook.success ? webhook.data : getSettings().slackWebhook || process.env.SLACK_WEBHOOK_URL || '';
    if (!target) return res.status(400).json({ error: 'No Slack webhook configured' });
    const result = await testSlack(target);
    res.json({ result });
  }),
);

router.get('/providers', (_req, res) => {
  res.json(providerStatus());
});

/* ------------------------------- maintenance ------------------------------ */

router.get('/debug/reindex', (_req, res) => {
  res.status(405).json({ error: 'POST to reindex' });
});

router.post(
  '/debug/reindex',
  wrap(async (_req, res) => {
    const snapshots = dbh.all<Record<string, unknown>>('SELECT * FROM snapshots ORDER BY captured_at DESC LIMIT 50');
    let chunks = 0;
    for (const row of snapshots) {
      const snapshot = getSnapshot(String(row.id))!;
      const { chunkMarkdown } = await import('./services/extract');
      const { upsertChunks, newChunkId } = await import('./services/vectorStore');
      const pieces = chunkMarkdown(snapshot.contentMd);
      if (!pieces.length) continue;
      dbh.run('DELETE FROM chunks WHERE snapshot_id = ?', snapshot.id);
      const embedded = await embedTexts(pieces.map((p) => p.text));
      await upsertChunks(
        pieces.map((piece, idx) => ({
          id: newChunkId(),
          snapshotId: snapshot.id,
          competitorId: snapshot.competitorId,
          targetId: snapshot.targetId,
          section: piece.section,
          text: piece.text,
          chunkIndex: idx,
          embedding: embedded.vectors[idx],
          dim: embedded.dim,
          model: embedded.model,
        })),
      );
      chunks += pieces.length;
    }
    res.json({ ok: true, snapshots: snapshots.length, chunks });
  }),
);

router.post(
  '/debug/diff',
  wrap((req, res) => {
    const schema = z.object({ previous: z.string(), next: z.string() });
    const data = sanitize(schema, req.body, res);
    if (!data) return;
    res.json({ diff: diffMarkdown(data.previous, data.next), provider: embeddingsProvider().provider });
  }),
);

export const api = router;
