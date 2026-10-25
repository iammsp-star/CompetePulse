import assert from 'node:assert/strict';
import test from 'node:test';
import { diffMarkdown, isCosmetic, jaccard } from '../services/diff';
import { chunkMarkdown, extractPricing, htmlToMarkdown } from '../services/extract';
import { cosine, localEmbedding } from '../services/embeddings';
import { shouldNotify } from '../services/notify';
import { DEFAULT_SETTINGS } from '../db';
import type { Insight, Settings } from '../../shared/types';

const BASE_PRICING = `# Orbitly Pricing

Simple plans that scale with your data.

## Starter
$49 per month

For small teams getting their first audience live.
- 10,000 monthly tracked users
- 3 data sources
- 30-day data history

## Growth
$149 per month

For teams running always-on lifecycle programs.
- 100,000 monthly tracked users
- 12 data sources
- 12-month history

**Last updated:** Oct 12`;

test('pricing extraction finds plan prices and features', () => {
  const tiers = extractPricing(BASE_PRICING);
  assert.equal(tiers.length, 2);
  assert.equal(tiers[0].plan, 'Starter');
  assert.equal(tiers[0].monthly, 49);
  assert.equal(tiers[1].plan, 'Growth');
  assert.equal(tiers[1].monthly, 149);
  assert.ok(tiers[1].features.some((feature) => feature.includes('100,000')));
});

test('diff detects price increases and plan additions', () => {
  const increased = BASE_PRICING.replace('$149 per month', '$179 per month');
  const result = diffMarkdown(BASE_PRICING, increased);
  assert.equal(result.changed, true);
  assert.equal(result.pricingChanges.length, 1);
  assert.deepEqual(result.pricingChanges[0], {
    plan: 'Growth',
    field: 'price',
    from: '$149',
    to: '$179',
  });
  assert.ok(result.similarity < 1);
  assert.equal(isCosmetic(result), false);

  const withTier = `${BASE_PRICING}\n\n## Enterprise\n$899 per month\n\n- Unlimited data sources\n- SSO`;
  const tierResult = diffMarkdown(BASE_PRICING, withTier);
  assert.ok(tierResult.pricingChanges.some((change) => change.field === 'tier' && change.plan === 'Enterprise'));
});

test('cosmetic and boilerplate churn is suppressed', () => {
  const cosmetic = BASE_PRICING.replace('**Last updated:** Oct 12', '**Last updated:** Oct 20').replace(/\n\n/g, '\n\n\n');
  const result = diffMarkdown(BASE_PRICING, cosmetic);
  assert.equal(result.changed, false);
  assert.equal(result.pricingChanges.length, 0);
  assert.equal(isCosmetic(result), true);
  assert.equal(jaccard(BASE_PRICING, cosmetic) > 0.98, true);
});

test('feature launches produce a line diff with evidence', () => {
  const changelog = '# Changelog\n\n## CSV import fixes — Oct 1\nResolved encoding issues.';
  const updated = '# Changelog\n\n## AI copilot (beta) — Oct 18\nBuild an audience in plain English.\n\n## CSV import fixes — Oct 1\nResolved encoding issues.';
  const result = diffMarkdown(changelog, updated);
  assert.equal(result.changed, true);
  assert.ok(result.addedText.some((line) => line.includes('AI copilot')));
  assert.ok(result.segments.some((segment) => segment.type === 'added'));
});

test('html extraction drops navigation, footers and cookie banners', () => {
  const html = `<html><head><title>Orbitly Pricing</title></head><body>
    <header><a href="/">Orbitly</a></header>
    <div class="cookie-banner">We use cookies</div>
    <main><h1>Pricing</h1><p>Start free.</p>
      <table><tr><th>Plan</th><th>Price</th></tr><tr><td>Growth</td><td>$149</td></tr></table>
    </main>
    <footer>Copyright 2026</footer>
    <script>track()</script>
  </body></html>`;
  const extracted = htmlToMarkdown(html);
  assert.ok(extracted.markdown.includes('# Pricing'));
  assert.ok(extracted.markdown.includes('| Growth | $149 |'));
  assert.equal(extracted.markdown.includes('cookies'), false);
  assert.equal(extracted.markdown.includes('Copyright'), false);
});

test('chunking is section aware and bounded', () => {
  const markdown = `# Pricing\n\n## Growth\n${'Unlimited dashboards and users. '.repeat(80)}\n\n## Enterprise\n${'Custom SLA and support. '.repeat(80)}`;
  const chunks = chunkMarkdown(markdown, 500);
  assert.ok(chunks.length >= 2);
  assert.ok(chunks.every((chunk) => chunk.text.length <= 700));
  assert.ok(chunks.some((chunk) => chunk.section === 'Enterprise'));
});

test('local embeddings rank related text above unrelated text', () => {
  const query = localEmbedding('enterprise SSO audit logs and role based access');
  const related = localEmbedding('SSO / SAML, audit logs and role-based access for enterprise security');
  const unrelated = localEmbedding('seasonal pricing discounts for startup marketing campaigns');
  const relatedScore = cosine(query, related);
  const unrelatedScore = cosine(query, unrelated);
  assert.ok(relatedScore > unrelatedScore);
  assert.ok(relatedScore > 0.35);
});

test('alert thresholds respect impact configuration', () => {
  const settings: Settings = { ...DEFAULT_SETTINGS, alertMinImpact: 'high' };
  const base: Insight = {
    id: 'i1',
    competitorId: 'c1',
    diffId: 'd1',
    category: 'pricing',
    impact: 'medium',
    title: 't',
    summary: 's',
    evidence: [],
    recommendation: 'r',
    confidence: 0.8,
    source: 'heuristic',
    createdAt: new Date().toISOString(),
    notified: 0,
    latencyMs: 100,
  };
  assert.equal(shouldNotify(base, settings), false);
  assert.equal(shouldNotify({ ...base, impact: 'high' }, settings), true);
  assert.equal(shouldNotify({ ...base, impact: 'medium' }, { ...settings, alertMinImpact: 'low' }), true);
});
