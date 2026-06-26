---
title: Credential Handling Security Patterns
date: 2026-03-06
category: security
tags: [credentials, encryption, kms, api-responses, logging, integrations]
severity: critical
---

# Credential Handling Security Patterns

## Problem
Integration credentials (API keys, tokens, private keys) must be stored securely and never exposed through logs, API responses, or error messages.

## Solution

The dashboard implements a layered defense for credential security:

### 1. Encryption at Rest (`lib/db/encryption.ts`)
- **Production:** AWS KMS `EncryptCommand`/`DecryptCommand` with a managed key (`KMS_KEY_ARN`)
- **Development:** Base64 encoding fallback (clearly documented as insecure, local-only)
- Credentials are JSON-serialized then encrypted before any storage operation

### 2. Repository Layer (`contexts/integrations/infrastructure/integration-repository.ts`)
- `connectIntegration()` calls `encrypt(JSON.stringify(credentials))` before saving
- `disconnectIntegration()` sets `encryptedCredentials` to `undefined`/`null`
- `getDecryptedCredentials()` is the only path to plaintext -- marked with "never log" comment
- No `console.log`/`console.error` anywhere in the repository

### 3. API Handler Layer (`contexts/integrations/api/`)
- **GET /api/integrations:** Strips `encryptedCredentials` via destructuring before response
- **POST /api/integrations:** Strips `encryptedCredentials` from the created integration before response
- **DELETE /api/integrations/[type]:** Returns only `{ success: true, type }` -- no integration data
- **POST /api/integrations/test:** Validates credential format only, never stores or logs them

### 4. Error Handling
- Encryption errors throw generic messages: "KMS encrypt returned no ciphertext"
- API validation errors return field-level messages without echoing submitted values
- No `console.error` calls in integration code that could log credential data

### 5. Request Body Parsing (`lib/api/parse-body.ts`)
- Zod validation errors return field names and messages, never submitted values
- JSON parse failures return generic "Invalid request body"

## Prevention

When adding new credential-handling code:
1. **Never** `console.log`/`console.error` any object that contains credentials or `encryptedCredentials`
2. **Always** destructure out `encryptedCredentials` before returning integration objects in API responses
3. **Never** include credential values in error messages -- use generic descriptions
4. **Never** `JSON.stringify` a full integration object for logging purposes
5. Test files should verify `encryptedCredentials` is `undefined` in API responses (see `integrations.test.ts`)

## Related
- `apps/dashboard/src/lib/db/encryption.ts` -- KMS encrypt/decrypt
- `apps/dashboard/src/contexts/integrations/infrastructure/integration-repository.ts` -- credential storage
- `apps/dashboard/src/contexts/integrations/api/integrations-handler.ts` -- credential stripping
- `apps/dashboard/src/contexts/integrations/api/test-connection-handler.ts` -- format validation
- `docs/solutions/security/2026-02-28_csp-header-configuration.md` -- CSP headers
