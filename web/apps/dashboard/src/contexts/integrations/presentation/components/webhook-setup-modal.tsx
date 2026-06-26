'use client';

import { Button } from '@causeflow/ui/primitives';
import { Check, Copy, ExternalLink, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useBodyScrollLock } from '@/contexts/shared/presentation/hooks/use-body-scroll-lock';

interface WebhookSetupModalProps {
  provider: string;
  providerName: string;
  webhookUrl: string;
  isOpen: boolean;
  onClose: () => void;
}

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

/**
 * Modal shown after creating a webhook-only trigger (Sentry, PagerDuty, Datadog).
 * Displays the CauseFlow webhook URL plus provider-specific setup steps.
 */
export function WebhookSetupModal({
  provider,
  providerName,
  webhookUrl,
  isOpen,
  onClose,
}: WebhookSetupModalProps) {
  const t = useTranslations('dashboard.integrations');
  const overlayRef = useRef<HTMLDivElement>(null);

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

  function getSteps(): string[] {
    const steps: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const key = `webhookSetup.${provider}.steps.${i}` as Parameters<typeof t>[0];
      if (t.has(key)) {
        steps.push(t(key));
      }
    }
    return steps;
  }

  const docsUrlKey = `webhookSetup.${provider}.docsUrl` as Parameters<typeof t>[0];
  const docsUrl = t.has(docsUrlKey) ? t(docsUrlKey) : undefined;

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleOverlayKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === overlayRef.current) onClose();
  }

  const steps = getSteps();

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="webhook-setup-modal-title"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-5">
        <button
          type="button"
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
          onClick={onClose}
          aria-label="Close modal"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="space-y-1 pr-6">
          <h2 id="webhook-setup-modal-title" className="text-lg font-semibold text-foreground">
            {t('webhookSetup.title', { name: providerName })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('webhookSetup.instructions', { name: providerName })}
          </p>
        </div>

        <div className="space-y-2 rounded-md border border-border bg-background p-3">
          <p className="text-xs font-medium text-foreground">{t('webhookSetup.urlLabel')}</p>
          <CopyableField
            label="URL"
            value={webhookUrl}
            copyLabel={t('modal.clickToCopy')}
            copiedLabel={t('modal.copied')}
          />
        </div>

        {steps.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">{t('modal.setupGuide')}</p>
            <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
              {steps.map((step, i) => (
                <li key={`webhook-step-${provider}-${i + 1}`} className="leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        {docsUrl && (
          <a
            href={docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            {t('modal.docsLink')}
          </a>
        )}

        <div className="pt-1">
          <Button type="button" className="w-full" onClick={onClose}>
            {t('webhookSetup.doneButton')}
          </Button>
        </div>
      </div>
    </div>
  );
}
