import { OrganizationProfile } from '@clerk/nextjs';

export const dynamic = 'force-dynamic';

export default function TeamPage() {
  return (
    <div className="mx-auto max-w-4xl py-8">
      <OrganizationProfile
        routing="hash"
        appearance={{
          elements: {
            rootBox: 'w-full',
            card: 'shadow-none border border-border',
          },
        }}
      />
    </div>
  );
}
