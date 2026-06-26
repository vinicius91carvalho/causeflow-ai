'use client';

import { useState } from 'react';
import type { FeedItem } from '../../../domain/feed-types';
import { SEVERITY_STYLES } from '../../lib/feed-constants';

export function WorkspaceFooter({ completionItem }: { completionItem: FeedItem }) {
  const [expanded, setExpanded] = useState(false);
  const c = completionItem.completion;
  if (!c) return null;

  const rootCause = c.rootCause ?? '';
  const truncated =
    rootCause.length > 200 && !expanded ? `${rootCause.slice(0, 200)}...` : rootCause;
  const canExpand = rootCause.length > 200;

  return (
    <div className="border-t border-border bg-success/10 /30 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-success">Root Cause</span>
            {c.severity && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_STYLES[c.severity] ?? SEVERITY_STYLES.medium}`}
              >
                {c.severity}
              </span>
            )}
            {c.status && (
              <span className="text-[10px] text-muted-foreground">
                {c.status.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <p className="text-xs text-foreground leading-relaxed">
            {truncated}
            {canExpand && (
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="ml-1 text-primary hover:underline text-[10px] font-medium"
              >
                {expanded ? 'show less' : 'show more'}
              </button>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
