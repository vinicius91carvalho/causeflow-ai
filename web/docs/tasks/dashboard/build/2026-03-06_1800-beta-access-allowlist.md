# Beta Access Email Allowlist (Single-Table Design)

## Context (The Why)
Dashboard is being enabled on production, but only for beta testers. We need an email allowlist stored in the existing DynamoDB table (single-table design) that the admin can update. Non-allowlisted users who sign up should see a "coming soon" message instead of accessing the dashboard.

## Definition (The What)
1. Add beta-allowlist records to the existing `causeflow-dashboard-<stage>` table
2. Gate dashboard access: only allowlisted emails can use the dashboard after sign-up
3. Non-allowlisted users see a friendly "Beta access coming soon" page
4. Admin can add/remove emails via AWS console or CLI

## Acceptance Criteria (The How to Test)
- [x] Beta allowlist uses existing DynamoDB table with PK=`BETA_ALLOWLIST`, SK=`EMAIL#<email>`
- [x] Allowlisted email can sign up and access dashboard normally
- [x] Non-allowlisted email can sign up but sees "beta coming soon" page
- [x] Admin can add emails via: `aws dynamodb put-item --table-name causeflow-dashboard-production --item '{"pk":{"S":"BETA_ALLOWLIST"},"sk":{"S":"EMAIL#user@example.com"},"entityType":{"S":"BETA_ALLOWLIST"},"addedAt":{"S":"2026-03-06"}}'`
- [x] Staging allows all emails (gate only active in production)
- [x] Dev mode bypasses gate entirely

## Restrictions (The Boundaries)
- Use existing DynamoDB table — do NOT create a new table
- Only affects production (staging allows all emails for testing)
- Sign-up flow itself should NOT be blocked — users can create Cognito accounts
- The gate happens AFTER authentication, before dashboard access
- Do NOT change the Cognito flow — gate at application level
- Follow existing PK/SK patterns and BaseRepository pattern

## Phase 1: Research & Setup
- [x] Review current sign-up and post-auth flow
- [x] Review existing PK/SK patterns in `contexts/shared/domain/types.ts`
- [x] Design the gating mechanism (middleware vs layout-level check)

## Phase 2: Implementation

### Domain & Infrastructure
- [x] Add `BETA_ALLOWLIST` key builder functions in `contexts/shared/domain/types.ts`
- [x] Create beta-allowlist repository in `contexts/identity/infrastructure/beta-allowlist-repository.ts`
- [x] Repository methods: `isEmailAllowed(email)`, `addEmail(email)`, `removeEmail(email)`, `listAllowedEmails()`
- [x] Follow BaseRepository pattern with dev-mode in-memory fallback

### Application-Level Gate
- [x] Create beta access check in middleware or dashboard layout
- [x] After auth: query `getItem('BETA_ALLOWLIST', 'EMAIL#<email>')` to check allowlist
- [x] If NOT in allowlist AND `NEXT_PUBLIC_DEPLOYMENT_STAGE === 'production'`: redirect to beta-waitlist page
- [x] Create `/beta-waitlist` page with: "We're in beta" message, contact adm@causeflow.ai for doubts, "We will send you an email soon" promise
- [x] If in allowlist OR stage is NOT production: allow normal access
- [x] Dev mode (`isDev()`): bypass gate entirely

### Documentation
- [x] Document CLI commands to add/remove emails from allowlist

## Phase 3: Validation
- [x] Run `pnpm turbo build` — zero errors
- [x] Run `pnpm exec biome check .` — zero lint issues
- [x] Run `pnpm turbo check-types` — zero type errors
- [x] Test locally with dev credentials (should bypass gate)

## CLI Commands (Beta Allowlist Management)

### Add an email to the allowlist
```bash
aws dynamodb put-item \
  --table-name causeflow-dashboard-production \
  --item '{"pk":{"S":"BETA_ALLOWLIST"},"sk":{"S":"EMAIL#user@example.com"},"entityType":{"S":"BETA_ALLOWLIST"},"email":{"S":"user@example.com"},"addedAt":{"S":"2026-03-06"}}'
```

### Remove an email from the allowlist
```bash
aws dynamodb delete-item \
  --table-name causeflow-dashboard-production \
  --key '{"pk":{"S":"BETA_ALLOWLIST"},"sk":{"S":"EMAIL#user@example.com"}}'
```

### List all allowlisted emails
```bash
aws dynamodb query \
  --table-name causeflow-dashboard-production \
  --key-condition-expression 'pk = :pk AND begins_with(sk, :prefix)' \
  --expression-attribute-values '{":pk":{"S":"BETA_ALLOWLIST"},":prefix":{"S":"EMAIL#"}}'
```

## Phase 4: Compound
- [x] Update deployment docs with beta-access allowlist info
- [x] Update session learnings (skipped per task instructions — no session-learnings.md modification)
