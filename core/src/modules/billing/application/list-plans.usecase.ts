import type { IPlanCatalogService, PlanDefinition } from '../domain/plan-catalog.port.js';

export interface PublicPlan {
    planKey: string;
    name: string;
    priceUsd: number;
    priceAnnualUsd?: number;
    investigationsLimit: number;
    eventsLimit: number;
    trialDays: number;
    features: string[];
    highlighted?: boolean;
    selfService: boolean;
    overagePerInvestigation?: number;
}

export class ListPlansUseCase {
    constructor(private planCatalog: IPlanCatalogService) {}

    async execute(): Promise<PublicPlan[]> {
        const plans = await this.planCatalog.listPlans();
        return plans.map((p: PlanDefinition) => ({
            planKey: p.planKey,
            name: p.name,
            priceUsd: p.priceUsd,
            priceAnnualUsd: p.priceAnnualUsd,
            investigationsLimit: p.investigationsLimit,
            eventsLimit: p.eventsLimit,
            trialDays: p.trialDays,
            features: p.features,
            highlighted: p.highlighted,
            selfService: p.selfService,
            overagePerInvestigation: p.overagePerInvestigation,
        }));
    }
}
