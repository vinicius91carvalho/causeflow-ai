# Scenario 01 — Página de pricing exibe preços desatualizados após atualização no CMS

## Contexto do incidente

**Empresa afetada:** SimUser AI  
**Data do incidente:** 2026-04-16  
**Shortcut Story:** [#51 — [Incident] Página de pricing exibe preços desatualizados após atualização no CMS](https://app.shortcut.com/pessoal-27/story/51)  
**Reporter:** Felipe Aguiar (Head of Marketing, felipe.aguiar@simuser.ai)

---

## Descrição do problema

Felipe Aguiar, Head of Marketing da SimUser AI, atualizou os preços dos planos no CMS às 11h20 UTC — um reposicionamento de 15% em todos os planos. Às 11h45, um lead confirmou que a página `/pricing` ainda exibia os preços antigos. Felipe verificou e confirmou: nenhuma alteração havia chegado ao site.

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
  --expression-attribute-values '{":tag":{"S":"revalidate"},":path":{"S":"/pricing"}}' \
  --region us-east-1
```

**Resultado esperado:**
```json
{
  "tag": "revalidate",
  "path": "/pricing",
  "status": "pending",
  "retries": 3,
  "error": "TypeError: Cannot read properties of undefined (reading NewImage) at handler (/var/task/index.js:23:45)",
  "deployId": "deploy-20260416-030158",
  "deployVersion": "v2.4.0",
  "timestamp": "2026-04-16T03:02:14Z"
}
```

**O que o modelo deve concluir:** O job de revalidação para `/pricing` foi tentado 3 vezes e falhou todas as vezes com um `TypeError` na leitura de `NewImage` — atributo do evento DynamoDB Streams. O handler do `RevalidationEventsSubscriber` tem um bug: não trata o caso em que o evento não contém `NewImage` (ex.: eventos de DELETE). Com `retries: 3` e `status: "pending"`, o job está bloqueado e nunca será reprocessado.

### 2. DynamoDB — Cache entries sem revalidação

Verificar que todos os paths de `/pricing` têm `revalidatedAt: 1` (nunca revalidado):
```bash
AWS_PROFILE=simuser aws dynamodb scan \
  --table-name simuser-ai-website-production-WebsiteRevalidationTable-hfcmkacz \
  --filter-expression "contains(#p, :pricing)" \
  --expression-attribute-names '{"#p":"path"}' \
  --expression-attribute-values '{":pricing":{"S":"pricing"}}' \
  --region us-east-1 \
  --query 'Items[].{tag:tag.S,path:path.S,revalidatedAt:revalidatedAt.N}'
```

**Resultado esperado:** 71 registros retornados, todos com `revalidatedAt: "1"` — confirmando que nenhuma versão de `/pricing` (en ou pt-br) foi atualizada em cache desde o deploy inicial.

### 3. CloudWatch Logs — Lambda RevalidationSeeder

**Log group:** `/aws/lambda/simuser-ai-production-WebsiteRevalidationSeederFunction-bresdvat`  
**Log stream:** `2026/04/14/simuser-ai-production-WebsiteRevalidationSeederFunction-baawwahn[$LATEST]scenario01-pricing-miss`

Entrada crítica:
```json
{"level":"warn","msg":"Tag not found in revalidation table","tag":"pricing-page","pathCount":0,"note":"No paths registered for this tag — skipping"}
```

O Seeder recebeu o webhook do CMS com a tag `pricing-page`, mas não encontrou nenhum path mapeado para ela. Nenhuma invalidação foi propagada.

### 4. Shortcut Story #51

**URL:** https://app.shortcut.com/pessoal-27/story/51

---

## Cadeia de raciocínio esperada (CauseFlow AI)

1. **Sintoma:** `/pricing` não refletiu atualização do CMS.
2. **DynamoDB job record:** Job de revalidação para `/pricing` existe com `status: "pending"`, `retries: 3` e `error: "TypeError: Cannot read properties of undefined (reading NewImage)"` → o job falhou antes de invalidar o cache.
3. **DynamoDB cache entries:** 71 registros de `/pricing` com `revalidatedAt: 1` → confirma que nenhum cache foi atualizado.
4. **CloudWatch Seeder:** Log de `warn` mostrando que a tag `pricing-page` não tem paths mapeados → o webhook chegou, mas o Seeder não soube quais páginas invalidar.
5. **Causa raiz:** Dois problemas sobrepostos: (a) a tag enviada pelo CMS (`pricing-page`) não está cadastrada na tabela com o path `/pricing`; (b) mesmo que estivesse, o `RevalidationEventsSubscriber` tem um bug que causa TypeError ao processar eventos e bloqueia todos os jobs em `retries: 3`.
6. **Agravante:** O mesmo TypeError afeta `/`, `/features` e `/blog/simuser-ai-v2-launch` — problema sistêmico no handler.

---

## Solução correta

**Bug no handler:** Corrigir `handler (/var/task/index.js:23:45)` para verificar a existência de `NewImage` antes de acessá-la:
```js
const newImage = record.dynamodb?.NewImage;
if (!newImage) return; // evento de DELETE — ignorar
```

**Mapeamento de tag ausente:** Registrar a tag `pricing-page` → path `/pricing` na tabela DynamoDB. Revisar todos os outros mapeamentos para garantir que as tags do CMS correspondam às rotas do site.

**Forçar revalidação manual imediata** via `next.revalidatePath('/pricing')` para restaurar o conteúdo correto.

---

## Conteúdo para colar no Notion

```
# Cache Revalidation Architecture — SimUser AI Website

## Visão Geral

O site da SimUser AI usa Next.js com ISR (Incremental Static Regeneration) via OpenNext 
deployado em AWS Lambda. O sistema de revalidação tem três componentes principais:

1. **CMS Webhook → RevalidationSeeder Lambda**: O CMS (Contentful) envia um webhook com 
   uma tag quando o conteúdo é publicado. O Seeder consulta a DynamoDB para descobrir 
   quais paths do site estão associados àquela tag e enfileira as revalidações via SQS.

2. **DynamoDB WebsiteRevalidationTable**: Single-table design com PK = `tag` e SK = `path`. 
   Armazena o mapeamento entre tags do CMS e paths do Next.js. Também registra jobs de 
   revalidação com `tag = "revalidate"`.

   Schema de um registro de mapeamento:
   - tag: "{deployId}/_N_T_/{route}/page" (ex: "abc123/_N_T_/[locale]/pricing/page")
   - path: "{deployId}/en/pricing"
   - revalidatedAt: timestamp Unix (1 = nunca revalidado desde o deploy)

   Schema de um job de revalidação:
   - tag: "revalidate"
   - path: "/pricing" (o path que precisa ser invalidado)
   - status: "pending" | "completed" | "failed"
   - retries: número de tentativas
   - error: mensagem de erro se falhou
   - deployId, deployVersion, timestamp

3. **RevalidationEventsSubscriber Lambda**: Consome eventos do DynamoDB Streams e dispara 
   `revalidatePath()` no servidor Next.js para invalidar o cache do path correspondente.

## Tabelas no AWS

- Produção: `simuser-ai-website-production-WebsiteRevalidationTable-hfcmkacz`
- Staging: `simuser-ai-website-staging-WebsiteRevalidationTable-vzdstmsh`
- Conta: 857876979211 (us-east-1)

## Mapeamentos de Tags do CMS

Os mapeamentos são gerados automaticamente pelo Next.js durante o build. Cada componente 
que usa `unstable_cache` ou `fetch` com tags gera entradas na tabela.

⚠️ ATENÇÃO: A tag `pricing-page` usada no CMS não corresponde ao formato interno do 
Next.js. Para forçar revalidação de /pricing, use a tag no formato 
`{deployId}/_N_T_/[locale]/pricing/page`.

## Bug Conhecido: TypeError no RevalidationEventsSubscriber

O handler em `/var/task/index.js:23` acessa `event.Records[i].dynamodb.NewImage` sem 
verificar se o campo existe. Eventos de tipo DELETE não contêm NewImage e causam:

TypeError: Cannot read properties of undefined (reading 'NewImage')

Jobs afetados ficam com `status: "pending"` e `retries: 3` permanentemente — nunca são 
reprocessados e nunca chegam a invalidar o cache.

**Fix:** Adicionar guarda antes de acessar NewImage:
```
const newImage = record.dynamodb?.NewImage;
if (!newImage) return;
```

## Smoke Test do Fluxo de Revalidação

Após qualquer deploy ou alteração no CMS:
1. Publicar uma mudança no CMS para uma página de teste
2. Aguardar até 30 segundos
3. Verificar no DynamoDB se existe um job `tag: "revalidate"` para o path esperado
4. Verificar se o job tem `status: "completed"` (não "pending" ou "failed")
5. Acessar a página no browser e confirmar que o conteúdo foi atualizado

## Runbook: Página não atualiza após mudança no CMS

1. Verificar se existe job no DynamoDB: query com `tag = "revalidate"` e o path da página
2. Se `status: "failed"` ou `retries: 3` → bug no handler do Subscriber. Corrigir e redeployar.
3. Se job não existe → Seeder não encontrou paths para a tag enviada. Verificar mapeamentos.
4. Se job existe e `status: "completed"` → problema na invalidação do CloudFront. Verificar CDN.
5. Forçar revalidação manual: chamar `next.revalidatePath('/caminho-da-pagina')` via API route.
```
