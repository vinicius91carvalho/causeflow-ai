import { UserProfile } from '@clerk/nextjs';
import { ApiKeysTab } from '@/contexts/settings/presentation/components/api-keys-tab';
import { BusinessProfileCardWrapper } from '@/contexts/settings/presentation/components/business-profile-card-wrapper';
import { FireTestErrorsCard } from '@/contexts/settings/presentation/components/fire-test-errors-card';
import { SlackNotificationSection } from '@/contexts/settings/presentation/components/notifications-tab';
import { isStaging } from '@/lib/env/is-staging';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 py-8">
      <UserProfile
        routing="hash"
        appearance={{
          elements: {
            rootBox: 'w-full',
            card: 'shadow-none border border-border bg-card',
            navbar: 'bg-card',
            navbarButton: 'text-foreground',
            pageScrollBox: 'bg-card',
            page: 'bg-card',
            profileSection: 'border-border',
            profileSectionContent: 'border-border',
            profileSectionHeader: 'border-border',
            formFieldInput: 'bg-background border-border text-foreground',
            accordionTriggerButton: 'text-foreground',
            accordionContent: 'bg-card border-border',
          },
        }}
      />

      {/* Slack Notifications — CauseFlow AI Slack App */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Slack Notifications</h3>
        <SlackNotificationSection />
      </div>

      <ApiKeysTab />

      {/* Staging-only developer tools */}
      {isStaging && (
        <div className="space-y-4 rounded-lg border border-dashed border-warning/40 p-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Developer Tools</h3>
            <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-warning">
              Staging only
            </span>
          </div>
          <FireTestErrorsCard />
          <BusinessProfileCardWrapper />
          <a
            href="/onboarding/integrations"
            className="flex items-center justify-center rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
          >
            Test Onboarding Integrations Page
          </a>
        </div>
      )}
    </div>
  );
}
