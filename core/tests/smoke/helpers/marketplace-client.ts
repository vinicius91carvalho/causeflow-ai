const CATALOG_API_URL = process.env['CATALOG_API_URL'] ?? 'http://localhost:3400';
const ORDER_API_URL = process.env['MARKETPLACE_ORDER_API_URL'] ?? 'http://localhost:3500';
const FULFILLMENT_API_URL = process.env['MARKETPLACE_FULFILLMENT_API_URL'] ?? 'http://localhost:3600';

export interface Product {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  avgRating?: number | null;
  reviewCount?: number;
}

export interface Order {
  orderId: string;
  totalCents: number;
  status: string;
}

export interface ReconcileResult {
  totalShipments: number;
  mismatches: number;
  details: Array<{ shipmentId: string; orderId: string; expected: number; actual: number }>;
}

export class MarketplaceClient {
  private catalogUrl: string;
  private orderUrl: string;
  private fulfillmentUrl: string;

  constructor(opts?: { catalogUrl?: string; orderUrl?: string; fulfillmentUrl?: string }) {
    this.catalogUrl = opts?.catalogUrl ?? CATALOG_API_URL;
    this.orderUrl = opts?.orderUrl ?? ORDER_API_URL;
    this.fulfillmentUrl = opts?.fulfillmentUrl ?? FULFILLMENT_API_URL;
  }

  // ── Catalog ────────────────────────────────────────────────────

  async searchProducts(category: string): Promise<Product[]> {
    const res = await fetch(`${this.catalogUrl}/products/search?category=${encodeURIComponent(category)}`);
    return res.json() as Promise<Product[]>;
  }

  async getProduct(id: string): Promise<Product> {
    const res = await fetch(`${this.catalogUrl}/products/${id}`);
    return res.json() as Promise<Product>;
  }

  async getCatalogHealth(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.catalogUrl}/health`);
    return res.json() as Promise<Record<string, unknown>>;
  }

  // ── Orders ─────────────────────────────────────────────────────

  async createOrder(email: string, items: Array<{ productId: string; quantity: number }>): Promise<Order> {
    const res = await fetch(`${this.orderUrl}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, items }),
    });
    return res.json() as Promise<Order>;
  }

  async getOrder(orderId: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.orderUrl}/orders/${orderId}`);
    return res.json() as Promise<Record<string, unknown>>;
  }

  async completeOrder(orderId: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.orderUrl}/orders/${orderId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json() as Promise<Record<string, unknown>>;
  }

  async refundOrder(orderId: string, reason?: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.orderUrl}/orders/${orderId}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason ?? 'customer request' }),
    });
    return res.json() as Promise<Record<string, unknown>>;
  }

  async getOrderHealth(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.orderUrl}/health`);
    return res.json() as Promise<Record<string, unknown>>;
  }

  // ── Fulfillment ────────────────────────────────────────────────

  async reconcileShipments(): Promise<ReconcileResult> {
    const res = await fetch(`${this.fulfillmentUrl}/shipments/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json() as Promise<ReconcileResult>;
  }

  async getFulfillmentHealth(): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.fulfillmentUrl}/health`);
    return res.json() as Promise<Record<string, unknown>>;
  }

  // ── Trigger helpers ────────────────────────────────────────────

  /**
   * Trigger Bug 1: Cascading Timeout
   * Sends N concurrent orders that each call catalog-api /products/search?category=accessories
   * The N+1 DynamoDB queries in catalog-api cause timeouts in order-api
   */
  async triggerCascadingTimeout(concurrent = 10): Promise<void> {
    const promises: Promise<unknown>[] = Array.from({ length: concurrent }, () =>
      this.createOrder('stress@test.com', [
        { productId: 'prod-acc-001', quantity: 1 },
        { productId: 'prod-acc-002', quantity: 2 },
      ]).catch(() => {}),
    );

    // Also trigger search directly to amplify catalog-api load
    for (let i = 0; i < 5; i++) {
      promises.push(
        this.searchProducts('accessories').catch(() => {}),
      );
    }

    await Promise.all(promises);
  }

  /**
   * Trigger Bug 2: Silent Item Truncation
   * Creates an order with 5+ items so fulfillment batch processing hits off-by-one
   */
  async triggerSilentItemLoss(): Promise<{ orderId: string }> {
    const order = await this.createOrder('truncation@test.com', [
      { productId: 'prod-elec-001', quantity: 1 },
      { productId: 'prod-elec-002', quantity: 1 },
      { productId: 'prod-acc-001', quantity: 1 },
      { productId: 'prod-acc-002', quantity: 1 },
      { productId: 'prod-acc-003', quantity: 1 },
    ]);
    return { orderId: order.orderId };
  }

  /**
   * Trigger Bug 3: Double Refund
   * Sends N concurrent refund requests for the same order (check-then-act race condition)
   */
  async triggerDoubleRefund(orderId: string, concurrent = 5): Promise<void> {
    const promises = Array.from({ length: concurrent }, () =>
      this.refundOrder(orderId, 'concurrent refund test').catch(() => {}),
    );
    await Promise.all(promises);
  }
}
