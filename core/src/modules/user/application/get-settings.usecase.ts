import { DEFAULT_SETTINGS } from '../domain/settings.entity.js';
import { UserSettingsEntity } from '../../../shared/infra/db/entities/UserSettingsEntity.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
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

export class GetSettingsUseCase {
    userRepo;
    tenantRepo;
    constructor(userRepo: IUserRepository, tenantRepo: ITenantRepository) {
        this.userRepo = userRepo;
        this.tenantRepo = tenantRepo;
    }
    async execute(tenantId: TenantId, userId: string): Promise<GetSettingsOutput> {
        // Fetch user profile
        const user = await this.userRepo.findById(tenantId, userId);
        if (!user) {
            throw new NotFoundError('User', userId);
        }
        // Fetch tenant info
        const tenant = await this.tenantRepo.findById(tenantId);
        if (!tenant) {
            throw new NotFoundError('Tenant', tenantId);
        }
        // Fetch settings (return defaults if not found)
        const result = await UserSettingsEntity.get({ tenantId, userId }).go();
        const stored = result.data;
        const settings = stored
            ? {
                theme: (stored.theme ?? DEFAULT_SETTINGS.theme) as Theme,
                locale: (stored.locale ?? DEFAULT_SETTINGS.locale) as Locale,
                notifications: (stored.notifications ?? DEFAULT_SETTINGS.notifications) as NotificationPreferences,
            }
            : { theme: DEFAULT_SETTINGS.theme as Theme, locale: DEFAULT_SETTINGS.locale as Locale, notifications: DEFAULT_SETTINGS.notifications as NotificationPreferences };
        return {
            settings,
            profile: {
                name: user.name,
                email: user.email,
                role: user.role,
            },
            company: {
                name: tenant.name,
                plan: tenant.plan,
            },
        };
    }
}
