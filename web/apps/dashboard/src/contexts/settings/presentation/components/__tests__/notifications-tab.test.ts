import { describe, expect, it } from 'vitest';

// Unit tests for notifications preferences logic

interface NotificationPrefs {
  analysisComplete: boolean;
  creditWarning: boolean;
  teamInvite: boolean;
  weeklyDigest: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  analysisComplete: true,
  creditWarning: true,
  teamInvite: true,
  weeklyDigest: false,
};

function mergePrefs(
  initial: Partial<NotificationPrefs>,
  defaults: NotificationPrefs,
): NotificationPrefs {
  return {
    analysisComplete: initial.analysisComplete ?? defaults.analysisComplete,
    creditWarning: initial.creditWarning ?? defaults.creditWarning,
    teamInvite: initial.teamInvite ?? defaults.teamInvite,
    weeklyDigest: initial.weeklyDigest ?? defaults.weeklyDigest,
  };
}

function toApiPayload(prefs: NotificationPrefs) {
  return {
    notifications: {
      emailOnComplete: prefs.analysisComplete,
      emailOnError: prefs.creditWarning,
      slackOnComplete: prefs.weeklyDigest,
      slackOnError: prefs.teamInvite,
    },
  };
}

describe('Notifications Tab - prefs merging', () => {
  it('uses defaults when no initial prefs provided', () => {
    const prefs = mergePrefs({}, DEFAULT_PREFS);
    expect(prefs.analysisComplete).toBe(true);
    expect(prefs.creditWarning).toBe(true);
    expect(prefs.teamInvite).toBe(true);
    expect(prefs.weeklyDigest).toBe(false);
  });

  it('overrides defaults with provided values', () => {
    const prefs = mergePrefs({ analysisComplete: false, weeklyDigest: true }, DEFAULT_PREFS);
    expect(prefs.analysisComplete).toBe(false);
    expect(prefs.weeklyDigest).toBe(true);
    expect(prefs.creditWarning).toBe(true); // still default
  });

  it('handles all false prefs', () => {
    const prefs = mergePrefs(
      { analysisComplete: false, creditWarning: false, teamInvite: false, weeklyDigest: false },
      DEFAULT_PREFS,
    );
    expect(prefs.analysisComplete).toBe(false);
    expect(prefs.weeklyDigest).toBe(false);
  });
});

describe('Notifications Tab - API payload mapping', () => {
  it('maps UI prefs to API format correctly', () => {
    const prefs: NotificationPrefs = {
      analysisComplete: true,
      creditWarning: false,
      teamInvite: true,
      weeklyDigest: true,
    };
    const payload = toApiPayload(prefs);
    expect(payload.notifications.emailOnComplete).toBe(true);
    expect(payload.notifications.emailOnError).toBe(false);
    expect(payload.notifications.slackOnComplete).toBe(true);
    expect(payload.notifications.slackOnError).toBe(true);
  });

  it('all-false maps to all-false', () => {
    const prefs: NotificationPrefs = {
      analysisComplete: false,
      creditWarning: false,
      teamInvite: false,
      weeklyDigest: false,
    };
    const payload = toApiPayload(prefs);
    expect(payload.notifications.emailOnComplete).toBe(false);
    expect(payload.notifications.emailOnError).toBe(false);
    expect(payload.notifications.slackOnComplete).toBe(false);
    expect(payload.notifications.slackOnError).toBe(false);
  });
});
