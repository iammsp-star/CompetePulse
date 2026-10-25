import { useEffect, useState } from 'react';
import {
  BellRing,
  BrainCircuit,
  CheckCircle2,
  Cloud,
  Database,
  Globe2,
  Mail,
  RefreshCw,
  Save,
  Server,
  Settings2,
  Sparkles,
  Layers,
} from 'lucide-react';
import type { ProviderStatus, Settings as SettingsShape } from '../../shared/types';
import { api } from '../lib/api';
import { emitRefresh } from '../lib/events';
import { useToast } from '../components/Toast';
import { Badge, Button, Card, FormField, Spinner, StatusDot, Toggle } from '../components/ui';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsShape | null>(null);
  const [providers, setProviders] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [slackResult, setSlackResult] = useState<{ status: string; detail: string } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api
      .settings()
      .then((result) => {
        setSettings(result.settings);
        setProviders(result.providers);
      })
      .catch((error: Error) => toast.push(error.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof SettingsShape>(key: K, value: SettingsShape[K]) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const result = await api.saveSettings(settings);
      setSettings(result.settings);
      setProviders(result.providers);
      toast.push('Workspace settings saved');
      emitRefresh();
    } catch (error) {
      toast.push((error as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const testSlack = async () => {
    if (!settings) return;
    setTesting(true);
    setSlackResult(null);
    try {
      const result = await api.testSlack(settings.slackWebhook);
      setSlackResult(result.result);
      toast.push(
        result.result.status === 'sent' ? 'Slack test delivered' : result.result.detail,
        result.result.status === 'sent' ? 'success' : 'error',
      );
    } catch (error) {
      toast.push((error as Error).message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const scanNow = async () => {
    setScanning(true);
    try {
      const result = await api.scan({});
      toast.push(
        result.scanned
          ? `Scanned ${result.scanned} pages · ${result.insights ?? 0} new insights`
          : 'No enabled targets to scan',
      );
      emitRefresh();
    } catch (error) {
      toast.push((error as Error).message, 'error');
    } finally {
      setScanning(false);
    }
  };

  const reindex = async () => {
    setReindexing(true);
    try {
      const result = await api.reindex();
      toast.push(`Reindexed ${result.snapshots} snapshots into ${result.chunks} chunks`);
    } catch (error) {
      toast.push((error as Error).message, 'error');
    } finally {
      setReindexing(false);
    }
  };

  if (loading || !settings || !providers) return <Spinner label="Loading workspace settings…" />;

  const providerCards = [
    { key: 'Scraper', data: providers.scraper, icon: <Globe2 size={16} />, live: providers.scraper.live },
    { key: 'LLM synthesis', data: providers.llm, icon: <BrainCircuit size={16} />, live: providers.llm.live },
    { key: 'Embeddings', data: providers.embeddings, icon: <Sparkles size={16} />, live: providers.embeddings.live },
    { key: 'Vector store', data: providers.vectorStore, icon: <Layers size={16} />, live: providers.vectorStore.live },
    {
      key: 'Slack alerts',
      data: { provider: 'slack', detail: providers.slack.detail },
      icon: <BellRing size={16} />,
      live: providers.slack.configured,
    },
    {
      key: 'Email delivery',
      data: { provider: 'email', detail: providers.email.detail },
      icon: <Mail size={16} />,
      live: providers.email.configured,
    },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">
            <Settings2 size={13} /> Workspace configuration
          </div>
          <h1>Settings</h1>
          <p className="page-sub">Tune monitoring, alert thresholds and the AI pipeline behind CompetePulse.</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Save size={15} />} loading={saving} onClick={save}>
            Save changes
          </Button>
        </div>
      </header>

      <div className="settings-grid">
        <div className="settings-column">
          <Card title="Workspace" subtitle="How CompetePulse frames analysis and briefings.">
            <div className="form-grid">
              <FormField label="Our product name" hint="Used in digests and gap recommendations.">
                <input className="input" value={settings.ourProduct} onChange={(e) => update('ourProduct', e.target.value)} />
              </FormField>
              <FormField label="Alert threshold" hint="Send Slack/email alerts at or above this impact.">
                <select
                  className="select"
                  value={settings.alertMinImpact}
                  onChange={(e) => update('alertMinImpact', e.target.value as SettingsShape['alertMinImpact'])}
                >
                  <option value="high">High impact only</option>
                  <option value="medium">Medium and above</option>
                  <option value="low">Every signal</option>
                </select>
              </FormField>
              <FormField label={`Noise sensitivity · ${settings.sensitivity.toFixed(1)}×`} hint="Higher values report more granular changes; lower values suppress more." className="field-span">
                <input
                  type="range"
                  min={0.4}
                  max={2}
                  step={0.1}
                  value={settings.sensitivity}
                  onChange={(e) => update('sensitivity', Number(e.target.value))}
                  className="range"
                />
              </FormField>
            </div>
            <Toggle
              label="Automatic scanning"
              description="Let the scheduler pick up targets when their cadence is due."
              checked={settings.schedulerEnabled}
              onChange={(value) => update('schedulerEnabled', value)}
            />
            <Toggle
              label="Demo fallback"
              description="Generate a simulated revision when a site cannot be reached. Useful for local demos; disable in production."
              checked={settings.demoFallback}
              onChange={(value) => update('demoFallback', value)}
            />
          </Card>

          <Card title="Notifications" subtitle="Route high-priority moves to the places your team already watches.">
            <div className="form-grid">
              <FormField label="Slack incoming webhook" hint="Create one in Slack → Apps → Incoming Webhooks." className="field-span">
                <div className="input-with-action">
                  <input
                    className="input"
                    value={settings.slackWebhook}
                    onChange={(e) => update('slackWebhook', e.target.value)}
                    placeholder="https://hooks.slack.com/services/…"
                  />
                  <Button variant="secondary" size="sm" loading={testing} onClick={testSlack}>
                    Send test
                  </Button>
                </div>
              </FormField>
              {slackResult && (
                <div className={`inline-result inline-result-${slackResult.status === 'sent' ? 'ok' : 'err'}`}>
                  <CheckCircle2 size={14} /> {slackResult.detail}
                </div>
              )}
              <FormField label="Email recipients" hint="Comma-separated. Requires RESEND_API_KEY on the server.">
                <input
                  className="input"
                  value={settings.emailRecipients}
                  onChange={(e) => update('emailRecipients', e.target.value)}
                  placeholder="leadership@company.com, pmm@company.com"
                />
              </FormField>
              <FormField label="From address">
                <input className="input" value={settings.emailFrom} onChange={(e) => update('emailFrom', e.target.value)} />
              </FormField>
            </div>
          </Card>

          <Card title="Weekly briefing" subtitle="When the executive digest is compiled and sent.">
            <Toggle
              label="Automatic weekly digest"
              description="Compile a briefing from the current week's signals at the scheduled time."
              checked={settings.digestEnabled}
              onChange={(value) => update('digestEnabled', value)}
            />
            <div className="form-grid compact-grid">
              <FormField label="Delivery day">
                <select className="select" value={settings.digestDay} onChange={(e) => update('digestDay', e.target.value)}>
                  {DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Local time">
                <input className="input" type="time" value={settings.digestHour} onChange={(e) => update('digestHour', e.target.value)} />
              </FormField>
            </div>
          </Card>
        </div>

        <div className="settings-column">
          <Card title="Provider status" subtitle="Local-first, with production adapters activated by environment variables.">
            <div className="provider-list">
              {providerCards.map((card) => (
                <div className="provider-row" key={card.key}>
                  <div className="provider-icon">{card.icon}</div>
                  <div className="provider-body">
                    <div className="provider-top">
                      <strong>{card.key}</strong>
                      <Badge tone={card.live ? 'green' : 'neutral'}>
                        <StatusDot tone={card.live ? 'ok' : 'muted'} /> {card.data.provider}
                      </Badge>
                    </div>
                    <span>{card.data.detail}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="provider-env">
              <span>Environment keys</span>
              <code>FIRECRAWL_API_KEY</code>
              <code>OPENAI_API_KEY</code>
              <code>QDRANT_URL</code>
              <code>SLACK_WEBHOOK_URL</code>
              <code>RESEND_API_KEY</code>
            </div>
          </Card>

          <Card title="Scanning & maintenance" subtitle="Force a refresh or repair the retrieval index.">
            <div className="action-list">
              <div className="action-row">
                <div>
                  <strong>Run a full scan now</strong>
                  <p>Capture every enabled target, diff against the last snapshot and synthesize insights.</p>
                </div>
                <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} loading={scanning} onClick={scanNow}>
                  Scan
                </Button>
              </div>
              <div className="action-row">
                <div>
                  <strong>Rebuild vector index</strong>
                  <p>Re-chunk and re-embed the 50 most recent snapshots. Use after changing embedding models.</p>
                </div>
                <Button variant="secondary" size="sm" icon={<Database size={14} />} loading={reindexing} onClick={reindex}>
                  Reindex
                </Button>
              </div>
              <div className="action-row">
                <div>
                  <strong>Deployment mode</strong>
                  <p>This workspace runs locally with SQLite persistence in <code>data/competepulse.db</code>.</p>
                </div>
                <Badge tone="neutral">
                  <Server size={12} /> Local
                </Badge>
              </div>
              <div className="action-row">
                <div>
                  <strong>Cloud adapters</strong>
                  <p>Firecrawl, OpenAI, Qdrant, Slack and Resend activate automatically when their keys are present.</p>
                </div>
                <Badge tone="green">
                  <Cloud size={12} /> Ready
                </Badge>
              </div>
            </div>
          </Card>

          <Card title="How the pipeline works" subtitle="From capture to briefing in one pass.">
            <ol className="pipeline-steps">
              <li>
                <span>01</span>
                <div>
                  <strong>Capture</strong>
                  <p>Firecrawl, native extraction or the demo generator produce clean markdown.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>Compare</strong>
                  <p>Line diff, pricing parser and noise filters isolate material changes.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>Embed</strong>
                  <p>Sections are chunked and indexed for semantic retrieval and gap analysis.</p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <strong>Synthesize & route</strong>
                  <p>LLM or rubric analysis creates insights, then Slack/email alerts fire by impact.</p>
                </div>
              </li>
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
