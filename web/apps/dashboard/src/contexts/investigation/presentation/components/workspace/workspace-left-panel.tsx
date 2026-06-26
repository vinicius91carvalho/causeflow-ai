'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@causeflow/ui/primitives';
import { AlertTriangle, Bot, Brain, Cloud, FileSearch, Loader2, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedItem } from '../../../domain/feed-types';
import { groupFeedItemsBySource } from '../../lib/group-feed-items';

const ICON_MAP: Record<string, typeof FileSearch> = {
  Brain,
  Cloud,
  AlertTriangle,
  Bot,
  FileSearch,
};

interface WorkspaceLeftPanelProps {
  feed: FeedItem[];
  connected: boolean;
  idle: boolean;
  sending: boolean;
  canChat: boolean;
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onSendGuidance: (message: string) => Promise<void>;
}

export function WorkspaceLeftPanel({
  feed,
  connected,
  idle,
  sending,
  canChat,
  selectedItemId,
  onSelectItem,
  onSendGuidance,
}: WorkspaceLeftPanelProps) {
  const [guidance, setGuidance] = useState('');
  const lastSeenRef = useRef<string | null>(null);
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState<string | null>(null);

  const groups = groupFeedItemsBySource(feed);

  useEffect(() => {
    if (feed.length > 0) {
      const latestTs = feed[feed.length - 1].timestamp;
      if (lastSeenRef.current === null) {
        lastSeenRef.current = latestTs;
        setLastSeenTimestamp(latestTs);
      }
    }
  }, [feed]);

  const markSeen = useCallback(() => {
    if (feed.length > 0) {
      const ts = feed[feed.length - 1].timestamp;
      lastSeenRef.current = ts;
      setLastSeenTimestamp(ts);
    }
  }, [feed]);

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

  const isNew = (item: FeedItem) => lastSeenTimestamp != null && item.timestamp > lastSeenTimestamp;

  return (
    <div className="flex flex-col h-full">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: passive mark-seen tracker */}
      <div className="flex-1 overflow-y-auto" onMouseEnter={markSeen}>
        {groups.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground p-4">
            No evidence collected yet
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={groups.map((g) => g.key)}>
            {groups.map((group) => {
              const Icon = ICON_MAP[group.iconName] ?? FileSearch;
              const newCount = group.items.filter(isNew).length;
              return (
                <AccordionItem key={group.key} value={group.key}>
                  <AccordionTrigger className="px-3 py-2 text-xs hover:no-underline">
                    <div className="flex items-center gap-2 flex-1">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{group.label}</span>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {group.items.length}
                      </span>
                      {newCount > 0 && (
                        <span className="h-2 w-2 rounded-full bg-primary/50 shrink-0" />
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-1">
                    <div className="space-y-0.5 px-1">
                      {group.items.map((item) => {
                        const itemLabel =
                          item.label ??
                          (item.evidenceType ?? item.category ?? item.type)
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (c) => c.toUpperCase());
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onSelectItem(item.id)}
                            className={`w-full text-left rounded-md px-2 py-1.5 text-xs transition-colors flex items-center gap-2 ${
                              selectedItemId === item.id
                                ? 'bg-primary/5 text-foreground'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            }`}
                          >
                            {isNew(item) && (
                              <span className="h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0" />
                            )}
                            <span className="truncate flex-1">{itemLabel}</span>
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {new Date(item.timestamp).toLocaleTimeString()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

      {canChat && (
        <div className="border-t border-border p-2">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={guidance}
              onChange={(e) => setGuidance(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={connected && !idle ? 'Guide agent...' : 'Ask question...'}
              disabled={sending}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={!guidance.trim() || sending}
              className="inline-flex items-center rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
