'use client';

import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  FileSearch,
  Link2,
} from 'lucide-react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import Markdown from 'react-markdown';
import type { FeedItem } from '../../../domain/feed-types';
import {
  AGENT_ROLE_DISPLAY,
  DEFAULT_EVIDENCE_STYLE,
  EVIDENCE_ICONS,
  EVIDENCE_STYLES,
  formatMemoryContent,
  parseComposioToolName,
} from '../../lib/feed-constants';
import { MaskingBadge } from './masking-badge';
import { ToolCallDrawer } from './tool-call-drawer';

/**
 * Pick an icon + display label for an evidence source based on the originating
 * tool name. Mirrors ToolCallCard's visual vocabulary so evidence cards
 * attribute their source with the same iconography users already recognize.
 */
function ToolSourceIndicator({ toolName }: { toolName: string }) {
  const composio = parseComposioToolName(toolName);
  if (composio) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
        <Image
          src={composio.logo}
          alt={composio.displayName}
          width={12}
          height={12}
          className="shrink-0 rounded-sm"
          unoptimized
        />
        {composio.displayName}
        {composio.action && <span className="text-muted-foreground">· {composio.action}</span>}
      </span>
    );
  }
  if (toolName === 'aws_api_call') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-warning/10 text-warning /40">
        <Cloud className="h-2.5 w-2.5" />
        AWS
      </span>
    );
  }
  if (
    toolName === 'memory_recall' ||
    toolName === 'memory_reflect' ||
    toolName === 'recall_past_incidents' ||
    toolName === 'reflect_on_knowledge'
  ) {
    const label =
      toolName === 'memory_recall' || toolName === 'recall_past_incidents'
        ? 'Memory recall'
        : 'Memory reflect';
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-warning/10 text-warning /40">
        <Brain className="h-2.5 w-2.5" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground font-mono">
      {toolName}
    </span>
  );
}

/**
 * Renders `quote` inside the raw tool text with a deterministic <mark> highlight.
 * If the quote isn't found (shouldn't happen — validator guarantees substring match),
 * falls back to rendering quote + context separately.
 */
function HighlightedQuote({ quote }: { quote: string }) {
  return (
    <blockquote className="mt-2 rounded-md border-l-4 border-success/60 bg-success/10 /30 px-3 py-2">
      <pre className="text-xs font-mono whitespace-pre-wrap break-words text-foreground/90">
        <mark className="bg-warning/15 /60 text-foreground px-0.5 rounded-sm">{quote}</mark>
      </pre>
    </blockquote>
  );
}

export function EvidenceCard({ item }: { item: FeedItem }) {
  const [expanded, setExpanded] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const params = useParams<{ id?: string }>();
  const incidentId = params?.id ?? '';
  const evType = item.evidenceType ?? 'agent_reasoning';
  const Icon = EVIDENCE_ICONS[evType] ?? FileSearch;
  const style = EVIDENCE_STYLES[evType] ?? DEFAULT_EVIDENCE_STYLE;
  const isCited = Boolean(item.toolCallId && item.quote);

  const rawLabel = item.label ?? evType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const label =
    evType === 'historical_context'
      ? rawLabel.toLowerCase().includes('memory')
        ? rawLabel
        : `Memory: ${rawLabel}`
      : rawLabel;

  const content =
    evType === 'historical_context' ? formatMemoryContent(item.message) : item.message;
  const preview = content.length > 200 ? `${content.slice(0, 200)}...` : content;
  const hasMore = content.length > 200;

  const roleInfo = item.agentRole ? AGENT_ROLE_DISPLAY[item.agentRole] : undefined;

  return (
    <div className={`rounded-lg border text-sm ${style.bg} ${style.border}`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left"
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {item.toolName ? (
          <ToolSourceIndicator toolName={item.toolName} />
        ) : (
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${style.badge}`}>
            {evType === 'historical_context' ? 'memory' : evType.replace(/_/g, ' ')}
          </span>
        )}
        {isCited && (
          <span
            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-success/10 text-success /60"
            title="Evidence backed by a literal quote from a real tool call"
          >
            <CheckCircle2 className="h-2.5 w-2.5" />
            cited
          </span>
        )}
        {roleInfo && (
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${roleInfo.color}`}>
            {roleInfo.label}
          </span>
        )}
        <span className="text-xs text-foreground font-medium truncate flex-1">
          {isCited && item.claim ? item.claim : label}
        </span>
        {evType === 'historical_context' && item.memoriesFound != null && (
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-warning/15 text-warning">
            {item.memoriesFound} {item.memoriesFound === 1 ? 'memory' : 'memories'}
          </span>
        )}
        {item.skippedInvestigation && (
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground">
            resolved from memory
          </span>
        )}
        {item.masking && <MaskingBadge masking={item.masking} />}
        <span className="text-[10px] text-muted-foreground">
          {new Date(item.timestamp).toLocaleTimeString()}
        </span>
        {(hasMore || isCited) &&
          (expanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          ))}
      </button>

      {/* Body */}
      <div className="px-3 pb-2">
        {isCited && item.quote ? (
          <>
            <HighlightedQuote quote={item.quote} />
            {expanded && item.claim && content !== item.claim && (
              <div className="mt-2 text-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                <Markdown>{content}</Markdown>
              </div>
            )}
            {/* Footer with deterministic source reference */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="text-muted-foreground">Source:</span>
              {item.toolName && <ToolSourceIndicator toolName={item.toolName} />}
              {item.label && !item.toolName && (
                <span className="font-medium text-foreground/80">{item.label}</span>
              )}
              {item.toolCallId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDrawerOpen(true);
                  }}
                  className="inline-flex items-center gap-1 font-mono bg-muted hover:bg-muted dark:hover:bg-muted text-muted-foreground rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                  title="View full tool call"
                >
                  <Link2 className="h-2.5 w-2.5" />
                  {item.toolCallId}
                </button>
              )}
            </div>
          </>
        ) : evType === 'log_snippet' || evType === 'resource_state' ? (
          <pre className="text-xs text-foreground/80 font-mono whitespace-pre-wrap break-all overflow-x-auto max-h-60 overflow-y-auto bg-black/5 dark:bg-white/5 rounded p-2">
            {expanded ? content : preview}
          </pre>
        ) : (
          <div className="text-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
            <Markdown>{expanded ? content : preview}</Markdown>
          </div>
        )}
      </div>
      {item.toolCallId && incidentId && (
        <ToolCallDrawer
          incidentId={incidentId}
          toolCallId={drawerOpen ? item.toolCallId : null}
          quote={item.quote}
          claim={item.claim}
          onOpenChange={(open) => setDrawerOpen(open)}
        />
      )}
    </div>
  );
}
