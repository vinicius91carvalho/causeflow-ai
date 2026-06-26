import type { ChatPlatform, ChatMessage, ApprovalRequest, ApprovalResponse } from '../../../shared/application/ports/chat-platform.port.js';
export interface SlackConfig {
    botToken: string;
    defaultChannelId?: string;
}
export declare class SlackChatPlatform implements ChatPlatform {
    readonly name = "slack";
    private readonly botToken;
    private readonly defaultChannelId?;
    constructor(cfg: SlackConfig);
    sendMessage(message: ChatMessage): Promise<{
        messageId: string;
        threadId: string;
    }>;
    requestApproval(request: ApprovalRequest): Promise<ApprovalResponse>;
    updateMessage(channelId: string, messageId: string, text: string): Promise<void>;
    testConnection(): Promise<boolean>;
}
