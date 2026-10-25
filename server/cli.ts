import { dbh, listTargets, mapRun } from './db';
import { seedIfEmpty } from './seed';
import { scanTarget } from './services/pipeline';

async function main() {
  const command = process.argv[2] ?? 'scan';
  if (command === 'seed') {
    const created = await seedIfEmpty();
    console.info(created ? 'Demo workspace seeded.' : 'Workspace already has competitors; nothing to seed.');
    return;
  }
  if (command === 'digest') {
    const { createDigest } = await import('./services/digest');
    const { digest, insights } = await createDigest({ send: process.argv.includes('--send') });
    console.info(`Digest ${digest.title}: ${insights.length} insights`);
    return;
  }
  if (command === 'scan') {
    await seedIfEmpty();
    const targetId = process.argv[3];
    const targets = targetId ? listTargets().filter((t) => t.id === targetId) : listTargets().filter((t) => t.enabled);
    if (!targets.length) {
      console.error('No matching enabled targets.');
      process.exit(1);
    }
    for (const target of targets) {
      try {
        const outcome = await scanTarget(target.id, 'manual');
        console.info(
          `${target.type.padEnd(9)} ${target.url} → ${outcome.run.status}${outcome.insights.length ? ` · ${outcome.insights.map((i) => i.title).join(' | ')}` : ''}`,
        );
      } catch (error) {
        console.error(`failed ${target.url}: ${(error as Error).message}`);
      }
    }
    const last = dbh.all<Record<string, unknown>>('SELECT * FROM scrape_runs ORDER BY started_at DESC LIMIT 1')[0];
    if (last) {
      const run = mapRun(last);
      console.info(`\nLast run: ${run.status} in ${run.latencyMs ?? 0}ms`);
    }
    return;
  }
  console.error(`Unknown command "${command}". Use: scan [targetId] | seed | digest [--send]`);
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
