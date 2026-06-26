import type { ChatPlatform, ChatMessage, ApprovalRequest, ApprovalResponse } from '../../application/ports/chat-platform.port.js';
import type { INotificationRepository } from '../../../modules/notification/domain/notification.repository.js';
import type { IApprovalRepository } from '../../../modules/notification/domain/approval.repository.js';
import type { TenantId } from '../../domain/value-objects.js';
import type { SSEManager } from './sse-manager.js';
export declare class WebPortalChatPlatform implements ChatPlatform {
    private readonly notificationRepo;
    private readonly approvalRepo;
    private readonly sseManager;
    private readonly defaultTenantId?;
    readonly name = "web_portal";
    constructor(notificationRepo: INotificationRepository, approvalRepo: IApprovalRepository, sseManager: SSEManager, defaultTenantId?: TenantId | undefined);
    sendMessage(message: ChatMessage): Promise<{
        messageId: string;
        threadId: string;
    }>;
    requestApproval(request: ApprovalRequest): Promise<ApprovalResponse>;
    updateMessage(channelId: string, messageId: string, text: string): Promise<void>;
    testConnection(): Promise<boolean>;
    private resolveTenantId;
}
