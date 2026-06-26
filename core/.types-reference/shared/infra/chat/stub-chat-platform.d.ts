import type { ChatPlatform, ChatMessage, ApprovalRequest, ApprovalResponse } from '../../application/ports/chat-platform.port.js';
export declare class StubChatPlatform implements ChatPlatform {
    readonly name = "stub";
    sendMessage(message: ChatMessage): Promise<{
        messageId: string;
        threadId: string;
    }>;
    requestApproval(request: ApprovalRequest): Promise<ApprovalResponse>;
    updateMessage(channelId: string, messageId: string, text: string): Promise<void>;
    testConnection(): Promise<boolean>;
}
