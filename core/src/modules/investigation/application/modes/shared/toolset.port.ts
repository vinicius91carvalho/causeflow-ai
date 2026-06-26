import type { TenantCapabilities } from '../../../domain/investigation.types.js';
import type { TenantId } from '../../../../../shared/domain/value-objects.js';
import type { ToolDefinition } from '../../../../../shared/application/ports/agent-runner.port.js';

/**
 * Thin port the new investigation modes depend on to obtain a capability
 * snapshot, a ready-to-run tool set, and the orchestrator-style capability
 * guidance prompt section. The implementation lives outside this module —
 * typically an adapter over the existing InvestigateIncidentUseCase — so
 * no mode code needs to import the legacy orchestrator directly.
 */
export interface IInvestigationToolset {
    /** Snapshot of AWS/Composio/relay availability for the tenant. */
    buildCapabilities(tenantId: TenantId): Promise<TenantCapabilities>;
    /**
     * Full orchestrator-style tool set (AWS + Composio + relay DB + the
     * static investigation helpers). Safe to pass straight to the agent
     * runner.
     */
    buildOrchestratorTools(
        capabilities: TenantCapabilities,
        composioTools: ToolDefinition[],
    ): ToolDefinition[];
    /**
     * Human-readable capability section appended to the agent's system
     * prompt. Mirrors the orchestrator's prompt so agents share the same
     * conventions for when to reach for which tool.
     */
    buildCapabilitiesPrompt(capabilities: TenantCapabilities, composioApps: string[]): string;
}
