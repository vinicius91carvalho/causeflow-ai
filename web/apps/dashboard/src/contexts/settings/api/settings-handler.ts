import * as Sentry from '@sentry/nextjs';
import { type NextRequest, NextResponse } from 'next/server';
import type {
  Locale,
  NotificationSettings,
  Theme,
  UserSettings,
} from '@/contexts/settings/domain/types';
import { updateSettingsSchema } from '@/contexts/settings/infrastructure/api-schema';
import type { UpdateTenantSettingsInput } from '@/lib/api/core-api-types';
import { getApiClient } from '@/lib/api/get-api-client';
import { parseBody } from '@/lib/api/parse-body';
import { withAuth } from '@/lib/api/with-auth';
import { logger as dashLogger } from '@/lib/logger';

/**
 * GET /api/settings
 * Returns the current user's profile, tenant info, and notification settings.
 *
 * Response shape:
 * {
 *   settings: { ...notificationSettings, locale, theme },
 *   profile: { name, email, role },
 *   company: { name, websiteUrl, teamSize, plan }
 * }
 */
export const GET = withAuth(async (_request: NextRequest, ctx) => {
  const api = getApiClient();

  const [me, tenant] = await Promise.all([
    api.getUserProfile(ctx.userId),
    api.getTenant(ctx.tenantId),
  ]);

  return NextResponse.json({
    settings: me?.settings ?? {},
    profile: {
      name: me?.name ?? ctx.name,
      email: me?.email ?? ctx.email,
      role: me?.role ?? ctx.role,
    },
    company: {
      name: tenant?.name ?? '',
      websiteUrl: (tenant as unknown as Record<string, unknown>)?.websiteUrl ?? '',
      teamSize: (tenant as unknown as Record<string, unknown>)?.teamSize ?? null,
      plan: tenant?.plan ?? 'free',
    },
  });
});

/**
 * User-scoped update payload — fields that belong to the user, not the tenant.
 * Routed to `updateUserSettings(userId, ...)` on the Core API.
 */
type UserSettingsUpdate = {
  theme?: Theme;
  locale?: Locale;
  notifications?: NotificationSettings;
};

/**
 * Tenant-scoped update payload — fields that belong to the tenant/company.
 * Routed to `updateTenant(tenantId, ...)` on the Core API.
 *
 * NOTE: the on-the-wire Core shape (`UpdateTenantSettingsInput`) currently declares
 * only `{ name?, settings? }`. The existing handler also passes `userName` and
 * `websiteUrl` as pass-through fields — we preserve that behavior here and keep
 * the extra fields loosely-typed until the Core contract is tightened.
 */
type TenantUpdate = UpdateTenantSettingsInput & {
  userName?: string;
  websiteUrl?: string;
};

/**
 * PATCH /api/settings
 * Updates partial settings: notifications, locale, theme, profile name, or company info.
 *
 * Routing rule (PRD §13 + INVARIANTS.md "/api/settings Routing Rule"):
 *   - `theme`, `locale`, `notifications`  → `updateUserSettings(ctx.userId, ...)`
 *   - `name`, `companyName`, `websiteUrl` → `updateTenant(ctx.tenantId, ...)`
 *   - Both kinds in one request           → `Promise.all([...])`; 502 if either fails.
 */
export const PATCH = withAuth(async (request: NextRequest, ctx) => {
  const start = Date.now();
  const { data, error } = await parseBody(request, updateSettingsSchema);
  if (error) return error;

  const api = getApiClient();

  // ─── Bucket 1: user-scoped fields ──────────────────────────────────────────
  const userSettingsUpdate: UserSettingsUpdate = {};

  if (data.theme !== undefined) userSettingsUpdate.theme = data.theme;
  if (data.locale !== undefined) {
    userSettingsUpdate.locale = data.locale;
  }
  if (data.notifications !== undefined) {
    userSettingsUpdate.notifications = {
      emailOnComplete: data.notifications.emailOnComplete ?? true,
      emailOnError: data.notifications.emailOnError ?? true,
      slackOnComplete: data.notifications.slackOnComplete ?? false,
      slackOnError: data.notifications.slackOnError ?? true,
    };
  }

  // ─── Bucket 2: tenant-scoped fields ────────────────────────────────────────
  const tenantUpdate: TenantUpdate = {};

  if (data.name !== undefined) tenantUpdate.userName = data.name.trim();

  // Company info update (admin only)
  if (data.companyName !== undefined || data.websiteUrl !== undefined) {
    if (ctx.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }
    if (data.companyName !== undefined) tenantUpdate.name = data.companyName.trim();
    if (data.websiteUrl !== undefined) {
      const trimmed = data.websiteUrl.trim();
      tenantUpdate.websiteUrl = trimmed === '' ? undefined : trimmed;
    }
  }

  const hasUserFields = Object.keys(userSettingsUpdate).length > 0;
  const hasTenantFields = Object.keys(tenantUpdate).length > 0;

  // ─── Route to Core API clients ─────────────────────────────────────────────
  try {
    if (hasUserFields && hasTenantFields) {
      // Both buckets present — run in parallel. If either rejects, we surface 502.
      const [userResult, tenantResult] = await Promise.all([
        api.updateUserSettings(ctx.userId, userSettingsUpdate),
        api.updateTenant(ctx.tenantId, tenantUpdate),
      ]);
      // Shallow-merge; user-settings fields are the more granular per-user values
      // and win on any overlap (there is none today, but this keeps intent explicit).
      return NextResponse.json({
        settings: { ...tenantResult, ...userResult },
      });
    }

    if (hasUserFields) {
      const userResult = await api.updateUserSettings(ctx.userId, userSettingsUpdate);
      return NextResponse.json({ settings: userResult });
    }

    if (hasTenantFields) {
      const tenantResult = await api.updateTenant(ctx.tenantId, tenantUpdate);
      return NextResponse.json({ settings: tenantResult });
    }

    // No fields to update — return a 200 with an empty settings object so the
    // client can treat it as a no-op success.
    return NextResponse.json({ settings: {} as Partial<UserSettings> });
  } catch (err) {
    const logPath = new URL(request.url).pathname;
    const logPayload = {
      method: request.method,
      path: logPath,
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      duration: Date.now() - start,
    };
    dashLogger.error({ err, ...logPayload }, `Unhandled API handler error`);
    Sentry.captureException(err, { extra: logPayload });
    const message = err instanceof Error ? err.message : 'Upstream settings update failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
});
