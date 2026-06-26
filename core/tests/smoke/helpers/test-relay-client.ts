import WebSocket from 'ws';
import type { RelayRpcRequest } from '../../../src/shared/infra/relay/relay-protocol.js';

export interface TestRelayClientOptions {
  url: string;
  tenantId: string;
  token: string;
}

/**
 * Test relay client that simulates a causeflow-relay container.
 * Connects via WSS, registers resources, and responds to JSON-RPC requests
 * with realistic mock data (order-postgres + order-mongo).
 */
export class TestRelayClient {
  private ws: WebSocket | null = null;
  private readonly options: TestRelayClientOptions;
  private connected = false;

  constructor(options: TestRelayClientOptions) {
    this.options = options;
  }

  async connect(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const url = `${this.options.url}?token=${this.options.token}&tenantId=${this.options.tenantId}`;
      this.ws = new WebSocket(url);

      const timeout = setTimeout(() => {
        reject(new Error('Test relay connection timeout'));
      }, 10_000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.connected = true;

        // Send resource registration (like the real relay does)
        this.sendResourceUpdate();

        // Install message handler for JSON-RPC requests
        this.ws!.on('message', (data: Buffer | string) => {
          this.handleMessage(typeof data === 'string' ? data : data.toString());
        });

        resolve();
      });

      this.ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  sendHeartbeat(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'heartbeat',
      relayId: 'test-relay-1',
      tenantId: this.options.tenantId,
    }));
  }

  close(): void {
    this.connected = false;
    this.ws?.close();
  }

  private sendResourceUpdate(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'resource_update',
      relayId: 'test-relay-1',
      tenantId: this.options.tenantId,
      resources: [
        {
          resourceId: 'order-postgres',
          type: 'postgres',
          name: 'Order Service DB',
          database: 'orders',
          readOnly: true,
        },
        {
          resourceId: 'order-mongo',
          type: 'mongodb',
          name: 'Order Service Cache',
          database: 'orders',
          readOnly: true,
        },
      ],
    }));
  }

  private handleMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw) as RelayRpcRequest;

      // Only handle JSON-RPC requests (have method + id)
      if (!msg.jsonrpc || !msg.method || !msg.id) return;

      const response = this.buildResponse(msg);
      this.ws?.send(JSON.stringify(response));
    } catch {
      // Ignore non-JSON or invalid messages
    }
  }

  private buildResponse(req: RelayRpcRequest): Record<string, unknown> {
    const base = { jsonrpc: '2.0' as const, id: req.id };

    switch (req.method) {
      case 'list_resources':
        return {
          ...base,
          result: [
            { resourceId: 'order-postgres', type: 'postgres', name: 'Order Service DB', database: 'orders', readOnly: true },
            { resourceId: 'order-mongo', type: 'mongodb', name: 'Order Service Cache', database: 'orders', readOnly: true },
          ],
        };

      case 'describe_resource':
        return {
          ...base,
          result: {
            type: req.params['resourceId'] === 'order-mongo' ? 'mongodb' : 'postgres',
            database: 'orders',
            tables: [
              { name: 'customers', rowCount: 2 },
              { name: 'products', rowCount: 2 },
              { name: 'orders', rowCount: 15 },
              { name: 'order_items', rowCount: 15 },
            ],
          },
        };

      case 'execute':
        return this.handleExecute(req);

      case 'health_check':
        return { ...base, result: { healthy: true, drivers: ['postgres', 'mongodb'] } };

      default:
        return { ...base, error: { code: -32601, message: `Method not found: ${String(req.method)}` } };
    }
  }

  private handleExecute(req: RelayRpcRequest): Record<string, unknown> {
    const base = { jsonrpc: '2.0' as const, id: req.id };
    const operation = req.params['operation'] as string;

    switch (operation) {
      case 'list_tables':
        return {
          ...base,
          result: {
            rows: [
              { table_name: 'customers' },
              { table_name: 'products' },
              { table_name: 'orders' },
              { table_name: 'order_items' },
            ],
            rowCount: 4,
            executionTimeMs: 3,
            masked: false,
            maskedFieldCount: 0,
          },
        };

      case 'describe_table': {
        const tableName = (req.params['params'] as Record<string, unknown>)?.['tableName'] as string;
        return {
          ...base,
          result: {
            rows: this.getTableSchema(tableName),
            rowCount: 4,
            executionTimeMs: 2,
            masked: false,
            maskedFieldCount: 0,
          },
        };
      }

      case 'query':
        return {
          ...base,
          result: this.handleQuery(req.params),
        };

      case 'explain':
        return {
          ...base,
          result: {
            rows: [{ 'QUERY PLAN': 'Seq Scan on products (cost=0.00..1.02 rows=2 width=72)' }],
            rowCount: 1,
            executionTimeMs: 1,
            masked: false,
            maskedFieldCount: 0,
          },
        };

      default:
        return { ...base, error: { code: -32602, message: `Unknown operation: ${operation}` } };
    }
  }

  private handleQuery(params: Record<string, unknown>): Record<string, unknown> {
    const sql = ((params['params'] as Record<string, unknown>)?.['sql'] as string ?? '').toLowerCase();

    // Simulate products query — shows negative stock (the bug evidence)
    if (sql.includes('products')) {
      return {
        rows: [
          { id: 'c1111111-1111-1111-1111-111111111111', name: 'Widget Pro', stock_quantity: -5, reserved_quantity: 10, price_cents: 2999 },
          { id: 'c2222222-2222-2222-2222-222222222222', name: 'Gadget Plus', stock_quantity: 95, reserved_quantity: 5, price_cents: 4999 },
        ],
        rowCount: 2,
        executionTimeMs: 5,
        masked: false,
        maskedFieldCount: 0,
      };
    }

    // Simulate orders query — shows concurrent orders
    if (sql.includes('orders') && !sql.includes('order_items')) {
      return {
        rows: [
          { id: 'ord-001', customer_id: 'a1111111-1111-1111-1111-111111111111', status: 'confirmed', total_cents: 2999, created_at: new Date().toISOString() },
          { id: 'ord-002', customer_id: 'a1111111-1111-1111-1111-111111111111', status: 'confirmed', total_cents: 2999, created_at: new Date().toISOString() },
          { id: 'ord-003', customer_id: 'a1111111-1111-1111-1111-111111111111', status: 'confirmed', total_cents: 2999, created_at: new Date().toISOString() },
        ],
        rowCount: 3,
        fields: [
          { name: 'id', type: 'varchar' },
          { name: 'customer_id', type: 'varchar' },
          { name: 'status', type: 'varchar' },
          { name: 'total_cents', type: 'integer' },
          { name: 'created_at', type: 'timestamp' },
        ],
        executionTimeMs: 8,
        masked: true,
        maskedFieldCount: 0,
      };
    }

    // Simulate customer query with PII masking
    if (sql.includes('customers')) {
      return {
        rows: [
          { id: 'a1111111-1111-1111-1111-111111111111', name: 'Alice ***', email: '***@***.com', phone: '***-***-****' },
          { id: 'b2222222-2222-2222-2222-222222222222', name: 'Bob ***', email: '***@***.com', phone: '***-***-****' },
        ],
        rowCount: 2,
        executionTimeMs: 3,
        masked: true,
        maskedFieldCount: 6,
      };
    }

    // Default: empty result
    return {
      rows: [],
      rowCount: 0,
      executionTimeMs: 1,
      masked: false,
      maskedFieldCount: 0,
    };
  }

  private getTableSchema(tableName: string): Record<string, unknown>[] {
    const schemas: Record<string, Record<string, unknown>[]> = {
      products: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'name', data_type: 'varchar(100)', is_nullable: 'NO' },
        { column_name: 'stock_quantity', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'reserved_quantity', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'price_cents', data_type: 'integer', is_nullable: 'NO' },
      ],
      orders: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'customer_id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'status', data_type: 'varchar(20)', is_nullable: 'NO' },
        { column_name: 'total_cents', data_type: 'integer', is_nullable: 'NO' },
        { column_name: 'created_at', data_type: 'timestamp', is_nullable: 'NO' },
      ],
      customers: [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
        { column_name: 'name', data_type: 'varchar(100)', is_nullable: 'NO' },
        { column_name: 'email', data_type: 'varchar(255)', is_nullable: 'NO' },
        { column_name: 'phone', data_type: 'varchar(20)', is_nullable: 'YES' },
      ],
    };
    return schemas[tableName ?? ''] ?? [{ column_name: 'unknown', data_type: 'unknown' }];
  }
}

/**
 * Convenience: connect a test relay to a smoke harness WSS server.
 */
export async function connectTestRelay(
  port: number,
  tenantId: string,
  token: string,
  wsPath = '/v1/relay/connect',
): Promise<TestRelayClient> {
  const client = new TestRelayClient({
    url: `ws://localhost:${port}${wsPath}`,
    tenantId,
    token,
  });
  await client.connect();

  // Allow resource_update message to propagate
  await new Promise((r) => setTimeout(r, 200));

  return client;
}
