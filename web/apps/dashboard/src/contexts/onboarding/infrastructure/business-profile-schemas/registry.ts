/**
 * Business Profile Schema Registry
 *
 * Provides:
 *   - ACTIVE_VERSION constant (default: 'v1')
 *   - loadSchema(version) — synchronous; validates the named schema via zod
 *   - getActiveSchema() — respects BUSINESS_PROFILE_SCHEMA_VERSION env override
 */
import { businessProfileFormSchemaValidator } from '../../domain/business-profile-schema';
import type { BusinessProfileFormSchema } from '../../domain/business-profile-types';
import v1Raw from './v1.json';

export const ACTIVE_VERSION = 'v1';

const SCHEMA_MAP: Record<string, unknown> = {
  v1: v1Raw,
};

/**
 * Load and validate the named schema. Throws if the version is unknown or
 * the JSON fails validation.
 */
export function loadSchema(version: string): BusinessProfileFormSchema {
  const raw = SCHEMA_MAP[version];
  if (raw === undefined) {
    throw new Error(`Unknown business profile schema version: "${version}"`);
  }

  const result = businessProfileFormSchemaValidator.safeParse(raw);
  if (!result.success) {
    throw new Error(`Schema "${version}" failed validation: ${result.error.message}`);
  }

  return result.data as BusinessProfileFormSchema;
}

/**
 * Load the active schema, respecting the BUSINESS_PROFILE_SCHEMA_VERSION
 * environment variable (used for test overrides and A/B variants).
 */
export function getActiveSchema(): BusinessProfileFormSchema {
  const version = process.env.BUSINESS_PROFILE_SCHEMA_VERSION ?? ACTIVE_VERSION;
  return loadSchema(version);
}
