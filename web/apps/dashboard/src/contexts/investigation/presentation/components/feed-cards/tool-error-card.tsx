import { AlertTriangle } from 'lucide-react';
import type { FeedItem } from '../../../domain/feed-types';
import { parseComposioToolName } from '../../lib/feed-constants';

export function ToolErrorCard({ item }: { item: FeedItem }) {
  let toolName = '';
  let error = item.message;
  try {
    const parsed = JSON.parse(item.message) as { toolName?: string; error?: string };
    toolName = parsed.toolName ?? '';
    error = parsed.error ?? item.message;
  } catch {
    /* not JSON */
  }

  const composioInfo = toolName ? parseComposioToolName(toolName) : null;
  const displayName = composioInfo
    ? `${composioInfo.displayName}: ${composioInfo.action}`
    : toolName === 'aws_api_call'
      ? 'AWS API Call'
      : toolName;

  return (
    <div className="rounded-lg px-3 py-1.5 text-xs border flex items-center gap-2 bg-destructive/10 border-destructive/40 /30">
      <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
      {displayName && <span className="font-medium text-destructive">{displayName}</span>}
      <span className="text-destructive/80 /80 truncate">{error}</span>
      <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
        {new Date(item.timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
}
