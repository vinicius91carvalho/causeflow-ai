import { NotFoundError } from '../../../shared/domain/errors.js';
import type { INotificationRepository } from '../domain/notification.repository.js';
import type { Notification } from '../domain/notification.entity.js';
import type { TenantId, NotificationId } from '../../../shared/domain/value-objects.js';

export interface MarkNotificationReadInput {
    tenantId: TenantId;
    notificationId: NotificationId;
}

export class MarkNotificationReadUseCase {
    notificationRepo;
    constructor(notificationRepo: INotificationRepository) {
        this.notificationRepo = notificationRepo;
    }
    async execute(input: MarkNotificationReadInput): Promise<Notification> {
        const notification = await this.notificationRepo.findById(input.tenantId, input.notificationId);
        if (!notification) {
            throw new NotFoundError('Notification', input.notificationId);
        }
        return this.notificationRepo.update(input.tenantId, input.notificationId, {
            status: 'read',
            updatedAt: new Date().toISOString(),
        });
    }
}
