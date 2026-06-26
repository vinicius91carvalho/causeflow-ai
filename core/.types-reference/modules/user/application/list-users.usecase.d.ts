import type { IUserRepository } from '../domain/user.repository.js';
import type { User } from '../domain/user.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export declare class ListUsersUseCase {
    private readonly userRepo;
    constructor(userRepo: IUserRepository);
    execute(tenantId: TenantId): Promise<User[]>;
}
