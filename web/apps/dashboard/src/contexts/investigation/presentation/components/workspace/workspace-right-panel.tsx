'use client';

import { FileSearch } from 'lucide-react';
import { useEffect } from 'react';
import Markdown from 'react-markdown';
import type { FeedItem } from '../../../domain/feed-types';
import {
  AGENT_ROLE_DISPLAY,
  DEFAULT_EVIDENCE_STYLE,
  EVIDENCE_STYLES,
  formatMemoryContent,
  SEVERITY_STYLES,
} from '../../lib/feed-constants';

interface WorkspaceRightPanelProps {
  feed: FeedItem[];
  selectedItem: FeedItem | null;
  onSelectItem: (id: string) => void;
}

export function WorkspaceRightPanel({
  feed,
  selectedItem,
  onSelectItem,
}: WorkspaceRightPanelProps) {
  // Auto-select most recent evidence item when nothing is selected
  useEffect(() => {
    if (selectedItem) return;
    const evidenceItems = feed.filter(
      (f) => f.type === 'evidence' || (f.type === 'checkpoint' && f.category != null),
    );
    if (evidenceItems.length > 0) {
      onSelectItem(evidenceItems[evidenceItems.length - 1]!.id);
    }
  }, [feed, selectedItem, onSelectItem]);

  if (!selectedItem) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-4">
        <FileSearch className="h-8 w-8" />
        <span className="text-sm">Select an item to view details</span>
      </div>
    );
  }

  const evType = selectedItem.evidenceType;
  const style = evType
    ? (EVIDENCE_STYLES[evType] ?? DEFAULT_EVIDENCE_STYLE)
    : DEFAULT_EVIDENCE_STYLE;
  const roleInfo = selectedItem.agentRole ? AGENT_ROLE_DISPLAY[selectedItem.agentRole] : undefined;
  const label =
    selectedItem.label ??
    (selectedItem.evidenceType ?? selectedItem.category ?? selectedItem.type)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const isFinding = selectedItem.type === 'checkpoint' && selectedItem.category != null;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {roleInfo && (
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${roleInfo.color}`}>
            {roleInfo.label}
          </span>
        )}
        {evType && (
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${style.badge}`}>
            {evType === 'historical_context' ? 'memory' : evType.replace(/_/g, ' ')}
          </span>
        )}
        {isFinding && selectedItem.severity && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${SEVERITY_STYLES[selectedItem.severity] ?? ''}`}
          >
            {selectedItem.severity}
          </span>
        )}
        {isFinding && selectedItem.category && (
          <span className="text-[10px] text-muted-foreground font-medium">
            {selectedItem.category.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground ml-auto">
          {new Date(selectedItem.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <div className="border-t border-border pt-3">{renderContent(selectedItem)}</div>
    </div>
  );
}

function renderContent(item: FeedItem) {
  const evType = item.evidenceType;

  if (evType === 'log_snippet' || evType === 'resource_state') {
    return (
      <pre className="text-xs text-foreground/80 font-mono whitespace-pre-wrap break-all overflow-x-auto overflow-y-auto bg-black/5 dark:bg-white/5 rounded p-3">
        {item.message}
      </pre>
    );
  }

  if (evType === 'historical_context') {
    const content = formatMemoryContent(item.message);
    return (
      <div className="text-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
        <Markdown>{content}</Markdown>
      </div>
    );
  }

  if (evType === 'agent_reasoning') {
    return (
      <div className="text-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
        <Markdown>{item.message}</Markdown>
      </div>
    );
  }

  // Findings (checkpoint with category)
  if (item.type === 'checkpoint' && item.category != null) {
    return (
      <div className="text-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
        <Markdown>{item.message}</Markdown>
      </div>
    );
  }

  // Default
  return (
    <div className="text-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
      <Markdown>{item.message}</Markdown>
    </div>
  );
}
