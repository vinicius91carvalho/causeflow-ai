# Plan — Observabilidade: log groups dedicados, logs estruturados, OpenTelemetry

## Context

Hoje a observabilidade do CauseFlow tem lacunas operacionais importantes:

- **Um único log group** `/ecs/causeflow-{stage}` agrupa API, workers e Redis sidecar. Não dá para rodar `aws logs tail /ecs/causeflow-staging-worker --follow` isoladamente (o nome nem existe).
- **Request middleware já loga** `requestId/tenantId/userId/ip/duration/status` no final da request (`src/shared/infra/http/middleware/request-logger.middleware.ts`). Bom ponto de partida — mas **não há logs de fluxo** (passos internos, decisões, eventos).
- **Zero instrumentação outbound**: chamadas para Anthropic (`src/shared/infra/llm/anthropic-client.ts`), Composio (`src/shared/infra/integrations/composio-client.ts`), DynamoDB (`src/shared/infra/db/client.ts`), SQS (`src/shared/infra/queue/sqs-client.ts`), Redis (`src/shared/infra/cache/redis-client.ts`), Clerk e outras integrações não reportam latência nem status individualmente.
- **Workers (triage/remediation/investigation consumers)** logam de forma ad hoc; não há padrão de `job.received → started → completed|failed` com duração. A worker task one-shot (`investigation-worker` CDK) também não tem log group próprio.
- **Sem correlação distribuída**: contexto atual vive em `c.var` do Hono — não propaga para a camada de serviços/adapters sem passar `c` adiante. Sem `AsyncLocalStorage`, sem trace context cruzando API→SQS→worker.
- **Sem OpenTelemetry hoje** (só Sentry). Usuário quer instrumentação vendor-neutral com X-Ray como provider inicial, para poder trocar depois sem mexer em código. **Sem sidecar/collector** — export direto do processo Node para manter infra simples; troca futura = trocar o exporter (uma dependência + uma env var), não tocar em código de negócio.

**Resultado desejado:** operador consegue rodar `aws logs tail /ecs/causeflow-staging-worker --follow` e entender o ciclo de vida de um job, as chamadas externas que ele fez, a latência de cada uma, e correlacionar com a request de API original via `traceId`/`requestId`. Traces distribuídos aparecem no X-Ray console.

## Escopo e não-escopo

**No escopo:**
- 2 log groups novos: `/ecs/causeflow-{stage}-api`, `/ecs/causeflow-{stage}-worker` (retenção 30d staging / 90d prod).
- Pino child logger propagado via `AsyncLocalStorage` com `{requestId, traceId, tenantId, actorUserId, clientIp, userAgent}`.
- Wrappers de instrumentação outbound (Anthropic, Composio, DynamoDB, SQS, Redis, Clerk, fetch genérico) logando `{target, op, durationMs, ok, statusCode, errorCode?}`.
- Lifecycle logs nos 3 SQS consumers (`job.received|started|completed|failed`).
- OpenTelemetry SDK + auto-instrumentations **in-process** (sem sidecar), exportando direto para o endpoint OTLP gerenciado do X-Ray via `@aws/aws-distro-opentelemetry-node-autoinstrumentation` (ADOT para Node — distro oficial AWS que embute o exporter X-Ray no próprio processo). Propagação de trace context via SQS message attributes.
- IAM updates: task role ganha permissões X-Ray (`AWSXRayDaemonWriteAccess` equivalente).

**Fora do escopo (deixar para PRDs futuros):**
- Métricas customizadas (CloudWatch EMF / Prometheus).
- Substituir Sentry.
- Log aggregation/ELK; fica CloudWatch Logs puro.
- Sampling rules avançadas no X-Ray (usar default 1 req/s + 5% inicialmente).
- Backfill de logs históricos.

## Non-goals / decisões já tomadas

- **Retenção** dos log groups operacionais é **separada** do `audit-retention-policy.md` (aqueles são 2-5 anos; estes são 30/90 dias). Documentar explicitamente.
- **Client IP** em item 2 (`actorUserId`/`clientIp`/`userAgent`) — extrair do `X-Forwarded-For` (primeiro IP), fallback `c.req.header('x-real-ip')`. **Não logar IP** nas rotas listadas em `sensitiveLogPaths` (ver abaixo).
- **`sensitiveLogPaths`**: constante exportada de `src/shared/config/log-paths.ts` (novo). Default: `['/auth', '/auth/*', '/webhooks/clerk', '/oauth', '/oauth/*']`. Matcher usa prefixo + glob simples (já que Hono passa path resolvido em `c.req.path`). Quando match, o middleware substitui `clientIp` por `'[redacted]'` antes de emitir o log e não o adiciona ao `LogContext`.
- **Log group antigo**: `/ecs/causeflow-{stage}` é **removido** em Sprint 1 (hard cutover; os novos groups passam a ser o único destino). Sem dual-write, sem janela de transição.
- **OTel com X-Ray via ADOT in-process (sem sidecar)** confirmado. Troca futura de backend = trocar o exporter (1 dependência npm + 1 env var no bootstrap), sem tocar em código de negócio/use cases. A API OTel (`tracer.startSpan`, `withLogContext`, propagadores) permanece a mesma — é exatamente essa camada de abstração que garante a portabilidade.

## Danger modes (security-first)

Explícitos e mitigados em sprint-level AC:

1. **Vazamento de IP em rotas de autenticação** — `sensitiveLogPaths` suprime `clientIp` em `/auth/*`, `/webhooks/clerk`, `/oauth/*`. AC de Sprint 2 exige teste que bate endpoint sensível e verifica ausência de `clientIp` no log emitido.
2. **PII em atributos de span (OTel)** — spans NÃO recebem request body, response body nem headers. Apenas nomes de operação (`anthropic.messages`, `dynamodb.get`), `durationMs`, `statusCode`, `ok`, e IDs já presentes no `LogContext` (`tenantId`, `jobId`). Enforçado via allowlist no `instrumentedCall`; auto-instrumentations HTTP/AWS ficam com `@opentelemetry/instrumentation-http` configurado com `ignoreIncomingRequestHook` para rotas sensíveis e `requestHook` que **não** copia headers.
3. **Vazamento de segredo em `err` de chamada outbound** — o wrapper NUNCA loga o objeto `err` cru. Log sai como `{ errorType: err.name, message: String(err.message).slice(0, 200), statusCode?, durationMs, ok: false }`. Pino redact continua aplicado por cima. Stack trace vai para Sentry (não CloudWatch Logs).
4. **Escopo IAM X-Ray** — policy da task role é **write-only**: `xray:PutTraceSegments`, `xray:PutTelemetryRecords`, `xray:GetSamplingRules`, `xray:GetSamplingTargets`. **Sem** `xray:GetTraceSummaries`/`GetTrace*` (leitura). Impede que um container comprometido puxe traces de outros serviços.
5. **Span queue overflow (drops silenciosos)** — BatchSpanProcessor descarta spans se fila enche. Configurar `OTEL_BSP_MAX_QUEUE_SIZE=4096` e alerta em CloudWatch Logs filter sobre `OTLP export failed` (setup no PRD futuro de métricas; aqui só deixamos o log aparecer em `error` level para captura manual).

## Context Loaded

- `docs/compliance/audit-retention-policy.md` — política de audit log (distinta dos logs operacionais). Logs operacionais NÃO carregam `entryHash`, NÃO têm hash-chain, são efêmeros.
- `src/shared/infra/logger.ts` — Pino com 24 redact paths (auth headers, secrets, email/phone/password/token/apiKey). Level de `config.logLevel`. `pino-pretty` em dev.
- `src/shared/infra/http/middleware/request-logger.middleware.ts` — já captura `requestId, tenantId, userId, userRoles, method, path, status, duration, userAgent (truncado 512), contentLength, ip (x-forwarded-for[0])`. Severidade mapeada por status.
- `src/app.ts:39-58` — ordem de middleware: `errorHandler → CORS → requestId() → auth → tenant → rateLimit → audit → requestLogger`.
- `src/main.ts` — `@hono/node-server` + `serve(...)` em `config.port`. Consumers registrados via `ctx.consumers`, parada graceful em SIGTERM.
- `src/modules/{triage,remediation,investigation}/infra/*-consumer.ts` — 3 SQS consumers com `.stop()` graceful.
- `infra/cdk/lib/causeflow-stack.ts:226` — log group único `/ecs/{prefix}`, `ONE_MONTH`, `DESTROY`.
- `infra/cdk/lib/causeflow-stack.ts:375-420` — API task (porta 3000 + Redis sidecar) e Worker task (`causeflow-{stage}-worker`, one-shot RunTask).
- `infra/cdk/lib/causeflow-stack.ts:253-288` — task role com DynamoDB/SQS/Secrets/STS/ECS RunTask/Logs. **Sem X-Ray.**
- `infra/cdk/lib/causeflow-stack.ts:611` — Hindsight task + log group separado (já existe o padrão).
- aws-cdk-lib `^2.170.0`, TS 5.7.

## Architecture

### Logger context (`src/shared/infra/logger.ts` + novo `log-context.ts`)

Introduzir `AsyncLocalStorage<LogContext>` em `src/shared/infra/logger/log-context.ts`:

```ts
// conceito
export const logContext = new AsyncLocalStorage<LogContext>();
export function withLogContext<T>(ctx: LogContext, fn: () => T): T { ... }
export function getLogger(): Logger {
  const ctx = logContext.getStore();
  return ctx ? rootLogger.child(ctx) : rootLogger;
}
```

Middleware API e wrapper de worker job usam `withLogContext(...)`. Toda a camada de aplicação importa `getLogger()` em vez da instância raiz. `LogContext` = `{ requestId, traceId, spanId, tenantId, actorUserId, clientIp, userAgent, jobId?, jobType?, queueName? }`.

### Request middleware

Ajuste pequeno em `request-logger.middleware.ts`: emitir **dois** logs — `http.request.started` no início (antes de `await next()`) e `http.request.completed` no fim (hoje). Motivo: se a request trava, hoje não aparece nada. `started` usa level `debug` em prod e `info` em dev para controlar volume.

`auth-middleware` / `tenant-middleware` passam a envelopar o resto do pipeline com `withLogContext`.

### Outbound wrappers

Novo `src/shared/infra/observability/outbound.ts`:

```ts
export async function instrumentedCall<T>(
  target: string,
  op: string,
  fn: () => Promise<T>,
  opts?: { attributes?: Record<string, unknown> } // allowlist: apenas primitivos não-sensíveis (IDs, counts, status codes). NUNCA bodies/headers.
): Promise<T> {
  const start = Date.now();
  const span = tracer.startSpan(`${target}.${op}`, { attributes: opts?.attributes });
  try {
    const res = await fn();
    span.setStatus({ code: SpanStatusCode.OK });
    getLogger().info({ target, op, durationMs: Date.now() - start, ok: true }, `${target}.${op} ok`);
    return res;
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    span.recordException(e); span.setStatus({ code: SpanStatusCode.ERROR });
    // NÃO logar `err` cru (pode conter secret em mensagens de API). Apenas nome + mensagem truncada.
    getLogger().error(
      { target, op, durationMs: Date.now() - start, ok: false, errorType: e.name, message: String(e.message ?? '').slice(0, 200), statusCode: e.statusCode },
      `${target}.${op} failed`
    );
    throw err;
  } finally { span.end(); }
}
```

Aplicado em: `anthropic-client.ts`, `composio-client.ts`, `db/client.ts` (operações ElectroDB críticas — wrapper no nível da repository base), `queue/sqs-client.ts` (send/receive), `cache/redis-client.ts` (get/set/del), Clerk adapter. DynamoDB e SQS também recebem **auto-instrumentation do OTel** (duplicação controlada; spans OTel dão a topologia, logs dão os detalhes — mantemos os dois com `durationMs` consistente).

### Worker lifecycle

Cada `*-consumer.ts` ganha um wrapper `runJob(handler, msg)`:

1. Extrai `traceparent` do `msg.MessageAttributes.traceparent` → contexto OTel.
2. `withLogContext({ requestId: msg.MessageAttributes.requestId, traceId, jobId: msg.MessageId, jobType, queueName })`.
3. Logs: `job.received` → `job.started` → (`job.completed` | `job.failed`) com `durationMs`.

### OpenTelemetry bootstrap

Novo `src/shared/infra/observability/otel.ts`, carregado em **`--require`** (ou topo de `main.ts`, antes de qualquer import de app code). Usa:

- `@aws/aws-distro-opentelemetry-node-autoinstrumentation` — distro ADOT oficial para Node. Embute `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node` (http, aws-sdk v3, ioredis, pino), o propagator X-Ray + W3C tracecontext, e o **exporter X-Ray via SigV4 HTTPS direto para o serviço X-Ray** (sem collector/sidecar). Não requer processo adicional rodando na task.
- Configuração por env var (padrão ADOT):
  - `OTEL_TRACES_EXPORTER=otlp`
  - `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`
  - `OTEL_PROPAGATORS=xray,tracecontext,baggage`
  - `OTEL_SERVICE_NAME=causeflow-{api|worker}`
  - `OTEL_RESOURCE_ATTRIBUTES=deployment.environment={stage}`
  - `OTEL_TRACES_SAMPLER=xray` (usa sampling rules do X-Ray; default 1 req/s + 5%)

**Swappability:** a camada de código usa apenas API OTel (`trace.getTracer(...)`, `tracer.startSpan`). Para trocar para Jaeger/Tempo/Datadog no futuro: remover `@aws/aws-distro-opentelemetry-node-autoinstrumentation`, instalar `@opentelemetry/sdk-node` + exporter do novo backend, ajustar `OTEL_EXPORTER_OTLP_ENDPOINT` e propagadores. Código de negócio não muda.

SQS publisher injeta `traceparent` + `requestId` em `MessageAttributes` antes de `SendMessage`. Worker extrai no receive e restabelece o contexto OTel via `propagation.extract(...)`.

### CDK — `infra/cdk/lib/causeflow-stack.ts`

1. Remover (ou manter como fallback) o log group único; criar `apiLogGroup = /ecs/causeflow-{stage}-api` e `workerLogGroup = /ecs/causeflow-{stage}-worker`. Retenção: `stage === 'production' ? THREE_MONTHS : ONE_MONTH` (staging tem só 30d — usar `ONE_MONTH` que é 30d mesmo).
2. API task: container app → `apiLogGroup, streamPrefix: 'api'`. Redis sidecar continua onde está (ou move para `apiLogGroup, streamPrefix: 'redis'`).
3. Worker task: `workerLogGroup, streamPrefix: 'worker'`.
4. **Sem sidecar.** Adicionar env vars OTel (lista em "OpenTelemetry bootstrap") no container definition de API e worker. Região herda do ECS metadata — sem endpoint custom necessário.
5. Task role: **policy inline write-only** com exatamente `xray:PutTraceSegments`, `xray:PutTelemetryRecords`, `xray:GetSamplingRules`, `xray:GetSamplingTargets`. **Não usar** `AWSXRayDaemonWriteAccess` direto sem auditar (verificar se inclui actions de leitura). Objetivo: bloquear leitura cruzada de traces em caso de container comprometido. Essas permissões vão direto para o processo Node (ele assina as chamadas X-Ray com SigV4 via credenciais da task role).
6. Grant dos log groups para execution role.

## Sprint decomposition

4 sprints, sequenciais (cada um depende do anterior parcialmente).

### Sprint 1 — CDK log groups + X-Ray IAM

**Files to modify:** `infra/cdk/lib/causeflow-stack.ts`
**Files to create:** none
**Deliverable:** após `cdk deploy staging`, `aws logs describe-log-groups --log-group-name-prefix /ecs/causeflow-staging` lista os 2 novos groups. Task role tem X-Ray policy. Existing containers apontam para o group certo.
**Acceptance:**
- [ ] `/ecs/causeflow-{stage}-api` e `/ecs/causeflow-{stage}-worker` criados com retenção correta (30d staging, 90d prod).
- [ ] `aws logs tail /ecs/causeflow-staging-worker --follow` imprime linhas quando o worker roda.
- [ ] Snapshot test do CDK (se existir `test/`) atualizado.
- [ ] Log group antigo `/ecs/causeflow-{stage}` **removido** do CDK (hard cutover). Containers apontam exclusivamente para os novos groups (API → `-api`, worker → `-worker`, Redis sidecar → `-api` com `streamPrefix: 'redis'`). Break documentado no CHANGELOG/PR description.
- [ ] Task role IAM policy para X-Ray é **inline e write-only**: contém EXATAMENTE `xray:PutTraceSegments`, `xray:PutTelemetryRecords`, `xray:GetSamplingRules`, `xray:GetSamplingTargets`. Verificado via CDK assertion (`Template.fromStack(...).hasResourceProperties('AWS::IAM::Policy', { ... })`) que a lista de actions não inclui nenhuma action de leitura (`xray:GetTraceSummaries`, `xray:GetTrace*`, `xray:BatchGetTraces`). **Não usar** managed policy `AWSXRayDaemonWriteAccess`.

### Sprint 2 — Logger context (AsyncLocalStorage) + IP/UA no contexto

**Files to create:** `src/shared/infra/logger/log-context.ts`, `src/shared/config/log-paths.ts`
**Files to modify:** `src/shared/infra/logger.ts`, `src/shared/infra/http/middleware/request-logger.middleware.ts`, `src/shared/infra/http/middleware/auth-middleware.ts` (ou equivalente), `src/bootstrap.ts`, adapters que hoje importam `logger` (substituir por `getLogger()`).
**Deliverable:** todo log em contexto de request/job sai com `{requestId, tenantId, actorUserId, clientIp, userAgent}`. Log novo `http.request.started` emitido no começo. Endpoints sensíveis (`sensitiveLogPaths`) não logam IP.
**Design — `src/shared/config/log-paths.ts`:**
```ts
export const sensitiveLogPaths = ['/auth', '/auth/*', '/webhooks/clerk', '/oauth', '/oauth/*'] as const;
export function isSensitivePath(path: string): boolean { /* prefix + glob match */ }
```
**Acceptance:**
- [ ] Unit test: `withLogContext({...}, () => getLogger().info('x'))` emite log com os campos.
- [ ] Integration test: hit em `/healthz` emite 2 log lines (`started` + `completed`) com mesmo `requestId`.
- [ ] Integration test: hit em `/auth/login` e `/webhooks/clerk` emitem logs **sem** `clientIp` (campo ausente ou `'[redacted]'`).
- [ ] Unit test de `isSensitivePath`: paths listados retornam `true`, `/healthz` e `/tenants` retornam `false`.
- [ ] Nenhum teste existente quebra; redact paths continuam aplicados.

### Sprint 3 — Outbound instrumentation + worker lifecycle logs

**Files to create:** `src/shared/infra/observability/outbound.ts`, `src/shared/infra/observability/worker-runner.ts`
**Files to modify:** `src/shared/infra/llm/anthropic-client.ts`, `src/shared/infra/integrations/composio-client.ts`, `src/shared/infra/db/client.ts` (ou base repository), `src/shared/infra/queue/sqs-client.ts`, `src/shared/infra/cache/redis-client.ts`, os 3 consumers em `src/modules/*/infra/*-consumer.ts`, `src/modules/auth/infra/clerk-client.ts`, `src/modules/audit/infra/clerk-user-email-resolver.ts`.
**Deliverable:** toda chamada externa relevante emite 1 log estruturado (com redação de erro: só `errorType` + `message` truncada a 200 chars, nunca o `err` cru); cada job SQS emite 2-3 logs (received/started/completed|failed).
**Acceptance:**
- [ ] Unit tests do wrapper (sucesso, erro, propagação de exceção).
- [ ] Unit test: quando `fn()` rejeita com `new Error('Invalid token: sk-abc123')`, o log emitido NÃO contém `'sk-abc123'` além dos primeiros 200 chars de `message`; contém `errorType: 'Error'`.
- [ ] Unit test: wrapper NÃO serializa o objeto `err` cru (sem campo `err` ou `error` com stack trace no output JSON).
- [ ] Unit test (span attribute allowlist): chamar `instrumentedCall('anthropic', 'messages', fn, { attributes: { model: 'claude-3-5-sonnet', inputTokens: 150, requestBody: { secret: 'sk-xxx' }, headers: { authorization: 'Bearer x' } } })` e verificar (via span processor de teste/in-memory exporter) que o span emitido contém APENAS atributos primitivos allowlisted (`model`, `inputTokens`, `durationMs`, `ok`, `statusCode`?, `errorType`?). `requestBody` e `headers` devem ser descartados antes de `span.setAttribute`.
- [ ] Integration test: processar uma mensagem SQS gera a sequência correta de logs com `jobId` e `durationMs`.
- [ ] `grep -c "target"` nos logs de staging mostra >0 após smoke test.
- [ ] Checklist manual: 8 adapters instrumentados (Anthropic, Composio, Dynamo, SQS, Redis, 2 Clerk adapters, outbound runner).

### Sprint 4 — OpenTelemetry in-process + X-Ray (sem sidecar)

**Files to create:** `src/shared/infra/observability/otel.ts`, `src/shared/infra/observability/propagation.ts` (SQS attr injection/extraction)
**Files to modify:** `src/main.ts` (require otel no topo — ou flag `--require ./dist/shared/infra/observability/otel.js`), `package.json` (dep `@aws/aws-distro-opentelemetry-node-autoinstrumentation` + peer OTel APIs se necessário), `infra/cdk/lib/causeflow-stack.ts` (env vars OTel no container definition, IAM X-Ray na task role), `src/shared/infra/queue/sqs-client.ts` (injeta traceparent no send), worker-runner (extrai traceparent no receive), `src/shared/infra/observability/outbound.ts` (trocar stub de tracer pelo real).
**Deliverable:** traces aparecem no AWS X-Ray console mostrando span API → span SQS → span worker → spans outbound. Logs e traces correlacionam via `traceId`. Zero containers extras nas tasks.
**Acceptance:**
- [ ] Deploy staging; uma request em API gera trace no X-Ray com pelo menos 3 níveis.
- [ ] Trace cruzando SQS (API publica, worker consome) aparece como trace único.
- [ ] `traceId` nos logs CloudWatch bate com `Trace ID` no X-Ray.
- [ ] `docker ps` / task description do ECS mostra **apenas** o container da app (e Redis sidecar pré-existente no API task) — nenhum container OTel novo.
- [ ] Graceful shutdown: SIGTERM chama `sdk.shutdown()` antes de encerrar (flush dos spans pendentes) — validado por log `otel.shutdown.complete`.
- [ ] Sampling default não estoura custo (validar via X-Ray metrics por 24h).
- [ ] Env var `OTEL_BSP_MAX_QUEUE_SIZE=4096` definida no container definition de API e worker no CDK. Verificado via `aws ecs describe-task-definition` (ou CDK assertion no snapshot) após deploy staging.
- [ ] Após 1h de tráfego em staging, CloudWatch Logs Insights query `fields @message | filter @message like /OTLP export failed/ | stats count()` retorna 0 no log group da API e do worker (baseline sem backpressure; setup de alerta fica para PRD futuro de métricas).

## Critical files to modify

- `infra/cdk/lib/causeflow-stack.ts` (sprints 1 e 4)
- `src/shared/infra/logger.ts` (sprint 2)
- `src/shared/infra/http/middleware/request-logger.middleware.ts` (sprint 2)
- `src/main.ts` (sprint 4)
- `src/shared/infra/{llm,integrations,db,queue,cache}/*.ts` (sprint 3)
- `src/modules/{triage,remediation,investigation}/infra/*-consumer.ts` (sprints 3, 4)

## Critical files to create

- `src/shared/infra/logger/log-context.ts`
- `src/shared/infra/observability/outbound.ts`
- `src/shared/infra/observability/worker-runner.ts`
- `src/shared/infra/observability/otel.ts`
- `src/shared/infra/observability/propagation.ts`

## Reusable utilities already in the repo

- `logger` (`src/shared/infra/logger.ts`) — redact paths e pino config. Manter; envolver com child-logger via `getLogger()`.
- `requestLoggerMiddleware` — já extrai IP, UA, duration. Ajuste incremental.
- `requestId()` middleware (Hono built-in) — já provê correlation ID. Reaproveitar como `requestId` no log context.
- `ctx.consumers.stop()` pattern em `main.ts` — graceful shutdown já existe; reaproveitar para flushar o OTel SDK (`sdk.shutdown()`).

## Verification (end-to-end)

1. **Local:** `pnpm test:run` passa. `pnpm dev` roda; `curl localhost:3000/healthz` emite 2 linhas JSON com `requestId` igual.
2. **Local com worker:** dispara um job de investigação; log mostra `job.received → job.started → anthropic.messages ok (Xms) → job.completed (Yms)` com mesmo `traceId`.
3. **Staging (pós-deploy):**
   - `aws logs tail /ecs/causeflow-staging-api --follow` — mostra requests.
   - `aws logs tail /ecs/causeflow-staging-worker --follow` — mostra lifecycle de jobs.
   - AWS X-Ray console → Service map mostra API → SQS → worker → (Anthropic, Dynamo, Redis).
   - Pegar um `traceId` do log, buscar no X-Ray, confirmar que aparece com todos os spans.
4. **Custo:** após 24h, CloudWatch Logs ingestion < 2GB/dia staging (sanity check).
5. **Não-regressão:** Sentry continua recebendo eventos; endpoints de auth não têm IP em logs.

## Open risks

- **Volume de logs**: instrumentação outbound pode multiplicar 5-10× o volume. Mitigação: level `debug` para sucessos em prod (configurável), `info` para falhas e `warn` para lentidões (>500ms). Ajustar após medir.
- **OTel in-process footprint**: SDK + auto-instrumentations adicionam ~40-80MB RAM e um pequeno overhead de CPU por span. Sem sidecar, mas o custo agora está no próprio processo. Validar em staging antes de prod.
- **Flush no shutdown**: sem collector buferizando, spans pendentes podem ser perdidos se o processo morrer sem chamar `sdk.shutdown()`. Mitigação: hook de SIGTERM (já existe para consumers) chama `sdk.shutdown()` com timeout de 5s antes de `process.exit`.
- **Backpressure X-Ray**: se a API X-Ray ficar lenta/indisponível, o BatchSpanProcessor do SDK tem fila limitada (default 2048 spans); estouros resultam em spans dropados silenciosamente. Configurar `OTEL_BSP_MAX_QUEUE_SIZE` e monitorar log `OTLP export failed`.
- **DynamoDB auto-instrumentation verbosa**: ElectroDB faz várias chamadas por operação. Pode precisar de um span-processor filter. Deixar para ajustar em Sprint 4.
- **Propagação SQS**: W3C traceparent em MessageAttributes tem limite de 10 attrs — usamos 2 (`traceparent`, `requestId`). OK.
