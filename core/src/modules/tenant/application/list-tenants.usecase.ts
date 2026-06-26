import type { ITenantRepository } from '../domain/tenant.repository.js';

export interface ListTenantsInput {
    ownerEmail: string;
    limit?: number;
    cursor?: string;
}

export class ListTenantsUseCase {
    repo;
    constructor(repo: ITenantRepository) {
        this.repo = repo;
    }
    async execute(input: ListTenantsInput) {
        return this.repo.listByOwner(input.ownerEmail, {
            limit: input.limit ?? 20,
            cursor: input.cursor,
        });
    }
}
