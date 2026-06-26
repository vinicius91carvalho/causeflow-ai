/**
 * RBAC permission constants and utilities for CauseFlow AI dashboard.
 *
 * Role hierarchy:
 *   Admin  — full access to all features
 *   Member — read-only access; can submit and view analyses
 */

type UserRole = 'admin' | 'member';

// ---------------------------------------------------------------------------
// Permission constants
// ---------------------------------------------------------------------------

export const PERMISSION = {
  /** Create, remove, and change roles of team members */
  MANAGE_TEAM: 'manage_team',
  /** Connect and disconnect integrations */
  MANAGE_INTEGRATIONS: 'manage_integrations',
  /** Manage billing — upgrade, cancel, change plan */
  MANAGE_BILLING: 'manage_billing',
  /** Edit company settings */
  MANAGE_SETTINGS: 'manage_settings',
  /** Submit a new incident analysis */
  SUBMIT_ANALYSIS: 'submit_analysis',
  /** View list and detail of analyses */
  VIEW_ANALYSES: 'view_analyses',
  /** View integrations list (read-only) */
  VIEW_INTEGRATIONS: 'view_integrations',
  /** View billing/subscription info (read-only) */
  VIEW_BILLING: 'view_billing',
  /** View settings page (read-only inputs) */
  VIEW_SETTINGS: 'view_settings',
  /** View team members list (read-only) */
  VIEW_TEAM: 'view_team',
} as const;

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];

// ---------------------------------------------------------------------------
// Role → permission mapping
// ---------------------------------------------------------------------------

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    PERMISSION.MANAGE_TEAM,
    PERMISSION.MANAGE_INTEGRATIONS,
    PERMISSION.MANAGE_BILLING,
    PERMISSION.MANAGE_SETTINGS,
    PERMISSION.SUBMIT_ANALYSIS,
    PERMISSION.VIEW_ANALYSES,
    PERMISSION.VIEW_INTEGRATIONS,
    PERMISSION.VIEW_BILLING,
    PERMISSION.VIEW_SETTINGS,
    PERMISSION.VIEW_TEAM,
  ],
  member: [
    PERMISSION.SUBMIT_ANALYSIS,
    PERMISSION.VIEW_ANALYSES,
    PERMISSION.VIEW_INTEGRATIONS,
    PERMISSION.VIEW_BILLING,
    PERMISSION.VIEW_SETTINGS,
    PERMISSION.VIEW_TEAM,
  ],
};

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

/**
 * Returns true if the given role has the specified permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Throws an error if the role does not have the given permission.
 * Intended for use in server-side code that runs before API handlers.
 */
export function requirePermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Permission denied: role "${role}" cannot perform "${permission}".`);
  }
}

/**
 * Returns all permissions for a given role.
 */
export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
