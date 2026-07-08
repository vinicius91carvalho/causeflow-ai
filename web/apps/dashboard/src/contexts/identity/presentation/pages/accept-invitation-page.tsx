import { Suspense } from 'react';
import AcceptInvitationClient from '@/contexts/identity/presentation/components/accept-invitation-client';

export const dynamic = 'force-dynamic';

export default function AcceptInvitationPage() {
  return (
    <Suspense>
      <AcceptInvitationClient />
    </Suspense>
  );
}
