'use client';

import { Button } from '@causeflow/ui/primitives';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { PERMISSION } from '@/contexts/identity/domain/rbac/permissions';
import { RoleGuard } from '@/contexts/identity/domain/rbac/role-guard';
import { InviteModal } from './invite-modal';
import { PendingInvites } from './pending-invites';
import { TeamMembersTable } from './team-members-table';

/**
 * Client component orchestrating the team management page.
 * - Shows invite button for admins only (via RoleGuard)
 * - TeamMembersTable shows admin actions when user is admin
 * - PendingInvites section is admin-only
 */
export function TeamPageClient() {
  const t = useTranslations('dashboard.team');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  function handleInviteSuccess(_email: string) {
    // Trigger refresh of both members and invites
    setRefreshToken((n) => n + 1);
  }

  return (
    <div className="space-y-8">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div />
        <RoleGuard permission={PERMISSION.MANAGE_TEAM}>
          <Button type="button" size="sm" onClick={() => setInviteOpen(true)}>
            {t('inviteButton')}
          </Button>
        </RoleGuard>
      </div>

      {/* Members table */}
      <TeamMembersTable refreshToken={refreshToken} />

      {/* Pending invites — visible to everyone, mutation actions gated inside */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">{t('pendingInvites.title')}</h3>
        <PendingInvites refreshToken={refreshToken} />
      </div>

      {/* Invite modal */}
      <InviteModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSuccess={handleInviteSuccess}
      />
    </div>
  );
}
