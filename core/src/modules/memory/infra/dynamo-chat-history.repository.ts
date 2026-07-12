import { ChatMessageEntity } from '../../../shared/infra/db/entities/ChatMessageEntity.js';
import { logger } from '../../../shared/infra/logger.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type {
  ChatMessage,
  ChatSummary,
  IChatHistoryRepository,
} from '../domain/chat-message.entity.js';

export class DynamoChatHistoryRepository implements IChatHistoryRepository {
  async saveMessage(msg: ChatMessage): Promise<void> {
    await ChatMessageEntity.put({
      tenantId: msg.tenantId as string,
      chatId: msg.chatId,
      messageId: msg.messageId,
      role: msg.role,
      content: msg.content,
      intent: msg.intent,
      status: msg.status,
      costUsd: msg.costUsd,
      liveDataChecked: msg.liveDataChecked,
      toolCallsCount: msg.toolCallsCount,
      slackThreadId: msg.slackThreadId,
      createdAt: msg.createdAt,
    }).go();
  }

  async getChat(tenantId: TenantId, chatId: string): Promise<ChatMessage[]> {
    const result = await ChatMessageEntity.query
      .primary({
        tenantId: tenantId as string,
      })
      .begins({ chatId })
      .go();

    return result.data.map((item) => ({
      tenantId: tenantId,
      chatId: item.chatId,
      messageId: item.messageId,
      role: item.role,
      content: item.content,
      intent: item.intent ?? undefined,
      status: item.status ?? undefined,
      costUsd: item.costUsd ?? undefined,
      liveDataChecked: item.liveDataChecked ?? undefined,
      toolCallsCount: item.toolCallsCount ?? undefined,
      slackThreadId: item.slackThreadId ?? undefined,
      createdAt: item.createdAt,
    })) as ChatMessage[];
  }

  async listRecentChats(tenantId: TenantId, limit: number = 20): Promise<ChatSummary[]> {
    // Query GSI1 (tenantId + createdAt) in descending order to get recent messages
    const result = await ChatMessageEntity.query
      .byChatCreated({
        tenantId: tenantId as string,
      })
      .go({ order: 'desc', limit: limit * 5 }); // fetch extra to group by chatId

    // Group messages by chatId
    const chatMap = new Map<string, typeof result.data>();
    for (const item of result.data) {
      const existing = chatMap.get(item.chatId);
      if (existing) {
        existing.push(item);
      } else {
        chatMap.set(item.chatId, [item]);
      }
    }

    // Build summaries, sorted by most recent message
    const summaries: ChatSummary[] = [];
    for (const [chatId, messages] of chatMap) {
      // Sort messages by createdAt ascending
      messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const last = messages[messages.length - 1]!;
      const first = messages[0]!;
      summaries.push({
        chatId,
        tenantId,
        lastMessage: last.content.slice(0, 200),
        lastRole: last.role,
        intent: last.intent ?? undefined,
        messageCount: messages.length,
        createdAt: first.createdAt,
        updatedAt: last.createdAt,
      });
    }

    // Sort by updatedAt descending, take limit
    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return summaries.slice(0, limit);
  }
}
