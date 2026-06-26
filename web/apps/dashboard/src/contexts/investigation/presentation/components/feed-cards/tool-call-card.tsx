import { Brain, Cloud, Wrench } from 'lucide-react';
import Image from 'next/image';
import type { FeedItem } from '../../../domain/feed-types';
import { formatToolInputBrief, parseComposioToolName } from '../../lib/feed-constants';

export function ToolCallCard({ item }: { item: FeedItem }) {
  const toolName = item.toolName ?? '';
  const isMemoryTool = toolName === 'recall_past_incidents' || toolName === 'reflect_on_knowledge';
  const isAwsTool = toolName === 'aws_api_call';
  const composioInfo = parseComposioToolName(toolName);

  if (isMemoryTool) {
    const displayName =
      toolName === 'recall_past_incidents'
        ? 'Consulting memory: past incidents'
        : 'Consulting memory: knowledge base';
    return (
      <div className="rounded-lg px-3 py-1.5 text-xs border flex items-center gap-2 bg-warning/10 border-warning/40 /30">
        <Brain className="h-3 w-3 shrink-0 text-warning" />
        <span className="font-medium text-warning">{displayName}</span>
        {item.toolInput && (
          <span className="text-warning/70 /70 truncate italic">
            {formatToolInputBrief(toolName, item.toolInput)}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
          {new Date(item.timestamp).toLocaleTimeString()}
        </span>
      </div>
    );
  }

  if (composioInfo) {
    return (
      <div className="rounded-lg px-3 py-1.5 text-xs border flex items-center gap-2 bg-muted border-border /30">
        <Image
          src={composioInfo.logo}
          alt={composioInfo.displayName}
          width={14}
          height={14}
          className="shrink-0 rounded-sm"
          unoptimized
        />
        <span className="font-medium text-muted-foreground">
          {composioInfo.displayName}: {composioInfo.action}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
          {new Date(item.timestamp).toLocaleTimeString()}
        </span>
      </div>
    );
  }

  if (isAwsTool) {
    const brief = formatToolInputBrief(toolName, item.toolInput);
    return (
      <div className="rounded-lg px-3 py-1.5 text-xs border flex items-center gap-2 bg-muted border-border /30">
        <Cloud className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="font-medium text-muted-foreground">AWS</span>
        {brief && <span className="text-muted-foreground truncate">{brief}</span>}
        <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
          {new Date(item.timestamp).toLocaleTimeString()}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg px-3 py-1.5 text-xs bg-muted border border-border /30 flex items-center gap-2">
      <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="font-mono font-medium text-muted-foreground">{toolName}</span>
      {item.toolInput && (
        <span className="text-muted-foreground truncate">
          {formatToolInputBrief(toolName, item.toolInput)}
        </span>
      )}
      <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
        {new Date(item.timestamp).toLocaleTimeString()}
      </span>
    </div>
  );
}
