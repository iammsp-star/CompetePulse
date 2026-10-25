import cron from 'node-cron';
import { dbh, getSettings, mapInsight, mapRun } from '../db';
import { scanTarget } from './pipeline';
import { createDigest, insightsInRange, currentWeekRange } from './digest';
import { sendDigestNotification } from './notify';
import type { Insight } from '../../shared/types';

let scanning = false;
let started = false;

async function scanTick() {
  const settings = getSettings();
  if (!settings.schedulerEnabled || scanning) return;
  scanning = true;
  try {
    const due = dbh.all<{ id: string; competitor_id: string }>(
      `SELECT id, competitor_id FROM targets
       WHERE enabled = 1 AND frequency != 'on_demand' AND next_scrape_at IS NOT NULL AND next_scrape_at <= ?
       ORDER BY next_scrape_at ASC LIMIT 4`,
      new Date().toISOString(),
    );
    for (const target of due) {
      // Push the next run forward before scraping so a slow scan cannot double-schedule.
      const check = getSettings();
      if (!check.schedulerEnabled) break;
      dbh.run(
        "UPDATE targets SET next_scrape_at = datetime('now','+1 hour'), last_status = 'queued' WHERE id = ?",
        target.id,
      );
      try {
        const outcome = await scanTarget(target.id, 'scheduled');
        console.info(
          `[scheduler] ${target.id}: ${outcome.run.status}${outcome.insights.length ? `, ${outcome.insights.length} insight(s)` : ''}`,
        );
      } catch (error) {
        console.warn(`[scheduler] scan failed for ${target.id}: ${(error as Error).message}`);
      }
    }
  } finally {
    scanning = false;
  }
}

async function digestTick() {
  const settings = getSettings();
  if (!settings.digestEnabled) return;
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  if (day !== settings.digestDay.toLowerCase()) return;
  const [hour] = settings.digestHour.split(':').map(Number);
  if (Number.isNaN(hour) || now.getHours() !== hour) return;
  const range = currentWeekRange();
  const existing = dbh.one<{ n: number }>('SELECT COUNT(*) AS n FROM digests WHERE week_start = ?', range.weekStart);
  if (Number(existing?.n ?? 0) > 0) return;

  const insights: Insight[] = insightsInRange(range);
  if (!insights.length) return;
  const { digest } = await createDigest({ range, send: false });
  try {
    await sendDigestNotification(digest.contentMd, digest.title, settings);
  } catch (error) {
    console.warn('[scheduler] digest delivery failed:', (error as Error).message);
  }
  console.info(`[scheduler] weekly digest created: ${digest.id} (${insights.length} insights)`);
}

export function startScheduler() {
  if (started) return;
  started = true;
  cron.schedule('* * * * *', () => {
    void scanTick().catch((error) => console.warn('[scheduler] tick failed:', (error as Error).message));
  });
  cron.schedule('5 * * * *', () => {
    void digestTick().catch((error) => console.warn('[scheduler] digest tick failed:', (error as Error).message));
  });
  console.info('[scheduler] monitoring loop started (scans every minute, digest hourly check)');
  void mapInsight;
  void mapRun;
}
