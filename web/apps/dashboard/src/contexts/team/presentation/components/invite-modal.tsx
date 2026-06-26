'use client';

import { Button } from '@causeflow/ui/primitives';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { UserRole } from '@/contexts/identity/domain/types';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
}

/**
 * Modal for inviting a new team member.
 * Sends POST /api/team/invite with email and role.
 * Shows success message with invited email on completion.
 */
export function InviteModal({ isOpen, onClose, onSuccess }: InviteModalProps) {
  const t = useTranslations('dashboard.team.invite');
  const tRoles = useTranslations('dashboard.team.roles');

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successEmail, setSuccessEmail] = useState('');

  if (!isOpen) return null;

  function handleClose() {
    setEmail('');
    setRole('member');
    setError('');
    setSuccessEmail('');
    onClose();
  }

  function validateEmail(value: string): string {
    if (!value.trim()) return t('errors.emailRequired');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return t('errors.emailInvalid');
    return '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      if (res.ok) {
        setSuccessEmail(email.trim());
        onSuccess(email.trim());
      } else {
        const data = (await res.json()) as { error?: string };
        if (res.status === 409) {
          setError(t('errors.duplicate'));
        } else {
          setError(data.error ?? t('errors.generic'));
        }
      }
    } catch {
      setError(t('errors.generic'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog content */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-xl border border-border bg-card shadow-lg p-6 space-y-5">
        {successEmail ? (
          /* Success state */
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/50/10 text-success">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{t('successTitle')}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t('successMessage', { email: successEmail })}
              </p>
            </div>
            <Button type="button" className="w-full" onClick={handleClose}>
              {t('cancel')}
            </Button>
          </div>
        ) : (
          /* Form state */
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <h2 id="invite-modal-title" className="text-lg font-semibold text-foreground">
                {t('title')}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{t('description')}</p>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="invite-email">
                {t('emailLabel')}
              </label>
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder={t('emailPlaceholder')}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                autoComplete="email"
              />
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="invite-role">
                {t('roleLabel')}
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="member">{tRoles('member')}</option>
                <option value="admin">{tRoles('admin')}</option>
              </select>
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
                onClick={handleClose}
                disabled={isSubmitting}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? t('submitting') : t('submit')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
