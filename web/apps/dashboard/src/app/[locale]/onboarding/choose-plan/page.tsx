import { redirect } from 'next/navigation';
import { isOssRuntime } from '@/contexts/billing/application/oss-runtime';
import ChoosePlanPage from '@/contexts/billing/presentation/pages/choose-plan-page';

export const dynamic = 'force-dynamic';

/**
 * Commercial plan gate — OSS skips plan selection entirely (AC-081/AC-082).
 */
export default async function ChoosePlanRoute() {
  if (isOssRuntime()) {
    redirect('/dashboard');
  }

  return <ChoosePlanPage />;
}
