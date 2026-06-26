import Markdown from 'react-markdown';
import type { FeedItem } from '../../../domain/feed-types';
import { formatDuration, SEVERITY_STYLES } from '../../lib/feed-constants';

export function CompletionCard({ item }: { item: FeedItem }) {
  const c = item.completion;
  if (!c) return null;

  return (
    <div className="rounded-lg border-2 border-success/40 bg-success/10 /30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {new Date(item.timestamp).toLocaleTimeString()}
        </span>
        <span className="text-xs font-semibold text-success">Investigation Complete</span>
        {c.severity && (
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_STYLES[c.severity] ?? SEVERITY_STYLES.medium}`}
          >
            {c.severity}
          </span>
        )}
      </div>

      {c.rootCause && (
        <div className="text-sm text-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2 prose-headings:text-sm">
          <Markdown>{c.rootCause}</Markdown>
        </div>
      )}

      {c.recommendedActions && c.recommendedActions.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Recommended Actions
          </span>
          <ul className="space-y-1">
            {c.recommendedActions.map((a) => (
              <li key={a.action} className="flex items-start gap-1.5 text-xs text-foreground">
                <span className="mt-0.5 shrink-0">
                  {a.riskLevel === 'high' || a.riskLevel === 'critical' ? (
                    <span className="text-destructive">!</span>
                  ) : (
                    <span className="text-success">-</span>
                  )}
                </span>
                <span>
                  <span className="font-medium">{a.label ?? a.action}</span>
                  {a.description && (
                    <span className="text-muted-foreground"> — {a.description}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground pt-1 border-t border-success/40">
        {c.durationMs != null && <span>Duration: {formatDuration(c.durationMs)}</span>}
        {c.status && <span>Status: {c.status.replace(/_/g, ' ')}</span>}
      </div>
    </div>
  );
}
