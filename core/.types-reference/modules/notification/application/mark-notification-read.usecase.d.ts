import type { INotificationRepository } from '../domain/notification.repository.js';
import type { Notification } from '../domain/notification.entity.js';
import type { TenantId, NotificationId } from '../../../shared/domain/value-objects.js';
export interface MarkNotificationReadInput {
    tenantId: TenantId;
    notificationId: NotificationId;
}
export declare class MarkNotificationReadUseCase {
    private readonly notificationRepo;
    constructor(notificationRepo: INotificationRepository);
    execute(input: MarkNotificationReadInput): Promise<Notification>;
}
