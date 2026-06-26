import type { IUserRepository } from '../domain/user.repository.js';
import type { User } from '../domain/user.entity.js';
export declare class GetUserByEmailUseCase {
    private readonly userRepo;
    constructor(userRepo: IUserRepository);
    execute(email: string): Promise<User | null>;
}
