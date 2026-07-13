'use client';

import { BarChart2, Plug, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { selectEmptyStateBranch } from '../lib/empty-state-branch';
import { BranchAEmptyState } from './branch-a-empty-state';
import { BranchBEmptyState } from './branch-b-empty-state';
import { MetricsCard } from './metrics-card';
import { NetworkAnimation } from './network-animation';

// ─── Message types ─────────────────────────────────────────────────────────

interface DashboardOverviewMessages {
  metrics: {
    totalAnalyses: string;
    activeIntegrations: string;
    teamMembers: string;
  };
  emptyState: {
    branchA: {
      title: string;
      subtitle: string;
      connectIntegration: string;
      setUpRelay: string;
      feature1: string;
      feature2: string;
      feature3: string;
    };
    branchB: {
      title: string;
      subtitle: string;
      createFirstAnalysis: string;
      feature1: string;
      feature2: string;
      feature3: string;
    };
  };
  newAnalysis: string;
}

interface DashboardOverviewProps {
  messages: DashboardOverviewMessages;
}

// ─── Metrics & integrations data shape ────────────────────────────────────

interface MetricsData {
  totalAnalyses: number;
  activeIntegrations: number;
  teamMembers: number;
}

// ─── Main component ────────────────────────────────────────────────────────

export function DashboardOverview({ messages }: DashboardOverviewProps) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [integrationCount, setIntegrationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchData() {
      try {
        const [metricsRes, integrationsRes] = await Promise.all([
          fetch('/api/metrics', { signal: controller.signal }),
          fetch('/api/integrations', { signal: controller.signal }),
        ]);

        if (metricsRes.ok) {
          const json = (await metricsRes.json()) as { metrics: MetricsData };
          setMetrics(json.metrics);
        }

        if (integrationsRes.ok) {
          // /api/integrations returns { integrations: [...] }; tolerate raw arrays for back-compat.
          const json = (await integrationsRes.json()) as { integrations?: unknown[] } | unknown[];
          const list = Array.isArray(json)
            ? json
            : Array.isArray(json.integrations)
              ? json.integrations
              : [];
          // Only count integrations that are actually usable. Entries with status
          // 'disconnected', 'inactive', or 'error' should not inflate the count
          // shown on the dashboard — users expect this to match what the
          // integrations page renders as "connected".
          const connected = list.filter((entry) => {
            if (!entry || typeof entry !== 'object') return false;
            const status = (entry as { status?: string }).status;
            if (typeof status !== 'string') return true;
            return status === 'connected' || status === 'active';
          });
          setIntegrationCount(connected.length);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        // Fail silently — individual sections handle their own errors
      } finally {
        setLoading(false);
      }
    }

    void fetchData();
    return () => controller.abort();
  }, []);

  // Derive branch inputs — conservative: treat loading as false for both
  const hasAnalyses = !loading && (metrics?.totalAnalyses ?? 0) > 0;
  const hasIntegrations = !loading && integrationCount > 0;

  const branch = loading ? null : selectEmptyStateBranch({ hasAnalyses, hasIntegrations });

  return (
    <div className="space-y-6" data-testid="dashboard-overview">
      <NetworkAnimation />
      {/* ── Branch A: nothing connected ─────────────────────────── */}
      {branch === 'A' && <BranchAEmptyState messages={messages.emptyState.branchA} />}

      {/* ── Branch B: integrations connected, no analyses ────────── */}
      {branch === 'B' && <BranchBEmptyState messages={messages.emptyState.branchB} />}

      {/* ── Branch C: active user with analyses ──────────────────── */}
      {branch === 'C' && (
        <>
          {/* New Analysis CTA */}
          <div className="flex justify-end">
            <Link
              href="/dashboard/analyses/new"
              data-testid="cta-new-analysis"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all duration-200 hover:opacity-90 hover:scale-105 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {messages.newAnalysis}
            </Link>
          </div>

          {/* Metrics strip — 3 cards (monthly analyses removed) */}
          <section aria-label="Key metrics">
            <div className="grid gap-4 sm:grid-cols-3">
              <div data-testid="metric-total-analyses">
                <MetricsCard
                  label={messages.metrics.totalAnalyses}
                  value={loading ? '—' : (metrics?.totalAnalyses ?? 0)}
                  icon={BarChart2}
                  loading={loading}
                />
              </div>
              <MetricsCard
                label={messages.metrics.activeIntegrations}
                value={loading ? '—' : (metrics?.activeIntegrations ?? 0)}
                icon={Plug}
                loading={loading}
              />
              <MetricsCard
                label={messages.metrics.teamMembers}
                value={loading ? '—' : (metrics?.teamMembers ?? 0)}
                icon={Users}
                loading={loading}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
