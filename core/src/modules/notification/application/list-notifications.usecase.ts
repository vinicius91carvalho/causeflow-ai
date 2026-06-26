import type { INotificationRepository } from '../domain/notification.repository.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface ListNotificationsInput {
    tenantId: TenantId;
    cursor?: string;
    limit?: number;
}

export class ListNotificationsUseCase {
    notificationRepo;
    constructor(notificationRepo: INotificationRepository) {
        this.notificationRepo = notificationRepo;
    }
    async execute(input: ListNotificationsInput) {
        return this.notificationRepo.listByTenant(input.tenantId, {
            cursor: input.cursor,
            limit: input.limit ?? 20,
        });
    }
}
