'use client';

import { Search, Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { PERMISSION } from '@/contexts/identity/domain/rbac/permissions';
import { usePermission } from '@/contexts/identity/domain/rbac/role-guard';
import type {
  ActiveTrigger,
  IntegrationStatus,
  SentryIntegrationStatus,
  TriggerDto,
} from '@/contexts/integrations/domain/types';
import { useToast } from '@/contexts/shared/presentation/components/toast-provider';
import { CategoryFilter, type IntegrationCategory } from './category-filter';
import { ConnectionModal } from './connection-modal';
import { DisconnectDialog } from './disconnect-dialog';
import { IntegrationCard } from './integration-card';
import { IntegrationsSkeleton } from './integrations-skeleton';
import { SentrySetupModal } from './sentry-setup-modal';
import { SentryStatusPill } from './sentry-status-pill';
import { isStaleConnection } from './stale-connection';
import { WebhookSetupModal } from './webhook-setup-modal';

interface IntegrationsClientProps {
  /**
   * Sentry webhook URL the user pastes into Sentry's Internal Integration.
   * Derived server-side from Clerk's `org_id` (W4 invariant) — see
   * `integrations-page.tsx`.
   */
  sentryWebhookUrl: string;
}

/** Provider from the backend catalog endpoint */
interface CatalogProvider {
  id: string;
  name: string;
  category: string;
  type: 'oauth' | 'credential';
  description: string;
  /** Logo URL from Composio CDN */
  logo?: string;
  setup?: {
    accountId: string;
    externalId: string;
    trustPolicyPrincipal: string;
  };
}

/** Connected integration from backend */
interface ApiIntegration {
  type: string;
  provider: string;
  name: string;
  status: string;
  source?: string;
  lastTestedAt?: string;
  connectedBy?: string;
  createdAt: string;
}

/** Icon and brand color mapping for known providers */
/** Local icons for providers where we have SVGs. Composio CDN is used as fallback. */
const PROVIDER_ICONS: Record<string, { icon: string; color: string }> = {
  aws: { icon: '/icons/integrations/aws-cloudwatch.svg', color: '#FF9900' },
  slack: { icon: '/icons/integrations/slack.svg', color: '#4A154B' },
  github: { icon: '/icons/integrations/github.svg', color: '#181717' },
  jira: { icon: '/icons/integrations/jira.svg', color: '#0052CC' },
  hubspot: { icon: '/icons/integrations/hubspot.svg', color: '#FF7A59' },
  trello: { icon: '/icons/integrations/trello.svg', color: '#0052CC' },
  sentry: { icon: '/icons/integrations/sentry.svg', color: '#362D59' },
  linear: { icon: '/icons/integrations/linear.svg', color: '#5E6AD2' },
  datadog: { icon: '/icons/integrations/datadog.svg', color: '#632CA6' },
  pagerduty: { icon: '/icons/integrations/pagerduty.svg', color: '#06AC38' },
  confluence: { icon: '/icons/integrations/confluence.svg', color: '#172B4D' },
  grafana: { icon: '/icons/integrations/grafana.svg', color: '#F46800' },
  postgresql: { icon: '/icons/integrations/postgresql.svg', color: '#4169E1' },
  mongodb: { icon: '/icons/integrations/mongodb.svg', color: '#47A248' },
  teams: { icon: '/icons/integrations/teams.svg', color: '#5059C9' },
};

const DEFAULT_ICON = { icon: '/icons/integrations/webhook.svg', color: '#6B7280' };

/** Opens a centered popup window for OAuth authorization. */
function openOAuthPopup(url: string) {
  const w = 600;
  const h = 700;
  const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - h) / 2);
  window.open(url, '_blank', `width=${w},height=${h},left=${left},top=${top}`);
}

/** Map backend categories to frontend filter categories */
function mapCategory(backendCategory: string): IntegrationCategory {
  const map: Record<string, IntegrationCategory> = {
    cloud: 'monitoring',
    code: 'code',
    communication: 'communication',
    project: 'management',
    monitoring: 'monitoring',
    knowledge: 'knowledge',
    crm: 'crm',
  };
  return map[backendCategory] ?? 'all';
}

/**
 * Client component for the integrations management page.
 * Fetches the integration catalog from the backend and renders cards dynamically.
 * All integrations except AWS use Composio OAuth.
 */
export function IntegrationsClient({ sentryWebhookUrl }: IntegrationsClientProps) {
  const t = useTranslations('dashboard.integrations');
  const tSentrySetup = useTranslations('dashboard.integrations.sentrySetup');
  const canManageIntegrations = usePermission(PERMISSION.MANAGE_INTEGRATIONS);
  const { addToast } = useToast();

  const [catalog, setCatalog] = useState<CatalogProvider[]>([]);
  const [integrations, setIntegrations] = useState<ApiIntegration[]>([]);
  const [triggers, setTriggers] = useState<ActiveTrigger[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<IntegrationCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Modal / dialog state
  const [connectModal, setConnectModal] = useState<{
    provider: CatalogProvider;
    isReconfigure: boolean;
  } | null>(null);
  const [disconnectDialog, setDisconnectDialog] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [webhookSetup, setWebhookSetup] = useState<{
    provider: string;
    providerName: string;
    webhookUrl: string;
  } | null>(null);
  // Sentry-specific state — its own modal flow distinct from the Composio
  // webhook trigger flow because Sentry uses an Internal Integration with a
  // pre-shared Client Secret rather than OAuth.
  const [sentryStatus, setSentryStatus] = useState<SentryIntegrationStatus | null>(null);
  const [sentrySetupOpen, setSentrySetupOpen] = useState(false);

  const fetchCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/catalog');
      if (res.ok) {
        const data = (await res.json()) as { providers: CatalogProvider[] };
        setCatalog(data.providers);
      }
    } catch {
      // Catalog fetch failed — page shows empty
    }
  }, []);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations');
      if (res.ok) {
        const data = (await res.json()) as { integrations: ApiIntegration[] };
        setIntegrations(data.integrations);
      }
    } catch {
      // Silently handle
    }
  }, []);

  const fetchTriggers = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/triggers');
      if (res.ok) {
        const data = (await res.json()) as { triggers: ActiveTrigger[] };
        setTriggers(data.triggers);
      }
    } catch {
      // Silently handle
    }
  }, []);

  const fetchSentryStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/sentry');
      if (res.ok) {
        const data = (await res.json()) as SentryIntegrationStatus;
        setSentryStatus(data);
      }
    } catch {
      // Silently handle — pill falls back to "setup_required"
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetchCatalog(),
      fetchIntegrations(),
      fetchTriggers(),
      fetchSentryStatus(),
    ]).finally(() => setIsLoading(false));
  }, [fetchCatalog, fetchIntegrations, fetchTriggers, fetchSentryStatus]);

  // Listen for OAuth popup callback messages
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'oauth-callback' && data.success) {
          void fetchIntegrations();
          void fetchTriggers();
        }
      } catch {
        // Ignore non-JSON messages
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchIntegrations, fetchTriggers]);

  // Fallback: refresh integrations when tab regains focus (handles cases where
  // the Composio popup/modal closes without sending postMessage)
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        void fetchIntegrations();
        void fetchTriggers();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchIntegrations, fetchTriggers]);

  function getConnectionStatus(providerId: string): {
    status: IntegrationStatus | 'available';
    lastTestedAt?: string;
    connectedBy?: string;
  } {
    const found = integrations.find((i) => i.type === providerId || i.provider === providerId);
    if (!found || found.status === 'disconnected' || found.status === 'inactive') {
      return { status: 'available' };
    }
    return {
      status: (found.status === 'active' ? 'connected' : found.status) as IntegrationStatus,
      lastTestedAt: found.lastTestedAt,
      connectedBy: found.connectedBy,
    };
  }

  // Build card list from backend catalog
  const allCards = catalog.map((provider) => {
    const { status, lastTestedAt, connectedBy } = getConnectionStatus(provider.id);
    const visual = PROVIDER_ICONS[provider.id];
    // Prefer local icon (guaranteed to work), fallback to backend logo (Composio CDN)
    const icon = visual?.icon ?? provider.logo ?? DEFAULT_ICON.icon;
    const color = visual?.color ?? DEFAULT_ICON.color;
    return {
      id: provider.id,
      name: provider.name,
      description: provider.description,
      category: mapCategory(provider.category),
      icon,
      color,
      type: provider.type,
      status,
      lastTestedAt,
      connectedBy,
      isStale: isStaleConnection(lastTestedAt),
      setup: provider.setup,
    };
  });

  // Apply category filter
  const categoryFiltered =
    selectedCategory === 'all'
      ? allCards
      : allCards.filter((card) => card.category === selectedCategory);

  // Apply search filter
  const filtered = searchQuery.trim()
    ? categoryFiltered.filter((card) => card.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : categoryFiltered;

  function handleConnect(id: string) {
    const provider = catalog.find((p) => p.id === id);
    if (!provider) return;

    // OSS stub upstream — Core-owned mock/test-app connector (AC-055).
    // One-click connect via BFF → Core POST /v1/integrations/stub/connect.
    // Never opens Composio and never uses Playwright page.route fakes.
    if (id === 'stub-upstream') {
      void handleStubConnect();
      return;
    }

    // Sentry uses Internal Integration with a Client Secret (not OAuth).
    if (id === 'sentry') {
      setSentrySetupOpen(true);
      return;
    }

    // AWS uses credential-based setup — opens modal
    if (provider.type === 'credential') {
      setConnectModal({ provider, isReconfigure: false });
      return;
    }

    // All OAuth integrations — open Composio popup
    openOAuthPopup(`/api/integrations/oauth/${id}/authorize`);
  }

  async function handleStubConnect() {
    try {
      const res = await fetch('/api/integrations/stub/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        let message = `Failed to connect stub upstream (HTTP ${res.status})`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) message = data.error;
        } catch {
          // keep default
        }
        addToast(t('connectErrorToast', { message }), 'error');
        return;
      }
      addToast(t('connectedToast', { provider: 'Stub Upstream (OSS)' }), 'success');
      await fetchIntegrations();
    } catch {
      addToast(t('connectErrorToast', { message: 'network error' }), 'error');
    }
  }

  /**
   * Forwards the Client Secret once to the Next.js BFF, which proxies to Core.
   * Throws on error so the modal can render the message inline. NEVER logs the
   * secret value (the modal also clears it from state immediately on success).
   */
  async function handleSentrySubmit(clientSecret: string) {
    const res = await fetch('/api/integrations/sentry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientSecret }),
    });
    if (!res.ok) {
      let message = tSentrySetup('errorToast', { message: `HTTP ${res.status}` });
      try {
        const data = (await res.json()) as { error?: string };
        if (data.error) message = data.error;
      } catch {
        // keep default message
      }
      addToast(message, 'error');
      throw new Error(message);
    }
    addToast(tSentrySetup('successToast'), 'success');
    // Refetch so the pill flips to "Awaiting first event from Sentry".
    void fetchSentryStatus();
  }

  function handleReconfigure(id: string) {
    const provider = catalog.find((p) => p.id === id);
    if (!provider) return;
    // OAuth integrations: go straight to re-authorize popup
    if (provider.type === 'oauth') {
      openOAuthPopup(`/api/integrations/oauth/${id}/authorize`);
      return;
    }
    // Credential integrations: open modal form
    setConnectModal({ provider, isReconfigure: true });
  }

  function handleDisconnect(id: string) {
    const provider = catalog.find((p) => p.id === id);
    if (!provider) return;
    setDisconnectDialog({ id, name: provider.name });
  }

  async function handleTest(id: string, name: string) {
    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: id }),
      });
      const data = (await res.json()) as { success: boolean };
      if (data.success) {
        setIntegrations((prev) =>
          prev.map((i) =>
            i.type === id || i.provider === id
              ? { ...i, lastTestedAt: new Date().toISOString() }
              : i,
          ),
        );
        addToast(t('testResult.success', { name }), 'success');
      } else {
        addToast(t('testResult.error', { name }), 'error');
      }
    } catch {
      addToast(t('testResult.error', { name }), 'error');
    }
  }

  async function handleDisconnectConfirm(id: string) {
    const res = await fetch(`/api/integrations/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setIntegrations((prev) =>
        prev.map((i) =>
          i.type === id || i.provider === id ? { ...i, status: 'disconnected' } : i,
        ),
      );
    }
  }

  async function handleCreateTrigger(type: string, slug: string) {
    try {
      const res = await fetch('/api/integrations/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: type, triggerSlug: slug }),
      });
      if (res.ok) {
        const data = (await res.json()) as { trigger: TriggerDto; webhookUrl?: string };
        void fetchTriggers();
        // Sentry uses the Internal Integration flow (Client Secret) — never the
        // generic webhook setup modal, even if the backend returns a webhookUrl.
        if (type === 'sentry') {
          setSentrySetupOpen(true);
          return;
        }
        if (data.webhookUrl) {
          const providerEntry = catalog.find((p) => p.id === type);
          const providerName = providerEntry?.name ?? type;
          setWebhookSetup({ provider: type, providerName, webhookUrl: data.webhookUrl });
        }
      } else {
        let msg = t('trigger.createError');
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) msg = data.error;
        } catch {
          // use default message
        }
        addToast(msg, 'error');
      }
    } catch {
      addToast(t('trigger.createError'), 'error');
    }
  }

  async function handleDeleteTrigger(triggerId: string) {
    try {
      const res = await fetch(`/api/integrations/triggers/${triggerId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setTriggers((prev) => prev.filter((t_) => t_.triggerId !== triggerId));
      }
    } catch {
      // Silently handle
    }
  }

  function handleConnectSuccess() {
    void fetchIntegrations();
    void fetchTriggers();
  }

  return (
    <div className="space-y-6">
      {/* Search + Category filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder={t('search.placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg placeholder:text-muted-foreground text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={t('search.placeholder')}
          />
        </div>
        <CategoryFilter selected={selectedCategory} onSelect={setSelectedCategory} />
      </div>

      {/* Integration cards grid */}
      {isLoading ? (
        <IntegrationsSkeleton />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
          <p className="text-sm font-medium text-foreground">{t('empty.title')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('empty.description')}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((card) => {
            const cardEl = (
              <IntegrationCard
                key={card.id}
                type={card.id as unknown as Parameters<typeof IntegrationCard>[0]['type']}
                name={card.name}
                description={card.description}
                iconSrc={card.icon}
                brandColor={card.color}
                phase="mvp"
                connectionStrategy={card.type}
                status={card.status}
                lastTestedAt={card.lastTestedAt}
                connectedBy={card.connectedBy}
                isStale={card.isStale}
                readOnly={!canManageIntegrations}
                triggers={triggers.filter((tr) => tr.provider === card.id)}
                onConnect={() => handleConnect(card.id)}
                onDisconnect={() => handleDisconnect(card.id)}
                onReconfigure={() => handleReconfigure(card.id)}
                onTest={() => handleTest(card.id, card.name)}
                onCreateTrigger={handleCreateTrigger}
                onDeleteTrigger={handleDeleteTrigger}
              />
            );

            // Sentry: overlay status pill + persistent "Show setup instructions"
            // affordance rendered in normal flow below the card so it cannot
            // overlap the Add Trigger dropdown chevron.
            if (card.id === 'stub-upstream') {
              return (
                <div key={card.id} data-testid="stub-upstream-card">
                  {cardEl}
                </div>
              );
            }

            if (card.id === 'sentry') {
              return (
                <div key={card.id} className="flex flex-col" data-testid="sentry-card-wrapper">
                  <div className="relative">
                    {cardEl}
                    {sentryStatus && (
                      <div className="absolute top-3 right-12 flex items-center gap-2 z-10">
                        <SentryStatusPill status={sentryStatus} />
                      </div>
                    )}
                  </div>
                  {canManageIntegrations && (
                    <button
                      type="button"
                      data-testid="sentry-show-setup-instructions"
                      onClick={() => setSentrySetupOpen(true)}
                      className="mt-2 self-end inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={tSentrySetup('showInstructions')}
                    >
                      <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{tSentrySetup('showInstructions')}</span>
                    </button>
                  )}
                </div>
              );
            }

            return cardEl;
          })}
        </div>
      )}

      {/* Connection modal — AWS credential setup or OAuth reconfigure */}
      {connectModal && (
        <ConnectionModal
          type={
            connectModal.provider.id as unknown as Parameters<typeof ConnectionModal>[0]['type']
          }
          name={connectModal.provider.name}
          isOpen={true}
          isReconfigure={connectModal.isReconfigure}
          awsSetup={connectModal.provider.setup}
          onClose={() => setConnectModal(null)}
          onSuccess={handleConnectSuccess}
        />
      )}

      {/* Disconnect dialog */}
      {disconnectDialog && (
        <DisconnectDialog
          type={disconnectDialog.id as unknown as Parameters<typeof DisconnectDialog>[0]['type']}
          name={disconnectDialog.name}
          isOpen={true}
          onClose={() => setDisconnectDialog(null)}
          onConfirm={() => handleDisconnectConfirm(disconnectDialog.id)}
        />
      )}

      {/* Webhook setup modal — shown after creating a webhook-only trigger */}
      {webhookSetup && (
        <WebhookSetupModal
          provider={webhookSetup.provider}
          providerName={webhookSetup.providerName}
          webhookUrl={webhookSetup.webhookUrl}
          isOpen={true}
          onClose={() => setWebhookSetup(null)}
        />
      )}

      {/* Sentry Internal Integration setup modal */}
      <SentrySetupModal
        webhookUrl={sentryWebhookUrl}
        isOpen={sentrySetupOpen}
        onClose={() => setSentrySetupOpen(false)}
        onSubmit={handleSentrySubmit}
      />
    </div>
  );
}
