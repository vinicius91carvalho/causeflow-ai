# INVARIANTS — Observabilidade (logs dedicados + OTel + X-Ray)

Contratos cruzados entre sprints deste PRD. Cada invariante tem um `Verify` executável que sai 0 quando a invariante vale.

---

## LogContext shape

- **Owner:** Sprint 2 — `src/shared/infra/logger/log-context.ts`
- **Preconditions:** Consumidor de `getLogger()` deve estar dentro de um `withLogContext(ctx, fn)`. Fora disso, `getLogger()` retorna `rootLogger` sem correlation fields.
- **Postconditions:** `getLogger().info(...)` emite log JSON contendo todos os campos presentes em `ctx` (requestId obrigatório; demais opcionais). Child logger não sobrescreve redact paths do `rootLogger`.
- **Invariants:** `LogContext` é um tipo único em `src/shared/infra/logger/log-context.ts`. Nenhum outro arquivo redeclara a interface. Campos: `requestId`, `traceId?`, `spanId?`, `tenantId?`, `actorUserId?`, `clientIp?`, `userAgent?`, `jobId?`, `jobType?`, `queueName?`.
- **Verify:** `test -f src/shared/infra/logger/log-context.ts && ! grep -rn "interface LogContext" src --include="*.ts" | grep -v "src/shared/infra/logger/log-context.ts"`
- **Fix:** Remover redeclarações; importar o tipo do owner.

---

## sensitiveLogPaths contract

- **Owner:** Sprint 2 — `src/shared/config/log-paths.ts`
- **Preconditions:** Middleware/handler antes de adicionar `clientIp` ao `LogContext` ou ao log deve chamar `isSensitivePath(c.req.path)`.
- **Postconditions:** Quando `isSensitivePath(path) === true`, o log emitido NÃO contém a chave `clientIp` (ausência literal da chave — não `'[redacted]'` como valor).
- **Invariants:** A constante `sensitiveLogPaths` inclui no mínimo `/auth`, `/auth/*`, `/webhooks/clerk`, `/oauth`, `/oauth/*`. Nenhum outro módulo redefine esses paths.
- **Verify:** `test -f src/shared/config/log-paths.ts && grep -q "sensitiveLogPaths" src/shared/config/log-paths.ts && grep -q "/webhooks/clerk" src/shared/config/log-paths.ts && grep -q "/auth" src/shared/config/log-paths.ts && grep -q "/oauth" src/shared/config/log-paths.ts`
- **Fix:** Adicionar entries faltantes em `src/shared/config/log-paths.ts`.

---

## Outbound error redaction

- **Owner:** Sprint 3 — `src/shared/infra/observability/outbound.ts`
- **Preconditions:** Toda chamada externa que exceda a camada de domínio passa por `instrumentedCall(target, op, fn, opts?)`.
- **Postconditions:** Em caso de erro, o log emitido contém APENAS `{target, op, durationMs, ok: false, errorType, message, statusCode?}`. `message` é `String(err.message).slice(0, 200)`. NUNCA emite `err` cru, `stack`, nem copia propriedades arbitrárias do error.
- **Invariants:** `outbound.ts` não pode ter `logger.error({ err }, ...)` nem `logger.error(err, ...)` nem `JSON.stringify(err)`.
- **Verify:** `test -f src/shared/infra/observability/outbound.ts && ! grep -E "\\b(err|error)\\s*[:,}]" src/shared/infra/observability/outbound.ts | grep -E "logger|getLogger"`
- **Fix:** Remover serialização do err; emitir apenas `errorType` + `message` truncada.

---

## Span attribute allowlist

- **Owner:** Sprint 3 — `src/shared/infra/observability/outbound.ts`
- **Preconditions:** Callers de `instrumentedCall(..., opts)` podem passar `opts.attributes` livremente — o wrapper filtra.
- **Postconditions:** Apenas chaves em `ALLOWED_ATTR_KEYS` e valores primitivos (string | number | boolean) são aplicados no span. `requestBody`, `headers`, e qualquer outra chave não listada são descartadas silenciosamente.
- **Invariants:** `ALLOWED_ATTR_KEYS` é um `Set<string>` literal no próprio `outbound.ts`. Não recebe keys dinâmicas.
- **Verify:** `test -f src/shared/infra/observability/outbound.ts && grep -q "ALLOWED_ATTR_KEYS" src/shared/infra/observability/outbound.ts`
- **Fix:** Garantir filtro estático (não parametrizado) em `filterAttributes`.

---

## SQS trace propagation (W3C traceparent)

- **Owner:** Sprint 4 — `src/shared/infra/observability/propagation.ts`
- **Preconditions:** Quem publica mensagem SQS deve chamar `injectTraceparent(messageAttributes, requestId?)` antes do `SendMessageCommand`. Quem consome deve chamar `extractTraceparent(msg.MessageAttributes)` e envolver o handler em `context.with(extractedCtx, ...)`.
- **Postconditions:** Trace ID extraído no worker bate com trace ID injetado na API. `traceparent` e `requestId` aparecem como `MessageAttributeValue` com `DataType: 'String'`.
- **Invariants:** Nenhum outro arquivo injeta/extrai traceparent manualmente — sempre via helpers.
- **Verify:** `test -f src/shared/infra/observability/propagation.ts && grep -q "injectTraceparent" src/shared/infra/observability/propagation.ts && grep -q "extractTraceparent" src/shared/infra/observability/propagation.ts`
- **Fix:** Centralizar inject/extract em `propagation.ts`.

---

## X-Ray IAM write-only

- **Owner:** Sprint 1 — `infra/cdk/lib/causeflow-stack.ts`
- **Preconditions:** Task role recebe policy inline com EXATAMENTE 4 actions X-Ray.
- **Postconditions:** Actions permitidas: `xray:PutTraceSegments`, `xray:PutTelemetryRecords`, `xray:GetSamplingRules`, `xray:GetSamplingTargets`. Nenhuma action `xray:GetTraceSummaries`, `xray:BatchGetTraces`, `xray:GetTrace*` (exceto as sampling rules/targets) presente.
- **Invariants:** Não usar managed policy `AWSXRayDaemonWriteAccess`. Policy é inline.
- **Verify:** `grep -q "xray:PutTraceSegments" infra/cdk/lib/causeflow-stack.ts && grep -q "xray:PutTelemetryRecords" infra/cdk/lib/causeflow-stack.ts && ! grep -q "AWSXRayDaemonWriteAccess" infra/cdk/lib/causeflow-stack.ts && ! grep -E "xray:(BatchGetTraces|GetTraceSummaries|GetTraceGraph)" infra/cdk/lib/causeflow-stack.ts`
- **Fix:** Remover managed policy / actions de leitura; manter apenas as 4 write actions.

---

## Dedicated log groups (hard cutover)

- **Owner:** Sprint 1 — `infra/cdk/lib/causeflow-stack.ts`
- **Preconditions:** Stack define `apiLogGroup` (`/ecs/causeflow-{stage}-api`) e `workerLogGroup` (`/ecs/causeflow-{stage}-worker`).
- **Postconditions:** Após `cdk synth`, o template NÃO contém o log group antigo `/ecs/causeflow-{stage}` (sufixo `-api`/`-worker` obrigatório).
- **Invariants:** Containers (API app, Redis sidecar, worker) referenciam APENAS os novos log groups.
- **Verify:** `grep -q "/ecs/causeflow.*-api" infra/cdk/lib/causeflow-stack.ts && grep -q "/ecs/causeflow.*-worker" infra/cdk/lib/causeflow-stack.ts`
- **Fix:** Adicionar os dois log groups e remover referências ao antigo.
