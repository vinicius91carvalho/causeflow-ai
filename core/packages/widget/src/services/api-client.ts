import type { SessionResponse, ChatResponse, BrandingConfig } from '../types.js';

export class WidgetApiClient {
  private baseUrl: string;
  private apiKey: string;
  private agentId?: string;
  private agentName?: string;

  constructor(baseUrl: string, apiKey: string, agentId?: string, agentName?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.agentId = agentId;
    this.agentName = agentName;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
    if (this.agentId) h['X-Widget-Agent-Id'] = this.agentId;
    if (this.agentName) h['X-Widget-Agent-Name'] = this.agentName;
    return h;
  }

  async createSession(): Promise<SessionResponse> {
    const res = await fetch(`${this.baseUrl}/v1/widget/sessions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        agentId: this.agentId,
        agentName: this.agentName,
      }),
    });
    if (!res.ok) throw new Error(`Failed to create session: ${res.status}`);
    return res.json();
  }

  async sendMessage(sessionId: string, message: string): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/v1/widget/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error(`Failed to send message: ${res.status}`);
    return res.json();
  }

  async getConfig(): Promise<BrandingConfig> {
    const res = await fetch(`${this.baseUrl}/v1/widget/config`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Failed to get config: ${res.status}`);
    return res.json();
  }

  async subscribePush(sessionId: string, subscription: PushSubscription): Promise<void> {
    const json = subscription.toJSON();
    await fetch(`${this.baseUrl}/v1/widget/sessions/${sessionId}/push-subscribe`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
      }),
    });
  }

  async closeSession(sessionId: string): Promise<void> {
    await fetch(`${this.baseUrl}/v1/widget/sessions/${sessionId}/close`, {
      method: 'POST',
      headers: this.headers(),
    });
  }
}
