import { CreateOrganization } from '@clerk/nextjs';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CreateOrganizationPage() {
  // Block if user already has an organization
  const { orgId } = await auth();
  if (orgId) {
    redirect('/onboarding/choose-plan');
  }

  return (
    <main className="flex h-dvh items-center justify-center overflow-y-auto bg-gradient-to-br from-background via-background to-primary/5 px-4 py-4 sm:py-12">
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md">
        <CreateOrganization
          afterCreateOrganizationUrl="/onboarding/choose-plan"
          skipInvitationScreen={true}
        />
      </div>
    </main>
  );
}
