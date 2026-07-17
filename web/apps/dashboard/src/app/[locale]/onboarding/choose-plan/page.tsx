import { notFound } from 'next/navigation';
import { isOssRuntime } from '@/contexts/billing/application/oss-runtime';
import ChoosePlanPage from '@/contexts/billing/presentation/pages/choose-plan-page';

export const dynamic = 'force-dynamic';

/**
 * Commercial plan gate — OSS hard-removes choose-plan (root AC-007).
 */
export default async function ChoosePlanRoute() {
  if (isOssRuntime()) {
    notFound();
  }

  return <ChoosePlanPage />;
}
