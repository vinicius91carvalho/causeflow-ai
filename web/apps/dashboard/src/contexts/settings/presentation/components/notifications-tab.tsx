'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { PERMISSION } from '@/contexts/identity/domain/rbac/permissions';
import { usePermission } from '@/contexts/identity/domain/rbac/role-guard';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';
import type { SlackConfigResponse } from '@/lib/api/core-api-types';

// ---------------------------------------------------------------------------
// Toggle switch
// ---------------------------------------------------------------------------

interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
}

function ToggleSwitch({ id, checked, onChange, disabled, label, description }: ToggleSwitchProps) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-foreground cursor-pointer">
          {label}
        </label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200',
          'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          checked ? 'bg-primary' : 'bg-muted',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-5' : 'translate-x-0.5',
          ].join(' ')}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slack notification section
// ---------------------------------------------------------------------------

export function SlackNotificationSection() {
  const t = useTranslations('dashboard.settings.notifications');
  const { addToast } = useToast();
  const canManage = usePermission(PERMISSION.MANAGE_SETTINGS);

  const [slackConfig, setSlackConfig] = useState<SlackConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetch('/api/integrations/slack/config')
      .then((r) => (r.ok ? (r.json() as Promise<SlackConfigResponse>) : null))
      .then((data) => setSlackConfig(data))
      .catch(() => setSlackConfig(null))
      .finally(() => setLoading(false));
  }, []);

  function handleConnect() {
    window.location.href = '/api/integrations/slack/oauth';
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/integrations/slack/disconnect', { method: 'DELETE' });
      if (res.ok || res.status === 204) {
        setSlackConfig({ connected: false });
        addToast(t('slackDisconnectSuccess'), 'success');
      } else {
        addToast(t('slackDisconnectError'), 'error');
      }
    } catch {
      addToast(t('slackDisconnectError'), 'error');
    } finally {
      setDisconnecting(false);
    }
  }

  if (loading) {
    return <div className="h-16 rounded-lg bg-muted animate-pulse" />;
  }

  const isConnected = slackConfig?.connected ?? false;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-[#4A154B]/10">
          {/* Slack icon */}
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path
              fill="#4A154B"
              d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-foreground">Slack</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{t('slackDescription')}</p>
        </div>
        {isConnected && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success border border-success/20">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            {t('slackConnected')}
          </span>
        )}
      </div>

      {/* Connected details */}
      {isConnected && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          {slackConfig?.workspaceName && (
            <div>
              <p className="text-muted-foreground">{t('slackWorkspace')}</p>
              <p className="font-medium text-foreground mt-0.5">{slackConfig.workspaceName}</p>
            </div>
          )}
          {slackConfig?.channel && (
            <div>
              <p className="text-muted-foreground">{t('slackChannel')}</p>
              <p className="font-medium text-foreground mt-0.5">{slackConfig.channel}</p>
            </div>
          )}
        </div>
      )}

      {/* Action */}
      {!canManage ? (
        <p className="text-xs text-muted-foreground">{t('slackAdminOnly')}</p>
      ) : isConnected ? (
        <button
          type="button"
          disabled={disconnecting}
          onClick={handleDisconnect}
          className="text-xs text-destructive hover:underline focus:outline-none focus:underline disabled:opacity-50"
        >
          {disconnecting ? t('slackDisconnecting') : t('slackDisconnect')}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
            <path
              fill="#4A154B"
              d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"
            />
          </svg>
          {t('slackConnect')}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notifications tab
// ---------------------------------------------------------------------------

interface NotificationPrefs {
  analysisComplete: boolean;
  creditWarning: boolean;
  teamInvite: boolean;
  weeklyDigest: boolean;
}

interface NotificationsTabProps {
  initialPrefs?: Partial<NotificationPrefs>;
  /** When present, auto-show success toast (after Slack OAuth redirect) */
  slackJustConnected?: boolean;
}

export function NotificationsTab({ initialPrefs, slackJustConnected }: NotificationsTabProps) {
  const t = useTranslations('dashboard.settings.notifications');
  const { addToast } = useToast();

  const [prefs, setPrefs] = useState<NotificationPrefs>({
    analysisComplete: initialPrefs?.analysisComplete ?? true,
    creditWarning: initialPrefs?.creditWarning ?? true,
    teamInvite: initialPrefs?.teamInvite ?? true,
    weeklyDigest: initialPrefs?.weeklyDigest ?? false,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (slackJustConnected) {
      addToast(t('slackConnectSuccess'), 'success');
    }
  }, [slackJustConnected, addToast, t]);

  function setKey(key: keyof NotificationPrefs) {
    return (value: boolean) => setPrefs((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifications: {
            emailOnComplete: prefs.analysisComplete,
            emailOnError: prefs.creditWarning,
            slackOnComplete: prefs.weeklyDigest,
            slackOnError: prefs.teamInvite,
          },
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
    <div className="space-y-8">
      {/* Slack section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{t('slackSection')}</h3>
        <SlackNotificationSection />
      </div>

      {/* Email section */}
      <form onSubmit={handleSave} noValidate className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">{t('emailSection')}</h3>
          <div className="space-y-5 mt-4">
            <ToggleSwitch
              id="notif-analysis-complete"
              checked={prefs.analysisComplete}
              onChange={setKey('analysisComplete')}
              disabled={isSaving}
              label={t('analysisComplete')}
              description={t('analysisCompleteDescription')}
            />
            <ToggleSwitch
              id="notif-credit-warning"
              checked={prefs.creditWarning}
              onChange={setKey('creditWarning')}
              disabled={isSaving}
              label={t('creditWarning')}
              description={t('creditWarningDescription')}
            />
            <ToggleSwitch
              id="notif-team-invite"
              checked={prefs.teamInvite}
              onChange={setKey('teamInvite')}
              disabled={isSaving}
              label={t('teamInvite')}
              description={t('teamInviteDescription')}
            />
            <ToggleSwitch
              id="notif-weekly-digest"
              checked={prefs.weeklyDigest}
              onChange={setKey('weeklyDigest')}
              disabled={isSaving}
              label={t('weeklyDigest')}
              description={t('weeklyDigestDescription')}
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                {t('saving')}
              </>
            ) : (
              t('save')
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
