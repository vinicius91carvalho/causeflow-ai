import { useState } from "react";

const tabs = [
  { id: "adr010", label: "ADR-010: Agent Relay", icon: "🔌" },
  { id: "relay-arch", label: "Arquitetura Relay", icon: "🏗️" },
  { id: "sentry", label: "Sentry Parser", icon: "🐛" },
  { id: "consul", label: "Consul Integration", icon: "🗺️" },
  { id: "customers", label: "Deploy Clientes", icon: "🎯" },
  { id: "roadmap", label: "Impacto Roadmap", icon: "📅" },
];

const Badge = ({ children, color = "gray" }) => {
  const c = { green: "bg-green-100 text-green-800", red: "bg-red-100 text-red-800", amber: "bg-amber-100 text-amber-800", blue: "bg-blue-100 text-blue-800", purple: "bg-purple-100 text-purple-800", gray: "bg-gray-100 text-gray-800" };
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${c[color]}`}>{children}</span>;
};
const Code = ({ children, title }) => (
  <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs overflow-x-auto leading-relaxed">
    {title && <div className="text-gray-500 mb-2">// {title}</div>}
    <pre>{children}</pre>
  </div>
);
const Alert = ({ type = "info", children }) => {
  const s = { info: "bg-blue-50 border-blue-200 text-blue-800", warning: "bg-amber-50 border-amber-200 text-amber-800", error: "bg-red-50 border-red-200 text-red-800", success: "bg-green-50 border-green-200 text-green-800" };
  return <div className={`border rounded-lg p-4 text-sm ${s[type]}`}>{children}</div>;
};

const sections = {
  "adr010": () => (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-purple-700 to-blue-700 text-white rounded-lg p-5">
        <div className="flex items-center gap-2 mb-1">
          <Badge color="purple">ADR-010</Badge>
          <span className="text-xs text-purple-200">Aceito — Fev 2026</span>
        </div>
        <h3 className="text-xl font-bold">Agent Relay: Connectivity Model for Private Networks</h3>
        <p className="text-blue-200 text-sm mt-1">Como acessar recursos de clientes dentro de VPCs (AWS) e VPNs (Azure) sem exigir exposição à internet.</p>
      </div>

      <Alert type="error">
        <strong>Problema:</strong> Ambos os clientes iniciais têm recursos em redes privadas. 
        Cliente 1: AWS VPC com Sentry self-hosted. 
        Cliente 2: Azure VPN com Grafana + Consul internos. 
        Nosso backend SaaS não alcança esses recursos diretamente.
      </Alert>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Opções Avaliadas</h4>
        <div className="space-y-3">
          {[
            {
              opt: "A", title: "Agent Relay (container leve na rede do cliente)",
              desc: "Container Docker rodando na VPC/VPN do cliente. Conecta outbound (HTTPS/WSS) ao nosso backend. Faz proxy de queries para recursos internos (Sentry, Grafana, Consul, APIs internas). Toda inteligência fica no nosso lado — relay é stateless.",
              pros: ["Setup simples: docker run com env vars", "Outbound-only: não precisa abrir portas no firewall do cliente", "Padrão de mercado: Datadog Agent, Grafana Agent, Sentry Relay", "Stateless: pode escalar ou reiniciar sem perda de estado", "Cliente controla exatamente o que o relay pode acessar"],
              cons: ["Requer que cliente rode um container (overhead mínimo)", "Latência adicional de ~5-15ms por hop"],
              status: "accepted"
            },
            {
              opt: "B", title: "AWS PrivateLink / Azure Private Link",
              desc: "Conectividade de rede L3 entre nosso VPC e o do cliente via endpoint privado.",
              pros: ["Latência mínima", "Sem componente no lado do cliente"],
              cons: ["Caro ($7-10/endpoint/mês por AZ)", "Complexo: requires cross-account VPC config", "Diferente por cloud provider", "Não funciona cross-cloud (AWS↔Azure)"],
              status: "rejected"
            },
            {
              opt: "C", title: "Full deploy na rede do cliente (on-prem)",
              desc: "Deploy completo do nosso stack dentro da infra do cliente.",
              pros: ["Zero preocupação com conectividade", "Dados nunca saem da rede do cliente"],
              cons: ["Pesadelo operacional: N deploys para manter", "Perde economia de escala do SaaS", "Impossível de suportar com equipe pequena", "Update complexo: precisa coordenar com cada cliente"],
              status: "rejected"
            },
          ].map((o) => (
            <div key={o.opt} className={`border rounded-lg p-4 ${o.status === "accepted" ? "border-green-300 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
              <div className="flex items-center gap-2 mb-2">
                <Badge color={o.status === "accepted" ? "green" : "red"}>
                  Opção {o.opt}: {o.status === "accepted" ? "ACEITA" : "REJEITADA"}
                </Badge>
                <span className="font-bold text-gray-900 text-sm">{o.title}</span>
              </div>
              <p className="text-xs text-gray-600 mb-2">{o.desc}</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="font-bold text-green-700 mb-1">Prós:</p>
                  {o.pros.map((p, i) => <p key={i} className="text-green-600">+ {p}</p>)}
                </div>
                <div>
                  <p className="font-bold text-red-700 mb-1">Contras:</p>
                  {o.cons.map((c, i) => <p key={i} className="text-red-600">- {c}</p>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Alert type="success">
        <strong>Decisão:</strong> Opção A — Agent Relay. Container leve, outbound-only, stateless, padrão de mercado. 
        O relay é um componente open-source que o cliente pode inspecionar. 
        Toda lógica de investigação, AI, e orquestração fica no nosso SaaS.
      </Alert>
    </div>
  ),

  "relay-arch": () => (
    <div className="space-y-5">
      <h3 className="text-xl font-bold text-gray-900">Agent Relay — Arquitetura Detalhada</h3>

      <Code title="Topologia de Rede">{`
┌──────────────────────────────────────────────────┐
│                NOSSO SaaS (sa-east-1)            │
│                                                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Backend  │  │ Relay     │  │ Investigation│  │
│  │ API      │◄─┤ Gateway   │◄─┤ Orchestrator │  │
│  │ (Hono)   │  │ (WSS mgr) │  │ (Agent SDK)  │  │
│  └──────────┘  └─────▲─────┘  └──────────────┘  │
│                      │                           │
└──────────────────────┼───────────────────────────┘
                       │ WSS outbound (port 443)
                       │ TLS 1.3 + mTLS (relay cert)
          ─────────────┼──────────── INTERNET
                       │
┌──────────────────────┼───────────────────────────┐
│  REDE DO CLIENTE     │  (VPC / VPN / on-prem)    │
│                      │                           │
│  ┌───────────────────┴─────────────────────────┐ │
│  │          AGENT RELAY (Docker container)      │ │
│  │                                             │ │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────────┐ │ │
│  │  │ WSS     │ │ Request  │ │ Health       │ │ │
│  │  │ Client  │ │ Router   │ │ Reporter     │ │ │
│  │  └────┬────┘ └────┬─────┘ └──────┬───────┘ │ │
│  │       │           │              │          │ │
│  └───────┼───────────┼──────────────┼──────────┘ │
│          │           │              │            │
│  ┌───────▼──┐ ┌──────▼─────┐ ┌─────▼────────┐  │
│  │ Sentry   │ │ Grafana    │ │ Consul       │  │
│  │ (API)    │ │ (HTTP API) │ │ (HTTP API)   │  │
│  └──────────┘ └────────────┘ └──────────────┘  │
│  ┌──────────┐ ┌────────────┐ ┌──────────────┐  │
│  │CloudWatch│ │ Azure Mon. │ │ Custom APIs  │  │
│  └──────────┘ └────────────┘ └──────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘`}</Code>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Agent Relay — Componentes</h4>
        <Code title="relay/src/main.ts (componente open-source)">{`// Agent Relay — container leve (~50MB image)
// Responsabilidades:
// 1. Conectar outbound ao nosso backend via WebSocket Secure
// 2. Receber requests do backend (queries para recursos internos)
// 3. Executar requests na rede local e retornar resultados
// 4. Reportar health status dos endpoints configurados

interface RelayConfig {
  // Conexão com nosso backend
  backendUrl: string;          // wss://relay.ai-sre.com.br
  tenantId: string;            // Identificador do tenant
  relayToken: string;          // Token de autenticação (rotacionado)

  // Endpoints internos que o relay pode acessar
  endpoints: EndpointConfig[];
  
  // Segurança
  allowedPaths: string[];      // Whitelist de paths permitidos
  maxRequestsPerMinute: number; // Rate limiting local
  tlsCaCert?: string;          // CA customizada para endpoints internos
}

interface EndpointConfig {
  name: string;                // "sentry", "grafana", "consul"
  type: "sentry" | "grafana" | "consul" | "prometheus" | "custom";
  baseUrl: string;             // http://sentry.internal:9000
  auth?: {                     // Credenciais para o endpoint local
    type: "bearer" | "basic" | "header";
    token?: string;            // Armazenado localmente, NUNCA enviado ao backend
  };
  healthCheck: string;         // /api/0/health/ (path para health check)
}

// Fluxo:
// 1. Relay conecta ao backend via WSS (outbound-only)
// 2. Backend envia: { type: "query", endpoint: "sentry", 
//                      path: "/api/0/issues/", params: {...} }
// 3. Relay faz request local: GET http://sentry.internal:9000/api/0/issues/
// 4. Relay retorna resultado via WSS ao backend
// 5. Backend processa com AI (relay nunca vê prompts ou resultados AI)`}</Code>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Protocolo de Comunicação</h4>
        <Code title="relay/src/protocol.ts">{`// Mensagens Backend → Relay
type BackendMessage =
  | { type: "query"; id: string; endpoint: string; 
      method: "GET"|"POST"; path: string; 
      params?: Record<string,string>; body?: unknown; }
  | { type: "health_check"; }
  | { type: "config_update"; endpoints: EndpointConfig[]; }

// Mensagens Relay → Backend  
type RelayMessage =
  | { type: "query_result"; id: string; status: number;
      data: unknown; durationMs: number; }
  | { type: "query_error"; id: string; error: string; 
      status?: number; }
  | { type: "health_report"; endpoints: EndpointHealth[]; 
      relay: { uptime: number; memory: number; cpu: number; }; }
  | { type: "connected"; version: string; 
      capabilities: string[]; }

// Segurança do protocolo:
// - WSS com TLS 1.3 (outbound do relay, port 443)
// - mTLS opcional: relay certificate para autenticação bidirecional
// - Relay token rotacionado a cada 24h via backend
// - Cada query tem ID único para correlation
// - Timeout por query: 30s (configurable)
// - Rate limit: 100 req/min no relay (proteção contra abuse)
// - NUNCA envia credenciais locais ao backend
//   (auth com endpoints internos resolve localmente)`}</Code>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Setup do Cliente (1 comando)</h4>
        <Code title="docker-compose.yml (na infra do cliente)">{`# Cliente roda isso na VPC/VPN
version: "3.8"
services:
  sre-relay:
    image: ghcr.io/ai-sre-br/agent-relay:latest
    restart: always
    environment:
      RELAY_BACKEND_URL: wss://relay.ai-sre.com.br
      RELAY_TENANT_ID: \${TENANT_ID}
      RELAY_TOKEN: \${RELAY_TOKEN}       # Gerado no onboarding
    # Endpoints internos (configurados via env ou config file)
      RELAY_ENDPOINTS: |
        [
          {
            "name": "sentry",
            "type": "sentry",
            "baseUrl": "http://sentry.internal:9000",
            "auth": { "type": "bearer", "token": "\${SENTRY_TOKEN}" },
            "healthCheck": "/api/0/relay/healthcheck/"
          },
          {
            "name": "grafana",
            "type": "grafana",
            "baseUrl": "http://grafana.internal:3000",
            "auth": { "type": "bearer", "token": "\${GRAFANA_TOKEN}" },
            "healthCheck": "/api/health"
          },
          {
            "name": "consul",
            "type": "consul",
            "baseUrl": "http://consul.internal:8500",
            "healthCheck": "/v1/status/leader"
          }
        ]
    # Segurança: sem portas expostas, outbound-only
    # Sem volumes sensíveis montados
    # Read-only filesystem
    read_only: true
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          memory: 128M     # Ultra leve
          cpus: "0.25"
    # Health check local
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 5s`}</Code>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { title: "Segurança", color: "border-red-300", items: [
            "Outbound-only (443): zero portas abertas no firewall",
            "mTLS opcional para relay authentication",
            "Token rotacionado a cada 24h",
            "Credenciais locais NUNCA saem do relay",
            "Read-only filesystem + no-new-privileges",
            "Whitelist de paths: cliente controla o que relay acessa",
            "Rate limit local: proteção contra abuse"
          ]},
          { title: "Operação", color: "border-blue-300", items: [
            "Auto-reconnect com exponential backoff",
            "Health report a cada 60s ao backend",
            "Auto-update via Watchtower ou similar",
            "Logs estruturados (JSON) para debugging",
            "Métricas: requests/sec, latência, erros",
            "128MB RAM / 0.25 vCPU (ultra leve)",
            "Image ~50MB (distroless base)"
          ]},
          { title: "Backend (Relay Gateway)", color: "border-green-300", items: [
            "WebSocket manager: pool de conexões por tenant",
            "Request routing: backend envia query → relay executa",
            "Timeout handling: 30s max por query",
            "Fallback: se relay offline, tenta API pública se disponível",
            "Metrics: relay latência, uptime, error rate",
            "Multi-relay: cliente pode rodar N relays (HA)",
            "Buffering: se relay reconecta, replay pendentes"
          ]},
        ].map((col, i) => (
          <div key={i} className={`bg-white border-2 ${col.color} rounded-lg p-4`}>
            <h5 className="font-bold text-gray-900 text-sm mb-2">{col.title}</h5>
            {col.items.map((item, j) => <p key={j} className="text-xs text-gray-600 mb-1">• {item}</p>)}
          </div>
        ))}
      </div>

      <Alert type="info">
        <strong>Backend Integration:</strong> O Relay Gateway é um novo componente no nosso backend 
        (src/infra/relay/). O Provider Registry (ADR-009) resolve automaticamente: se tenant tem relay 
        ativo, queries passam pelo relay. Se não, usa APIs públicas diretamente. 
        O core domain não sabe se está falando via relay ou API direta — Port &amp; Adapter abstrai isso.
      </Alert>
    </div>
  ),

  "sentry": () => (
    <div className="space-y-5">
      <h3 className="text-xl font-bold text-gray-900">Sentry Integration — Parser + Sub-Agent</h3>
      <Alert type="warning">
        <strong>Cliente 1:</strong> Sentry self-hosted dentro de VPC (AWS). Alertas via Sentry webhook → relay → nosso backend. 
        Investigação acessa issues, events, e breadcrumbs via relay.
      </Alert>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Sentry como Alert Source</h4>
        <Code title="src/modules/ingestion/parsers/sentry-parser.ts">{`// Sentry envia webhooks para alertas (Issue Alerts e Metric Alerts)
// Pode vir via relay (self-hosted) ou diretamente (SaaS sentry.io)

interface SentryWebhookPayload {
  action: "created" | "resolved" | "regression";
  data: {
    issue: {
      id: string;
      title: string;           // "TypeError: Cannot read property 'x' of undefined"
      culprit: string;         // "app/api/checkout.handler"  
      level: "fatal"|"error"|"warning"|"info";
      firstSeen: string;
      lastSeen: string;
      count: number;           // Quantidade de eventos
      metadata: {
        type: string;          // Exception type
        value: string;         // Exception message
        filename: string;      // Arquivo de origem
        function: string;      // Função de origem
      };
      project: { slug: string; name: string; };
    };
    event?: {                  // Evento mais recente
      event_id: string;
      contexts: {              // Runtime, OS, browser, device
        runtime?: { name: string; version: string; };
        os?: { name: string; version: string; };
      };
      tags: Array<{ key: string; value: string; }>;
      breadcrumbs?: Array<{    // Trail de ações antes do erro
        category: string;
        message: string;
        timestamp: number;
        level: string;
        data?: Record<string, unknown>;
      }>;
      exception?: {
        values: Array<{
          type: string;
          value: string;
          stacktrace: {
            frames: Array<{
              filename: string;
              function: string;
              lineno: number;
              context_line: string;
              pre_context: string[];
              post_context: string[];
            }>;
          };
        }>;
      };
    };
  };
}

// Normalização para nosso formato interno
function parseSentryAlert(payload: SentryWebhookPayload): NormalizedAlert {
  const issue = payload.data.issue;
  return {
    source: "sentry",
    externalId: issue.id,
    title: issue.title,
    severity: mapSentrySeverity(issue.level),
    // fatal → P1, error (count > 100) → P2, error → P3, warning → P4
    service: extractServiceFromCulprit(issue.culprit),
    timestamp: new Date(issue.lastSeen),
    rawPayload: payload,
    metadata: {
      exceptionType: issue.metadata.type,
      filename: issue.metadata.filename,
      function: issue.metadata.function,
      eventCount: issue.count,
      firstSeen: issue.firstSeen,
      hasBreadcrumbs: !!payload.data.event?.breadcrumbs?.length,
      hasStacktrace: !!payload.data.event?.exception?.values?.length,
    },
  };
}

function mapSentrySeverity(level: string): "P1"|"P2"|"P3"|"P4" {
  switch (level) {
    case "fatal": return "P1";
    case "error": return "P3";  // Upgraded pelo triage agent se count alto
    case "warning": return "P4";
    default: return "P4";
  }
}`}</Code>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Sentry como Investigation Source (via Relay)</h4>
        <Code title="src/infra/sentry/sentry-client.ts">{`// Durante investigação, sub-agentes consultam Sentry para:
// 1. Detalhes do issue (stack trace completo, breadcrumbs)
// 2. Issues relacionados no mesmo projeto
// 3. Histórico de releases associadas
// 4. Tags e contexto do evento

class SentryClient implements AlertSourceClient {
  // Rota via relay se self-hosted, ou API direta se SaaS
  constructor(
    private relay: RelayClient | null,
    private apiToken: string | null,
    private baseUrl: string,
  ) {}

  private async request(path: string, params?: Record<string,string>) {
    if (this.relay) {
      // Via relay: backend envia query, relay executa localmente
      return this.relay.query("sentry", "GET", path, params);
    }
    // Direto: para Sentry SaaS (sentry.io)
    return fetch(this.baseUrl + path, {
      headers: { Authorization: "Bearer " + this.apiToken }
    });
  }

  // Usado pelo Log Analyzer sub-agent durante investigação
  async getIssueDetails(issueId: string) {
    return this.request("/api/0/issues/" + issueId + "/");
  }

  async getLatestEvent(issueId: string) {
    return this.request("/api/0/issues/" + issueId + "/events/latest/");
  }

  async getIssueBreadcrumbs(issueId: string) {
    const event = await this.getLatestEvent(issueId);
    return event.entries?.find(e => e.type === "breadcrumbs")?.data?.values;
  }

  async getRelatedIssues(projectSlug: string, query: string) {
    return this.request("/api/0/projects/org/" + projectSlug + "/issues/", 
      { query, sort: "freq" });
  }

  async getDeploysByProject(orgSlug: string, projectSlug: string) {
    return this.request(
      "/api/0/organizations/" + orgSlug + "/releases/",
      { project: projectSlug, per_page: "10" }
    );
  }
}`}</Code>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Sentry Tools para Sub-Agentes</h4>
        <Code title="tools disponíveis para Log Analyzer quando source = Sentry">{`// Tools registrados no Agent SDK quando alerta vem do Sentry:

const sentryTools = [
  {
    name: "sentry_get_stacktrace",
    description: "Get full stack trace with source context for a Sentry issue",
    params: { issueId: "string" },
    // Retorna: frames com filename, function, lineno, context_line
  },
  {
    name: "sentry_get_breadcrumbs", 
    description: "Get event breadcrumbs (trail of actions before the error)",
    params: { issueId: "string" },
    // Retorna: array de {category, message, timestamp, data}
    // Ex: HTTP request → DB query → cache miss → exception
  },
  {
    name: "sentry_search_similar_issues",
    description: "Search for similar issues in the same project by exception type or message",
    params: { projectSlug: "string", query: "string" },
    // Retorna: issues similares com count e lastSeen
  },
  {
    name: "sentry_get_releases",
    description: "Get recent releases/deploys for a project",
    params: { projectSlug: "string" },
    // Retorna: releases com commits, deploy dates, authors
    // Crucial para Change Detector correlacionar deploy → error
  },
  {
    name: "sentry_get_event_tags",
    description: "Get tags and context from the latest event (runtime, OS, browser, etc)",
    params: { issueId: "string" },
    // Retorna: tags como server_name, environment, release, url
  },
];

// Exemplo de investigação com Sentry:
// 1. Alerta: "TypeError: Cannot read property 'price' of undefined"
// 2. Agent chama sentry_get_stacktrace → identifica checkout.handler:45
// 3. Agent chama sentry_get_breadcrumbs → vê: HTTP POST /checkout → 
//    DB query products → retornou null → crash
// 4. Agent chama sentry_get_releases → deploy v2.3.4 há 2h
// 5. Agent correlaciona: deploy v2.3.4 mudou query de products,
//    campo price removido → NullPointerException
// 6. Hipótese: "Deploy v2.3.4 removeu campo price da query de products"
//    Confidence: 89% (stack trace + breadcrumbs + deploy timing)`}</Code>
      </div>

      <Alert type="success">
        <strong>Valor:</strong> Sentry breadcrumbs são ouro para investigação — mostram exatamente o caminho 
        que levou ao erro (HTTP request → DB query → cache miss → crash). Nenhum outro alert source tem isso. 
        Nosso agent pode usar breadcrumbs como evidence chain natural.
      </Alert>
    </div>
  ),

  "consul": () => (
    <div className="space-y-5">
      <h3 className="text-xl font-bold text-gray-900">Consul Integration — Knowledge Graph Source</h3>
      <Alert type="warning">
        <strong>Cliente 2:</strong> Azure + Consul para service discovery. Consul é a fonte de verdade para 
        topologia de serviços, health checks e dependências. Acesso via relay (VPN interna).
      </Alert>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Consul como Knowledge Graph Source</h4>
        <Code title="src/infra/consul/consul-client.ts">{`// Consul HTTP API (via relay)
// Fonte para popular o Knowledge Graph com:
// - Serviços registrados e suas instâncias
// - Health checks (passing, warning, critical)
// - Service-to-service dependencies (via intentions/connect)
// - KV store (configs, feature flags)

class ConsulClient implements ServiceDiscoverySource {
  constructor(private relay: RelayClient) {}

  // Listar todos os serviços registrados
  async getServices(): Promise<ConsulService[]> {
    // GET /v1/catalog/services
    const services = await this.relay.query("consul", "GET", "/v1/catalog/services");
    // Retorna: { "api-gateway": ["v2", "production"], "auth-service": [...], ... }
    return Object.entries(services).map(([name, tags]) => ({ name, tags }));
  }

  // Detalhes + instâncias de um serviço
  async getServiceInstances(name: string): Promise<ConsulServiceInstance[]> {
    // GET /v1/health/service/:name
    const instances = await this.relay.query(
      "consul", "GET", "/v1/health/service/" + name
    );
    return instances.map(inst => ({
      id: inst.Service.ID,
      name: inst.Service.Service,
      address: inst.Service.Address,
      port: inst.Service.Port,
      tags: inst.Service.Tags,
      meta: inst.Service.Meta,       // version, team, repo, etc.
      health: inst.Checks.map(c => ({
        name: c.Name,
        status: c.Status,            // "passing" | "warning" | "critical"
        output: c.Output,            // Health check output (error msg)
      })),
    }));
  }

  // Dependências via Consul Connect intentions
  async getIntentions(): Promise<ConsulIntention[]> {
    // GET /v1/connect/intentions
    const intentions = await this.relay.query(
      "consul", "GET", "/v1/connect/intentions"
    );
    // Retorna: [{ SourceName: "api-gateway", DestinationName: "auth-service", Action: "allow" }]
    // Isso nos dá o GRAFO DE DEPENDÊNCIAS!
    return intentions.map(i => ({
      source: i.SourceName,
      destination: i.DestinationName,
      action: i.Action,
    }));
  }

  // KV store (configs, feature flags)
  async getKV(prefix: string): Promise<ConsulKVEntry[]> {
    return this.relay.query("consul", "GET", "/v1/kv/" + prefix + "?recurse=true");
  }
}`}</Code>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Consul → Knowledge Graph Sync</h4>
        <Code title="src/modules/knowledge/sources/consul-sync.ts">{`// Sincroniza Consul → Knowledge Graph (DynamoDB adjacency list)
// Roda a cada 5 minutos via scheduled task

class ConsulKnowledgeSync {
  async sync(tenantId: string) {
    const consul = this.getConsulClient(tenantId);
    
    // 1. Descobrir todos os serviços
    const services = await consul.getServices();
    
    // 2. Para cada serviço, obter instâncias e health
    for (const svc of services) {
      const instances = await consul.getServiceInstances(svc.name);
      
      await this.knowledgeGraph.upsertService({
        tenantId,
        serviceId: svc.name,
        instances: instances.length,
        health: aggregateHealth(instances),  // worst health of all instances
        tags: svc.tags,
        meta: instances[0]?.meta || {},      // version, team, repo
        lastSync: new Date(),
      });
    }
    
    // 3. Mapear dependências via intentions
    const intentions = await consul.getIntentions();
    for (const intent of intentions) {
      if (intent.action === "allow") {
        await this.knowledgeGraph.upsertDependency({
          tenantId,
          sourceService: intent.source,
          targetService: intent.destination,
          type: "consul_intention",
          lastSync: new Date(),
        });
      }
    }
    
    // 4. Detectar mudanças desde último sync
    const changes = await this.detectChanges(tenantId, services, intentions);
    if (changes.length > 0) {
      // Emitir evento para peace-time anomaly scanner
      await this.eventBus.emit("knowledge.topology_changed", {
        tenantId, changes,
        // Ex: { type: "service_unhealthy", service: "auth-service",
        //        previousHealth: "passing", currentHealth: "critical" }
      });
    }
  }
}

// DynamoDB adjacency list pattern:
// PK=TENANT#t1|SERVICE#auth-service  SK=META
//   → { instances: 3, health: "passing", version: "2.3.4", team: "platform" }
// PK=TENANT#t1|SERVICE#auth-service  SK=DEPENDS_ON#api-gateway
//   → { type: "consul_intention", lastSync: "..." }
// PK=TENANT#t1|SERVICE#auth-service  SK=DEPENDS_ON#user-db
//   → { type: "consul_intention", lastSync: "..." }
// PK=TENANT#t1|SERVICE#auth-service  SK=INCIDENT#inc-789
//   → { severity: "P2", resolvedAt: "...", rootCause: "..." }
// PK=TENANT#t1|SERVICE#auth-service  SK=DEPLOY#2026-02-15T03:00:00Z
//   → { version: "2.3.4", commit: "abc123" }`}</Code>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Consul Tools para Sub-Agentes</h4>
        <Code title="tools para Infra Inspector quando tenant usa Consul">{`const consulTools = [
  {
    name: "consul_list_services",
    description: "List all registered services with health status",
    // Retorna: [{name, instances, health, tags}]
  },
  {
    name: "consul_get_service_health",
    description: "Get detailed health for a service (all instances + checks)",
    params: { serviceName: "string" },
    // Retorna: instâncias com status dos health checks
  },
  {
    name: "consul_get_dependencies",
    description: "Get upstream and downstream dependencies for a service",
    params: { serviceName: "string" },
    // Retorna: { upstream: ["api-gateway"], downstream: ["user-db", "cache"] }
    // Crucial para blast radius analysis
  },
  {
    name: "consul_get_config",
    description: "Get configuration values from Consul KV store",
    params: { prefix: "string" },
    // Retorna: key-value pairs (feature flags, config values)
    // Útil para: "alguém mudou um config recentemente?"
  },
  {
    name: "consul_compare_topology",
    description: "Compare current topology with previous snapshot",
    params: { hoursAgo: "number" },
    // Retorna: diff de serviços/deps adicionados/removidos
    // Útil para: "o que mudou na topologia nas últimas 4h?"
  },
];`}</Code>
      </div>

      <Alert type="success">
        <strong>Valor:</strong> Consul resolve nosso gap de Knowledge Graph para o cliente 2. 
        Service discovery + intentions = topologia + dependências automaticamente. 
        Para clientes sem Consul, populamos via cloud APIs (ECS/AKS service lists). 
        O Knowledge Graph é o mesmo — só a fonte muda (Consul adapter vs Cloud adapter).
      </Alert>
    </div>
  ),

  "customers": () => (
    <div className="space-y-5">
      <h3 className="text-xl font-bold text-gray-900">Deploy por Cliente — Visão Completa</h3>

      <div className="bg-white border-2 border-orange-300 rounded-lg p-5">
        <h4 className="font-bold text-orange-800 mb-3">🔶 Cliente 1: AWS + Slack + Sentry + VPC</h4>
        <Code title="Arquitetura de deploy">{`
┌───────────────────────────────────────────────┐
│  NOSSO SaaS (sa-east-1)                       │
│                                               │
│  Backend API ◄── Relay Gateway ◄── Orchestrator│
│       │              ▲                        │
│       │              │ WSS (443)              │
│       │              │                        │
│  Slack Bot ─────►  Slack API                  │
│                      │                        │
└──────────────────────┼────────────────────────┘
                       │
          ─────────────┼──── INTERNET ──────────
                       │
┌──────────────────────┼────────────────────────┐
│  VPC DO CLIENTE (AWS)│                        │
│                      │                        │
│  ┌───────────────────┴──────────────────────┐ │
│  │  Agent Relay (ECS Fargate / EC2)         │ │
│  └────┬───────────────┬─────────────────────┘ │
│       │               │                       │
│  ┌────▼──────┐  ┌─────▼──────────┐           │
│  │ Sentry    │  │ CloudWatch     │           │
│  │ (self-    │  │ (logs/metrics) │           │
│  │  hosted)  │  │                │           │
│  └───────────┘  └────────────────┘           │
│                                               │
│  ┌─────────────────────────────────┐         │
│  │ IAM Role (STS AssumeRole)       │         │
│  │ → Log Analyzer: read-only logs  │         │
│  │ → Infra Inspector: Describe*    │         │
│  │ → Change Detector: CloudTrail   │         │
│  └─────────────────────────────────┘         │
└───────────────────────────────────────────────┘

Onboarding:
1. CloudFormation stack → cria IAM Role + External ID
2. docker compose up → roda Agent Relay na VPC
3. /sre connect no Slack → vincula workspace + tenant
4. Sentry webhook → aponta para relay endpoint interno
   OU relay auto-descobre via Sentry API
Tempo estimado: < 1 hora`}</Code>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="bg-green-50 border border-green-200 rounded p-2">
            <p className="font-bold text-green-800">Integrations prontas no PRD:</p>
            <p className="text-green-700">✅ AWS CloudWatch (logs/metrics)</p>
            <p className="text-green-700">✅ AWS STS AssumeRole</p>
            <p className="text-green-700">✅ Slack adapter (Bolt SDK)</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-2">
            <p className="font-bold text-blue-800">Novos neste ADR:</p>
            <p className="text-blue-700">🆕 Agent Relay (VPC connectivity)</p>
            <p className="text-blue-700">🆕 Sentry parser (alert source)</p>
            <p className="text-blue-700">🆕 Sentry client (investigation source)</p>
          </div>
        </div>
      </div>

      <div className="bg-white border-2 border-blue-300 rounded-lg p-5">
        <h4 className="font-bold text-blue-800 mb-3">🔷 Cliente 2: Azure + Teams + Grafana + Consul + VPN</h4>
        <Code title="Arquitetura de deploy">{`
┌───────────────────────────────────────────────┐
│  NOSSO SaaS (Brazil South)                    │
│                                               │
│  Backend API ◄── Relay Gateway ◄── Orchestrator│
│       │              ▲                        │
│       │              │ WSS (443)              │
│       │              │                        │
│  Teams Bot ─────► Bot Framework               │
│                      │                        │
└──────────────────────┼────────────────────────┘
                       │
          ─────────────┼──── INTERNET ──────────
                       │
┌──────────────────────┼────────────────────────┐
│  AZURE VNET + VPN    │                        │
│                      │                        │
│  ┌───────────────────┴──────────────────────┐ │
│  │  Agent Relay (Azure Container Instance)  │ │
│  └────┬────────────┬───────────┬────────────┘ │
│       │            │           │              │
│  ┌────▼──────┐ ┌───▼─────┐ ┌──▼──────────┐  │
│  │ Grafana   │ │ Consul  │ │Azure Monitor │  │
│  │ (alertas  │ │ (service│ │(logs/metrics)│  │
│  │ + dashb.) │ │  disc.) │ │             │  │
│  └───────────┘ └─────────┘ └─────────────┘  │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ Azure Lighthouse Delegation              │ │
│  │ → Log Analyzer: Log Analytics Reader     │ │
│  │ → Infra Inspector: Reader               │ │
│  │ → Consul: via Relay (sem RBAC Azure)    │ │
│  └─────────────────────────────────────────┘ │
└───────────────────────────────────────────────┘

Onboarding:
1. ARM template → cria Lighthouse delegation
2. docker compose up → roda Agent Relay no VNET
3. /sre connect no Teams → vincula tenant + Entra ID
4. Grafana webhook → configurado para alertar nosso parser
5. Consul auto-discovery → popula Knowledge Graph
Tempo estimado: < 1 hora`}</Code>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="bg-green-50 border border-green-200 rounded p-2">
            <p className="font-bold text-green-800">Integrations prontas no PRD:</p>
            <p className="text-green-700">✅ Azure Lighthouse delegation</p>
            <p className="text-green-700">✅ Azure Monitor (logs/metrics)</p>
            <p className="text-green-700">✅ Teams adapter (Bot Framework)</p>
            <p className="text-green-700">✅ Grafana parser (alert source)</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-2">
            <p className="font-bold text-blue-800">Novos neste ADR:</p>
            <p className="text-blue-700">🆕 Agent Relay (VPN connectivity)</p>
            <p className="text-blue-700">🆕 Consul client (knowledge graph source)</p>
            <p className="text-blue-700">🆕 Consul sync (topology auto-discovery)</p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-bold text-green-900 mb-2">Checklist: Prontos para os 2 clientes?</h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-bold text-gray-800 mb-1">Já tínhamos:</p>
            <p className="text-green-700">✅ AWS + Azure credential management</p>
            <p className="text-green-700">✅ Slack + Teams adapters</p>
            <p className="text-green-700">✅ CloudWatch + Azure Monitor + Grafana parsers</p>
            <p className="text-green-700">✅ Multi-agent investigation pipeline</p>
            <p className="text-green-700">✅ Approval gates + audit trail</p>
            <p className="text-green-700">✅ Multi-tenant isolation</p>
          </div>
          <div>
            <p className="font-bold text-gray-800 mb-1">Adicionado com ADR-010:</p>
            <p className="text-blue-700">🆕 Agent Relay (resolve VPC/VPN)</p>
            <p className="text-blue-700">🆕 Sentry parser + investigation client</p>
            <p className="text-blue-700">🆕 Consul integration (knowledge graph)</p>
            <p className="text-blue-700">🆕 Relay Gateway (backend component)</p>
            <p className="text-blue-700">🆕 Knowledge Graph adjacency list pattern</p>
          </div>
        </div>
        <p className="text-green-800 font-bold text-sm mt-3">
          Com ADR-010, o PRD cobre 100% das necessidades técnicas dos dois clientes iniciais.
        </p>
      </div>
    </div>
  ),

  "roadmap": () => (
    <div className="space-y-5">
      <h3 className="text-xl font-bold text-gray-900">Impacto no Roadmap</h3>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Novos Componentes por Sprint</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg text-xs">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-3 py-2 text-left">Sprint</th>
                <th className="px-3 py-2 text-left">Semanas</th>
                <th className="px-3 py-2 text-left">Componente ADR-010</th>
                <th className="px-3 py-2 text-center">Dias Extra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[
                ["1-2", "1-4", "Agent Relay: container + protocolo WSS + Relay Gateway no backend", "+5 dias"],
                ["1-2", "1-4", "Relay Gateway: WebSocket manager, request routing, health monitoring", "(incluso acima)"],
                ["3-4", "5-8", "Sentry parser (webhook → NormalizedAlert)", "+2 dias"],
                ["3-4", "5-8", "Sentry investigation client (via relay)", "+2 dias"],
                ["3-4", "5-8", "Consul client + Knowledge Graph sync", "+3 dias"],
                ["3-4", "5-8", "Knowledge Graph adjacency list entities (ElectroDB)", "+1 dia"],
                ["5-7", "9-14", "Sentry tools para sub-agentes (stacktrace, breadcrumbs)", "+2 dias"],
                ["5-7", "9-14", "Consul tools para sub-agentes (topology, dependencies)", "+2 dias"],
                ["8-9", "15-18", "Relay auto-update + monitoring dashboard", "+1 dia"],
              ].map(([sprint, weeks, comp, days], i) => (
                <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                  <td className="px-3 py-2 font-medium">{sprint}</td>
                  <td className="px-3 py-2 text-gray-500">{weeks}</td>
                  <td className="px-3 py-2 text-gray-700">{comp}</td>
                  <td className="px-3 py-2 text-center font-bold text-blue-700">{days}</td>
                </tr>
              ))}
              <tr className="bg-blue-50 font-bold">
                <td className="px-3 py-2" colSpan={3}>Total adicional ADR-010</td>
                <td className="px-3 py-2 text-center text-blue-700">+18 dias (~3.5 semanas)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Timeline Consolidada</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg text-xs">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-3 py-2 text-left">Componente</th>
                <th className="px-3 py-2 text-center">PRD Original</th>
                <th className="px-3 py-2 text-center">+ ADR-009</th>
                <th className="px-3 py-2 text-center">+ ADR-010</th>
                <th className="px-3 py-2 text-center">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {[
                ["Foundation + Ports", "4 sem", "+2 dias", "+5 dias (relay)", "~5.5 sem"],
                ["Ingestion + Triage", "4 sem", "+3 dias", "+4 dias (Sentry+Consul)", "~5.5 sem"],
                ["Deep Search", "6 sem", "—", "+4 dias (tools)", "~7 sem"],
                ["Chat + Remediation", "4 sem", "+5 dias", "+1 dia", "~5 sem"],
                ["Enterprise + SOC2", "6 sem", "+2 dias", "—", "~6.5 sem"],
              ].map(([comp, orig, adr9, adr10, total], i) => (
                <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                  <td className="px-3 py-2 font-medium">{comp}</td>
                  <td className="px-3 py-2 text-center">{orig}</td>
                  <td className="px-3 py-2 text-center text-amber-700">{adr9}</td>
                  <td className="px-3 py-2 text-center text-blue-700">{adr10}</td>
                  <td className="px-3 py-2 text-center font-bold">{total}</td>
                </tr>
              ))}
              <tr className="bg-green-50 font-bold">
                <td className="px-3 py-2">TOTAL</td>
                <td className="px-3 py-2 text-center">24 sem</td>
                <td className="px-3 py-2 text-center text-amber-700">+12 dias</td>
                <td className="px-3 py-2 text-center text-blue-700">+18 dias</td>
                <td className="px-3 py-2 text-center text-green-700">~30 semanas</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <Alert type="info">
        <strong>Otimização possível:</strong> Agent Relay é open-source e genérico — pode ser desenvolvido 
        em paralelo por outro dev enquanto o core team foca nos módulos principais. Sentry parser 
        e Consul client também são isolados. Com 2 devs em paralelo: timeline volta para ~26-27 semanas.
      </Alert>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Módulos Atualizados do Projeto</h4>
        <Code title="Project Structure (atualizada)">{`src/
├── modules/
│   ├── ingestion/
│   │   ├── parsers/
│   │   │   ├── datadog-parser.ts
│   │   │   ├── grafana-parser.ts
│   │   │   ├── cloudwatch-parser.ts
│   │   │   ├── azure-monitor-parser.ts
│   │   │   ├── sentry-parser.ts         # 🆕 ADR-010
│   │   │   └── prometheus-parser.ts
│   │   ├── normalizer.ts
│   │   └── dedup.ts
│   │
│   ├── knowledge/                        # 🆕 Knowledge Graph
│   │   ├── graph.ts                      #   Adjacency list queries
│   │   ├── sources/
│   │   │   ├── consul-sync.ts            # 🆕 ADR-010
│   │   │   ├── aws-ecs-sync.ts           #   ECS service discovery
│   │   │   └── azure-aks-sync.ts         #   AKS service discovery
│   │   └── entities/
│   │       ├── service-node.ts           #   ServiceNode entity
│   │       └── dependency-edge.ts        #   Dependency entity
│   │
│   ├── investigation/ | triage/ | remediation/ | tenant/ | audit/
│
├── infra/
│   ├── relay/                            # 🆕 ADR-010
│   │   ├── relay-gateway.ts              #   WebSocket manager (backend side)
│   │   ├── relay-router.ts               #   Request routing to relay
│   │   └── relay-health.ts               #   Health monitoring
│   │
│   ├── sentry/                           # 🆕 ADR-010
│   │   └── sentry-client.ts              #   Sentry API client (via relay)
│   │
│   ├── consul/                           # 🆕 ADR-010
│   │   └── consul-client.ts              #   Consul API client (via relay)
│   │
│   ├── cloud/ (aws/, azure/)
│   ├── chat/ (slack/, teams/)
│   └── db/ | queue/ | cache/ | agent/ | observability/
│
└── relay/                                # 🆕 Repo separado (open-source)
    ├── Dockerfile
    ├── src/
    │   ├── main.ts                       #   Entrypoint
    │   ├── ws-client.ts                  #   WebSocket connection to backend
    │   ├── request-router.ts             #   Route queries to local endpoints
    │   ├── health.ts                     #   Health checks + reporting
    │   └── config.ts                     #   Endpoint configuration
    └── docker-compose.yml                #   Para cliente rodar`}</Code>
      </div>

      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-bold text-green-900 mb-2">Resumo ADR-010</h4>
        <div className="text-sm text-gray-700 space-y-1">
          <p><strong>Decisão:</strong> Agent Relay (container leve, outbound-only, stateless) para acessar recursos em redes privadas.</p>
          <p><strong>Novas integrações:</strong> Sentry (alert source + investigation source) e Consul (knowledge graph source).</p>
          <p><strong>Impacto:</strong> +18 dias no roadmap total. Paralelizável com 2 devs → impacto reduzido.</p>
          <p><strong>Resultado:</strong> PRD cobre 100% das necessidades dos 2 clientes iniciais.</p>
          <p><strong>Princípio:</strong> Relay é repo open-source separado. Cliente pode inspecionar o código. Toda AI fica no nosso SaaS.</p>
        </div>
      </div>
    </div>
  ),
};

export default function ADR010() {
  const [activeTab, setActiveTab] = useState("adr010");
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gradient-to-r from-purple-800 to-blue-800 text-white px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="bg-purple-600 px-2 py-0.5 rounded text-xs font-bold">ADR-010</span>
            <h1 className="text-xl font-bold">Agent Relay + Sentry + Consul</h1>
          </div>
          <p className="text-purple-200 text-sm mt-0.5">Connectivity model para redes privadas + integrações dos 2 clientes iniciais</p>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id ? "bg-purple-700 text-white" : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        {sections[activeTab]?.()}
      </div>
    </div>
  );
}
