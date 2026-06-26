# Relay Agent: Arquitetura Enterprise para AI SRE

## Acesso Seguro a Recursos em Redes Privadas

---

## 1. Visão Geral

O Relay Agent é o componente que permite ao agente de AI SRE acessar recursos dentro da rede privada do cliente — bancos de dados, APIs internas, repositórios de código, filas, caches — sem que o cliente precise expor nada à internet pública.

### Princípios Fundamentais

**SOC-First:** Toda decisão arquitetural prioriza auditabilidade, controle e visibilidade para o time de segurança do cliente.

**DX-First:** A instalação deve levar menos de 10 minutos. Se leva mais, o design falhou.

**Zero Inbound:** O relay nunca recebe conexões. Toda comunicação é iniciada de dentro da rede do cliente para fora (outbound-only). Isso elimina a necessidade de abrir portas, criar regras de firewall inbound, ou expor endpoints.

**Zero Persistence:** Nenhum dado do cliente é armazenado em disco pelo relay. Tudo opera em memória e é descartado após o uso.

**Least Privilege:** O relay só acessa exatamente o que o cliente autoriza, com permissões granulares por recurso, operação e volume de dados.

---

## 2. Arquitetura

### 2.1 Visão de Alto Nível

```
┌──────────────────────────────────────────────────────────┐
│                  REDE DO CLIENTE (VPC / On-Prem)         │
│                                                          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│   │ MongoDB  │  │ Postgres │  │ APIs     │              │
│   │ Atlas    │  │          │  │ Internas │              │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│        │              │              │                    │
│        └──────────────┼──────────────┘                    │
│                       │                                   │
│              ┌────────▼────────┐                          │
│              │   RELAY AGENT   │                          │
│              │                 │                          │
│              │  ┌───────────┐  │                          │
│              │  │ Drivers   │  │                          │
│              │  │ ─ mongo   │  │                          │
│              │  │ ─ pg      │  │                          │
│              │  │ ─ http    │  │                          │
│              │  │ ─ redis   │  │                          │
│              │  └───────────┘  │                          │
│              │                 │                          │
│              │  ┌───────────┐  │                          │
│              │  │ Policy    │  │                          │
│              │  │ Engine    │  │                          │
│              │  └───────────┘  │                          │
│              │                 │                          │
│              │  ┌───────────┐  │                          │
│              │  │ Audit Log │  │                          │
│              │  └───────────┘  │                          │
│              └────────┬────────┘                          │
│                       │                                   │
│                outbound only (WSS/443)                    │
│                       │                                   │
└───────────────────────┼──────────────────────────────────┘
                        │
                        ▼
          ┌─────────────────────────────┐
          │       CONTROL PLANE         │
          │                             │
          │  ┌───────────────────────┐  │
          │  │  Command Dispatcher   │  │
          │  └───────────────────────┘  │
          │  ┌───────────────────────┐  │
          │  │  Query Validator      │  │
          │  └───────────────────────┘  │
          │  ┌───────────────────────┐  │
          │  │  Data Masking Engine  │  │
          │  └───────────────────────┘  │
          │  ┌───────────────────────┐  │
          │  │  AI SRE Agent         │  │
          │  └───────────────────────┘  │
          └─────────────────────────────┘
```

### 2.2 Fluxo de uma Query

```
AI Agent                Control Plane              Relay Agent              MongoDB
   │                         │                          │                      │
   │  "buscar últimos erros" │                          │                      │
   │────────────────────────►│                          │                      │
   │                         │                          │                      │
   │                         │  1. Valida query         │                      │
   │                         │  2. Checa policy         │                      │
   │                         │  3. Aplica limites       │                      │
   │                         │                          │                      │
   │                         │  comando sanitizado      │                      │
   │                         │─────────────────────────►│                      │
   │                         │                          │                      │
   │                         │                          │  db.errors.find()    │
   │                         │                          │─────────────────────►│
   │                         │                          │                      │
   │                         │                          │◄─────────────────────│
   │                         │                          │  resultados          │
   │                         │                          │                      │
   │                         │  resultados + audit log  │                      │
   │                         │◄─────────────────────────│                      │
   │                         │                          │                      │
   │                         │  4. Mascara PII          │                      │
   │                         │  5. Registra audit       │                      │
   │                         │                          │                      │
   │  dados mascarados       │                          │                      │
   │◄────────────────────────│                          │                      │
```

---

## 3. Instalação — Os 10 Minutos

### 3.1 Docker (caminho principal)

```bash
# 1. Baixar o arquivo de configuração
curl -sL https://relay.suaferramenta.com/init > relay-config.yaml

# 2. Editar a config (ou usar variáveis de ambiente)
# O arquivo já vem com exemplos comentados

# 3. Rodar
docker run -d \
  --name sre-relay \
  --restart unless-stopped \
  -e RELAY_TOKEN=<token-gerado-no-dashboard> \
  -e RELAY_CONFIG=/etc/relay/config.yaml \
  -v ./relay-config.yaml:/etc/relay/config.yaml:ro \
  --memory=512m \
  --cpus=0.5 \
  --read-only \
  --tmpfs /tmp:size=64m \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  suaferramenta/relay:latest
```

O token é gerado no dashboard da plataforma durante o onboarding. É um JWT de curta duração que o relay usa para se autenticar e trocar por credenciais rotacionadas automaticamente.

### 3.2 Kubernetes / Helm

```bash
helm repo add sre-relay https://charts.suaferramenta.com
helm install sre-relay sre-relay/relay \
  --set token=<token> \
  --set config.resources.mongo.uri="mongodb://cluster:27017" \
  --set config.resources.mongo.databases="{appdb,logsdb}" \
  --namespace sre-relay \
  --create-namespace
```

### 3.3 Terraform (AWS)

```hcl
module "sre_relay" {
  source  = "suaferramenta/relay/aws"
  version = "~> 1.0"

  relay_token     = var.relay_token
  vpc_id          = var.vpc_id
  subnet_ids      = var.private_subnet_ids

  resources = {
    mongo = {
      uri       = "mongodb://cluster.internal:27017"
      databases = ["appdb", "logsdb"]
    }
    dynamodb = {
      tables = ["orders", "events"]
      region = "us-east-1"
    }
  }
}
```

O módulo Terraform cria um ECS Fargate task (ou Lambda, configurável) em subnets privadas, com security group que permite apenas saída HTTPS/443 para o control plane.

### 3.4 Um-Clique via Dashboard

Para clientes que preferem não tocar em CLI, o dashboard oferece um wizard:

1. Selecionar ambiente (Docker / K8s / AWS / Azure / GCP)
2. Selecionar recursos a conectar (MongoDB, PostgreSQL, etc.)
3. Copiar o comando gerado (ou baixar o Terraform/Helm)
4. Colar no terminal
5. Verificar conexão no dashboard (status fica verde em segundos)

---

## 4. Configuração de Recursos

### 4.1 Arquivo de Configuração

```yaml
# relay-config.yaml
version: '1'

# Identificação
relay_id: 'prod-us-east-relay-01'
control_plane: 'wss://relay.suaferramenta.com/v1/connect'

# Recursos que o relay pode acessar
resources:
  # MongoDB
  - type: mongodb
    id: 'mongo-main'
    connection_string: '${MONGO_URI}' # variável de ambiente
    allowed_databases:
      - name: 'appdb'
        allowed_collections: ['users', 'orders', 'events', 'errors']
        allowed_operations: ['find', 'aggregate', 'count']
        max_documents_per_query: 500
      - name: 'logsdb'
        allowed_collections: ['*'] # todas as collections
        allowed_operations: ['find']
        max_documents_per_query: 1000

  # PostgreSQL
  - type: postgresql
    id: 'pg-analytics'
    connection_string: '${PG_URI}'
    allowed_schemas:
      - name: 'public'
        allowed_tables: ['metrics', 'incidents', 'deployments']
        allowed_operations: ['SELECT'] # nunca UPDATE/DELETE
        max_rows_per_query: 1000
        query_timeout_seconds: 30

  # Redis
  - type: redis
    id: 'redis-cache'
    connection_string: '${REDIS_URI}'
    allowed_operations: ['GET', 'MGET', 'HGETALL', 'KEYS', 'TTL', 'INFO']
    # Sem SET, DEL, FLUSHDB — read-only

  # API HTTP interna
  - type: http
    id: 'internal-api'
    base_url: 'https://api.internal.empresa.com'
    allowed_endpoints:
      - path: '/v1/customers/*'
        methods: ['GET']
      - path: '/v1/orders/*'
        methods: ['GET']
      - path: '/health'
        methods: ['GET']
    headers:
      Authorization: 'Bearer ${INTERNAL_API_TOKEN}'

# Mascaramento de dados (local, antes de enviar ao control plane)
data_masking:
  enabled: true
  patterns:
    - name: 'cpf'
      regex: '\d{3}\.\d{3}\.\d{3}-\d{2}'
      replacement: '***CPF***'
    - name: 'email'
      regex: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
      replacement: '***EMAIL***'
    - name: 'credit_card'
      regex: '\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b'
      replacement: '***CARD***'
    - name: 'bearer_token'
      regex: 'Bearer\s+[A-Za-z0-9\-._~+/]+=*'
      replacement: '***TOKEN***'

# Audit
audit:
  local_log: '/var/log/relay/audit.json' # log local para o SOC do cliente
  forward_to_siem: true # envia para o SIEM do cliente
  siem_endpoint: '${SIEM_WEBHOOK_URL}'
  include_query: true # logar a query executada
  include_result_summary: true # logar contagem de resultados (não os dados)
  include_result_data: false # NUNCA logar dados retornados

# Limites globais
limits:
  max_concurrent_queries: 10
  max_query_rate_per_minute: 60
  max_result_size_bytes: 5242880 # 5MB
  query_timeout_seconds: 30
```

### 4.2 Variáveis de Ambiente

Segredos nunca ficam no arquivo YAML. Tudo via variáveis de ambiente ou integração com secret managers:

```bash
# Direto
export MONGO_URI="mongodb://user:pass@cluster:27017"
export RELAY_TOKEN="eyJhbG..."

# Via AWS Secrets Manager (suportado nativamente)
RELAY_SECRETS_PROVIDER=aws-secrets-manager
RELAY_SECRETS_ARN=arn:aws:secretsmanager:us-east-1:123456:secret:sre-relay

# Via HashiCorp Vault
RELAY_SECRETS_PROVIDER=vault
RELAY_VAULT_ADDR=https://vault.internal:8200
RELAY_VAULT_PATH=secret/data/sre-relay
```

---

## 5. Segurança — SOC-First em Detalhe

### 5.1 Modelo de Ameaças e Mitigações

| Ameaça                                              | Mitigação                                                              |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| Control plane comprometido envia queries maliciosas | Policy engine local no relay valida contra allowlist antes de executar |
| Exfiltração de dados via resultados de query        | Limites de volume, mascaramento local, audit log                       |
| Man-in-the-middle na conexão relay ↔ control plane  | mTLS com certificate pinning                                           |
| Relay token roubado                                 | Tokens de curta duração com rotação automática, bound ao IP/ambiente   |
| Movimentação lateral a partir do container          | Container read-only, sem capabilities, sem rede exceto egress 443      |
| Insider na plataforma SRE acessa dados              | Mascaramento antes de sair do relay, audit trail imutável              |

### 5.2 Autenticação e Comunicação

```
┌─────────────────────────────────────────────────────────────┐
│                    BOOTSTRAP (primeira vez)                  │
│                                                             │
│  1. Cliente gera token no dashboard                         │
│  2. Relay inicia com token                                  │
│  3. Relay envia token + fingerprint do ambiente             │
│  4. Control plane valida e emite:                           │
│     ─ Client certificate (mTLS)                             │
│     ─ Relay ID permanente                                   │
│     ─ Primeiro refresh token                                │
│  5. Token inicial é invalidado (uso único)                  │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                    OPERAÇÃO CONTÍNUA                         │
│                                                             │
│  ─ mTLS com certificate pinning em toda comunicação         │
│  ─ Certificates rotacionados automaticamente (24h)          │
│  ─ Heartbeat a cada 30s (detecta relay offline)             │
│  ─ Se o relay não faz heartbeat por 5min, alerta no SOC     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Policy Engine Local

O relay tem um policy engine embarcado que atua como última linha de defesa. Mesmo que o control plane envie um comando, o relay só executa se a policy local permitir.

```
Comando recebido do Control Plane
         │
         ▼
┌──────────────────┐
│  É um recurso    │── NÃO ──► REJEITAR + alertar
│  configurado?    │
└────────┬─────────┘
         │ SIM
         ▼
┌──────────────────┐
│  Operação está   │── NÃO ──► REJEITAR + alertar
│  na allowlist?   │
└────────┬─────────┘
         │ SIM
         ▼
┌──────────────────┐
│  Dentro dos      │── NÃO ──► REJEITAR + alertar
│  limites?        │
│  (rows, timeout) │
└────────┬─────────┘
         │ SIM
         ▼
┌──────────────────┐
│  Query parsing   │── FAIL ─► REJEITAR + alertar
│  (sem DROP,      │
│   DELETE, UPDATE) │
└────────┬─────────┘
         │ PASS
         ▼
     EXECUTAR
         │
         ▼
┌──────────────────┐
│  Mascarar PII    │
│  nos resultados  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Registrar audit │
│  log local       │
└────────┬─────────┘
         │
         ▼
   ENVIAR RESULTADO
```

### 5.4 Audit Log

Cada operação gera um registro de audit imutável, armazenado localmente e opcionalmente enviado ao SIEM do cliente.

```json
{
  "timestamp": "2025-02-18T14:32:01.442Z",
  "relay_id": "prod-us-east-relay-01",
  "request_id": "req_8f3a2b1c",
  "source": {
    "incident_id": "INC-4521",
    "ticket_id": "JIRA-1234",
    "agent_session": "sess_abc123",
    "triggered_by": "ai-agent"
  },
  "resource": {
    "type": "mongodb",
    "id": "mongo-main",
    "database": "appdb",
    "collection": "orders"
  },
  "operation": {
    "type": "find",
    "filter": { "status": "error", "created_at": { "$gte": "2025-02-18T00:00:00Z" } },
    "limit": 100,
    "projection": { "customer_email": 0, "payment_info": 0 }
  },
  "result": {
    "status": "success",
    "document_count": 47,
    "bytes_returned": 23401,
    "execution_time_ms": 142,
    "data_masked": true,
    "masked_fields_count": 12
  },
  "policy": {
    "matched_rule": "allow-orders-read",
    "checks_passed": ["resource_allowed", "operation_allowed", "limit_ok", "query_safe"]
  }
}
```

O cliente tem visibilidade total. O SOC pode responder: "quem acessou o quê, quando, por quê, e o que viu."

### 5.5 Data Masking

O mascaramento acontece **dentro do relay, antes dos dados saírem da rede do cliente**. Isso é crítico: o control plane e o agente de AI nunca veem dados sensíveis em texto claro.

```
Dados brutos do banco
  │
  │  {"email": "joao@empresa.com", "cpf": "123.456.789-00", "erro": "timeout"}
  │
  ▼
Masking Engine (local no relay)
  │
  │  {"email": "***EMAIL***", "cpf": "***CPF***", "erro": "timeout"}
  │
  ▼
Enviado ao Control Plane (dados mascarados)
```

Campos sensíveis configuráveis pelo cliente. Padrões pré-definidos para PII comum (CPF, email, cartão, tokens). O cliente pode adicionar patterns customizados específicos do negócio.

### 5.6 Segurança do Container

```yaml
# O container roda com mínimo privilégio possível
security:
  read_only_rootfs: true # filesystem read-only
  no_new_privileges: true # sem escalação
  cap_drop: ALL # sem capabilities Linux
  run_as_non_root: true # nunca root
  run_as_user: 10001 # UID fixo, sem privilégios
  memory_limit: '512Mi' # previne memory abuse
  cpu_limit: '500m' # previne CPU abuse
  tmpfs: '/tmp:size=64m' # único dir gravável, em memória
  network:
    egress_only: true # sem inbound
    allowed_destinations:
      - 'relay.suaferramenta.com:443' # control plane
      - '*.internal:*' # recursos internos
```

---

## 6. Drivers de Recursos

O relay é extensível via drivers. Cada driver implementa uma interface padronizada.

### 6.1 Interface do Driver

```
┌─────────────────────────────────┐
│          Driver Interface       │
├─────────────────────────────────┤
│  validate(command) → bool       │  Valida se o comando é seguro
│  execute(command)  → result     │  Executa e retorna resultado
│  health_check()    → status     │  Verifica conectividade
│  capabilities()    → list       │  Lista operações suportadas
└─────────────────────────────────┘
```

### 6.2 Drivers Disponíveis

| Driver          | Recursos                       | Operações Suportadas                              |
| --------------- | ------------------------------ | ------------------------------------------------- |
| `mongodb`       | MongoDB, DocumentDB            | find, aggregate, count, listCollections           |
| `postgresql`    | PostgreSQL, Aurora PG, RDS PG  | SELECT (parse + block DDL/DML)                    |
| `mysql`         | MySQL, Aurora MySQL, RDS MySQL | SELECT (parse + block DDL/DML)                    |
| `dynamodb`      | DynamoDB                       | GetItem, Query, Scan (com limites), DescribeTable |
| `redis`         | Redis, ElastiCache, MemoryDB   | GET, MGET, HGETALL, KEYS, INFO (sem write)        |
| `elasticsearch` | Elasticsearch, OpenSearch      | \_search, \_cat, \_cluster/health                 |
| `http`          | Qualquer API REST interna      | GET (configurável por endpoint)                   |
| `grpc`          | Serviços gRPC internos         | Métodos configuráveis (read-only)                 |

### 6.3 SQL Query Safety

Para drivers SQL, o relay faz parse da query antes de executar:

```
Query recebida: "SELECT name, status FROM orders WHERE created > '2025-01-01'"
                     │
                     ▼
              ┌──────────────┐
              │  SQL Parser   │
              └──────┬───────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐ ┌──────────┐ ┌──────────┐
   │ Tipo:   │ │ Tabelas: │ │ Funções: │
   │ SELECT ✓│ │ orders ✓ │ │ nenhuma ✓│
   │ (não    │ │ (na      │ │ (sem     │
   │  DROP)  │ │  allow)  │ │  SLEEP)  │
   └─────────┘ └──────────┘ └──────────┘
                     │
                     ▼
              Query APROVADA
```

Queries com `DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `GRANT`, subqueries não-autorizadas, `SLEEP()`, `BENCHMARK()`, ou union-based injection patterns são rejeitadas.

---

## 7. Observabilidade

### 7.1 Health Dashboard

O relay expõe métricas para o dashboard da plataforma e para o monitoramento do cliente.

```
┌─────────────────────────────────────────────────────────┐
│  RELAY STATUS: prod-us-east-relay-01                    │
│  ═══════════════════════════════════════                 │
│                                                         │
│  Status:     ● Online (connected 4d 12h)                │
│  Version:    2.3.1 (latest ✓)                           │
│  Uptime:     99.98% (30d)                               │
│                                                         │
│  RESOURCES                                              │
│  ├── mongo-main        ● Healthy    latency: 12ms       │
│  ├── pg-analytics      ● Healthy    latency: 8ms        │
│  ├── redis-cache       ● Healthy    latency: 2ms        │
│  └── internal-api      ● Degraded   latency: 450ms      │
│                                                         │
│  LAST 24H                                               │
│  ├── Queries executed:     1,247                        │
│  ├── Queries blocked:      3 (policy violation)         │
│  ├── Avg response time:    89ms                         │
│  ├── Data masked:          847 fields                   │
│  └── Errors:               2 (timeout)                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Métricas Exportadas

O relay exporta métricas em formato Prometheus/OpenTelemetry para integração com o stack de observabilidade do cliente:

```
# Métricas chave
relay_connection_status          # 1 = connected, 0 = disconnected
relay_queries_total              # counter por resource, operation, status
relay_query_duration_seconds     # histogram de latência
relay_data_masked_fields_total   # counter de campos mascarados
relay_policy_violations_total    # counter de queries bloqueadas
relay_resource_health            # gauge por recurso (1 = healthy)
```

### 7.3 Alertas Integrados

O relay gera alertas automaticamente para condições críticas:

| Condição                    | Severidade | Destino                                  |
| --------------------------- | ---------- | ---------------------------------------- |
| Relay offline > 5 min       | Critical   | SOC do cliente + dashboard da plataforma |
| Recurso inacessível > 2 min | High       | Dashboard da plataforma                  |
| Policy violation detectada  | Medium     | Audit log + SIEM do cliente              |
| Certificate expira em < 12h | High       | Dashboard + notificação ao admin         |
| Queries bloqueadas > 10/min | High       | SOC do cliente                           |
| Latência de recurso > 5s    | Medium     | Dashboard da plataforma                  |

---

## 8. Onboarding do Cliente — Passo a Passo

### Visão Resumida

```
Tempo total estimado: 5–10 minutos

  Minuto 0─2    │  Gerar token no dashboard
  Minuto 2─4    │  Rodar o container / aplicar Helm chart
  Minuto 4─6    │  Configurar recursos (databases, APIs)
  Minuto 6─8    │  Verificar conexão no dashboard
  Minuto 8─10   │  Testar uma query de exemplo pelo agente
```

### Passo 1 — Dashboard

O admin do cliente acessa o dashboard da plataforma SRE, navega até "Connections" e clica em "Add Relay". Seleciona o ambiente e os recursos. O dashboard gera o token e o comando de instalação personalizado.

### Passo 2 — Deploy

O admin copia o comando e executa no ambiente. O relay sobe, conecta ao control plane, e aparece como "Online" no dashboard em segundos.

### Passo 3 — Configurar Permissões

No dashboard ou no YAML, o admin define quais databases, tabelas e operações o agente pode acessar. Padrões seguros pré-configurados (read-only, com limites) servem como ponto de partida.

### Passo 4 — Validar

O dashboard oferece um botão "Test Connection" que executa um health check em cada recurso configurado. O admin também pode executar uma query de teste para ver o fluxo completo — incluindo mascaramento e audit log.

### Passo 5 — Produção

O relay está operacional. O agente de AI SRE pode agora investigar incidentes acessando os recursos configurados, com total visibilidade e controle pelo SOC do cliente.

---

## 9. Atualização e Manutenção

### 9.1 Auto-Update

```yaml
# Configurável pelo cliente
update:
  auto_update: true # default: true
  update_window: '02:00-04:00 UTC' # janela de manutenção
  update_strategy: 'rolling' # rolling | manual
  rollback_on_failure: true # volta versão anterior se health check falhar
  notify_before_update: true # avisa admin antes de atualizar
```

O relay verifica versões a cada heartbeat. Quando há atualização, baixa a nova versão, valida o checksum/assinatura, aplica na janela configurada, e faz rollback automático se o health check falhar pós-update.

### 9.2 Backward Compatibility

O protocolo relay ↔ control plane é versionado. O control plane suporta relays até 2 versões major anteriores. Isso permite que clientes atualizem no seu ritmo sem quebrar a integração.

---

## 10. Compliance e Certificações

O design do relay foi pensado para facilitar conformidade com:

| Framework     | Como o Relay Endereça                                                        |
| ------------- | ---------------------------------------------------------------------------- |
| SOC 2 Type II | Audit logs imutáveis, controle de acesso granular, criptografia em trânsito  |
| GDPR / LGPD   | Data masking local, zero persistence, dados nunca saem mascarados            |
| HIPAA         | Acesso mínimo necessário, logs de acesso, criptografia end-to-end            |
| ISO 27001     | Política de acesso documentada, monitoramento contínuo, gestão de incidentes |
| PCI DSS       | Dados de cartão mascarados antes de sair da rede, sem armazenamento          |

---

## 11. FAQ de Segurança

**"E se o control plane for comprometido?"**
O relay tem policy engine local. Mesmo que um atacante envie queries pelo control plane, o relay só executa o que está na allowlist configurada pelo cliente. Queries fora da policy são rejeitadas e geram alerta.

**"Os dados do meu banco passam pela infraestrutura da plataforma?"**
Os resultados das queries trafegam criptografados (mTLS) pelo control plane para chegar ao agente. Porém, dados sensíveis são mascarados pelo relay ANTES de sair da sua rede. O control plane vê apenas dados mascarados. Nenhum dado é persistido — é processado em memória e descartado.

**"Posso auditar tudo que o relay faz?"**
Sim. Todo comando recebido e executado é logado localmente no relay (acessível pelo seu SOC) e opcionalmente enviado ao seu SIEM. O log inclui o que foi pedido, o que foi executado, quantos resultados retornou, e o contexto (qual incidente/ticket motivou a query).

**"Como revogar o acesso?"**
Três opções imediatas: (1) parar o container do relay, (2) revogar o token no dashboard, ou (3) remover recursos da configuração. Qualquer uma dessas ações corta o acesso instantaneamente.

**"O relay pode escrever nos meus bancos?"**
Não, por design. Todos os drivers operam em modo read-only. Operações de escrita (INSERT, UPDATE, DELETE) não estão implementadas nos drivers e são bloqueadas pelo policy engine mesmo que alguém tente injetá-las.
