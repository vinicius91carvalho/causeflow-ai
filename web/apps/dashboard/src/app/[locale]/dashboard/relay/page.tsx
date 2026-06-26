export const dynamic = 'force-dynamic';

import { PageHeader } from '@causeflow/ui/layouts';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { RelayStatus } from '@/contexts/integrations/presentation/components/relay-status';

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return { title: 'Relay — CauseFlow' };
}

export default async function RelayPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relay"
        description="Manage relay agent connections to your infrastructure."
      />
      <RelayStatus />
    </div>
  );
}
