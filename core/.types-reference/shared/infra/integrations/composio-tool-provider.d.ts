import type { ToolDefinition } from '../../application/ports/agent-runner.port.js';
import type { IntegrationToolProvider } from '../../application/ports/integration-tool-provider.port.js';
/**
 * Composio-backed integration tool provider (v3 SDK).
 *
 * Uses the session-based API:
 *   composio.create(userId) → session.tools() → tool definitions
 *
 * Each CauseFlow tenantId maps to a Composio user_id.
 * Composio manages OAuth tokens, refresh, and credential lifecycle.
 */
export declare class ComposioToolProvider implements IntegrationToolProvider {
    private toolPrefix;
    getTools(tenantId: string, apps?: string[]): Promise<ToolDefinition[]>;
    executeAction(tenantId: string, actionName: string, params: Record<string, unknown>): Promise<string>;
    isOwnTool(toolName: string): boolean;
    initiateAuth(tenantId: string, provider: string, redirectUrl: string): Promise<string>;
    getConnectionStatus(tenantId: string): Promise<Array<{
        provider: string;
        status: 'connected' | 'disconnected' | 'error';
        createdAt?: string;
    }>>;
    revokeConnection(tenantId: string, provider: string): Promise<void>;
}
