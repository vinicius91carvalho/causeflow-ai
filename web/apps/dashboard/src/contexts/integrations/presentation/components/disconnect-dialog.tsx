'use client';

import { Button } from '@causeflow/ui/primitives';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { IntegrationType } from '@/contexts/integrations/domain/types';
import { useBodyScrollLock } from '@/contexts/shared/presentation/hooks/use-body-scroll-lock';

interface DisconnectDialogProps {
  type: IntegrationType;
  name: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: IntegrationType) => Promise<void>;
}

/**
 * Confirmation dialog for disconnecting an integration.
 * Shows a warning message and disconnect/cancel buttons.
 * On confirm → calls onConfirm which makes DELETE to /api/integrations/[type].
 */
export function DisconnectDialog({
  type,
  name,
  isOpen,
  onClose,
  onConfirm,
}: DisconnectDialogProps) {
  const t = useTranslations('dashboard.integrations.disconnect');
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setIsDisconnecting(false);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isDisconnecting) onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDisconnecting, onClose]);

  // Prevent body scroll
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === overlayRef.current && !isDisconnecting) onClose();
  }

  function handleOverlayKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === overlayRef.current && !isDisconnecting)
      onClose();
  }

  async function handleConfirm() {
    setIsDisconnecting(true);
    try {
      await onConfirm(type);
      onClose();
    } finally {
      setIsDisconnecting(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="disconnect-dialog-title"
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-5">
        {/* Close button */}
        <button
          type="button"
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          onClick={onClose}
          aria-label="Close dialog"
          disabled={isDisconnecting}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Warning icon + title */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
          </div>
          <h2 id="disconnect-dialog-title" className="text-base font-semibold text-foreground">
            {t('title', { name })}
          </h2>
        </div>

        {/* Warning message */}
        <p className="text-sm text-muted-foreground leading-relaxed">{t('warning', { name })}</p>

        {/* Action buttons */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={isDisconnecting}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="flex-1"
            onClick={handleConfirm}
            disabled={isDisconnecting}
          >
            {isDisconnecting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {isDisconnecting ? t('disconnecting') : t('confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
