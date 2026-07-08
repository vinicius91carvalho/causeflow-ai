'use client';

import { useUser } from '@/contexts/shared/presentation/components/auth-context';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';
import { Link } from '@/i18n/navigation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUserInitials(name: string | null | undefined): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `${parts[0]!.charAt(0)}${parts[parts.length - 1]!.charAt(0)}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Zod-free validation (keeps bundle small — matches existing form patterns)
// ---------------------------------------------------------------------------

interface ProfileErrors {
  name?: string;
}

function validateName(
  name: string,
  t: ReturnType<typeof useTranslations<'dashboard.settings.profile'>>,
): string | undefined {
  if (!name.trim()) return t('validation.nameRequired');
  if (name.trim().length < 2) return t('validation.nameTooShort');
  return undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProfileTab() {
  const t = useTranslations('dashboard.settings.profile');
  const { addToast } = useToast();
  const { user } = useUser();

  // Capture session values so the effect dependency array is stable
  const sessionName = user?.fullName ?? '';
  const sessionEmail = user?.primaryEmailAddress?.emailAddress ?? '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load real profile data from API
  useEffect(() => {
    async function loadProfile() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = (await res.json()) as {
            profile?: { name?: string; email?: string };
          };
          if (data.profile?.name) setName(data.profile.name);
          if (data.profile?.email) setEmail(data.profile.email);
        } else {
          // Fall back to session data
          setName(sessionName);
          setEmail(sessionEmail);
        }
      } catch {
        setName(sessionName);
        setEmail(sessionEmail);
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, [sessionName, sessionEmail]);

  const initials = getUserInitials(name || user?.fullName);

  function validate(): boolean {
    const nameError = validateName(name, t);
    const newErrors: ProfileErrors = {};
    if (nameError) newErrors.name = nameError;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) throw new Error('Save failed');
      addToast(t('saved'), 'success');
    } catch {
      addToast(t('errorSaving'), 'error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Avatar */}
      <div className="flex items-center gap-5">
        {user?.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={user.fullName ?? 'User avatar'}
            className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
          />
        ) : (
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold select-none"
            aria-hidden="true"
          >
            {initials}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-foreground">{t('avatar')}</p>
          <p className="text-xs text-muted-foreground">{t('avatarDescription')}</p>
        </div>
      </div>

      {/* Profile form */}
      <form onSubmit={handleSave} noValidate className="space-y-5">
        {/* Name */}
        <div className="space-y-1.5">
          <label htmlFor="profile-name" className="block text-sm font-medium text-foreground">
            {t('name')}
            <span className="text-destructive ml-1" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="profile-name"
            type="text"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            disabled={isSaving || isLoading}
            placeholder={isLoading ? '...' : t('namePlaceholder')}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'name-error' : undefined}
            className={[
              'w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow',
              errors.name ? 'border-destructive/60 focus:ring-red-400/50' : 'border-border',
              isSaving || isLoading ? 'opacity-60 cursor-not-allowed' : '',
            ].join(' ')}
          />
          {errors.name && (
            <p id="name-error" role="alert" className="text-xs text-destructive">
              {errors.name}
            </p>
          )}
        </div>

        {/* Email (read-only) */}
        <div className="space-y-1.5">
          <label htmlFor="profile-email" className="block text-sm font-medium text-foreground">
            {t('email')}
          </label>
          <input
            id="profile-email"
            type="email"
            name="email"
            value={(email || user?.primaryEmailAddress?.emailAddress) ?? ''}
            readOnly
            disabled
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
          />
          <p className="text-xs text-muted-foreground">{t('emailReadonly')}</p>
        </div>

        {/* Save button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t('saving')}
              </>
            ) : (
              t('save')
            )}
          </button>
        </div>
      </form>

      {/* Change password section */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">{t('changePassword')}</h3>
        <p className="text-xs text-muted-foreground mb-3">{t('changePasswordDescription')}</p>
        <Link
          href="/auth/forgot-password"
          className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          {t('resetPasswordLink')}
        </Link>
      </div>
    </div>
  );
}
