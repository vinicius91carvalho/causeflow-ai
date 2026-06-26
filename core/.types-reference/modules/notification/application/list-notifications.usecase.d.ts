import type { INotificationRepository } from '../domain/notification.repository.js';
import type { Notification } from '../domain/notification.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export interface ListNotificationsInput {
    tenantId: TenantId;
    cursor?: string;
    limit?: number;
}
export declare class ListNotificationsUseCase {
    private readonly notificationRepo;
    constructor(notificationRepo: INotificationRepository);
    execute(input: ListNotificationsInput): Promise<{
        items: Notification[];
        cursor?: string;
    }>;
}
