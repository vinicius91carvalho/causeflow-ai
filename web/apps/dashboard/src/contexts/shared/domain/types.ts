/**
 * Shared domain types used across multiple bounded contexts.
 *
 * - Tenant: the top-level organizational unit
 * - PageResult<T>: generic pagination wrapper
 * - DynamoItem: base DynamoDB item shape (legacy, kept for backward compat)
 * - Key builders: DynamoDB key construction utilities
 */

import type { SubscriptionStatus, TenantPlan } from '@/contexts/billing/domain/types';
import type { IntegrationType } from '@/contexts/integrations/domain/types';

// ---------------------------------------------------------------------------
// Re-export billing types needed by Tenant
// ---------------------------------------------------------------------------

export type { TenantPlan, SubscriptionStatus };

// ---------------------------------------------------------------------------
// Tenant
// ---------------------------------------------------------------------------

export interface Tenant {
  id: string;
  name: string;
  websiteUrl?: string;
  teamSize?: '1_5' | '6_20' | '21_50' | '50plus';
  plan: TenantPlan;
  creditsTotal: number;
  creditsUsed: number;
  renewDate?: string;
  createdAt: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PageResult<T> {
  items: T[];
  pagination: {
    cursor: string | undefined;
    hasMore: boolean;
  };
}

// ---------------------------------------------------------------------------
// Legacy DynamoDB base item (kept for backward compatibility)
// @deprecated — no longer needed for Incident entities
// ---------------------------------------------------------------------------

/** @deprecated DynamoDB item base — no longer needed for Incident entities */
export interface DynamoItem {
  pk: string;
  sk: string;
  /** GSI1 primary key — userId → tenant lookup */
  gsi1pk?: string;
  /** GSI1 sort key */
  gsi1sk?: string;
  /** GSI2 primary key — analysis status filtering */
  gsi2pk?: string;
  /** GSI2 sort key */
  gsi2sk?: string;
  /** ISO timestamp (managed internally) */
  createdAt: string;
  /** ISO timestamp (updated on writes) */
  updatedAt?: string;
  /** Entity discriminator stored for debugging/migrations */
  entityType: string;
}

// ---------------------------------------------------------------------------
// DynamoDB key builders
// ---------------------------------------------------------------------------

/** PK for tenant-scoped records: TENANT#<tenantId> */
export function buildPK(tenantId: string): string {
  return `TENANT#${tenantId}`;
}

/** SK for Tenant metadata */
export function buildTenantSK(): string {
  return 'METADATA';
}

/** SK for a User under a tenant: USER#<userId> */
export function buildUserSK(userId: string): string {
  return `USER#${userId}`;
}

/** SK for an Integration: INTEGRATION#<type> */
export function buildIntegrationSK(type: IntegrationType): string {
  return `INTEGRATION#${type}`;
}

/** SK for tenant Settings */
export function buildSettingsSK(): string {
  return 'SETTINGS';
}

/** SK for an Invite: INVITE#<email> */
export function buildInviteSK(email: string): string {
  return `INVITE#${email}`;
}

/** GSI1 PK — allows user → tenant lookup: USER#<userId> */
export function buildGSI1PK(userId: string): string {
  return `USER#${userId}`;
}

/** GSI1 SK — tenant side of the user→tenant lookup: TENANT#<tenantId> */
export function buildGSI1SK(tenantId: string): string {
  return `TENANT#${tenantId}`;
}

/** SK for an Analysis (sorted by creation time): ANALYSIS#<timestamp>#<id> */
export function buildAnalysisSK(timestamp: string, analysisId: string): string {
  return `ANALYSIS#${timestamp}#${analysisId}`;
}

/** GSI2 PK — same as main PK (tenant scope), used for status filtering */
export function buildGSI2PK(tenantId: string): string {
  return `TENANT#${tenantId}`;
}

/** GSI2 SK — status + timestamp for ordered analysis queries: STATUS#<status>#<timestamp> */
export function buildGSI2SK(status: string, timestamp: string): string {
  return `STATUS#${status}#${timestamp}`;
}

/** SK for a TermsAcceptance record: TERMS_ACCEPTANCE#<userId>#<version> */
export function buildTermsAcceptanceSK(userId: string, version: string): string {
  return `TERMS_ACCEPTANCE#${userId}#${version}`;
}

/** SK for Onboarding progress record */
export function buildOnboardingSK(): string {
  return 'ONBOARDING';
}

/** PK for beta allowlist records (not tenant-scoped) */
export function buildBetaAllowlistPK(): string {
  return 'BETA_ALLOWLIST';
}

/** SK for a beta allowlist email entry: EMAIL#<email> */
export function buildBetaAllowlistSK(email: string): string {
  return `EMAIL#${email.toLowerCase()}`;
}
