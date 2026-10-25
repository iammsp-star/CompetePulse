export type Tier = 'tier1' | 'tier2' | 'tier3';
export type TargetType = 'pricing' | 'changelog' | 'blog' | 'landing' | 'docs';
export type Frequency = 'daily' | 'weekly' | 'on_demand';
export type Impact = 'high' | 'medium' | 'low';
export type Category = 'pricing' | 'feature' | 'messaging' | 'partnership' | 'other';
export type FeatureStatus = 'ga' | 'beta' | 'planned' | 'none';
export type NotificationStatus = 'sent' | 'simulated' | 'failed' | 'skipped';

export interface Competitor {
  id: string;
  name: string;
  domain: string;
  industry: string;
  tier: Tier;
  description: string;
  color: string;
  createdAt: string;
  targets?: Target[];
  lastScannedAt?: string | null;
  changes30d?: number;
  highImpact30d?: number;
  openAlerts?: number;
}

export interface Target {
  id: string;
  competitorId: string;
  type: TargetType;
  url: string;
  frequency: Frequency;
  enabled: number;
  lastScrapedAt: string | null;
  nextScrapeAt: string | null;
  lastStatus: string;
  lastError: string | null;
}

export interface Snapshot {
  id: string;
  competitorId: string;
  targetId: string;
  capturedAt: string;
  title: string;
  contentMd: string;
  contentHash: string;
  wordCount: number;
  screenshotUrl: string | null;
  mode: 'live' | 'simulated' | 'seed';
  changed: number;
  hasDiff?: boolean;
}

export interface DiffSegment {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
  words?: { text: string; kind: 'added' | 'removed' | 'same' }[];
}

export interface PricingChange {
  plan: string;
  field: string;
  from: string;
  to: string;
}

export interface Diff {
  id: string;
  snapshotId: string;
  previousSnapshotId: string | null;
  competitorId: string;
  targetId: string;
  createdAt: string;
  similarity: number;
  magnitude: number;
  addedLines: number;
  removedLines: number;
  segments: DiffSegment[];
  pricingChanges: PricingChange[];
}

export interface Insight {
  id: string;
  competitorId: string;
  competitorName?: string;
  competitorColor?: string;
  targetId?: string;
  diffId: string | null;
  category: Category;
  impact: Impact;
  title: string;
  summary: string;
  evidence: string[];
  recommendation: string;
  confidence: number;
  source: 'llm' | 'heuristic';
  createdAt: string;
  notified: number;
  latencyMs: number;
}

export interface Feature {
  id: string;
  competitorId: string;
  name: string;
  category: string;
  status: FeatureStatus;
  notes: string;
}

export interface Digest {
  id: string;
  weekStart: string;
  weekEnd: string;
  title: string;
  contentMd: string;
  createdAt: string;
  insightCount: number;
  highImpactCount: number;
}

export interface Notification {
  id: string;
  insightId: string | null;
  competitorId: string | null;
  channel: 'slack' | 'email';
  destination: string;
  status: NotificationStatus;
  detail: string;
  createdAt: string;
  insightTitle?: string;
  competitorName?: string;
}

export interface ScrapeRun {
  id: string;
  competitorId: string;
  targetId: string;
  trigger: 'manual' | 'scheduled' | 'seed';
  status: 'running' | 'success' | 'unchanged' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  snapshotId: string | null;
  latencyMs: number | null;
  mode: string | null;
}

export interface CompetitorDetail extends Competitor {
  targets: Target[];
  snapshots: Snapshot[];
  insights: Insight[];
  runs: ScrapeRun[];
  features: Feature[];
}

export interface FeedItem extends Insight {
  domain: string;
  targetType: TargetType;
  snapshotTitle: string;
  diff?: {
    similarity: number;
    magnitude: number;
    addedLines: number;
    removedLines: number;
    pricingChanges: PricingChange[];
  };
}

export interface Stats {
  competitors: number;
  targets: number;
  snapshots: number;
  changes7d: number;
  highImpact7d: number;
  insights7d: number;
  monitoredPages: number;
  scrapeSuccessRate: number;
  medianLatencyMs: number;
  unreadAlerts: number;
  changesByDay: { day: string; changes: number }[];
  impactBreakdown: { impact: Impact; count: number }[];
  categoryBreakdown: { category: Category; count: number }[];
  lastRun: ScrapeRun | null;
  nextRun: string | null;
}

export interface Settings {
  ourProduct: string;
  slackWebhook: string;
  alertMinImpact: Impact;
  emailRecipients: string;
  emailFrom: string;
  digestEnabled: boolean;
  digestDay: string;
  digestHour: string;
  sensitivity: number;
  demoFallback: boolean;
  schedulerEnabled: boolean;
}

export interface ProviderStatus {
  scraper: { provider: string; live: boolean; detail: string };
  llm: { provider: string; live: boolean; detail: string };
  embeddings: { provider: string; live: boolean; detail: string };
  vectorStore: { provider: string; live: boolean; detail: string };
  slack: { configured: boolean; detail: string };
  email: { configured: boolean; detail: string };
}

export interface SearchResult {
  chunkId: string;
  snapshotId: string;
  competitorId: string;
  competitorName: string;
  competitorColor: string;
  targetType: TargetType;
  capturedAt: string;
  section: string;
  text: string;
  score: number;
}

export interface AskResponse {
  answer: string;
  results: SearchResult[];
  source: 'llm' | 'retrieval';
}
