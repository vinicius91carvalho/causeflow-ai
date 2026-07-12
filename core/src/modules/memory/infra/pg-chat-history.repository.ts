/**
 * Postgres ChatHistory repository implementation for the OSS runtime (AC-040).
 * Replaces DynamoChatHistoryRepository in the OSS path.
 */
import { pgInsert, pgQuery } from '../../../shared/infra/db/postgres/pg-utils.js';
import { logger } from '../../../shared/infra/logger.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import type {
  ChatMessage,
  ChatSummary,
  IChatHistoryRepository,
} from '../domain/chat-message.entity.js';

const TABLE = 'chat_messages';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDomain(row: any): ChatMessage {
  return {
    tenantId: row.tenant_id as TenantId,
    chatId: row.data['chatId'] as string,
    messageId: row.entity_id,
    role: row.data['role'] as 'user' | 'assistant',
    content: row.data['content'] as string,
    intent: row.data['intent'] as ChatMessage['intent'],
    status: row.data['status'] as ChatMessage['status'],
    costUsd: row.data['costUsd'] as number | undefined,
    liveDataChecked: row.data['liveDataChecked'] as boolean | undefined,
    toolCallsCount: row.data['toolCallsCount'] as number | undefined,
    slackThreadId: row.data['slackThreadId'] as string | undefined,
    createdAt: row.created_at,
  };
}

export class PgChatHistoryRepository implements IChatHistoryRepository {
  async saveMessage(msg: ChatMessage): Promise<void> {
    const data: Record<string, unknown> = {
      chatId: msg.chatId,
      role: msg.role,
      content: msg.content,
      intent: msg.intent,
      status: msg.status,
      costUsd: msg.costUsd,
      liveDataChecked: msg.liveDataChecked,
      toolCallsCount: msg.toolCallsCount,
      slackThreadId: msg.slackThreadId,
    };
    await pgInsert(TABLE, msg.tenantId, msg.messageId, data);
  }

  async getChat(tenantId: TenantId, chatId: string): Promise<ChatMessage[]> {
    const rows = await pgQuery(
      TABLE,
      "tenant_id = $1 AND data->>'chatId' = $2",
      [tenantId, chatId],
      { orderBy: 'created_at ASC' },
    );
    return rows.map(toDomain);
  }

  async listRecentChats(tenantId: TenantId, limit: number = 20): Promise<ChatSummary[]> {
    // Fetch recent messages, ordering by created_at desc
    const rows = await pgQuery(TABLE, 'tenant_id = $1', [tenantId], {
      orderBy: 'created_at DESC',
      limit: limit * 5,
    });

    // Group messages by chatId
    const chatMap = new Map<string, typeof rows>();
    for (const item of rows) {
      const chatId = item.data['chatId'] as string;
      if (!chatId) continue;
      const existing = chatMap.get(chatId);
      if (existing) {
        existing.push(item);
      } else {
        chatMap.set(chatId, [item]);
      }
    }

    // Build summaries, sorted by most recent message
    const summaries: ChatSummary[] = [];
    for (const [chatId, messages] of chatMap) {
      // Sort messages by createdAt ascending
      messages.sort((a, b) => a.created_at.localeCompare(b.created_at));
      const last = messages[messages.length - 1]!;
      const first = messages[0]!;
      summaries.push({
        chatId,
        tenantId,
        lastMessage: ((last.data['content'] as string) ?? '').slice(0, 200),
        lastRole: (last.data['role'] as 'user' | 'assistant') ?? 'assistant',
        intent: last.data['intent'] as ChatSummary['intent'],
        messageCount: messages.length,
        createdAt: first.created_at,
        updatedAt: last.created_at,
      });
    }

    // Sort by updatedAt descending, take limit
    summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return summaries.slice(0, limit);
  }
}
