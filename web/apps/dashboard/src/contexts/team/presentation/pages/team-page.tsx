import { TeamMembersTable } from '@/contexts/team/presentation/components/team-members-table';

export const dynamic = 'force-dynamic';

/**
 * Local team management page (AC-046).
 *
 * Replaces Clerk's <OrganizationProfile> with our own TeamMembersTable
 * component that fetches team data from the Core API. No Clerk UI is used.
 */
export default function TeamPage() {
  return (
    <div className="mx-auto max-w-4xl py-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Team</h1>
      <TeamMembersTable />
    </div>
  );
}
