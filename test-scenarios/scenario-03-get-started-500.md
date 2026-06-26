# Scenario 03 — Página /get-started retornando erro 500 de forma intermitente

## Contexto do incidente

**Empresa afetada:** SimUser AI  
**Data do incidente:** 2026-04-16  
**Shortcut Story:** [#53 — [Incident] Página /get-started retornando erro 500 de forma intermitente](https://app.shortcut.com/pessoal-27/story/53)  
**Reporter:** Ana Paula Ferreira (VP of Sales, ana.paula@simuser.ai)

---

## Descrição do problema

Ana Paula Ferreira, VP of Sales da SimUser AI, recebeu às 09h05 UTC do dia 16/04/2026 uma mensagem de um prospect que havia clicado no botão "Get Started" do site e caído em uma página de erro 500. Ana acessou `/get-started` imediatamente e recebeu o mesmo erro. Dez minutos depois, a página voltou a funcionar normalmente. A equipe não conseguiu identificar o que havia mudado.

O incidente ocorreu durante um período de alta tração — a SimUser AI havia publicado um artigo no LinkedIn na manhã do mesmo dia que gerou pico de tráfego para o site.

---

## Evidências disponíveis para investigação

### 1. DynamoDB — Job de revalidação com falha

**Tabela:** `simuser-ai-website-production-WebsiteRevalidationTable-hfcmkacz`  
**Conta AWS:** SimUser AI (`simuser`, 857876979211) — us-east-1

Query para localizar o job:
```bash
AWS_PROFILE=simuser aws dynamodb query \
  --table-name simuser-ai-website-production-WebsiteRevalidationTable-hfcmkacz \
  --key-condition-expression "#tag = :tag AND #path = :path" \
  --expression-attribute-names '{"#tag":"tag","#path":"path"}' \
  --expression-attribute-values '{":tag":{"S":"revalidate"},":path":{"S":"/get-started"}}' \
  --region us-east-1
```

**Resultado esperado:**
```json
{
  "tag": "revalidate",
  "path": "/get-started",
  "status": "pending",
  "retries": 3,
  "error": "FetchError: Failed to fetch CMS data — https://cms.simuser.ai/api/pages/get-started returned HTTP 503 Service Unavailable",
  "deployId": "deploy-20260416-090000",
  "deployVersion": "v2.4.0",
  "timestamp": "2026-04-16T09:00:14Z"
}
```

**O que o modelo deve concluir:** O job de revalidação para `/get-started` falhou com `status: "pending"` e `retries: 3`. O erro é `FetchError` ao tentar buscar dados no CMS (`cms.simuser.ai`) que retornou 503 — indisponível. Com `retries: 3` e `status: "pending"`, o job está bloqueado. O servidor faz SSR com fetch direto ao CMS em cada requisição, sem cache — quando o CMS ficou indisponível, toda requisição resultou em 500 para o usuário.

### 2. DynamoDB — Cache entries sem revalidação

Verificar que os paths de `/get-started` têm `revalidatedAt: 1` (nunca revalidado):
```bash
AWS_PROFILE=simuser aws dynamodb scan \
  --table-name simuser-ai-website-production-WebsiteRevalidationTable-hfcmkacz \
  --filter-expression "contains(#p, :get_started)" \
  --expression-attribute-names '{"#p":"path"}' \
  --expression-attribute-values '{":get_started":{"S":"get-started"}}' \
  --region us-east-1 \
  --query 'Items[].{tag:tag.S,path:path.S,revalidatedAt:revalidatedAt.N}'
```

**Resultado esperado:** ~80 registros retornados, todos com `revalidatedAt: "1"` — confirmando que nenhuma versão de `/get-started` (en ou pt-br) foi atualizada em cache desde o deploy inicial. A ausência de cache é a razão pela qual o CMS se tornou um single point of failure.

### 3. CloudWatch Logs — Lambda WebsiteServer

**Log group:** `/aws/lambda/simuser-ai-webs-production-WebsiteServerUseast1Function-mfcnsfze`  
**Log stream:** `2026/04/16/simuser-ai-webs-production-WebsiteServerUseast1Function-zxwnbbaa[$LATEST]scenario03-get-started-500`

Entradas críticas no log (requisições com erro):
```json
{"level":"info","msg":"Incoming request","method":"GET","path":"/get-started","requestId":"req-a1b2c3"}
{"level":"info","msg":"Fetching page content from CMS","endpoint":"https://cms.simuser.ai/api/pages/get-started","requestId":"req-a1b2c3"}
{"level":"error","msg":"CMS API request failed","endpoint":"https://cms.simuser.ai/api/pages/get-started","status":503,"body":"Service Unavailable","elapsedMs":4200,"requestId":"req-a1b2c3"}
{"level":"warn","msg":"CMS unavailable — no fallback cache found for path","path":"/get-started","requestId":"req-a1b2c3"}
{"level":"error","msg":"Rendering error page","statusCode":500,"reason":"CMS_UNAVAILABLE","path":"/get-started","requestId":"req-a1b2c3"}
{"level":"info","msg":"Response sent","statusCode":500,"durationMs":4350,"requestId":"req-a1b2c3"}
```

Entrada de requisição bem-sucedida (após recuperação do CMS):
```json
{"level":"info","msg":"Incoming request","method":"GET","path":"/get-started","requestId":"req-d4e5f6"}
{"level":"info","msg":"Fetching page content from CMS","endpoint":"https://cms.simuser.ai/api/pages/get-started","requestId":"req-d4e5f6"}
{"level":"info","msg":"CMS response received","status":200,"elapsedMs":312,"requestId":"req-d4e5f6"}
{"level":"info","msg":"Page rendered successfully","path":"/get-started","requestId":"req-d4e5f6"}
{"level":"info","msg":"Response sent","statusCode":200,"durationMs":445,"requestId":"req-d4e5f6"}
```

### 4. Shortcut Story #53

**URL:** https://app.shortcut.com/pessoal-27/story/53

---

## Cadeia de raciocínio esperada (CauseFlow AI)

1. **Sintoma:** Página `/get-started` retornando 500 por ~10 minutos durante pico de tráfego do LinkedIn.
2. **DynamoDB job record:** Job de revalidação para `/get-started` com `status: "pending"`, `retries: 3` e `error: "FetchError: Failed to fetch CMS data — returned HTTP 503"` → o CMS estava indisponível quando o job foi criado e o servidor não tem cache de fallback.
3. **DynamoDB cache entries:** ~80 registros de `/get-started` com `revalidatedAt: 1` → confirma que nenhum cache existe — a página é gerada via SSR puro sem nenhuma camada de cache.
4. **CloudWatch WebsiteServer:** Cada requisição à `/get-started` faz fetch direto ao CMS. Quando CMS retorna 503, o servidor não tem fallback e renderiza 500 para o usuário.
5. **Correlação com pico de tráfego:** Artigo no LinkedIn → spike de visitantes → mais requisições ao CMS → CMS sobrecarregado → 503 → 500 em cascata para todos os visitantes.
6. **Causa raiz:** A página `/get-started` usa SSR puro com fetch síncrono ao CMS em cada requisição, sem cache, sem retry e sem fallback. O CMS se tornou um single point of failure. Durante o pico de tráfego, o CMS ficou instável por ~10 minutos e toda requisição resultou em 500.

---

## Solução correta

**Imediata:** Adicionar tratamento de erro no fetch ao CMS com fallback para versão em cache:
- Se CMS retornar 4xx/5xx, servir a última versão cacheada da página em vez de 500.
- Logar o fallback para monitoramento, mas nunca expor o erro 500 ao usuário.

**Estrutural:**
1. Migrar `/get-started` e outras páginas de conteúdo de SSR puro para ISR com `revalidate: 300` (5 minutos) — conteúdo cacheado, atualizado periodicamente, tolerante a indisponibilidade do CMS.
2. Adicionar retry com backoff exponencial no fetch ao CMS (até 2 tentativas antes de usar fallback).
3. Implementar alarme CloudWatch para taxa de 5xx > 1% na função `WebsiteServerUseast1Function`.
4. Considerar rate limiting e autoscaling no CMS para absorver spikes de tráfego do site.

---

## Conteúdo para colar no Notion

```
# CMS Integration & SSR Resilience Patterns

## Visão Geral

O site da SimUser AI integra com o CMS (Contentful) via API REST para renderizar páginas 
dinamicamente. A função Lambda `WebsiteServerUseast1Function` é responsável pelo SSR 
(Server-Side Rendering) de todas as páginas do site.

**Função Lambda:** `simuser-ai-webs-production-WebsiteServerUseast1Function-mfcnsfze`  
**Runtime:** Node.js 20 (Next.js via OpenNext)  
**Região:** us-east-1  
**Conta:** 857876979211

## Arquitetura Atual

### Páginas SSR com fetch ao CMS em runtime

As seguintes páginas fazem fetch direto ao CMS em cada requisição (sem cache):

| Página         | Endpoint CMS                                  | Tipo  |
|----------------|-----------------------------------------------|-------|
| /get-started   | https://cms.simuser.ai/api/pages/get-started  | SSR   |
| /pricing       | https://cms.simuser.ai/api/pages/pricing      | SSR   |
| /from-momentic | https://cms.simuser.ai/api/pages/from-momentic| SSR   |

**Problema:** O CMS é um single point of failure. Se o CMS ficar indisponível, todas 
essas páginas retornam 500 para os visitantes. Não há cache, retry, nem fallback.

## Incidente de 2026-04-16: /get-started retornando 500

### Causa Raiz

Pico de tráfego gerado por publicação no LinkedIn → CMS sobrecarregado → 503 por ~10 
minutos → todos os visitantes de /get-started receberam erro 500.

### Evidências

**DynamoDB** (job de revalidação com erro):
```bash
AWS_PROFILE=simuser aws dynamodb query \
  --table-name simuser-ai-website-production-WebsiteRevalidationTable-hfcmkacz \
  --key-condition-expression "#tag = :tag AND #path = :path" \
  --expression-attribute-names '{"#tag":"tag","#path":"path"}' \
  --expression-attribute-values '{":tag":{"S":"revalidate"},":path":{"S":"/get-started"}}' \
  --region us-east-1
```

Resultado: `status: "pending"`, `retries: 3`, `error: "FetchError: ... HTTP 503"`

**CloudWatch Logs:**
- Log group: `/aws/lambda/simuser-ai-webs-production-WebsiteServerUseast1Function-mfcnsfze`
- Pattern: `CMS API request failed` → `status: 503` → `CMS unavailable — no fallback cache found`

## Solução: ISR com revalidate

Migrar páginas de conteúdo de SSR puro para ISR (Incremental Static Regeneration):

```typescript
// Antes (SSR puro — fetch em cada requisição)
export default async function GetStartedPage() {
  const content = await fetch('https://cms.simuser.ai/api/pages/get-started')
    .then(r => r.json())
  return <PageContent data={content} />
}

// Depois (ISR — cache por 5 minutos, tolerante a falhas do CMS)
export const revalidate = 300

export default async function GetStartedPage() {
  const content = await fetch('https://cms.simuser.ai/api/pages/get-started', {
    next: { revalidate: 300 }
  }).then(r => r.json())
  return <PageContent data={content} />
}
```

### Impacto no sistema de revalidação

Com ISR ativado, o sistema de revalidação via DynamoDB passa a ser essencial para 
propagar mudanças de conteúdo antes dos 5 minutos. O fluxo completo:

1. Editor publica conteúdo no CMS
2. CMS dispara webhook para `RevalidationSeederFunction`
3. Seeder consulta DynamoDB para descobrir paths mapeados à tag
4. Seeder enfileira jobs de revalidação via SQS
5. `RevalidationEventsSubscriber` processa jobs e chama `revalidatePath()`
6. Next.js invalida o cache ISR para o path correspondente

⚠️ **Bug conhecido no Subscriber:** O handler acessa `record.dynamodb.NewImage` sem 
verificar se o campo existe. Eventos DELETE não contêm `NewImage` e causam TypeError. 
Jobs ficam com `status: "pending"` e `retries: 3` permanentemente. Ver runbook abaixo.

## Padrão de Fallback para Indisponibilidade do CMS

```typescript
async function fetchWithFallback(path: string) {
  try {
    const res = await fetch(`https://cms.simuser.ai/api/pages/${path}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000)
    })
    if (!res.ok) throw new Error(`CMS returned ${res.status}`)
    return await res.json()
  } catch (err) {
    // Logar para monitoramento, nunca expor 500 ao usuário
    console.error({ msg: 'CMS fetch failed — serving stale cache', path, err })
    // Next.js serve automaticamente o cache ISR quando o fetch falha com notFound: false
    return null
  }
}
```

## Alarme CloudWatch — Taxa de 5xx

```bash
AWS_PROFILE=simuser aws cloudwatch put-metric-alarm \
  --alarm-name "WebsiteServer-5xx-High" \
  --metric-name "Errors" \
  --namespace "AWS/Lambda" \
  --dimensions Name=FunctionName,Value=simuser-ai-webs-production-WebsiteServerUseast1Function-mfcnsfze \
  --statistic Sum \
  --period 60 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:857876979211:simuser-alerts \
  --region us-east-1
```

## Runbook: Página retornando 500

1. Verificar se o problema é isolado a uma página ou sistêmico:
   - Isolado → provável problema no CMS para aquele conteúdo específico
   - Sistêmico → verificar status do CMS (https://cms.simuser.ai/health)

2. Verificar logs do `WebsiteServerUseast1Function`:
   - Log group: `/aws/lambda/simuser-ai-webs-production-WebsiteServerUseast1Function-mfcnsfze`
   - Procurar por `CMS API request failed` com `status: 503`

3. Verificar job no DynamoDB:
   ```bash
   AWS_PROFILE=simuser aws dynamodb query \
     --table-name simuser-ai-website-production-WebsiteRevalidationTable-hfcmkacz \
     --key-condition-expression "#tag = :tag AND #path = :path" \
     --expression-attribute-names '{"#tag":"tag","#path":"path"}' \
     --expression-attribute-values '{":tag":{"S":"revalidate"},":path":{"S":"/get-started"}}' \
     --region us-east-1
   ```

4. Se CMS instável: aguardar recuperação (normalmente <15 min) ou ativar fallback estático manualmente.

5. Se job bloqueado (`retries: 3`, `status: "pending"`): forçar revalidação manual:
   - Chamar `next.revalidatePath('/get-started')` via API route autenticada
   - Ou atualizar o job no DynamoDB para `status: "pending"` e `retries: 0` para reprocessamento

## Histórico de Incidentes

| Data       | Duração | Páginas afetadas | Causa                              | Resolução          |
|------------|---------|------------------|------------------------------------|--------------------|
| 2026-04-16 | ~10 min | /get-started     | CMS 503 durante pico LinkedIn      | CMS se recuperou   |
```
