'use client';

import { Loader2, Send } from 'lucide-react';
import type React from 'react';
import { useCallback, useState } from 'react';
import Markdown from 'react-markdown';
import type { FeedItem } from '../../domain/feed-types';
import { PROGRESS_ICONS } from '../lib/feed-constants';
import { CapabilitiesCard } from './feed-cards/capabilities-card';
import { CompletionCard } from './feed-cards/completion-card';
import { EvidenceCard } from './feed-cards/evidence-card';
import { PhaseDivider } from './feed-cards/phase-divider';
import { QuestionCard } from './feed-cards/question-card';
import { ToolCallCard } from './feed-cards/tool-call-card';
import { ToolCallGroup } from './feed-cards/tool-call-group';
import { ToolErrorCard } from './feed-cards/tool-error-card';

interface LiveFeedViewProps {
  feed: FeedItem[];
  connected: boolean;
  idle: boolean;
  sending: boolean;
  canChat: boolean;
  isInProgress?: boolean;
  feedContainerRef: React.RefObject<HTMLDivElement | null>;
  onSendGuidance: (message: string) => Promise<void>;
  onSendAnswer: (questionId: string, answer: string) => void;
}

export function LiveFeedView({
  feed,
  connected,
  idle,
  sending,
  canChat,
  isInProgress,
  feedContainerRef,
  onSendGuidance,
  onSendAnswer,
}: LiveFeedViewProps) {
  const [guidance, setGuidance] = useState('');

  const handleSend = useCallback(async () => {
    if (!guidance.trim()) return;
    const msg = guidance.trim();
    setGuidance('');
    await onSendGuidance(msg);
  }, [guidance, onSendGuidance]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  function renderFeedItems() {
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < feed.length) {
      const item = feed[i]!;
      const isLastItem = i === feed.length - 1;

      if (item.type === 'tool_call') {
        const group: FeedItem[] = [item];
        let j = i + 1;
        while (j < feed.length && feed[j]!.type === 'tool_call') {
          group.push(feed[j]!);
          j++;
        }
        const nonMemoryGroup = group.filter(
          (g) => g.toolName !== 'recall_past_incidents' && g.toolName !== 'reflect_on_knowledge',
        );
        const memoryTools = group.filter(
          (g) => g.toolName === 'recall_past_incidents' || g.toolName === 'reflect_on_knowledge',
        );

        for (const mt of memoryTools) {
          elements.push(
            <div key={mt.id}>
              <ToolCallCard item={mt} />
            </div>,
          );
        }
        if (nonMemoryGroup.length > 0) {
          elements.push(
            <div key={`group-${nonMemoryGroup[0]!.id}`}>
              <ToolCallGroup items={nonMemoryGroup} />
            </div>,
          );
        }
        i = j;
        continue;
      }

      if (item.type === 'phase') {
        elements.push(
          <PhaseDivider key={item.id} label={item.message} timestamp={item.timestamp} />,
        );
        i++;
        continue;
      }

      if (item.type === 'capabilities') {
        elements.push(
          <div key={item.id}>
            <CapabilitiesCard item={item} />
          </div>,
        );
        i++;
        continue;
      }

      if (item.type === 'tool_error') {
        elements.push(
          <div key={item.id}>
            <ToolErrorCard item={item} />
          </div>,
        );
        i++;
        continue;
      }

      elements.push(
        <div key={item.id}>
          {item.type === 'question' ? (
            <QuestionCard item={item} onAnswer={onSendAnswer} connected={connected} />
          ) : item.type === 'complete' && item.completion ? (
            <CompletionCard item={item} />
          ) : item.type === 'checkpoint' && item.category ? (
            <div
              className={`rounded-lg px-3 py-2 text-sm border ${
                item.severity === 'critical'
                  ? 'bg-destructive/10 border-destructive/40 /30 '
                  : item.severity === 'warning'
                    ? 'bg-warning/10 border-warning/40 /30 '
                    : 'bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:border-sky-800'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    item.severity === 'critical'
                      ? 'bg-destructive/10 text-destructive /50 '
                      : item.severity === 'warning'
                        ? 'bg-warning/10 text-warning /50 '
                        : 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300'
                  }`}
                >
                  {item.severity ?? 'info'}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">
                  {(item.category ?? '')
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="text-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0">
                <Markdown>{item.message}</Markdown>
              </div>
            </div>
          ) : item.type === 'evidence' ? (
            <EvidenceCard item={item} />
          ) : (
            <div
              data-testid={
                item.type === 'followup'
                  ? 'incident-chat-assistant'
                  : item.type === 'guidance'
                    ? 'incident-chat-user'
                    : undefined
              }
              className={`rounded-lg px-3 py-2 text-sm ${
                item.type === 'guidance'
                  ? 'bg-primary/10 border border-primary/40 /30 ml-8'
                  : item.type === 'followup'
                    ? 'bg-primary/10 border border-primary/40 /30 '
                    : item.type === 'error'
                      ? 'bg-destructive/10 border border-destructive/40 /30 '
                      : item.type === 'complete'
                        ? 'bg-success/10 border border-success/40 /30 '
                        : item.type === 'idle'
                          ? 'bg-muted border border-border /30 '
                          : 'bg-muted/50 border border-border'
              }`}
            >
              <div className="flex items-start gap-2">
                {item.type === 'progress' &&
                  (() => {
                    const stage = item.message.toLowerCase();
                    const IconComponent =
                      Object.entries(PROGRESS_ICONS).find(
                        ([key]) => stage.includes(key) || item.id.includes(key),
                      )?.[1] ?? Loader2;
                    return (
                      <IconComponent
                        className={`h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0 ${isLastItem ? (IconComponent === Loader2 ? 'animate-spin' : 'animate-pulse') : ''}`}
                      />
                    );
                  })()}
                <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
                <div className="flex-1">
                  {item.type === 'guidance' && (
                    <span className="text-xs font-medium text-primary">You: </span>
                  )}
                  {item.type === 'followup' && (
                    <span className="text-xs font-medium text-primary">Agent: </span>
                  )}
                  {item.type === 'idle' && (
                    <span className="text-xs font-medium text-muted-foreground">
                      Agent available for follow-up{' '}
                    </span>
                  )}
                  <div className="text-foreground prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2 prose-headings:text-sm">
                    <Markdown>{item.message}</Markdown>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>,
      );
      i++;
    }

    return elements;
  }

  return (
    <>
      {/* Feed container: flexes to fill the parent section. `min-h-0` is the
          canonical unlock that lets the inner content overflow-y-auto instead
          of pushing the parent flex to grow. The parent `<section>` owns the
          bounded height via `h-full` under `incident-detail.tsx`'s fixed
          `sm:h-[calc(100dvh-10rem)]` wrapper. */}
      <div ref={feedContainerRef} className="h-full min-h-0 flex-1 overflow-y-auto p-4 space-y-2">
        {feed.length === 0 && isInProgress && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Waiting for agent activity...
          </div>
        )}
        {renderFeedItems()}
      </div>

      {canChat && (
        <div data-testid="incident-chat-panel" className="shrink-0 border-t border-border p-3">
          <div className="flex gap-2">
            <input
              type="text"
              data-testid="incident-chat-input"
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                connected && !idle ? 'Send guidance to the agent...' : 'Ask a follow-up question...'
              }
              disabled={sending}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
            />
            <button
              type="button"
              data-testid="incident-chat-send"
              onClick={() => void handleSend()}
              disabled={!guidance.trim() || sending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
