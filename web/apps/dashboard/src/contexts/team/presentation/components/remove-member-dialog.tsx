'use client';

import { Button } from '@causeflow/ui/primitives';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface RemoveMemberDialogProps {
  isOpen: boolean;
  targetUserId: string;
  targetName: string;
  onClose: () => void;
  onConfirm: (userId: string) => Promise<void>;
}

/**
 * Confirmation dialog for removing a team member.
 * Cannot be used to remove self (enforced server-side too).
 */
export function RemoveMemberDialog({
  isOpen,
  targetUserId,
  targetName,
  onClose,
  onConfirm,
}: RemoveMemberDialogProps) {
  const t = useTranslations('dashboard.team.removeMember');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleConfirm() {
    setError('');
    setIsSubmitting(true);
    try {
      await onConfirm(targetUserId);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg || t('description', { name: targetName }));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-member-dialog-title"
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
          <h2 id="remove-member-dialog-title" className="text-lg font-semibold text-foreground">
            {t('title')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t('description', { name: targetName })}
          </p>
        </div>

        {/* Warning */}
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t('warning')}
        </div>

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
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? '...' : t('confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
