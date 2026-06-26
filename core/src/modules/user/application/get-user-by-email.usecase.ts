import type { IUserRepository } from '../domain/user.repository.js';
import type { User } from '../domain/user.entity.js';
export class GetUserByEmailUseCase {
    userRepo;
    constructor(userRepo: IUserRepository) {
        this.userRepo = userRepo;
    }
    async execute(email: string): Promise<User | null> {
        return this.userRepo.findByEmail(email);
    }
}
