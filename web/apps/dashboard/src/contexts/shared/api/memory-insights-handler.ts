import { NextResponse } from 'next/server';
import { getApiClient } from '@/lib/api/get-api-client';
import { withAuth } from '@/lib/api/with-auth';

/**
 * GET /api/memory/insights
 *
 * Returns memory-based insights for the current tenant.
 * Replaces the legacy pattern-analytics endpoint.
 */
interface CoreMemoryItem {
  type?: string;
  text?: string;
}
interface CoreMemoryInsights {
  topology?: { services?: CoreMemoryItem[] };
  investigations?: { recent?: CoreMemoryItem[] };
  remediations?: { outcomes?: CoreMemoryItem[] };
  insights?: Array<{
    id: string;
    title?: string;
    summary: string;
    category?: string;
    severity?: string;
    confidence: number;
    createdAt?: string;
  }>;
}

const prefixToCategory = (prefix: string): 'topology' | 'pattern' | 'remediation' | 'anomaly' => {
  if (prefix.includes('topology')) return 'topology';
  if (prefix.includes('remediation')) return 'remediation';
  if (prefix.includes('anomaly')) return 'anomaly';
  return 'pattern';
};

export const GET = withAuth(async (_request, _ctx) => {
  const raw = (await getApiClient().getMemoryInsights()) as CoreMemoryInsights;

  // If the upstream already returns `{ insights: [...] }`, forward it with full shape.
  if (Array.isArray(raw?.insights)) {
    const insights = raw.insights.map((item, idx) => ({
      id: item.id ?? `insight-${idx}`,
      title: item.title ?? item.summary?.slice(0, 80) ?? 'Insight',
      summary: item.summary,
      category: (item.category as 'topology' | 'pattern' | 'remediation' | 'anomaly') ?? 'pattern',
      severity: (item.severity as 'info' | 'warning' | 'critical') ?? 'info',
      confidence: item.confidence ?? 1,
      createdAt: item.createdAt ?? new Date().toISOString(),
    }));
    return NextResponse.json({ insights });
  }

  // Otherwise, flatten Core's `{ topology, investigations, remediations }` shape
  // into the full Insight contract the intelligence page expects.
  const groups: Array<{ prefix: string; items: CoreMemoryItem[] | undefined }> = [
    { prefix: 'topology', items: raw?.topology?.services },
    { prefix: 'investigation', items: raw?.investigations?.recent },
    { prefix: 'remediation', items: raw?.remediations?.outcomes },
  ];
  const insights = groups.flatMap(({ prefix, items }) =>
    (items ?? [])
      .filter((m): m is CoreMemoryItem & { text: string } => typeof m?.text === 'string')
      .map((m, idx) => ({
        id: `${prefix}-${idx}`,
        title: m.text?.slice(0, 80) ?? 'Insight',
        summary: m.text,
        category: prefixToCategory(prefix),
        severity: 'info' as const,
        confidence: 1,
        createdAt:
          (m as CoreMemoryItem & { createdAt?: string }).createdAt ?? new Date().toISOString(),
      })),
  );
  return NextResponse.json({ insights });
});
