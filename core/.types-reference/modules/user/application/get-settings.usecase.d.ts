import type { IUserRepository } from '../domain/user.repository.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { Theme, Locale, NotificationPreferences } from '../domain/settings.entity.js';
export interface GetSettingsOutput {
    settings: {
        theme: Theme;
        locale: Locale;
        notifications: NotificationPreferences;
    };
    profile: {
        name: string;
        email: string;
        role: string;
    };
    company: {
        name: string;
        plan: string;
    };
}
export declare class GetSettingsUseCase {
    private readonly userRepo;
    private readonly tenantRepo;
    constructor(userRepo: IUserRepository, tenantRepo: ITenantRepository);
    execute(tenantId: TenantId, userId: string): Promise<GetSettingsOutput>;
}
