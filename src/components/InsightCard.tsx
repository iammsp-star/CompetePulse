import { ArrowUpRight, Bell, BellRing, ExternalLink } from 'lucide-react';
import type { FeedItem } from '../../shared/types';
import { humanType, relativeTime } from '../lib/format';
import { Avatar, CategoryBadge, ImpactBadge } from './ui';

export function InsightCard({
  insight,
  onOpen,
  onNotify,
  notifying,
}: {
  insight: FeedItem;
  onOpen: () => void;
  onNotify: () => void;
  notifying?: boolean;
}) {
  const priceChange = insight.diff?.pricingChanges?.[0];
  return (
    <article className={`insight-card impact-border-${insight.impact}`}>
      <div className="insight-card-head">
        <Avatar name={insight.competitorName ?? 'Unknown'} color={insight.competitorColor ?? '#6ee7b7'} size={36} />
        <div className="insight-who">
          <span className="insight-name">{insight.competitorName}</span>
          <span className="insight-sub">
            {humanType(insight.targetType)} · {relativeTime(insight.createdAt)} · {insight.domain}
          </span>
        </div>
        <div className="insight-badges">
          <ImpactBadge impact={insight.impact} />
          <CategoryBadge category={insight.category} />
        </div>
      </div>

      <h3 className="insight-title">{insight.title}</h3>
      <p className="insight-summary">{insight.summary}</p>

      {priceChange && (
        <div className="insight-price">
          <span>{priceChange.plan}</span>
          <strong>{priceChange.from}</strong>
          <ArrowUpRight size={13} />
          <strong>{priceChange.to}</strong>
        </div>
      )}

      <div className="insight-foot">
        <div className="insight-signals">
          {insight.diff && (
            <span>
              {Math.round(insight.diff.similarity * 100)}% match · {insight.diff.addedLines + insight.diff.removedLines}{' '}
              line{insight.diff.addedLines + insight.diff.removedLines === 1 ? '' : 's'} changed
            </span>
          )}
          <span className={`source-pill source-${insight.source}`}>
            {insight.source === 'llm' ? 'LLM analysis' : 'Rubric analysis'}
          </span>
        </div>
        <div className="insight-actions">
          {insight.notified ? (
            <span className="notified-pill">
              <BellRing size={13} /> Alert sent
            </span>
          ) : (
            <button type="button" className="link-btn" onClick={onNotify} disabled={notifying}>
              <Bell size={13} /> {notifying ? 'Sending…' : 'Send alert'}
            </button>
          )}
          <button type="button" className="link-btn" onClick={onOpen}>
            View analysis <ExternalLink size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}
