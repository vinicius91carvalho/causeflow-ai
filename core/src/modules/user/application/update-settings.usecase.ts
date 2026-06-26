import { DEFAULT_SETTINGS } from '../domain/settings.entity.js';
import { UserSettingsEntity } from '../../../shared/infra/db/entities/UserSettingsEntity.js';
import { NotFoundError } from '../../../shared/domain/errors.js';
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

export class UpdateSettingsUseCase {
    userRepo;
    tenantRepo;
    constructor(userRepo: IUserRepository, tenantRepo: ITenantRepository) {
        this.userRepo = userRepo;
        this.tenantRepo = tenantRepo;
    }
    async execute(input: UpdateSettingsInput): Promise<UpdateSettingsOutput> {
        const { tenantId, userId, theme, locale, notifications, name, companyName } = input;
        // Verify user exists
        const user = await this.userRepo.findById(tenantId, userId);
        if (!user) {
            throw new NotFoundError('User', userId);
        }
        // Update user name if provided
        if (name !== undefined) {
            await this.userRepo.update(tenantId, userId, { name });
        }
        // Update tenant company name if provided
        if (companyName !== undefined) {
            const tenant = await this.tenantRepo.findById(tenantId);
            if (!tenant) {
                throw new NotFoundError('Tenant', tenantId);
            }
            await this.tenantRepo.update(tenantId, { name: companyName });
        }
        // Upsert settings in DynamoDB
        const existing = await UserSettingsEntity.get({ tenantId, userId }).go();
        if (existing.data) {
            // Update existing settings
            const settingsUpdate: Partial<{ theme: Theme; locale: Locale; notifications: NotificationPreferences }> = {};
            if (theme !== undefined)
                settingsUpdate.theme = theme;
            if (locale !== undefined)
                settingsUpdate.locale = locale;
            if (notifications !== undefined) {
                settingsUpdate.notifications = {
                    ...(existing.data.notifications ?? DEFAULT_SETTINGS.notifications),
                    ...notifications,
                } as NotificationPreferences;
            }
            if (Object.keys(settingsUpdate).length > 0) {
                await UserSettingsEntity.patch({ tenantId, userId }).set(settingsUpdate).go();
            }
            const updated = await UserSettingsEntity.get({ tenantId, userId }).go();
            return {
                settings: {
                    theme: (updated.data?.theme ?? DEFAULT_SETTINGS.theme) as Theme,
                    locale: (updated.data?.locale ?? DEFAULT_SETTINGS.locale) as Locale,
                    notifications: (updated.data?.notifications ?? DEFAULT_SETTINGS.notifications) as NotificationPreferences,
                },
            };
        }
        else {
            // Create new settings record
            const newSettings = {
                tenantId,
                userId,
                theme: (theme ?? DEFAULT_SETTINGS.theme) as Theme,
                locale: (locale ?? DEFAULT_SETTINGS.locale) as Locale,
                notifications: {
                    ...DEFAULT_SETTINGS.notifications,
                    ...(notifications ?? {}),
                } as NotificationPreferences,
            };
            await UserSettingsEntity.create(newSettings).go();
            return {
                settings: {
                    theme: newSettings.theme,
                    locale: newSettings.locale,
                    notifications: newSettings.notifications,
                },
            };
        }
    }
}
