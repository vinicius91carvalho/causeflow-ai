import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * OSS commercial removal (root AC-009): /dashboard/billing is hard-removed.
 * Authenticated visits return framework not-found; never plan cards, Buy more,
 * or quota packs.
 */
export default function BillingRoute() {
  notFound();
}
