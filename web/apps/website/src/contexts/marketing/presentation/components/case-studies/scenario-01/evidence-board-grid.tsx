/**
 * EvidenceBoardGrid — Scenario 01 (Stale Pricing)
 *
 * 2×2 grid of EvidenceCard components showing the four key evidence artifacts
 * gathered during the stale-pricing incident investigation.
 *
 * Mobile: 1-column stack. sm+: 2-column grid.
 * All copy comes via props (i18n-resolved strings passed from the page).
 */

import { EvidenceCard } from '@/contexts/marketing/presentation/components/case-studies/evidence-card';
import { AffectedRoutesStrip } from './affected-routes-strip';

export interface EvidenceBoardGridProps {
  labels: {
    dynamo_job_title: string;
    dynamo_cache_title: string;
    cloudwatch_title: string;
    routes_title: string;
  };
}

export function EvidenceBoardGrid({ labels }: EvidenceBoardGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Card 1 — DynamoDB revalidation job record (failed) */}
      <EvidenceCard
        title={labels.dynamo_job_title}
        tone="error"
        lines={[
          'tag:          "revalidate"',
          'path:         "/pricing"',
          'status:       "pending"',
          'retries:      3',
          'error:        "TypeError: Cannot read properties',
          '               of undefined (reading NewImage)',
          '               at handler (/var/task/index.js:23:45)"',
          'deployId:     "deploy-20260416-030158"',
          'deployVersion:"v2.4.0"',
          'timestamp:    "2026-04-16T03:02:14Z"',
        ]}
      />

      {/* Card 2 — DynamoDB cache entries (never revalidated) */}
      <EvidenceCard
        title={labels.dynamo_cache_title}
        tone="warn"
        lines={[
          '71 rows returned — all paths containing "/pricing"',
          '',
          'tag:          "{deployId}/_N_T_/[locale]/pricing/page"',
          'path:         "{deployId}/en/pricing"',
          'revalidatedAt:"1"   ← never revalidated since deploy',
          '',
          '→ No cache invalidation reached any /pricing variant.',
        ]}
      />

      {/* Card 3 — CloudWatch Seeder warning */}
      <EvidenceCard
        title={labels.cloudwatch_title}
        tone="warn"
        lines={[
          'Log group: /aws/lambda/simuser-ai-production-',
          '           WebsiteRevalidationSeederFunction',
          '',
          '{"level":"warn",',
          ' "msg":"Tag not found in revalidation table",',
          ' "tag":"pricing-page",',
          ' "pathCount":0,',
          ' "note":"No paths registered for this tag — skipping"}',
        ]}
      />

      {/* Card 4 — Affected routes pill strip */}
      <div className="overflow-hidden rounded-xl border border-red-500/40 bg-red-500/5">
        <div className="border-b border-inherit px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-red-600">
          {labels.routes_title}
        </div>
        <div className="px-4 py-4">
          <AffectedRoutesStrip />
        </div>
      </div>
    </div>
  );
}
