'use client';

import { ChevronDown, ChevronRight, Wrench } from 'lucide-react';
import { useState } from 'react';
import type { FeedItem } from '../../../domain/feed-types';
import { parseComposioToolName } from '../../lib/feed-constants';
import { ToolCallCard } from './tool-call-card';

export function ToolCallGroup({ items }: { items: FeedItem[] }) {
  const [expanded, setExpanded] = useState(false);

  if (items.length <= 2) {
    return (
      <>
        {items.map((item) => (
          <ToolCallCard key={item.id} item={item} />
        ))}
      </>
    );
  }

  const providers = new Set<string>();
  for (const item of items) {
    if (item.toolName?.startsWith('composio_')) {
      const parsed = parseComposioToolName(item.toolName);
      if (parsed) providers.add(parsed.displayName);
    } else if (item.toolName === 'aws_api_call') {
      providers.add('AWS');
    } else {
      providers.add(item.toolName ?? 'tool');
    }
  }
  const summary = `${items.length} tool calls (${[...providers].join(', ')})`;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full rounded-lg px-3 py-1.5 text-xs bg-muted border border-border /30 flex items-center gap-2 text-left hover:bg-muted dark:hover:bg-muted/50 transition-colors"
      >
        <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="font-medium text-muted-foreground">{summary}</span>
        <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
          {new Date(items[0].timestamp).toLocaleTimeString()} —{' '}
          {new Date(items[items.length - 1].timestamp).toLocaleTimeString()}
        </span>
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="pl-3 space-y-1">
          {items.map((item) => (
            <ToolCallCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
