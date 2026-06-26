import type { ITenantRepository } from '../domain/tenant.repository.js';
import type { Tenant } from '../domain/tenant.entity.js';
export interface ListTenantsInput {
    ownerEmail: string;
    limit?: number;
    cursor?: string;
}
export declare class ListTenantsUseCase {
    private readonly repo;
    constructor(repo: ITenantRepository);
    execute(input: ListTenantsInput): Promise<{
        items: Tenant[];
        cursor?: string;
    }>;
}
