import { randomUUID } from 'node:crypto';
import { notificationId, approvalId, incidentId, remediationId, tenantId as toTenantId } from '../../domain/value-objects.js';
import type { ChatPlatform, ChatMessage, ApprovalRequest, ApprovalResponse } from '../../application/ports/chat-platform.port.js';
import type { INotificationRepository } from '../../../modules/notification/domain/notification.repository.js';
import type { IApprovalRepository } from '../../../modules/notification/domain/approval.repository.js';
import type { Notification } from '../../../modules/notification/domain/notification.entity.js';
import type { PendingApproval } from '../../../modules/notification/domain/approval.entity.js';
import type { SSEManager } from './sse-manager.js';
import type { TenantId } from '../../domain/value-objects.js';
import type { NotificationType, NotificationStatus, ApprovalStatus } from '../../domain/types.js';
export class WebPortalChatPlatform {
    notificationRepo;
    approvalRepo;
    sseManager;
    defaultTenantId;
    name = 'web_portal';
    constructor(notificationRepo: INotificationRepository, approvalRepo: IApprovalRepository, sseManager: SSEManager, defaultTenantId?: TenantId | undefined) {
        this.notificationRepo = notificationRepo;
        this.approvalRepo = approvalRepo;
        this.sseManager = sseManager;
        this.defaultTenantId = defaultTenantId;
    }
    async sendMessage(message: ChatMessage) {
        const tid = this.resolveTenantId(message.channelId);
        const nid = notificationId(randomUUID());
        const threadId = message.threadId ?? randomUUID();
        const notification: Notification = {
            notificationId: nid,
            tenantId: tid,
            channelId: message.channelId,
            threadId,
            type: 'message' as NotificationType,
            title: '',
            text: message.text,
            blocks: message.blocks,
            status: 'delivered' as NotificationStatus,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await this.notificationRepo.create(notification);
        await this.sseManager.broadcast(tid, {
            event: 'notification',
            data: { notificationId: nid, type: 'message', text: message.text, threadId },
            id: nid,
        });
        return { messageId: nid, threadId };
    }
    async requestApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
        const tid = this.resolveTenantId(request.channelId);
        const nid = notificationId(randomUUID());
        const aid = approvalId(randomUUID());
        const threadId = request.threadId ?? randomUUID();
        const notification: Notification = {
            notificationId: nid,
            tenantId: tid,
            channelId: request.channelId,
            threadId,
            type: 'approval_request' as NotificationType,
            title: request.title,
            text: request.description,
            status: 'delivered' as NotificationStatus,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await this.notificationRepo.create(notification);
        const approval: PendingApproval = {
            approvalId: aid,
            tenantId: tid,
            notificationId: nid,
            incidentId: incidentId(request.metadata?.['incidentId'] ?? ''),
            remediationId: remediationId(request.metadata?.['remediationId'] ?? ''),
            title: request.title,
            description: request.description,
            actions: request.actions,
            status: 'pending' as ApprovalStatus,
            timeoutMinutes: request.timeoutMinutes ?? 30,
            expiresAt: new Date(Date.now() + (request.timeoutMinutes ?? 30) * 60_000).toISOString(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        await this.approvalRepo.create(approval);
        await this.sseManager.broadcast(tid, {
            event: 'approval_request',
            data: {
                approvalId: aid,
                notificationId: nid,
                title: request.title,
                description: request.description,
                actions: request.actions,
                expiresAt: approval.expiresAt,
            },
            id: aid,
        });
        // Return immediately with pending status — resolution via REST endpoint
        return {
            approved: false,
            respondedBy: '',
            respondedAt: '',
            selectedAction: '',
        };
    }
    async updateMessage(channelId: string, messageId: string, text: string): Promise<void> {
        const tid = this.resolveTenantId(channelId);
        await this.notificationRepo.update(tid, notificationId(messageId), {
            text,
            updatedAt: new Date().toISOString(),
        });
        await this.sseManager.broadcast(tid, {
            event: 'notification_update',
            data: { notificationId: messageId, text },
        });
    }
    async testConnection(): Promise<boolean> {
        return true;
    }
    resolveTenantId(channelId: string): TenantId {
        return this.defaultTenantId ?? toTenantId(channelId);
    }
}
