/**
 * Postgres User repository implementation for the OSS runtime (AC-040).
 */
import type { IUserRepository } from '../domain/user.repository.js';
import type { User } from '../domain/user.entity.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
import {
  pgGet,
  pgInsert,
  pgUpdate,
  pgDelete,
  pgQueryJson,
} from '../../../shared/infra/db/postgres/pg-utils.js';

const TABLE = 'users';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDomain(row: any): User {
  return {
    tenantId: row.tenant_id as unknown as TenantId,
    userId: row.entity_id,
    email: row.data['email'] as string,
    name: row.data['name'] as string,
    role: row.data['role'] as User['role'],
    profileComplete: (row.data['profileComplete'] as boolean) ?? true,
    termsAcceptedAt: row.data['termsAcceptedAt'] as string | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgUserRepository implements IUserRepository {
  async create(user: User): Promise<User> {
    const data: Record<string, unknown> = {
      email: user.email,
      name: user.name,
      role: user.role,
      profileComplete: user.profileComplete,
      termsAcceptedAt: user.termsAcceptedAt,
    };
    const row = await pgInsert(TABLE, String(user.tenantId), user.userId, data);
    return toDomain(row!);
  }

  async findById(tenantId: TenantId, userId: string): Promise<User | null> {
    const row = await pgGet(TABLE, String(tenantId), userId);
    if (!row) return null;
    return toDomain(row!);
  }

  async findByUserId(userId: string): Promise<User | null> {
    const rows = await pgQueryJson(TABLE, 'entity_id = $1', [userId], { limit: 1 });
    if (rows.length === 0) return null;
    return toDomain(rows[0]);
  }

  async findByEmail(email: string): Promise<User | null> {
    const rows = await pgQueryJson(TABLE, "data->>'email' = $1", [email], { limit: 1 });
    if (rows.length === 0) return null;
    return toDomain(rows[0]);
  }

  async findByTenant(tenantId: TenantId): Promise<User[]> {
    const rows = await pgQueryJson(TABLE, 'tenant_id = $1', [String(tenantId)]);
    return rows.map(toDomain);
  }

  async update(tenantId: TenantId, userId: string, data: Partial<User>): Promise<User> {
    const updateData: Record<string, unknown> = {};
    if (data.email !== undefined) updateData['email'] = data.email;
    if (data.name !== undefined) updateData['name'] = data.name;
    if (data.role !== undefined) updateData['role'] = data.role;
    if (data.profileComplete !== undefined) updateData['profileComplete'] = data.profileComplete;
    if (data.termsAcceptedAt !== undefined) updateData['termsAcceptedAt'] = data.termsAcceptedAt;
    const row = await pgUpdate(TABLE, String(tenantId), userId, updateData);
    return toDomain(row!);
  }

  async delete(tenantId: TenantId, userId: string): Promise<void> {
    await pgDelete(TABLE, String(tenantId), userId);
  }
}
