import type { IUserRepository } from '../domain/user.repository.js';
import type { ITenantRepository } from '../../tenant/domain/tenant.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { Theme, Locale, NotificationPreferences } from '../domain/settings.entity.js';
export interface UpdateSettingsInput {
    tenantId: TenantId;
    userId: string;
    theme?: Theme;
    locale?: Locale;
    notifications?: Partial<NotificationPreferences>;
    name?: string;
    companyName?: string;
}
export interface UpdateSettingsOutput {
    settings: {
        theme: Theme;
        locale: Locale;
        notifications: NotificationPreferences;
    };
}
export declare class UpdateSettingsUseCase {
    private readonly userRepo;
    private readonly tenantRepo;
    constructor(userRepo: IUserRepository, tenantRepo: ITenantRepository);
    execute(input: UpdateSettingsInput): Promise<UpdateSettingsOutput>;
}
