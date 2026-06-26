import type { EvalScenario } from '../../eval/eval-framework.js';
import type { CustomerClient } from './customer-client.js';
import type { OrderClient } from './order-client.js';
import type { MarketplaceClient } from './marketplace-client.js';

export interface SmokeEvalScenario {
  name: string;
  cwLogPattern: string;
  alertSource: string;
  alertPayload: Record<string, unknown>;
  expectedRootCause: string;
  evalScenario: EvalScenario;
  setupScenario: (clients: { payment: CustomerClient; order?: OrderClient; marketplace?: MarketplaceClient }) => Promise<void>;
  generateTraffic: (clients: { payment: CustomerClient; order?: OrderClient; marketplace?: MarketplaceClient }) => Promise<void>;
}

/**
 * Smoke scenarios that trigger REAL bugs in the customer service.
 * No fault injection — each scenario exploits an actual code defect.
 */
export const SMOKE_EVAL_SCENARIOS: SmokeEvalScenario[] = [
  // ── Connection Pool Exhaustion ──────────────────────────────────────
  // Bug: POST /payments acquires a dedicated DB connection for transactions
  // but only calls client.release() after COMMIT (happy path). On INSERT
  // failure, the catch block does ROLLBACK but never releases the connection.
  // Each failed request leaks one connection until the pool saturates.
  {
    name: 'Connection Pool Exhaustion',
    cwLogPattern: 'Database connection unavailable',
    alertSource: 'cloudwatch',
    alertPayload: {
      AlarmName: 'payment-service-connection-pool-saturation',
      NewStateValue: 'ALARM',
      NewStateReason: 'Threshold Crossed: ActiveConnections at maximum, new requests timing out',
      Trigger: { Namespace: 'Custom/PaymentService' },
      Region: 'us-east-1',
      AlarmArn: 'arn:aws:cloudwatch:us-east-1:000000000000:alarm:payment-service-connection-pool-saturation',
    },
    expectedRootCause: 'connection pool exhaust timeout database release leak saturate',
    evalScenario: {
      name: 'Connection Pool Exhaustion',
      alertPayload: {
        source: 'cloudwatch',
        externalId: 'payment-service-connection-pool-saturation',
        payload: {},
      },
      expectedRootCause: 'connection pool exhaust timeout database release leak saturate',
      expectedSeverity: 'critical',
      expectedActions: ['restart', 'pool', 'connection', 'scale', 'fix_pr', 'create_fix'],
      acceptableAgents: ['investigation'],
      minConfidence: 0.7,
    },
    setupScenario: async ({ payment }) => {
      // Establish baseline — a few successful payments
      for (let i = 0; i < 3; i++) {
        await payment.createPayment(100 + i);
      }

      // Trigger connection leak: send requests with missing 'amount' field.
      // PostgreSQL rejects the INSERT (NOT NULL violation), the error path
      // runs ROLLBACK but skips client.release(), leaking the connection.
      // Pool max is 20; we send 22 to guarantee exhaustion.
      for (let i = 0; i < 22; i++) {
        await payment.sendPayment({ currency: 'BRL', description: `txn-${i}` });
      }

      // Brief pause for connections to settle
      await new Promise((r) => setTimeout(r, 1_000));
    },
    generateTraffic: async ({ payment }) => {
      // With pool exhausted, these requests timeout after connectionTimeoutMillis (5s)
      // and produce "Database connection unavailable" error logs
      for (let i = 0; i < 3; i++) {
        try {
          await payment.createPayment(500 + i);
        } catch {
          // Expected: pool exhausted → 503
        }
      }
    },
  },

  // ── Race Condition + Stale Cache ──────────────────────────────────
  // Bug: POST /orders checks stock OUTSIDE the transaction (race window)
  // and reads price from MongoDB cache (stale without active invalidation).
  // Under concurrent load, stock goes negative (overselling).
  {
    name: 'Race Condition + Stale Cache',
    cwLogPattern: 'Negative stock detected',
    alertSource: 'cloudwatch',
    alertPayload: {
      AlarmName: 'order-service-data-inconsistency',
      NewStateValue: 'ALARM',
      NewStateReason: 'Negative stock detected — race condition in order processing',
      Trigger: { Namespace: 'Custom/OrderService' },
      Region: 'us-east-1',
      AlarmArn: 'arn:aws:cloudwatch:us-east-1:000000000000:alarm:order-service-data-inconsistency',
    },
    expectedRootCause: 'race condition stock negative oversell transaction lock concurrent stale cache mismatch',
    evalScenario: {
      name: 'Race Condition + Stale Cache',
      alertPayload: {
        source: 'cloudwatch',
        externalId: 'order-service-data-inconsistency',
        payload: {},
      },
      expectedRootCause: 'race condition stock negative oversell transaction lock concurrent stale cache mismatch',
      expectedSeverity: 'critical',
      expectedActions: ['race', 'lock', 'cache', 'fix', 'restart'],
      acceptableAgents: ['investigation'],
      minConfidence: 0.7,
    },
    setupScenario: async ({ order }) => {
      if (!order) return;
      // Trigger race condition: 10 concurrent orders for Widget Pro (stock=5)
      await order.triggerRaceCondition(10);
      // Brief pause for logs to settle
      await new Promise((r) => setTimeout(r, 2_000));
    },
    generateTraffic: async ({ order }) => {
      if (!order) return;
      // Additional concurrent orders to produce more "Negative stock" logs
      await order.triggerRaceCondition(5);
    },
  },

  // ── Cascading Timeout (marketplace-platform) ─────────────────────
  // Bug: catalog-api /products/search does N+1 DynamoDB queries (1 Scan + N Review queries).
  // order-api calls catalog-api with 3s timeout + 3 retries (500ms fixed, no backoff).
  // Under concurrent load, catalog-api is overwhelmed → cascade of 504s.
  {
    name: 'Cascading Timeout',
    cwLogPattern: 'Upstream service timeout',
    alertSource: 'cloudwatch',
    alertPayload: {
      AlarmName: 'order-api-cascading-timeout',
      NewStateValue: 'ALARM',
      NewStateReason: 'Upstream timeout cascade — catalog-api unresponsive under load',
      Trigger: { Namespace: 'Custom/OrderApi' },
      Region: 'us-east-1',
      AlarmArn: 'arn:aws:cloudwatch:us-east-1:000000000000:alarm:order-api-cascading-timeout',
    },
    expectedRootCause: 'timeout cascade retry upstream catalog latency query connection amplification',
    evalScenario: {
      name: 'Cascading Timeout',
      alertPayload: {
        source: 'cloudwatch',
        externalId: 'order-api-cascading-timeout',
        payload: {},
      },
      expectedRootCause: 'timeout cascade retry upstream catalog latency query connection amplification',
      expectedSeverity: 'critical',
      expectedActions: ['retry', 'timeout', 'backoff', 'circuit_breaker', 'fix_pr', 'create_fix'],
      acceptableAgents: ['investigation'],
      minConfidence: 0.7,
    },
    setupScenario: async ({ marketplace }) => {
      if (!marketplace) return;
      // Baseline: 3 small orders to warm up
      for (let i = 0; i < 3; i++) {
        await marketplace.createOrder(`baseline-${i}@test.com`, [
          { productId: 'prod-elec-001', quantity: 1 },
        ]).catch(() => {});
      }
      await new Promise((r) => setTimeout(r, 1_000));
    },
    generateTraffic: async ({ marketplace }) => {
      if (!marketplace) return;
      // 10 concurrent orders to overwhelm catalog-api with N+1 queries
      await marketplace.triggerCascadingTimeout(10);
    },
  },

  // ── Silent Item Truncation (marketplace-platform) ────────────────
  // Bug: fulfillment-api batch processing uses items.slice(i, BATCH_SIZE) instead of
  // items.slice(i, i + BATCH_SIZE). For orders with >BATCH_SIZE items, items are silently lost.
  {
    name: 'Silent Item Truncation',
    cwLogPattern: 'Shipment item count mismatch',
    alertSource: 'cloudwatch',
    alertPayload: {
      AlarmName: 'fulfillment-api-data-integrity',
      NewStateValue: 'ALARM',
      NewStateReason: 'Shipment items do not match order items — data integrity violation',
      Trigger: { Namespace: 'Custom/FulfillmentApi' },
      Region: 'us-east-1',
      AlarmArn: 'arn:aws:cloudwatch:us-east-1:000000000000:alarm:fulfillment-api-data-integrity',
    },
    expectedRootCause: 'item truncation shipment missing batch offset data loss mismatch',
    evalScenario: {
      name: 'Silent Item Truncation',
      alertPayload: {
        source: 'cloudwatch',
        externalId: 'fulfillment-api-data-integrity',
        payload: {},
      },
      expectedRootCause: 'item truncation shipment missing batch offset data loss mismatch',
      expectedSeverity: 'high',
      expectedActions: ['batch', 'fix', 'data', 'fix_pr', 'create_fix'],
      acceptableAgents: ['investigation'],
      minConfidence: 0.7,
    },
    setupScenario: async ({ marketplace }) => {
      if (!marketplace) return;
      // Create an order with 5 items (> BATCH_SIZE=3) to trigger the off-by-one
      await marketplace.triggerSilentItemLoss();
      await new Promise((r) => setTimeout(r, 2_000));
    },
    generateTraffic: async ({ marketplace }) => {
      if (!marketplace) return;
      // Reconcile to detect and log the mismatch
      await marketplace.reconcileShipments();
    },
  },

  // ── Double Refund Race Condition (marketplace-platform) ──────────
  // Bug: POST /orders/:id/refund does check-then-act without ConditionExpression.
  // Concurrent refund requests pass the totalRefunded check simultaneously → double refund.
  {
    name: 'Double Refund Race Condition',
    cwLogPattern: 'Over-refund detected',
    alertSource: 'cloudwatch',
    alertPayload: {
      AlarmName: 'order-api-financial-integrity',
      NewStateValue: 'ALARM',
      NewStateReason: 'Financial discrepancy — customers over-refunded',
      Trigger: { Namespace: 'Custom/OrderApi' },
      Region: 'us-east-1',
      AlarmArn: 'arn:aws:cloudwatch:us-east-1:000000000000:alarm:order-api-financial-integrity',
    },
    expectedRootCause: 'double refund race condition concurrent duplicate transaction isolation',
    evalScenario: {
      name: 'Double Refund Race Condition',
      alertPayload: {
        source: 'cloudwatch',
        externalId: 'order-api-financial-integrity',
        payload: {},
      },
      expectedRootCause: 'double refund race condition concurrent duplicate transaction isolation',
      expectedSeverity: 'critical',
      expectedActions: ['race', 'lock', 'condition', 'fix', 'fix_pr', 'create_fix'],
      acceptableAgents: ['investigation'],
      minConfidence: 0.7,
    },
    setupScenario: async ({ marketplace }) => {
      if (!marketplace) return;
      // Create and complete an order so it's eligible for refund
      const order = await marketplace.createOrder('refund-test@test.com', [
        { productId: 'prod-elec-001', quantity: 1 },
      ]);
      await marketplace.completeOrder(order.orderId);
      // Store orderId for generateTraffic via closure
      (marketplace as any)._refundTargetOrderId = order.orderId;
      await new Promise((r) => setTimeout(r, 1_000));
    },
    generateTraffic: async ({ marketplace }) => {
      if (!marketplace) return;
      const orderId = (marketplace as unknown as Record<string, unknown>)['_refundTargetOrderId'] as string | undefined;
      if (!orderId) return;
      // 5 concurrent refund requests to trigger check-then-act race condition
      await marketplace.triggerDoubleRefund(orderId, 5);
    },
  },
];
