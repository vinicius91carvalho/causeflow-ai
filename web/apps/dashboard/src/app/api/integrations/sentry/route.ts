// Thin re-export — implementation lives in the integrations bounded context.
// See `apps/dashboard/CLAUDE.md` "Re-export Pattern".
export {
  handleGetSentryIntegration as GET,
  handleSaveSentryIntegration as POST,
} from '@/contexts/integrations/api/sentry-integration-handler';
