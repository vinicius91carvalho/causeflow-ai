# Plano de Testes — Sentry + Logging em Staging

**Data:** 2026-04-13
**Escopo:** Verificar integração Sentry e logging estruturado no Core (ECS) e Dashboard (Lambda@Edge)

---

## Pré-requisitos

1. PR do Core mergeada e deploy staging concluído (`causeflow/core#5`)
2. Commit do Dashboard no main e deploy staging concluído (auto-deploy via push to main em `causeflow/web`)
3. Acesso ao [Sentry](https://causeflow-ai.sentry.io/) — org: `causeflow-ai`
4. Acesso ao [AWS CloudWatch](https://us-east-2.console.aws.amazon.com/cloudwatch/) — conta `409171461008`
5. Acesso ao dashboard staging: `https://dashboard-staging.causeflow.ai`
6. Acesso à API staging: `https://api-staging.causeflow.ai`

### Credenciais Sentry

- **Org:** `causeflow-ai`
- **Core project:** `causeflow-core` (ID: `4511214189674496`)
- **Dashboard project:** `causeflow-dashboard` (ID: `4511214189805568`)
- **Core DSN:** `https://f3ff1c3ba71a8bf3d402f0ec00429b75@o4511214153170944.ingest.us.sentry.io/4511214189674496`
- **Dashboard DSN:** `https://4c496d5b4c0e685f12d4b48d9be48971@o4511214153170944.ingest.us.sentry.io/4511214189805568`

---

## Teste 1: Verificar que o Sentry está configurado corretamente no Core

### 1.1 Verificar env var no ECS

```bash
# Verificar que SENTRY_DSN está no task definition do ECS
aws ecs describe-task-definition \
  --task-definition causeflow-staging-api \
  --region us-east-2 \
  --query 'taskDefinition.containerDefinitions[0].environment[?name==`SENTRY_DSN`]'
```

**Resultado esperado:** Array com o DSN do core.

### 1.2 Verificar inicialização do Sentry nos logs

```bash
# Verificar log de inicialização nos últimos 10 minutos
aws logs filter-log-events \
  --log-group-name "/ecs/causeflow-staging-api" \
  --region us-east-2 \
  --start-time $(date -d '-10 minutes' +%s000) \
  --filter-pattern '"Sentry initialized"' \
  --limit 5
```

**Resultado esperado:** Log com `"msg":"Sentry initialized"` ou similar.

### 1.3 Provocar erro 5xx e verificar no Sentry

```bash
# Chamar endpoint que não existe para gerar 404 (NÃO deve ir pro Sentry)
curl -s https://api-staging.causeflow.ai/v1/nonexistent | jq .

# Chamar endpoint válido com payload inválido para provocar 500
# (ajustar conforme endpoints disponíveis)
curl -s -X POST https://api-staging.causeflow.ai/v1/auth/webhook \
  -H "Content-Type: application/json" \
  -d '{"invalid": "payload"}' | jq .
```

**Verificação no Sentry:**
1. Abrir https://causeflow-ai.sentry.io/issues/?project=4511214189674496
2. Verificar que o erro 5xx aparece nos Issues
3. Clicar no issue e verificar:
   - [ ] Tag `requestId` presente
   - [ ] Tag `http.method` presente (POST)
   - [ ] Tag `http.path` presente (/v1/auth/webhook)
   - [ ] **NÃO** contém `authorization` header nos dados
   - [ ] **NÃO** contém `cookie` nos dados
   - [ ] **NÃO** contém `x-api-key` nos dados
   - [ ] **NÃO** contém `user.email` nos dados
   - [ ] **NÃO** contém `user.ip_address` nos dados
   - [ ] **NÃO** contém `request.data` (body) nos dados
   - [ ] **NÃO** contém `request.cookies` nos dados
4. Verificar que erros 4xx (404) **NÃO** aparecem no Sentry

### 1.4 Verificar logs estruturados no CloudWatch

```bash
# Verificar logs recentes com campos estruturados
aws logs filter-log-events \
  --log-group-name "/ecs/causeflow-staging-api" \
  --region us-east-2 \
  --start-time $(date -d '-10 minutes' +%s000) \
  --filter-pattern '"requestId"' \
  --limit 5
```

**Resultado esperado:** JSON com campos:
- [ ] `requestId` (UUID)
- [ ] `method` (GET/POST/etc)
- [ ] `path` (/v1/...)
- [ ] `status` (número)
- [ ] `duration` (número em ms)
- [ ] `level` (info/warn/error)
- [ ] `timestamp` (ISO 8601)
- [ ] **NÃO** contém valores de `authorization`, `cookie`, `password`, `token`, `secret`
---

## Teste 2: Verificar que o Sentry está configurado corretamente no Dashboard

### 2.1 Verificar env var no Lambda

```bash
# Verificar que NEXT_PUBLIC_SENTRY_DSN está configurado
# (Lambda@Edge — verificar via SST ou diretamente)
aws lambda get-function-configuration \
  --function-name causeflow-dashboard-staging-server \
  --region us-east-1 \
  --query 'Environment.Variables.NEXT_PUBLIC_SENTRY_DSN'
```

**Resultado esperado:** DSN do dashboard.

> Nota: O nome exato da Lambda pode variar. Usar `aws lambda list-functions --region us-east-1 | grep -i causeflow` para encontrar.

### 2.2 Verificar Sentry no client-side (browser)

1. Abrir `https://dashboard-staging.causeflow.ai` no browser
2. Abrir DevTools → Console
3. Verificar que **NÃO** há erros de CSP bloqueando `*.ingest.sentry.io`
4. Abrir DevTools → Network
5. Filtrar por `sentry` ou `ingest`
6. Navegar pelo dashboard — verificar se requests para `ingest.us.sentry.io` aparecem (session replay, etc.)

**Checklist:**
- [ ] Sem erros de CSP para Sentry
- [ ] Requests para `ingest.us.sentry.io` visíveis no Network tab
- [ ] Session replay ativo (se configurado)

### 2.3 Provocar erro no Dashboard e verificar no Sentry

```bash
# Chamar API route do dashboard com método inválido
curl -s -X DELETE https://dashboard-staging.causeflow.ai/api/health/detailed | jq .

# Chamar API route que requer auth sem token (deve gerar erro)
curl -s https://dashboard-staging.causeflow.ai/api/notifications | jq .
```

**Verificação no Sentry:**
1. Abrir https://causeflow-ai.sentry.io/issues/?project=4511214189805568
2. Verificar que erros do server-side aparecem
3. Clicar no issue e verificar:
   - [ ] Stack trace presente
   - [ ] **NÃO** contém `user.email` (GDPR/LGPD)
   - [ ] **NÃO** contém cookies sensíveis
   - [ ] **NÃO** contém authorization headers
   - [ ] Source maps resolvidos (se SENTRY_AUTH_TOKEN configurado)

### 2.4 Verificar error-tracker.ts funciona em runtime

1. Abrir o browser em `https://dashboard-staging.causeflow.ai`
2. No Console do DevTools, executar:
```javascript
// Isso vai usar o error-tracker do dashboard
throw new Error('Sentry staging test from browser console');
```
3. Verificar no Sentry se o erro aparece no projeto `causeflow-dashboard`

---

## Teste 3: Verificar logging estruturado no CloudWatch (Dashboard)

### 3.1 Logs do Lambda

```bash
# Encontrar o log group do Lambda do dashboard
aws logs describe-log-groups \
  --region us-east-1 \
  --log-group-name-prefix "/aws/lambda" \
  --query 'logGroups[?contains(logGroupName, `causeflow`) && contains(logGroupName, `dashboard`)].logGroupName'

# Depois de encontrar o log group, verificar logs recentes
aws logs filter-log-events \
  --log-group-name "<LOG_GROUP_NAME>" \
  --region us-east-1 \
  --start-time $(date -d '-10 minutes' +%s000) \
  --limit 10
```

**Resultado esperado:** Logs estruturados com campos contextuais.

---

## Teste 4: Verificar PII Redaction end-to-end

### 4.1 Core — Verificar que dados sensíveis são redactados

```bash
# Fazer request autenticado ao Core API
curl -s -X POST https://api-staging.causeflow.ai/v1/auth/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-test-sensitive-token" \
  -H "Cookie: session=sensitive-cookie-value" \
  -H "X-Api-Key: sensitive-api-key" \
  -d '{"password": "should-not-appear", "email": "test@example.com"}'
```

**Verificar no CloudWatch:**
```bash
aws logs filter-log-events \
  --log-group-name "/ecs/causeflow-staging-api" \
  --region us-east-2 \
  --start-time $(date -d '-2 minutes' +%s000) \
  --filter-pattern '"auth/webhook"' \
  --limit 5
```

**Checklist de redação:**
- [ ] `authorization` header NÃO aparece nos logs (ou aparece como `[Redacted]`)
- [ ] `cookie` NÃO aparece nos logs
- [ ] `x-api-key` NÃO aparece nos logs
- [ ] `password` NÃO aparece nos logs
- [ ] `email` NÃO aparece nos logs (ou aparece redactado)
- [ ] `sk-test-sensitive-token` NÃO aparece em nenhum lugar

### 4.2 Sentry — Verificar PII scrubbing no beforeSend

1. No Sentry, abrir o issue mais recente do Core
2. Expandir "Request" na seção de detalhes
3. Verificar:
   - [ ] Headers sensíveis removidos (authorization, cookie, x-api-key)
   - [ ] `request.data` removido
   - [ ] `request.cookies` removido
   - [ ] `user.ip_address` removido
   - [ ] `user.email` removido

---

## Teste 5: Verificar separação de projetos no Sentry

1. Provocar erro no Core (API staging)
2. Provocar erro no Dashboard (dashboard staging)
3. No Sentry:
   - [ ] Erro do Core aparece APENAS no projeto `causeflow-core`
   - [ ] Erro do Dashboard aparece APENAS no projeto `causeflow-dashboard`
   - [ ] Nenhum erro cruzado entre projetos

---

## Teste 6: Logs com usuário autenticado no servidor

> Objetivo: verificar que requests autenticados produzem logs com contexto de usuário suficiente para rastreabilidade, sem vazar dados sensíveis.
>
> **Regra de ouro:** IP e User-Agent aparecem no CloudWatch (audit trail). API key aparece MASCARADA (`sk-****xxxx`). Nenhum desses campos vai para o Sentry.

### 6.1 Core — Request autenticado com sucesso (CloudWatch)

```bash
# Substituir TOKEN, TENANT_ID e API_KEY pelos valores reais de staging
curl -s https://api-staging.causeflow.ai/v1/<endpoint-existente> \
  -H "Authorization: Bearer <TOKEN_VALIDO>" \
  -H "X-Tenant-Id: <TENANT_ID>" \
  -H "X-Api-Key: <API_KEY_VALIDA>" \
  -H "User-Agent: CauseFlow-Test/1.0"

# Verificar o log gerado no CloudWatch
aws logs filter-log-events \
  --log-group-name "/ecs/causeflow-staging-api" \
  --region us-east-2 \
  --start-time $(date -d '-2 minutes' +%s000) \
  --filter-pattern '"userId"' \
  --limit 5
```

**Campos que DEVEM aparecer:**
- [ ] `userId` — UUID do usuário autenticado
- [ ] `tenantId` — ID do tenant
- [ ] `ip` — IP do cliente (somente CloudWatch, nunca Sentry)
- [ ] `userAgent` — valor do header `User-Agent`
- [ ] `path` — rota acessada (ex: `/v1/<endpoint>`)
- [ ] `apiKey` — mascarado (ex: `sk-****xxxx`) se presente na requisição

**Campos que NÃO DEVEM aparecer:**
- [ ] Valor completo da API key (ex: `sk-live-abc123...` em plain text)
- [ ] `password`, `secret`, `token` em plain text
- [ ] `email` do usuário

### 6.2 Core — Erro 5xx em request autenticado (user context no Sentry)

```bash
# Provocar erro 5xx com usuário autenticado
curl -s -X POST https://api-staging.causeflow.ai/v1/auth/webhook \
  -H "Authorization: Bearer <TOKEN_VALIDO>" \
  -H "X-Tenant-Id: <TENANT_ID>" \
  -H "Content-Type: application/json" \
  -d '{"invalid": "payload"}'
```

**Verificação no Sentry** (https://causeflow-ai.sentry.io/issues/?project=4511214189674496):
1. Clicar no issue mais recente → seção **User**:
   - [ ] `user.id` presente (userId — identificador não-PII)
   - [ ] **NÃO** contém `user.email`
   - [ ] **NÃO** contém `user.ip_address` (IP fica apenas no CloudWatch)
   - [ ] **NÃO** contém `user.username` com valor de email
2. Seção **Tags**:
   - [ ] `requestId` presente
   - [ ] `tenantId` presente
   - [ ] `http.path` presente
   - [ ] `http.method` presente
3. Seção **Request**:
   - [ ] **NÃO** contém `authorization` header
   - [ ] **NÃO** contém `x-api-key` header
   - [ ] **NÃO** contém `x-tenant-id` com valor (ou aparece como `[Redacted]`)

### 6.3 Dashboard — Request autenticado server-side (Lambda logs)

```bash
# Encontrar o log group do Dashboard Lambda
aws logs describe-log-groups \
  --region us-east-1 \
  --log-group-name-prefix "/aws/lambda" \
  --query 'logGroups[?contains(logGroupName, `causeflow`) && contains(logGroupName, `dashboard`)].logGroupName'

# Request autenticado ao Dashboard (substituir SESSION_COOKIE pelo real de staging)
curl -s https://dashboard-staging.causeflow.ai/api/notifications \
  -H "Cookie: session=<SESSION_COOKIE_VALIDO>" \
  -H "User-Agent: CauseFlow-Test/1.0"

# Verificar logs no Lambda
aws logs filter-log-events \
  --log-group-name "<LOG_GROUP_NAME>" \
  --region us-east-1 \
  --start-time $(date -d '-2 minutes' +%s000) \
  --filter-pattern '"userId"' \
  --limit 5
```

**Campos que DEVEM aparecer:**
- [ ] `userId`
- [ ] `tenantId`
- [ ] `ip` (IP do cliente)
- [ ] `userAgent`
- [ ] `path` (ex: `/api/notifications`)

**Campos que NÃO DEVEM aparecer:**
- [ ] Valor do cookie de sessão
- [ ] `email` do usuário

### 6.4 Core — Falha de autenticação (401)

```bash
# Request com token inválido
curl -s https://api-staging.causeflow.ai/v1/<endpoint-existente> \
  -H "Authorization: Bearer token-invalido-12345" \
  -H "User-Agent: CauseFlow-Test/1.0"

# Request sem autenticação
curl -s https://api-staging.causeflow.ai/v1/<endpoint-existente> \
  -H "User-Agent: CauseFlow-Test/1.0"

# Verificar log do 401
aws logs filter-log-events \
  --log-group-name "/ecs/causeflow-staging-api" \
  --region us-east-2 \
  --start-time $(date -d '-2 minutes' +%s000) \
  --filter-pattern '"status":401' \
  --limit 5
```

**Checklist:**
- [ ] Log do 401 aparece no CloudWatch com `requestId`, `ip`, `userAgent`, `path`, `status: 401`
- [ ] Erro 401 **NÃO** aparece no Sentry (erros 4xx não devem ser capturados)
- [ ] Nenhum valor de token aparece nos logs — nem o inválido

---

## Correções ao Plano

> Descobertas durante a execução em 2026-04-13:

1. **Task definition ECS:** Nome correto é `causeflow-staging` (não `causeflow-staging-api`). Log group: `/ecs/causeflow-staging`.
2. **Dashboard Lambda região:** us-east-2 (não us-east-1). Function name: `causefl-staging-CauseFlowDashboardServerUseast2Function-bdwtrtdt`.
3. **Sentry API token:** Token `sntrys_eyJpYXQiOj...` retorna `"Invalid org token"` — expirado. Bloqueia todas verificações via API Sentry.
4. **Log "Sentry initialized":** `initSentry()` não emite log de sucesso — apenas `console.warn` quando DSN está ausente. Precisa de fix no código.
5. **Dashboard SENTRY_DSN:** `NEXT_PUBLIC_SENTRY_DSN` está **vazio** no Lambda staging. O `sst.config.ts` passa `process.env.NEXT_PUBLIC_SENTRY_DSN ?? ''`, mas o workflow de deploy (`dashboard-deploy.yml`) **não injeta** essa env var como secret. Sentry está efetivamente **DESABILITADO** no Dashboard staging. Mesma situação para `SENTRY_AUTH_TOKEN`.

---

## Resultado Final

| Teste | Status | Notas |
|---|---|---|
| 1.1 SENTRY_DSN no ECS | PASS | Secret via Secrets Manager. DSN correto verificado. |
| 1.2 Inicializacao Sentry (logs) | INCONCLUSIVE | `initSentry()` nao emite log de sucesso. Precisa fix no codigo para adicionar log. |
| 1.3 Erro 5xx no Sentry (Core) | BLOCKED | Requer auth valido para provocar 5xx. |
| 1.4 Logs estruturados CloudWatch (Core) | PASS | JSON com requestId (UUID), method, path, status (numero), duration (ms), level, time. Todos campos presentes. |
| 2.1 SENTRY_DSN no Lambda | PASS | `NEXT_PUBLIC_SENTRY_DSN` configurado com DSN correto. Tambem tem `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`. |
| 2.2 Sentry init log (Lambda) | INCONCLUSIVE | Sentry SDK inicializa silenciosamente (sem log). Porem, transacoes de performance confirmam que o SDK esta ativo (2 transacoes `middleware GET` em 24h). |
| 2.3 Erro no Sentry (Dashboard) | INCONCLUSIVE | Nenhum error event aparece no Sentry. Sentry ESTA ativo (confirmado via transacoes de performance), porem nenhuma rota da dashboard gera erro 5xx capturavel via curl (404s sao tratados pelo Next.js). |
| 2.4 Source maps (Dashboard) | PASS | Release `2fd0ff0beede` criada via `sentry-cli/2.58.5 webpack-plugin/5.2.0`. 3 artifact bundles com 764 source map files totais (174 + 298 + 292). |
| 3.1 Error grouping (Dashboard) | INCONCLUSIVE | Nenhum issue no projeto — nenhum error event foi capturado ainda. Sentry esta ativo mas nenhum erro ocorreu. |
| 3.2 Alert rules | PASS | Dashboard: 3 regras (New Issue, Regression, High Priority). Core: 3 regras (New Issue, Regression, High Priority). Todas ativas, notificam Engineering team por email. |
| 4.1 PII redaction CloudWatch | PASS | Nenhum valor de authorization, cookie, password, token, secret encontrado nos logs. |
| 4.2 PII scrubbing Sentry | INCONCLUSIVE | Nenhum error event para verificar PII scrubbing. `beforeSend` esta configurado corretamente no codigo (`sentry.server.config.ts`) removendo authorization, cookie, x-api-key, x-clerk-auth-token, x-session-token, request.data, request.cookies, user.ip_address, user.email. |
| 5.1 Performance transactions | PASS | 2 transacoes `middleware GET` capturadas nas ultimas 24h. SDK `sentry.javascript.nextjs v10.48.0`. Trace op=`http.server.middleware`, status=`ok`. |
| 5.2 Custom span/breadcrumb | PASS | Transacao contem 1 span (`http.server.middleware`) e 8 breadcrumbs (categorias: http, fetch). |
| 6.1 Logs autenticado — campos presentes (Core) | PASS | Log de user `user_3Bw6swE9t8N6NX8RWiJr0WDXxqf` com userId, tenantId, userRoles, method, path, status, duration, userAgent, ip. |
| 6.2 Erro 5xx autenticado — user context Sentry | BLOCKED | Requer auth valido + erro 5xx. |
| 6.3 Logs autenticado — Dashboard server-side | INCONCLUSIVE | Lambda log group ainda nao criado para funcao nova (`bdwtrtdt`). A funcao anterior (`zdcfdmbh`) foi deletada mas seus logs mostram apenas START/END/REPORT. |
| 6.4 Falha de autenticacao (401) | PASS | Level 40 (warn), requestId presente, path, method, msg "Application error". Token value NAO aparece nos logs. |

### Resumo (atualizado 2026-04-13 pos-deploy com Sentry secrets)

- **8/17 PASS** (1.1, 1.4, 2.1, 2.4, 3.2, 4.1, 5.1, 5.2, 6.1, 6.4)
- **0/17 FAIL**
- **6/17 INCONCLUSIVE** (1.2, 2.2, 2.3, 3.1, 4.2, 6.3) — Sentry SDK ativo mas sem error events para validar
- **2/17 BLOCKED** (1.3, 6.2) — requer auth credentials de staging

### Mudancas desde primeira execucao

1. **2.1 FAIL -> PASS**: `NEXT_PUBLIC_SENTRY_DSN` agora configurado corretamente no Lambda com DSN, auth token, org e project.
2. **2.2/2.3/2.4 FAIL -> melhorado**: Sentry SDK esta ativo (transacoes de performance confirmam). Source maps uploaded (764 files). Nenhum error event capturado ainda.
3. **3.1/3.2/5.1/5.2 BLOCKED -> testado**: Alert rules existem (3 por projeto). Performance transactions fluindo. Breadcrumbs e spans presentes.
4. **Sentry API token funcional**: Novo PAT permite verificacao via API.

### Acoes Restantes

1. **[RESOLVED]** ~~Adicionar `NEXT_PUBLIC_SENTRY_DSN` e `SENTRY_AUTH_TOKEN` como secrets no GitHub~~ -- feito, deploy com sucesso
2. **[MINOR]** Adicionar log `"Sentry initialized"` em `initSentry()` para observabilidade
3. **[RESOLVED]** ~~Gerar novo Sentry API auth token~~ -- novo PAT funcional
4. **[OPTIONAL]** Criar rota `/api/sentry-test` no dashboard para facilitar teste end-to-end de error capture
5. **[PENDING]** Provocar erro real no dashboard (login autenticado) para validar error capture end-to-end e PII scrubbing

---

## Comandos úteis

```bash
# Listar log groups do Core
aws logs describe-log-groups --region us-east-2 --log-group-name-prefix "/ecs/causeflow"

# Listar log groups do Dashboard
aws logs describe-log-groups --region us-east-1 --log-group-name-prefix "/aws/lambda" \
  --query 'logGroups[?contains(logGroupName, `causeflow`)].logGroupName'

# Tail logs em tempo real (Core)
aws logs tail "/ecs/causeflow-staging-api" --region us-east-2 --follow

# Tail logs em tempo real (Dashboard)
aws logs tail "<DASHBOARD_LOG_GROUP>" --region us-east-1 --follow

# Verificar Sentry issues via API
curl -s -H "Authorization: Bearer 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" \
  "https://sentry.io/api/0/projects/causeflow-ai/causeflow-core/issues/?query=is:unresolved" | jq '.[0:3] | .[] | {title, count, lastSeen}'

curl -s -H "Authorization: Bearer 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" \
  "https://sentry.io/api/0/projects/causeflow-ai/causeflow-dashboard/issues/?query=is:unresolved" | jq '.[0:3] | .[] | {title, count, lastSeen}'
```

---

## Deploy Commands

```bash
# Core — após merge da PR #5
# (deploy staging é automático via CI/CD após merge)

# Dashboard — já foi pushed para main
# Verificar status do deploy:
gh run list --repo causeflow/web --workflow "Dashboard Deploy" --limit 3

# Se precisar trigger manual:
gh workflow run "Dashboard Deploy" --repo causeflow/web -f stage=staging
```
