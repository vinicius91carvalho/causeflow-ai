import { ORCHESTRATOR_CONFIG } from '../../agent-configs.js';
import type { InvestigateIncidentUseCase } from '../../investigate-incident.usecase.js';
import type { TenantCapabilities } from '../../../domain/investigation.types.js';
import type { TenantId } from '../../../../../shared/domain/value-objects.js';
import type { ToolDefinition } from '../../../../../shared/application/ports/agent-runner.port.js';
import type { IInvestigationToolset } from './toolset.port.js';

/**
 * Adapter that exposes the existing orchestrator's public helper methods
 * (`buildTenantCapabilities`, `buildToolsForAgent`, `buildCapabilitiesPrompt`)
 * behind the mode-facing `IInvestigationToolset` port. The orchestrator
 * class owns the canonical implementation; this adapter guarantees every
 * new mode stays bit-for-bit consistent with it and doesn't require
 * modifying the orchestrator.
 */
export class OrchestratorToolsetAdapter implements IInvestigationToolset {
    constructor(private readonly orchestrator: InvestigateIncidentUseCase) {}

    buildCapabilities(tenantId: TenantId): Promise<TenantCapabilities> {
        return this.orchestrator.buildTenantCapabilities(tenantId);
    }

    buildOrchestratorTools(
        capabilities: TenantCapabilities,
        composioTools: ToolDefinition[],
    ): ToolDefinition[] {
        // Reuse the orchestrator-base assembly path (baseRole === 'orchestrator')
        // to guarantee tool list parity with the canonical orchestrator run.
        return this.orchestrator.buildToolsForAgent(ORCHESTRATOR_CONFIG, capabilities, composioTools);
    }

    buildCapabilitiesPrompt(capabilities: TenantCapabilities, composioApps: string[]): string {
        return this.orchestrator.buildCapabilitiesPrompt(capabilities, composioApps);
    }
}
