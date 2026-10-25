import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Globe2, Plus, Radar, RefreshCw, Target } from 'lucide-react';
import type { Competitor, Tier } from '../../shared/types';
import { api } from '../lib/api';
import { relativeTime, tierLabel } from '../lib/format';
import { useToast } from '../components/Toast';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  FormField,
  Modal,
  Spinner,
  StatusDot,
  TierBadge,
} from '../components/ui';

const TIERS: Tier[] = ['tier1', 'tier2', 'tier3'];

interface FormState {
  name: string;
  domain: string;
  industry: string;
  tier: Tier;
  description: string;
  pricing: string;
  changelog: string;
  landing: string;
  frequency: string;
}

const emptyForm: FormState = {
  name: '',
  domain: '',
  industry: '',
  tier: 'tier2',
  description: '',
  pricing: '',
  changelog: '',
  landing: '',
  frequency: 'weekly',
};

export function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState<string | null>(null);
  const toast = useToast();

  const load = () => {
    api
      .competitors()
      .then((result) => setCompetitors(result.competitors))
      .catch((err: Error) => toast.push(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const update = (key: keyof FormState, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.createCompetitor({
        name: form.name.trim(),
        domain: form.domain.trim(),
        industry: form.industry.trim(),
        tier: form.tier,
        description: form.description.trim(),
        frequency: form.frequency,
        urls: {
          ...(form.pricing.trim() ? { pricing: form.pricing.trim() } : {}),
          ...(form.changelog.trim() ? { changelog: form.changelog.trim() } : {}),
          ...(form.landing.trim() ? { landing: form.landing.trim() } : {}),
        },
      });
      toast.push(`${form.name} added to the monitoring set`);
      setModalOpen(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const scan = async (competitor: Competitor) => {
    setScanning(competitor.id);
    try {
      const result = await api.scan({ competitorId: competitor.id });
      const insights = result.insights ?? result.results?.reduce((sum, item) => sum + item.insights, 0) ?? 0;
      toast.push(
        insights
          ? `${competitor.name}: ${insights} new insight${insights === 1 ? '' : 's'}`
          : `${competitor.name}: no material changes detected`,
      );
      load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    } finally {
      setScanning(null);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">
            <Target size={13} /> Monitoring portfolio
          </div>
          <h1>Competitors</h1>
          <p className="page-sub">
            Configure who you track, which pages matter and how often CompetePulse should look.
          </p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setModalOpen(true)}>
            Add competitor
          </Button>
        </div>
      </header>

      <div className="stats-strip">
        <div>
          <span>Tracked</span>
          <strong>{competitors.length}</strong>
        </div>
        <div>
          <span>Tier 1 direct</span>
          <strong>{competitors.filter((c) => c.tier === 'tier1').length}</strong>
        </div>
        <div>
          <span>Monitored pages</span>
          <strong>{competitors.reduce((sum, c) => sum + (c.targets?.length ?? 0), 0)}</strong>
        </div>
        <div>
          <span>Open high-impact alerts</span>
          <strong>{competitors.reduce((sum, c) => sum + (c.openAlerts ?? 0), 0)}</strong>
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading competitors…" />
      ) : competitors.length === 0 ? (
        <EmptyState
          icon={<Target size={22} />}
          title="No competitors yet"
          description="Add your first competitor to start tracking pricing pages, changelogs and positioning."
          action={
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setModalOpen(true)}>
              Add competitor
            </Button>
          }
        />
      ) : (
        <div className="competitor-grid">
          {competitors.map((competitor) => (
            <article className="competitor-card" key={competitor.id} style={{ '--accent': competitor.color } as React.CSSProperties}>
              <div className="competitor-card-top">
                <Avatar name={competitor.name} color={competitor.color} size={44} />
                <div className="competitor-id">
                  <h3>{competitor.name}</h3>
                  <a href={`https://${competitor.domain}`} target="_blank" rel="noreferrer" className="competitor-domain">
                    <Globe2 size={12} /> {competitor.domain}
                  </a>
                </div>
                <TierBadge tier={competitor.tier} />
              </div>
              <p className="competitor-industry">{competitor.industry}</p>
              <p className="competitor-desc">{competitor.description}</p>

              <div className="competitor-metrics">
                <div>
                  <span>Changes · 30d</span>
                  <strong>{competitor.changes30d ?? 0}</strong>
                </div>
                <div>
                  <span>High impact</span>
                  <strong className={competitor.highImpact30d ? 'text-red' : ''}>{competitor.highImpact30d ?? 0}</strong>
                </div>
                <div>
                  <span>Open alerts</span>
                  <strong>{competitor.openAlerts ?? 0}</strong>
                </div>
              </div>

              <div className="target-chips">
                {(competitor.targets ?? []).map((target) => (
                  <span className="target-chip" key={target.id}>
                    <StatusDot tone={target.lastStatus === 'failed' ? 'err' : target.lastStatus === 'pending' ? 'warn' : 'ok'} />
                    {target.type}
                  </span>
                ))}
              </div>

              <div className="competitor-foot">
                <span className="competitor-scan">Scanned {relativeTime(competitor.lastScannedAt)}</span>
                <div className="competitor-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => scan(competitor)}
                    disabled={scanning === competitor.id}
                    aria-label={`Scan ${competitor.name}`}
                    title="Run scan"
                  >
                    <RefreshCw size={15} className={scanning === competitor.id ? 'spin' : ''} />
                  </button>
                  <Link to={`/competitors/${competitor.id}`} className="btn btn-secondary btn-sm">
                    Open <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="competitor-note">
        <Badge tone="green">Tip</Badge>
        <span>
          Set the pricing page to <strong>daily</strong> and changelogs to <strong>weekly</strong> to catch commercial moves fast
          without over-scraping.
        </span>
      </div>

      {modalOpen && (
        <Modal
          title="Add a competitor"
          subtitle="CompetePulse creates default pricing, changelog and homepage targets from the domain."
          onClose={() => !saving && setModalOpen(false)}
          footer={
            <>
              {error && <span className="form-error">{error}</span>}
              <div className="spacer" />
              <Button variant="ghost" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button variant="primary" onClick={submit} loading={saving}>
                Add competitor
              </Button>
            </>
          }
        >
          <form onSubmit={submit} className="form-grid">
            <FormField label="Company name">
              <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Northwind Labs" required />
            </FormField>
            <FormField label="Domain" hint="Used to derive default URLs">
              <input className="input" value={form.domain} onChange={(e) => update('domain', e.target.value)} placeholder="northwindlabs.io" required />
            </FormField>
            <FormField label="Industry">
              <input className="input" value={form.industry} onChange={(e) => update('industry', e.target.value)} placeholder="Workflow automation" />
            </FormField>
            <FormField label="Competitive tier">
              <select className="select" value={form.tier} onChange={(e) => update('tier', e.target.value)}>
                {TIERS.map((tier) => (
                  <option key={tier} value={tier}>
                    {tierLabel(tier)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Description" className="field-span">
              <textarea
                className="input textarea"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="What they sell, who they win against, why they matter"
                rows={2}
              />
            </FormField>
            <div className="form-section field-span">
              <span>Target URLs</span>
              <p>Leave blank to derive standard paths from the domain.</p>
            </div>
            <FormField label="Pricing URL">
              <input className="input" value={form.pricing} onChange={(e) => update('pricing', e.target.value)} placeholder={`https://${form.domain || 'example.com'}/pricing`} />
            </FormField>
            <FormField label="Changelog URL">
              <input className="input" value={form.changelog} onChange={(e) => update('changelog', e.target.value)} placeholder={`https://${form.domain || 'example.com'}/changelog`} />
            </FormField>
            <FormField label="Landing page URL">
              <input className="input" value={form.landing} onChange={(e) => update('landing', e.target.value)} placeholder={`https://${form.domain || 'example.com'}`} />
            </FormField>
            <FormField label="Scan frequency" hint="Applies to all pages created now; you can tune each page afterwards.">
              <select className="select" value={form.frequency} onChange={(e) => update('frequency', e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="on_demand">On demand only</option>
              </select>
            </FormField>
          </form>
        </Modal>
      )}
    </div>
  );
}
