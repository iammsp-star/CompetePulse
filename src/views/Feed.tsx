import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Newspaper, Search, Sparkles, X } from 'lucide-react';
import type { Competitor, FeedItem, Impact } from '../../shared/types';
import { api } from '../lib/api';
import { humanType, relativeTime } from '../lib/format';
import { InsightCard } from '../components/InsightCard';
import { InsightDetail } from '../components/InsightDetail';
import { useToast } from '../components/Toast';
import { Avatar, Button, CategoryBadge, EmptyState, ImpactBadge, Spinner } from '../components/ui';

const IMPACTS: (Impact | 'all')[] = ['all', 'high', 'medium', 'low'];
const CATEGORIES = ['all', 'pricing', 'feature', 'messaging', 'partnership', 'other'];
const RANGES = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 0, label: 'All time' },
];

export function FeedPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [impact, setImpact] = useState<string>(searchParams.get('impact') ?? 'all');
  const [category, setCategory] = useState('all');
  const [competitorId, setCompetitorId] = useState('all');
  const [days, setDays] = useState(30);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FeedItem | null>(null);
  const [notifying, setNotifying] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    api
      .competitors()
      .then((result) => setCompetitors(result.competitors))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .feed({ impact, category, competitorId, days: days || undefined, search, limit: 120 })
      .then((result) => setItems(result.insights))
      .catch((error: Error) => toast.push(error.message, 'error'))
      .finally(() => setLoading(false));
  }, [impact, category, competitorId, days, search]);

  useEffect(() => {
    const param = searchParams.get('impact');
    if (param && param !== impact) setImpact(param);
  }, [searchParams]);

  const updateImpact = (value: string) => {
    setImpact(value);
    if (value === 'all') setSearchParams({});
    else setSearchParams({ impact: value });
  };

  const notify = async (insight: FeedItem) => {
    setNotifying(insight.id);
    try {
      const result = await api.notifyInsight(insight.id);
      const delivered = result.notifications.some((n) => n.status === 'sent');
      toast.push(
        delivered ? 'Alert delivered to Slack' : 'No live channel configured — alert event recorded',
        delivered ? 'success' : 'info',
      );
      setItems((current) => current.map((item) => (item.id === insight.id ? { ...item, notified: result.insight.notified } : item)));
    } catch (error) {
      toast.push((error as Error).message, 'error');
    } finally {
      setNotifying(null);
    }
  };

  const activeFilters = useMemo(
    () => [impact !== 'all', category !== 'all', competitorId !== 'all', search.trim() !== ''].filter(Boolean).length,
    [impact, category, competitorId, search],
  );

  const clearFilters = () => {
    updateImpact('all');
    setCategory('all');
    setCompetitorId('all');
    setSearch('');
    setDays(30);
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">
            <Newspaper size={13} /> Signal stream
          </div>
          <h1>Intelligence feed</h1>
          <p className="page-sub">
            Every material competitor change, classified by impact and routed to your team.
            <span className="head-chip">{items.length} signals</span>
          </p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon={<Filter size={15} />} onClick={clearFilters} disabled={activeFilters === 0}>
            Reset filters
          </Button>
        </div>
      </header>

      <div className="feed-toolbar">
        <div className="segmented" role="tablist" aria-label="Filter by impact">
          {IMPACTS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={impact === value}
              className={`segment ${impact === value ? 'segment-active' : ''}`}
              onClick={() => updateImpact(value)}
            >
              {value === 'all' ? 'All signals' : value}
            </button>
          ))}
        </div>
        <div className="filter-controls">
          <label className="search-input">
            <Search size={15} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search insights, competitors…"
              aria-label="Search insights"
            />
            {search && (
              <button type="button" className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <X size={13} />
              </button>
            )}
          </label>
          <select className="select" value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value === 'all' ? 'All categories' : value}
              </option>
            ))}
          </select>
          <select
            className="select"
            value={competitorId}
            onChange={(event) => setCompetitorId(event.target.value)}
            aria-label="Filter by competitor"
          >
            <option value="all">All competitors</option>
            {competitors.map((competitor) => (
              <option key={competitor.id} value={competitor.id}>
                {competitor.name}
              </option>
            ))}
          </select>
          <select className="select" value={days} onChange={(event) => setDays(Number(event.target.value))} aria-label="Filter by date range">
            {RANGES.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading signals…" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Sparkles size={22} />}
          title="No signals match these filters"
          description="Try widening the date range or clearing filters. Cosmetic-only changes are intentionally suppressed."
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="feed-grid">
          {items.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onOpen={() => setSelected(insight)}
              onNotify={() => notify(insight)}
              notifying={notifying === insight.id}
            />
          ))}
        </div>
      )}

      {selected && (
        <InsightDetail
          insight={selected}
          onClose={() => setSelected(null)}
          onChanged={() =>
            setItems((current) =>
              current.map((item) => (item.id === selected.id ? { ...item, notified: 1 } : item)),
            )
          }
        />
      )}

      <div className="feed-note">
        <span className="feed-note-icon">
          <Filter size={14} />
        </span>
        <div>
          <strong>Cosmetic noise is filtered before analysis.</strong>
          <p>
            Snapshots differing only in whitespace, dates or boilerplate never produce an insight, keeping the feed focused on
            pricing, product, messaging and partnership moves.
          </p>
        </div>
        <div className="feed-note-competitors">
          {competitors.slice(0, 4).map((competitor) => (
            <span key={competitor.id} title={competitor.name}>
              <Avatar name={competitor.name} color={competitor.color} size={22} />
            </span>
          ))}
          {competitors.length > 4 && <span className="feed-more">+{competitors.length - 4}</span>}
        </div>
      </div>

      <div className="feed-legend">
        {(['high', 'medium', 'low'] as Impact[]).map((value) => (
          <span key={value}>
            <ImpactBadge impact={value} /> {value === 'high' ? 'Deal or roadmap risk' : value === 'medium' ? 'Worth a look this week' : 'Track only'}
          </span>
        ))}
        <span className="feed-legend-targets">
          {['pricing', 'feature', 'messaging', 'partnership'].map((value) => (
            <CategoryBadge key={value} category={value as FeedItem['category']} />
          ))}
        </span>
      </div>

      <div className="sr-only" aria-live="polite">
        {items.length} insights loaded. {relativeTime(items[0]?.createdAt)} latest signal on {humanType(items[0]?.targetType ?? '')}.
      </div>
    </div>
  );
}
