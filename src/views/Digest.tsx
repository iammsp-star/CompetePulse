import { useEffect, useState } from 'react';
import { BrainCircuit, Calendar, Mail, RefreshCw, Send, Sparkles } from 'lucide-react';
import type { Digest } from '../../shared/types';
import { api } from '../lib/api';
import { dateTime, longDate, shortDate } from '../lib/format';
import { Markdown } from '../components/Markdown';
import { useToast } from '../components/Toast';
import { Badge, Button, EmptyState, Spinner } from '../components/ui';

export function DigestPage() {
  const [digests, setDigests] = useState<Digest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentWeekInsights, setCurrentWeekInsights] = useState(0);
  const [weekRange, setWeekRange] = useState<{ currentWeek: { weekStart: string; weekEnd: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const toast = useToast();

  const load = async (selectLatest = false) => {
    try {
      const result = await api.digests();
      setDigests(result.digests);
      setCurrentWeekInsights(result.currentWeekInsights);
      setWeekRange({ currentWeek: result.currentWeek });
      setSelectedId((current) => {
        if (selectLatest) return result.digests[0]?.id ?? null;
        return current ?? result.digests[0]?.id ?? null;
      });
    } catch (error) {
      toast.push((error as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selected = digests.find((digest) => digest.id === selectedId) ?? null;

  const generate = async () => {
    setGenerating(true);
    try {
      const result = await api.generateDigest('current');
      toast.push(`Briefing generated from ${result.insights.length} signals this week`);
      await load(true);
    } catch (error) {
      toast.push((error as Error).message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const send = async () => {
    if (!selected) return;
    setSending(true);
    try {
      const result = await api.sendDigest(selected.id);
      const sent = result.notifications.some((notification) => notification.status === 'sent');
      const simulated = result.notifications.some((notification) => notification.status === 'simulated');
      if (sent) toast.push('Briefing delivered to your configured channels');
      else if (simulated) toast.push('Delivery simulated — configure Slack or Resend to send for real', 'info');
      else toast.push('No live delivery channel configured. Add Slack or Resend in Settings.', 'info');
    } catch (error) {
      toast.push((error as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <Spinner label="Loading briefings…" />;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">
            <BrainCircuit size={13} /> Executive synthesis
          </div>
          <h1>Weekly briefing</h1>
          <p className="page-sub">A decision-ready digest of pricing, product and messaging moves from your monitored set.</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" icon={<Send size={15} />} onClick={send} disabled={!selected} loading={sending}>
            Send briefing
          </Button>
          <Button variant="primary" icon={<Sparkles size={15} />} loading={generating} onClick={generate}>
            Generate briefing
          </Button>
        </div>
      </header>

      <div className="digest-banner">
        <div className="digest-banner-icon">
          <Calendar size={18} />
        </div>
        <div>
          <strong>
            {currentWeekInsights} signal{currentWeekInsights === 1 ? '' : 's'} captured this week
          </strong>
          <span>
            {weekRange
              ? `${shortDate(weekRange.currentWeek.weekStart)} – ${shortDate(
                  new Date(new Date(weekRange.currentWeek.weekEnd).getTime() - 86400000).toISOString(),
                )} · generate a mid-week briefing any time`
              : 'Weekly synthesis is ready to generate'}
          </span>
        </div>
        <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} loading={generating} onClick={generate}>
          Refresh briefing
        </Button>
      </div>

      {digests.length === 0 ? (
        <EmptyState
          icon={<BrainCircuit size={22} />}
          title="No briefings yet"
          description="Generate your first executive digest from this week's signals. The first build includes everything captured since Monday."
          action={
            <Button variant="primary" loading={generating} onClick={generate}>
              Generate briefing
            </Button>
          }
        />
      ) : (
        <div className="digest-layout">
          <aside className="digest-list">
            <div className="digest-list-head">Briefing archive</div>
            {digests.map((digest) => (
              <button
                key={digest.id}
                type="button"
                className={`digest-list-item ${digest.id === selectedId ? 'digest-list-active' : ''}`}
                onClick={() => setSelectedId(digest.id)}
              >
                <div className="digest-list-date">
                  <Calendar size={13} />
                  {shortDate(digest.weekStart)} – {shortDate(new Date(new Date(digest.weekEnd).getTime() - 86400000).toISOString())}
                </div>
                <div className="digest-list-title">{digest.title.replace('Competitive Intelligence Briefing — ', '')}</div>
                <div className="digest-list-meta">
                  <Badge tone="neutral">{digest.insightCount} signals</Badge>
                  {digest.highImpactCount > 0 && <Badge tone="red">{digest.highImpactCount} high</Badge>}
                </div>
                <span className="digest-list-created">Generated {dateTime(digest.createdAt)}</span>
              </button>
            ))}
            <div className="digest-list-tip">
              <Mail size={14} /> Briefings can be delivered to Slack and email from Settings.
            </div>
          </aside>

          <section className="digest-document">
            {selected ? (
              <>
                <header className="digest-doc-head">
                  <div>
                    <span className="digest-kicker">Executive briefing</span>
                    <h2>{selected.title}</h2>
                    <p>
                      {longDate(selected.weekStart)} · {selected.insightCount} signals · {selected.highImpactCount} high impact
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" icon={<Send size={14} />} loading={sending} onClick={send}>
                    Deliver
                  </Button>
                </header>
                <div className="digest-doc-body">
                  <Markdown content={selected.contentMd} />
                </div>
                <footer className="digest-doc-foot">
                  Source: CompetePulse snapshot archive · generated {dateTime(selected.createdAt)}
                </footer>
              </>
            ) : (
              <EmptyState title="Select a briefing" description="Choose an entry from the archive to read it." />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
