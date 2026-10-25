import type { TargetType, Tier } from '../../shared/types';

export interface DemoPlan {
  name: string;
  price: number;
  blurb: string;
  features: string[];
}

export interface DemoProfile {
  name: string;
  domain: string;
  industry: string;
  tier: Tier;
  description: string;
  color: string;
  tagline: string;
  subhead: string;
  plans: DemoPlan[];
  changelog: { title: string; detail: string; kind: 'feature' | 'fix' | 'partnership' | 'pricing' }[];
  valueProps: { title: string; detail: string }[];
  features: { name: string; category: string; status: 'ga' | 'beta' | 'planned' | 'none' }[];
}

const daysAgoLabel = (days: number) => {
  const d = new Date(Date.now() - days * 86400000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const DEMO_PROFILES: DemoProfile[] = [
  {
    name: 'Orbitly',
    domain: 'orbitly.com',
    industry: 'Customer data platform',
    tier: 'tier1',
    description: 'Warehouse-native CDP for growth teams, strong in identity resolution and reverse ETL.',
    color: '#6ee7b7',
    tagline: 'The customer data platform for modern growth teams',
    subhead: 'Unify every touchpoint, activate audiences in minutes, and prove revenue impact without engineering tickets.',
    plans: [
      {
        name: 'Starter',
        price: 49,
        blurb: 'For small teams getting their first audience live.',
        features: ['10,000 monthly tracked users', '3 data sources', '30-day data history', 'Email support'],
      },
      {
        name: 'Growth',
        price: 149,
        blurb: 'For teams running always-on lifecycle programs.',
        features: ['100,000 monthly tracked users', '12 data sources', '12-month history', 'Slack + email support'],
      },
      {
        name: 'Scale',
        price: 399,
        blurb: 'For multi-product companies with governance needs.',
        features: ['500,000 monthly tracked users', 'Unlimited data sources', 'SSO & SCIM', 'Dedicated success manager'],
      },
    ],
    changelog: [
      { title: 'Audience templates', detail: '12 prebuilt lifecycle audiences you can clone and personalize in one click.', kind: 'feature' },
      { title: 'Warehouse sync 2.0', detail: 'Incremental syncs are now 4x faster with automatic schema drift detection.', kind: 'feature' },
      { title: 'CSV import fixes', detail: 'Resolved encoding issues for non-UTF8 exports and duplicate header rows.', kind: 'fix' },
      { title: 'Reverse ETL for BigQuery', detail: 'Sync audiences back to BigQuery and Snowflake with field-level lineage.', kind: 'feature' },
      { title: 'AI copilot (beta)', detail: 'Describe an audience in plain English and Orbitly builds the segment for you.', kind: 'feature' },
      { title: 'HubSpot partnership', detail: 'Native two-way sync with HubSpot Smart Lists and lifecycle stages.', kind: 'partnership' },
    ],
    valueProps: [
      { title: 'Warehouse-native', detail: 'No black-box profiles. Every attribute traces back to your own tables.' },
      { title: 'Live in days', detail: 'Connect a source, publish an audience, and measure impact the same week.' },
      { title: 'Privacy by default', detail: 'Consent-aware identity resolution with regional data residency.' },
    ],
    features: [
      { name: 'Audience builder', category: 'Segmentation', status: 'ga' },
      { name: 'Real-time reverse ETL', category: 'Activation', status: 'ga' },
      { name: 'Warehouse sync', category: 'Data', status: 'ga' },
      { name: 'AI audience copilot', category: 'AI', status: 'beta' },
      { name: 'Identity resolution', category: 'Data', status: 'ga' },
      { name: 'Journey orchestration', category: 'Activation', status: 'planned' },
      { name: 'Audience marketplace', category: 'Activation', status: 'none' },
    ],
  },
  {
    name: 'Stackline',
    domain: 'stackline.app',
    industry: 'Revenue analytics',
    tier: 'tier1',
    description: 'Product-led revenue analytics with billing, attribution and churn forecasting.',
    color: '#60a5fa',
    tagline: 'Revenue analytics built for product-led growth',
    subhead: 'Connect billing and product usage to see exactly which behaviors turn into expansion revenue.',
    plans: [
      {
        name: 'Starter',
        price: 0,
        blurb: 'Free forever for early-stage products.',
        features: ['1,000 tracked accounts', '3 dashboards', '6-month history', 'Community support'],
      },
      {
        name: 'Growth',
        price: 199,
        blurb: 'For PLG teams scaling self-serve revenue.',
        features: ['25,000 tracked accounts', 'Unlimited dashboards', '24-month history', 'Slack support'],
      },
      {
        name: 'Enterprise',
        price: 799,
        blurb: 'For finance and RevOps teams that need controls.',
        features: ['Unlimited accounts', 'SSO & audit logs', 'Custom data retention', 'Solutions architect'],
      },
    ],
    changelog: [
      { title: 'Expansion revenue dashboard', detail: 'Break down expansion by seat, usage and add-on in a single view.', kind: 'feature' },
      { title: 'Stripe price versioning', detail: 'Revenue charts now respect historical Stripe price migrations.', kind: 'feature' },
      { title: 'Dashboard performance', detail: 'Large account lists load 3x faster with server-side aggregation.', kind: 'fix' },
      { title: 'Churn forecasting', detail: 'Cohort-based churn forecasts with confidence intervals and driver breakdowns.', kind: 'feature' },
      { title: 'Snowflake connector', detail: 'Query modeled revenue tables directly from your Snowflake account.', kind: 'partnership' },
      { title: 'Forecast alerts', detail: 'Get pinged in Slack when net revenue retention deviates from plan.', kind: 'feature' },
    ],
    valueProps: [
      { title: 'Billing-aware', detail: 'Every metric reconciles to invoices, not estimates.' },
      { title: 'Behavioral cohorts', detail: 'Tie product actions to expansion and contraction automatically.' },
      { title: 'Board-ready forecasts', detail: 'Explainable revenue projections your CFO can defend.' },
    ],
    features: [
      { name: 'Revenue dashboards', category: 'Analytics', status: 'ga' },
      { name: 'Stripe integration', category: 'Integrations', status: 'ga' },
      { name: 'Churn forecasting', category: 'AI', status: 'ga' },
      { name: 'Product usage cohorts', category: 'Analytics', status: 'ga' },
      { name: 'Forecast alerts', category: 'Alerts', status: 'beta' },
      { name: 'Data warehouse sync', category: 'Data', status: 'ga' },
      { name: 'Mobile app', category: 'Platform', status: 'planned' },
    ],
  },
  {
    name: 'Northwind Labs',
    domain: 'northwindlabs.io',
    industry: 'Workflow automation',
    tier: 'tier2',
    description: 'No-code workflow automation for operations teams, expanding into AI agents.',
    color: '#c084fc',
    tagline: 'Automate the work between your tools',
    subhead: 'Design reliable multi-step workflows with human approvals, retries and full audit history.',
    plans: [
      {
        name: 'Free',
        price: 0,
        blurb: 'Try the builder with community support.',
        features: ['500 tasks per month', '5 active workflows', '2,000 run history', 'Community support'],
      },
      {
        name: 'Team',
        price: 89,
        blurb: 'For operations teams replacing manual handoffs.',
        features: ['10,000 tasks per month', 'Unlimited workflows', 'Human approval steps', 'Priority support'],
      },
      {
        name: 'Business',
        price: 349,
        blurb: 'For companies with compliance requirements.',
        features: ['100,000 tasks per month', 'SSO & SCIM', 'Environment separation', '99.95% uptime SLA'],
      },
    ],
    changelog: [
      { title: 'Conditional approvals', detail: 'Route approvals by amount, team or custom attributes.', kind: 'feature' },
      { title: 'Run replay', detail: 'Replay failed runs from the exact failing step without duplicating side effects.', kind: 'feature' },
      { title: 'Webhook retries', detail: 'Exponential backoff and dead-letter queues for outbound webhooks.', kind: 'fix' },
      { title: 'AI actions', detail: 'Add an LLM step to classify, summarize or draft inside any workflow.', kind: 'feature' },
      { title: 'Salesforce integration', detail: 'Native Salesforce actions with field-level permissions.', kind: 'partnership' },
      { title: 'Agent monitoring', detail: 'Trace every AI action with prompt, cost and output history.', kind: 'feature' },
    ],
    valueProps: [
      { title: 'Reliable by default', detail: 'Idempotent steps and replayable runs, built for production operations.' },
      { title: 'Humans in the loop', detail: 'Approval steps with SLAs, escalation and full audit trails.' },
      { title: 'No-code, not no-control', detail: 'Versioned workflows with environments and rollbacks.' },
    ],
    features: [
      { name: 'Visual workflow builder', category: 'Automation', status: 'ga' },
      { name: 'Human approvals', category: 'Automation', status: 'ga' },
      { name: 'AI actions', category: 'AI', status: 'beta' },
      { name: 'Run replay', category: 'Reliability', status: 'ga' },
      { name: 'Native integrations', category: 'Integrations', status: 'ga' },
      { name: 'Agent monitoring', category: 'AI', status: 'planned' },
      { name: 'SSO / SCIM', category: 'Security', status: 'ga' },
    ],
  },
  {
    name: 'Cadence',
    domain: 'cadencehq.com',
    industry: 'Product analytics',
    tier: 'tier1',
    description: 'Product analytics and session replay with a strong experimentation suite.',
    color: '#f59e0b',
    tagline: 'See what your product is really telling you',
    subhead: 'Funnels, retention and session replay in one model, with experiments that ship confidently.',
    plans: [
      {
        name: 'Starter',
        price: 0,
        blurb: 'For side projects and early validation.',
        features: ['10,000 events per month', '90-day retention', 'Core reports', 'Community support'],
      },
      {
        name: 'Growth',
        price: 129,
        blurb: 'For product teams running weekly experiments.',
        features: ['1M events per month', '12-month retention', 'Experiments & session replay', 'Email support'],
      },
      {
        name: 'Scale',
        price: 599,
        blurb: 'For orgs standardizing on product data.',
        features: ['Unlimited events', 'Warehouse export', 'SSO & data governance', 'Onboarding specialist'],
      },
    ],
    changelog: [
      { title: 'Experiment guardrails', detail: 'Automatically stop experiments that breach error or latency thresholds.', kind: 'feature' },
      { title: 'Mobile replay', detail: 'Session replay for iOS and Android with PII masking on by default.', kind: 'feature' },
      { title: 'Funnel speedups', detail: 'Funnels over 90 days now run in under two seconds.', kind: 'fix' },
      { title: 'Warehouse-native experiments', detail: 'Analyze experiments directly on your warehouse data with SQL.', kind: 'feature' },
      { title: 'Segment partnership', detail: 'Activate experiment audiences through Segment with one click.', kind: 'partnership' },
      { title: 'Impact analysis', detail: 'Estimate revenue impact for every experiment result.', kind: 'feature' },
    ],
    valueProps: [
      { title: 'One events model', detail: 'No duplicate instrumentation between analytics, replay and experiments.' },
      { title: 'Experiment velocity', detail: 'Ship, monitor and read out tests without analyst bottlenecks.' },
      { title: 'Your warehouse, your rules', detail: 'Export raw events and query them with the SQL you already know.' },
    ],
    features: [
      { name: 'Funnels & retention', category: 'Analytics', status: 'ga' },
      { name: 'Session replay', category: 'Analytics', status: 'ga' },
      { name: 'Experimentation', category: 'Experiments', status: 'ga' },
      { name: 'Warehouse-native experiments', category: 'Experiments', status: 'beta' },
      { name: 'Mobile replay', category: 'Platform', status: 'ga' },
      { name: 'AI insights', category: 'AI', status: 'planned' },
      { name: 'Segment activation', category: 'Integrations', status: 'ga' },
    ],
  },
  {
    name: 'Relay AI',
    domain: 'relay.ai',
    industry: 'AI support agents',
    tier: 'tier2',
    description: 'Autonomous customer support agents with human handoff and QA tooling.',
    color: '#f472b6',
    tagline: 'Support that resolves, not just replies',
    subhead: 'Deploy AI agents that take real actions across your stack, with humans in control of every edge case.',
    plans: [
      {
        name: 'Starter',
        price: 99,
        blurb: 'For lean support teams testing automation.',
        features: ['500 resolved conversations', '1 AI agent', 'Email & chat channels', 'Weekly QA report'],
      },
      {
        name: 'Growth',
        price: 399,
        blurb: 'For scaling teams with complex workflows.',
        features: ['3,000 resolved conversations', '5 AI agents', 'Action integrations', 'Live QA dashboard'],
      },
      {
        name: 'Enterprise',
        price: 1499,
        blurb: 'For regulated, high-volume support orgs.',
        features: ['Unlimited conversations', 'Custom models & guardrails', 'SSO, SOC 2, HIPAA', 'Dedicated success team'],
      },
    ],
    changelog: [
      { title: 'Action library', detail: '30 new actions for refunds, order edits and subscription changes.', kind: 'feature' },
      { title: 'QA scorecards', detail: 'Custom rubrics with automated grading and coaching insights.', kind: 'feature' },
      { title: 'Handoff context', detail: 'Full conversation and tool history passed to humans on escalation.', kind: 'fix' },
      { title: 'Voice agent (beta)', detail: 'Handle inbound phone support with the same guardrails as chat.', kind: 'feature' },
      { title: 'Zendesk migration', detail: 'One-click import of macros, tags and historical tickets.', kind: 'partnership' },
      { title: 'Guardrail policies', detail: 'Define refund limits and escalation rules in natural language.', kind: 'feature' },
    ],
    valueProps: [
      { title: 'Resolves tickets', detail: 'Agents execute actions in your tools, not just suggest answers.' },
      { title: 'Human oversight', detail: 'Live QA, guardrails and seamless handoffs for edge cases.' },
      { title: 'Deploy in a week', detail: 'Connect help center and tools, launch behind a canary in days.' },
    ],
    features: [
      { name: 'AI chat agent', category: 'AI', status: 'ga' },
      { name: 'Action integrations', category: 'Integrations', status: 'ga' },
      { name: 'QA scorecards', category: 'Quality', status: 'ga' },
      { name: 'Voice agent', category: 'Channels', status: 'beta' },
      { name: 'Guardrail policies', category: 'Safety', status: 'beta' },
      { name: 'Human handoff', category: 'Quality', status: 'ga' },
      { name: 'Multilingual support', category: 'AI', status: 'planned' },
    ],
  },
  {
    name: 'Vantage Cloud',
    domain: 'vantagecloud.dev',
    industry: 'Cloud cost management',
    tier: 'tier3',
    description: 'FinOps platform focused on Kubernetes and AI workload cost visibility.',
    color: '#94a3b8',
    tagline: 'Cloud costs you can actually explain',
    subhead: 'Allocate spend across teams, services and AI workloads with recommendations your engineers trust.',
    plans: [
      {
        name: 'Free',
        price: 0,
        blurb: 'Visibility for a single cloud account.',
        features: ['1 cloud account', 'Daily cost sync', 'Cost explorer', 'Community support'],
      },
      {
        name: 'Team',
        price: 249,
        blurb: 'For teams sharing multi-cloud spend.',
        features: ['10 cloud accounts', 'Kubernetes cost allocation', 'Budget alerts', 'Slack support'],
      },
      {
        name: 'Enterprise',
        price: 999,
        blurb: 'For FinOps teams with chargeback requirements.',
        features: ['Unlimited accounts', 'Showback & chargeback', 'SSO & audit logs', 'FinOps advisor'],
      },
    ],
    changelog: [
      { title: 'GPU cost allocation', detail: 'Attribute GPU hours to teams, jobs and experiments across clouds.', kind: 'feature' },
      { title: 'Kubernetes idle costs', detail: 'See idle namespace spend and recommended request right-sizing.', kind: 'feature' },
      { title: 'Anomaly noise reduction', detail: 'Fewer low-signal alerts with adaptive thresholds.', kind: 'fix' },
      { title: 'Budget forecasting', detail: 'Forecast month-end spend with commitment coverage scenarios.', kind: 'feature' },
      { title: 'Datadog partnership', detail: 'Correlate cost anomalies with service performance events.', kind: 'partnership' },
      { title: 'Cost policies', detail: 'Automatically tag and block untagged resources at deploy time.', kind: 'feature' },
    ],
    valueProps: [
      { title: 'Engineering-grade data', detail: 'Every dollar tied to a workload, namespace or commit.' },
      { title: 'AI workload visibility', detail: 'Track GPU, inference and training spend separately.' },
      { title: 'Actionable savings', detail: 'Recommendations with owner, effort and projected savings.' },
    ],
    features: [
      { name: 'Multi-cloud cost explorer', category: 'Visibility', status: 'ga' },
      { name: 'Kubernetes allocation', category: 'Visibility', status: 'ga' },
      { name: 'GPU cost tracking', category: 'AI', status: 'beta' },
      { name: 'Budget alerts', category: 'Governance', status: 'ga' },
      { name: 'Chargeback reports', category: 'Governance', status: 'ga' },
      { name: 'AI savings advisor', category: 'AI', status: 'planned' },
      { name: 'Cost policies', category: 'Governance', status: 'none' },
    ],
  },
];

export function profileFor(name: string): DemoProfile {
  const found = DEMO_PROFILES.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (found) return found;
  return {
    ...DEMO_PROFILES[0],
    name,
    domain: `${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.com`,
    tagline: `${name}, reimagined for modern teams`,
  };
}

function pricingFor(profile: DemoProfile, variant: number): string {
  const plans = profile.plans.map((p) => ({ ...p, features: [...p.features] }));
  const v = Math.max(0, variant);
  const growth = () => plans[Math.min(1, plans.length - 1)];
  const top = () => plans[plans.length - 1];

  // Each revision is cumulative so a version diff reflects one coherent move.
  for (let step = 1; step <= v; step++) {
    if (step === 1) {
      growth().price = Math.round(growth().price * 1.2);
      top().features.push('AI insights included');
    } else if (step === 2) {
      plans[0].features[0] = plans[0].features[0].replace(/^[\d,]+/, (n) => {
        const value = Number(n.replace(/,/g, ''));
        return Math.round(value * 2.5).toLocaleString('en-US');
      });
      const enterpriseName = plans.some((p) => p.name === 'Enterprise') ? 'Enterprise Plus' : 'Enterprise';
      if (!plans.some((p) => p.name === enterpriseName)) {
        plans.push({
          name: enterpriseName,
          price: Math.max(899, Math.round(top().price * 1.8)),
          blurb: 'Custom contracts, security review and dedicated support.',
          features: ['Unlimited usage', 'Custom SLA & DPA', 'SSO & SCIM', 'Named solutions architect'],
        });
      }
    } else if (step === 3) {
      top().price = Math.round(top().price * 1.12);
      top().features.push('Advanced analytics add-on');
    } else if (step === 4) {
      growth().features.push('Usage-based add-ons');
      const first = plans[0];
      first.features[first.features.length - 1] = 'Priority email support';
    } else if (step === 5) {
      growth().price = Math.round(growth().price * 1.08);
      top().features.push('Annual billing: 2 months free');
    } else if (step % 2 === 0) {
      growth().features.push(`Workflow automation pack ${step - 5}`);
    } else {
      top().price = Math.round(top().price * 1.03);
    }
  }

  const planBlocks = plans
    .map(
      (plan) => `## ${plan.name}
$${plan.price} per month

${plan.blurb}
${plan.features.map((f) => `- ${f}`).join('\n')}`,
    )
    .join('\n\n');

  return `# ${profile.name} Pricing

${profile.tagline}. Start free, upgrade when you scale. No setup fees and no long-term contract.

${planBlocks}

## All plans include
- SOC 2 Type II controls
- GDPR-ready data handling
- 99.9% uptime SLA
- Unlimited seats on every plan

**Last updated:** ${daysAgoLabel(variant)}`;
}

function changelogFor(profile: DemoProfile, variant: number): string {
  const count = Math.min(profile.changelog.length, 3 + variant);
  const entries = profile.changelog.slice(0, count);
  const blocks = entries
    .map((entry, idx) => {
      // Fixed per entry so growing the changelog does not rewrite historical dates.
      const date = daysAgoLabel(idx * 9 + 2);
      return `## ${entry.title} — ${date}
${entry.detail}`;
    })
    .join('\n\n');
  return `# ${profile.name} Changelog

Product updates, fixes and partnerships.

**Last updated:** ${daysAgoLabel(variant)}

${blocks}
`;
}

function landingFor(profile: DemoProfile, variant: number): string {
  const v = variant % 6;
  const headlines = [
    profile.tagline,
    `Make ${profile.industry} your unfair advantage`,
    `${profile.tagline} — now with AI`,
    'Built for teams who outgrow spreadsheets',
    profile.tagline,
    `The ${profile.industry} platform for serious teams`,
  ];
  const subheads = [
    profile.subhead,
    `Join 2,400+ teams using ${profile.name} to move faster without adding headcount.`,
    `${profile.subhead} Now with autonomous workflows and a new enterprise control plane.`,
    'Replace three tools with one system of record. Migration takes an afternoon.',
    profile.subhead,
    'Measurable outcomes in the first 30 days, with a migration path designed for enterprise teams.',
  ];
  // Keep syntax stable across variants for sentence-case industries.

  const props = profile.valueProps.slice(0, v >= 3 ? 3 : 2);
  if (v === 2) props.push({ title: 'AI-native workflows', detail: 'Automate the busywork with agents that operate inside your existing tools.' });
  if (v === 4) props.push({ title: 'Enterprise ready', detail: 'SOC 2 Type II, SSO, audit logs and regional data residency.' });
  return `# ${profile.name}

## ${headlines[v]}

${subheads[v]}

[Start free trial](https://${profile.domain}/signup) [Book a demo](https://${profile.domain}/demo)

## Why teams choose ${profile.name}

${props.map((p) => `### ${p.title}\n${p.detail}`).join('\n\n')}

## Trusted by fast-moving teams
- Lumen
- Northstar
- Fielder
- Arclight
- Tandem

> "${profile.name} cut our manual reporting time by 70% in the first month." — VP Operations, Lumen

## Ready to see it live?
Get a personalized walkthrough in 20 minutes. Migration and onboarding are included on annual plans.`;
}

export function renderDemoContent(profile: DemoProfile, type: TargetType, variant: number): string {
  if (type === 'pricing') return pricingFor(profile, variant);
  if (type === 'changelog') return changelogFor(profile, variant);
  if (type === 'landing') return landingFor(profile, variant);
  if (type === 'blog') {
    return `# ${profile.name} Blog\n\n## How ${profile.industry.toLowerCase()} teams measure impact\nMost teams track activity, not outcomes. Here is the framework we use with customers.\n\n## A field guide to migration\nMoving systems is risky. This checklist keeps the cutover boring.\n`;
  }
  return `# ${profile.name} Documentation\n\n## Getting started\nConnect your first source and invite your team.\n\n## API reference\nUse the REST API to automate common tasks.\n`;
}

/**
 * Produces the next simulated revision of a page. Variant is derived from the
 * snapshot count so repeated "Run scan" demos always surface a new change.
 */
export function simulateNextContent(
  profile: DemoProfile,
  type: TargetType,
  variant: number,
): { markdown: string; title: string } {
  const v = Math.max(1, variant);
  const markdown = renderDemoContent(profile, type, v);
  return {
    markdown,
    title:
      type === 'pricing'
        ? `${profile.name} Pricing`
        : type === 'changelog'
          ? `${profile.name} Changelog`
          : type === 'landing'
            ? `${profile.name} — ${profile.industry}`
            : `${profile.name} Blog`,
  };
}
