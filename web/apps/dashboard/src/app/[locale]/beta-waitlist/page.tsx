import type { Metadata } from 'next';
import { BetaWaitlistPage } from '@/contexts/identity/presentation/pages/beta-waitlist-page';

export const metadata: Metadata = {
  title: 'Beta Access',
  description: 'CauseFlow AI is currently in private beta.',
};

export default function BetaWaitlist() {
  return <BetaWaitlistPage />;
}
