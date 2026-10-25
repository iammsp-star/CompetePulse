import crypto from 'node:crypto';

export const uid = (prefix = '') => `${prefix}${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

export const nowIso = () => new Date().toISOString();

export const sha256 = (text: string) => crypto.createHash('sha256').update(text).digest('hex');

export function daysAgoIso(days: number, hour = 9): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, Math.floor(Math.random() * 50), 0, 0);
  return d.toISOString();
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

export function startOfWeekIso(date = new Date()): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // Monday start
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function truncate(text: string, len = 160) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > len ? clean.slice(0, len - 1) + '…' : clean;
}

export function normalizeLine(line: string): string {
  return line
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/^[-*+]\s+/, '- ')
    .trim()
    .toLowerCase();
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const delta = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(delta)) return 'unknown';
  const mins = Math.round(delta / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function isoDay(iso: string): string {
  return iso.slice(0, 10);
}

export function titleCase(value: string): string {
  return value.replace(/(^|\s)\S/g, (s) => s.toUpperCase());
}
