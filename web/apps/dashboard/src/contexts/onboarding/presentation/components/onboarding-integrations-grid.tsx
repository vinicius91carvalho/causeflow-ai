'use client';

import { INTEGRATIONS } from '@causeflow/shared/constants';
import { Check } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import type { IntegrationType } from '@/contexts/integrations/domain/types';
import { ConnectionModal } from '@/contexts/integrations/presentation/components/connection-modal';
import { CauseFlowLoader } from '@/contexts/shared/presentation/components/causeflow-loader';

const ONBOARDING_INTEGRATION_IDS = [
  'aws-cloudwatch',
  'github',
  'notion',
  'shortcut',
  'slack',
  'sentry',
  'datadog',
  'trello',
  'jira',
  'pagerduty',
  'zendesk',
  'intercom',
  'linear',
  'gitlab',
] as const;

type OnboardingIntegrationId = (typeof ONBOARDING_INTEGRATION_IDS)[number];

const ONBOARDING_AUTH_TYPES: Record<OnboardingIntegrationId, 'credential' | 'oauth'> = {
  'aws-cloudwatch': 'credential',
  github: 'oauth',
  notion: 'oauth',
  shortcut: 'oauth',
  slack: 'oauth',
  sentry: 'oauth',
  datadog: 'oauth',
  trello: 'oauth',
  jira: 'oauth',
  pagerduty: 'oauth',
  zendesk: 'oauth',
  intercom: 'oauth',
  linear: 'oauth',
  gitlab: 'oauth',
};

const ONBOARDING_ICONS: Record<string, { icon: string; color: string }> = {
  'aws-cloudwatch': { icon: '/icons/integrations/aws-cloudwatch.svg', color: '#FF9900' },
  slack: { icon: '/icons/integrations/slack.svg', color: '#4A154B' },
  github: { icon: '/icons/integrations/github.svg', color: '#181717' },
  jira: { icon: '/icons/integrations/jira.svg', color: '#0052CC' },
  trello: { icon: '/icons/integrations/trello.svg', color: '#0052CC' },
  notion: { icon: '/icons/integrations/notion.svg', color: '#000000' },
  shortcut: { icon: '/icons/integrations/shortcut.svg', color: '#58B1E4' },
  sentry: { icon: '/icons/integrations/sentry.svg', color: '#362D59' },
  linear: { icon: '/icons/integrations/linear.svg', color: '#5E6AD2' },
  datadog: { icon: '/icons/integrations/datadog.svg', color: '#632CA6' },
  pagerduty: { icon: '/icons/integrations/pagerduty.svg', color: '#06AC38' },
  zendesk: { icon: '/icons/integrations/zendesk.svg', color: '#03363D' },
  intercom: { icon: '/icons/integrations/intercom.svg', color: '#6AFDEF' },
  gitlab: { icon: '/icons/integrations/gitlab.svg', color: '#FC6D26' },
};

const DEFAULT_ICON = { icon: '/icons/integrations/webhook.svg', color: '#6B7280' };

function openOAuthPopup(url: string) {
  const w = 600;
  const h = 700;
  const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
  window.open(url, '_blank', `width=${w},height=${h},left=${left},top=${top}`);
}

export default function OnboardingIntegrationsGrid() {
  const t = useTranslations('dashboard.onboarding');
  const router = useRouter();
  const [connectedStatus, setConnectedStatus] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [awsSetup, setAwsSetup] = useState<
    | {
        accountId: string;
        externalId: string;
        trustPolicyPrincipal: string;
      }
    | undefined
  >(undefined);
  const [connectModal, setConnectModal] = useState<{
    id: OnboardingIntegrationId;
    name: string;
  } | null>(null);

  const onboardingIntegrations = ONBOARDING_INTEGRATION_IDS.map((id) => {
    const found = INTEGRATIONS.find((i) => i.id === id);
    const visual = ONBOARDING_ICONS[id] ?? DEFAULT_ICON;
    return {
      id,
      name: found?.name ?? id,
      description: found?.description ?? '',
      icon: visual.icon,
      color: visual.color,
      authType: ONBOARDING_AUTH_TYPES[id],
    };
  });

  const connectedCount = Object.values(connectedStatus).filter(Boolean).length;

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations');
      if (res.ok) {
        const data = (await res.json()) as {
          integrations: { type: string; provider: string; status: string }[];
        };
        const statusMap: Record<string, boolean> = {};
        for (const i of data.integrations) {
          const id =
            i.type === 'aws' || i.provider === 'aws' ? 'aws-cloudwatch' : (i.type ?? i.provider);
          if (i.status === 'active' || i.status === 'connected') {
            statusMap[id] = true;
          }
        }
        setConnectedStatus(statusMap);
      }
    } catch {
      // Silently handle fetch errors
    }
  }, []);

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/catalog');
      if (res.ok) {
        const data = (await res.json()) as {
          providers: {
            id: string;
            setup?: { accountId: string; externalId: string; trustPolicyPrincipal: string };
          }[];
        };
        const awsProvider = data.providers.find((p) => p.id === 'aws');
        if (awsProvider?.setup) {
          setAwsSetup(awsProvider.setup);
        }
      }
    } catch {
      // Silently handle catalog fetch errors
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchIntegrations(), fetchCatalog()]).finally(() => setIsLoading(false));
  }, [fetchIntegrations, fetchCatalog]);

  // Listen for OAuth popup callback messages
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'oauth-callback' && data.success) {
          void fetchIntegrations();
        }
      } catch {
        // Ignore non-JSON messages
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchIntegrations]);

  // Refresh on tab focus (handles popup close without postMessage)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        void fetchIntegrations();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchIntegrations]);

  function handleConnect(id: OnboardingIntegrationId, name: string) {
    if (ONBOARDING_AUTH_TYPES[id] === 'credential') {
      setConnectModal({ id, name });
    } else {
      const providerId = id === 'aws-cloudwatch' ? 'aws' : id;
      openOAuthPopup(`/api/integrations/oauth/${providerId}/authorize`);
    }
  }

  function handleConnectSuccess(_type: IntegrationType) {
    void fetchIntegrations();
    setConnectModal(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <CauseFlowLoader size="md" message="Loading integrations..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t('integrations.title')}
        </h1>
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          {t('integrations.description')}
        </p>
        {connectedCount > 0 && (
          <p className="text-sm font-medium text-primary" data-testid="progress-indicator">
            {t('integrations.progress', {
              count: connectedCount,
              total: ONBOARDING_INTEGRATION_IDS.length,
            })}
          </p>
        )}
      </div>

      {/* Integration cards grid */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
        data-testid="integrations-grid"
      >
        {onboardingIntegrations.map((integration) => {
          const isConnected = connectedStatus[integration.id] ?? false;
          const isOAuth = integration.authType === 'oauth';
          return (
            <div
              key={integration.id}
              className="relative flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-4 text-center"
              data-testid={`integration-card-${integration.id}`}
            >
              {isConnected && (
                <div
                  role="img"
                  className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-success/50"
                  aria-label={t('integrations.connected')}
                >
                  <Check className="h-3 w-3 text-white" aria-hidden="true" />
                </div>
              )}
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${integration.color}20` }}
              >
                <Image
                  src={integration.icon}
                  alt={integration.name}
                  width={32}
                  height={32}
                  className="object-contain"
                />
              </div>
              <div className="space-y-1 flex-1 w-full">
                <p className="text-sm font-medium text-foreground">{integration.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {integration.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleConnect(integration.id, integration.name)}
                disabled={isConnected}
                data-testid={`connect-btn-${integration.id}`}
                className={
                  isConnected
                    ? 'w-full rounded-lg border border-success/60/30 bg-success/50/10 px-3 py-1.5 text-xs text-success cursor-default'
                    : 'w-full rounded-lg border border-primary/30 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/10'
                }
              >
                {isConnected
                  ? t('integrations.connected')
                  : isOAuth
                    ? t('integrations.authorize')
                    : t('integrations.connect')}
              </button>
            </div>
          );
        })}
      </div>

      {/* More integrations link */}
      <div className="text-center">
        <Link
          href="/onboarding/business-profile"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          data-testid="more-integrations-link"
        >
          {t('integrations.moreIntegrations')}
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={() => router.push('/onboarding/business-profile')}
          className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          data-testid="skip-btn"
        >
          {t('integrations.skip')}
        </button>
        <button
          type="button"
          onClick={() => router.push('/onboarding/business-profile')}
          className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          data-testid="continue-btn"
        >
          {t('integrations.continue')}
        </button>
      </div>

      {/* Credential connection modal */}
      {connectModal && (
        <ConnectionModal
          type={
            (connectModal.id === 'aws-cloudwatch'
              ? 'aws'
              : connectModal.id) as unknown as IntegrationType
          }
          name={connectModal.name}
          isOpen={true}
          awsSetup={connectModal.id === 'aws-cloudwatch' ? awsSetup : undefined}
          onClose={() => setConnectModal(null)}
          onSuccess={handleConnectSuccess}
        />
      )}
    </div>
  );
}
