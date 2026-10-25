import type {
  AskResponse,
  Competitor,
  CompetitorDetail,
  Digest,
  Diff,
  Feature,
  FeedItem,
  Impact,
  Insight,
  Notification,
  ProviderStatus,
  ScrapeRun,
  SearchResult,
  Settings,
  Snapshot,
  Stats,
  Target,
  TargetType,
} from '../../shared/types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text.slice(0, 300) };
  }
  if (!response.ok) {
    const message = (data as { error?: string })?.error ?? `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  stats: () => request<Stats>('/stats'),
  competitors: () => request<{ competitors: Competitor[] }>('/competitors'),
  competitor: (id: string) => request<CompetitorDetail & { competitor: Competitor }>(`/competitors/${id}`),
  createCompetitor: (body: unknown) =>
    request<{ competitor: Competitor }>('/competitors', { method: 'POST', body: JSON.stringify(body) }),
  updateCompetitor: (id: string, body: unknown) =>
    request<{ competitor: Competitor }>(`/competitors/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteCompetitor: (id: string) => request<{ ok: boolean }>(`/competitors/${id}`, { method: 'DELETE' }),
  feed: (params: Record<string, string | number | undefined>) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '' && value !== 'all') query.set(key, String(value));
    }
    return request<{ insights: FeedItem[]; total: number }>(`/feed?${query.toString()}`);
  },
  insight: (id: string) => request<{ insight: Insight }>(`/insights/${id}`),
  notifyInsight: (id: string) =>
    request<{ notifications: Notification[]; insight: Insight }>(`/insights/${id}/notify`, { method: 'POST' }),
  scan: (body: { competitorId?: string; targetId?: string }) =>
    request<{
      results: { competitor?: string; run: ScrapeRun; changed: boolean; insights: number }[];
      insights?: number;
      scanned?: number;
      error?: string;
    }>('/scan', { method: 'POST', body: JSON.stringify(body) }),
  runs: (limit = 30) =>
    request<{ runs: (ScrapeRun & { competitorName: string; targetType: string })[] }>(`/runs?limit=${limit}`),
  snapshot: (id: string) =>
    request<{ snapshot: Snapshot; diff: Diff | null; previous: Snapshot | null }>(`/snapshots/${id}`),
  diff: (id: string) => request<{ diff: Diff; snapshot: Snapshot | null; previous: Snapshot | null }>(`/diffs/${id}`),
  matrix: () =>
    request<{
      competitors: { id: string; name: string; color: string; tier: string; industry: string; features: Feature[] }[];
      ourProduct: string;
      statuses: string[];
    }>('/matrix'),
  createFeature: (body: unknown) => request<{ feature: Feature }>('/features', { method: 'POST', body: JSON.stringify(body) }),
  updateFeature: (id: string, body: unknown) =>
    request<{ feature: Feature }>(`/features/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteFeature: (id: string) => request<{ ok: boolean }>(`/features/${id}`, { method: 'DELETE' }),
  digests: () =>
    request<{
      digests: Digest[];
      currentWeek: { weekStart: string; weekEnd: string };
      previousWeek: { weekStart: string; weekEnd: string };
      currentWeekInsights: number;
    }>('/digests'),
  generateDigest: (range: 'current' | 'previous' | 'all' = 'current', send = false) =>
    request<{ digest: Digest; insights: Insight[]; sent: boolean }>('/digests/generate', {
      method: 'POST',
      body: JSON.stringify({ range, send }),
    }),
  sendDigest: (id: string) =>
    request<{ notifications: Notification[] }>(`/digests/${id}/send`, { method: 'POST' }),
  notifications: () => request<{ notifications: Notification[] }>('/notifications'),
  settings: () => request<{ settings: Settings; defaults: Settings; providers: ProviderStatus }>('/settings'),
  saveSettings: (body: Partial<Settings>) =>
    request<{ settings: Settings; providers: ProviderStatus }>('/settings', { method: 'PUT', body: JSON.stringify(body) }),
  testSlack: (webhook?: string) =>
    request<{ result: { status: string; detail: string } }>('/settings/test-slack', {
      method: 'POST',
      body: JSON.stringify({ webhook: webhook || undefined }),
    }),
  search: (query: string, competitorId?: string) =>
    request<{ results: SearchResult[]; provider: string; model: string }>('/search', {
      method: 'POST',
      body: JSON.stringify({ query, competitorId }),
    }),
  ask: (question: string, competitorId?: string) =>
    request<AskResponse>('/ask', { method: 'POST', body: JSON.stringify({ question, competitorId }) }),
  reindex: () =>
    request<{ ok: boolean; snapshots: number; chunks: number }>('/debug/reindex', { method: 'POST' }),
  createTarget: (body: { competitorId: string; type: TargetType; url: string; frequency: string }) =>
    request<{ target: Target }>('/targets', { method: 'POST', body: JSON.stringify(body) }),
  updateTarget: (id: string, body: Partial<Pick<Target, 'url' | 'frequency' | 'enabled'>>) =>
    request<{ target: Target }>(`/targets/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteTarget: (id: string) => request<{ ok: boolean }>(`/targets/${id}`, { method: 'DELETE' }),
};

export const IMPACT_ORDER: Record<Impact, number> = { high: 0, medium: 1, low: 2 };
