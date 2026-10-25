import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type {
  Category,
  Competitor,
  Diff,
  DiffSegment,
  Digest,
  Feature,
  FeedItem,
  Impact,
  Insight,
  Notification,
  PricingChange,
  ScrapeRun,
  Settings,
  Snapshot,
  Stats,
  Target,
} from '../shared/types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, 'competepulse.db');

if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS competitors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT '',
  tier TEXT NOT NULL DEFAULT 'tier2',
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#6ee7b7',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS targets (
  id TEXT PRIMARY KEY,
  competitor_id TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'weekly',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_scraped_at TEXT,
  next_scrape_at TEXT,
  last_status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  competitor_id TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
  captured_at TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  content_md TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  screenshot_url TEXT,
  mode TEXT NOT NULL DEFAULT 'seed',
  changed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS diffs (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  previous_snapshot_id TEXT,
  competitor_id TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  similarity REAL NOT NULL,
  magnitude REAL NOT NULL,
  added_lines INTEGER NOT NULL,
  removed_lines INTEGER NOT NULL,
  segments_json TEXT NOT NULL,
  pricing_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS insights (
  id TEXT PRIMARY KEY,
  competitor_id TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  target_id TEXT,
  diff_id TEXT,
  category TEXT NOT NULL,
  impact TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  confidence REAL NOT NULL,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  notified INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS features (
  id TEXT PRIMARY KEY,
  competitor_id TEXT NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Core',
  status TEXT NOT NULL DEFAULT 'none',
  notes TEXT NOT NULL DEFAULT '',
  UNIQUE(competitor_id, name)
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  competitor_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  section TEXT NOT NULL,
  text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding BLOB NOT NULL,
  dim INTEGER NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS digests (
  id TEXT PRIMARY KEY,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  title TEXT NOT NULL,
  content_md TEXT NOT NULL,
  created_at TEXT NOT NULL,
  insight_count INTEGER NOT NULL,
  high_impact_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  insight_id TEXT,
  competitor_id TEXT,
  channel TEXT NOT NULL,
  destination TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id TEXT PRIMARY KEY,
  competitor_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error TEXT,
  snapshot_id TEXT,
  latency_ms INTEGER,
  mode TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_target ON snapshots(target_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_created ON insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diffs_snapshot ON diffs(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_chunks_competitor ON chunks(competitor_id);
CREATE INDEX IF NOT EXISTS idx_runs_started ON scrape_runs(started_at DESC);
`);

type Row = Record<string, unknown>;

function all<T>(sql: string, ...params: (string | number | null)[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

function one<T>(sql: string, ...params: (string | number | null)[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

function run(sql: string, ...params: (string | number | null)[]) {
  return db.prepare(sql).run(...params);
}

export const dbh = { all, one, run };

function parseJson<T>(value: unknown, fallback: T): T {
  try {
    return JSON.parse(String(value ?? '')) as T;
  } catch {
    return fallback;
  }
}

export function mapCompetitor(r: Row): Competitor {
  return {
    id: String(r.id),
    name: String(r.name),
    domain: String(r.domain),
    industry: String(r.industry),
    tier: String(r.tier) as Competitor['tier'],
    description: String(r.description),
    color: String(r.color),
    createdAt: String(r.created_at),
    lastScannedAt: (r.last_scanned_at as string) ?? null,
    changes30d: Number(r.changes_30d ?? 0),
    highImpact30d: Number(r.high_impact_30d ?? 0),
    openAlerts: Number(r.open_alerts ?? 0),
  };
}

export function mapTarget(r: Row): Target {
  return {
    id: String(r.id),
    competitorId: String(r.competitor_id),
    type: String(r.type) as Target['type'],
    url: String(r.url),
    frequency: String(r.frequency) as Target['frequency'],
    enabled: Number(r.enabled),
    lastScrapedAt: (r.last_scraped_at as string) ?? null,
    nextScrapeAt: (r.next_scrape_at as string) ?? null,
    lastStatus: String(r.last_status),
    lastError: (r.last_error as string) ?? null,
  };
}

export function mapSnapshot(r: Row): Snapshot {
  return {
    id: String(r.id),
    competitorId: String(r.competitor_id),
    targetId: String(r.target_id),
    capturedAt: String(r.captured_at),
    title: String(r.title),
    contentMd: String(r.content_md),
    contentHash: String(r.content_hash),
    wordCount: Number(r.word_count),
    screenshotUrl: (r.screenshot_url as string) ?? null,
    mode: String(r.mode) as Snapshot['mode'],
    changed: Number(r.changed),
    hasDiff: Boolean(r.has_diff),
  };
}

export function mapDiff(r: Row): Diff {
  return {
    id: String(r.id),
    snapshotId: String(r.snapshot_id),
    previousSnapshotId: (r.previous_snapshot_id as string) ?? null,
    competitorId: String(r.competitor_id),
    targetId: String(r.target_id),
    createdAt: String(r.created_at),
    similarity: Number(r.similarity),
    magnitude: Number(r.magnitude),
    addedLines: Number(r.added_lines),
    removedLines: Number(r.removed_lines),
    segments: parseJson<DiffSegment[]>(r.segments_json, []),
    pricingChanges: parseJson<PricingChange[]>(r.pricing_json, []),
  };
}

export function mapInsight(r: Row): Insight {
  return {
    id: String(r.id),
    competitorId: String(r.competitor_id),
    competitorName: r.competitor_name ? String(r.competitor_name) : undefined,
    competitorColor: r.competitor_color ? String(r.competitor_color) : undefined,
    targetId: r.target_id ? String(r.target_id) : undefined,
    diffId: r.diff_id ? String(r.diff_id) : null,
    category: String(r.category) as Category,
    impact: String(r.impact) as Impact,
    title: String(r.title),
    summary: String(r.summary),
    evidence: parseJson<string[]>(r.evidence_json, []),
    recommendation: String(r.recommendation),
    confidence: Number(r.confidence),
    source: String(r.source) as Insight['source'],
    createdAt: String(r.created_at),
    notified: Number(r.notified),
    latencyMs: Number(r.latency_ms),
  };
}

export function mapFeature(r: Row): Feature {
  return {
    id: String(r.id),
    competitorId: String(r.competitor_id),
    name: String(r.name),
    category: String(r.category),
    status: String(r.status) as Feature['status'],
    notes: String(r.notes),
  };
}

export function mapDigest(r: Row): Digest {
  return {
    id: String(r.id),
    weekStart: String(r.week_start),
    weekEnd: String(r.week_end),
    title: String(r.title),
    contentMd: String(r.content_md),
    createdAt: String(r.created_at),
    insightCount: Number(r.insight_count),
    highImpactCount: Number(r.high_impact_count),
  };
}

export function mapNotification(r: Row): Notification {
  return {
    id: String(r.id),
    insightId: r.insight_id ? String(r.insight_id) : null,
    competitorId: r.competitor_id ? String(r.competitor_id) : null,
    channel: String(r.channel) as Notification['channel'],
    destination: String(r.destination),
    status: String(r.status) as Notification['status'],
    detail: String(r.detail),
    createdAt: String(r.created_at),
    insightTitle: r.insight_title ? String(r.insight_title) : undefined,
    competitorName: r.competitor_name ? String(r.competitor_name) : undefined,
  };
}

export function mapRun(r: Row): ScrapeRun {
  return {
    id: String(r.id),
    competitorId: String(r.competitor_id),
    targetId: String(r.target_id),
    trigger: String(r.trigger) as ScrapeRun['trigger'],
    status: String(r.status) as ScrapeRun['status'],
    startedAt: String(r.started_at),
    finishedAt: (r.finished_at as string) ?? null,
    error: (r.error as string) ?? null,
    snapshotId: (r.snapshot_id as string) ?? null,
    latencyMs: r.latency_ms == null ? null : Number(r.latency_ms),
    mode: (r.mode as string) ?? null,
  };
}

export function listTargets(competitorId?: string): Target[] {
  if (competitorId) {
    return all<Row>('SELECT * FROM targets WHERE competitor_id = ? ORDER BY type', competitorId).map(mapTarget);
  }
  return all<Row>('SELECT * FROM targets ORDER BY competitor_id, type').map(mapTarget);
}

export function listCompetitors(): Competitor[] {
  const rows = all<Row>(`
    SELECT c.*,
      (SELECT MAX(s.captured_at) FROM snapshots s WHERE s.competitor_id = c.id) AS last_scanned_at,
      (SELECT COUNT(*) FROM insights i WHERE i.competitor_id = c.id AND i.created_at >= datetime('now','-30 days')) AS changes_30d,
      (SELECT COUNT(*) FROM insights i WHERE i.competitor_id = c.id AND i.impact = 'high' AND i.created_at >= datetime('now','-30 days')) AS high_impact_30d,
      (SELECT COUNT(*) FROM insights i WHERE i.competitor_id = c.id AND i.notified = 0 AND i.impact = 'high') AS open_alerts
    FROM competitors c ORDER BY c.tier, c.name
  `);
  const comps = rows.map(mapCompetitor);
  const targets = listTargets();
  return comps.map((c) => ({ ...c, targets: targets.filter((t) => t.competitorId === c.id) }));
}

export function getCompetitor(id: string): Competitor | undefined {
  const c = listCompetitors().find((x) => x.id === id);
  return c;
}

export function getSnapshot(id: string): Snapshot | undefined {
  const r = one<Row>('SELECT * FROM snapshots WHERE id = ?', id);
  return r ? mapSnapshot(r) : undefined;
}

export function getDiff(id: string): Diff | undefined {
  const r = one<Row>('SELECT * FROM diffs WHERE id = ?', id);
  return r ? mapDiff(r) : undefined;
}

export function getDiffForSnapshot(snapshotId: string): Diff | undefined {
  const r = one<Row>('SELECT * FROM diffs WHERE snapshot_id = ?', snapshotId);
  return r ? mapDiff(r) : undefined;
}

export function getInsight(id: string): Insight | undefined {
  const r = one<Row>('SELECT * FROM insights WHERE id = ?', id);
  return r ? mapInsight(r) : undefined;
}

const FEED_SELECT = `
  SELECT i.*, c.name AS competitor_name, c.color AS competitor_color
  FROM insights i JOIN competitors c ON c.id = i.competitor_id
`;

export interface FeedFilter {
  competitorId?: string;
  impact?: string;
  category?: string;
  targetType?: string;
  days?: number;
  search?: string;
  limit?: number;
}

export function feedInsights(filter: FeedFilter = {}): FeedItem[] {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (filter.competitorId) {
    clauses.push('i.competitor_id = ?');
    params.push(filter.competitorId);
  }
  if (filter.impact && filter.impact !== 'all') {
    clauses.push('i.impact = ?');
    params.push(filter.impact);
  }
  if (filter.category && filter.category !== 'all') {
    clauses.push('i.category = ?');
    params.push(filter.category);
  }
  if (filter.targetType && filter.targetType !== 'all') {
    clauses.push('i.target_id IN (SELECT id FROM targets WHERE type = ?)');
    params.push(filter.targetType);
  }
  if (filter.days) {
    clauses.push("i.created_at >= datetime('now', ?)");
    params.push(`-${Math.round(filter.days)} days`);
  }
  if (filter.search) {
    clauses.push('(i.title LIKE ? OR i.summary LIKE ? OR c.name LIKE ?)');
    const q = `%${filter.search}%`;
    params.push(q, q, q);
  }
  const limit = Math.min(filter.limit ?? 100, 300);
  const rows = all<Row>(
    `${FEED_SELECT} ${clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''} ORDER BY i.created_at DESC LIMIT ${limit}`,
    ...params,
  );
  return rows.map((r) => {
    const insight = mapInsight(r);
    const diff = insight.diffId ? getDiff(insight.diffId) : undefined;
    const target = insight.targetId ? one<Row>('SELECT * FROM targets WHERE id = ?', insight.targetId) : undefined;
    const snapshot = diff ? getSnapshot(diff.snapshotId) : undefined;
    const competitor = one<Row>('SELECT domain FROM competitors WHERE id = ?', insight.competitorId);
    return {
      ...insight,
      domain: competitor ? String(competitor.domain) : '',
      targetType: (target ? String(target.type) : 'landing') as FeedItem['targetType'],
      snapshotTitle: snapshot?.title ?? '',
      diff: diff
        ? {
            similarity: diff.similarity,
            magnitude: diff.magnitude,
            addedLines: diff.addedLines,
            removedLines: diff.removedLines,
            pricingChanges: diff.pricingChanges,
          }
        : undefined,
    };
  });
}

export function listRuns(competitorId?: string, limit = 30): ScrapeRun[] {
  const rows = competitorId
    ? all<Row>('SELECT * FROM scrape_runs WHERE competitor_id = ? ORDER BY started_at DESC LIMIT ?', competitorId, limit)
    : all<Row>('SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT ?', limit);
  return rows.map(mapRun);
}

export function getStats(): Stats {
  const count = (sql: string, ...p: (string | number)[]) => Number(one<Row>(sql, ...p)?.n ?? 0);
  const competitors = count('SELECT COUNT(*) AS n FROM competitors');
  const targets = count('SELECT COUNT(*) AS n FROM targets');
  const snapshots = count('SELECT COUNT(*) AS n FROM snapshots');
  const changes7d = count("SELECT COUNT(*) AS n FROM diffs WHERE created_at >= datetime('now','-7 days')");
  const highImpact7d = count(
    "SELECT COUNT(*) AS n FROM insights WHERE impact = 'high' AND created_at >= datetime('now','-7 days')",
  );
  const insights7d = count("SELECT COUNT(*) AS n FROM insights WHERE created_at >= datetime('now','-7 days')");
  const unreadAlerts = count("SELECT COUNT(*) AS n FROM insights WHERE impact = 'high' AND notified = 0");

  const runs = all<Row>("SELECT * FROM scrape_runs WHERE status != 'running' AND trigger != 'seed'");
  const completed = runs.filter((r) => r.status === 'success' || r.status === 'unchanged').length;
  const scrapeSuccessRate = runs.length ? completed / runs.length : 1;

  const latencies = all<Row>('SELECT latency_ms FROM insights WHERE latency_ms > 0 ORDER BY latency_ms')
    .map((r) => Number(r.latency_ms))
    .sort((a, b) => a - b);
  const medianLatencyMs = latencies.length ? latencies[Math.floor(latencies.length / 2)] : 0;

  const days: { day: string; changes: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    days.push({
      day: key,
      changes: count(
        "SELECT COUNT(*) AS n FROM diffs WHERE substr(created_at,1,10) = ? AND similarity < 0.995",
        key,
      ),
    });
  }

  const impactBreakdown = (['high', 'medium', 'low'] as Impact[]).map((impact) => ({
    impact,
    count: count('SELECT COUNT(*) AS n FROM insights WHERE impact = ?', impact),
  }));
  const categoryBreakdown = (['pricing', 'feature', 'messaging', 'partnership', 'other'] as Category[]).map(
    (category) => ({ category, count: count('SELECT COUNT(*) AS n FROM insights WHERE category = ?', category) }),
  );

  const lastRunRow = all<Row>('SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 1')[0];
  const nextTarget = all<Row>(
    "SELECT next_scrape_at FROM targets WHERE enabled = 1 AND next_scrape_at IS NOT NULL ORDER BY next_scrape_at ASC LIMIT 1",
  )[0];

  return {
    competitors,
    targets,
    snapshots,
    changes7d,
    highImpact7d,
    insights7d,
    monitoredPages: targets,
    scrapeSuccessRate,
    medianLatencyMs,
    unreadAlerts,
    changesByDay: days,
    impactBreakdown,
    categoryBreakdown,
    lastRun: lastRunRow ? mapRun(lastRunRow) : null,
    nextRun: nextTarget ? String(nextTarget.next_scrape_at) : null,
  };
}

export const DEFAULT_SETTINGS: Settings = {
  ourProduct: 'CompetePulse',
  slackWebhook: '',
  alertMinImpact: 'high',
  emailRecipients: '',
  emailFrom: 'briefings@competepulse.app',
  digestEnabled: true,
  digestDay: 'monday',
  digestHour: '08:00',
  sensitivity: 1,
  demoFallback: true,
  schedulerEnabled: true,
};

export function getSettings(): Settings {
  const rows = all<Row>('SELECT key, value FROM settings');
  const stored: Record<string, unknown> = {};
  for (const row of rows) stored[String(row.key)] = parseJson(row.value, row.value);
  const merged = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (stored[key] !== undefined) merged[key] = stored[key];
  }
  return merged as unknown as Settings;
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const current = getSettings() as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    current[key] = value;
    run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      JSON.stringify(value),
    );
  }
  return current as unknown as Settings;
}

export { DB_PATH };
