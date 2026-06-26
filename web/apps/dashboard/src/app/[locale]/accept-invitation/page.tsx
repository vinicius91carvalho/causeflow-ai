import { Suspense } from 'react';
import AcceptInvitationClient from './accept-invitation-client';

export const dynamic = 'force-dynamic';

export default function AcceptInvitationPage() {
  return (
    <Suspense>
      <AcceptInvitationClient />
    </Suspense>
  );
}
