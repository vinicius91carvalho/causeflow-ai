'use client';

import { cn } from '@causeflow/ui/lib';
import {
  Brain,
  ChevronRight,
  Loader2,
  MessageSquare,
  Network,
  RefreshCw,
  Search,
  Send,
  TrendingUp,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Insight {
  id: string;
  title: string;
  summary: string;
  category: 'pattern' | 'topology' | 'remediation' | 'anomaly';
  severity: 'info' | 'warning' | 'critical';
  createdAt: string;
}

interface MemorySummary {
  totalIncidents: number;
  totalServices: number;
  recurringPatterns: number;
  avgResolutionMinutes: number;
  topServices: { name: string; incidentCount: number }[];
  recentInvestigations: {
    id: string;
    title: string;
    status: string;
    createdAt: string;
  }[];
}

interface AskResponse {
  answer: string;
  status: 'completed' | 'processing';
  intent?: string;
  chatId?: string;
  incidentUrl?: string;
}

/* ------------------------------------------------------------------ */
/*  Severity badge                                                     */
/* ------------------------------------------------------------------ */

function SeverityBadge({ severity }: { severity: Insight['severity'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        severity === 'info' && 'bg-primary/10 text-primary /30',
        severity === 'warning' && 'bg-warning/10 text-warning /30',
        severity === 'critical' && 'bg-destructive/10 text-destructive /30',
      )}
    >
      {severity}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Category icon                                                      */
/* ------------------------------------------------------------------ */

function CategoryIcon({ category }: { category: Insight['category'] }) {
  const icons = {
    pattern: TrendingUp,
    topology: Network,
    remediation: RefreshCw,
    anomaly: Brain,
  } as const;
  const Icon = icons[category] ?? Brain;
  return <Icon className="h-4 w-4 text-muted-foreground" />;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function IntelligencePage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [summary, setSummary] = useState<MemorySummary | null>(null);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Ask CauseFlow AI
  const [question, setQuestion] = useState('');
  const [askLoading, setAskLoading] = useState(false);
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* Fetch data */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [insightsRes, summaryRes] = await Promise.all([
        fetch('/api/memory/insights'),
        fetch('/api/memory/summary'),
      ]);
      if (insightsRes.ok) {
        const data = await insightsRes.json();
        if (Array.isArray(data?.insights)) {
          setInsights(data.insights);
        }
      }
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        if (data && typeof data.totalIncidents === 'number') {
          setSummary(data as MemorySummary);
        } else if (data && typeof data.summary === 'string') {
          setSummaryText(data.summary);
        }
      }
    } catch {
      // Silently fail — cards will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Poll SSE for live_check results
  function pollForChatResult(chatId: string) {
    const es = new EventSource('/api/notifications/stream');
    const timeout = setTimeout(() => {
      es.close();
      setAnswer((prev) =>
        prev?.chatId === chatId
          ? {
              ...prev,
              answer:
                'Live check is taking longer than expected. The result will be saved for future queries.',
              status: 'completed',
            }
          : prev,
      );
    }, 60_000); // 60s timeout

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Check for chat.response event matching our chatId
        if (data.type === 'chat.response' && data.data?.chatId === chatId) {
          setAnswer({
            answer: data.data.answer ?? 'No results found.',
            status: data.data.status === 'error' ? 'completed' : 'completed',
          });
          es.close();
          clearTimeout(timeout);
        }
        // Also check direct format from SSE
        if (data.chatId === chatId && (data.status === 'completed' || data.status === 'error')) {
          setAnswer({
            answer: data.answer ?? 'No results found.',
            status: 'completed',
          });
          es.close();
          clearTimeout(timeout);
        }
      } catch {
        // Ignore non-JSON
      }
    };

    es.onerror = () => {
      // SSE connection failed — fall back to timeout message
    };
  }

  /* Ask */
  async function handleAsk(e: { preventDefault(): void }) {
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
        const data = await res.json();
        // Backend returns ChatOutput — map to AskResponse
        if (data.status === 'completed' && data.answer) {
          setAnswer({ answer: data.answer, status: 'completed' });
        } else if (data.status === 'processing') {
          // Show processing state immediately
          setAnswer({
            answer: 'Investigating your infrastructure in real-time...',
            status: 'processing',
            chatId: data.chatId,
            intent: data.intent,
          });
          // Poll for result via SSE proxy
          pollForChatResult(data.chatId);
        } else if (data.incidentUrl) {
          setAnswer({
            answer: `Investigation created. Track it here: ${data.incidentUrl}`,
            status: 'completed',
            incidentUrl: data.incidentUrl,
          });
        }
      }
    } catch {
      // Silently fail
    } finally {
      setAskLoading(false);
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <section aria-label="Memory summary">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'Total Incidents',
              value: summary?.totalIncidents ?? 0,
              icon: Brain,
            },
            {
              label: 'Services Tracked',
              value: summary?.totalServices ?? 0,
              icon: Network,
            },
            {
              label: 'Recurring Patterns',
              value: summary?.recurringPatterns ?? 0,
              icon: TrendingUp,
            },
            {
              label: 'Avg Resolution',
              value: summary ? `${summary.avgResolutionMinutes}m` : '--',
              icon: RefreshCw,
            },
          ].map((card) => (
            <div key={card.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-2xl font-bold text-foreground">
                {loading ? (
                  <span className="inline-block h-7 w-16 animate-pulse rounded bg-muted" />
                ) : (
                  card.value
                )}
              </p>
            </div>
          ))}
        </div>

        {/* AI-generated summary text (shown when no structured data yet) */}
        {!loading && !summary && summaryText && (
          <div className="mt-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <Brain className="h-5 w-5 mt-0.5 shrink-0 text-primary" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">AI Summary</p>
                <div className="prose prose-sm prose-slate dark:prose-invert max-w-none text-muted-foreground leading-relaxed [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:text-foreground [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:text-sm [&_p]:mb-2 [&_ul]:text-sm [&_ol]:text-sm [&_li]:text-sm [&_strong]:text-foreground [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
                  <ReactMarkdown>{summaryText}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Ask CauseFlow AI */}
      <section aria-label="Ask CauseFlow AI">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Ask CauseFlow AI</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Ask questions about past incidents, service topology, and remediation patterns.
          </p>
          <form onSubmit={handleAsk} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                placeholder="e.g. What caused the last API gateway outage?"
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

          {answer && (
            <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
              {answer.status === 'processing' && (
                <div className="flex items-center gap-2 mb-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs font-medium text-primary">
                    Live investigation in progress...
                  </span>
                </div>
              )}
              <div className="prose prose-sm prose-slate dark:prose-invert max-w-none text-foreground [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:text-sm [&_p]:mb-2 [&_ul]:text-sm [&_ol]:text-sm [&_li]:text-sm [&_strong]:text-foreground [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded">
                <ReactMarkdown>{answer.answer}</ReactMarkdown>
              </div>
              {answer.incidentUrl && (
                <a
                  href={answer.incidentUrl}
                  className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Investigation →
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Service topology — top services */}
      {(summary?.topServices?.length ?? 0) > 0 && (
        <section aria-label="Service topology">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Network className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Service Topology</h2>
            </div>
            <div className="space-y-3">
              {summary?.topServices.map((svc) => (
                <div key={svc.name} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{svc.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(
                            100,
                            (svc.incidentCount / (summary?.topServices[0]?.incidentCount || 1)) *
                              100,
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {svc.incidentCount}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Insights list */}
      <section aria-label="Memory insights">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Recurring Patterns</h2>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : insights.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No insights yet. Insights will appear as CauseFlow analyzes more incidents.
            </p>
          ) : (
            <div className="space-y-3">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className="flex items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                >
                  <CategoryIcon category={insight.category} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground truncate">
                        {insight.title}
                      </span>
                      <SeverityBadge severity={insight.severity} />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{insight.summary}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Recent investigations */}
      {summary && summary.recentInvestigations?.length > 0 && (
        <section aria-label="Recent investigations">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Search className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Recent Investigations</h2>
            </div>
            <div className="divide-y divide-border">
              {summary?.recentInvestigations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{inv.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                      inv.status === 'resolved'
                        ? 'bg-success/10 text-success /30'
                        : 'bg-warning/10 text-warning /30',
                    )}
                  >
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
