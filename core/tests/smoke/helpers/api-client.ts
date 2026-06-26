import { SignJWT } from 'jose';
import { createHmac } from 'node:crypto';

export interface ApiClientConfig {
  baseUrl: string;
  jwtSecret: string;
  jwtIssuer: string;
  jwtAudience: string;
  webhookSecret: string;
}

export class CauseFlowApiClient {
  private readonly config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  async generateJWT(tenantId: string, opts?: { email?: string; roles?: string[]; sub?: string }): Promise<string> {
    const secret = new TextEncoder().encode(this.config.jwtSecret);
    return new SignJWT({
      tenant_id: tenantId,
      email: opts?.email ?? 'smoke@test.com',
      roles: opts?.roles ?? ['admin', 'owner'],
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(opts?.sub ?? 'smoke-test-user')
      .setIssuer(this.config.jwtIssuer)
      .setAudience(this.config.jwtAudience)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(secret);
  }

  signWebhook(body: string): string {
    return createHmac('sha256', this.config.webhookSecret).update(body).digest('hex');
  }

  private async authHeaders(tenantId: string): Promise<Record<string, string>> {
    const token = await this.generateJWT(tenantId);
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  async createTenant(input: { name: string; slug: string; ownerEmail: string; plan?: string }): Promise<{ tenantId: string; name: string; slug: string; [key: string]: unknown }> {
    const token = await this.generateJWT('system', { roles: ['admin', 'owner'] });
    const res = await fetch(`${this.config.baseUrl}/v1/tenants`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`createTenant failed (${res.status}): ${text}`);
    }
    return res.json() as never;
  }

  async updateTenant(tenantId: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
    const headers = await this.authHeaders(tenantId);
    const res = await fetch(`${this.config.baseUrl}/v1/tenants/${tenantId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`updateTenant failed (${res.status}): ${text}`);
    }
    return res.json() as never;
  }

  async sendAlert(tenantId: string, provider: string, payload: Record<string, unknown>): Promise<{ status: string; incidentId: string }> {
    const body = JSON.stringify(payload);
    const signature = this.signWebhook(body);
    const res = await fetch(`${this.config.baseUrl}/v1/webhooks/${tenantId}/${provider}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`sendAlert failed (${res.status}): ${text}`);
    }
    return res.json() as never;
  }

  async getIncident(tenantId: string, incidentId: string): Promise<Record<string, unknown>> {
    const headers = await this.authHeaders(tenantId);
    const res = await fetch(`${this.config.baseUrl}/v1/incidents/${incidentId}`, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`getIncident failed (${res.status}): ${text}`);
    }
    return res.json() as never;
  }

  async getTenant(tenantId: string): Promise<Record<string, unknown>> {
    const headers = await this.authHeaders(tenantId);
    const res = await fetch(`${this.config.baseUrl}/v1/tenants/${tenantId}`, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`getTenant failed (${res.status}): ${text}`);
    }
    return res.json() as never;
  }

  async approveRemediation(tenantId: string, remediationId: string): Promise<Record<string, unknown>> {
    const headers = await this.authHeaders(tenantId);
    const res = await fetch(`${this.config.baseUrl}/v1/remediation/${remediationId}/approve`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`approveRemediation failed (${res.status}): ${text}`);
    }
    return res.json() as never;
  }

  async getRemediationDetail(tenantId: string, remediationId: string): Promise<Record<string, unknown>> {
    const headers = await this.authHeaders(tenantId);
    const res = await fetch(`${this.config.baseUrl}/v1/remediation/detail/${remediationId}`, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`getRemediationDetail failed (${res.status}): ${text}`);
    }
    return res.json() as never;
  }
}
