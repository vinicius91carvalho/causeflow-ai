import { describe, expect, it } from 'vitest';
import { OSS_COMMERCIAL_MESSAGE_PATHS, stripCommercialMessages } from './strip-commercial-messages';

describe('stripCommercialMessages (AC-083)', () => {
  const sample = {
    dashboard: {
      choosePlan: {
        title: 'Choose Your Plan',
        startTrial: 'Start Free Trial',
        notAdminBody: 'Please ask your organization admin to log in and select a plan.',
      },
      billing: {
        title: 'Billing',
        description: 'Manage your plan and credits',
        upgrade: 'Upgrade',
        manageSubscription: 'Manage Subscription',
        planStarter: 'Starter',
        planPro: 'Pro',
        planBusiness: 'Business',
        planFree: 'Free',
        currentPlan: 'Current Plan',
      },
      onboarding: {
        steps: {
          welcome: { title: 'Welcome', description: 'Tour' },
          billing: {
            title: 'Credits & Plans',
            description:
              'You can check your balance, upgrade your plan, or manage your subscription from the Billing page.',
          },
          complete: { title: "You're All Set", description: 'Go' },
        },
      },
      settings: {
        company: {
          title: 'Company Settings',
          plan: 'Current Plan',
          upgradePlan: 'Upgrade Plan',
          save: 'Save Changes',
        },
      },
      home: {
        credits: {
          remaining: '{count} Credits Remaining',
          upgrade: 'Upgrade Plan',
        },
      },
      tour: {
        hq: 'YOUR HQ',
        billing: 'FIELD OFFICE — Billing',
        billingDesc: 'Track your credits, upgrade your plan, or purchase extra packs.',
        complete: 'MISSION BRIEFING COMPLETE',
      },
    },
  };

  it('removes choosePlan, billing commercial keys, onboarding billing step, settings plan CTAs, home upgrade, and tour billing', () => {
    const stripped = stripCommercialMessages(sample);

    expect(stripped.dashboard.choosePlan).toBeUndefined();
    expect(stripped.dashboard.onboarding.steps.billing).toBeUndefined();
    expect(stripped.dashboard.settings.company.upgradePlan).toBeUndefined();
    expect(stripped.dashboard.settings.company.plan).toBeUndefined();
    expect(stripped.dashboard.home.credits.upgrade).toBeUndefined();
    expect(stripped.dashboard.tour.billing).toBeUndefined();
    expect(stripped.dashboard.tour.billingDesc).toBeUndefined();

    expect(stripped.dashboard.billing.upgrade).toBeUndefined();
    expect(stripped.dashboard.billing.manageSubscription).toBeUndefined();
    expect(stripped.dashboard.billing.planStarter).toBeUndefined();
    expect(stripped.dashboard.billing.planPro).toBeUndefined();
    expect(stripped.dashboard.billing.planBusiness).toBeUndefined();

    // Non-commercial leftovers remain
    expect(stripped.dashboard.billing.title).toBe('Billing');
    expect(stripped.dashboard.billing.planFree).toBe('Free');
    expect(stripped.dashboard.onboarding.steps.welcome.title).toBe('Welcome');
    expect(stripped.dashboard.settings.company.save).toBe('Save Changes');
    expect(stripped.dashboard.home.credits.remaining).toBe('{count} Credits Remaining');
    expect(stripped.dashboard.tour.hq).toBe('YOUR HQ');
  });

  it('does not mutate the input tree', () => {
    const before = structuredClone(sample);
    stripCommercialMessages(sample);
    expect(sample).toEqual(before);
  });

  it('omits operator-facing paid-plan marker substrings after strip', () => {
    const stripped = stripCommercialMessages(sample);
    const serialized = JSON.stringify(stripped);

    expect(serialized).not.toMatch(/Choose Your Plan/i);
    expect(serialized).not.toMatch(/Select a plan/i);
    expect(serialized).not.toMatch(/Upgrade Plan/i);
    expect(serialized).not.toMatch(/upgrade your plan/i);
    expect(serialized).not.toMatch(/manage your subscription/i);
    expect(serialized).not.toMatch(/startTrial|Start Trial/i);
    expect(serialized).not.toMatch(/Credits & Plans/i);
    expect(serialized).not.toMatch(/\b(Starter|Pro|Business)\b.{0,120}\b(Starter|Pro|Business)\b/i);
  });

  it('declares the expected OSS commercial path list', () => {
    expect(OSS_COMMERCIAL_MESSAGE_PATHS).toEqual(
      expect.arrayContaining([
        ['dashboard', 'choosePlan'],
        ['dashboard', 'onboarding', 'steps', 'billing'],
        ['dashboard', 'settings', 'company', 'upgradePlan'],
        ['dashboard', 'home', 'credits', 'upgrade'],
        ['dashboard', 'tour', 'billingDesc'],
        ['dashboard', 'billing', 'manageSubscription'],
      ]),
    );
  });
});
