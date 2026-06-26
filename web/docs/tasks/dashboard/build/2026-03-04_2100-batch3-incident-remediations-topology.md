# Batch 3: Enhance Incidents with Inline Remediations + Add Topology View

Must run AFTER Batch 2 (core API rename) merges. This batch adds features that depend on the renamed API client.

## Context

### Core API Reference
The Core API docs are at `apps/core/core-api.md` and `apps/core/core-swagger-api.yaml`.

**What the dashboard should show from Core API:**
- Incidents: list, create, get (with source tracking — manual vs webhook)
- Remediations: inline within incidents (approve/reject/auto-approve)
- Graph/Topology: service nodes, edges, health, blast radius
- Incident source: `sourceProvider` field tells if incident came from datadog, grafana, cloudwatch, sentry, or manual
- Creator: for manual incidents, the logged-in user who created it

**What the dashboard should NOT show:**
- Knowledge/Patterns (internal AI learning)
- Ingestion/Triage (backend pipeline)
- Notifications (audit/internal — not user-facing)

### Incident Model (from Core API)
```
Incident {
  incidentId, tenantId, title, description,
  severity: critical | high | medium | low | info,
  status: open | triaging | investigating | awaiting_approval | remediating | resolved | closed,
  sourceProvider: string (datadog, grafana, cloudwatch, sentry, manual),
  sourceAlertId: string (dedup key),
  assignedAgents: string[],
  rootCause?: string,
  resolution?: string,
  createdAt, updatedAt
}
```

### Remediation Model
```
Remediation {
  remediationId, tenantId, incidentId,
  rootCause: string,
  recommendedActions: [{ action: string, params: object }],
  status: proposed | approved | rejected | executing | completed | failed,
  proposedBy: string,
  approvedBy?: string,
  rejectedBy?: string,
  reason?: string
}
```

### Tenant Settings (relevant)
```
settings.autoRemediation: boolean  // if true, auto-approve remediations
```

### Core API Endpoints Used
- `GET /v1/incidents` — list incidents (filters: severity, status, sort)
- `GET /v1/incidents/:id` — incident detail
- `PATCH /v1/incidents/:id` — update status
- `GET /v1/remediation/:incidentId` — list remediations for incident
- `POST /v1/remediation/:id/approve` — approve remediation
- `POST /v1/remediation/:id/reject` — reject remediation
- `POST /v1/remediation/:id/execute` — execute approved remediation
- `GET /v1/graph` — list service nodes (filter by type, health, team)
- `GET /v1/graph/nodes/:id` — node detail
- `GET /v1/graph/edges` — list edges
- `GET /v1/graph/health` — system health summary
- `GET /v1/graph/blast-radius/:id` — blast radius for a service
- `GET /v1/tenant/:id` — get tenant (for autoRemediation setting)

---

## Task A: Enhance Incident Detail with Inline Remediations

### Current State
File: `apps/dashboard/src/contexts/investigation/presentation/components/incident-detail.tsx`

Current `RemediationsSection` (internal component, lines 23-68):
- Fetches `/api/remediations?incidentId=...` via client-side fetch
- Shows a simple list of remediation descriptions with `proposedBy`
- Links to `/dashboard/remediations/{id}` (standalone page that we're removing in Batch 1)

Current source display (lines 177-179):
```tsx
{incident.sourceProvider && incident.sourceProvider !== 'manual' && (
  <span className="text-sm text-muted-foreground capitalize">
    {t('sourceProvider')}: {incident.sourceProvider}
  </span>
)}
```
Only shows source when NOT manual — should show for ALL sources.

### Changes Needed

**1. Show incident source for ALL incidents (not just non-manual):**
- Remove the `!== 'manual'` filter
- For manual incidents, show "Created manually by {createdBy}"
- For webhook incidents, show "Triggered by {sourceProvider}" with the provider icon/badge

**2. Enhance RemediationsSection with inline actions:**
Replace the simple list with an interactive card per remediation:

```tsx
// Per remediation card:
<Card>
  <CardHeader>
    <div className="flex justify-between">
      <div>
        <h4>Remediation #{index + 1}</h4>
        <Badge variant={statusVariant}>{rem.status}</Badge>
      </div>
      {rem.status === 'proposed' && (
        <div className="flex gap-2">
          <Button variant="default" onClick={() => approve(rem.id)}>Approve</Button>
          <Button variant="destructive" onClick={() => reject(rem.id)}>Reject</Button>
        </div>
      )}
    </div>
  </CardHeader>
  <CardContent>
    <p className="text-sm">{rem.rootCause}</p>
    <h5>Recommended Actions:</h5>
    <ul>
      {rem.recommendedActions.map(a => <li>{a.action}: {JSON.stringify(a.params)}</li>)}
    </ul>
    {rem.approvedBy && <p>Approved by: {rem.approvedBy}</p>}
    {rem.rejectedBy && <p>Rejected by: {rem.rejectedBy} — {rem.reason}</p>}
  </CardContent>
</Card>
```

**3. Auto-approve badge:**
If the tenant has `autoRemediation: true`, show a badge on the remediation section header: "Auto-approve enabled"

**4. Remove links to standalone remediation pages:**
Change any `Link` to `/dashboard/remediations/...` — remediation detail should be inline, not a separate page.

### API Routes
The existing API routes should work:
- `GET /api/remediations?incidentId=...` — list for incident
- `PATCH /api/remediations/[id]` — approve/reject (check if this route handles approve/reject actions, or if separate endpoints are needed)

Check if approve/reject API routes exist:
- `apps/dashboard/src/app/api/approvals/[id]/respond/route.ts` — this may handle approval responses

### i18n Keys to Add
Add to `apps/dashboard/src/contexts/investigation/infrastructure/i18n/en.json`:
```json
{
  "incidentDetail": {
    "sourceManual": "Created manually by {creator}",
    "sourceWebhook": "Triggered by {provider}",
    "remediations": {
      "title": "Remediations",
      "approve": "Approve",
      "reject": "Reject",
      "execute": "Execute",
      "autoApproveEnabled": "Auto-approve enabled",
      "rootCause": "Root Cause",
      "recommendedActions": "Recommended Actions",
      "approvedBy": "Approved by {user}",
      "rejectedBy": "Rejected by {user}",
      "reason": "Reason",
      "noRemediations": "No remediations proposed yet",
      "statusProposed": "Proposed",
      "statusApproved": "Approved",
      "statusRejected": "Rejected",
      "statusExecuting": "Executing",
      "statusCompleted": "Completed",
      "statusFailed": "Failed"
    }
  }
}
```

And the PT-BR equivalents.

### Incident List — Source Column
File: Check for incident list component in `apps/dashboard/src/contexts/investigation/presentation/components/`

Add a "Source" column showing:
- Provider icon + name for webhook incidents
- "Manual" badge for manually created incidents

---

## Task B: Add Graph/Topology View

### New Sidebar Item
After removing remediations/approvals in Batch 1, add a new nav item:

```ts
{ key: 'topology', href: '/dashboard/topology', icon: Network },
```

Place it after `incidents` in the nav order. Import `Network` from `lucide-react`.

### i18n
Add to shared i18n:
- EN: `"sidebar.topology": "Topology"`
- PT-BR: `"sidebar.topology": "Topologia"`

### New Page Route
Create: `apps/dashboard/src/app/[locale]/dashboard/topology/page.tsx`

This should be a thin orchestrator that renders the topology component from the investigation (or shared) bounded context.

### Core API Client Methods Needed
Check if these already exist in `ICoreApiClient` (now renamed from `IExternalApiClient`). If not, add them:

```ts
// Graph/Topology
listServiceNodes(params?: { type?: string; healthStatus?: string; ownerTeam?: string }): Promise<ServiceNode[]>;
getServiceNode(serviceId: string): Promise<ServiceNode>;
listServiceEdges(params?: { sourceService?: string; targetService?: string }): Promise<ServiceEdge[]>;
getSystemHealth(): Promise<SystemHealthSummary>;
getBlastRadius(serviceId: string, maxDepth?: number): Promise<BlastRadiusResult>;
```

### Types (add to core-api-types.ts if not present)
```ts
export interface ServiceNode {
  serviceId: string;
  tenantId: string;
  name: string;
  type: 'api' | 'database' | 'cache' | 'queue' | 'storage' | 'cdn' | 'load_balancer' | 'function' | 'container' | 'other';
  runtime?: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  healthDetails?: string;
  blastRadius?: number;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  ownerTeam?: string;
  tags?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface ServiceEdge {
  edgeId: string;
  sourceService: string;
  targetService: string;
  edgeType: 'http' | 'grpc' | 'tcp' | 'event' | 'database' | 'cache' | 'queue';
  protocol?: string;
  traffic?: {
    requestsPerSecond?: number;
    avgLatencyMs?: number;
    errorRate?: number;
  };
  isCriticalPath: boolean;
}
```

### Topology Page Component
Create in the appropriate bounded context (likely `shared` or a new `topology` context):

**Main topology page layout:**
1. **Header**: "Infrastructure Topology" title + health summary badges
2. **Filters**: Filter by service type, health status, owner team
3. **Service Grid/List**: Card per service node showing:
   - Name + type icon
   - Health status badge (green/yellow/red/gray)
   - Criticality badge
   - Blast radius score
   - Owner team
   - Connected services count
4. **Service Detail Panel** (expandable or drawer): When clicking a service:
   - Full service details
   - Connected edges (upstream/downstream)
   - Blast radius visualization (list of affected services)
   - Health details + last check time

**Simple implementation (no graph visualization library needed for v1):**
- Use a responsive grid of cards for services
- Each card shows health + type + connections
- Click to expand detail panel
- Filter controls at the top

### Mock Data
Add to `MockApiClient`:

```ts
private mockServiceNodes: ServiceNode[] = [
  {
    serviceId: 'svc_api_gateway',
    tenantId: this.tenantId,
    name: 'API Gateway',
    type: 'api',
    healthStatus: 'healthy',
    criticality: 'critical',
    blastRadius: 8.5,
    ownerTeam: 'Platform',
  },
  {
    serviceId: 'svc_payment',
    tenantId: this.tenantId,
    name: 'Payment Service',
    type: 'api',
    healthStatus: 'degraded',
    criticality: 'high',
    blastRadius: 5.2,
    ownerTeam: 'Payments',
  },
  // ... 6-8 more nodes covering different types
];

private mockServiceEdges: ServiceEdge[] = [
  {
    edgeId: 'edge_1',
    sourceService: 'svc_api_gateway',
    targetService: 'svc_payment',
    edgeType: 'http',
    isCriticalPath: true,
    traffic: { requestsPerSecond: 150, avgLatencyMs: 45, errorRate: 0.02 },
  },
  // ... edges connecting the nodes
];
```

### API Routes
Create: `apps/dashboard/src/app/api/topology/route.ts`

```ts
// GET /api/topology — returns { nodes: ServiceNode[], edges: ServiceEdge[], health: SystemHealthSummary }
```

And optionally:
- `apps/dashboard/src/app/api/topology/[serviceId]/route.ts` — node detail + blast radius

### i18n
Add topology-specific translations to the appropriate context's i18n files.

---

## Implementation Order
1. Task A first (incident enhancements) — modifies existing files
2. Task B second (topology) — adds new files, less risk of conflicts

## Verification
- Incident detail page shows remediations with approve/reject inline
- Incident list shows source column
- Source shows for ALL incidents (manual and webhook)
- Topology page loads with service grid
- Clicking a service shows detail panel
- All sidebar links work correctly
- Build, lint, types, tests pass
- Dev server starts without errors
