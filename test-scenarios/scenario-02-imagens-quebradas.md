# Scenario 02 — Imagens quebradas na página de comparação /from-momentic

## Contexto do incidente

**Empresa afetada:** SimUser AI  
**Data do incidente:** 2026-04-16  
**Shortcut Story:** [#52 — [Incident] Imagens quebradas na página de comparação /from-momentic](https://app.shortcut.com/pessoal-27/story/52)  
**Reporter:** Rodrigo Lima (Sales Engineer, rodrigo.lima@simuser.ai)

---

## Descrição do problema

Rodrigo Lima, Sales Engineer da SimUser AI, estava usando a página `/from-momentic` durante uma demo com um prospect às 09h15 UTC do dia 16/04/2026. Durante a apresentação, todas as imagens `.webp` da página apareceram quebradas — ícones de imagem ausente no lugar dos screenshots do produto. O prospect perguntou se o site estava com problemas. Rodrigo precisou encerrar a demo e abrir um incidente.

O problema ocorreu de forma concentrada por ~8 minutos e depois se resolveu sozinho. A hipótese inicial da equipe foi CDN, mas o CloudFront não reportou nenhuma anomalia.

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
  --expression-attribute-values '{":tag":{"S":"revalidate"},":path":{"S":"/from-momentic"}}' \
  --region us-east-1
```

**Resultado esperado:**
```json
{
  "tag": "revalidate",
  "path": "/from-momentic",
  "status": "failed",
  "retries": 3,
  "error": "TimeoutError: Lambda function timed out — image optimization exceeded 5000ms during ISR page generation",
  "deployId": "deploy-20260416-091500",
  "deployVersion": "v2.4.0",
  "timestamp": "2026-04-16T09:15:00Z"
}
```

**O que o modelo deve concluir:** O job de revalidação para `/from-momentic` falhou com `status: "failed"` e `retries: 3`. O erro é `TimeoutError` durante a geração ISR da página — o Lambda de otimização de imagens excedeu o timeout de 5.000ms. Como o job está em `status: "failed"` (não `"pending"`), ele não será reprocessado automaticamente. A versão cacheada da página ficou desatualizada e as imagens novas nunca foram servidas corretamente.

### 2. DynamoDB — Cache entries sem revalidação

Verificar que os paths de `/from-momentic` têm `revalidatedAt: 1` (nunca revalidado):
```bash
AWS_PROFILE=simuser aws dynamodb scan \
  --table-name simuser-ai-website-production-WebsiteRevalidationTable-hfcmkacz \
  --filter-expression "contains(#p, :from_momentic)" \
  --expression-attribute-names '{"#p":"path"}' \
  --expression-attribute-values '{":from_momentic":{"S":"from-momentic"}}' \
  --region us-east-1 \
  --query 'Items[].{tag:tag.S,path:path.S,revalidatedAt:revalidatedAt.N}'
```

**Resultado esperado:** ~20 registros retornados, todos com `revalidatedAt: "1"` — confirmando que nenhuma versão de `/from-momentic` (en ou pt-br) foi atualizada em cache desde o deploy inicial.

### 3. CloudWatch Logs — Lambda ImageOptimizer

**Log group:** `/aws/lambda/simuser-ai-web-production-WebsiteImageOptimizerFunction-xrhtnvud`  
**Log stream:** `2026/04/16/simuser-ai-web-production-WebsiteImageOptimizerFunction-bdssuzfc[$LATEST]scenario02-cold-start-timeout`

Entradas críticas no log:
```json
{"level":"info","msg":"INIT_START Runtime Version: nodejs:20.v37","initDuration":3098.74}
{"level":"error","msg":"Source image fetch timeout","url":"https://assets.simuser.ai/screenshots/dashboard-hero.webp","elapsedMs":5600,"timeoutMs":5000,"error":"TimeoutError: socket hang up"}
{"level":"error","msg":"Source image fetch timeout","url":"https://assets.simuser.ai/screenshots/test-flow-builder.webp","elapsedMs":5601,"timeoutMs":5000,"error":"TimeoutError: socket hang up"}
{"level":"error","msg":"Source image fetch timeout","url":"https://assets.simuser.ai/screenshots/results-panel.webp","elapsedMs":5602,"timeoutMs":5000,"error":"TimeoutError: socket hang up"}
{"level":"warn","msg":"Returning 504 to CloudFront — upstream timeout on image fetch"}
```

O Lambda sofreu um cold start de 3.098ms. Após a inicialização, as 3 tentativas de fetch das imagens `.webp` expiraram os 5.000ms de timeout configurados — porque o cold start consumiu parte do budget de tempo total da requisição. O Lambda retornou 504 para o CloudFront, que repassou ao browser, resultando em imagens quebradas.

### 4. Shortcut Story #52

**URL:** https://app.shortcut.com/pessoal-27/story/52

---

## Cadeia de raciocínio esperada (CauseFlow AI)

1. **Sintoma:** Imagens `.webp` quebradas na `/from-momentic` por ~8 minutos, depois resolvido.
2. **DynamoDB job record:** Job de revalidação para `/from-momentic` com `status: "failed"`, `retries: 3` e `error: "TimeoutError: Lambda function timed out — image optimization exceeded 5000ms during ISR page generation"` → o job falhou antes de atualizar o cache de imagens.
3. **DynamoDB cache entries:** ~20 registros de `/from-momentic` com `revalidatedAt: 1` → confirma que nenhum cache foi atualizado desde o deploy inicial.
4. **CloudWatch ImageOptimizer:** Cold start de 3.098ms seguido de 3 timeouts de 5.000ms nas imagens `.webp` → o overhead de inicialização consumiu o budget de tempo disponível para o fetch das imagens.
5. **Hipótese CDN descartada:** CloudFront não reportou anomalias → o problema está upstream, no Lambda de otimização.
6. **Causa raiz:** Cold start do `WebsiteImageOptimizerFunction` de ~3s reduziu o tempo disponível para buscar as imagens de origem abaixo do threshold de 5s configurado. As 3 imagens pesadas da `/from-momentic` foram requisitadas simultaneamente após o cold start, todas expirando o timeout.
7. **Comportamento "se resolveu sozinho":** Característico de cold start — após a instância ser aquecida, as requisições subsequentes não sofreram mais o overhead de inicialização.

---

## Solução correta

**Imediata:** Configurar Provisioned Concurrency na função `WebsiteImageOptimizerFunction` para manter ao menos 1 instância aquecida durante o horário comercial (08h–20h UTC).

**Estrutural:**
1. Aumentar o timeout total da função Lambda para acomodar o pior caso: cold start (~3s) + fetch de imagem (~2s) + margem de segurança.
2. Avaliar se imagens estáticas de produto precisam passar pelo optimizer — considerar pré-converter para `.webp` no build e servir diretamente do S3.
3. Adicionar alarme CloudWatch para `Init Duration > 2000ms` na função `WebsiteImageOptimizerFunction`.
4. Resetar o job de revalidação `/from-momentic` de `status: "failed"` para `"pending"` e corrigir o handler para reprocessar jobs falhos.

---

## Conteúdo para colar no Notion

```
# Image Optimizer Lambda — Architecture & Runbook

## Visão Geral

O site da SimUser AI usa uma função Lambda dedicada para otimização de imagens: 
`WebsiteImageOptimizerFunction`. Esta função é invocada pelo CloudFront sempre que uma 
imagem precisa ser redimensionada ou convertida para formatos modernos (.webp).

**Função Lambda:** `simuser-ai-web-production-WebsiteImageOptimizerFunction-xrhtnvud`  
**Runtime:** Node.js 20  
**Região:** us-east-1  
**Conta:** 857876979211

## Fluxo de Requisição

1. Browser requisita imagem via CloudFront (ex: `/assets/screenshots/dashboard-hero.webp`)
2. CloudFront verifica cache — se miss, invoca o Lambda
3. Lambda faz fetch da imagem de origem em `assets.simuser.ai`
4. Lambda redimensiona/converte a imagem
5. Lambda retorna a imagem otimizada para o CloudFront
6. CloudFront armazena em cache e serve ao browser

## Problema de Cold Start

### O que é

Cold start ocorre quando o Lambda não tem uma instância aquecida disponível. O runtime 
Node.js precisa ser inicializado antes de processar a requisição. Para esta função, o 
cold start típico é de ~3.000ms (medido: 3.098ms no incidente de 2026-04-16).

### Por que é crítico aqui

O timeout configurado para fetch da imagem de origem é 5.000ms. Em condições normais 
(instância aquecida), há tempo suficiente. Porém:

- Cold start: ~3.000ms
- Tempo restante para fetch: ~2.000ms (abaixo do timeout de 5.000ms configurado no fetch)
- Resultado: TimeoutError → CloudFront recebe 504 → browser exibe imagem quebrada

### Quando ocorre

- Após períodos sem tráfego (madrugada, fins de semana)
- Após deploy da função
- Em picos de tráfego que excedem a capacidade de instâncias aquecidas

## Configuração de Provisioned Concurrency

Para eliminar cold starts durante horário comercial, configure Provisioned Concurrency:

```bash
# Ativar Provisioned Concurrency (manter 1 instância aquecida)
AWS_PROFILE=simuser aws lambda put-provisioned-concurrency-config \
  --function-name simuser-ai-web-production-WebsiteImageOptimizerFunction-xrhtnvud \
  --qualifier '$LATEST' \
  --provisioned-concurrent-executions 1 \
  --region us-east-1
```

**Custo estimado:** ~$15-20/mês por instância aquecida (us-east-1, função Node.js 20).

**Recomendação:** Ativar das 07h às 22h UTC via EventBridge Scheduler para reduzir custo.

## Alarme CloudWatch — Init Duration

Para detecção proativa de cold starts:

```bash
AWS_PROFILE=simuser aws cloudwatch put-metric-alarm \
  --alarm-name "ImageOptimizer-ColdStart-High" \
  --metric-name "InitDuration" \
  --namespace "AWS/Lambda" \
  --dimensions Name=FunctionName,Value=simuser-ai-web-production-WebsiteImageOptimizerFunction-xrhtnvud \
  --statistic Maximum \
  --period 60 \
  --threshold 2000 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:857876979211:simuser-alerts \
  --region us-east-1
```

## Runbook: Imagens quebradas no site

1. Verificar se CloudFront reporta anomalias → se não, problema é upstream no Lambda
2. Consultar logs do Lambda `WebsiteImageOptimizerFunction`:
   - Log group: `/aws/lambda/simuser-ai-web-production-WebsiteImageOptimizerFunction-xrhtnvud`
   - Procurar por `INIT_START` (cold start) seguido de `TimeoutError`
3. Verificar DynamoDB — job de revalidação:
   ```bash
   AWS_PROFILE=simuser aws dynamodb query \
     --table-name simuser-ai-website-production-WebsiteRevalidationTable-hfcmkacz \
     --key-condition-expression "#tag = :tag AND #path = :path" \
     --expression-attribute-names '{"#tag":"tag","#path":"path"}' \
     --expression-attribute-values '{":tag":{"S":"revalidate"},":path":{"S":"/from-momentic"}}' \
     --region us-east-1
   ```
4. Se `Init Duration > 2000ms` nos logs → cold start confirmado
5. **Mitigação imediata:** Ativar Provisioned Concurrency (comando acima)
6. **Forçar revalidação manual:**
   - Atualizar job no DynamoDB de `status: "failed"` para `"pending"`
   - Ou chamar `next.revalidatePath('/from-momentic')` via API route

## Histórico de Incidentes

| Data       | Duração | Init Duration | Causa                   | Resolução          |
|------------|---------|---------------|-------------------------|--------------------|
| 2026-04-16 | ~8 min  | 3.098ms       | Cold start após deploy  | Aquecimento natural |
```
