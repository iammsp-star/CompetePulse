import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  ExternalLink,
  FileText,
  Globe2,
  History,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  ScanLine,
  Trash2,
} from 'lucide-react';
import type { Competitor, CompetitorDetail, Diff, Feature, Insight, Snapshot, Target, TargetType, Tier } from '../../shared/types';
import { api } from '../lib/api';
import { dateTime, humanType, longDate, relativeTime, tierLabel, titleCase } from '../lib/format';
import { useToast } from '../components/Toast';
import { DiffView } from '../components/DiffView';
import { InsightDetail } from '../components/InsightDetail';
import { Markdown } from '../components/Markdown';
import {
  Avatar,
  Badge,
  Button,
  CategoryBadge,
  EmptyState,
  FormField,
  ImpactBadge,
  Metric,
  Modal,
  Spinner,
  StatusDot,
  Tabs,
  TierBadge,
} from '../components/ui';

const TARGET_TYPES: TargetType[] = ['pricing', 'changelog', 'blog', 'landing', 'docs'];
const FREQUENCIES = ['daily', 'weekly', 'on_demand'];

const STATUS_TONE: Record<string, 'green' | 'amber' | 'neutral' | 'red'> = {
  ga: 'green',
  beta: 'amber',
  planned: 'neutral',
  none: 'red',
};

export function CompetitorDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<CompetitorDetail & { competitor: Competitor }>();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'signals' | 'targets' | 'snapshots' | 'features'>('signals');
  const [scanning, setScanning] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [targetModal, setTargetModal] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotTab, setSnapshotTab] = useState<'diff' | 'page'>('diff');
  const [snapshotData, setSnapshotData] = useState<{ snapshot: Snapshot; diff: Diff | null; previous: Snapshot | null } | null>(null);
  const [edit, setEdit] = useState({ name: '', domain: '', industry: '', tier: 'tier2' as Tier, description: '' });
  const [newTarget, setNewTarget] = useState({ type: 'pricing' as TargetType, url: '', frequency: 'weekly' });

  const load = async () => {
    try {
      const result = await api.competitor(id);
      setData(result);
      setEdit({
        name: result.competitor.name,
        domain: result.competitor.domain,
        industry: result.competitor.industry,
        tier: result.competitor.tier,
        description: result.competitor.description,
      });
    } catch (err) {
      toast.push((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [id]);

  const targetMap = useMemo(() => new Map((data?.targets ?? []).map((t) => [t.id, t])), [data?.targets]);

  const scan = async () => {
    setScanning(true);
    try {
      const result = await api.scan({ competitorId: id });
      const insights = result.insights ?? 0;
      toast.push(
        insights ? `${insights} new insight${insights === 1 ? '' : 's'} generated` : 'Scan complete — no material changes',
      );
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    } finally {
      setScanning(false);
    }
  };

  const saveEdit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.updateCompetitor(id, edit);
      toast.push('Competitor updated');
      setEditOpen(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await api.deleteCompetitor(id);
      toast.push('Competitor removed');
      navigate('/competitors');
    } catch (err) {
      toast.push((err as Error).message, 'error');
      setSaving(false);
    }
  };

  const openSnapshot = async (snapshot: Snapshot) => {
    setSnapshotOpen(true);
    setSnapshotTab(snapshot.hasDiff ? 'diff' : 'page');
    setSnapshotLoading(true);
    try {
      const result = await api.snapshot(snapshot.id);
      setSnapshotData(result);
    } catch (err) {
      toast.push((err as Error).message, 'error');
    } finally {
      setSnapshotLoading(false);
    }
  };

  const addTarget = async () => {
    setSaving(true);
    setError('');
    try {
      await api.createTarget({ competitorId: id, type: newTarget.type, url: newTarget.url, frequency: newTarget.frequency });
      toast.push('Target page added');
      setTargetModal(false);
      setNewTarget({ type: 'pricing', url: '', frequency: 'weekly' });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const changeFrequency = async (target: Target, frequency: string) => {
    try {
      await api.updateTarget(target.id, { frequency: frequency as Target['frequency'] });
      toast.push(`${humanType(target.type)} scans set to ${frequency.replace('_', ' ')}`);
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const removeTarget = async (target: Target) => {
    if (!window.confirm(`Stop monitoring ${target.type} at ${target.url}? Snapshot history for this page will be removed.`)) return;
    try {
      await api.deleteTarget(target.id);
      toast.push('Target removed');
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  if (loading) return <Spinner label="Loading competitor workspace…" />;
  if (!data) {
    return (
      <EmptyState
        title="Competitor not found"
        description="This competitor may have been deleted."
        action={<Button onClick={() => navigate('/competitors')}>Back to competitors</Button>}
      />
    );
  }

  const competitor = data.competitor;
  const highImpact = data.insights.filter((insight) => insight.impact === 'high').length;
  const unread = data.insights.filter((insight) => !insight.notified && insight.impact === 'high').length;
  const featuresByCategory = data.features.reduce<Record<string, Feature[]>>((acc, feature) => {
    acc[feature.category] = [...(acc[feature.category] ?? []), feature];
    return acc;
  }, {});

  return (
    <div className="page">
      <Link to="/competitors" className="back-link">
        <ArrowLeft size={14} /> All competitors
      </Link>

      <header className="detail-hero">
        <Avatar name={competitor.name} color={competitor.color} size={58} />
        <div className="detail-hero-main">
          <div className="detail-hero-title">
            <h1>{competitor.name}</h1>
            <TierBadge tier={competitor.tier} />
            <Badge tone={unread ? 'red' : 'green'}>{unread ? `${unread} open alert${unread === 1 ? '' : 's'}` : 'Alerts clear'}</Badge>
          </div>
          <div className="detail-hero-meta">
            <a href={`https://${competitor.domain}`} target="_blank" rel="noreferrer">
              <Globe2 size={13} /> {competitor.domain}
            </a>
            <span>·</span>
            <span>{competitor.industry}</span>
            <span>·</span>
            <span>Tracking since {short(competitor.createdAt)}</span>
          </div>
          <p className="detail-hero-desc">{competitor.description}</p>
        </div>
        <div className="detail-hero-actions">
          <Button variant="secondary" icon={<Pencil size={14} />} onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button variant="primary" icon={<RefreshCw size={14} />} loading={scanning} onClick={scan}>
            Scan now
          </Button>
        </div>
      </header>

      <div className="metric-grid metric-grid-4">
        <Metric label="Tracked pages" value={data.targets.length} hint={`${data.targets.filter((t) => t.enabled).length} enabled`} icon={<Layers size={15} />} />
        <Metric label="Snapshots archived" value={data.snapshots.length} hint={`${data.snapshots.filter((s) => s.changed).length} with material changes`} icon={<History size={15} />} />
        <Metric label="Signals · all time" value={data.insights.length} hint={`${highImpact} high impact`} icon={<ScanLine size={15} />} tone="accent" />
        <Metric label="Last capture" value={relativeTime(data.snapshots[0]?.capturedAt)} hint={data.snapshots[0]?.mode === 'live' ? 'Live capture' : 'Simulated / seeded capture'} icon={<CalendarClock size={15} />} />
      </div>

      <Tabs
        tabs={[
          { id: 'signals', label: 'Signals', count: data.insights.length },
          { id: 'targets', label: 'Target pages', count: data.targets.length },
          { id: 'snapshots', label: 'Snapshots', count: data.snapshots.length },
          { id: 'features', label: 'Features', count: data.features.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'signals' && (
        <div className="detail-tab-panel">
          {data.insights.length === 0 ? (
            <EmptyState icon={<ScanLine size={20} />} title="No signals yet" description="Run a scan to create the first comparison baseline." />
          ) : (
            <div className="signal-list">
              {data.insights.map((insight) => (
                <button type="button" key={insight.id} className="signal-row" onClick={() => setSelectedInsight(insight)}>
                  <div className="signal-date">
                    <strong>{short(insight.createdAt)}</strong>
                    <span>{relativeTime(insight.createdAt)}</span>
                  </div>
                  <div className="signal-body">
                    <div className="signal-title">{insight.title}</div>
                    <div className="signal-meta">
                      <CategoryBadge category={insight.category} />
                      <span>{humanType(targetMap.get(insight.targetId ?? '')?.type ?? 'landing')}</span>
                      <span>·</span>
                      <span>{insight.source === 'llm' ? 'LLM analysis' : 'Rubric analysis'}</span>
                    </div>
                  </div>
                  <div className="signal-right">
                    <ImpactBadge impact={insight.impact} />
                    {insight.notified ? <span className="notified-pill">Alerted</span> : <span className="muted small">Not alerted</span>}
                    <ChevronRight size={15} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'targets' && (
        <div className="detail-tab-panel">
          <div className="panel-toolbar">
            <p>Change cadence without leaving the workspace. On-demand targets only run when you ask.</p>
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setTargetModal(true)}>
              Add page
            </Button>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>URL</th>
                  <th>Frequency</th>
                  <th>Last scan</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.targets.map((target) => (
                  <tr key={target.id}>
                    <td>
                      <span className={`target-type target-${target.type}`}>{humanType(target.type)}</span>
                    </td>
                    <td>
                      <a href={target.url} target="_blank" rel="noreferrer" className="url-cell">
                        {target.url.replace(/^https?:\/\//, '')} <ExternalLink size={11} />
                      </a>
                    </td>
                    <td>
                      <select
                        className="select select-inline"
                        value={target.frequency}
                        onChange={(event) => changeFrequency(target, event.target.value)}
                      >
                        {FREQUENCIES.map((frequency) => (
                          <option key={frequency} value={frequency}>
                            {frequency === 'on_demand' ? 'On demand' : titleCase(frequency)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="cell-muted">{relativeTime(target.lastScrapedAt)}</td>
                    <td>
                      <span className="run-status">
                        <StatusDot tone={target.lastStatus === 'failed' ? 'err' : target.lastStatus === 'pending' ? 'warn' : 'ok'} />
                        {target.lastStatus}
                      </span>
                    </td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className="icon-btn"
                        title="Scan this page"
                        onClick={async () => {
                          try {
                            const result = await api.scan({ targetId: target.id });
                            toast.push(result.results?.[0]?.changed ? 'Change detected and analyzed' : 'No material change');
                            await load();
                          } catch (err) {
                            toast.push((err as Error).message, 'error');
                          }
                        }}
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button type="button" className="icon-btn icon-danger" title="Remove target" onClick={() => removeTarget(target)}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'snapshots' && (
        <div className="detail-tab-panel">
          <div className="snapshot-list">
            {data.snapshots.map((snapshot) => (
              <button type="button" className="snapshot-row" key={snapshot.id} onClick={() => openSnapshot(snapshot)}>
                <div className="snapshot-date">
                  <strong>{short(snapshot.capturedAt)}</strong>
                  <span>{new Date(snapshot.capturedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="snapshot-main">
                  <div className="snapshot-title">
                    {snapshot.title}
                    {snapshot.changed ? <Badge tone="amber">changed</Badge> : <Badge tone="neutral">baseline</Badge>}
                    <Badge tone={snapshot.mode === 'live' ? 'green' : 'purple'}>{snapshot.mode}</Badge>
                  </div>
                  <div className="snapshot-meta">
                    {humanType(targetMap.get(snapshot.targetId)?.type ?? 'landing')} · {snapshot.wordCount} words ·{' '}
                    {snapshot.screenshotUrl ? 'screenshot' : 'markdown'} archive
                  </div>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'features' && (
        <div className="detail-tab-panel">
          <div className="panel-toolbar">
            <p>Capabilities as tracked in the shared comparison catalog. Edit statuses on the matrix page.</p>
            <Link to="/matrix" className="btn btn-secondary btn-sm">
              Open matrix <ExternalLink size={13} />
            </Link>
          </div>
          <div className="feature-panels">
            {Object.entries(featuresByCategory).map(([category, features]) => (
              <div className="feature-panel" key={category}>
                <h4>{category}</h4>
                <div className="feature-rows">
                  {features.map((feature) => (
                    <div className="feature-row" key={feature.id}>
                      <span>{feature.name}</span>
                      <Badge tone={STATUS_TONE[feature.status]}>{feature.status === 'none' ? 'not offered' : feature.status}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="danger-zone">
        <div>
          <strong>Remove competitor</strong>
          <p>Deletes targets, snapshots, diffs, vectors and insights for {competitor.name}.</p>
        </div>
        <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeleteOpen(true)}>
          Remove
        </Button>
      </div>

      {snapshotOpen && (
        <Modal
          wide
          title={snapshotData?.snapshot.title ?? 'Snapshot'}
          subtitle={
            snapshotData
              ? `${longDate(snapshotData.snapshot.capturedAt)} · ${humanType(targetMap.get(snapshotData.snapshot.targetId)?.type ?? 'landing')} · ${snapshotData.snapshot.mode} capture`
              : 'Loading archived capture…'
          }
          onClose={() => setSnapshotOpen(false)}
          footer={
            <>
              <span className="modal-meta">{snapshotData?.snapshot.wordCount ?? 0} words archived</span>
              <div className="spacer" />
              <Button variant="primary" onClick={() => setSnapshotOpen(false)}>
                Close
              </Button>
            </>
          }
        >
          {snapshotLoading ? (
            <Spinner label="Loading capture…" />
          ) : snapshotData ? (
            <>
              {snapshotData.diff && (
                <Tabs
                  tabs={[
                    { id: 'diff', label: 'What changed' },
                    { id: 'page', label: 'Captured page' },
                  ]}
                  active={snapshotTab}
                  onChange={setSnapshotTab}
                />
              )}
              {snapshotData.diff && snapshotTab === 'diff' ? (
                <DiffView diff={snapshotData.diff} />
              ) : (
                <div className="page-preview">
                  <div className="page-preview-head">
                    <FileText size={15} /> {snapshotData.snapshot.title}
                    <span className="muted">· captured {dateTime(snapshotData.snapshot.capturedAt)}</span>
                  </div>
                  {snapshotData.snapshot.screenshotUrl && (
                    <img src={snapshotData.snapshot.screenshotUrl} alt={`Screenshot of ${snapshotData.snapshot.title}`} className="page-screenshot" />
                  )}
                  <Markdown content={snapshotData.snapshot.contentMd} />
                </div>
              )}
            </>
          ) : null}
        </Modal>
      )}

      {selectedInsight && (
        <InsightDetail insight={selectedInsight} onClose={() => setSelectedInsight(null)} onChanged={load} />
      )}

      {editOpen && (
        <Modal
          title="Edit competitor"
          subtitle="Update positioning context and ownership tier."
          onClose={() => !saving && setEditOpen(false)}
          footer={
            <>
              {error && <span className="form-error">{error}</span>}
              <div className="spacer" />
              <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" loading={saving} onClick={saveEdit}>
                Save changes
              </Button>
            </>
          }
        >
          <div className="form-grid">
            <FormField label="Company name">
              <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </FormField>
            <FormField label="Domain">
              <input className="input" value={edit.domain} onChange={(e) => setEdit({ ...edit, domain: e.target.value })} />
            </FormField>
            <FormField label="Industry">
              <input className="input" value={edit.industry} onChange={(e) => setEdit({ ...edit, industry: e.target.value })} />
            </FormField>
            <FormField label="Tier">
              <select className="select" value={edit.tier} onChange={(e) => setEdit({ ...edit, tier: e.target.value as Tier })}>
                {(['tier1', 'tier2', 'tier3'] as Tier[]).map((tier) => (
                  <option key={tier} value={tier}>
                    {tierLabel(tier)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Description" className="field-span">
              <textarea className="input textarea" rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </FormField>
          </div>
        </Modal>
      )}

      {targetModal && (
        <Modal
          title="Add a target page"
          subtitle="Track another pricing, blog or documentation surface."
          onClose={() => !saving && setTargetModal(false)}
          footer={
            <>
              {error && <span className="form-error">{error}</span>}
              <div className="spacer" />
              <Button variant="ghost" onClick={() => setTargetModal(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" loading={saving} onClick={addTarget}>
                Add page
              </Button>
            </>
          }
        >
          <div className="form-grid">
            <FormField label="Page type">
              <select className="select" value={newTarget.type} onChange={(e) => setNewTarget({ ...newTarget, type: e.target.value as TargetType })}>
                {TARGET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {humanType(type)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Frequency">
              <select className="select" value={newTarget.frequency} onChange={(e) => setNewTarget({ ...newTarget, frequency: e.target.value })}>
                {FREQUENCIES.map((frequency) => (
                  <option key={frequency} value={frequency}>
                    {frequency === 'on_demand' ? 'On demand' : titleCase(frequency)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="URL" className="field-span">
              <input className="input" value={newTarget.url} onChange={(e) => setNewTarget({ ...newTarget, url: e.target.value })} placeholder={`https://${competitor.domain}/customers`} />
            </FormField>
          </div>
        </Modal>
      )}

      {deleteOpen && (
        <Modal
          title={`Remove ${competitor.name}?`}
          subtitle="This permanently deletes snapshots, diffs, embeddings, features and insights for this competitor."
          onClose={() => !saving && setDeleteOpen(false)}
          footer={
            <>
              <div className="spacer" />
              <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="danger" loading={saving} onClick={remove}>
                Remove competitor
              </Button>
            </>
          }
        >
          <p className="modal-copy">
            Historical intelligence for {competitor.name} will no longer appear in the feed, digests or search. Other competitors
            are unaffected.
          </p>
        </Modal>
      )}
    </div>
  );
}

function short(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
