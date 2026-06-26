'use client';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@causeflow/ui/primitives';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ToolCallDetail } from '@/lib/api/core-api-types';

interface ToolCallDrawerProps {
  incidentId: string;
  toolCallId: string | null;
  /** Optional quote to highlight inside the tool output. */
  quote?: string;
  /** Optional claim to display above the output for context. */
  claim?: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * Drill-down drawer that fetches the full raw input/output of a tool call
 * and highlights the cited quote inline. The <mark> is rendered by literal
 * substring split — matching the deterministic validator on the backend.
 */
export function ToolCallDrawer({
  incidentId,
  toolCallId,
  quote,
  claim,
  onOpenChange,
}: ToolCallDrawerProps) {
  const open = Boolean(toolCallId);
  const [detail, setDetail] = useState<ToolCallDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toolCallId) {
      setDetail(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetch(
      `/api/investigation/${encodeURIComponent(incidentId)}/tool-calls/${encodeURIComponent(toolCallId)}`,
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as ToolCallDetail;
      })
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [incidentId, toolCallId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-mono text-sm">
            {toolCallId}
            {detail && (
              <span className="text-xs font-sans font-normal text-muted-foreground">
                {detail.name}
              </span>
            )}
          </SheetTitle>
          <SheetDescription>
            Raw tool call captured during the investigation. The quoted substring below is the
            literal evidence cited by the agent.
          </SheetDescription>
        </SheetHeader>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading tool call…
          </div>
        )}

        {error && !loading && (
          <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 /30 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {detail && !loading && (
          <div className="mt-6 space-y-5">
            {claim && (
              <section>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Claim
                </h4>
                <p className="text-sm text-foreground">{claim}</p>
              </section>
            )}

            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Input
              </h4>
              <pre className="text-xs font-mono bg-black/5 dark:bg-white/5 rounded p-3 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
                {JSON.stringify(detail.input, null, 2)}
              </pre>
            </section>

            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-2">
                Output
                {quote && (
                  <span className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-success/10 text-success /60 normal-case tracking-normal">
                    quote highlighted
                  </span>
                )}
              </h4>
              <OutputWithHighlight output={detail.output} quote={quote} />
            </section>

            <section className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground pt-2 border-t">
              <div>
                <span className="font-semibold">Origin:</span> {detail.origin}
              </div>
              <div>
                <span className="font-semibold">Agent:</span> {detail.agentRole}
              </div>
              <div>
                <span className="font-semibold">Status:</span>{' '}
                {detail.success ? 'success' : 'error'}
              </div>
              <div>
                <span className="font-semibold">At:</span>{' '}
                {new Date(detail.createdAt).toLocaleString()}
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * Renders `output`, wrapping every occurrence of `quote` with a <mark>.
 * Uses literal substring split (deterministic, byte-for-byte) — same
 * rule the backend validator uses, so highlight is guaranteed consistent.
 */
function OutputWithHighlight({ output, quote }: { output: string; quote?: string }) {
  if (!quote || !output.includes(quote)) {
    return (
      <pre className="text-xs font-mono bg-black/5 dark:bg-white/5 rounded p-3 whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
        {output}
      </pre>
    );
  }
  const parts = output.split(quote);
  return (
    <pre className="text-xs font-mono bg-black/5 dark:bg-white/5 rounded p-3 whitespace-pre-wrap break-all max-h-96 overflow-y-auto">
      {parts.map((part, i) => (
        // eslint-disable-next-line react/no-array-index-key
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <mark className="bg-warning/15 /60 text-foreground px-0.5 rounded-sm">{quote}</mark>
          )}
        </span>
      ))}
    </pre>
  );
}
