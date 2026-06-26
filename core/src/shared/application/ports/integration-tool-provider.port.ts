import type { ToolDefinition } from './agent-runner.port.js';
/**
 * Provides integration tools (Composio, DIY, etc.) for agent investigation.
 * The agent runner calls getTools() to discover available tools for a tenant,
 * and executeAction() to run a specific tool action.
 */
export interface IntegrationToolProvider {
    /**
     * Get available tool definitions for a tenant based on their connected integrations.
     * Returns tools in Anthropic-compatible format.
     */
    getTools(tenantId: string, apps?: string[]): Promise<ToolDefinition[]>;
    /**
     * Execute a tool action on behalf of a tenant.
     * The provider handles auth, rate limits, and response formatting.
     */
    executeAction(tenantId: string, actionName: string, params: Record<string, unknown>): Promise<string>;
    /**
     * Check if a tool name belongs to this provider.
     */
    isOwnTool(toolName: string): boolean;
    /**
     * Initiate OAuth connection for a tenant + provider.
     * Returns the authorization URL to redirect the user to.
     */
    initiateAuth(tenantId: string, provider: string, redirectUrl: string): Promise<string>;
    /**
     * Get connection status for a tenant's integrations.
     */
    getConnectionStatus(tenantId: string): Promise<Array<{
        provider: string;
        status: 'connected' | 'disconnected' | 'error';
        createdAt?: string;
    }>>;
    /**
     * Revoke a connection for a tenant + provider.
     */
    revokeConnection(tenantId: string, provider: string): Promise<void>;
}
