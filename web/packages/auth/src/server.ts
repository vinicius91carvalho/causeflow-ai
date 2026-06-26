/**
 * Server-only exports for @causeflow/auth.
 *
 * This file re-exports server-side utilities that depend on Node.js built-ins
 * (e.g. node:crypto via the Cognito client). It must NEVER be imported from
 * client components or included in the client bundle.
 *
 * Usage in API routes:
 *   import { cognitoSignUp } from '@causeflow/auth/server';
 */
export {
  cognitoConfirmForgotPassword,
  cognitoConfirmSignUp,
  cognitoForgotPassword,
  cognitoResendCode,
  cognitoSignIn,
  cognitoSignUp,
} from './infrastructure/cognito-client';
