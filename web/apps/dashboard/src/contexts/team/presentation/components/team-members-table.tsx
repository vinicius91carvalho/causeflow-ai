'use client';

import { Button } from '@causeflow/ui/primitives';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { PERMISSION } from '@/contexts/identity/domain/rbac/permissions';
import { usePermission } from '@/contexts/identity/domain/rbac/role-guard';
import type { User, UserRole } from '@/contexts/identity/domain/types';
import { formatDate } from '@/contexts/shared/lib/format-date';
import { useAuth } from '@/contexts/shared/presentation/components/auth-context';
import { ChangeRoleDialog } from './change-role-dialog';
import { RemoveMemberDialog } from './remove-member-dialog';
import { RoleBadge } from './role-badge';

interface MembersResponse {
  members: User[];
  pagination: { cursor?: string; hasMore: boolean };
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface MemberCardProps {
  member: User;
  currentUserId: string;
  isAdmin: boolean;
  adminCount: number;
  onChangeRole: (member: User) => void;
  onRemove: (member: User) => void;
}

function MemberCard({
  member,
  currentUserId,
  isAdmin,
  adminCount,
  onChangeRole,
  onRemove,
}: MemberCardProps) {
  const t = useTranslations('dashboard.team');
  const isSelf = member.id === currentUserId;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {getInitials(member.name)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground truncate">{member.name}</span>
          {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
          <RoleBadge role={member.role} />
        </div>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
        <p className="text-xs text-muted-foreground">
          {t('table.joined')} {formatDate(member.createdAt)}
        </p>
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChangeRole(member)}
            className="text-xs"
            aria-label={`Change role for ${member.name}`}
          >
            {t('changeRole.title')}
          </Button>
          {!isSelf && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRemove(member)}
              disabled={member.role === 'admin' && adminCount <= 1}
              className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
              aria-label={`Remove ${member.name}`}
            >
              ×
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

interface TeamMembersTableProps {
  /** Refresh trigger — increment to re-fetch */
  refreshToken?: number;
}

/**
 * Responsive team members list.
 * - Desktop (sm+): table layout
 * - Mobile (<sm): card list
 * - Admin view: shows change role and remove actions
 * - Member view: read-only
 */
export function TeamMembersTable({ refreshToken = 0 }: TeamMembersTableProps) {
  const t = useTranslations('dashboard.team');
  const { userId } = useAuth();
  const canManageTeam = usePermission(PERMISSION.MANAGE_TEAM);

  const currentUserId = userId ?? '';

  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [changeRoleTarget, setChangeRoleTarget] = useState<User | null>(null);
  const [removeTarget, setRemoveTarget] = useState<User | null>(null);

  const fetchMembers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/team');
      if (res.ok) {
        const data = (await res.json()) as MembersResponse;
        setMembers(data.members);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken is a numeric counter prop used to trigger re-fetches
  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers, refreshToken]);

  const adminCount = members.filter((m) => m.role === 'admin').length;

  async function handleRoleConfirm(userId: string, newRole: UserRole) {
    const res = await fetch(`/api/team/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? 'Failed to update role');
    }
    await fetchMembers();
  }

  async function handleRemoveConfirm(userId: string) {
    const res = await fetch(`/api/team/${userId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      throw new Error(data.error ?? 'Failed to remove member');
    }
    await fetchMembers();
  }

  if (isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        {/* Desktop skeleton */}
        <div className="hidden sm:block overflow-hidden rounded-lg border border-border">
          <div className="h-10 bg-muted/50" />
          {['member-row-sk-1', 'member-row-sk-2', 'member-row-sk-3'].map((id) => (
            <div key={id} className="h-14 border-t border-border bg-card animate-pulse" />
          ))}
        </div>
        {/* Mobile skeleton */}
        <div className="sm:hidden space-y-2">
          {['member-card-sk-1', 'member-card-sk-2', 'member-card-sk-3'].map((id) => (
            <div key={id} className="h-20 rounded-lg border border-border bg-card animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('table.member')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('table.email')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('table.role')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('table.joined')}
              </th>
              {canManageTeam && (
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('table.actions')}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {members.map((member) => {
              const isSelf = member.id === currentUserId;
              return (
                <tr key={member.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {getInitials(member.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{member.name}</p>
                        {isSelf && <p className="text-xs text-muted-foreground">(you)</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]">
                    {member.email}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(member.createdAt)}
                  </td>
                  {canManageTeam && (
                    <td className="px-4 py-3 text-right space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setChangeRoleTarget(member)}
                        className="text-xs"
                        aria-label={`Change role for ${member.name}`}
                      >
                        {t('changeRole.title')}
                      </Button>
                      {!isSelf && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setRemoveTarget(member)}
                          disabled={member.role === 'admin' && adminCount <= 1}
                          className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                          aria-label={`Remove ${member.name}`}
                        >
                          {t('removeMember.confirm')}
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-2">
        {members.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            currentUserId={currentUserId}
            isAdmin={canManageTeam}
            adminCount={adminCount}
            onChangeRole={setChangeRoleTarget}
            onRemove={setRemoveTarget}
          />
        ))}
      </div>

      {/* Change role dialog */}
      {changeRoleTarget && (
        <ChangeRoleDialog
          isOpen={true}
          targetUserId={changeRoleTarget.id}
          targetName={changeRoleTarget.name}
          currentRole={changeRoleTarget.role}
          isSelf={changeRoleTarget.id === currentUserId}
          isLastAdmin={adminCount <= 1 && changeRoleTarget.role === 'admin'}
          onClose={() => setChangeRoleTarget(null)}
          onConfirm={handleRoleConfirm}
        />
      )}

      {/* Remove member dialog */}
      {removeTarget && (
        <RemoveMemberDialog
          isOpen={true}
          targetUserId={removeTarget.id}
          targetName={removeTarget.name}
          onClose={() => setRemoveTarget(null)}
          onConfirm={handleRemoveConfirm}
        />
      )}
    </>
  );
}
