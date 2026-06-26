export interface DispatchInvestigationParams {
    incidentId: string;
    tenantId: string;
    suggestedAgents: string[];
}
export declare function dispatchInvestigation(params: DispatchInvestigationParams): Promise<string | undefined>;
