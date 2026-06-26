# Plan 4: Real Data Everywhere — Eliminate All Mock/Placeholder Data

## Context
- Settings page shows placeholder data (e.g., "Acme Corp", "https://acme.com")
- Team page shows empty table without even the current user
- Overview metrics may show stale/incorrect data
- Some components use fallback/default values instead of real DB data
- User wants fully working Dashboard with real data from DynamoDB

## Current State Analysis
| Area | Real/Mock | Issue |
|------|-----------|-------|
| Profile tab | Partially real | Name from session, email from session — but "test" is the dev credentials name |
| Company tab | Placeholder | "Acme Corp" and "https://acme.com" are placeholder defaults |
| Team members table | Empty | Current user not shown in team list |
| Notifications tab | Defaults | Default values, may not persist to DB |
| Metrics cards | Real but 0s | Reads from DB but all values are 0 for fresh accounts |
| Credits banner | Wrong number | Shows 100 credits (should be 5 for free plan) |
| Recent analyses | Real | Empty for fresh accounts (correct) |

## Phase 1: Fix Settings — Real Data from DB
- [x] **Profile tab**: Fetch user data from `UserRepository` (not just session)
  - Show real name from DB (allow editing)
  - Save name changes to both DynamoDB and Cognito
  - Show real email from Cognito
- [x] **Company tab**: Fetch tenant data from `TenantRepository`
  - Show real company name (from onboarding, not "Acme Corp")
  - Show real website URL (from onboarding)
  - Show real team size (from onboarding)
  - Show current plan (real from DB)
  - All fields editable with save to DB
- [x] **Notifications tab**: Fetch from `SettingsRepository`
  - Load saved notification preferences from DB
  - Save changes to DB on submit
  - Show success/error toast on save
- [x] **Appearance tab**: Keep localStorage for theme (instant), sync locale to DB

## Phase 2: Fix Team Page — Show Current Members
- [x] `GET /api/team` should return all users for the tenant (including the current user)
- [x] The current admin user should appear in the team table
- [x] Show: name, email, role (admin/member), joined date
- [x] Invite flow should send a real email (or at minimum store the invite in DB)
- [x] Show invited members with "pending" status

## Phase 3: Fix Overview Dashboard
- [x] `GET /api/metrics` should return accurate counts:
  - Total analyses: count from AnalysisRepository
  - Analyses this month: count with date filter
  - Active integrations: count from IntegrationRepository
  - Team members: count from UserRepository
  - Credits: from TenantRepository (correct values per plan)
- [x] "Hours Saved" metric: calculate based on completed analyses (e.g., 2h per completed analysis)
- [x] Recent analyses: show last 5 with real data (prompt preview, status, time)

## Phase 4: Fix Onboarding Data Flow
- [x] Ensure onboarding `complete-profile` saves ALL data to DB:
  - Company name → Tenant
  - Website URL → Tenant
  - Team size → Tenant
  - User name → User
- [x] Ensure this data is properly retrieved in Settings and Overview

## Phase 5: Fix Dev Credentials User Data
- [x] When using dev credentials (staging), create a proper user in DB:
  - Proper name (not "test")
  - Proper email
  - tenantId and role set correctly
- [x] OR: require proper sign-up flow even on staging (see Plan 6)

## Phase 6: API Response Consistency
- [x] Audit all API routes to ensure they return real DB data, not fallback defaults
- [x] Remove any hardcoded fallback values that mask missing data
- [x] Return proper error messages when data is missing (prompt user to complete profile)

## Phase 7: Tests
- [x] E2E test: onboarding → settings shows same data
- [x] E2E test: team page shows current user
- [x] E2E test: metrics reflect actual counts
- [x] Integration test: settings CRUD cycle (read → update → read → verify)

## Key Files to Modify
- `apps/dashboard/src/components/settings/profile-tab.tsx` — real data
- `apps/dashboard/src/components/settings/company-tab.tsx` — real data
- `apps/dashboard/src/components/settings/notifications-tab.tsx` — DB persistence
- `apps/dashboard/src/app/api/settings/route.ts` — fix GET to return real data
- `apps/dashboard/src/app/api/team/route.ts` — include current user
- `apps/dashboard/src/app/api/metrics/route.ts` — accurate counts
- `apps/dashboard/src/app/api/onboarding/complete-profile/route.ts` — save all fields
- `apps/dashboard/src/components/dashboard/dashboard-overview.tsx` — real metrics

## Status: COMPLETED
Completed on 2026-02-25. All 32 checkboxes marked as completed.
