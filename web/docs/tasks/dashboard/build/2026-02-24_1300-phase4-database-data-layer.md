# Phase 4: Database & Data Layer (DynamoDB + KMS)

## Phase 4.1: Research & Setup
- [x] Study existing SST config (`apps/dashboard/sst.config.ts`) for current Cognito/SES resources
- [x] Study DynamoDB Single-Table Design patterns for the entity schema from master plan
- [x] Study existing API route patterns (`apps/dashboard/src/app/api/auth/`) for consistency
- [x] Study existing onboarding mock API routes to understand what needs real DB integration
- [x] Determine AWS SDK v3 packages needed: @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb, @aws-sdk/client-kms

## Phase 4.2: SST Resources
- [x] Add DynamoDB table to `apps/dashboard/sst.config.ts`:
  - Table name: `causeflow-dashboard-{stage}`
  - PK: `pk` (String), SK: `sk` (String)
  - GSI1: `gsi1pk` (String) / `gsi1sk` (String) — userId → tenant lookup
  - GSI2: `gsi2pk` (String) / `gsi2sk` (String) — status/timestamp filtering
  - Billing mode: PAY_PER_REQUEST (on-demand)
  - Point-in-time recovery: enabled
- [x] Add KMS key to `apps/dashboard/sst.config.ts`:
  - Alias: `causeflow-dashboard-encryption-{stage}`
  - Used for encrypting integration credentials
  - Key policy: allow dashboard Lambda/server access
- [x] Add environment variables for DynamoDB table name and KMS key ARN
- [x] Install AWS SDK packages: `pnpm --filter dashboard add @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb @aws-sdk/client-kms`

## Phase 4.3: Domain Types
- [x] Create `apps/dashboard/src/lib/db/types.ts` — Entity types matching Single-Table schema:
  - `Tenant`: id, name, websiteUrl, teamSize, plan, creditsTotal, creditsUsed, renewDate, createdAt
  - `User`: id, tenantId, email, name, role (Admin|Member), profileComplete, lastLogin, createdAt
  - `Analysis`: id, tenantId, prompt, status (Queued|Running|Completed|Failed), severity, result, confidence, timeline, recommendations, dataSources, auditTrail, createdAt, completedAt
  - `Integration`: tenantId, type, name, status (Connected|Disconnected|Error), encryptedCredentials, lastTestedAt, connectedBy, createdAt
  - `Settings`: tenantId, notifications, locale, theme
  - `Invite`: tenantId, email, role, invitedBy, expiresAt, status (Pending|Accepted|Expired)
- [x] Create key-building utilities: `buildPK()`, `buildSK()`, `buildGSI1PK()`, etc.
  - Follows the schema: PK=`TENANT#<id>`, SK varies per entity
  - GSI1: PK=`USER#<userId>`, SK=`TENANT#<tenantId>`

## Phase 4.4: DynamoDB Client & Base Repository
- [x] Create `apps/dashboard/src/lib/db/client.ts`:
  - DynamoDBDocumentClient singleton (reusable across requests)
  - Region from env or default (us-east-2)
  - Table name from env
  - Dev mode: local DynamoDB endpoint support (optional)
- [x] Create `apps/dashboard/src/lib/db/base-repository.ts`:
  - Generic base class/functions for CRUD operations
  - Automatic `tenantId` injection on all queries (tenant isolation)
  - `putItem()`, `getItem()`, `queryItems()`, `updateItem()`, `deleteItem()`
  - Pagination support (cursor-based via DynamoDB LastEvaluatedKey)
  - All operations scoped to a single tenant (no cross-tenant queries)

## Phase 4.5: KMS Encryption Utilities
- [x] Create `apps/dashboard/src/lib/db/encryption.ts`:
  - `encrypt(plaintext: string): Promise<string>` — encrypts with KMS, returns base64
  - `decrypt(ciphertext: string): Promise<string>` — decrypts with KMS, returns plaintext
  - KMS key ARN from environment variable
  - Dev mode: simple base64 encoding (no real KMS in dev)
  - Never log plaintext credentials

## Phase 4.6: Entity Repositories
- [x] Create `apps/dashboard/src/lib/db/repositories/tenant-repository.ts`:
  - `createTenant(data)` — creates new tenant record
  - `getTenant(tenantId)` — get tenant by ID
  - `updateTenant(tenantId, updates)` — partial update
- [x] Create `apps/dashboard/src/lib/db/repositories/user-repository.ts`:
  - `createUser(data)` — creates user linked to tenant
  - `getUser(userId)` — get user by ID (via GSI1)
  - `getUsersByTenant(tenantId)` — list users for tenant
  - `updateUser(tenantId, userId, updates)` — partial update
- [x] Create `apps/dashboard/src/lib/db/repositories/analysis-repository.ts`:
  - `createAnalysis(data)` — creates new analysis
  - `getAnalysis(tenantId, analysisId)` — get single analysis
  - `listAnalyses(tenantId, options)` — paginated list, sorted by date desc
  - `updateAnalysisStatus(tenantId, analysisId, status, result?)` — update status
- [x] Create `apps/dashboard/src/lib/db/repositories/integration-repository.ts`:
  - `connectIntegration(data)` — creates/updates integration (encrypts credentials)
  - `getIntegration(tenantId, type)` — get single integration
  - `listIntegrations(tenantId)` — list all for tenant
  - `disconnectIntegration(tenantId, type)` — soft delete (set status=Disconnected)
- [x] Create `apps/dashboard/src/lib/db/repositories/settings-repository.ts`:
  - `getSettings(tenantId)` — get settings (with defaults)
  - `updateSettings(tenantId, updates)` — partial update
- [x] Create `apps/dashboard/src/lib/db/repositories/invite-repository.ts`:
  - `createInvite(data)` — create invite record
  - `getInvite(tenantId, email)` — get invite by email
  - `listInvites(tenantId)` — list pending invites
  - `acceptInvite(tenantId, email)` — mark as accepted
  - `expireInvites()` — mark expired invites
- [x] Create `apps/dashboard/src/lib/db/index.ts` — barrel export for all repositories

## Phase 4.7: API Routes
- [x] Create `apps/dashboard/src/lib/api/with-auth.ts`:
  - Middleware helper that extracts session, validates tenantId, and passes to handler
  - Returns 401 if not authenticated, 403 if no tenantId
  - Rate limiting wrapper
- [x] Create `apps/dashboard/src/app/api/analyses/route.ts`:
  - GET: list analyses (paginated, by tenant)
  - POST: submit new analysis (validates with Zod, creates in DB)
- [x] Create `apps/dashboard/src/app/api/analyses/[id]/route.ts`:
  - GET: get analysis detail by ID
- [x] Create `apps/dashboard/src/app/api/integrations/route.ts`:
  - GET: list integrations for tenant
  - POST: connect integration (validates, encrypts credentials, saves)
- [x] Create `apps/dashboard/src/app/api/integrations/[type]/route.ts`:
  - DELETE: disconnect integration (soft delete)
- [x] Create `apps/dashboard/src/app/api/metrics/route.ts`:
  - GET: dashboard overview metrics (total analyses, monthly, active integrations, team members, credits)
- [x] Create `apps/dashboard/src/app/api/team/route.ts`:
  - GET: list team members for tenant
- [x] Create `apps/dashboard/src/app/api/team/invite/route.ts`:
  - POST: invite team member (validates email, creates invite, Admin only)
- [x] Create `apps/dashboard/src/app/api/team/[userId]/role/route.ts`:
  - PATCH: change user role (Admin only, validates role)
- [x] Update onboarding complete-profile route to use real tenant repository (replace mock)
- [x] Update onboarding connect-integration route to use real integration repository (replace mock)

## Phase 4.8: Zod Schemas
- [x] Create `apps/dashboard/src/lib/api/schemas.ts`:
  - `createAnalysisSchema` — prompt (string, min 10), severity, integrations array
  - `connectIntegrationSchema` — type, credentials (per-type validation)
  - `inviteTeamMemberSchema` — email, role
  - `changeRoleSchema` — role (Admin|Member)
  - `updateSettingsSchema` — partial settings

## Phase 4.9: Unit Tests
- [x] Write unit tests for key-building utilities (buildPK, buildSK, etc.)
- [x] Write unit tests for base repository (mock DynamoDB client)
- [x] Write unit tests for encryption utilities (dev mode base64 encoding)
- [x] Write unit tests for tenant repository (mock base repository)
- [x] Write unit tests for analysis repository (mock base repository)
- [x] Write unit tests for integration repository (mock base repository, verify encryption called)
- [x] Write unit tests for with-auth middleware (session validation, tenantId extraction)
- [x] Write unit tests for API route handlers (analyses, integrations, metrics, team)
- [x] Write unit tests for Zod schemas (valid/invalid inputs for each schema)

## Phase 4.10: Verification
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues (1 intentional biome-ignore warning)
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Run `pnpm turbo test` — all 183 tests pass (19 test files)
- [x] Verify all API routes return proper error responses for invalid input
- [x] Verify tenant isolation — no cross-tenant data leakage in repository logic
- [x] Remove unused code/imports
