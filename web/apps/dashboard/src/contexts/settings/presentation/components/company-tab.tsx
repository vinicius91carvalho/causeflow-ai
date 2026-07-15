'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { isOssBuildClient } from '@/contexts/billing/application/oss-runtime';
import { PERMISSION } from '@/contexts/identity/domain/rbac/permissions';
import { RoleGuard } from '@/contexts/identity/domain/rbac/role-guard';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';
import { Link } from '@/i18n/navigation';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface CompanyErrors {
  name?: string;
  website?: string;
}

function validateCompanyForm(
  name: string,
  website: string,
  t: ReturnType<typeof useTranslations<'dashboard.settings.company'>>,
): CompanyErrors {
  const errors: CompanyErrors = {};
  if (!name.trim()) {
    errors.name = t('validation.nameRequired');
  }
  if (website.trim() && !/^https?:\/\/.+/.test(website.trim())) {
    errors.website = t('validation.invalidUrl');
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Inner form (only rendered for admins)
// ---------------------------------------------------------------------------

interface CompanyFormProps {
  companyName: string;
  website: string;
  teamSize: string;
  plan: string;
  companySlug?: string;
  autoRemediation?: boolean;
}

function CompanyForm({
  companyName: initialName,
  website: initialWebsite,
  teamSize,
  plan,
  companySlug = '',
  autoRemediation: initialAutoRemediation = false,
}: CompanyFormProps) {
  const t = useTranslations('dashboard.settings.company');
  const { addToast } = useToast();
  const [name, setName] = useState(initialName);
  const [website, setWebsite] = useState(initialWebsite);
  const [autoRemediation, setAutoRemediation] = useState(initialAutoRemediation);
  const [errors, setErrors] = useState<CompanyErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  function validate(): boolean {
    const newErrors = validateCompanyForm(name, website, t);
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
        body: JSON.stringify({
          companyName: name.trim(),
          websiteUrl: website.trim(),
          autoRemediation,
        }),
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
    <form onSubmit={handleSave} noValidate className="space-y-5">
      {/* Company name */}
      <div className="space-y-1.5">
        <label htmlFor="company-name" className="block text-sm font-medium text-foreground">
          {t('name')}
          <span className="text-destructive ml-1" aria-hidden="true">
            *
          </span>
        </label>
        <input
          id="company-name"
          type="text"
          name="companyName"
          autoComplete="organization"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
          }}
          disabled={isSaving}
          placeholder={t('namePlaceholder')}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? 'company-name-error' : undefined}
          className={[
            'w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow',
            errors.name ? 'border-destructive/60 focus:ring-red-400/50' : 'border-border',
          ].join(' ')}
        />
        {errors.name && (
          <p id="company-name-error" role="alert" className="text-xs text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      {/* Website */}
      <div className="space-y-1.5">
        <label htmlFor="company-website" className="block text-sm font-medium text-foreground">
          {t('website')}
        </label>
        <input
          id="company-website"
          type="url"
          name="websiteUrl"
          autoComplete="url"
          value={website}
          onChange={(e) => {
            setWebsite(e.target.value);
            if (errors.website) setErrors((prev) => ({ ...prev, website: undefined }));
          }}
          disabled={isSaving}
          placeholder={t('websitePlaceholder')}
          aria-invalid={!!errors.website}
          aria-describedby={errors.website ? 'company-website-error' : undefined}
          className={[
            'w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow',
            errors.website ? 'border-destructive/60 focus:ring-red-400/50' : 'border-border',
          ].join(' ')}
        />
        {errors.website && (
          <p id="company-website-error" role="alert" className="text-xs text-destructive">
            {errors.website}
          </p>
        )}
      </div>

      {/* Company Slug (read-only display) */}
      {companySlug && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">{t('slug')}</p>
          <p className="text-xs text-muted-foreground">{t('slugDescription')}</p>
          <div className="flex items-center rounded-lg border border-border bg-muted/50 px-3 py-2">
            <code className="text-sm text-foreground font-mono">{companySlug}</code>
          </div>
        </div>
      )}

      {/* Auto Remediation toggle */}
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">{t('autoRemediation')}</p>
          <p className="text-xs text-muted-foreground">{t('autoRemediationDescription')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoRemediation}
          disabled={isSaving}
          onClick={() => setAutoRemediation((prev) => !prev)}
          className={[
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed',
            autoRemediation ? 'bg-primary' : 'bg-muted',
          ].join(' ')}
        >
          <span
            className={[
              'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform duration-200',
              autoRemediation ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </div>

      {/* Team size (display only) */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-foreground">{t('teamSize')}</p>
        <p className="text-sm text-muted-foreground">{teamSize}</p>
      </div>

      {/* Plan + upgrade — commercial only (AC-083) */}
      {!isOssBuildClient() && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">{t('plan')}</p>
            <p className="text-sm text-muted-foreground capitalize">{plan}</p>
          </div>
          <Link
            href="/pricing"
            className="inline-flex items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t('upgradePlan')}
          </Link>
        </div>
      )}

      {/* Save */}
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
  );
}

// ---------------------------------------------------------------------------
// Public component (wrapped in RoleGuard)
// ---------------------------------------------------------------------------

interface CompanyTabProps {
  companyName?: string;
  website?: string;
  teamSize?: string;
  plan?: string;
  companySlug?: string;
  autoRemediation?: boolean;
}

export function CompanyTab({
  companyName = '',
  website = '',
  teamSize = '—',
  plan = 'free',
  companySlug,
  autoRemediation = false,
}: CompanyTabProps) {
  const t = useTranslations('dashboard.settings.company');

  return (
    <RoleGuard
      permission={PERMISSION.MANAGE_SETTINGS}
      fallback={
        <div className="rounded-lg border border-border bg-muted/50 p-6 text-center">
          <p className="text-sm text-muted-foreground">{t('adminOnly')}</p>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('title')}</h3>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <CompanyForm
          companyName={companyName}
          website={website}
          teamSize={teamSize}
          plan={plan}
          companySlug={companySlug}
          autoRemediation={autoRemediation}
        />
      </div>
    </RoleGuard>
  );
}
