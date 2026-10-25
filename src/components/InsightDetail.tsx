import { useEffect, useState } from 'react';
import { Bell, BellRing, FileText, GitCompareArrows, ScanText } from 'lucide-react';
import type { Diff, Snapshot } from '../../shared/types';
import { api } from '../lib/api';
import { dateTime, humanType, percent } from '../lib/format';
import { useToast } from './Toast';
import { DiffView, PricingChanges } from './DiffView';
import { Markdown } from './Markdown';
import { Avatar, Button, CategoryBadge, ImpactBadge, Modal, Spinner, Tabs } from './ui';

interface DetailProps {
  insight: {
    id: string;
    competitorId: string;
    competitorName?: string;
    competitorColor?: string;
    diffId: string | null;
    category: Parameters<typeof CategoryBadge>[0]['category'];
    impact: Parameters<typeof ImpactBadge>[0]['impact'];
    title: string;
    summary: string;
    evidence: string[];
    recommendation: string;
    confidence: number;
    source: string;
    createdAt: string;
    notified: number;
    targetType?: string;
    domain?: string;
    diff?: { pricingChanges: Diff['pricingChanges'] };
  };
  onClose: () => void;
  onChanged?: () => void;
}

export function InsightDetail({ insight, onClose, onChanged }: DetailProps) {
  const [tab, setTab] = useState<'analysis' | 'diff' | 'page'>('analysis');
  const [diff, setDiff] = useState<Diff | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [notified, setNotified] = useState(Boolean(insight.notified));
  const [sending, setSending] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!insight.diffId || diff) return;
    setLoading(true);
    api
      .diff(insight.diffId)
      .then((result) => {
        setDiff(result.diff);
        setSnapshot(result.snapshot);
      })
      .catch((error: Error) => toast.push(error.message, 'error'))
      .finally(() => setLoading(false));
  }, [insight.diffId, diff, toast]);

  const notify = async () => {
    setSending(true);
    try {
      const result = await api.notifyInsight(insight.id);
      const delivered = result.notifications.some((n) => n.status === 'sent');
      const skipped = result.notifications.every((n) => n.status === 'skipped' || n.status === 'simulated');
      if (delivered) toast.push('Alert delivered via Slack');
      else if (skipped) toast.push('Alert recorded, but no live channel is configured', 'info');
      else toast.push('Alert delivery failed — check Settings', 'error');
      setNotified(Boolean(result.insight.notified));
      onChanged?.();
    } catch (error) {
      toast.push((error as Error).message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      wide
      title={insight.competitorName ? `${insight.competitorName} · ${insight.title}` : insight.title}
      subtitle={`${humanType(insight.targetType ?? '')} · ${dateTime(insight.createdAt)} · detected ${insight.source === 'llm' ? 'by LLM analysis' : 'by rubric analysis'}`}
      onClose={onClose}
      footer={
        <>
          <span className="modal-meta">Confidence {percent(insight.confidence)}</span>
          <div className="spacer" />
          {notified ? (
            <span className="notified-pill">
              <BellRing size={14} /> Alert sent
            </span>
          ) : (
            <Button variant="secondary" icon={<Bell size={15} />} loading={sending} onClick={notify}>
              Send alert
            </Button>
          )}
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <Tabs
        tabs={[
          { id: 'analysis', label: 'Analysis' },
          { id: 'diff', label: 'Change diff' },
          { id: 'page', label: 'Captured page' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'analysis' && (
        <div className="detail-grid">
          <div className="detail-main">
            <div className="detail-badges">
              <ImpactBadge impact={insight.impact} />
              <CategoryBadge category={insight.category} />
              <span className={`source-pill source-${insight.source}`}>{insight.source === 'llm' ? 'LLM' : 'Rubric'}</span>
            </div>
            <h3 className="detail-heading">What changed</h3>
            <p className="detail-body">{insight.summary}</p>

            <h3 className="detail-heading">Evidence from the page</h3>
            {insight.evidence.length ? (
              <ul className="evidence-list">
                {insight.evidence.map((item, idx) => (
                  <li key={idx} className={item.startsWith('−') ? 'evidence-removed' : 'evidence-added'}>
                    <code>{item}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">No evidence lines were stored for this insight.</p>
            )}

            {diff?.pricingChanges?.length ? (
              <>
                <h3 className="detail-heading">Pricing movement</h3>
                <PricingChanges changes={diff.pricingChanges} />
              </>
            ) : null}

            <h3 className="detail-heading">Recommended action</h3>
            <div className="recommendation">{insight.recommendation}</div>
          </div>
          <aside className="detail-side">
            <div className="detail-side-block">
              <span className="side-label">Competitor</span>
              <div className="side-competitor">
                {insight.competitorColor && (
                  <Avatar name={insight.competitorName ?? ''} color={insight.competitorColor} size={30} />
                )}
                <div>
                  <strong>{insight.competitorName}</strong>
                  <span>{insight.domain}</span>
                </div>
              </div>
            </div>
            <div className="detail-side-block">
              <span className="side-label">Signal</span>
              <div className="side-kv">
                <span>Category</span>
                <strong>{insight.category}</strong>
              </div>
              <div className="side-kv">
                <span>Impact</span>
                <strong>{insight.impact}</strong>
              </div>
              <div className="side-kv">
                <span>Confidence</span>
                <strong>{percent(insight.confidence)}</strong>
              </div>
              <div className="side-kv">
                <span>Detected</span>
                <strong>{dateTime(insight.createdAt)}</strong>
              </div>
            </div>
            {diff && (
              <div className="detail-side-block">
                <span className="side-label">Diff footprint</span>
                <div className="side-kv">
                  <span>Lines added</span>
                  <strong className="text-green">+{diff.addedLines}</strong>
                </div>
                <div className="side-kv">
                  <span>Lines removed</span>
                  <strong className="text-red">−{diff.removedLines}</strong>
                </div>
                <div className="side-kv">
                  <span>Similarity</span>
                  <strong>{percent(diff.similarity)}</strong>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {tab === 'diff' &&
        (loading ? (
          <Spinner label="Loading diff…" />
        ) : diff ? (
          <div className="detail-diff">
            <div className="detail-diff-meta">
              <GitCompareArrows size={15} />
              <span>
                Comparing the current snapshot with the previous capture of{' '}
                {snapshot ? humanType(insight.targetType ?? '') : 'this page'}.
              </span>
            </div>
            <DiffView diff={diff} />
          </div>
        ) : (
          <div className="empty-inline">
            <GitCompareArrows size={20} />
            <p>No diff is linked to this insight. It may have been generated from a digest or manual analysis.</p>
          </div>
        ))}

      {tab === 'page' &&
        (loading ? (
          <Spinner label="Loading snapshot…" />
        ) : snapshot ? (
          <div className="page-preview-wrap">
            <div className="page-preview-bar">
              <span className="window-dots">
                <i /> <i /> <i />
              </span>
              <span className="page-preview-url">{insight.domain}</span>
              <span className="page-preview-mode">
                {snapshot.mode === 'live' ? 'Live capture' : snapshot.mode === 'simulated' ? 'Simulated capture' : 'Seed capture'}
              </span>
            </div>
            <div className="page-preview">
              <div className="page-preview-head">
                <FileText size={15} /> {snapshot.title}
                <span className="muted">· {snapshot.wordCount} words · {dateTime(snapshot.capturedAt)}</span>
              </div>
              {snapshot.screenshotUrl ? (
                <img src={snapshot.screenshotUrl} alt={`Screenshot of ${snapshot.title}`} className="page-screenshot" />
              ) : (
                <div className="screenshot-note">
                  <ScanText size={15} /> Screenshot unavailable in this capture. Rendering the archived markdown instead.
                </div>
              )}
              <Markdown content={snapshot.contentMd} />
            </div>
          </div>
        ) : (
          <div className="empty-inline">
            <FileText size={20} />
            <p>Snapshot content is unavailable.</p>
          </div>
        ))}
    </Modal>
  );
}
