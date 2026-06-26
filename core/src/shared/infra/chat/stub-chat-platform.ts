import type { ChatPlatform, ChatMessage, ApprovalRequest, ApprovalResponse } from '../../application/ports/chat-platform.port.js';
export class StubChatPlatform {
    name = 'stub';
    async sendMessage(message: ChatMessage) {
        console.log(`[StubChat] Message to ${message.channelId}: ${message.text}`);
        return {
            messageId: `msg-${Date.now()}`,
            threadId: message.threadId ?? `thread-${Date.now()}`,
        };
    }
    async requestApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
        console.log(`[StubChat] Approval requested: ${request.title}`);
        return {
            approved: true,
            respondedBy: 'stub-auto-approve',
            respondedAt: new Date().toISOString(),
            selectedAction: 'approve',
        };
    }
    async updateMessage(channelId: string, messageId: string, text: string): Promise<void> {
        console.log(`[StubChat] Update ${channelId}/${messageId}: ${text}`);
    }
    async testConnection(): Promise<boolean> {
        return true;
    }
}
