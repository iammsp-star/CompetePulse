import type { Target } from '../../shared/types';
import type { ScrapePage } from './types';
import { htmlToMarkdown } from './extract';
import { profileFor, simulateNextContent } from './demo';
import type { Settings } from '../../shared/types';

const FIRECRAWL_URL = process.env.FIRECRAWL_API_URL ?? 'https://api.firecrawl.dev/v2/scrape';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 CompetePulseBot/1.0';

export function scraperStatus() {
  if (process.env.FIRECRAWL_API_KEY) {
    return { provider: 'firecrawl', live: true, detail: `Firecrawl (${FIRECRAWL_URL}) with native fallback` };
  }
  return {
    provider: 'native',
    live: true,
    detail: 'Native fetch + readability extractor; falls back to the demo generator when a site is unreachable',
  };
}

async function firecrawl(url: string): Promise<ScrapePage> {
  const response = await fetch(FIRECRAWL_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'screenshot'],
      onlyMainContent: true,
      removeBase64Images: true,
      timeout: 45000,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`Firecrawl ${response.status}: ${(await response.text()).slice(0, 180)}`);
  const payload = (await response.json()) as {
    success?: boolean;
    data?: { markdown?: string; screenshot?: string; metadata?: { title?: string; sourceURL?: string } };
    markdown?: string;
    screenshot?: string;
    metadata?: { title?: string };
  };
  const data = payload.data ?? payload;
  const markdown = String(data.markdown ?? '').trim();
  if (markdown.split(/\s+/).length < 20) throw new Error('Firecrawl returned too little content');
  const screenshot = data.screenshot ?? null;
  return {
    title: data.metadata?.title?.trim() || new URL(url).hostname,
    markdown,
    screenshotUrl: screenshot && screenshot.startsWith('http') ? screenshot : null,
    mode: 'live',
    provider: 'firecrawl',
    wordCount: markdown.split(/\s+/).length,
  };
}

async function nativeFetch(url: string): Promise<ScrapePage> {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
      'cache-control': 'no-cache',
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('html') && !contentType.includes('text')) {
    throw new Error(`Unsupported content type ${contentType || 'unknown'}`);
  }
  const html = await response.text();
  const extracted = htmlToMarkdown(html);
  if (extracted.wordCount < 15) throw new Error('Extracted content was empty or blocked');
  return {
    title: extracted.title || new URL(url).hostname,
    markdown: extracted.markdown,
    screenshotUrl: null,
    mode: 'live',
    provider: 'native',
    wordCount: extracted.wordCount,
  };
}

export async function scrapePage(
  competitor: { name: string; domain: string },
  target: Pick<Target, 'type' | 'url'>,
  settings: Settings,
  existingSnapshots: number,
): Promise<ScrapePage> {
  const demo = (reason: string): ScrapePage => {
    const variant = Math.max(1, existingSnapshots + 1);
    const profile = profileFor(competitor.name);
    const simulated = simulateNextContent(profile, target.type, variant);
    return {
      title: simulated.title,
      markdown: simulated.markdown,
      screenshotUrl: null,
      mode: 'simulated',
      provider: `demo:${reason}`,
      wordCount: simulated.markdown.split(/\s+/).length,
    };
  };

  if (process.env.FIRECRAWL_API_KEY) {
    try {
      return await firecrawl(target.url);
    } catch (error) {
      console.warn(`[scraper] Firecrawl failed for ${target.url}: ${(error as Error).message}`);
    }
  }

  try {
    return await nativeFetch(target.url);
  } catch (error) {
    if (!settings.demoFallback) throw error;
    console.info(`[scraper] ${target.url} unreachable (${(error as Error).message}); generating simulated snapshot`);
    return demo('unreachable');
  }
}
