const ORDER_SERVICE_URL = process.env['ORDER_SERVICE_URL'] ?? 'http://localhost:3200';

export interface OrderItem {
  productId: string;
  quantity: number;
}

export interface CreateOrderResponse {
  orderId: string;
  totalCents: number;
  status: string;
}

export class OrderClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? ORDER_SERVICE_URL;
  }

  async createOrder(customerId: string, items: OrderItem[]): Promise<CreateOrderResponse> {
    const res = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, items }),
    });
    return res.json() as Promise<CreateOrderResponse>;
  }

  async getOrder(orderId: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/orders/${orderId}`);
    return res.json() as Promise<Record<string, unknown>>;
  }

  async getProducts(): Promise<Array<Record<string, unknown>>> {
    const res = await fetch(`${this.baseUrl}/products`);
    return res.json() as Promise<Array<Record<string, unknown>>>;
  }

  async getHealth(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.baseUrl}/health`);
    return res.json() as Promise<Record<string, unknown>>;
  }

  /**
   * Trigger the race condition: send N concurrent orders for the same low-stock product.
   * With Widget Pro stock=5, sending 10 concurrent orders of qty=1 guarantees overselling.
   */
  async triggerRaceCondition(concurrentOrders = 10): Promise<CreateOrderResponse[]> {
    const CUSTOMER_ID = 'a1111111-1111-1111-1111-111111111111';
    const WIDGET_PRO_ID = 'c1111111-1111-1111-1111-111111111111';

    const promises = Array.from({ length: concurrentOrders }, () =>
      this.createOrder(CUSTOMER_ID, [{ productId: WIDGET_PRO_ID, quantity: 1 }])
        .catch((err) => ({ orderId: '', totalCents: 0, status: `error: ${err.message}` })),
    );

    return Promise.all(promises);
  }
}
