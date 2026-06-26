'use client';

import { Button, Input } from '@causeflow/ui/primitives';
import { Check, Copy, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useBodyScrollLock } from '@/contexts/shared/presentation/hooks/use-body-scroll-lock';

export interface SentrySetupModalProps {
  /**
   * Webhook URL displayed inside the modal. MUST come from a server prop
   * that derived `org_id` from the Clerk session — never hardcode.
   */
  webhookUrl: string;
  isOpen: boolean;
  onClose: () => void;
  /**
   * Called when the user submits a non-empty Client Secret. The dashboard
   * forwards it once via the Next.js BFF and never holds it at rest. This
   * function MUST NOT log or persist the secret.
   */
  onSubmit: (clientSecret: string) => Promise<void>;
}

const SETUP_STEP_KEYS = ['1', '2', '3', '4', '5', '6', '7'] as const;

/**
 * Sentry Internal Integration setup modal.
 *
 * Renders the 7-step setup guide verbatim, the webhook URL the user must paste
 * into Sentry, and the required Client Secret password input.
 *
 * Security notes:
 * - The Client Secret is NEVER persisted client-side (no browser storage APIs,
 *   no logs). The component clears `secret` from state immediately after a
 *   successful submit.
 * - The form's `autoComplete="off"` and `<Input type="password">` prevent
 *   credential managers from offering to save it.
 */
export function SentrySetupModal({ webhookUrl, isOpen, onClose, onSubmit }: SentrySetupModalProps) {
  const t = useTranslations('dashboard.integrations.sentrySetup');
  const overlayRef = useRef<HTMLDivElement>(null);
  const [secret, setSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset transient state when the modal closes — never retain the Client Secret.
  useEffect(() => {
    if (!isOpen) {
      setSecret('');
      setSubmitting(false);
      setSubmitError(null);
      setCopied(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleOverlayKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === overlayRef.current) onClose();
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!secret.trim() || submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(secret);
      // Clear immediately on success — never retain the secret in component state.
      setSecret('');
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sentry-setup-modal-title"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
    >
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-5">
        <button
          type="button"
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
          onClick={onClose}
          aria-label="Close modal"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <header className="space-y-1 pr-6">
          <h2 id="sentry-setup-modal-title" className="text-lg font-semibold text-foreground">
            {t('title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </header>

        {/* Webhook URL */}
        <div className="space-y-2 rounded-md border border-border bg-background p-3">
          <p className="text-xs font-medium text-foreground">{t('webhookUrlLabel')}</p>
          <p className="text-[11px] text-muted-foreground">{t('webhookUrlHelp')}</p>
          <div className="flex items-center gap-2">
            <code
              data-testid="sentry-webhook-url"
              className="text-xs bg-muted px-2 py-1 rounded font-mono select-all break-all flex-1 min-w-0"
            >
              {webhookUrl}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 p-1.5 rounded hover:bg-muted transition-colors"
              aria-label="Copy webhook URL"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" aria-hidden="true" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Setup steps */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">{t('instructionsTitle')}</p>
          <ol
            data-testid="sentry-setup-steps"
            className="space-y-2 text-xs text-muted-foreground list-decimal list-inside"
          >
            {SETUP_STEP_KEYS.map((key) => (
              <li key={`sentry-step-${key}`} className="leading-relaxed">
                {t(`steps.${key}` as Parameters<typeof t>[0])}
              </li>
            ))}
          </ol>
        </div>

        {/* Required events callout */}
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-1">
          <p className="text-xs font-medium text-foreground">{t('events.title')}</p>
          <p
            data-testid="sentry-required-events"
            className="text-xs text-muted-foreground font-mono"
          >
            {t('events.list')}
          </p>
        </div>

        {/* Client Secret input */}
        <form onSubmit={handleSubmit} className="space-y-2" autoComplete="off">
          <label
            htmlFor="sentry-client-secret"
            className="block text-xs font-medium text-foreground"
          >
            {t('clientSecretLabel')}
          </label>
          <Input
            id="sentry-client-secret"
            data-testid="sentry-client-secret-input"
            type="password"
            required
            autoComplete="off"
            placeholder={t('clientSecretPlaceholder')}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            disabled={submitting}
          />
          <p className="text-[11px] text-muted-foreground">{t('clientSecretHelp')}</p>

          {submitError && (
            <p data-testid="sentry-submit-error" className="text-xs text-destructive" role="alert">
              {t('errorToast', { message: submitError })}
            </p>
          )}

          <Button
            type="submit"
            data-testid="sentry-save-button"
            className="w-full"
            disabled={!secret.trim() || submitting}
          >
            {submitting ? t('submittingButton') : t('submitButton')}
          </Button>
        </form>
      </div>
    </div>
  );
}
