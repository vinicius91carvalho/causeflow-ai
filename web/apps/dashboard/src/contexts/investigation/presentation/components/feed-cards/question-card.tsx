'use client';

import { Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import type { FeedItem } from '../../../domain/feed-types';

export function QuestionCard({
  item,
  onAnswer,
  connected,
}: {
  item: FeedItem;
  onAnswer: (questionId: string, answer: string) => void;
  connected: boolean;
}) {
  const [remaining, setRemaining] = useState(Math.ceil((item.timeoutMs ?? 60000) / 1000));
  const [customAnswer, setCustomAnswer] = useState('');

  useEffect(() => {
    if (item.answered || !connected) return;
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [item.answered, connected]);

  const progress = (remaining / Math.ceil((item.timeoutMs ?? 60000) / 1000)) * 100;

  return (
    <div className="rounded-lg border-2 border-warning/40 bg-warning/10 /30 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
          {new Date(item.timestamp).toLocaleTimeString()}
        </span>
        <div className="flex-1">
          <span className="text-xs font-semibold text-warning">Agent asks:</span>
          <div className="text-sm text-foreground mt-1 prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2 prose-headings:text-sm">
            <Markdown>{item.message}</Markdown>
          </div>
        </div>
      </div>

      {!item.answered && connected && remaining > 0 ? (
        <>
          {item.options && item.options.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pl-[4.5rem]">
              {item.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onAnswer(item.questionId!, opt)}
                  className="rounded-md border border-warning/40 bg-white px-3 py-1 text-xs font-medium text-warning hover:bg-warning/10 dark:hover:bg-warning/80 transition-colors"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-1.5 pl-[4.5rem]">
            <input
              type="text"
              value={customAnswer}
              onChange={(e) => setCustomAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customAnswer.trim()) {
                  onAnswer(item.questionId!, customAnswer.trim());
                  setCustomAnswer('');
                }
              }}
              placeholder="Type a custom answer..."
              className="flex-1 rounded-md border border-warning/40 bg-white px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <button
              type="button"
              onClick={() => {
                if (customAnswer.trim()) {
                  onAnswer(item.questionId!, customAnswer.trim());
                  setCustomAnswer('');
                }
              }}
              disabled={!customAnswer.trim()}
              className="rounded-md bg-warning/80 px-2 py-1 text-xs font-medium text-white hover:bg-warning/80 disabled:opacity-40 transition-colors"
            >
              <Send className="h-3 w-3" />
            </button>
          </div>

          <div className="pl-[4.5rem]">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1 rounded-full bg-warning/15 overflow-hidden">
                <div
                  className="h-full bg-warning/50 transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] text-warning tabular-nums">{remaining}s</span>
            </div>
          </div>
        </>
      ) : (
        <div className="pl-[4.5rem]">
          <span className="text-[10px] text-muted-foreground">
            {item.answered
              ? 'Answered'
              : remaining === 0
                ? 'Timed out — agent proceeded with default'
                : 'Disconnected'}
          </span>
        </div>
      )}
    </div>
  );
}
