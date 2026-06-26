'use client';

import { cn } from '@causeflow/ui/lib';
import { CheckCircle2, Copy, Loader2, Radio, RefreshCw, Terminal, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RelayAgent {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'stale';
  lastHeartbeat: string;
  version: string;
  region?: string;
}

interface RelayStatusData {
  connected: boolean;
  agents: RelayAgent[];
  relayUrl: string;
}

/* ------------------------------------------------------------------ */
/*  Status indicator                                                   */
/* ------------------------------------------------------------------ */

function StatusDot({ status }: { status: RelayAgent['status'] }) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full',
        status === 'connected' && 'bg-success/50 animate-pulse',
        status === 'disconnected' && 'bg-destructive/50',
        status === 'stale' && 'bg-warning/50',
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Install instructions                                               */
/* ------------------------------------------------------------------ */

const INSTALL_COMMAND = 'npx @causeflow/relay@latest init';

function InstallInstructions() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(INSTALL_COMMAND);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Terminal className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Install Relay Agent</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        The CauseFlow Relay agent runs in your infrastructure to securely forward events and enable
        real-time communication with the CauseFlow platform.
      </p>

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">1. Install and initialize</h3>
          <div className="relative">
            <pre className="rounded-lg bg-muted/80 border border-border p-3 pr-12 text-sm font-mono text-foreground overflow-x-auto">
              {INSTALL_COMMAND}
            </pre>
            <button
              type="button"
              onClick={handleCopy}
              className="absolute right-2 top-2 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Copy command"
            >
              {copied ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">2. Configure</h3>
          <p className="text-sm text-muted-foreground">
            Follow the prompts to enter your API key and configure which services to monitor.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">3. Run</h3>
          <pre className="rounded-lg bg-muted/80 border border-border p-3 text-sm font-mono text-foreground overflow-x-auto">
            npx @causeflow/relay start
          </pre>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function RelayStatus() {
  const [data, setData] = useState<RelayStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch('/api/relay/status');
      if (res.ok) {
        const raw = (await res.json()) as Partial<RelayStatusData> & {
          resources?: unknown[];
        };
        // The Core API currently returns `{ connected, resources }`. Normalize
        // any missing fields so the UI never encounters undefined arrays.
        setData({
          connected: Boolean(raw.connected),
          agents: Array.isArray(raw.agents) ? raw.agents : [],
          relayUrl: typeof raw.relayUrl === 'string' ? raw.relayUrl : '',
        });
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  function handleRefresh() {
    void fetchStatus(true);
  }

  const connectedCount = data?.agents.filter((a) => a.status === 'connected').length ?? 0;

  return (
    <div className="space-y-6">
      {/* Connection overview */}
      <section aria-label="Relay connection status">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Radio className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Connection Status</h2>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium',
                'text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
                'disabled:opacity-50 disabled:pointer-events-none',
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Unable to fetch relay status. Please try again.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Overall status */}
              <div className="flex items-center gap-3 rounded-lg border border-border p-4">
                {data.connected ? (
                  <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive shrink-0" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {data.connected ? 'Relay Connected' : 'No Relay Connection'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {connectedCount} agent{connectedCount !== 1 ? 's' : ''} connected
                  </p>
                </div>
              </div>

              {/* Agent table */}
              {data.agents.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left font-medium text-muted-foreground py-2 pr-4">
                          Status
                        </th>
                        <th className="text-left font-medium text-muted-foreground py-2 pr-4">
                          Agent
                        </th>
                        <th className="text-left font-medium text-muted-foreground py-2 pr-4">
                          Version
                        </th>
                        <th className="text-left font-medium text-muted-foreground py-2 pr-4">
                          Region
                        </th>
                        <th className="text-left font-medium text-muted-foreground py-2">
                          Last Heartbeat
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.agents.map((agent) => (
                        <tr key={agent.id}>
                          <td className="py-2.5 pr-4">
                            <StatusDot status={agent.status} />
                          </td>
                          <td className="py-2.5 pr-4 font-medium text-foreground">{agent.name}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground">{agent.version}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            {agent.region ?? '--'}
                          </td>
                          <td className="py-2.5 text-muted-foreground">
                            {new Date(agent.lastHeartbeat).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Install instructions */}
      <InstallInstructions />
    </div>
  );
}
