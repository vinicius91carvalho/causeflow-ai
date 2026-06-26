'use client';

import { Bot, MessageCircle, WifiOff, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { InvestigationLiveFeedProps } from '../../domain/feed-types';
import { useInvestigationFeed } from '../hooks/use-investigation-feed';
import { LiveFeedView } from './live-feed-view';
import { WorkspaceView } from './workspace/workspace-view';

export function InvestigationLiveFeed({
  incidentId,
  isInProgress,
  onStatusChange,
  onConnectionChange,
  onHypothesisProgress,
}: InvestigationLiveFeedProps) {
  const [viewMode, setViewMode] = useState<'feed' | 'workspace'>(() => {
    if (typeof window === 'undefined') return 'feed';
    return (localStorage.getItem('causeflow:feed-view-mode') as 'feed' | 'workspace') ?? 'feed';
  });

  const feedState = useInvestigationFeed({
    incidentId,
    isInProgress,
    onStatusChange,
    onConnectionChange,
    onHypothesisProgress,
  });

  useEffect(() => {
    localStorage.setItem('causeflow:feed-view-mode', viewMode);
  }, [viewMode]);

  return (
    // `h-full` + `flex flex-col` + `overflow-hidden` cooperate with the parent
    // `flex-1 min-h-0` wrapper so the feed container can own its own scroll
    // without pushing the viewport. The toolbar and feed/workspace body split
    // the section into a fixed header row + a flex-1 body.
    <section className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-muted/50 px-4 py-3">
        {feedState.connected ? (
          feedState.idle ? (
            <Bot className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Zap className="h-4 w-4 text-success" />
          )
        ) : !isInProgress ? (
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
        ) : (
          <WifiOff className="h-4 w-4 text-muted-foreground" />
        )}

        <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('feed')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === 'feed'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Live Feed
          </button>
          <button
            type="button"
            onClick={() => setViewMode('workspace')}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === 'workspace'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Workspace
          </button>
        </div>

        {feedState.connected ? (
          <span
            className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              feedState.idle
                ? 'border border-border bg-muted text-muted-foreground /50 '
                : 'border border-success/40 bg-success/10 text-success /50 '
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${feedState.idle ? 'bg-muted' : 'bg-success/50 animate-pulse'}`}
            />
            {feedState.idle ? 'Agent available' : 'Live'}
          </span>
        ) : !isInProgress ? (
          <span className="ml-auto text-xs text-muted-foreground">
            Ask questions about this investigation
          </span>
        ) : null}
      </div>

      {viewMode === 'feed' ? (
        <LiveFeedView
          feed={feedState.feed}
          connected={feedState.connected}
          idle={feedState.idle}
          sending={feedState.sending}
          canChat={feedState.canChat}
          isInProgress={isInProgress}
          feedContainerRef={feedState.feedContainerRef}
          onSendGuidance={feedState.sendGuidance}
          onSendAnswer={feedState.sendAnswer}
        />
      ) : (
        <WorkspaceView
          feed={feedState.feed}
          connected={feedState.connected}
          idle={feedState.idle}
          sending={feedState.sending}
          canChat={feedState.canChat}
          completionItem={feedState.completionItem}
          onSendGuidance={feedState.sendGuidance}
        />
      )}
    </section>
  );
}
