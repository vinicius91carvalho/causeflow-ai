import type { IUserRepository } from '../domain/user.repository.js';
import type { User } from '../domain/user.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export class ListUsersUseCase {
    userRepo;
    constructor(userRepo: IUserRepository) {
        this.userRepo = userRepo;
    }
    async execute(tenantId: TenantId): Promise<User[]> {
        return this.userRepo.findByTenant(tenantId);
    }
}
