import type { TenantId, WidgetSessionId } from '../../../shared/domain/value-objects.js';
import type { IWidgetSessionRepository } from '../domain/widget-session.repository.js';
import type { WidgetSession, WidgetMessage } from '../domain/widget-session.entity.js';
import type { PushSubscriptionData } from '../domain/push-subscription.types.js';
import { getPgPool } from '../../../shared/infra/db/pg-client.js';
import { logger } from '../../../shared/infra/logger.js';

export class PgWidgetSessionRepository implements IWidgetSessionRepository {
  async create(session: WidgetSession): Promise<WidgetSession> {
    const pool = await getPgPool();
    const data = JSON.stringify({
      agentId: session.agentId,
      agentName: session.agentName,
      messages: session.messages,
      status: session.status,
      pushSubscription: session.pushSubscription,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt,
    });
    const entityId = session.sessionId;
    await pool.query(
      `INSERT INTO causeflow.widget_sessions (tenant_id, entity_id, data, created_at, updated_at)
             VALUES ($1, $2, $3::jsonb, NOW(), NOW())`,
      [session.tenantId, entityId, data],
    );
    return session;
  }

  async findById(tenantId: TenantId, sessionId: WidgetSessionId): Promise<WidgetSession | null> {
    const pool = await getPgPool();
    const result = await pool.query(
      'SELECT data FROM causeflow.widget_sessions WHERE tenant_id = $1 AND entity_id = $2',
      [tenantId, sessionId],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0] as { data: Record<string, unknown> };
    const d = row.data;
    return {
      sessionId: sessionId,
      tenantId: tenantId,
      agentId: d.agentId as string | undefined,
      agentName: d.agentName as string | undefined,
      messages: (d.messages as WidgetMessage[]) ?? [],
      status: (d.status as 'active' | 'closed') ?? 'active',
      pushSubscription: d.pushSubscription as PushSubscriptionData | undefined,
      createdAt: (d.createdAt as string) ?? '',
      updatedAt: (d.updatedAt as string) ?? '',
      expiresAt: (d.expiresAt as string) ?? '',
    };
  }

  async appendMessage(
    tenantId: TenantId,
    sessionId: WidgetSessionId,
    message: WidgetMessage,
  ): Promise<void> {
    const pool = await getPgPool();
    const session = await this.findById(tenantId, sessionId);
    if (!session) return;
    const messages = [...session.messages, message];
    const data = JSON.stringify({
      ...session,
      messages,
      updatedAt: new Date().toISOString(),
    });
    await pool.query(
      `UPDATE causeflow.widget_sessions SET data = $3::jsonb, updated_at = NOW()
             WHERE tenant_id = $1 AND entity_id = $2`,
      [tenantId, sessionId, data],
    );
  }

  async updatePushSubscription(
    tenantId: TenantId,
    sessionId: WidgetSessionId,
    subscription: PushSubscriptionData,
  ): Promise<void> {
    const pool = await getPgPool();
    const session = await this.findById(tenantId, sessionId);
    if (!session) return;
    const data = JSON.stringify({
      ...session,
      pushSubscription: subscription,
      updatedAt: new Date().toISOString(),
    });
    await pool.query(
      `UPDATE causeflow.widget_sessions SET data = $3::jsonb, updated_at = NOW()
             WHERE tenant_id = $1 AND entity_id = $2`,
      [tenantId, sessionId, data],
    );
  }

  async close(tenantId: TenantId, sessionId: WidgetSessionId): Promise<void> {
    const pool = await getPgPool();
    const session = await this.findById(tenantId, sessionId);
    if (!session) return;
    const data = JSON.stringify({
      ...session,
      status: 'closed',
      updatedAt: new Date().toISOString(),
    });
    await pool.query(
      `UPDATE causeflow.widget_sessions SET data = $3::jsonb, updated_at = NOW()
             WHERE tenant_id = $1 AND entity_id = $2`,
      [tenantId, sessionId, data],
    );
  }
}
