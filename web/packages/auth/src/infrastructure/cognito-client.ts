import { createHmac } from 'node:crypto';
import {
  CognitoIdentityProviderClient,
  ConfirmForgotPasswordCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  InitiateAuthCommand,
  ResendConfirmationCodeCommand,
  SignUpCommand,
  type SignUpCommandInput,
} from '@aws-sdk/client-cognito-identity-provider';

/**
 * Lazy-initialized Cognito client.
 * Only used server-side in API routes.
 */
let _client: CognitoIdentityProviderClient | null = null;

function getCognitoClient(): CognitoIdentityProviderClient {
  if (!_client) {
    _client = new CognitoIdentityProviderClient({
      region: process.env.AWS_REGION ?? 'us-east-2',
    });
  }
  return _client;
}

function getClientId(): string {
  const id = process.env.AUTH_COGNITO_ID;
  if (!id) throw new Error('AUTH_COGNITO_ID environment variable is not set');
  return id;
}

/**
 * Compute the SecretHash required when the Cognito App Client has a client secret.
 * SecretHash = Base64(HMAC-SHA256(clientSecret, username + clientId))
 *
 * If AUTH_COGNITO_SECRET is not set, returns undefined (no secret hash needed).
 */
function computeSecretHash(username: string): string | undefined {
  const secret = process.env.AUTH_COGNITO_SECRET;
  if (!secret) return undefined;
  const clientId = getClientId();
  return createHmac('sha256', secret)
    .update(username + clientId)
    .digest('base64');
}

/**
 * Register a new user in the Cognito User Pool.
 */
export async function cognitoSignUp(params: { email: string; password: string; name: string }) {
  const input: SignUpCommandInput = {
    ClientId: getClientId(),
    Username: params.email,
    Password: params.password,
    SecretHash: computeSecretHash(params.email),
    UserAttributes: [
      { Name: 'email', Value: params.email },
      { Name: 'name', Value: params.name },
    ],
  };
  return getCognitoClient().send(new SignUpCommand(input));
}

/**
 * Confirm sign-up with the verification code sent via email.
 */
export async function cognitoConfirmSignUp(params: { email: string; code: string }) {
  return getCognitoClient().send(
    new ConfirmSignUpCommand({
      ClientId: getClientId(),
      Username: params.email,
      ConfirmationCode: params.code,
      SecretHash: computeSecretHash(params.email),
    }),
  );
}

/**
 * Resend the verification code to the user's email.
 */
export async function cognitoResendCode(params: { email: string }) {
  return getCognitoClient().send(
    new ResendConfirmationCodeCommand({
      ClientId: getClientId(),
      Username: params.email,
      SecretHash: computeSecretHash(params.email),
    }),
  );
}

/**
 * Initiate the forgot-password flow (sends reset code via email).
 */
export async function cognitoForgotPassword(params: { email: string }) {
  return getCognitoClient().send(
    new ForgotPasswordCommand({
      ClientId: getClientId(),
      Username: params.email,
      SecretHash: computeSecretHash(params.email),
    }),
  );
}

/**
 * Confirm a new password with the reset code.
 */
export async function cognitoConfirmForgotPassword(params: {
  email: string;
  code: string;
  newPassword: string;
}) {
  return getCognitoClient().send(
    new ConfirmForgotPasswordCommand({
      ClientId: getClientId(),
      Username: params.email,
      ConfirmationCode: params.code,
      Password: params.newPassword,
      SecretHash: computeSecretHash(params.email),
    }),
  );
}

/**
 * Sign in a user via email/password using the USER_PASSWORD_AUTH flow.
 *
 * Returns the Cognito auth result (access/id/refresh tokens) on success,
 * or `null` when credentials are invalid / user not found / not confirmed.
 *
 * Throws for unexpected errors so callers can surface them appropriately.
 */
export async function cognitoSignIn(params: { email: string; password: string }): Promise<{
  accessToken: string;
  idToken: string;
  refreshToken: string | undefined;
  sub: string;
  email: string;
} | null> {
  try {
    const response = await getCognitoClient().send(
      new InitiateAuthCommand({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: getClientId(),
        AuthParameters: {
          USERNAME: params.email,
          PASSWORD: params.password,
          ...(computeSecretHash(params.email) !== undefined && {
            SECRET_HASH: computeSecretHash(params.email) as string,
          }),
        },
      }),
    );

    const result = response.AuthenticationResult;
    if (!result?.AccessToken || !result?.IdToken) {
      return null;
    }

    // Decode the ID token payload (base64url, middle segment) to extract sub + email
    const idTokenPayload = JSON.parse(
      Buffer.from(result.IdToken.split('.')[1], 'base64url').toString('utf-8'),
    ) as { sub: string; email: string };

    return {
      accessToken: result.AccessToken,
      idToken: result.IdToken,
      refreshToken: result.RefreshToken,
      sub: idTokenPayload.sub,
      email: idTokenPayload.email,
    };
  } catch (err) {
    const error = err as { name?: string };
    // These are expected "wrong credentials" errors — return null so the
    // Credentials provider returns null (Auth.js maps that to CredentialsSignin).
    if (
      error.name === 'NotAuthorizedException' ||
      error.name === 'UserNotFoundException' ||
      error.name === 'UserNotConfirmedException'
    ) {
      return null;
    }
    // Re-throw unexpected errors (network issues, config problems, etc.)
    throw err;
  }
}
