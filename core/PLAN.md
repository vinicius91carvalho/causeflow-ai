# Plan: Database Investigation Relay + Sample Order Service

## Visao Geral

Duas entregas:
1. **CauseFlow Relay** — agente que roda na rede do cliente, conecta via WSS ao control plane, e permite investigar bancos de dados com seguranca enterprise
2. **Sample Order Service** — app com bug complexo (race condition + stale cache) que exige consulta a Postgres + MongoDB para diagnosticar

---

## Parte A: Relay Agent (repo separado: `causeflow/relay`)

### A1. Stack e Estrutura

```
relay/
  src/
    index.ts                     # Entry point
    config/
      schema.ts                  # Zod schema para relay-config.yaml
      loader.ts                  # YAML + env var interpolation
    transport/
      ws-client.ts               # WebSocket (outbound-only) com reconnect
      protocol.ts                # JSON-RPC types (Request, Response, Error)
      auth.ts                    # Token exchange + certificate rotation
    drivers/
      driver.port.ts             # Interface: validate(), execute(), healthCheck(), capabilities()
      postgres/
        pg-driver.ts             # node-postgres, read-only
        pg-query-parser.ts       # node-sql-parser: rejeita tudo que nao e SELECT
      mongodb/
        mongo-driver.ts          # mongodb driver, so find/aggregate/count
      dynamodb/
        dynamo-driver.ts         # @aws-sdk Query/GetItem/DescribeTable ONLY
        dynamo-policy.ts         # Valida IAM session policy (nega Scan, PutItem, etc.)
      redis/
        redis-driver.ts          # ioredis, so comandos read-only
    policy/
      policy-engine.ts           # Allowlist de recursos, operacoes, limites
      query-validator.ts         # Valida query contra policy antes de executar
    masking/
      masking-engine.ts          # Regex-based PII masking (CPF, email, cartao, etc.)
    audit/
      audit-logger.ts            # Structured JSON audit log (local + SIEM forward)
    health/
      health-reporter.ts         # Heartbeat, metricas, status de recursos
  Dockerfile                     # Multi-stage, read-only rootfs, non-root, cap-drop ALL
  relay-config.example.yaml      # Config de exemplo comentada
  package.json
  tsconfig.json
```

### A2. Seguranca — 5 Camadas de Read-Only (TECNICO, nao prompt)

| Camada | Mecanismo | O que bloqueia |
|--------|-----------|---------------|
| **1. TypeScript Interface** | `IReadOnlyDriver` so tem `query()`, `describe()`, `healthCheck()` — sem `insert()`, `update()`, `delete()` | Escrita nao compila |
| **2. SQL Parser** | `node-sql-parser` valida AST: rejeita DDL (`CREATE/DROP/ALTER`), DML (`INSERT/UPDATE/DELETE`), funcoes perigosas (`SLEEP/BENCHMARK/pg_sleep`) | SQL injection, escrita disfarcada |
| **3. MongoDB Command Filter** | Driver so expoe `find()`, `aggregate()`, `countDocuments()`, `listCollections()` — `$out`/`$merge` bloqueados no aggregate pipeline | Escrita via aggregation |
| **4. Policy Engine Local** | Allowlist de recursos + operacoes + limites configurados pelo cliente no YAML | Acesso a recurso nao autorizado |
| **5. IAM Session Policy (DynamoDB)** | `Deny` explicito para `dynamodb:Scan`, `PutItem`, `UpdateItem`, `DeleteItem`, `BatchWriteItem` na session policy do AssumeRole | Escrita/Scan no DynamoDB |

### A3. Drivers — Interface Padrao

```typescript
// driver.port.ts
export interface DriverCommand {
  resourceId: string;
  operation: string;    // 'query', 'describe_table', 'list_tables', 'health_check'
  params: Record<string, unknown>;
}

export interface DriverResult {
  rows: unknown[];
  rowCount: number;
  truncated: boolean;
  executionTimeMs: number;
  metadata?: Record<string, unknown>;
}

export interface IReadOnlyDriver {
  readonly type: string;  // 'postgresql', 'mongodb', 'dynamodb', 'redis'
  validate(cmd: DriverCommand): { valid: boolean; reason?: string };
  execute(cmd: DriverCommand): Promise<DriverResult>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number }>;
  capabilities(): string[];
}
```

### A4. Postgres Driver — Query Safety

```typescript
// pg-query-parser.ts
import { Parser } from 'node-sql-parser';

const BLOCKED_TYPES = [
  'insert', 'update', 'delete', 'drop', 'alter', 'create',
  'grant', 'revoke', 'truncate', 'copy', 'call',
];
const BLOCKED_FUNCTIONS = [
  'pg_sleep', 'sleep', 'benchmark', 'lo_import', 'lo_export',
  'pg_read_file', 'pg_ls_dir', 'pg_terminate_backend',
];

export function validateSQL(sql: string): { valid: boolean; reason?: string } {
  const parser = new Parser();
  try {
    const ast = parser.astify(sql, { database: 'PostgresQL' });
    const stmts = Array.isArray(ast) ? ast : [ast];
    for (const stmt of stmts) {
      if (BLOCKED_TYPES.includes(stmt.type?.toLowerCase())) {
        return { valid: false, reason: `Blocked: ${stmt.type}` };
      }
      // Recursive AST walk for blocked functions
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: 'Failed to parse SQL — rejected for safety' };
  }
}
```

### A5. DynamoDB — AssumeRole + Session Policy

```typescript
export const READONLY_SESSION_POLICY = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Action: [
        'dynamodb:GetItem',
        'dynamodb:Query',
        'dynamodb:DescribeTable',
        'dynamodb:ListTables',
      ],
      Resource: '*',
    },
    {
      Effect: 'Deny',
      Action: [
        'dynamodb:Scan',            // BLOQUEIO EXPLICITO
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:BatchWriteItem',
        'dynamodb:CreateTable',
        'dynamodb:DeleteTable',
        'dynamodb:UpdateTable',
      ],
      Resource: '*',
    },
  ],
};
```

### A6. Protocolo WebSocket (JSON-RPC 2.0)

```typescript
interface RelayRequest {
  jsonrpc: '2.0';
  id: string;
  method: 'execute' | 'health_check' | 'list_resources' | 'describe_resource';
  params: {
    resourceId: string;
    operation: string;
    query?: string;
    params?: Record<string, unknown>;
    incidentId?: string;
    tenantId?: string;
  };
}

interface RelayResponse {
  jsonrpc: '2.0';
  id: string;
  result?: DriverResult;
  error?: { code: number; message: string; data?: unknown };
  audit: {
    requestId: string;
    policyChecks: string[];
    maskedFieldCount: number;
    executionTimeMs: number;
  };
}
```

### A7. Data Masking (dentro do relay, antes de sair da rede)

```typescript
const DEFAULT_PATTERNS = [
  { name: 'cpf', regex: /\d{3}\.\d{3}\.\d{3}-\d{2}/g, replacement: '***CPF***' },
  { name: 'email', regex: /[\w.+-]+@[\w.-]+\.\w{2,}/g, replacement: '***EMAIL***' },
  { name: 'credit_card', regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '***CARD***' },
  { name: 'bearer_token', regex: /Bearer\s+[\w\-._~+/]+=*/g, replacement: '***TOKEN***' },
  { name: 'phone_br', regex: /\+?55\s?\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g, replacement: '***PHONE***' },
];
```

### A8. Instalacao (< 10 minutos)

```bash
docker run -d \
  --name causeflow-relay \
  --restart unless-stopped \
  -e RELAY_TOKEN=<token-do-dashboard> \
  -e PG_URI="postgresql://readonly:pass@db:5432/mydb" \
  -e MONGO_URI="mongodb://readonly:pass@mongo:27017/mydb" \
  --memory=512m --cpus=0.5 \
  --read-only --tmpfs /tmp:size=64m \
  --security-opt no-new-privileges --cap-drop ALL \
  causeflow/relay:latest
```

---

## Parte B: CauseFlow Integration (no repo sre-ai)

### B1. Novo Port: `IRelayGateway`

```typescript
// src/shared/application/ports/relay-gateway.port.ts
export interface RelayCommand {
  resourceId: string;
  operation: 'query' | 'describe_table' | 'list_tables' | 'list_databases' | 'explain';
  query?: string;
  params?: Record<string, unknown>;
  limit?: number;
}

export interface RelayQueryResult {
  rows: unknown[];
  rowCount: number;
  truncated: boolean;
  executionTimeMs: number;
  metadata?: Record<string, unknown>;
  maskedFieldCount: number;
}

export interface RelayResource {
  id: string;
  type: 'postgresql' | 'mongodb' | 'dynamodb' | 'redis';
  healthy: boolean;
  latencyMs: number;
}

export interface IRelayGateway {
  isConnected(tenantId: string): boolean;
  listResources(tenantId: string): Promise<RelayResource[]>;
  execute(tenantId: string, command: RelayCommand): Promise<RelayQueryResult>;
  describeResource(tenantId: string, resourceId: string): Promise<Record<string, unknown>>;
}
```

### B2. WebSocket Server (Control Plane)

```
src/shared/infra/relay/
  relay-ws-server.ts             # WebSocket server (wss://api/v1/relay/connect)
  relay-registry.ts              # Map<tenantId, RelayConnection>
  relay-auth.ts                  # Token validation + tenant binding
  relay-gateway.ts               # Implements IRelayGateway
```

### B3. Novo Agente: `db_analyst`

```typescript
export const DB_ANALYST_CONFIG: SubAgentConfig = {
  agentRole: 'db_analyst',
  systemPrompt: `You are an expert database analyst for SRE incident investigation.
You have access to read-only database tools. Your job is to:
1. Explore database schema to understand the data model
2. Query tables/collections to find data anomalies
3. Correlate data patterns across tables to identify root causes
4. NEVER attempt to modify data — all tools are read-only

Be methodical: first list tables, then describe schema, then query.
Focus on: data inconsistencies, unexpected NULL values, constraint violations,
timestamp gaps, duplicate records, orphaned references, negative values.`,
  tools: DB_ANALYST_TOOLS,
  maxTurns: 10,
  model: config.anthropic.agentModels.dbAnalyst,
};
```

### B4. Database Investigation Tools

```typescript
export const DB_ANALYST_TOOLS: ToolDefinition[] = [
  { name: 'db_list_resources', description: 'List all database resources available via relay' },
  { name: 'db_list_tables', description: 'List tables/collections in a database' },
  { name: 'db_describe_table', description: 'Get schema of a table (columns, types, indexes)' },
  { name: 'db_query', description: 'Execute read-only query. SQL: SELECT only. MongoDB: find/aggregate. Max 100 rows.' },
  { name: 'db_explain', description: 'Get query execution plan' },
];
```

### B5. Investigation Pipeline Update

```typescript
// db_analyst ativado quando relay esta conectado
if (this.relayGateway?.isConnected(tenantId)) {
  validRoles.push('db_analyst');
}
```

---

## Parte C: Sample Order Service (`causeflow/sample-order-service`)

### C1. Stack
- Node.js 22 + Express.js + TypeScript
- PostgreSQL (transacional) + MongoDB (audit/cache)
- CloudWatch telemetry (via LocalStack)

### C2. Schema PostgreSQL

```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(50) UNIQUE NOT NULL, name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  status VARCHAR(20) DEFAULT 'pending',
  total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL, unit_price DECIMAL(10,2) NOT NULL
);
```

### C3. MongoDB Collections

```javascript
// audit_events
{ action: 'order_created', orderId, customerId, timestamp, details: {} }

// price_cache (TTL 5min, sem invalidacao ativa)
{ productId, price: 29.90, fetchedAt: ISODate(), source: 'catalog-api' }
```

### C4. O Bug (Race Condition + Stale Cache)

```typescript
// POST /orders
// 1. Check stock (READ — FORA da transacao!)
const product = await pool.query('SELECT stock_quantity FROM products WHERE id = $1', [productId]);
if (product.rows[0].stock_quantity < quantity) return res.status(409);

// 2. Get price from MongoDB cache (pode estar stale!)
const cached = await priceCache.findOne({ productId });
const price = cached?.price ?? (await fetchCurrentPrice(productId));

// 3. Create order + deduct stock (AGORA em transacao, mas check foi fora!)
await client.query('BEGIN');
await client.query('INSERT INTO orders ...');
await client.query('UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2', [qty, productId]);
// BUG: sem SELECT FOR UPDATE, outro request pode ter deduzido entre check e deducao
await client.query('COMMIT');
```

**Sintomas observaveis via db_analyst**:
1. `SELECT * FROM products WHERE stock_quantity < 0` → overselling
2. `SELECT o.total, SUM(oi.unit_price * oi.quantity) FROM orders o JOIN order_items oi ... HAVING o.total != SUM(...)` → price mismatches
3. MongoDB `audit_events` com timestamps sobrepostos para mesmo produto → race condition
4. MongoDB `price_cache` com `fetchedAt` antigo → stale cache

### C5. Smoke Test

Trigger: 10 orders concorrentes para produto com stock=5 → stock fica negativo → alert → db_analyst investiga → encontra root cause.

---

## Parte D: Fases de Implementacao

### Fase 1 — CauseFlow Integration (Sprint 24) ~20 arquivos

**Novos (12)**:
- `src/shared/application/ports/relay-gateway.port.ts`
- `src/modules/investigation/infra/db-tools.ts`
- `src/modules/investigation/application/db-analyst-config.ts`
- `tests/fixtures/fixture-relay-gateway.ts`
- `tests/unit/modules/investigation/db-tools.test.ts`
- `tests/unit/modules/investigation/db-analyst.test.ts`
- `tests/unit/modules/investigation/db-query-safety.test.ts`
- `tests/unit/shared/relay-gateway.test.ts`

**Modificados (8)**:
- `src/shared/domain/types.ts` — `db_analyst` em AgentRole
- `src/shared/config/index.ts` — secao `relay` + `agentModels.dbAnalyst`
- `src/shared/infra/db/entities/EvidenceEntity.ts` — `db_analyst` no enum
- `src/modules/investigation/application/agent-configs.ts` — DB_ANALYST_CONFIG
- `src/modules/investigation/infra/investigation-tools.ts` — DB tools no handler chain
- `src/modules/investigation/application/investigate-incident.usecase.ts` — ativa db_analyst
- `src/modules/investigation/domain/action-catalog.ts` — categorias data inconsistency
- `src/bootstrap.ts` — wire relayGateway

### Fase 2 — Relay Agent Core (Sprint 24-25) ~25 arquivos

Repo separado `causeflow/relay`:
1. Config loader + Zod schema
2. Postgres driver + SQL parser
3. MongoDB driver (find/aggregate only)
4. DynamoDB driver + IAM session policy
5. Redis driver (read-only)
6. Policy engine + query validator
7. Data masking engine
8. Audit logger
9. WebSocket client (outbound)
10. Health reporter + heartbeat
11. Dockerfile seguro
12. Testes: 50+

### Fase 3 — Control Plane + Sample App (Sprint 25) ~30 arquivos

CauseFlow: WebSocket server, relay registry, relay auth, relay routes
Sample: Express app, PG schema, Mongo collections, bug, telemetry, Docker

### Fase 4 — E2E Smoke Test (Sprint 25) ~5 arquivos

Docker Compose com order-service + relay + CauseFlow
Smoke scenario: race condition → alert → db_analyst → root cause

---

## Decisoes Arquiteturais

| Decisao | Escolha | Razao |
|---------|---------|-------|
| Linguagem relay | TypeScript | Ecossistema CauseFlow, type safety |
| Comunicacao | WSS outbound-only | Zero inbound, firewall-friendly |
| Protocolo | JSON-RPC 2.0 | Padrao, request/response com IDs |
| SQL Parser | node-sql-parser | PostgreSQL/MySQL, AST validation |
| Read-only | 5 camadas tecnicas | Defense in depth, nao depende de prompt |
| DynamoDB Scan | IAM Deny explicito | Tecnico, nao bypassavel |
| Data masking | No relay, antes de enviar | PII nunca sai da rede |
| db_analyst model | claude-sonnet-4-5 | Precisa de reasoning para correlacionar dados |
| Sample bug | Race condition + stale cache | Requer cross-DB investigation (PG + Mongo) |
