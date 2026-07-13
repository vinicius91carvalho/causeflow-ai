import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * OSS commercial removal (AC-073): /dashboard/billing never renders commercial
 * billing UI. Redirect to the dashboard home (non-billing landing).
 */
export default function BillingRoute() {
  redirect('/dashboard');
}
