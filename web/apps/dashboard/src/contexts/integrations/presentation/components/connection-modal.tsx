'use client';

import { Button, Input } from '@causeflow/ui/primitives';
import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Loader2,
  Shield,
  X,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import {
  buildValidationSchema,
  INTEGRATION_FIELDS,
} from '@/contexts/integrations/domain/integration-fields';
import {
  INTEGRATION_AUTH_TYPES,
  type IntegrationType,
  OAUTH_BUTTON_I18N_KEYS,
} from '@/contexts/integrations/domain/types';
import { MVP_INTEGRATION_TYPES } from '@/contexts/integrations/presentation/components/integration-catalog';
import { useBodyScrollLock } from '@/contexts/shared/presentation/hooks/use-body-scroll-lock';

type TestState = 'idle' | 'testing' | 'success' | 'error';

function CopyableField({
  label,
  value,
  copyLabel,
  copiedLabel,
}: {
  label: string;
  value: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-medium text-muted-foreground w-24 shrink-0">{label}:</span>
      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono select-all break-all flex-1 min-w-0">
        {value}
      </code>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 p-1 rounded hover:bg-muted transition-colors group"
        title={copied ? copiedLabel : copyLabel}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
        ) : (
          <Copy
            className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground"
            aria-hidden="true"
          />
        )}
      </button>
    </div>
  );
}

interface ConnectionModalProps {
  type: IntegrationType;
  name: string;
  isOpen: boolean;
  isReconfigure?: boolean;
  /** AWS setup info from the backend catalog (accountId, externalId, trustPolicyPrincipal) */
  awsSetup?: {
    accountId: string;
    externalId: string;
    trustPolicyPrincipal: string;
  };
  onClose: () => void;
  onSuccess: (type: IntegrationType) => void;
}

/**
 * Full-featured connection modal for the integrations page.
 * Shows step-by-step setup guides for MVP integrations.
 * Submits to /api/integrations (POST) to save credentials.
 * Tests via /api/integrations/test (POST) before saving.
 */
export function ConnectionModal({
  type,
  name,
  isOpen,
  isReconfigure = false,
  awsSetup,
  onClose,
  onSuccess,
}: ConnectionModalProps) {
  const t = useTranslations('dashboard.integrations.modal');
  const overlayRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [fields, setFields] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [testState, setTestState] = useState<TestState>('idle');
  const [guideOpen, setGuideOpen] = useState(false);

  // The backend catalog uses 'aws' but the frontend fields use 'cloudwatch'
  const fieldType = ((type as string) === 'aws' ? 'cloudwatch' : type) as IntegrationType;
  const hasGuide = MVP_INTEGRATION_TYPES.has(fieldType);

  // Reset state when modal opens/type changes
  useEffect(() => {
    if (isOpen) {
      // Set default values for select fields
      const ft = ((type as string) === 'aws' ? 'cloudwatch' : type) as IntegrationType;
      const defs = INTEGRATION_FIELDS[ft] ?? [];
      const defaults: Record<string, string> = {};
      for (const f of defs) {
        if (f.defaultValue) defaults[f.key] = f.defaultValue;
      }
      setFields(defaults);
      setErrors({});
      setGlobalError(null);
      setIsLoading(false);
      setIsSuccess(false);
      setTestState('idle');
      setGuideOpen(false);
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [isOpen, type]);

  // Trap focus and close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isLoading) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  // Prevent body scroll
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const fieldDefs = INTEGRATION_FIELDS[fieldType] ?? [];
  const authType = INTEGRATION_AUTH_TYPES[fieldType];
  const isOAuth = authType === 'oauth';

  function validate(): boolean {
    const schema = buildValidationSchema(fieldType, t('validation.required'));
    const result = schema.safeParse(fields);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  }

  async function handleTestConnection() {
    if (!validate()) return;
    setTestState('testing');
    setGlobalError(null);

    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...fields }),
      });

      const data = (await res.json()) as { success: boolean; message: string; details?: string };
      if (data.success) {
        setTestState('success');
      } else {
        setTestState('error');
        setGlobalError(data.message || t('testError'));
      }
    } catch {
      setTestState('error');
      setGlobalError(t('testError'));
    }

    // Reset test state after 5s
    setTimeout(() => setTestState('idle'), 5000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGlobalError(null);
    if (!validate()) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...fields }),
      });

      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) {
        setGlobalError(data.error ?? t('errorGeneric'));
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        onSuccess(type);
        onClose();
      }, 1500);
    } catch {
      setGlobalError(t('errorGeneric'));
    } finally {
      setIsLoading(false);
    }
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current && !isLoading) onClose();
  }

  function handleOverlayKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === overlayRef.current && !isLoading)
      onClose();
  }

  const modalTitle = isReconfigure ? t('reconfigureTitle', { name }) : t('connectTitle', { name });

  // Get guide steps for this integration type
  function getGuideSteps(): string[] {
    if (!hasGuide) return [];
    const steps: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const key = `guides.${fieldType}.steps.${i}` as Parameters<typeof t>[0];
      if (t.has(key)) {
        steps.push(t(key));
      }
    }
    return steps;
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connection-modal-title"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-5">
        {/* Close button */}
        <button
          type="button"
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
          onClick={onClose}
          aria-label="Close modal"
          disabled={isLoading}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {isSuccess ? (
          /* Success state */
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Check className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">{t('successTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('successMessage', { name })}</p>
          </div>
        ) : (
          <>
            {/* Heading */}
            <div className="space-y-1 pr-6">
              <h2 id="connection-modal-title" className="text-lg font-semibold text-foreground">
                {modalTitle}
              </h2>
            </div>

            {/* Setup Guide (collapsible, MVP integrations only) */}
            {hasGuide && (
              <div className="rounded-lg border border-border bg-muted/30">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 rounded-lg transition-colors"
                  onClick={() => setGuideOpen(!guideOpen)}
                  aria-expanded={guideOpen}
                >
                  {guideOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  {t('setupGuide')}
                </button>

                {guideOpen && (
                  <div className="px-3 pb-3 space-y-3">
                    {/* Required scopes */}
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <Shield className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
                      <span>
                        <span className="font-medium">{t('requiredScopes')}:</span>{' '}
                        {t(`guides.${fieldType}.scopes` as Parameters<typeof t>[0])}
                      </span>
                    </div>

                    {/* Numbered steps */}
                    <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
                      {getGuideSteps().map((step, i) => (
                        <li key={`step-${type}-${i + 1}`} className="leading-relaxed">
                          {step}
                        </li>
                      ))}
                    </ol>

                    {/* AWS setup info from backend catalog */}
                    {awsSetup && (
                      <div className="space-y-2 rounded-md border border-border bg-background p-3">
                        <p className="text-xs font-medium text-foreground">{t('awsSetupInfo')}</p>
                        <div className="space-y-1.5">
                          <CopyableField
                            label="Account ID"
                            value={awsSetup.accountId}
                            copiedLabel={t('copied')}
                            copyLabel={t('clickToCopy')}
                          />
                          <CopyableField
                            label="External ID"
                            value={awsSetup.externalId}
                            copiedLabel={t('copied')}
                            copyLabel={t('clickToCopy')}
                          />
                          <CopyableField
                            label="Trust Principal"
                            value={awsSetup.trustPolicyPrincipal}
                            copiedLabel={t('copied')}
                            copyLabel={t('clickToCopy')}
                          />
                        </div>
                      </div>
                    )}

                    {/* Documentation link */}
                    <a
                      href={t(`guides.${fieldType}.docsUrl` as Parameters<typeof t>[0])}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      {t('docsLink')}
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Global error */}
            {globalError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{globalError}</span>
              </div>
            )}

            {/* Test connection result */}
            {testState === 'success' && (
              <div className="flex items-center gap-2 rounded-lg bg-success/50/10 border border-success/60/20 px-3 py-2 text-sm text-success">
                <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t('testSuccess')}</span>
              </div>
            )}
            {testState === 'error' && !globalError && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
                <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t('testError')}</span>
              </div>
            )}

            {/* OAuth UI — all integrations except AWS use Composio OAuth */}
            {isOAuth ? (
              <div className="space-y-4">
                {/* Composio security badge */}
                <div className="flex items-start gap-3 rounded-lg border border-success/60/20 bg-success/50/5 px-4 py-3">
                  <Shield className="h-5 w-5 mt-0.5 shrink-0 text-success" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {t('composioSecurity.title')}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t('composioSecurity.description')}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-4 py-2">
                  <Button
                    type="button"
                    className="w-full"
                    disabled={isLoading}
                    onClick={async () => {
                      setIsLoading(true);
                      try {
                        const res = await fetch('/api/integrations/connect', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            provider: type === 'cloudwatch' ? 'aws' : type,
                            redirectUrl: `${window.location.origin}/dashboard/integrations`,
                          }),
                        });
                        const data = (await res.json()) as { authUrl?: string; error?: string };
                        if (data.authUrl) {
                          const w = 600;
                          const h = 700;
                          const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
                          const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
                          window.open(
                            data.authUrl,
                            '_blank',
                            `width=${w},height=${h},left=${left},top=${top}`,
                          );
                          onClose();
                        } else {
                          setGlobalError(data.error ?? t('errorGeneric'));
                        }
                      } catch {
                        setGlobalError(t('errorGeneric'));
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t(
                      (OAUTH_BUTTON_I18N_KEYS[type] ?? 'oauthButton.default') as Parameters<
                        typeof t
                      >[0],
                      { name },
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    {t('oauthDescription', { name })}
                  </p>
                </div>
                <div className="flex gap-3 pt-1">
                  <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                    {t('cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              /* Credentials Form */
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {fieldDefs.map((fieldDef, index) => {
                  const fieldId = `conn-modal-field-${fieldDef.key}`;
                  const errorId = `${fieldId}-error`;
                  const isTextarea = fieldDef.type === 'textarea';
                  const isSelect = fieldDef.type === 'select';
                  return (
                    <div key={fieldDef.key} className="space-y-1.5">
                      <label htmlFor={fieldId} className="text-sm font-medium text-foreground">
                        {t(fieldDef.labelKey as Parameters<typeof t>[0])}
                      </label>
                      {isSelect && fieldDef.options ? (
                        <select
                          id={fieldId}
                          value={fields[fieldDef.key] ?? fieldDef.defaultValue ?? ''}
                          onChange={(e) =>
                            setFields((prev) => ({ ...prev, [fieldDef.key]: e.target.value }))
                          }
                          aria-invalid={!!errors[fieldDef.key]}
                          aria-describedby={errors[fieldDef.key] ? errorId : undefined}
                          disabled={isLoading || testState === 'testing'}
                          className="flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {fieldDef.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : isTextarea ? (
                        <textarea
                          id={fieldId}
                          placeholder={
                            fieldDef.placeholderKey
                              ? t(fieldDef.placeholderKey as Parameters<typeof t>[0])
                              : undefined
                          }
                          value={fields[fieldDef.key] ?? ''}
                          onChange={(e) =>
                            setFields((prev) => ({ ...prev, [fieldDef.key]: e.target.value }))
                          }
                          aria-invalid={!!errors[fieldDef.key]}
                          aria-describedby={errors[fieldDef.key] ? errorId : undefined}
                          disabled={isLoading || testState === 'testing'}
                          rows={4}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                        />
                      ) : (
                        <Input
                          ref={index === 0 ? firstInputRef : undefined}
                          id={fieldId}
                          type={fieldDef.type}
                          placeholder={
                            fieldDef.placeholderKey
                              ? t(fieldDef.placeholderKey as Parameters<typeof t>[0])
                              : undefined
                          }
                          value={fields[fieldDef.key] ?? ''}
                          onChange={(e) =>
                            setFields((prev) => ({ ...prev, [fieldDef.key]: e.target.value }))
                          }
                          aria-invalid={!!errors[fieldDef.key]}
                          aria-describedby={errors[fieldDef.key] ? errorId : undefined}
                          disabled={isLoading || testState === 'testing'}
                        />
                      )}
                      {errors[fieldDef.key] && (
                        <p id={errorId} className="text-xs text-destructive" role="alert">
                          {errors[fieldDef.key]}
                        </p>
                      )}
                    </div>
                  );
                })}

                {/* Test connection button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={handleTestConnection}
                  disabled={isLoading || testState === 'testing'}
                >
                  {testState === 'testing' ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      {t('testing')}
                    </>
                  ) : (
                    t('testButton')
                  )}
                </Button>

                <div className="flex gap-3 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={onClose}
                    disabled={isLoading}
                  >
                    {t('cancel')}
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isLoading}>
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                    {isLoading ? t('submitting') : t('submit')}
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
