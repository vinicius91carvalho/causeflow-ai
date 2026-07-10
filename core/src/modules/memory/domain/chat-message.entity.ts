import type { TenantId } from '../../../shared/domain/value-objects.js';
import type { ChatIntent } from '../application/chat.usecase.js';

export interface ChatMessage {
    tenantId: TenantId;
    chatId: string;
    messageId: string;
    role: 'user' | 'assistant';
    content: string;
    intent?: ChatIntent;
    status?: 'completed' | 'processing' | 'error';
    costUsd?: number;
    liveDataChecked?: boolean;
    toolCallsCount?: number;
    /** Slack (or chat-platform) thread timestamp returned when the message is mirrored */
    slackThreadId?: string;
    createdAt: string;
}

export interface ChatSummary {
    chatId: string;
    tenantId: TenantId;
    lastMessage: string;
    lastRole: 'user' | 'assistant';
    intent?: ChatIntent;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface IChatHistoryRepository {
    saveMessage(msg: ChatMessage): Promise<void>;
    getChat(tenantId: TenantId, chatId: string): Promise<ChatMessage[]>;
    listRecentChats(tenantId: TenantId, limit?: number): Promise<ChatSummary[]>;
}
