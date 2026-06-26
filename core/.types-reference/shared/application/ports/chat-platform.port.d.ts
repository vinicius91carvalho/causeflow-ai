export interface ChatMessage {
    channelId: string;
    text: string;
    threadId?: string;
    blocks?: Record<string, unknown>[];
}
export interface ApprovalRequest {
    channelId: string;
    threadId?: string;
    title: string;
    description: string;
    actions: {
        label: string;
        value: string;
        style?: 'primary' | 'danger';
    }[];
    timeoutMinutes?: number;
    metadata?: Record<string, string>;
}
export interface ApprovalResponse {
    approved: boolean;
    respondedBy: string;
    respondedAt: string;
    selectedAction: string;
}
export interface ChatPlatform {
    readonly name: string;
    sendMessage(message: ChatMessage): Promise<{
        messageId: string;
        threadId: string;
    }>;
    requestApproval(request: ApprovalRequest): Promise<ApprovalResponse>;
    updateMessage(channelId: string, messageId: string, text: string): Promise<void>;
    testConnection(): Promise<boolean>;
}
