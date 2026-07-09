# QA Journal - WI-AC-044 (open-source-local-runtime: AES-256-GCM token encryption)

## Test Date
2026-07-09

## Work Item
WI-AC-044

## Environment
- File audit + unit test run against branch `plan/opensource-docker`
- No server started (static audit + unit test verification)

## Verification Results

### Requirement 1: AES-256-GCM from Node's `crypto`, keyed by `TOKEN_ENCRYPTION_KEY`
- ✅ `AesGcmTokenEncryption` class at `src/shared/infra/credentials/aes-gcm-token-encryption.ts`
- ✅ Uses `createCipheriv('aes-256-gcm', ...)` and `createDecipheriv('aes-256-gcm', ...)` from `node:crypto`
- ✅ Constructor reads key from `process.env['TOKEN_ENCRYPTION_KEY']` env var with SHA-256 fallback derivation for passphrases
- ✅ `bootstrap.ts` line 336: `new AesGcmTokenEncryption()` wired as the token encryption port implementation

### Requirement 2: Unit test encrypts sample OAuth token, decrypts, round-trip equality
- ✅ Test file at `tests/unit/shared/credentials/aes-gcm-token-encryption.test.ts`
- ✅ Test "should encrypt and decrypt a sample OAuth token" uses OAuth-shaped token `'xoxb-12345-67890-abcdefgh'`, confirms `decrypted === original`
- ✅ Test "should encrypt and decrypt a long token" (4096 chars) — round-trip holds
- ✅ Test "should encrypt and decrypt an empty string" — round-trip holds
- ✅ Test "should produce distinct ciphertexts for same plaintext" — random IV ensures distinct ciphertext
- ✅ **All 11 tests pass**: `pnpm test:run` → 1 file, 11 tests, 5ms

### Requirement 3: Tampering with one byte fails GCM auth tag check and raises
- ✅ Test "should reject ciphertext with a single byte changed" — flips one byte in ciphertext, expects `rejects.toThrow()`
- ✅ Test "should reject ciphertext with a tampered IV" — flips one byte in IV, expects `rejects.toThrow()`
- ✅ Test "should reject ciphertext with a tampered auth tag" — flips one byte in tag, expects `rejects.toThrow()`
- ✅ Test "should reject completely replaced ciphertext" — replaces entire ciphertext, expects `rejects.toThrow()`

### Requirement 4: `KmsTokenEncryption` class removed
- ✅ No `kms-token-encryption.ts` file in `src/`
- ✅ `grep -rn "KmsTokenEncryption" src/` returns zero results (only a comment reference in `aes-gcm-token-encryption.ts` line 2: `local replacement for KmsTokenEncryption`)

### Requirement 5: `alias/causeflow-token-encryption` provisioning removed from `01-create-resources.sh`
- ✅ `infra/localstack/init/01-create-resources.sh` contains zero KMS references
- ✅ Script only creates: DynamoDB table (with PITR + 3 GSIs), 4 SQS queues + 4 DLQs, Secrets Manager secrets
- ✅ No `awslocal kms` commands anywhere in the init script

### Requirement 6: No AWS KMS endpoint called at startup
- ✅ Bootstrap (line 336) instantiates `AesGcmTokenEncryption`, not `KmsTokenEncryption`
- ✅ No KMS client or SDK import in the running code path
- ✅ `AesGcmTokenEncryption` has zero AWS SDK dependencies — uses only `node:crypto`

## Relevant Files Inspected
| File | Purpose |
|------|---------|
| `src/shared/infra/credentials/aes-gcm-token-encryption.ts` | AES-256-GCM encryption implementation |
| `src/shared/application/ports/token-encryption.port.ts` | Port interface (EncryptedPayload, TokenEncryption) |
| `src/bootstrap.ts` | Composition root wires AesGcmTokenEncryption |
| `tests/unit/shared/credentials/aes-gcm-token-encryption.test.ts` | Unit tests (11 tests, all pass) |
| `infra/localstack/init/01-create-resources.sh` | Init script (no KMS alias provisioning) |

## Defects
None. All AC-044 requirements are met.

## Verdict
integration=true, implementation=true, qa=true
