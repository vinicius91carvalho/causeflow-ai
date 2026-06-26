/**
 * Backward-compat re-export barrel for API schemas.
 *
 * Schemas have been split into per-context files under
 * `src/contexts/<name>/infrastructure/api-schema.ts`.
 *
 * This file re-exports everything so existing imports keep working without
 * modification. Migrate call sites to import directly from the context's
 * api-schema over time.
 */

export type { CheckoutInput } from '@/contexts/billing/infrastructure/api-schema';
// Billing
export { checkoutSchema } from '@/contexts/billing/infrastructure/api-schema';
export type {
  ConnectIntegrationInput,
  TestIntegrationInput,
} from '@/contexts/integrations/infrastructure/api-schema';
// Integrations
export {
  connectIntegrationSchema,
  testIntegrationSchema,
} from '@/contexts/integrations/infrastructure/api-schema';
export type {
  CreateAnalysisInput,
  CreateIncidentInput,
} from '@/contexts/investigation/infrastructure/api-schema';
// Investigation (incidents + analyses)
export {
  createAnalysisSchema,
  createIncidentSchema,
} from '@/contexts/investigation/infrastructure/api-schema';
export type { UpdateSettingsInput } from '@/contexts/settings/infrastructure/api-schema';
// Settings
export { updateSettingsSchema } from '@/contexts/settings/infrastructure/api-schema';
export type {
  ChangeRoleInput,
  InviteTeamMemberInput,
} from '@/contexts/team/infrastructure/api-schema';
// Team
export {
  changeRoleSchema,
  inviteTeamMemberSchema,
} from '@/contexts/team/infrastructure/api-schema';
