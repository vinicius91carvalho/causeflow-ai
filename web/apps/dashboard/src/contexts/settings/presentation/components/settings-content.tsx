'use client';

import { cn } from '@causeflow/ui/lib';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Suspense, useEffect, useState } from 'react';
import { PERMISSION } from '@/contexts/identity/domain/rbac/permissions';
import { usePermission } from '@/contexts/identity/domain/rbac/role-guard';
import type { BusinessProfile } from '@/contexts/onboarding/domain/business-profile-types';
import type { NotificationSettings } from '@/contexts/settings/domain/types';
import { isStaging } from '@/lib/env/is-staging';
import { ApiKeysTab } from './api-keys-tab';
import { AppearanceTab } from './appearance-tab';
import { BusinessProfileCard } from './business-profile-card';
import { CompanyTab } from './company-tab';
import { NotificationsTab } from './notifications-tab';
import { ProfileTab } from './profile-tab';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey = 'profile' | 'company' | 'appearance' | 'apiKeys' | 'notifications';

interface TabConfig {
  key: TabKey;
  labelKey: 'profile' | 'company' | 'appearance' | 'apiKeys' | 'notifications';
  adminOnly?: boolean;
}

const TABS: TabConfig[] = [
  { key: 'profile', labelKey: 'profile' },
  { key: 'company', labelKey: 'company', adminOnly: true },
  { key: 'notifications', labelKey: 'notifications' },
  { key: 'appearance', labelKey: 'appearance' },
  { key: 'apiKeys', labelKey: 'apiKeys', adminOnly: true },
];

// ---------------------------------------------------------------------------
// Settings data shape returned from GET /api/settings
// ---------------------------------------------------------------------------

interface SettingsData {
  settings: {
    notifications: NotificationSettings;
    locale: string;
    theme: string;
  };
  profile: { name: string; email: string; role: string };
  company: {
    name: string;
    websiteUrl: string;
    teamSize: string | null;
    plan: string;
    slug?: string;
    autoRemediation?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Inner component (reads search params + loads settings data)
// ---------------------------------------------------------------------------

function SettingsPageInner() {
  const t = useTranslations('dashboard.settings');
  const searchParams = useSearchParams();
  const router = useRouter();
  const canManageSettings = usePermission(PERMISSION.MANAGE_SETTINGS);

  // Auto-switch to notifications tab when returning from Slack OAuth
  const slackConnected = searchParams.get('slack') === 'connected';
  const activeTab =
    (searchParams.get('tab') as TabKey | null) ?? (slackConnected ? 'notifications' : 'profile');

  const [settingsData, setSettingsData] = useState<SettingsData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);

  useEffect(() => {
    async function loadSettings() {
      setDataLoading(true);
      try {
        const [settingsRes, profileRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/onboarding/business-profile'),
        ]);
        if (settingsRes.ok) {
          const data = (await settingsRes.json()) as SettingsData;
          setSettingsData(data);
        }
        if (profileRes.ok) {
          const { profile } = (await profileRes.json()) as { profile: BusinessProfile | null };
          setBusinessProfile(profile);
        }
      } catch {
        // Keep null — tabs will use their own defaults
      } finally {
        setDataLoading(false);
      }
    }
    void loadSettings();
  }, []);

  function handleTabChange(tab: TabKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  // Visible tabs: all non-admin tabs + company tab only for admins
  const visibleTabs = TABS.filter((tab) => !tab.adminOnly || canManageSettings);

  // Ensure active tab is valid; fallback to profile
  const safeActiveTab = visibleTabs.some((t) => t.key === activeTab) ? activeTab : 'profile';

  // Map team size enum to display label
  function formatTeamSize(size: string | null | undefined): string {
    if (!size) return '—';
    const map: Record<string, string> = {
      '1_5': '1–5',
      '6_20': '6–20',
      '21_50': '21–50',
      '50plus': '50+',
    };
    return map[size] ?? size;
  }

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div
        role="tablist"
        aria-label={t('title')}
        className="flex border-b border-border overflow-x-auto scrollbar-none -mb-px"
      >
        {visibleTabs.map((tab) => {
          const isActive = tab.key === safeActiveTab;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`settings-tab-${tab.key}`}
              aria-selected={isActive}
              aria-controls={`settings-panel-${tab.key}`}
              onClick={() => handleTabChange(tab.key)}
              className={cn(
                'shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              {t(`tabs.${tab.labelKey}`)}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      <div className="pt-6">
        {safeActiveTab === 'profile' && (
          <div role="tabpanel" id="settings-panel-profile" aria-labelledby="settings-tab-profile">
            <ProfileTab />
          </div>
        )}
        {safeActiveTab === 'company' && (
          <div
            role="tabpanel"
            id="settings-panel-company"
            aria-labelledby="settings-tab-company"
            className="space-y-6"
          >
            {!dataLoading && (
              <>
                <CompanyTab
                  companyName={settingsData?.company.name ?? ''}
                  website={settingsData?.company.websiteUrl ?? ''}
                  teamSize={formatTeamSize(settingsData?.company.teamSize)}
                  plan={settingsData?.company.plan ?? 'free'}
                  companySlug={settingsData?.company.slug}
                  autoRemediation={settingsData?.company.autoRemediation ?? false}
                />
                {isStaging && (
                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-foreground">Agent context</h3>
                    <BusinessProfileCard
                      profile={businessProfile}
                      onResyncComplete={() => {
                        // Refresh profile state after resync
                        fetch('/api/onboarding/business-profile')
                          .then((r) => r.json())
                          .then(({ profile: p }: { profile: BusinessProfile | null }) =>
                            setBusinessProfile(p),
                          )
                          .catch(() => {
                            // Ignore fetch errors on refresh
                          });
                      }}
                    />
                  </div>
                )}
              </>
            )}
            {dataLoading && (
              <div className="space-y-4 animate-pulse">
                <div className="h-10 rounded bg-muted" />
                <div className="h-10 rounded bg-muted" />
                <div className="h-10 rounded bg-muted" />
              </div>
            )}
          </div>
        )}
        {safeActiveTab === 'appearance' && (
          <div
            role="tabpanel"
            id="settings-panel-appearance"
            aria-labelledby="settings-tab-appearance"
          >
            <AppearanceTab />
          </div>
        )}
        {safeActiveTab === 'notifications' && (
          <div
            role="tabpanel"
            id="settings-panel-notifications"
            aria-labelledby="settings-tab-notifications"
          >
            <NotificationsTab slackJustConnected={searchParams.get('slack') === 'connected'} />
          </div>
        )}
        {safeActiveTab === 'apiKeys' && (
          <div role="tabpanel" id="settings-panel-apiKeys" aria-labelledby="settings-tab-apiKeys">
            <ApiKeysTab />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component (wraps in Suspense for useSearchParams)
// ---------------------------------------------------------------------------

export function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsPageInner />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SettingsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex gap-4 border-b border-border pb-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-24 rounded bg-muted" />
        ))}
      </div>
      <div className="space-y-4">
        <div className="h-4 w-1/3 rounded bg-muted" />
        <div className="h-10 rounded bg-muted" />
        <div className="h-4 w-1/4 rounded bg-muted" />
        <div className="h-10 rounded bg-muted" />
      </div>
    </div>
  );
}
