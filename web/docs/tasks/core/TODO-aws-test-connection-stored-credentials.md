# TODO — Fix AWS "Test Connection" for already-connected integrations

**Repo:** `causeflow/core` (not `causeflow/web`)
**File:** `src/modules/integration/infra/integration.routes.ts`
**Route:** `POST /v1/integrations/test-connection`

---

## Problem

On the dashboard integrations page, clicking **"Test Connection"** on a connected AWS card always shows "connection failed" — even though the AWS role is stored in Core and the HTTP response is `200 OK`.

The response body is actually:

```json
{ "success": false, "message": "Role ARN is required" }
```

## Root cause

The `/test-connection` route only validates a `roleArn` that the **client sends in the request body**. It never loads the stored credential from DynamoDB.

Current code (`integration.routes.ts:177-204`):

```ts
app.post('/test-connection', requireRole('admin', 'owner'), async (c) => {
    const tid = c.get('tenantId')!;
    const body = await c.req.json();
    if (body.type !== 'cloudwatch' && body.type !== 'aws') {
        return c.json({ success: true, message: 'Format validation passed' });
    }
    if (!body.roleArn) {
        return c.json({ success: false, message: 'Role ARN is required' }); // ← always hit from the card
    }
    // ... STS AssumeRole using body.roleArn
});
```

This endpoint was designed for the **pre-connect form flow** (the dashboard `connection-modal.tsx` sends `{ type, ...fields }` which includes the user-typed `roleArn`). It was never adapted for the **post-connect Test button**, which sends only `{ type: 'aws' }` — the dashboard has no reason to know the stored `roleArn`, and shouldn't.

## What to change

When `body.type` is `aws` or `cloudwatch` and `body.roleArn` is absent, load the stored credential for the tenant via `GetCloudIntegrationUseCase` (which already exists at `src/modules/integration/application/get-cloud-integration.usecase.ts` and does exactly this — fetches `aws-credential` from `IntegrationEntity` and decrypts `roleArn`).

### Step 1 — Route logic

Replace the "Role ARN is required" early return with a fallback that loads from storage:

```ts
app.post('/test-connection', requireRole('admin', 'owner'), async (c) => {
    const tid = c.get('tenantId')!;
    const body = await c.req.json();

    if (body.type !== 'cloudwatch' && body.type !== 'aws') {
        return c.json({ success: true, message: 'Format validation passed' });
    }

    // Prefer client-provided roleArn (pre-connect form flow),
    // otherwise load stored credential (post-connect Test button).
    let roleArn: string | undefined = body.roleArn;
    if (!roleArn) {
        const stored = await useCases.getCloudIntegration.execute(tenantId(String(tid)));
        if (!stored) {
            return c.json({
                success: false,
                message: 'No stored AWS credentials found. Connect AWS first.',
            });
        }
        roleArn = stored.roleArn;
    }

    try {
        const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts');
        const stsClient = new STSClient({
            region: config.aws.region,
            ...(config.sts.stsEndpoint && { endpoint: config.sts.stsEndpoint }),
        });
        await stsClient.send(new AssumeRoleCommand({
            RoleArn: roleArn,
            RoleSessionName: 'causeflow-test-connection',
            ExternalId: String(tid),
            DurationSeconds: 900,
        }));
        return c.json({
            success: true,
            message: 'Connection successful. CauseFlow can access your AWS account.',
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return c.json({ success: false, message: `Connection failed: ${msg}` });
    }
});
```

### Step 2 — Wire `getCloudIntegration` into `IntegrationUseCases`

Ensure the `IntegrationUseCases` bundle passed to `createIntegrationRoutes` exposes a `getCloudIntegration: GetCloudIntegrationUseCase` instance, constructed with the `TokenEncryption` port (required for decrypting stored credentials). Check the composition root where `IntegrationUseCases` is assembled and add it if it isn't already there.

### Step 3 — Tests

Add integration tests for the two paths:

1. **Post-connect flow** — body `{ type: 'aws' }` only, stored credential exists → loads stored `roleArn`, calls STS, returns `{ success: true }` on success.
2. **Post-connect flow, no stored credential** — body `{ type: 'aws' }` only, no stored credential → returns `{ success: false, message: 'No stored AWS credentials found. Connect AWS first.' }`.
3. **Pre-connect flow (regression)** — body `{ type: 'aws', roleArn: '...' }` → still uses body-provided `roleArn` (does NOT touch storage). This path must keep working unchanged so the dashboard connection modal's "Test" button before saving is unaffected.

## Out of scope

No changes are needed in the dashboard (`causeflow/web`). The dashboard already sends the correct payloads:

- Pre-connect (connection modal): `{ type, ...fields }` including `roleArn`
- Post-connect (card Test button): `{ type: 'aws' }`

Once Core handles the second case, both will work.
