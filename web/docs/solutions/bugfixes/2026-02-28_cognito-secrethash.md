---
title: Cognito SecretHash HMAC requirement for app clients with secrets
date: 2026-02-28
category: bugfixes
tags: [cognito, secrethash, hmac, sha256, auth, aws, sign-up, sign-in]
app: dashboard
severity: critical
---

# Cognito SecretHash HMAC requirement for app clients with secrets

## Problem

All Cognito API calls — sign-up, confirm sign-up, sign-in, forgot-password, confirm forgot-password — fail with:

```
NotAuthorizedException: Unable to verify secret hash for client <clientId>
```

## Root Cause

SST creates Cognito app clients with `generateSecret: true` by default. When a client secret is configured, **every** call to the Cognito User Pool API must include a `SecretHash` parameter. Omitting it causes the request to be rejected regardless of other credentials.

## Solution

Compute the `SecretHash` before every Cognito API call:

```ts
// packages/auth/src/infrastructure/cognito-client.ts
import { createHmac } from 'node:crypto';

function computeSecretHash(username: string, clientId: string, clientSecret: string): string {
  return createHmac('sha256', clientSecret)
    .update(username + clientId)
    .digest('base64');
}
```

Pass it on every Cognito call:

```ts
const secretHash = computeSecretHash(email, clientId, clientSecret);

await cognitoClient.send(new SignUpCommand({
  ClientId: clientId,
  Username: email,
  Password: password,
  SecretHash: secretHash,
  // ...
}));
```

The same pattern applies to: `ConfirmSignUpCommand`, `InitiateAuthCommand`, `ForgotPasswordCommand`, `ConfirmForgotPasswordCommand`.

## Prevention

- Any new Cognito API call must include `SecretHash` if `AUTH_COGNITO_SECRET` is set.
- Rule in `MEMORY.md`: "When Cognito app client has a client secret, ALL API calls require a `SecretHash`."
- Fix deployed in commit `834e079`.

## Related

- [AWS Docs — SecretHash calculation](https://docs.aws.amazon.com/cognito/latest/developerguide/signing-up-users-in-your-app.html#cognito-user-pools-computing-secret-hash)
- `packages/auth/src/infrastructure/cognito-client.ts`
