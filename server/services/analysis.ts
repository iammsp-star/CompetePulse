import type {
  Category,
  Impact,
  Insight,
  PricingChange,
  SearchResult,
  TargetType,
} from '../../shared/types';
import type { DiffResult } from './diff';
import { stripMarkdown, titleCase, truncate } from '../lib/util';
import { embeddingsProvider } from './embeddings';
import { scraperStatus } from './scraper';
import { vectorStoreStatus } from './vectorStore';

export interface InsightDraft {
  category: Category;
  impact: Impact;
  title: string;
  summary: string;
  evidence: string[];
  recommendation: string;
  confidence: number;
  source: 'llm' | 'heuristic';
}

export interface AnalyzeInput {
  competitorName: string;
  targetType: TargetType;
  diff: DiffResult;
  useLlm?: boolean;
}

export function llmStatus() {
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      live: true,
      detail: `${process.env.OPENAI_MODEL ?? 'gpt-4o-mini'} with heuristic fallback`,
    };
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: 'anthropic', live: false, detail: 'Anthropic key found but not wired; using heuristics' };
  }
  return { provider: 'heuristic', live: false, detail: 'Deterministic rubric engine (set OPENAI_API_KEY for LLM synthesis)' };
}

export function providerStatus() {
  const embeddings = embeddingsProvider();
  return {
    scraper: scraperStatus(),
    llm: llmStatus(),
    embeddings: {
      provider: embeddings.provider,
      live: embeddings.provider === 'openai',
      detail:
        embeddings.provider === 'openai'
          ? `${embeddings.model} (${embeddings.dim}d)`
          : 'Local feature-hash embeddings (set OPENAI_API_KEY for text-embedding-3-small)',
    },
    vectorStore: vectorStoreStatus(),
    slack: {
      configured: Boolean(process.env.SLACK_WEBHOOK_URL),
      detail: process.env.SLACK_WEBHOOK_URL ? 'SLACK_WEBHOOK_URL is set' : 'Add a webhook in Settings or set SLACK_WEBHOOK_URL',
    },
    email: {
      configured: Boolean(process.env.RESEND_API_KEY),
      detail: process.env.RESEND_API_KEY ? 'Resend API key detected' : 'Set RESEND_API_KEY to enable email briefings',
    },
  };
}

function cleanEvidence(line: string, prefix: '+' | '−'): string {
  return `${prefix} ${truncate(stripMarkdown(line), 170)}`;
}

function parsePrice(value: string): number | null {
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function priceSummary(changes: PricingChange[]): string {
  const rank = (change: PricingChange) => (change.field === 'tier' ? 0 : change.field === 'price' ? 1 : 2);
  return [...changes]
    .sort((a, b) => rank(a) - rank(b))
    .map((c) => {
      if (c.field === 'price') {
        const from = parsePrice(c.from);
        const to = parsePrice(c.to);
        const pct = from && to ? Math.abs(Math.round(((to - from) / from) * 100)) : null;
        return `${c.plan} moved from ${c.from} to ${c.to}/mo${pct ? ` (+${pct}%)` : ''}`;
      }
      if (c.field === 'tier') {
        if (c.from === 'not offered') return `New ${c.plan} tier at ${c.to.replace(/ plan$/, '/mo')}`;
        if (c.to === 'removed') return `${c.plan} tier retired`;
        return `${c.plan} tier updated`;
      }
      if (c.field === 'features') return `${c.plan} plan now lists ${c.to}`;
      return `${c.plan} ${c.field} updated`;
    })
    .join('. ');
}

function pageLabel(type: TargetType): string {
  const labels: Record<TargetType, string> = {
    pricing: 'pricing page',
    changelog: 'changelog',
    landing: 'homepage',
    blog: 'blog',
    docs: 'docs',
  };
  return labels[type] ?? 'page';
}

function headlineFrom(lines: string[]): string | null {
  for (const line of lines) {
    const match = stripMarkdown(line).trim();
    if (!match) continue;
    if (line.trim().startsWith('#')) return truncate(match.replace(/\s+—\s+.*$/, ''), 90);
  }
  return null;
}

function featureFrom(lines: string[]): string | null {
  for (const line of lines) {
    const clean = stripMarkdown(line).replace(/\s+—\s+.*$/, '').trim();
    if (line.trim().startsWith('#') && clean.length < 80) return clean;
  }
  for (const line of lines) {
    const match = line.match(/(?:launch(?:ed|ing)?|introduc(?:ed|ing)|now available|new|ships?|shipped|added|beta)\s+(.{4,80})/i);
    if (match) return truncate(match[1].replace(/[.:].*$/, ''), 80);
  }
  return null;
}

function impactFromPricing(changes: PricingChange[]): Impact {
  let impact: Impact = 'low';
  for (const change of changes) {
    if (change.field === 'tier') return 'high';
    if (change.field === 'billing') impact = 'medium';
    if (change.field === 'price') {
      const from = parsePrice(change.from);
      const to = parsePrice(change.to);
      if (from && to) {
        const pct = Math.abs((to - from) / from) * 100;
        if (pct >= 5) return 'high';
        if (pct >= 2) impact = 'medium';
      } else impact = 'medium';
    }
  }
  return impact;
}

function heuristic(input: AnalyzeInput): InsightDraft[] {
  const { competitorName, targetType, diff } = input;
  const added = diff.addedText;
  const removed = diff.removedText;
  const evidence = [
    ...added.slice(0, 4).map((line) => cleanEvidence(line, '+')),
    ...removed.slice(0, 3).map((line) => cleanEvidence(line, '−')),
  ].slice(0, 6);
  const changeStats = `${diff.addedLines} line${diff.addedLines === 1 ? '' : 's'} added, ${diff.removedLines} removed (${Math.round(diff.similarity * 100)}% similar).`;

  if (diff.pricingChanges.length) {
    const changes = diff.pricingChanges;
    const priceChange = changes.find((c) => c.field === 'price');
    const tierChange = changes.find((c) => c.field === 'tier');
    const impact = impactFromPricing(changes);
    const addedTier = tierChange && tierChange.from === 'not offered';
    const pct = priceChange
      ? Math.round(
          ((parsePrice(priceChange.to)! - parsePrice(priceChange.from)!) / parsePrice(priceChange.from)!) * 100,
        )
      : null;
    const article = /^(a|e|i|o|u|8|11|18)/i.test(tierChange?.plan ?? '') ? 'an' : 'a';
    const featureChange = changes.find((c) => c.field === 'features');
    const title = addedTier
      ? `${competitorName} introduced ${article} ${tierChange!.plan} tier at ${tierChange!.to.replace(/ plan$/, '/mo')}`
      : tierChange
        ? `${competitorName} retired the ${tierChange.plan} plan`
        : priceChange
          ? `${competitorName} ${pct && pct > 0 ? 'raised' : 'cut'} ${priceChange.plan} pricing${pct ? ` ${Math.abs(pct)}%` : ''} to ${priceChange.to}/mo`
          : featureChange
            ? `${competitorName} expanded ${featureChange.plan} plan features`
            : `${competitorName} changed packaging on its pricing page`;
    const summary = `${priceSummary(changes)}. The update changes how ${competitorName} packages its offer on the ${pageLabel(targetType)}.${
      addedTier ? ' The new tier adds an enterprise motion and an upsell path above the existing plans.' : ''
    }`;
    return [
      {
        category: 'pricing',
        impact,
        title,
        summary,
        evidence,
        recommendation: addedTier
          ? `Update the pricing battlecard with the new ${tierChange!.plan} tier, confirm which features unlock at that level, and brief sales on how to defend against an enterprise upsell.`
          : `Re-benchmark your packaging against ${competitorName}: check whether your equivalent tier still wins on value, and refresh the sales objection doc before the next renewal cycle.`,
        confidence: priceChange || addedTier ? 0.93 : 0.82,
        source: 'heuristic',
      },
    ];
  }

  const featureLine = featureFrom(added);
  const headline = headlineFrom(added);
  const partnership = added.some((line) => /partner|integration|integrat|acquired|marketplace/i.test(line));
  const fixOnly = added.length > 0 && added.every((l) => /fix|bug|resolve|performance|faster|improve/i.test(l));

  if (targetType === 'changelog' || targetType === 'docs') {
    const category: Category = partnership ? 'partnership' : 'feature';
    const impact: Impact = fixOnly
      ? 'low'
      : category === 'partnership'
        ? 'medium'
        : /ai|agent|enterprise|security/i.test(`${featureLine ?? ''} ${added.slice(0, 2).join(' ')}`)
          ? 'high'
          : 'medium';
    const feature = (featureLine ?? 'a product update').replace(/\s+(integration|partnership|beta)$/i, '');
    const title = partnership
      ? `${competitorName} announced a ${feature} integration`
      : fixOnly
        ? `${competitorName} shipped reliability fixes`
        : `${competitorName} launched ${feature}`;
    return [
      {
        category,
        impact,
        title,
        summary: `${competitorName} updated its ${pageLabel(targetType)} with ${feature}. ${changeStats} ${
          impact === 'high'
            ? 'This closes ground on a category buyers actively evaluate, so it belongs in the next competitive review.'
            : 'Worth tracking for roadmap and positioning context, but not an immediate deal risk.'
        }`,
        evidence,
        recommendation: partnership
          ? `Map the integration against your own ecosystem coverage and update the "works with" section of your comparison page.`
          : `Add ${feature} to the feature matrix, tag deals where it is a decision criterion, and decide whether it changes your roadmap narrative this quarter.`,
        confidence: fixOnly ? 0.72 : 0.84,
        source: 'heuristic',
      },
    ];
  }

  if (targetType === 'landing') {
    const impact: Impact = diff.magnitude > 0.35 ? 'high' : 'medium';
    const title = headline
      ? `${competitorName} repositioned around “${headline}”`
      : `${competitorName} refreshed its homepage messaging`;
    return [
      {
        category: 'messaging',
        impact,
        title,
        summary: `${competitorName} changed its homepage headline and value props. ${changeStats} The new copy${
          headline ? ` leads with “${headline}”` : ''
        }, which signals a shift in the audience and problem they want to own.`,
        evidence,
        recommendation: `Refresh the messaging comparison slide with the new headline, and review whether your own hero still draws a clear contrast against this positioning.`,
        confidence: 0.78,
        source: 'heuristic',
      },
    ];
  }

  return [
    {
      category: 'other',
      impact: diff.magnitude > 0.4 ? 'medium' : 'low',
      title: `${competitorName} updated its ${pageLabel(targetType)}`,
      summary: `Detected a content update. ${changeStats}`,
      evidence,
      recommendation: 'Review the diff and decide whether this belongs in the weekly briefing.',
      confidence: 0.6,
      source: 'heuristic',
    },
  ];
}

const SYSTEM_PROMPT = `You are a senior competitive intelligence analyst. Analyze the website change and return insights for product, sales and marketing leaders.
Rules:
- Only report material changes. Ignore formatting, navigation and cookie banners.
- Category must be one of: pricing, feature, messaging, partnership, other.
- Impact must be one of: high, medium, low. High means it could change a deal, pricing strategy or roadmap this quarter.
- Titles are specific and under 90 characters. No fluff, no "competitor updated page".
- Recommendations are one concrete action, not generic advice.
- Return JSON only: {"insights":[{"category","impact","title","summary","evidence":string[],"recommendation","confidence":0-1}]}.
- Produce at most 2 insights. If the change is cosmetic, return {"insights":[]}.`;

async function llmAnalyze(input: AnalyzeInput): Promise<InsightDraft[] | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
  const payload = {
    competitor: input.competitorName,
    pageType: input.targetType,
    similarity: Number(input.diff.similarity.toFixed(3)),
    magnitude: Number(input.diff.magnitude.toFixed(3)),
    pricingChanges: input.diff.pricingChanges,
    addedLines: input.diff.addedText.slice(0, 40),
    removedLines: input.diff.removedText.slice(0, 30),
  };
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(payload) },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 200)}`);
    const data = (await response.json()) as { choices: { message: { content: string } }[] };
    const parsed = JSON.parse(data.choices[0]?.message?.content ?? '{}') as { insights?: unknown[] };
    const allowedCategories = new Set(['pricing', 'feature', 'messaging', 'partnership', 'other']);
    const allowedImpact = new Set(['high', 'medium', 'low']);
    const drafts: InsightDraft[] = [];
    for (const raw of parsed.insights ?? []) {
      if (typeof raw !== 'object' || !raw) continue;
      const item = raw as Record<string, unknown>;
      if (!allowedCategories.has(String(item.category)) || !allowedImpact.has(String(item.impact))) continue;
      if (!item.title || !item.summary) continue;
      drafts.push({
        category: String(item.category) as Category,
        impact: String(item.impact) as Impact,
        title: String(item.title).slice(0, 140),
        summary: String(item.summary).slice(0, 800),
        evidence: Array.isArray(item.evidence) ? item.evidence.map(String).slice(0, 6) : [],
        recommendation: String(item.recommendation ?? 'Review the change with the team.').slice(0, 400),
        confidence: Math.min(0.99, Math.max(0.3, Number(item.confidence ?? 0.8))),
        source: 'llm',
      });
    }
    return drafts.length ? drafts : null;
  } catch (error) {
    console.warn('[analysis] LLM failed, using heuristics:', (error as Error).message);
    return null;
  }
}

export async function analyzeChange(input: AnalyzeInput): Promise<InsightDraft[]> {
  if (input.useLlm !== false) {
    const llm = await llmAnalyze(input);
    if (llm) return llm;
  }
  return heuristic(input);
}

export async function generateDigestMarkdown(options: {
  weekStart: string;
  weekEnd: string;
  insights: Insight[];
  productName: string;
  useLlm?: boolean;
}): Promise<string> {
  const { weekStart, weekEnd, insights, productName } = options;
  const start = new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const end = new Date(weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const high = insights.filter((i) => i.impact === 'high');
  const pricing = insights.filter((i) => i.category === 'pricing');
  const features = insights.filter((i) => i.category === 'feature' || i.category === 'partnership');
  const messaging = insights.filter((i) => i.category === 'messaging');
  const competitors = [...new Set(insights.map((i) => i.competitorName ?? 'Unknown'))];

  const summary =
    insights.length === 0
      ? `No material competitor changes were detected between ${start} and ${end}. Monitoring continues across all tracked pages.`
      : `${competitors.length} competitor${competitors.length === 1 ? '' : 's'} made ${insights.length} material move${insights.length === 1 ? '' : 's'} this week, including ${high.length} high-impact change${high.length === 1 ? '' : 's'}. ${
          pricing.length
            ? `${pricing.length} pricing update${pricing.length === 1 ? '' : 's'} deserve${pricing.length === 1 ? 's' : ''} packaging review. `
            : ''
        }${features.length ? `${features.length} product update${features.length === 1 ? '' : 's'} expand${features.length === 1 ? 's' : ''} their surface area.` : ''}`;

  const section = (title: string, items: Insight[]) =>
    items.length
      ? `## ${title}\n\n${items
          .map(
            (i) =>
              `### ${i.competitorName} — ${i.title}\n${i.summary}\n\n- **Impact:** ${titleCase(i.impact)} · **Category:** ${titleCase(i.category)} · **Confidence:** ${Math.round(i.confidence * 100)}%\n- **Recommended action:** ${i.recommendation}`,
          )
          .join('\n\n')}`
      : `## ${title}\n\nNo material changes detected in this category.`;

  const actions = [...high, ...insights.filter((i) => i.impact === 'medium')].slice(0, 5);

  const heuristic = `# Competitive Intelligence Briefing

**${start} – ${end}** · Prepared for the ${productName} team · ${insights.length} signals reviewed

## Executive summary

${summary}

${high.length ? `The highest-signal moves came from ${[...new Set(high.map((i) => i.competitorName))].join(', ')}.` : 'No high-impact moves to escalate this week.'}

${section('Pricing watch', pricing)}

${section('Product & partnership moves', features)}

${section('Messaging & positioning', messaging)}

## Recommended actions

${
  actions.length
    ? actions.map((a, idx) => `${idx + 1}. **${a.competitorName}:** ${a.recommendation}`).join('\n')
    : '1. Keep monitoring. No action required this week.'
}

---
*Generated by CompetePulse from monitored pricing pages, changelogs and homepages. All times UTC.*`;

  if (!process.env.OPENAI_API_KEY || options.useLlm === false) return heuristic;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'You are a competitive intelligence lead writing a weekly executive briefing. Use only the provided insights. Be specific, concise and action-oriented. Markdown with an executive summary, pricing watch, product moves, messaging, and recommended actions. Do not invent facts.',
          },
          {
            role: 'user',
            content: JSON.stringify({ weekStart, weekEnd, productName, insights: insights.slice(0, 40) }),
          },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as { choices: { message: { content: string } }[] };
    const content = data.choices[0]?.message?.content?.trim();
    return content && content.length > 200 ? content : heuristic;
  } catch (error) {
    console.warn('[analysis] digest LLM failed:', (error as Error).message);
    return heuristic;
  }
}

export async function answerFromResults(question: string, results: SearchResult[]): Promise<{ answer: string; source: 'llm' | 'retrieval' }> {
  if (!results.length) {
    return {
      answer:
        'I could not find matching content in the latest snapshots. Try a broader question, or run a scan so newer pages are indexed.',
      source: 'retrieval',
    };
  }
  const grouped = new Map<string, SearchResult[]>();
  for (const result of results) {
    const list = grouped.get(result.competitorName) ?? [];
    list.push(result);
    grouped.set(result.competitorName, list);
  }
  const fallback = `Based on the latest monitored pages:\n\n${[...grouped.entries()]
    .map(
      ([name, items]) =>
        `**${name}**\n${items
          .slice(0, 2)
          .map((r) => `- ${truncate(r.text.replace(/^#+\s*/gm, '').replace(/\n/g, ' '), 300)} *(${r.section}, ${r.targetType} page)*`)
          .join('\n')}`,
    )
    .join('\n\n')}\n\nThese are retrieved excerpts, not a generated synthesis. Add an OpenAI key in Settings to get an analyst-written answer.`;

  if (!process.env.OPENAI_API_KEY) return { answer: fallback, source: 'retrieval' };
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Answer the analyst question using ONLY the supplied competitor page excerpts. Cite competitor names inline. If the excerpts do not answer it, say so. Keep the answer under 250 words and end with one strategic implication.',
          },
          { role: 'user', content: JSON.stringify({ question, excerpts: results.map((r) => ({ competitor: r.competitorName, page: r.targetType, section: r.section, text: r.text })) }) },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) throw new Error(String(response.status));
    const data = (await response.json()) as { choices: { message: { content: string } }[] };
    const answer = data.choices[0]?.message?.content?.trim();
    return answer ? { answer, source: 'llm' } : { answer: fallback, source: 'retrieval' };
  } catch (error) {
    console.warn('[analysis] answer LLM failed:', (error as Error).message);
    return { answer: fallback, source: 'retrieval' };
  }
}
