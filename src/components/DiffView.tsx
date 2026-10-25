import { ArrowRight, Minus, Plus } from 'lucide-react';
import type { Diff } from '../../shared/types';
import { percent } from '../lib/format';
import { Badge } from './ui';

export function PricingChanges({ changes }: { changes: Diff['pricingChanges'] }) {
  if (!changes.length) return null;
  return (
    <div className="pricing-changes">
      {changes.map((change, idx) => (
        <div className="pricing-change" key={`${change.plan}-${change.field}-${idx}`}>
          <span className="pricing-plan">{change.plan}</span>
          <span className="pricing-field">{change.field}</span>
          <span className="pricing-from">{change.from}</span>
          <ArrowRight size={12} />
          <span className="pricing-to">{change.to}</span>
        </div>
      ))}
    </div>
  );
}

export function DiffView({ diff, compact = false }: { diff: Diff; compact?: boolean }) {
  return (
    <div className={`diff-view ${compact ? 'diff-compact' : ''}`}>
      <div className="diff-stats">
        <Badge tone="green">
          <Plus size={11} /> {diff.addedLines} added
        </Badge>
        <Badge tone="red">
          <Minus size={11} /> {diff.removedLines} removed
        </Badge>
        <Badge tone="neutral">{percent(diff.similarity)} similar</Badge>
        <span className="diff-magnitude">magnitude {percent(diff.magnitude)}</span>
      </div>
      <PricingChanges changes={diff.pricingChanges} />
      <div className="diff-lines">
        {diff.segments.map((segment, idx) => (
          <div key={idx} className={`diff-line diff-${segment.type}`}>
            <span className="diff-gutter">
              {segment.type === 'added' ? '+' : segment.type === 'removed' ? '−' : ''}
            </span>
            <span className="diff-text">{segment.text === '…' ? '⋯' : segment.text || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
