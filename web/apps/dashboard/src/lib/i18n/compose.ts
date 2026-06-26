/**
 * Dashboard i18n Composer
 *
 * Aggregates per-context i18n message files into a single merged messages object.
 * Each context owns its own translations under `contexts/<name>/infrastructure/i18n/`.
 * The composer deep-merges them so next-intl receives a unified message tree.
 *
 * Key structure: all files use `{ "dashboard": { "<section>": { ... } } }`
 * so merging reconstructs the original monolithic `dashboard.*` namespace.
 */

import { deepMerge } from '@causeflow/shared/domain/utils/deep-merge';
// Approvals context: approvals
import approvalsEn from '../../contexts/approvals/infrastructure/i18n/en.json';
import approvalsPtBr from '../../contexts/approvals/infrastructure/i18n/pt-br.json';
// Audit context: audit
import auditEn from '../../contexts/audit/infrastructure/i18n/en.json';
import auditPtBr from '../../contexts/audit/infrastructure/i18n/pt-br.json';
// Billing context: billing
import billingEn from '../../contexts/billing/infrastructure/i18n/en.json';
import billingPtBr from '../../contexts/billing/infrastructure/i18n/pt-br.json';
// Identity context: auth, onboarding
import identityEn from '../../contexts/identity/infrastructure/i18n/en.json';
import identityPtBr from '../../contexts/identity/infrastructure/i18n/pt-br.json';
// Integrations context: integrations
import integrationsEn from '../../contexts/integrations/infrastructure/i18n/en.json';
import integrationsPtBr from '../../contexts/integrations/infrastructure/i18n/pt-br.json';
// Investigation context: analyses, incidents, remediations
import investigationEn from '../../contexts/investigation/infrastructure/i18n/en.json';
import investigationPtBr from '../../contexts/investigation/infrastructure/i18n/pt-br.json';
// Onboarding context: onboarding tutorial
import onboardingEn from '../../contexts/onboarding/infrastructure/i18n/en.json';
import onboardingPtBr from '../../contexts/onboarding/infrastructure/i18n/pt-br.json';
// Settings context: settings
import settingsEn from '../../contexts/settings/infrastructure/i18n/en.json';
import settingsPtBr from '../../contexts/settings/infrastructure/i18n/pt-br.json';
// Shared context: sidebar, topbar, overview, home
import sharedEn from '../../contexts/shared/infrastructure/i18n/en.json';
import sharedPtBr from '../../contexts/shared/infrastructure/i18n/pt-br.json';
// Team context: team
import teamEn from '../../contexts/team/infrastructure/i18n/en.json';
import teamPtBr from '../../contexts/team/infrastructure/i18n/pt-br.json';

const contextSourcesEn = [
  investigationEn,
  teamEn,
  integrationsEn,
  settingsEn,
  billingEn,
  approvalsEn,
  auditEn,
  identityEn,
  onboardingEn,
  sharedEn,
] as const;

const contextSourcesPtBr = [
  investigationPtBr,
  teamPtBr,
  integrationsPtBr,
  settingsPtBr,
  billingPtBr,
  approvalsPtBr,
  auditPtBr,
  identityPtBr,
  onboardingPtBr,
  sharedPtBr,
] as const;

/**
 * Merged dashboard messages for English.
 * Contains all `dashboard.*` keys assembled from per-context files.
 */
export const dashboardMessagesEn = deepMerge(...contextSourcesEn);

/**
 * Merged dashboard messages for Portuguese (Brazil).
 * Contains all `dashboard.*` keys assembled from per-context files.
 */
export const dashboardMessagesPtBr = deepMerge(...contextSourcesPtBr);

export const dashboardMessages = {
  en: dashboardMessagesEn,
  'pt-br': dashboardMessagesPtBr,
} as const;
