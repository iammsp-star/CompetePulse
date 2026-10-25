import { useEffect, useMemo, useState } from 'react';
import { Columns3, Filter, Plus, Sparkles } from 'lucide-react';
import type { Feature, FeatureStatus } from '../../shared/types';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { Avatar, Badge, Button, EmptyState, FormField, Modal, Spinner } from '../components/ui';

type MatrixCompetitor = { id: string; name: string; color: string; tier: string; industry: string; features: Feature[] };
type Row = { name: string; category: string; cells: Record<string, Feature | undefined> };

const STATUSES: FeatureStatus[] = ['ga', 'beta', 'planned', 'none'];
const STATUS_LABEL: Record<FeatureStatus, string> = {
  ga: 'GA',
  beta: 'Beta',
  planned: 'Planned',
  none: 'None',
};
const STATUS_TONE: Record<FeatureStatus, 'green' | 'amber' | 'blue' | 'neutral'> = {
  ga: 'green',
  beta: 'amber',
  planned: 'blue',
  none: 'neutral',
};

export function MatrixPage() {
  const [competitors, setCompetitors] = useState<MatrixCompetitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [gapsOnly, setGapsOnly] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ competitorId: '', name: '', category: 'AI', status: 'ga' as FeatureStatus });
  const [ourProduct, setOurProduct] = useState('your product');
  const toast = useToast();

  const load = async () => {
    try {
      const result = await api.matrix();
      setCompetitors(result.competitors);
      setOurProduct(result.ourProduct);
      setForm((current) => ({ ...current, competitorId: current.competitorId || result.competitors[0]?.id || '' }));
    } catch (err) {
      toast.push((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    for (const competitor of competitors) {
      for (const feature of competitor.features) {
        const key = feature.name.toLowerCase();
        const row = map.get(key) ?? { name: feature.name, category: feature.category, cells: {} };
        row.category = feature.category || row.category;
        row.cells[competitor.id] = feature;
        map.set(key, row);
      }
    }
    return [...map.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [competitors]);

  const categories = useMemo(() => ['all', ...new Set(rows.map((row) => row.category))], [rows]);

  const coverage = (row: Row) => {
    const offered = Object.values(row.cells).filter((cell) => cell && cell.status !== 'none').length;
    return { offered, total: competitors.length, ratio: competitors.length ? offered / competitors.length : 0 };
  };

  const visibleRows = rows.filter((row) => {
    if (category !== 'all' && row.category !== category) return false;
    if (gapsOnly && coverage(row).offered > 2) return false;
    return true;
  });

  const updateCell = async (competitorId: string, row: Row, status: FeatureStatus) => {
    const existing = row.cells[competitorId];
    try {
      let updated: Feature;
      if (existing) {
        updated = (await api.updateFeature(existing.id, { status })).feature;
      } else {
        updated = (
          await api.createFeature({ competitorId, name: row.name, category: row.category, status })
        ).feature;
      }
      setCompetitors((current) =>
        current.map((competitor) => {
          if (competitor.id !== competitorId) return competitor;
          const others = competitor.features.filter((feature) => feature.name.toLowerCase() !== row.name.toLowerCase());
          return { ...competitor, features: [...others, updated] };
        }),
      );
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const tableStakes = rows.filter((row) => coverage(row).offered >= Math.max(5, Math.ceil(competitors.length * 0.8)));
  const whiteSpace = rows.filter((row) => coverage(row).offered <= 1);
  const averageCoverage = rows.length
    ? rows.reduce((sum, row) => sum + coverage(row).ratio, 0) / rows.length
    : 0;

  const submitFeature = async () => {
    setAdding(true);
    setError('');
    try {
      await api.createFeature(form);
      toast.push(`${form.name} added for ${competitors.find((c) => c.id === form.competitorId)?.name}`);
      setAddOpen(false);
      setForm({ ...form, name: '' });
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  };

  if (loading) return <Spinner label="Loading capability matrix…" />;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">
            <Columns3 size={13} /> Gap analysis
          </div>
          <h1>Feature comparison matrix</h1>
          <p className="page-sub">
            A shared capability catalog for {competitors.length} competitors, benchmarked against {ourProduct}.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon={<Filter size={15} />} onClick={() => setGapsOnly((value) => !value)} className={gapsOnly ? 'btn-active' : ''}>
            {gapsOnly ? 'Showing gaps' : 'Gaps only'}
          </Button>
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setAddOpen(true)}>
            Add capability
          </Button>
        </div>
      </header>

      <div className="stats-strip">
        <div>
          <span>Capabilities tracked</span>
          <strong>{rows.length}</strong>
        </div>
        <div>
          <span>Average coverage</span>
          <strong>{Math.round(averageCoverage * 100)}%</strong>
        </div>
        <div>
          <span>Table stakes</span>
          <strong>{tableStakes.length}</strong>
        </div>
        <div>
          <span>White space</span>
          <strong>{whiteSpace.length}</strong>
        </div>
      </div>

      <div className="matrix-toolbar">
        <div className="chip-row">
          {categories.map((value) => (
            <button
              key={value}
              type="button"
              className={`filter-chip ${category === value ? 'filter-chip-active' : ''}`}
              onClick={() => setCategory(value)}
            >
              {value === 'all' ? 'All capabilities' : value}
            </button>
          ))}
        </div>
        <div className="matrix-legend">
          {STATUSES.map((status) => (
            <span key={status} className={`matrix-legend-item legend-${status}`}>
              <i /> {STATUS_LABEL[status]}
            </span>
          ))}
        </div>
      </div>

      {visibleRows.length === 0 ? (
        <EmptyState
          icon={<Columns3 size={22} />}
          title="No capabilities in this view"
          description="Adjust the category filter or add a capability to start the comparison."
          action={<Button onClick={() => setGapsOnly(false)}>Show all capabilities</Button>}
        />
      ) : (
        <div className="matrix-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th className="matrix-cap-head">Capability</th>
                {competitors.map((competitor) => (
                  <th key={competitor.id}>
                    <div className="matrix-comp">
                      <Avatar name={competitor.name} color={competitor.color} size={26} />
                      <span>{competitor.name}</span>
                    </div>
                  </th>
                ))}
                <th className="matrix-coverage-head">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const cov = coverage(row);
                const level = cov.offered >= Math.max(5, Math.ceil(competitors.length * 0.8)) ? 'stakes' : cov.offered <= 1 ? 'gap' : 'contested';
                return (
                  <tr key={row.name}>
                    <th className="matrix-cap">
                      <span className="matrix-cap-name">{row.name}</span>
                      <span className="matrix-cap-category">{row.category}</span>
                      <span className={`matrix-level matrix-level-${level}`}>
                        {level === 'stakes' ? 'Table stakes' : level === 'gap' ? 'White space' : 'Contested'}
                      </span>
                    </th>
                    {competitors.map((competitor) => {
                      const cell = row.cells[competitor.id];
                      return (
                        <td key={competitor.id} className="matrix-cell">
                          <select
                            aria-label={`${competitor.name} ${row.name} status`}
                            className={`matrix-select status-${cell?.status ?? 'none'} ${cell ? '' : 'status-untracked'}`}
                            value={cell?.status ?? 'none'}
                            onChange={(event) => updateCell(competitor.id, row, event.target.value as FeatureStatus)}
                          >
                            {STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {STATUS_LABEL[status]}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                    <td className="matrix-coverage">
                      <div className="coverage-cell">
                        <strong>{cov.offered}/{cov.total}</strong>
                        <div className="coverage-track">
                          <div className="coverage-fill" style={{ width: `${Math.max(3, cov.ratio * 100)}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="matrix-insights">
        <div className="matrix-insight-card">
          <span className="insight-tag">
            <Sparkles size={13} /> Readout
          </span>
          <h3>Where the market is crowded</h3>
          <div className="readout-list">
            {tableStakes.slice(0, 4).map((row) => (
              <div key={row.name}>
                <Badge tone="red">{coverage(row).offered}/{competitors.length}</Badge>
                <span>{row.name}</span>
              </div>
            ))}
            {tableStakes.length === 0 && <p className="muted">No capability is universal yet.</p>}
          </div>
        </div>
        <div className="matrix-insight-card">
          <span className="insight-tag">
            <Sparkles size={13} /> Opportunity
          </span>
          <h3>Where the market is thin</h3>
          <div className="readout-list">
            {whiteSpace.slice(0, 4).map((row) => (
              <div key={row.name}>
                <Badge tone="green">{coverage(row).offered}/{competitors.length}</Badge>
                <span>{row.name}</span>
              </div>
            ))}
            {whiteSpace.length === 0 && <p className="muted">Every tracked capability has at least two providers.</p>}
          </div>
        </div>
        <div className="matrix-insight-card matrix-insight-action">
          <span className="insight-tag">
            <Sparkles size={13} /> Next step
          </span>
          <h3>Turn gaps into positioning</h3>
          <p>
            Pick one white-space capability where {ourProduct} already has an edge and test it as the lead proof point on your
            comparison page.
          </p>
          <Button variant="secondary" size="sm" onClick={() => setGapsOnly(true)}>
            Focus on gaps
          </Button>
        </div>
      </div>

      {addOpen && (
        <Modal
          title="Add a capability"
          subtitle="Create a cell in the shared catalog for a competitor."
          onClose={() => !adding && setAddOpen(false)}
          footer={
            <>
              {error && <span className="form-error">{error}</span>}
              <div className="spacer" />
              <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={adding}>
                Cancel
              </Button>
              <Button variant="primary" loading={adding} onClick={submitFeature}>
                Add capability
              </Button>
            </>
          }
        >
          <div className="form-grid">
            <FormField label="Competitor">
              <select className="select" value={form.competitorId} onChange={(e) => setForm({ ...form, competitorId: e.target.value })}>
                {competitors.map((competitor) => (
                  <option key={competitor.id} value={competitor.id}>
                    {competitor.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Status">
              <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FeatureStatus })}>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Capability name">
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Usage-based billing" />
            </FormField>
            <FormField label="Category">
              <input className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Platform" />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  );
}
