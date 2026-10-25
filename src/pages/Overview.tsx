import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  BrainCircuit,
  ChevronRight,
  CircleGauge,
  Clock3,
  Eye,
  Flame,
  Newspaper,
  Radar,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import type { Competitor, FeedItem, ScrapeRun, Stats } from '../../shared/types';
import { api } from '../lib/api';
import { duration, humanType, percent, relativeTime } from '../lib/format';
import { ActivityChart } from '../components/ActivityChart';
import { InsightDetail } from '../components/InsightDetail';
import { Avatar, Button, Card, CategoryBadge, EmptyState, ImpactBadge, Metric, Spinner, StatusDot } from '../components/ui';
import { useToast } from '../components/Toast';

export function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [signals, setSignals] = useState<FeedItem[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [runs, setRuns] = useState<(ScrapeRun & { competitorName: string; targetType: string })[]>([]);
  const [selected, setSelected] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = async () => {
    try {
      const [statsResult, highResult, fallbackResult, competitorResult, runResult] = await Promise.all([
        api.stats(),
        api.feed({ impact: 'high', days: 30, limit: 4 }),
        api.feed({ days: 30, limit: 4 }),
        api.competitors(),
        api.runs(6),
      ]);
      setStats(statsResult);
      setSignals(highResult.insights.length ? highResult.insights : fallbackResult.insights);
      setCompetitors(competitorResult.competitors);
      setRuns(runResult.runs);
    } catch (error) {
      toast.push((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !stats) return <Spinner label="Loading workspace…" />;

  const maxChanges = Math.max(1, ...competitors.map((c) => c.changes30d ?? 0));

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">
            <Radar size={13} /> Competitive intelligence
          </div>
          <h1>Market overview</h1>
          <p className="page-sub">
            {stats?.competitors ?? 0} competitors · {stats?.monitoredPages ?? 0} monitored pages ·{' '}
            {stats?.changes7d ?? 0} material changes this week
          </p>
        </div>
        <div className="page-actions">
          <Link to="/digest" className="btn btn-secondary btn-md">
            <BrainCircuit size={15} /> Weekly briefing
          </Link>
          <Link to="/feed" className="btn btn-primary btn-md">
            <Newspaper size={15} /> Open feed
          </Link>
        </div>
      </header>

      {stats && stats.highImpact7d > 0 && (
        <div className="signal-banner">
          <div className="signal-banner-icon">
            <Flame size={18} />
          </div>
          <div className="signal-banner-body">
            <strong>{stats.highImpact7d} high-impact moves detected this week</strong>
            <span>
              Latest signal: {signals[0]?.competitorName} — {signals[0]?.title}
            </span>
          </div>
          <Link to="/feed?impact=high" className="signal-banner-link">
            Review signals <ArrowRight size={14} />
          </Link>
        </div>
      )}

      <div className="metric-grid">
        <Metric
          label="Competitors tracked"
          value={stats?.competitors ?? 0}
          hint={`${stats?.monitoredPages ?? 0} pages across pricing, changelogs and homepages`}
          icon={<Target size={16} />}
        />
        <Metric
          label="Material changes · 7d"
          value={stats?.changes7d ?? 0}
          hint={`${stats?.insights7d ?? 0} synthesized insights generated`}
          icon={<TrendingUp size={16} />}
          tone="accent"
        />
        <Metric
          label="High-impact signals"
          value={stats?.highImpact7d ?? 0}
          hint={`${stats?.unreadAlerts ?? 0} awaiting alert delivery`}
          icon={<Flame size={16} />}
          tone="danger"
        />
        <Metric
          label="Time to insight"
          value={duration(stats?.medianLatencyMs)}
          hint="Median from capture to synthesized insight"
          icon={<Clock3 size={16} />}
        />
        <Metric
          label="Scrape success"
          value={stats ? percent(stats.scrapeSuccessRate) : '—'}
          hint={`${stats?.snapshots ?? 0} snapshots archived`}
          icon={<ShieldCheck size={16} />}
        />
      </div>

      <div className="overview-grid">
        <Card
          title="Detection activity"
          subtitle="Material diff volume across all monitored pages"
          action={
            <span className="card-chip">
              <CircleGauge size={13} /> 14 days
            </span>
          }
          className="span-2"
        >
          <ActivityChart data={stats?.changesByDay ?? []} />
        </Card>

        <Card title="Impact mix" subtitle="All classified signals">
          <div className="impact-mix">
            {(stats?.impactBreakdown ?? []).map((entry) => {
              const total = stats?.impactBreakdown.reduce((sum, item) => sum + item.count, 0) || 1;
              return (
                <div className="impact-mix-row" key={entry.impact}>
                  <span className={`impact-mix-label impact-text-${entry.impact}`}>{entry.impact}</span>
                  <div className="impact-track">
                    <div
                      className={`impact-fill fill-${entry.impact}`}
                      style={{ width: `${Math.max(3, (entry.count / total) * 100)}%` }}
                    />
                  </div>
                  <strong>{entry.count}</strong>
                </div>
              );
            })}
          </div>
          <div className="category-chips">
            {(stats?.categoryBreakdown ?? [])
              .filter((entry) => entry.count > 0)
              .map((entry) => (
                <span className="category-chip" key={entry.category}>
                  {entry.category} <strong>{entry.count}</strong>
                </span>
              ))}
          </div>
        </Card>
      </div>

      <div className="overview-grid">
        <Card
          title="Priority signals"
          subtitle="The changes that deserve a decision this week"
          action={
            <Link to="/feed" className="text-link">
              All insights <ChevronRight size={14} />
            </Link>
          }
          className="span-2"
        >
          {signals.length === 0 ? (
            <EmptyState
              icon={<Eye size={20} />}
              title="No material changes yet"
              description="Run a scan or wait for the scheduler. Cosmetic-only shifts are filtered out automatically."
            />
          ) : (
            <div className="priority-list">
              {signals.map((signal) => (
                <button type="button" className="priority-row" key={signal.id} onClick={() => setSelected(signal)}>
                  <div className={`priority-impact impact-border-${signal.impact}`} />
                  <Avatar name={signal.competitorName ?? ''} color={signal.competitorColor ?? '#6ee7b7'} size={34} />
                  <div className="priority-body">
                    <div className="priority-meta">
                      <strong>{signal.competitorName}</strong>
                      <span>·</span>
                      <span>{humanType(signal.targetType)}</span>
                      <span>·</span>
                      <span>{relativeTime(signal.createdAt)}</span>
                    </div>
                    <div className="priority-title">{signal.title}</div>
                  </div>
                  <div className="priority-badges">
                    <ImpactBadge impact={signal.impact} />
                    <CategoryBadge category={signal.category} />
                    <ChevronRight size={16} className="priority-chevron" />
                  </div>
                </button>
              ))}
            </div>
          )}
          <div className="priority-foot">
            <span>
              <BellRing size={13} /> Alerts route to Slack and email for signals at or above your threshold.
            </span>
            <Link to="/settings" className="text-link">
              Alert settings
            </Link>
          </div>
        </Card>

        <Card
          title="Competitor pulse"
          subtitle="Change volume, last 30 days"
          action={
            <Link to="/competitors" className="text-link">
              Manage
            </Link>
          }
        >
          <div className="pulse-list">
            {competitors.map((competitor) => (
              <Link to={`/competitors/${competitor.id}`} className="pulse-row" key={competitor.id}>
                <Avatar name={competitor.name} color={competitor.color} size={30} />
                <div className="pulse-main">
                  <div className="pulse-top">
                    <span>{competitor.name}</span>
                    <span className="pulse-count">{competitor.changes30d ?? 0} changes</span>
                  </div>
                  <div className="pulse-track">
                    <div
                      className="pulse-fill"
                      style={{
                        width: `${Math.max(5, ((competitor.changes30d ?? 0) / maxChanges) * 100)}%`,
                        background: competitor.color,
                      }}
                    />
                  </div>
                  <div className="pulse-sub">
                    {competitor.highImpact30d ?? 0} high impact · scanned {relativeTime(competitor.lastScannedAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <Card
        title="Recent scans"
        subtitle="Pipeline activity from this workspace"
        action={
          <Link to="/settings" className="text-link">
            Scan configuration
          </Link>
        }
        padded={false}
      >
        {runs.length === 0 ? (
          <div className="table-empty">
            <RefreshCw size={18} /> No scans yet — use “Scan all” to capture your first snapshots.
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Competitor</th>
                  <th>Page</th>
                  <th>Trigger</th>
                  <th>Status</th>
                  <th>Detected</th>
                  <th>Latency</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id}>
                    <td className="cell-strong">{run.competitorName}</td>
                    <td>{humanType(run.targetType)}</td>
                    <td className="cell-muted">{run.trigger}</td>
                    <td>
                      <span className={`run-status run-${run.status}`}>
                        <StatusDot tone={run.status === 'failed' ? 'err' : run.status === 'unchanged' ? 'muted' : 'ok'} />
                        {run.status}
                      </span>
                    </td>
                    <td className="cell-muted">{relativeTime(run.finishedAt ?? run.startedAt)}</td>
                    <td className="cell-mono">{duration(run.latencyMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <InsightDetail insight={selected} onClose={() => setSelected(null)} onChanged={load} />
      )}
    </div>
  );
}
