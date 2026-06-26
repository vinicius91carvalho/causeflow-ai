// Domain
export type { AuthState, AuthToken, Session, User, UserRole } from './domain/types';
export type { AuthConfigOptions, GetUserProfileFn } from './infrastructure/auth-config';
// Infrastructure
export { authConfig, createAuthConfig } from './infrastructure/auth-config';
export {
  getAvatarColor,
  getUserInitials,
  requireAuth,
  requireRole,
} from './infrastructure/auth-utils';
// NOTE: cognitoSignUp and other server-only Cognito functions are NOT exported here
// to avoid bundling node:crypto in client components.
// Import them from '@causeflow/auth/server' in API routes.
export { AuthGuard, withAuth } from './presentation/auth-guard';
// Presentation
export { AuthProvider } from './presentation/auth-provider';
export { useAuthSession, useSession } from './presentation/use-session';
