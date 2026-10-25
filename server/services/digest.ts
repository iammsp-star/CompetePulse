import type { Digest, Impact, Insight } from '../../shared/types';
import { dbh, getSettings, mapDigest, mapInsight } from '../db';
import { nowIso, startOfWeekIso, uid } from '../lib/util';
import { generateDigestMarkdown } from './analysis';
import { sendDigestNotification } from './notify';

export interface DigestRange {
  weekStart: string;
  weekEnd: string;
}

export function currentWeekRange(): DigestRange {
  const start = new Date(startOfWeekIso());
  const end = new Date(start.getTime() + 7 * 86400000);
  return { weekStart: start.toISOString(), weekEnd: end.toISOString() };
}

export function previousWeekRange(): DigestRange {
  const current = currentWeekRange();
  const start = new Date(new Date(current.weekStart).getTime() - 7 * 86400000);
  return { weekStart: start.toISOString(), weekEnd: current.weekStart };
}

export function insightsInRange(range: DigestRange): Insight[] {
  return dbh
    .all<Record<string, unknown>>(
      `SELECT i.*, c.name AS competitor_name, c.color AS competitor_color
       FROM insights i JOIN competitors c ON c.id = i.competitor_id
       WHERE i.created_at >= ? AND i.created_at < ?
       ORDER BY i.created_at DESC`,
      range.weekStart,
      range.weekEnd,
    )
    .map(mapInsight);
}

export async function createDigest(options: {
  range?: DigestRange;
  send?: boolean;
  useLlm?: boolean;
} = {}): Promise<{ digest: Digest; insights: Insight[]; sent: boolean }> {
  const settings = getSettings();
  const range = options.range ?? previousWeekRange();
  const insights = insightsInRange(range);
  const contentMd = await generateDigestMarkdown({
    weekStart: range.weekStart,
    weekEnd: range.weekEnd,
    insights,
    productName: settings.ourProduct,
    useLlm: options.useLlm,
  });
  const start = new Date(range.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const end = new Date(new Date(range.weekEnd).getTime() - 86400000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const title = `Competitive Intelligence Briefing — ${start}–${end}`;
  const existing = dbh.one<{ id: string }>('SELECT id FROM digests WHERE week_start = ?', range.weekStart);
  const id = existing?.id ?? uid('dgt_');
  if (existing) {
    dbh.run(
      `UPDATE digests SET week_end = ?, title = ?, content_md = ?, created_at = ?, insight_count = ?, high_impact_count = ?
       WHERE id = ?`,
      range.weekEnd,
      title,
      contentMd,
      nowIso(),
      insights.length,
      insights.filter((i) => i.impact === 'high').length,
      id,
    );
  } else {
    dbh.run(
      `INSERT INTO digests (id, week_start, week_end, title, content_md, created_at, insight_count, high_impact_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      range.weekStart,
      range.weekEnd,
      title,
      contentMd,
      nowIso(),
      insights.length,
      insights.filter((i) => i.impact === 'high').length,
    );
  }
  let sent = false;
  if (options.send) {
    const notifications = await sendDigestNotification(contentMd, title, settings);
    sent = notifications.some((n) => n.status === 'sent');
  }
  return { digest: mapDigest(dbh.one<Record<string, unknown>>('SELECT * FROM digests WHERE id = ?', id)!), insights, sent };
}

export function impactCounts(insights: Insight[]): Record<Impact, number> {
  return {
    high: insights.filter((i) => i.impact === 'high').length,
    medium: insights.filter((i) => i.impact === 'medium').length,
    low: insights.filter((i) => i.impact === 'low').length,
  };
}
