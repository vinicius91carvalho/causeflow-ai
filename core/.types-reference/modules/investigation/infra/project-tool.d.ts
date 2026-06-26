/**
 * Generic Project Management Tool — queries Trello, Notion, and Shortcut for
 * context enrichment during incident investigation.
 *
 * Security:
 * - Tokens are KMS-encrypted at rest (envelope encryption)
 * - Decryption happens ONLY here, inside executeSecureRequest()
 * - The plaintext token is used inline in fetch() — never assigned to a variable,
 *   never logged, never returned, never accessible outside this scope
 * - Read-only API access only (GET requests)
 */
import { z } from 'zod';
import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { OAuthTokenStore } from '../../../shared/application/ports/oauth-token-store.port.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export declare const projectToolCallInputSchema: z.ZodObject<{
    provider: z.ZodEnum<["trello", "notion", "shortcut", "jira", "linear", "hubspot", "confluence"]>;
    method: z.ZodLiteral<"GET">;
    path: z.ZodString;
    params: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, "strip", z.ZodTypeAny, {
    path: string;
    method: "GET";
    provider: "jira" | "linear" | "hubspot" | "confluence" | "trello" | "notion" | "shortcut";
    params: Record<string, unknown>;
}, {
    path: string;
    method: "GET";
    provider: "jira" | "linear" | "hubspot" | "confluence" | "trello" | "notion" | "shortcut";
    params?: Record<string, unknown> | undefined;
}>;
export declare const PROJECT_TOOL_CALL_TOOL: ToolDefinition;
export declare function createProjectToolHandler(oauthTokenStore: OAuthTokenStore, tenantId: TenantId): (name: string, input: Record<string, unknown>) => Promise<string | null>;
