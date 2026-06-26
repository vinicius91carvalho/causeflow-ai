# Cleanup Checklist — Test Scenarios (SimUser AI Account)

Tudo que foi criado artificialmente para os cenários de teste. Executar após os testes.

**AWS Profile:** `simuser` | **Account:** 857876979211 | **Region:** us-east-1

---

## Shortcut (workspace: pessoal-27)

- [ ] Deletar Story #51 — `[Incident] Página de pricing exibe preços desatualizados após atualização no CMS`
- [ ] Deletar Story #52 — `[Incident] Imagens quebradas na página de comparação /from-momentic`
- [ ] Deletar Story #53 — `[Incident] Página /get-started retornando erro 500 de forma intermitente`

```bash
# Deletar via API (substituir $SHORTCUT_API_TOKEN)
curl -X DELETE -H "Shortcut-Token: $SHORTCUT_API_TOKEN" https://api.app.shortcut.com/api/v3/stories/51
curl -X DELETE -H "Shortcut-Token: $SHORTCUT_API_TOKEN" https://api.app.shortcut.com/api/v3/stories/52
curl -X DELETE -H "Shortcut-Token: $SHORTCUT_API_TOKEN" https://api.app.shortcut.com/api/v3/stories/53
```

---

## CloudWatch Logs — SimUser AI (us-east-1)

### Scenario 01 — RevalidationSeeder
- [ ] Deletar log stream `2026/04/14/simuser-ai-production-WebsiteRevalidationSeederFunction-baawwahn[$LATEST]scenario01-pricing-miss`
  - Log group: `/aws/lambda/simuser-ai-production-WebsiteRevalidationSeederFunction-bresdvat`

```bash
AWS_PROFILE=simuser aws logs delete-log-stream \
  --log-group-name "/aws/lambda/simuser-ai-production-WebsiteRevalidationSeederFunction-bresdvat" \
  --log-stream-name "2026/04/14/simuser-ai-production-WebsiteRevalidationSeederFunction-baawwahn[\$LATEST]scenario01-pricing-miss" \
  --region us-east-1
```

### Scenario 02 — ImageOptimizer
- [ ] Deletar log stream `2026/04/16/simuser-ai-web-production-WebsiteImageOptimizerFunction-bdssuzfc[$LATEST]scenario02-cold-start-timeout`
  - Log group: `/aws/lambda/simuser-ai-web-production-WebsiteImageOptimizerFunction-xrhtnvud`

```bash
AWS_PROFILE=simuser aws logs delete-log-stream \
  --log-group-name "/aws/lambda/simuser-ai-web-production-WebsiteImageOptimizerFunction-xrhtnvud" \
  --log-stream-name "2026/04/16/simuser-ai-web-production-WebsiteImageOptimizerFunction-bdssuzfc[\$LATEST]scenario02-cold-start-timeout" \
  --region us-east-1
```

### Scenario 03 — WebsiteServer
- [ ] Deletar log stream `2026/04/16/simuser-ai-webs-production-WebsiteServerUseast1Function-zxwnbbaa[$LATEST]scenario03-get-started-500`
  - Log group: `/aws/lambda/simuser-ai-webs-production-WebsiteServerUseast1Function-mfcnsfze`

```bash
AWS_PROFILE=simuser aws logs delete-log-stream \
  --log-group-name "/aws/lambda/simuser-ai-webs-production-WebsiteServerUseast1Function-mfcnsfze" \
  --log-stream-name "2026/04/16/simuser-ai-webs-production-WebsiteServerUseast1Function-zxwnbbaa[\$LATEST]scenario03-get-started-500" \
  --region us-east-1
```

---

## DynamoDB — SimUser AI (us-east-1)

**Tabela:** `simuser-ai-website-production-WebsiteRevalidationTable-hfcmkacz`

> Os Scenarios 02 e 03 inseriram itens com `tag: "revalidate"` na tabela. Deletar após os testes.
> O Scenario 01 usa dados reais pré-existentes — não há nada a deletar para ele.

### Scenario 02 — Job de revalidação /from-momentic
- [ ] Deletar item `tag: "revalidate"`, `path: "/from-momentic"`

```bash
AWS_PROFILE=simuser aws dynamodb delete-item \
  --table-name simuser-ai-website-production-WebsiteRevalidationTable-hfcmkacz \
  --key '{"tag":{"S":"revalidate"},"path":{"S":"/from-momentic"}}' \
  --region us-east-1
```

### Scenario 03 — Job de revalidação /get-started
- [ ] Deletar item `tag: "revalidate"`, `path: "/get-started"`

```bash
AWS_PROFILE=simuser aws dynamodb delete-item \
  --table-name simuser-ai-website-production-WebsiteRevalidationTable-hfcmkacz \
  --key '{"tag":{"S":"revalidate"},"path":{"S":"/get-started"}}' \
  --region us-east-1
```

---

## Notion

- [ ] Deletar página **"Cache Revalidation Architecture"** (criada para Scenario 01, se foi criada)
- [ ] Deletar página **"Image Optimizer Lambda — Architecture & Runbook"** (criada para Scenario 02, se foi criada)
- [ ] Deletar página **"CMS Integration & SSR Resilience Patterns"** (criada para Scenario 03, se foi criada)

> As páginas Notion são opcionais — só deletar se foram efetivamente criadas durante os testes.

---

## Arquivos locais

- [ ] Deletar `/tmp/scenario01-logs.json`
- [ ] Deletar `/tmp/scenario02-logs.json`
- [ ] Deletar `/tmp/scenario03-logs.json`

```bash
rm /tmp/scenario01-logs.json /tmp/scenario02-logs.json /tmp/scenario03-logs.json
```

---

## O que NÃO remover

- Os arquivos `.md` em `core/docs/test-scenarios/` — são documentação dos cenários para uso futuro
- Os log groups do Lambda — existiam antes dos testes, apenas os streams criados devem ser removidos
- Os dados reais do DynamoDB (`revalidatedAt: 1` nos 921 registros de mapeamento) — são dados de produção preexistentes
- Os itens reais com `tag: "revalidate"` para `/`, `/pricing`, `/features`, `/blog/simuser-ai-v2-launch` — são dados de produção preexistentes com bugs reais, não foram criados para os testes
