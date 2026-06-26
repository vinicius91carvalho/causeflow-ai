'use client';

import { Button } from '@causeflow/ui/primitives';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { PERMISSION } from '@/contexts/identity/domain/rbac/permissions';
import { usePermission } from '@/contexts/identity/domain/rbac/role-guard';
import { formatDate } from '@/contexts/shared/lib/format-date';
import type { Invite } from '@/contexts/team/domain/types';
import { RoleBadge } from './role-badge';

interface PendingInvitesProps {
  /** Refresh trigger — increment to re-fetch invites */
  refreshToken?: number;
}

/**
 * List of pending (and recently expired) team invites.
 * Admins can resend or revoke pending invites.
 */
export function PendingInvites({ refreshToken = 0 }: PendingInvitesProps) {
  const t = useTranslations('dashboard.team.pendingInvites');
  const tActions = useTranslations('dashboard.team.pendingInvites.actions');
  const tStatus = useTranslations('dashboard.team.pendingInvites.status');
  const tCols = useTranslations('dashboard.team.pendingInvites.columns');
  const canManageTeam = usePermission(PERMISSION.MANAGE_TEAM);

  const [invites, setInvites] = useState<Invite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/team/invites');
      if (res.ok) {
        const data = (await res.json()) as { invites: Invite[] };
        setInvites(data.invites);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken is a numeric counter prop used to trigger re-fetches
  useEffect(() => {
    void fetchInvites();
  }, [fetchInvites, refreshToken]);

  async function handleRevoke(email: string) {
    setRevoking(email);
    try {
      await fetch(`/api/team/invites/${encodeURIComponent(email)}`, { method: 'DELETE' });
      await fetchInvites();
    } finally {
      setRevoking(null);
    }
  }

  async function handleResend(invite: Invite) {
    setResending(invite.email);
    try {
      // First revoke the existing invite, then create a fresh one
      await fetch(`/api/team/invites/${encodeURIComponent(invite.email)}`, {
        method: 'DELETE',
      });
      await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: invite.email, role: invite.role }),
      });
      await fetchInvites();
    } finally {
      setResending(null);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {['invite-skeleton-1', 'invite-skeleton-2'].map((id) => (
          <div key={id} className="h-12 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (invites.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">{t('empty')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {tCols('email')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {tCols('role')}
            </th>
            <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {tCols('sent')}
            </th>
            <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {tCols('expires')}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {/* Actions */}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {invites.map((invite) => {
            const isExpired =
              invite.status === 'expired' || new Date(invite.expiresAt) < new Date();
            return (
              <tr key={invite.email} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-foreground font-medium truncate max-w-[180px]">
                  {invite.email}
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={invite.role} />
                </td>
                <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                  {formatDate(invite.createdAt)}
                </td>
                <td className="hidden sm:table-cell px-4 py-3 text-muted-foreground">
                  {formatDate(invite.expiresAt)}
                </td>
                <td className="px-4 py-3">
                  {isExpired ? (
                    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/20">
                      {tStatus('expired')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-warning/50/10 px-2 py-0.5 text-xs font-medium text-warning ring-1 ring-inset ring-yellow-500/20">
                      {tStatus('pending')}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  {!isExpired && canManageTeam && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleResend(invite)}
                        disabled={resending === invite.email}
                        className="text-xs"
                      >
                        {tActions('resend')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleRevoke(invite.email)}
                        disabled={revoking === invite.email}
                        className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                      >
                        {tActions('revoke')}
                      </Button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
