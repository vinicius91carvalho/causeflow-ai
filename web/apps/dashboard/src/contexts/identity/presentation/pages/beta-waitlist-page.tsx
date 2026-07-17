import { notFound } from 'next/navigation';

/**
 * OSS commercial removal (root AC-010): /beta-waitlist is hard-removed.
 * Visits return framework not-found; never early-access waitlist product UX.
 */
export default function BetaWaitlistPage() {
  notFound();
}
