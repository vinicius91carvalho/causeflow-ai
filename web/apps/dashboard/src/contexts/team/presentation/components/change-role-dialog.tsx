'use client';

import { Button } from '@causeflow/ui/primitives';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { UserRole } from '@/contexts/identity/domain/types';

interface ChangeRoleDialogProps {
  isOpen: boolean;
  /** The user whose role is being changed */
  targetUserId: string;
  targetName: string;
  currentRole: UserRole;
  /** Whether the actor is changing their own role */
  isSelf: boolean;
  /** Whether the actor is the last admin (prevent lockout) */
  isLastAdmin: boolean;
  onClose: () => void;
  onConfirm: (userId: string, newRole: UserRole) => Promise<void>;
}

/**
 * Modal dialog for changing a team member's role.
 * Shows self-demotion and last-admin warnings.
 */
export function ChangeRoleDialog({
  isOpen,
  targetUserId,
  targetName,
  currentRole,
  isSelf,
  isLastAdmin,
  onClose,
  onConfirm,
}: ChangeRoleDialogProps) {
  const t = useTranslations('dashboard.team.changeRole');
  const tRoles = useTranslations('dashboard.team.roles');

  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const isDisabled = isSubmitting || (isLastAdmin && isSelf && selectedRole !== 'admin');

  async function handleConfirm() {
    if (selectedRole === currentRole) {
      onClose();
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await onConfirm(targetUserId, selectedRole);
      onClose();
    } catch {
      setError(t('error'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-role-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog content */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-xl border border-border bg-card shadow-lg p-6 space-y-5">
        {/* Header */}
        <div>
          <h2 id="change-role-dialog-title" className="text-lg font-semibold text-foreground">
            {t('title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('description', { name: targetName })}
          </p>
        </div>

        {/* Role selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="role-select">
            {t('roleLabel')}
          </label>
          <select
            id="role-select"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as UserRole)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="admin">{tRoles('admin')}</option>
            <option value="member">{tRoles('member')}</option>
          </select>
        </div>

        {/* Warnings */}
        {isSelf && selectedRole !== 'admin' && (
          <div className="rounded-lg border border-warning/60/30 bg-warning/50/10 px-4 py-3 text-sm text-warning">
            {isLastAdmin ? t('lastAdminWarning') : t('selfWarning')}
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isDisabled || selectedRole === currentRole}
          >
            {isSubmitting ? t('submitting') : t('submit')}
          </Button>
        </div>
      </div>
    </div>
  );
}
