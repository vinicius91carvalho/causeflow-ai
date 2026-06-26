'use client';

import { useState } from 'react';
import type { FeedItem } from '../../../domain/feed-types';
import { WorkspaceFooter } from './workspace-footer';
import { WorkspaceLeftPanel } from './workspace-left-panel';
import { WorkspaceRightPanel } from './workspace-right-panel';

interface WorkspaceViewProps {
  feed: FeedItem[];
  connected: boolean;
  idle: boolean;
  sending: boolean;
  canChat: boolean;
  completionItem: FeedItem | null;
  onSendGuidance: (message: string) => Promise<void>;
}

export function WorkspaceView({
  feed,
  connected,
  idle,
  sending,
  canChat,
  completionItem,
  onSendGuidance,
}: WorkspaceViewProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const selectedItem = selectedItemId ? (feed.find((f) => f.id === selectedItemId) ?? null) : null;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col md:flex-row h-[calc(100vh-14rem)] min-h-[24rem]">
        <div className="w-full md:w-[280px] md:border-r border-border overflow-y-auto bg-muted/50">
          <WorkspaceLeftPanel
            feed={feed}
            connected={connected}
            idle={idle}
            sending={sending}
            canChat={canChat}
            selectedItemId={selectedItemId}
            onSelectItem={setSelectedItemId}
            onSendGuidance={onSendGuidance}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          <WorkspaceRightPanel
            feed={feed}
            selectedItem={selectedItem}
            onSelectItem={setSelectedItemId}
          />
        </div>
      </div>
      {completionItem && <WorkspaceFooter completionItem={completionItem} />}
    </div>
  );
}
