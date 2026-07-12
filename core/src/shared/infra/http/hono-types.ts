import type { TenantId } from '../../domain/value-objects.js';
export type AppVariables = {
  requestId: string;
  tenantId: TenantId;
  userId: string;
  userEmail: string;
  userRoles: string[];
  widgetAuth?: boolean;
  widgetAgentId?: string;
  widgetAgentName?: string;
  widgetSessionId?: string;
  otelTraceId?: string;
};
export type AppEnv = {
  Variables: AppVariables;
};
