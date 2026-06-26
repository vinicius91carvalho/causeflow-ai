/**
 * Generic AWS API Tool — 1 tool that covers ALL AWS services (read-only).
 *
 * The agent (via code execution) calls `aws_api_call(service, action, params)`.
 * This handler:
 *  1. Validates action is read-only via aws-api-security.ts
 *  2. Resolves SDK client dynamically via aws-service-map.ts
 *  3. Creates client with STS credentials (already vended)
 *  4. Executes Command, strips $metadata, returns JSON
 */
import { z } from 'zod';
import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { CloudCredentials } from '../../../shared/application/ports/cloud-provider.port.js';
export declare const awsApiCallInputSchema: z.ZodObject<{
    service: z.ZodString;
    action: z.ZodString;
    params: z.ZodDefault<z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
}, "strip", z.ZodTypeAny, {
    action: string;
    params: Record<string, unknown>;
    service: string;
}, {
    action: string;
    service: string;
    params?: Record<string, unknown> | undefined;
}>;
export declare const AWS_API_CALL_TOOL: ToolDefinition;
export declare function createAwsApiToolHandler(credentials: CloudCredentials): (name: string, input: Record<string, unknown>) => Promise<string | null>;
/**
 * Clear the client cache (useful for testing or credential rotation).
 */
export declare function clearAwsClientCache(): void;
