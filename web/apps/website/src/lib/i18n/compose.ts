/**
 * Website i18n Composer
 *
 * Deep-merges per-context i18n message files into a single messages object
 * for use by next-intl. Each bounded context owns its own translation keys
 * under `src/contexts/<name>/infrastructure/i18n/`.
 *
 * Context → Keys mapping:
 *   marketing  → home, product, integrations, security, pricing, about,
 *                deploymentApproaches, fromOpsgenie
 *   legal      → privacy, terms
 *   shell      → notFound, common (nav, cta, footer, languageSelector)
 *
 * The `engagement` context has been retired as part of the cleric redesign —
 * marketing CTAs route to published docs and GitHub via `@/lib/oss-marketing-ctas`.
 */

import { deepMerge } from '@causeflow/shared/domain/utils/deep-merge';
import legalEn from '@/contexts/legal/infrastructure/i18n/en.json';
import legalPtBr from '@/contexts/legal/infrastructure/i18n/pt-br.json';
import marketingEn from '@/contexts/marketing/infrastructure/i18n/en.json';
import marketingPtBr from '@/contexts/marketing/infrastructure/i18n/pt-br.json';
import shellEn from '@/contexts/shell/infrastructure/i18n/en.json';
import shellPtBr from '@/contexts/shell/infrastructure/i18n/pt-br.json';

export const websiteMessages = {
  en: deepMerge(marketingEn, legalEn, shellEn),
  'pt-br': deepMerge(marketingPtBr, legalPtBr, shellPtBr),
} as const;

export type WebsiteMessages = typeof websiteMessages.en;
