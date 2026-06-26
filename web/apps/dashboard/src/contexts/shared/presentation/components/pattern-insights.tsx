'use client';

import { cn } from '@causeflow/ui/lib';
import { Brain, ChevronRight, Loader2, MessageSquare, Search, Send } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from '@/i18n/navigation';

interface AskResponse {
  answer: string;
  sources: string[];
}

export function PatternInsights() {
  const [question, setQuestion] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;

    setAskLoading(true);
    setAnswer(null);
    try {
      const res = await fetch('/api/memory/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      if (res.ok) {
        const data = (await res.json()) as AskResponse;
        setAnswer(data);
      }
    } catch {
      // Silently fail
    } finally {
      setAskLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Quick Ask</h2>
        </div>
        <Link
          href="/dashboard/intelligence"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Full Intelligence
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Body */}
      <div className="p-6">
        <p className="text-sm text-muted-foreground mb-4">
          Ask CauseFlow AI about past incidents, patterns, and remediation history.
        </p>

        <form onSubmit={handleAsk} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="e.g. What caused the last API outage?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={askLoading}
              className={cn(
                'flex h-10 w-full rounded-md border border-input bg-transparent pl-9 pr-3 py-2 text-sm',
                'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
          </div>
          <button
            type="submit"
            disabled={askLoading || !question.trim()}
            className={cn(
              'inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
              'hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            {askLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>

        {/* AI Response bubble */}
        {answer && (
          <div className="mt-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="flex-1 rounded-lg rounded-tl-none border border-border bg-muted/50 p-4">
                <p className="text-sm text-foreground whitespace-pre-wrap">{answer.answer}</p>
                {answer.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground font-medium mb-1">Sources</p>
                    <ul className="space-y-0.5">
                      {answer.sources.map((src) => (
                        <li key={src} className="text-xs text-muted-foreground">
                          {src}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
