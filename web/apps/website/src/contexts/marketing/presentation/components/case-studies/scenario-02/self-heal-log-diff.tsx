/**
 * SelfHealLogDiff — before/after CloudWatch log side-by-side using EvidenceCard.
 *
 * "During incident" panel shows INIT_START cold-start lines + 504 error.
 * "After warm-up" panel shows clean 200 response with no INIT_START.
 *
 * All titles and log line content come from props (i18n-resolved by the page).
 */

import { EvidenceCard } from '@/contexts/marketing/presentation/components/case-studies/evidence-card';

export interface SelfHealLogDiffProps {
  sectionTitle: string;
  beforeTitle: string;
  afterTitle: string;
  beforeLines: string[];
  afterLines: string[];
}

export function SelfHealLogDiff({
  sectionTitle,
  beforeTitle,
  afterTitle,
  beforeLines,
  afterLines,
}: SelfHealLogDiffProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-[1.05rem] font-semibold tracking-tight text-foreground">
        {sectionTitle}
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Before — error tone */}
        <EvidenceCard title={beforeTitle} lines={beforeLines} tone="error" />

        {/* After — default / clean tone */}
        <EvidenceCard title={afterTitle} lines={afterLines} tone="default" />
      </div>
    </div>
  );
}
