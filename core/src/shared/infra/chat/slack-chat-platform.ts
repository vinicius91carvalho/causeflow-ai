import type { WebClient, KnownBlock } from '@slack/web-api';
import type { ChatPlatform, ChatMessage, ApprovalRequest, ApprovalResponse } from '@shared/application/ports/chat-platform.port.js';
import type { SlackNotificationRepository } from '@modules/integration/infra/slack-notification.repository.js';
import type { Logger } from '@shared/infra/logger.js';

export class SlackChatPlatform implements ChatPlatform {
    readonly name = 'slack';

    constructor(
        private readonly client: WebClient,
        // Reserved for future use (e.g., dedup lookups at platform level)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        private readonly _slackNotificationRepo: SlackNotificationRepository,
        private readonly logger: Logger,
    ) {}

    async sendMessage(message: ChatMessage): Promise<{ messageId: string; threadId: string }> {
        const result = await this.client.chat.postMessage({
            channel: message.channelId,
            text: message.text,
            blocks: message.blocks as unknown as KnownBlock[],
            ...(message.threadId ? { thread_ts: message.threadId } : {}),
        });

        const ts = result.ts!;
        this.logger.info({ channel: message.channelId, ts }, 'slack.message.sent');
        return { messageId: ts, threadId: ts };
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.client.auth.test();
            return true;
        } catch (err) {
            this.logger.warn({ error: err instanceof Error ? err.message : 'unknown' }, 'slack.auth.test.failed');
            return false;
        }
    }

    async requestApproval(_request: ApprovalRequest): Promise<ApprovalResponse> {
        throw new Error('not implemented');
    }

    async updateMessage(_channelId: string, _messageId: string, _text: string): Promise<void> {
        throw new Error('not implemented');
    }
}
