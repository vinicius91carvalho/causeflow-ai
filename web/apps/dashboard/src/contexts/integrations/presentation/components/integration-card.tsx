'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@causeflow/ui/primitives';
import {
  ChevronDown,
  ExternalLink,
  Loader2,
  Settings,
  ShieldCheck,
  Trash2,
  Unplug,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type {
  ActiveTrigger,
  IntegrationStatus,
  IntegrationType,
} from '@/contexts/integrations/domain/types';
import { formatRelativeTime } from '@/contexts/shared/lib/format-date';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';
import type { IntegrationPhase } from './integration-catalog';
import { TRIGGER_CATALOG } from './integration-catalog';
import { StatusIndicator } from './status-indicator';

interface IntegrationCardProps {
  type: IntegrationType;
  name: string;
  description: string;
  /** Path to the SVG icon file */
  iconSrc: string;
  /** Brand color for the accent border/background */
  brandColor: string;
  phase: IntegrationPhase;
  status: IntegrationStatus | 'available';
  lastTestedAt?: string;
  connectedBy?: string;
  isStale?: boolean;
  /** Optional differentiator text shown below the description */
  differentiator?: string;
  /**
   * Connection strategy for this integration.
   * - 'oauth': Composio OAuth popup flow (GitHub, Slack, etc.)
   * - 'credential': Credential-based (AWS CloudWatch)
   * - 'webhook': Webhook-only (no active connect button)
   * Supersedes the legacy `authType` prop.
   */
  connectionStrategy: 'oauth' | 'credential' | 'webhook';
  /** @deprecated Use connectionStrategy instead. Kept for backward compat. */
  authType?: 'oauth' | 'credential';
  /** When true, hides all action buttons (read-only mode for Members) */
  readOnly?: boolean;
  /** Active Composio triggers for this integration */
  triggers?: ActiveTrigger[];
  onConnect: () => void;
  onDisconnect: () => void | Promise<void>;
  onReconfigure: () => void;
  onTest: () => Promise<void>;
  /** Callback to create a new Composio trigger */
  onCreateTrigger?: (type: string, slug: string) => void;
  /** Callback to delete a Composio trigger */
  onDeleteTrigger?: (triggerId: string) => void;
}

const PHASE_LABELS: Record<IntegrationPhase, string> = {
  mvp: '',
  v1: 'Coming Soon',
  v2: 'Coming Soon',
  v3: 'Coming Soon',
};

/**
 * Integration card for the full integrations management page.
 * Shows different states: Available, Connected, Error, Disconnected.
 * MVP integrations have active connect buttons.
 * v1/v2/v3 integrations show "Coming Soon" badges with disabled buttons.
 *
 * For oauth integrations, disconnect triggers an inline confirmation dialog
 * (preserving the UX previously in SlackIntegrationSettings).
 */
export function IntegrationCard({
  type,
  name,
  description,
  iconSrc,
  brandColor,
  phase,
  status,
  lastTestedAt,
  connectedBy,
  isStale,
  differentiator,
  connectionStrategy,
  authType,
  readOnly = false,
  triggers = [],
  onConnect,
  onDisconnect,
  onReconfigure,
  onTest,
  onCreateTrigger,
  onDeleteTrigger,
}: IntegrationCardProps) {
  const t = useTranslations('dashboard.integrations');
  const { addToast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [showTriggerDropdown, setShowTriggerDropdown] = useState(false);
  // OAuth disconnect confirmation dialog state (replaces SlackIntegrationSettings dialog)
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Derive effective strategy: prefer connectionStrategy, fall back to authType for backward compat
  const effectiveStrategy =
    connectionStrategy ?? (authType === 'credential' ? 'credential' : 'oauth');
  const isOAuth = effectiveStrategy === 'oauth';
  const isCredential = effectiveStrategy === 'credential';

  const catalogTriggers = TRIGGER_CATALOG[type] ?? [];
  const availableTriggers = catalogTriggers.filter(
    (entry) => !triggers.some((existing) => existing.triggerSlug === entry.slug),
  );

  const isConnected = status === 'connected';
  const isError = status === 'error';
  const isAvailable = status === 'available' || status === 'disconnected';
  const isComingSoon = phase !== 'mvp';

  const borderClass = isConnected
    ? 'border-success/60/30 bg-success/50/5'
    : isError
      ? 'border-destructive/60/30 bg-destructive/50/5'
      : isComingSoon
        ? 'border-border bg-card/60 opacity-80'
        : 'border-border bg-card hover:border-primary/30 hover:shadow-sm';

  async function handleTest() {
    setIsTesting(true);
    try {
      await onTest();
    } finally {
      setIsTesting(false);
    }
  }

  /**
   * For OAuth integrations, clicking disconnect opens a confirmation dialog.
   * For credential integrations, disconnect is immediate (no dialog).
   */
  function handleDisconnectClick() {
    if (isOAuth) {
      setShowDisconnectDialog(true);
    } else {
      onDisconnect();
    }
  }

  async function handleDisconnectConfirm() {
    setIsDisconnecting(true);
    try {
      await onDisconnect();
      setShowDisconnectDialog(false);
      addToast(t('disconnect.successToast', { name }), 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      addToast(msg, 'error');
    } finally {
      setIsDisconnecting(false);
    }
  }

  const lastTestedLabel = lastTestedAt
    ? t('card.lastTested', { time: formatRelativeTime(lastTestedAt) })
    : null;

  return (
    <div
      className={[
        'relative flex flex-col gap-3 rounded-xl border p-4 transition-all duration-200',
        borderClass,
      ].join(' ')}
    >
      {/* Stale warning badge */}
      {isStale && isConnected && (
        <div className="absolute top-3 right-3 rounded-full bg-warning/50/10 border border-warning/60/20 px-2 py-0.5 text-xs font-medium text-warning">
          {t('card.staleWarning')}
        </div>
      )}

      {/* Coming Soon badge */}
      {isComingSoon && !isStale && (
        <div className="absolute top-3 right-3 rounded-full bg-muted border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {PHASE_LABELS[phase]}
        </div>
      )}

      {/* Icon + name + status */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-border shrink-0 overflow-hidden"
          style={{ backgroundColor: `${brandColor}15` }}
        >
          <Image
            src={iconSrc}
            alt={`${name} logo`}
            width={28}
            height={28}
            className="object-contain"
            unoptimized
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-tight truncate">{name}</h3>
          {!isAvailable && !isComingSoon && (
            <StatusIndicator status={status as IntegrationStatus} className="mt-0.5" />
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed flex-1">{description}</p>

      {/* Differentiator note */}
      {differentiator && (
        <p className="text-xs font-medium text-primary/80 leading-snug">{differentiator}</p>
      )}

      {/* Connected info */}
      {(isConnected || isError) && (
        <div className="space-y-0.5">
          {isCredential && lastTestedLabel && (
            <p className="text-xs text-muted-foreground">{lastTestedLabel}</p>
          )}
          {connectedBy && !connectedBy.startsWith('user_') && (
            <p className="text-xs text-muted-foreground">
              {t('card.connectedBy', { name: connectedBy })}
            </p>
          )}
        </div>
      )}

      {/* Action buttons — hidden in read-only (Member) mode or for coming-soon integrations */}
      {/* Credential-based (AWS): "Connect" button opens modal */}
      {!readOnly && !isComingSoon && isAvailable && isCredential && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full mt-1"
          onClick={onConnect}
          aria-label={`${t('card.connectButton')} ${name}`}
        >
          {t('card.connectButton')}
        </Button>
      )}

      {/* Disabled placeholder button for coming-soon */}
      {isComingSoon && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full mt-1 cursor-not-allowed opacity-50"
          disabled
          aria-label={`${name} — Coming soon`}
        >
          {t('card.connectButton')}
        </Button>
      )}

      {!readOnly && !isComingSoon && isError && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full mt-1 border-destructive/60/30 text-destructive hover:bg-destructive/50/10"
          onClick={onReconfigure}
          aria-label={`${t('card.reconnectButton')} ${name}`}
        >
          {t('card.reconnectButton')}
        </Button>
      )}

      {!readOnly && !isComingSoon && isConnected && (
        <div className="flex gap-2 mt-1">
          {/* Test connection — only for credential-based integrations (AWS) */}
          {isCredential && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleTest}
              disabled={isTesting}
              aria-label={`${t('card.testButton')} ${name}`}
            >
              {isTesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span className="ml-1 text-xs">{t('card.testButton')}</span>
            </Button>
          )}

          {/* Reconfigure (credential) / Reauthorize (OAuth) — same onClick, different label+icon */}
          {isOAuth ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReconfigure}
              aria-label={`${t('card.reauthorizeButton')} ${name}`}
              title={t('card.reauthorizeTooltip')}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReconfigure}
              aria-label={`${t('card.reconfigureButton')} ${name}`}
              title={t('card.reconfigureTooltip')}
            >
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          )}

          {/* Disconnect — for OAuth opens confirmation dialog; for credential disconnects directly */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDisconnectClick}
            aria-label={`${t('card.disconnectButton')} ${name}`}
            className="text-destructive hover:bg-destructive/10 border-destructive/30"
            title={t('card.disconnectButton')}
          >
            <Unplug className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      )}

      {/* OAuth disconnect confirmation dialog (replaces SlackIntegrationSettings inline dialog) */}
      {isOAuth && (
        <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('disconnect.title', { name })}</DialogTitle>
              <DialogDescription>{t('disconnect.warning', { name })}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDisconnectDialog(false)}
                disabled={isDisconnecting}
              >
                {t('disconnect.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDisconnectConfirm}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" aria-hidden="true" />
                ) : null}
                {t('disconnect.confirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* OAuth authorize button — all OAuth integrations use Composio popup */}
      {!readOnly && !isComingSoon && isOAuth && isAvailable && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full mt-1"
          onClick={onConnect}
          aria-label={`${t('card.authorizeButton')} ${name}`}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
          {t('card.authorizeButton')} {name}
        </Button>
      )}

      {/* Active triggers section */}
      {!readOnly && !isComingSoon && isConnected && triggers.length > 0 && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Triggers ({triggers.length})</p>
          {triggers.map((trigger) => (
            <div
              key={trigger.triggerId}
              className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-2 py-1.5"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {trigger.triggerSlug}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {trigger.status === 'active' ? 'Active' : 'Paused'}
                  {trigger.eventCount != null && ` · ${trigger.eventCount} events`}
                </p>
              </div>
              {onDeleteTrigger && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                  onClick={() => onDeleteTrigger(trigger.triggerId)}
                  aria-label={`Delete trigger ${trigger.triggerSlug}`}
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add trigger dropdown for connected OAuth integrations */}
      {!readOnly && !isComingSoon && isConnected && isOAuth && onCreateTrigger && (
        <div className="relative mt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={catalogTriggers.length === 0}
            onClick={() => setShowTriggerDropdown((prev) => !prev)}
            aria-label={`Add trigger for ${name}`}
          >
            <Zap className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            <span className="text-xs">Add Trigger</span>
            <ChevronDown className="h-3 w-3 ml-auto" aria-hidden="true" />
          </Button>
          {showTriggerDropdown && (
            <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
              {availableTriggers.length > 0 ? (
                availableTriggers.map((trigger) => (
                  <button
                    key={trigger.slug}
                    type="button"
                    className="flex w-full items-center px-3 py-2 text-xs text-foreground hover:bg-accent transition-colors first:rounded-t-md last:rounded-b-md"
                    onClick={() => {
                      onCreateTrigger(type, trigger.slug);
                      setShowTriggerDropdown(false);
                    }}
                  >
                    {trigger.labelKey.includes('.') ? t(trigger.labelKey) : trigger.labelKey}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-muted-foreground first:rounded-t-md last:rounded-b-md">
                  {catalogTriggers.length > 0
                    ? t('card.allTriggersAdded')
                    : t('card.noTriggersSupported')}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
