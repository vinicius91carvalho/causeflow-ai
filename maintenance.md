# Core

## Logs

<log>
{
    "level": 30,
    "time": 1776180648178,
    "pid": 1,
    "hostname": "ip-10-0-204-29.us-east-2.compute.internal",
    "requestId": "13b8ca77-0008-41d3-bfbd-0bfe7e53c724",
    "tenantId": "org_3CIe2PY6G6xwnUu9TA0oopGUW9u",
    "userId": "user_3CIe11Gerd6NX6VxXLDlUVlEXlC",
    "userRoles": [
        "admin"
    ],
    "method": "GET",
    "path": "/v1/incidents",
    "status": 200,
    "duration": 12,
    "userAgent": "node",
    "ip": "52.14.104.113",
    "msg": "GET /v1/incidents 200 12ms"
}
</log>

### Comandos

#### Monitorar todas chamadas para o tenantId "org_3CIe2PY6G6xwnUu9TA0oopGUW9u" e acompanhá-las
aws logs tail /ecs/causeflow-staging --follow --filter-pattern '{ $.tenantId = "org_3CIe2PY6G6xwnUu9TA0oopGUW9u" }'
Para o Hindsight: aws logs tail /ecs/causeflow-staging-hindsight --follow

# Seguir logs de API em production
aws logs tail /ecs/causeflow-production-api --follow

# Só de worker
aws logs tail /ecs/causeflow-staging-worker --follow

# Filtrar por tenant
aws logs tail /ecs/causeflow-prod-api --follow \
--filter-pattern '{ $.tenantId = "tnt_xyz" }'

# Ver chamadas Anthropic lentas
aws logs filter-log-events --log-group-name /ecs/causeflow-prod-worker \
--filter-pattern '{ $.target = "anthropic" && $.durationMs > 3000 }'

X-Ray console — o que olhar:
- Service map: grafo de dependências. Nós vermelhos = erros. Arestas grossas = latência alta.
- Analytics: "quais endpoints têm p99 > 2s nas últimas 6h?"
- Trace list: filtra por error, responsetime > 5, annotation.tenantId = ....

# Limpar a memória do Hindsight
HINDSIGHT_BASE_URL=http://hindsight.causeflow-staging.local:8888 \
HINDSIGHT_API_KEY=causeflow-staging-hindsight \
node scripts/clean-hindsight-memories.mjs org_3CIe2PY6G6xwnUu9TA0oopGUW9u --clear