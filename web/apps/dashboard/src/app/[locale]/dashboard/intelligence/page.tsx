export const dynamic = 'force-dynamic';

import { PageHeader } from '@causeflow/ui/layouts';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { IntelligencePage } from '@/contexts/shared/presentation/pages/intelligence-page';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Intelligence — CauseFlow' };
}

export default async function Intelligence({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intelligence"
        description="AI memory insights — past incidents, service topology, and remediation history."
      />
      <IntelligencePage />
    </div>
  );
}
