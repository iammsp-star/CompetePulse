import * as cheerio from 'cheerio';
import { truncate } from '../lib/util';

// cheerio's internal DOM node types differ between releases; runtime shape is stable.
type El = any;

export interface ExtractedPage {
  title: string;
  markdown: string;
  wordCount: number;
}

export interface PricingTier {
  plan: string;
  price: string;
  monthly: number | null;
  billing: string;
  features: string[];
}

const BLOCK_TAGS = new Set(['p', 'div', 'section', 'article', 'ul', 'ol', 'table', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre']);

function isBoilerplate(el: El): boolean {
  const attrs = `${el.attribs?.class ?? ''} ${el.attribs?.id ?? ''} ${el.attribs?.role ?? ''}`.toLowerCase();
  return /cookie|consent|gdpr|newsletter|subscribe-modal|modal|popup|intercom|drift-|chat-widget|announcement-bar/.test(
    attrs,
  );
}

/**
 * Convert a cheerio node into readable markdown. Table rows become pipe tables so
 * pricing tiers survive the extraction instead of collapsing into one line.
 */
function nodeToMarkdown($: cheerio.CheerioAPI, el: El): string {
  const tag = el.tagName?.toLowerCase() ?? '';
  if (!tag) return $(el).text();
  if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5' || tag === 'h6') {
    const level = Number(tag[1]);
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    return text ? `${'#'.repeat(level)} ${text}` : '';
  }
  if (tag === 'p') {
    const text = inlineMarkdown($, el).replace(/\s+/g, ' ').trim();
    return text;
  }
  if (tag === 'ul' || tag === 'ol') {
    const items: string[] = [];
    $(el)
      .children('li')
      .each((_, li) => {
        const text = inlineMarkdown($, li).replace(/\s+/g, ' ').trim();
        if (text) items.push(`- ${text}`);
      });
    return items.join('\n');
  }
  if (tag === 'table') {
    const rows: string[][] = [];
    $(el)
      .find('tr')
      .each((_, tr) => {
        const cells = $(tr)
          .children('th,td')
          .map((_, cell) => $(cell).text().replace(/\s+/g, ' ').trim())
          .get();
        if (cells.length) rows.push(cells);
      });
    if (!rows.length) return '';
    const width = Math.max(...rows.map((r) => r.length));
    const padded = rows.map((r) => [...r, ...Array(width - r.length).fill('')]);
    const header = padded[0];
    const body = padded.slice(1);
    return [
      `| ${header.join(' | ')} |`,
      `| ${header.map(() => '---').join(' | ')} |`,
      ...body.map((r) => `| ${r.join(' | ')} |`),
    ].join('\n');
  }
  if (tag === 'blockquote') {
    return $(el)
      .text()
      .split('\n')
      .map((l) => `> ${l.trim()}`)
      .join('\n');
  }
  if (tag === 'pre') {
    return `\`\`\`\n${$(el).text().trim()}\n\`\`\``;
  }
  if (tag === 'br') return '\n';

  // Generic container: walk children in order.
  const parts: string[] = [];
  $(el)
    .contents()
    .each((_, child) => {
      if (child.type === 'text') {
        const text = $(child).text().replace(/\s+/g, ' ').trim();
        if (text) parts.push(text);
        return;
      }
      if (child.type !== 'tag') return;
      const childEl = child as El;
      const childTag = childEl.tagName?.toLowerCase();
      if (!childTag) return;
      if (['script', 'style', 'noscript', 'svg', 'iframe', 'form', 'button', 'select', 'input'].includes(childTag)) {
        return;
      }
      if (isBoilerplate(childEl)) return;
      const piece = nodeToMarkdown($, childEl);
      if (piece.trim()) parts.push(piece);
    });
  return parts.join(BLOCK_TAGS.has(tag) ? '\n\n' : '\n');
}

function inlineMarkdown($: cheerio.CheerioAPI, el: El): string {
  const parts: string[] = [];
  $(el)
    .contents()
    .each((_, child) => {
      if (child.type === 'text') {
        parts.push($(child).text().replace(/\s+/g, ' '));
        return;
      }
      if (child.type !== 'tag') return;
      const c = child as El;
      const tag = c.tagName?.toLowerCase();
      if (!tag) return;
      if (['script', 'style', 'noscript', 'svg', 'button'].includes(tag) || isBoilerplate(c)) return;
      const inner = inlineMarkdown($, c);
      if (tag === 'strong' || tag === 'b') parts.push(`**${inner.trim()}**`);
      else if (tag === 'em' || tag === 'i') parts.push(`*${inner.trim()}*`);
      else if (tag === 'br') parts.push('\n');
      else if (tag === 'a') {
        const href = $(c).attr('href');
        parts.push(href && !href.startsWith('#') ? `[${inner.trim()}](${href})` : inner);
      } else parts.push(inner);
    });
  return parts.join('');
}

/** Remove cookie/nav/footer noise and extract the primary content as markdown. */
export function htmlToMarkdown(html: string): ExtractedPage {
  const $ = cheerio.load(html);
  $('script, style, noscript, template, svg, iframe, form, button, input, select, textarea').remove();
  $('header, footer, nav, aside').remove();
  $('[class],[id],[role],[aria-label]').each((_, el) => {
    if (isBoilerplate(el) || /^(navigation|banner|contentinfo|complementary)$/.test(el.attribs?.role ?? '')) {
      $(el).remove();
    }
  });

  const title = ($('meta[property="og:title"]').attr('content') || $('title').text() || $('h1').first().text())
    .replace(/\s+/g, ' ')
    .trim();
  const main =
    $('main').first().length > 0
      ? $('main').first()
      : $('article').first().length > 0
        ? $('article').first()
        : $('[role="main"]').first().length > 0
          ? $('[role="main"]').first()
          : $('.content, #content, .main-content, #main-content').first().length > 0
            ? $('.content, #content, .main-content, #main-content').first()
            : $('body').first();

  let markdown = nodeToMarkdown($, (main.get(0) as El) ?? $.root().get(0));
  markdown = markdown
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  if (title && !markdown.startsWith('# ')) markdown = `# ${title}\n\n${markdown}`;

  const wordCount = markdown.split(/\s+/).filter(Boolean).length;
  return { title, markdown, wordCount };
}

/** Pull plan names and prices out of a page, supporting markdown tables and pricing cards. */
export function extractPricing(markdown: string): PricingTier[] {
  const tiers: PricingTier[] = [];
  const seen = new Set<string>();
  const priceRegex = /(?:^|\s)([$€£])\s?(\d{1,4})(?:\.(\d{1,2}))?\s*(?:\/\s*(mo|month|yr|year|user\/mo))?/gi;

  const pushTier = (
    plan: string,
    price: string,
    monthly: number | null,
    billing: string,
    features: string[],
  ): PricingTier | null => {
    const key = `${plan.toLowerCase()}|${price}`;
    if (seen.has(key) || !plan) return null;
    seen.add(key);
    const tier = { plan: plan.trim(), price, monthly, billing, features: features.slice(0, 8) };
    tiers.push(tier);
    return tier;
  };

  const lines = markdown.split('\n');
  // Table-based pricing: header contains the plan names and rows contain prices.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || i + 1 >= lines.length || !/^\|\s*-{2,}/.test(lines[i + 1].trim())) continue;
    const header = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    const body = lines
      .slice(i + 2)
      .filter((l) => l.trim().startsWith('|'))
      .map((l) =>
        l
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim()),
      );
    const priceRow = body.find((r) => r.some((c) => /[$€£]\s?\d/.test(c)));
    if (!priceRow) continue;
    header.forEach((h, idx) => {
      const cell = priceRow[idx] ?? '';
      const match = cell.match(/[$€£]\s?(\d{1,4})(?:\.\d+)?/);
      if (match && h && !/plan|feature|price/i.test(h)) {
        pushTier(h, match[0], Number(match[1]), inferBilling(cell), []);
      }
    });
  }

  // Pricing cards: a heading or short line with a plan name followed by a price.
  const headingRe = /^(#{2,4})\s+(.+)$/;
  let currentPlan = '';
  let currentFeatures: string[] = [];
  let activeTier: PricingTier | null = null;
  let captured = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(headingRe);
    if (heading) {
      currentPlan = heading[2]
        .replace(/\b(plan|pricing|tiers?)\b/gi, '')
        .replace(/[|:–—-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      currentFeatures = [];
      activeTier = null;
      captured = false;
      continue;
    }
    if (/^(starter|basic|pro|growth|team|business|scale|enterprise|free|plus|premium|standard|essentials)\b/i.test(line) && line.length < 40) {
      const priceMatch = line.match(priceRegex);
      if (priceMatch) {
        activeTier = pushTier(
          line.split(/[$€£]/)[0].trim(),
          priceMatch[0].trim(),
          Number(priceMatch[0].match(/\d+/)?.[0] ?? 0),
          inferBilling(line),
          [],
        );
        captured = true;
        continue;
      }
    }
    const match = line.match(priceRegex);
    if (match && !captured) {
      const price = match[0].trim();
      const plan =
        currentPlan ||
        line
          .slice(0, match.index)
          .replace(/[|:–—-]/g, ' ')
          .trim();
      if (plan) {
        activeTier = pushTier(plan, price, Number(price.match(/\d+/)?.[0] ?? 0), inferBilling(line), []);
        captured = true;
      }
      continue;
    }
    if (line.startsWith('- ') && currentPlan) {
      currentFeatures.push(line.slice(2));
      if (activeTier && activeTier.features.length < 8 && !activeTier.features.includes(line.slice(2))) {
        activeTier.features.push(line.slice(2));
      }
    }
  }

  // Deduplicate by plan name where a table price and card price agree.
  const byPlan = new Map<string, PricingTier>();
  for (const tier of tiers) {
    const existing = byPlan.get(tier.plan.toLowerCase());
    if (!existing || (existing.monthly === null && tier.monthly !== null)) byPlan.set(tier.plan.toLowerCase(), tier);
  }
  return [...byPlan.values()];
}

function inferBilling(text: string): string {
  if (/year|annual|yr/i.test(text)) return 'annual';
  if (/user/i.test(text)) return 'per seat';
  if (/month|mo\b/i.test(text)) return 'monthly';
  return 'monthly';
}

function uniqueLines(text: string): string[] {
  return [...new Set(text.split('\n').map((l) => l.trim()).filter(Boolean))];
}

/** Section-aware chunks used for embedding and retrieval. */
export function chunkMarkdown(markdown: string, maxChars = 900): { section: string; text: string }[] {
  const chunks: { section: string; text: string }[] = [];
  let section = 'Overview';
  let buffer = '';
  const flush = () => {
    const text = buffer.trim();
    if (text.length < 40) {
      buffer = '';
      return;
    }
    if (text.length <= maxChars) chunks.push({ section, text });
    else {
      const sentences = text.split(/(?<=[.!?])\s+/);
      let current = '';
      for (const sentence of sentences) {
        if ((current + ' ' + sentence).length > maxChars && current) {
          chunks.push({ section, text: current.trim() });
          current = sentence;
        } else current += ' ' + sentence;
      }
      if (current.trim()) chunks.push({ section, text: current.trim() });
    }
    buffer = '';
  };

  for (const line of markdown.split('\n')) {
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flush();
      section = heading[2].trim().slice(0, 80);
      buffer += line + '\n';
      continue;
    }
    if (line.trim() === '' && buffer.length > 600) flush();
    buffer += line + '\n';
  }
  flush();
  return chunks.slice(0, 40);
}

export function cleanSnippet(text: string, max = 280): string {
  return truncate(text.replace(/^#+\s*/gm, '').replace(/\n+/g, ' '), max);
}

export { uniqueLines };
