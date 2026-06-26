export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export interface HealthResponse {
  status: string;
  db: string;
  pool: { total: number; idle: number; waiting: number };
  memory: { heapUsedMB: number; heapTotalMB: number; rssMB: number };
  uptime: number;
}

export class CustomerClient {
  constructor(private baseUrl = 'http://localhost:3100') {}

  async health(): Promise<HealthResponse> {
    const res = await fetch(`${this.baseUrl}/health`);
    return res.json() as never;
  }

  async createPayment(amount = 100, currency = 'BRL'): Promise<Payment> {
    const res = await fetch(`${this.baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, currency, description: 'smoke-test' }),
    });
    if (!res.ok) throw new Error(`Create payment failed: ${res.status}`);
    return res.json() as never;
  }

  async getPayment(id: string): Promise<Payment> {
    const res = await fetch(`${this.baseUrl}/payments/${id}`);
    if (!res.ok) throw new Error(`Get payment failed: ${res.status}`);
    return res.json() as never;
  }

  /** Raw POST — does NOT throw on non-2xx (useful for triggering error paths) */
  async sendPayment(body: Record<string, unknown>): Promise<{ status: number; body: unknown }> {
    const res = await fetch(`${this.baseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  }
}
