# Sprint 1 — Core: /finalize endpoint + idempotent webhook registration

## Context

Dashboard calls `POST /v1/integrations/connect/:provider/finalize` after Composio
OAuth completes (redirect with `?status=success&connectedAccountId=ca_xxx`).
Core doesn't have this endpoint → 404 → toast shows "Falha ao conectar: Not Found".

Additionally, `ComposioTriggerService.registerWebhookSubscription` exists but is
never called from bootstrap, so Composio doesn't know our webhook URL and trigger
events fire into the void.

## Files to Create

- `src/modules/integration/application/finalize-connection.usecase.ts`
- `tests/unit/modules/integration/finalize-connection.usecase.test.ts`

## Files to Modify

- `src/modules/integration/infra/integration.routes.ts`
  — add `POST /connect/:provider/finalize` accepting `{connectedAccountId:string}`.
  — Returns `200 {connection:{id,provider,status,connectedAccountId,connectedAt}}`
  — Returns `400 {code:"missing_connected_account_id"}` when body field absent
  — Add to `IntegrationUseCases` interface: `finalizeConnection?: FinalizeConnectionUseCase`

- `src/shared/infra/integrations/composio-trigger-service.ts`
  — Make `registerWebhookSubscription` idempotent: GET existing subscriptions first,
    POST only if our URL is not already registered. Return registered URL.

- `src/shared/config/index.ts`
  — Add `composio.webhookUrl`: `process.env['COMPOSIO_WEBHOOK_URL'] ?? ''`
    (bootstrap will compute it if blank as `${appBaseUrl}/webhooks/composio`)

- `src/bootstrap.ts`
  — Wire `FinalizeConnectionUseCase` into `IntegrationUseCases`
  — After app starts, if `config.composio.apiKey` is set, call
    `composioTriggerService.registerWebhookSubscription(webhookUrl)` idempotently.
    webhookUrl = `config.composio.webhookUrl || (config.app?.baseUrl ?? process.env['APP_BASE_URL'] ?? '') + '/webhooks/composio'`
    Log `composio.webhook.registered url=<url>` on success, `composio.webhook.already_registered` if idempotent skip.

## Shared Contract (consumed by web Sprint 2)

```
POST /v1/integrations/connect/:provider/finalize
Authorization: Bearer <clerk-jwt>
Body: { connectedAccountId: string }

200: { connection: { id: string, provider: string, status: "connected", connectedAccountId: string, connectedAt: string } }
400: { code: "missing_connected_account_id" }
```

## Acceptance Criteria

- [ ] `POST /v1/integrations/connect/sentry/finalize` with valid body returns 200
- [ ] `POST /v1/integrations/connect/sentry/finalize` with missing body field returns 400 `{code:"missing_connected_account_id"}`
- [ ] Unit tests pass for `FinalizeConnectionUseCase`
- [ ] Route tests pass for the finalize endpoint
- [ ] `registerWebhookSubscription` is idempotent (no duplicate registrations)
- [ ] Bootstrap calls `registerWebhookSubscription` when `composio.apiKey` set
- [ ] `pnpm test:run` passes (all existing tests + new ones)
- [ ] `pnpm typecheck` clean

## Implementation Notes

### FinalizeConnectionUseCase

```typescript
export interface FinalizeConnectionInput {
  tenantId: TenantId;
  provider: string;
  connectedAccountId: string;
  connectedBy: string;
}

export interface FinalizeConnectionOutput {
  connection: {
    id: string;
    provider: string;
    status: 'connected';
    connectedAccountId: string;
    connectedAt: string;
  };
}
```

Upsert `IntegrationEntity` with:
- `integrationId`: `integrationId(`${provider}-composio`)`
- `category`: determine from `PROVIDER_META` or default to `'cloud'`
- `status`: `'active'`
- `config.connectedAccountId` stored in the config map — add to IntegrationEntity schema if needed, or store in `config.apiKeyRef` field as a workaround
- Emit `integration.connected` event

### Idempotent registerWebhookSubscription

Current implementation always POSTs. Change to:
1. GET `${baseUrl}/webhook_subscriptions` with apiKey header
2. If any subscription already has `webhook_url` matching our URL → return (log already_registered)
3. Else POST to register
4. Return the registered URL

### Config

```typescript
composio: {
  apiKey: process.env['COMPOSIO_API_KEY'] ?? '',
  baseUrl: process.env['COMPOSIO_BASE_URL'] ?? '',
  webhookSecret: process.env['COMPOSIO_WEBHOOK_SECRET'] ?? process.env['COMPOSIO_API_KEY'] ?? '',
  webhookUrl: process.env['COMPOSIO_WEBHOOK_URL'] ?? '',  // ADD THIS
},
```

## Files Read-Only

- `src/shared/infra/db/entities/IntegrationEntity.ts` (understand schema)
- `src/shared/infra/integrations/composio-client.ts` (understand client)
- `src/modules/integration/application/connect-credential.usecase.ts` (follow pattern)
