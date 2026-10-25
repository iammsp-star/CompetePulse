import type { DiffSegment, PricingChange } from '../../shared/types';
import { extractPricing } from './extract';
import { clamp, normalizeLine, stripMarkdown } from '../lib/util';

export interface DiffResult {
  changed: boolean;
  similarity: number;
  magnitude: number;
  addedLines: number;
  removedLines: number;
  segments: DiffSegment[];
  pricingChanges: PricingChange[];
  addedText: string[];
  removedText: string[];
  totalLines: number;
}

const NOISE_LINE =
  /^(last updated|updated|©|copyright|all rights reserved|all systems operational|privacy policy|terms of service|follow us|share this|subscribe)/i;
const DATE_ONLY = /^[-–—\s]*(\d{1,2}\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}[-–—\s]*$/i;

/** Ignore lines that churn on every render (copyright years, timestamps, consent text). */
function isNoise(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  // Strip markdown emphasis and heading markers before checking boilerplate prefixes.
  const plain = trimmed.replace(/^[*_#>`\s-]+/, '').toLowerCase();
  if (NOISE_LINE.test(plain)) return true;
  if (DATE_ONLY.test(trimmed)) return true;
  if (/^[\d\s,./:–—-]+$/.test(trimmed)) return true;
  return false;
}

export function meaningfulLines(markdown: string): string[] {
  return markdown
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !isNoise(l));
}

type Op = { type: 'added' | 'removed' | 'unchanged'; text: string };

function lcsOps(oldLines: string[], newLines: string[]): Op[] {
  const n = oldLines.length;
  const m = newLines.length;
  const a = oldLines.map(normalizeLine);
  const b = newLines.map(normalizeLine);
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'unchanged', text: oldLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'removed', text: oldLines[i] });
      i++;
    } else {
      ops.push({ type: 'added', text: newLines[j] });
      j++;
    }
  }
  while (i < n) ops.push({ type: 'removed', text: oldLines[i++] });
  while (j < m) ops.push({ type: 'added', text: newLines[j++] });
  return ops;
}

/** Keep changed hunks plus two lines of context so the UI stays readable. */
function condense(ops: Op[], context = 2, max = 180): DiffSegment[] {
  const keep = new Array(ops.length).fill(false);
  ops.forEach((op, idx) => {
    if (op.type === 'unchanged') return;
    for (let k = Math.max(0, idx - context); k <= Math.min(ops.length - 1, idx + context); k++) keep[k] = true;
  });
  const segments: DiffSegment[] = [];
  let skipped = false;
  for (let idx = 0; idx < ops.length; idx++) {
    if (!keep[idx]) {
      skipped = true;
      continue;
    }
    if (skipped && segments.length) segments.push({ type: 'unchanged', text: '…' });
    skipped = false;
    segments.push({ type: ops[idx].type, text: ops[idx].text });
    if (segments.length >= max) break;
  }
  return segments;
}

function priceFromTier(price: string): number | null {
  const match = price.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

export function diffPricing(oldMarkdown: string, newMarkdown: string): PricingChange[] {
  const before = extractPricing(oldMarkdown);
  const after = extractPricing(newMarkdown);
  const changes: PricingChange[] = [];
  const key = (s: string) => s.toLowerCase().replace(/\s+plan$/, '').trim();

  const beforeMap = new Map(before.map((t) => [key(t.plan), t]));
  const afterMap = new Map(after.map((t) => [key(t.plan), t]));

  for (const [plan, oldTier] of beforeMap) {
    const newTier = afterMap.get(plan);
    if (!newTier) {
      changes.push({ plan: oldTier.plan, field: 'tier', from: `${oldTier.price} plan`, to: 'removed' });
      continue;
    }
    const oldPrice = priceFromTier(oldTier.price);
    const newPrice = priceFromTier(newTier.price);
    if (oldPrice !== null && newPrice !== null && oldPrice !== newPrice) {
      changes.push({ plan: oldTier.plan, field: 'price', from: oldTier.price, to: newTier.price });
    }
    const billingChanged = oldTier.billing !== newTier.billing;
    if (billingChanged && oldTier.billing && newTier.billing) {
      changes.push({
        plan: oldTier.plan,
        field: 'billing',
        from: oldTier.billing,
        to: newTier.billing,
      });
    }
    const oldFeatures = new Set(oldTier.features.map((f) => f.toLowerCase()));
    const newFeatures = newTier.features.filter((f) => !oldFeatures.has(f.toLowerCase()));
    if (newFeatures.length && oldTier.features.length) {
      changes.push({
        plan: oldTier.plan,
        field: 'features',
        from: `${oldTier.features.length} listed`,
        to: newFeatures[0].slice(0, 80),
      });
    }
  }

  for (const [plan, newTier] of afterMap) {
    if (!beforeMap.has(plan)) {
      changes.push({ plan: newTier.plan, field: 'tier', from: 'not offered', to: `${newTier.price} plan` });
    }
  }
  return changes;
}

export function diffMarkdown(oldMarkdown: string, newMarkdown: string): DiffResult {
  const oldLines = meaningfulLines(oldMarkdown).slice(0, 800);
  const newLines = meaningfulLines(newMarkdown).slice(0, 800);
  const ops = lcsOps(oldLines, newLines);
  const added = ops.filter((o) => o.type === 'added');
  const removed = ops.filter((o) => o.type === 'removed');
  const totalLines = Math.max(oldLines.length, newLines.length, 1);
  const similarity = clamp(1 - (added.length + removed.length) / (oldLines.length + newLines.length || 1), 0, 1);
  const pricingChanges = diffPricing(oldMarkdown, newMarkdown);
  const priceSeverity = pricingChanges.reduce((acc, change) => {
    if (change.field !== 'price') return acc + 0.25;
    const from = priceFromTier(change.from);
    const to = priceFromTier(change.to);
    if (from && to) return acc + Math.min(0.8, Math.abs(to - from) / from);
    return acc + 0.3;
  }, 0);
  const volume = (added.length + removed.length) / totalLines;
  const magnitude = clamp(volume * 0.9 + Math.min(priceSeverity, 1.2) * 0.55, 0, 1);
  const changed = added.length + removed.length >= 2 || pricingChanges.length > 0;

  return {
    changed,
    similarity,
    magnitude,
    addedLines: added.length,
    removedLines: removed.length,
    segments: condense(ops),
    pricingChanges,
    addedText: added.map((o) => o.text.slice(0, 220)),
    removedText: removed.map((o) => o.text.slice(0, 220)),
    totalLines,
  };
}

export function isCosmetic(result: DiffResult): boolean {
  if (result.pricingChanges.length > 0) return false;
  const churn = result.addedLines + result.removedLines;
  if (churn <= 1 && result.similarity > 0.995) return true;
  const meaningful = [...result.addedText, ...result.removedText].filter((t) => stripMarkdown(t).length > 24);
  return meaningful.length === 0 && result.similarity > 0.985;
}

/** Token-level overlap that is more forgiving of reordering than a line diff. */
export function jaccard(oldMarkdown: string, newMarkdown: string): number {
  const tokenize = (text: string) =>
    new Set(
      stripMarkdown(text)
        .toLowerCase()
        .split(/[^a-z0-9$%.]+/)
        .filter((t) => t.length > 2),
    );
  const a = tokenize(oldMarkdown);
  const b = tokenize(newMarkdown);
  if (!a.size && !b.size) return 1;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 1;
}
