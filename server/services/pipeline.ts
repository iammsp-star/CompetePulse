import type {
  Competitor,
  Diff,
  Impact,
  Insight,
  ScrapeRun,
  Settings,
  Snapshot,
  Target,
} from '../../shared/types';
import { dbh, getSettings, getSnapshot, mapDiff, mapInsight, mapRun, mapSnapshot } from '../db';
import { addDays, nowIso, sha256, truncate, uid } from '../lib/util';
import { diffMarkdown, isCosmetic } from './diff';
import { chunkMarkdown } from './extract';
import { embedTexts } from './embeddings';
import { newChunkId, upsertChunks } from './vectorStore';
import type { ChunkInput, ScrapePage } from './types';
import { analyzeChange } from './analysis';
import { deliverInsight } from './notify';
import { scrapePage } from './scraper';

export interface IngestResult {
  snapshot: Snapshot;
  diff: Diff | null;
  insights: Insight[];
  changed: boolean;
  cosmetic: boolean;
}

function nextScanAt(frequency: Target['frequency']): string | null {
  if (frequency === 'daily') return addDays(nowIso(), 1);
  if (frequency === 'weekly') return addDays(nowIso(), 7);
  return null;
}

export function markTargetScanned(targetId: string, status: string, error: string | null = null) {
  const target = dbh.one<{ frequency: Target['frequency'] }>('SELECT frequency FROM targets WHERE id = ?', targetId);
  dbh.run(
    'UPDATE targets SET last_scraped_at = ?, next_scrape_at = ?, last_status = ?, last_error = ? WHERE id = ?',
    nowIso(),
    target ? nextScanAt(target.frequency) : null,
    status,
    error,
    targetId,
  );
}

async function indexSnapshot(snapshot: Snapshot): Promise<void> {
  const chunks = chunkMarkdown(snapshot.contentMd);
  if (!chunks.length) return;
  const embeddings = await embedTexts(chunks.map((c) => c.text));
  const records: ChunkInput[] = chunks.map((chunk, idx) => ({
    id: newChunkId(),
    snapshotId: snapshot.id,
    competitorId: snapshot.competitorId,
    targetId: snapshot.targetId,
    section: chunk.section,
    text: chunk.text,
    chunkIndex: idx,
    embedding: embeddings.vectors[idx],
    dim: embeddings.dim,
    model: embeddings.model,
  }));
  await upsertChunks(records);
}

function insertInsight(
  draft: {
    category: Insight['category'];
    impact: Impact;
    title: string;
    summary: string;
    evidence: string[];
    recommendation: string;
    confidence: number;
    source: Insight['source'];
  },
  args: { competitor: Competitor; target: Target; diffId: string; createdAt: string; latencyMs: number },
): Insight {
  const insight: Insight = {
    id: uid('ins_'),
    competitorId: args.competitor.id,
    competitorName: args.competitor.name,
    competitorColor: args.competitor.color,
    targetId: args.target.id,
    diffId: args.diffId,
    category: draft.category,
    impact: draft.impact,
    title: draft.title,
    summary: draft.summary,
    evidence: draft.evidence,
    recommendation: draft.recommendation,
    confidence: draft.confidence,
    source: draft.source,
    createdAt: args.createdAt,
    notified: 0,
    latencyMs: args.latencyMs,
  };
  dbh.run(
    `INSERT INTO insights (id, competitor_id, target_id, diff_id, category, impact, title, summary, evidence_json,
      recommendation, confidence, source, created_at, notified, latency_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    insight.id,
    insight.competitorId,
    insight.targetId!,
    insight.diffId!,
    insight.category,
    insight.impact,
    insight.title,
    insight.summary,
    JSON.stringify(insight.evidence),
    insight.recommendation,
    insight.confidence,
    insight.source,
    insight.createdAt,
    insight.latencyMs,
  );
  return insight;
}

export async function ingestPage(input: {
  competitor: Competitor;
  target: Target;
  page: ScrapePage;
  capturedAt?: string;
  settings?: Settings;
  useLlm?: boolean;
  notify?: boolean;
  latencyMs?: number;
}): Promise<IngestResult> {
  const { competitor, target, page } = input;
  const settings = input.settings ?? getSettings();
  const capturedAt = input.capturedAt ?? nowIso();
  const contentHash = sha256(page.markdown);

  const previousRow = dbh.one<Record<string, unknown>>(
    'SELECT * FROM snapshots WHERE target_id = ? ORDER BY captured_at DESC LIMIT 1',
    target.id,
  );
  const previous = previousRow ? mapSnapshot(previousRow) : null;

  const snapshotId = uid('snap_');
  dbh.run(
    `INSERT INTO snapshots (id, competitor_id, target_id, captured_at, title, content_md, content_hash, word_count, screenshot_url, mode, changed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    snapshotId,
    competitor.id,
    target.id,
    capturedAt,
    truncate(page.title, 180),
    page.markdown,
    contentHash,
    page.wordCount,
    page.screenshotUrl,
    page.mode,
  );
  const snapshot = getSnapshot(snapshotId)!;

  let diff: Diff | null = null;
  let insights: Insight[] = [];
  let changed = false;
  let cosmetic = false;

  if (previous && previous.contentHash !== contentHash) {
    const result = diffMarkdown(previous.contentMd, page.markdown);
    cosmetic = result.changed && (isCosmetic(result) || result.magnitude * settings.sensitivity < 0.008);
    const diffId = uid('dif_');
    dbh.run(
      `INSERT INTO diffs (id, snapshot_id, previous_snapshot_id, competitor_id, target_id, created_at, similarity,
        magnitude, added_lines, removed_lines, segments_json, pricing_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      diffId,
      snapshotId,
      previous.id,
      competitor.id,
      target.id,
      capturedAt,
      result.similarity,
      result.magnitude,
      result.addedLines,
      result.removedLines,
      JSON.stringify(result.segments),
      JSON.stringify(result.pricingChanges),
    );
    diff = mapDiff(dbh.one<Record<string, unknown>>('SELECT * FROM diffs WHERE id = ?', diffId)!);
    changed = result.changed && !cosmetic;

    if (changed) {
      dbh.run('UPDATE snapshots SET changed = 1 WHERE id = ?', snapshotId);
      const drafts = await analyzeChange({
        competitorName: competitor.name,
        targetType: target.type,
        diff: result,
        useLlm: input.useLlm,
      });
      const latencyMs =
        input.latencyMs ?? Math.min(120_000, Math.max(150, Date.now() - new Date(capturedAt).getTime()));
      const safeLatency = Math.max(120, Math.round(latencyMs));
      for (const draft of drafts) {
        const insight = insertInsight(draft, {
          competitor,
          target,
          diffId,
          createdAt: capturedAt,
          latencyMs: safeLatency,
        });
        insights.push(insight);
      }
      if (input.notify !== false) {
        for (const insight of insights) {
          const notices = await deliverInsight(insight, settings);
          if (notices.some((n) => n.status === 'sent' || n.status === 'simulated')) {
            insight.notified = 1;
          }
        }
      }
    }
  }

  await indexSnapshot(snapshot);

  return { snapshot, diff, insights, changed, cosmetic };
}

export interface ScanOutcome {
  run: ScrapeRun;
  snapshot: Snapshot | null;
  diff: Diff | null;
  insights: Insight[];
  changed: boolean;
  unchanged: boolean;
}

export async function scanTarget(targetId: string, trigger: ScrapeRun['trigger'] = 'manual'): Promise<ScanOutcome> {
  const targetRow = dbh.one<Record<string, unknown>>('SELECT * FROM targets WHERE id = ?', targetId);
  if (!targetRow) throw new Error('Target not found');
  const competitorRow = dbh.one<Record<string, unknown>>(
    'SELECT * FROM competitors WHERE id = ?',
    String(targetRow.competitor_id),
  );
  if (!competitorRow) throw new Error('Competitor not found');
  const competitor = {
    id: String(competitorRow.id),
    name: String(competitorRow.name),
    domain: String(competitorRow.domain),
    color: String(competitorRow.color),
  } as Competitor;
  const target = {
    id: String(targetRow.id),
    competitorId: String(targetRow.competitor_id),
    type: String(targetRow.type) as Target['type'],
    url: String(targetRow.url),
    frequency: String(targetRow.frequency) as Target['frequency'],
  } as Target;

  const settings = getSettings();
  const startedAt = nowIso();
  const started = Date.now();
  const runId = uid('run_');
  dbh.run(
    `INSERT INTO scrape_runs (id, competitor_id, target_id, trigger, status, started_at)
     VALUES (?, ?, ?, ?, 'running', ?)`,
    runId,
    competitor.id,
    target.id,
    trigger,
    startedAt,
  );

  try {
    const snapshotCount = Number(
      dbh.one<{ n: number }>('SELECT COUNT(*) AS n FROM snapshots WHERE target_id = ?', target.id)?.n ?? 0,
    );
    const page = await scrapePage(competitor, target, settings, snapshotCount);
    const latestRow = dbh.one<Record<string, unknown>>(
      'SELECT * FROM snapshots WHERE target_id = ? ORDER BY captured_at DESC LIMIT 1',
      target.id,
    );
    const latest = latestRow ? mapSnapshot(latestRow) : null;
    const hash = sha256(page.markdown);

    if (latest && latest.contentHash === hash) {
      const finishedAt = nowIso();
      dbh.run(
        "UPDATE scrape_runs SET status = 'unchanged', finished_at = ?, latency_ms = ?, mode = ? WHERE id = ?",
        finishedAt,
        Date.now() - started,
        page.mode,
        runId,
      );
      markTargetScanned(target.id, 'unchanged');
      const run = mapRun(dbh.one<Record<string, unknown>>('SELECT * FROM scrape_runs WHERE id = ?', runId)!);
      return { run, snapshot: latest, diff: null, insights: [], changed: false, unchanged: true };
    }

    const result = await ingestPage({
      competitor,
      target,
      page,
      settings,
      notify: true,
      latencyMs: Math.max(120, Date.now() - started),
    });

    const finishedAt = nowIso();
    // A first capture with no predecessor is a successful baseline, not "unchanged".
    const status = result.changed || !result.diff ? 'success' : 'unchanged';
    dbh.run(
      'UPDATE scrape_runs SET status = ?, finished_at = ?, snapshot_id = ?, latency_ms = ?, mode = ? WHERE id = ?',
      status,
      finishedAt,
      result.snapshot.id,
      Date.now() - started,
      page.mode,
      runId,
    );
    markTargetScanned(target.id, result.cosmetic ? 'cosmetic' : status);
    const run = mapRun(dbh.one<Record<string, unknown>>('SELECT * FROM scrape_runs WHERE id = ?', runId)!);
    return {
      run,
      snapshot: result.snapshot,
      diff: result.diff,
      insights: result.insights,
      changed: result.changed,
      unchanged: false,
    };
  } catch (error) {
    const message = (error as Error).message || 'Unknown scrape error';
    dbh.run(
      "UPDATE scrape_runs SET status = 'failed', finished_at = ?, error = ?, latency_ms = ? WHERE id = ?",
      nowIso(),
      message.slice(0, 500),
      Date.now() - started,
      runId,
    );
    markTargetScanned(target.id, 'failed', message.slice(0, 500));
    throw error;
  }
}

export async function scanCompetitor(competitorId: string, trigger: ScrapeRun['trigger'] = 'manual') {
  const targets = dbh.all<{ id: string }>('SELECT id FROM targets WHERE competitor_id = ? AND enabled = 1', competitorId);
  const settled = await Promise.allSettled(targets.map((target) => scanTarget(target.id, trigger)));
  const outcomes: ScanOutcome[] = [];
  settled.forEach((result, idx) => {
    if (result.status === 'fulfilled') outcomes.push(result.value);
    else console.warn(`[pipeline] scan failed for ${targets[idx].id}: ${(result.reason as Error)?.message ?? result.reason}`);
  });
  return outcomes;
}

export function getLatestInsights(limit = 5): Insight[] {
  return dbh
    .all<Record<string, unknown>>(
      `SELECT i.*, c.name AS competitor_name, c.color AS competitor_color
       FROM insights i JOIN competitors c ON c.id = i.competitor_id
       ORDER BY i.created_at DESC LIMIT ?`,
      limit,
    )
    .map(mapInsight);
}
