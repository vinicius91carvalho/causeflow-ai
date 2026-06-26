import { useState } from "react";

const tabs = [
  { id: "adr010", label: "ADR-010: Agent Relay", icon: "🔌" },
  { id: "relay-arch", label: "Arquitetura Relay", icon: "🏗️" },
  { id: "vs-resolve", label: "vs Resolve Satellite", icon: "⚡" },
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
        <p className="text-blue-200 text-sm mt-1">Container leve com gRPC bidirecional para acessar recursos em VPCs e VPNs. Runtime-agnostic — funciona em ECS, VMs, bare metal, ou Kubernetes.</p>
      </div>

      <Alert type="error">
        <strong>Problema:</strong> Ambos os clientes iniciais têm recursos em redes privadas.
        Cliente 1: AWS VPC com Sentry self-hosted (ECS/EC2, sem Kubernetes).
        Cliente 2: Azure VPN com Grafana + Consul internos (VMs, sem Kubernetes).
        Nosso backend SaaS não alcança esses recursos diretamente.
      </Alert>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Opções Avaliadas</h4>
        <div className="space-y-3">
          {[
            {
              opt: "A", title: "Agent Relay — gRPC bidirecional, runtime-agnostic",
              desc: "Container Docker leve rodando na rede do cliente. Conecta outbound via gRPC/HTTP2 streaming (porta 443) ao nosso backend. Faz proxy de queries para qualquer recurso HTTP interno. Stateless, open-source, independente de Kubernetes ou qualquer orquestrador.",
              pros: ["gRPC bidirecional: multiplexing, flow control, streaming nativo", "Outbound-only: zero portas abertas no firewall do cliente", "Runtime-agnostic: Docker puro — roda em ECS, VM, bare metal, K8s, qualquer coisa", "Padrão enterprise: gRPC/HTTP2 é o padrão de comunicação inter-serviço", "Agnóstico de endpoint: qualquer API HTTP interna (Sentry, Grafana, Consul, custom)", "Cliente controla whitelist de endpoints que o relay pode acessar", "Proto-first: contrato de API tipado e versionado via .proto files"],
              cons: ["Requer que cliente rode 1 container (~50MB, 128MB RAM)", "gRPC requer que proxies internos suportem HTTP/2 (maioria já suporta)"],
              status: "accepted"
            },
            {
              opt: "B", title: "AWS PrivateLink / Azure Private Link",
              desc: "Conectividade L3 via endpoint privado.",
              pros: ["Latência mínima", "Sem componente no lado do cliente"],
              cons: ["$7-10/endpoint/mês por AZ", "Diferente por cloud", "Não funciona cross-cloud", "Complexo: requer VPC config no cliente"],
              status: "rejected"
            },
            {
              opt: "C", title: "Full deploy na rede do cliente (on-prem)",
              desc: "Deploy completo do nosso stack dentro da infra do cliente.",
              pros: ["Zero preocupação com conectividade"],
              cons: ["N deploys para manter", "Perde economia de escala SaaS", "Update coordenado com cada cliente", "Impossível com equipe pequena"],
              status: "rejected"
            },
            {
              opt: "D", title: "WebSocket (WSS)",
              desc: "WebSocket Secure como alternativa mais simples ao gRPC.",
              pros: ["Mais simples de implementar", "Funciona em qualquer proxy"],
              cons: ["Sem multiplexing (1 stream por conexão)", "Sem flow control nativo", "Sem contrato tipado (tudo é JSON string)", "Sem streaming bidirecional verdadeiro — é message-based", "Sem code generation de client/server a partir de schema"],
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
                  {o.pros.map((p, i) => <p key={i} className="text-green-600">+ {p}</p>)}
                </div>
                <div>
                  {o.cons.map((c, i) => <p key={i} className="text-red-600">- {c}</p>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Alert type="success">
        <strong>Decisão:</strong> Opção A — Agent Relay com gRPC bidirecional. Runtime-agnostic (não depende de Kubernetes).
        Relay é open-source, stateless, e se conecta a qualquer API HTTP interna.
        Toda inteligência (AI, orquestração, agents) fica no nosso SaaS.
      </Alert>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Por que gRPC e não WebSocket?</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border border-gray-200 rounded">
            <thead><tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left">Aspecto</th>
              <th className="px-3 py-2 text-center">gRPC/HTTP2</th>
              <th className="px-3 py-2 text-center">WebSocket</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {[
                ["Multiplexing", "Múltiplos streams na mesma conexão", "1 stream por conexão"],
                ["Flow control", "Nativo por stream (back-pressure)", "Manual (application-level)"],
                ["Contrato de API", ".proto files — tipado, versionado, code-gen", "JSON sem schema — runtime errors"],
                ["Streaming", "Client, server, e bidirecional nativos", "Message-based (simula streaming)"],
                ["Code generation", "Client + server gerados do .proto (TS, Go, Python)", "Manual — sem code-gen"],
                ["Observabilidade", "gRPC interceptors + OpenTelemetry nativo", "Custom middleware"],
                ["Retry/deadline", "Built-in (deadline propagation, retry policies)", "Manual"],
                ["Compressão", "Built-in (gzip, zstd por mensagem)", "Per-message deflate (opcional)"],
                ["Proxy support", "HTTP/2 — maioria dos proxies modernos", "Qualquer proxy HTTP"],
                ["Ecossistema enterprise", "Padrão Google/CNCF, usado em K8s, Envoy, etc.", "Padrão web, mais simples"],
              ].map(([aspect, grpc, ws], i) => (
                <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                  <td className="px-3 py-2 font-medium text-gray-900">{aspect}</td>
                  <td className="px-3 py-2 text-green-700">{grpc}</td>
                  <td className="px-3 py-2 text-gray-500">{ws}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 mt-2">gRPC com Buf/ConnectRPC permite fallback HTTP/1.1+JSON para ambientes que não suportam HTTP/2 — melhor dos dois mundos.</p>
      </div>
    </div>
  ),

  "relay-arch": () => (
    <div className="space-y-5">
      <h3 className="text-xl font-bold text-gray-900">Agent Relay — Arquitetura gRPC</h3>

      <Code title="Topologia de Rede">{`
┌─────────────────────────────────────────────────────┐
│                NOSSO SaaS (sa-east-1)               │
│                                                     │
│  ┌──────────┐  ┌────────────┐  ┌─────────────────┐ │
│  │ Backend  │  │ Relay      │  │  Investigation  │ │
│  │ API      │◄─┤ Gateway    │◄─┤  Orchestrator   │ │
│  │ (Hono)   │  │ (gRPC srv) │  │  (Agent SDK)    │ │
│  └──────────┘  └──────▲─────┘  └─────────────────┘ │
│                       │                             │
└───────────────────────┼─────────────────────────────┘
                        │ gRPC/HTTP2 (port 443, TLS 1.3)
                        │ Bidirecional streaming
           ─────────────┼────────── INTERNET ─────────
                        │
┌───────────────────────┼─────────────────────────────┐
│  REDE DO CLIENTE      │  (VPC / VPN / on-prem)      │
│                       │                             │
│  ┌────────────────────┴───────────────────────────┐ │
│  │          AGENT RELAY (Docker container)         │ │
│  │          ~50MB image, 128MB RAM, 0.25 vCPU     │ │
│  │                                                │ │
│  │  ┌──────────┐ ┌───────────┐ ┌───────────────┐ │ │
│  │  │ gRPC     │ │ Endpoint  │ │ Health        │ │ │
│  │  │ Client   │ │ Router    │ │ Reporter      │ │ │
│  │  │ (stream) │ │ (HTTP→in) │ │ (metrics)     │ │ │
│  │  └─────┬────┘ └─────┬─────┘ └───────┬───────┘ │ │
│  └────────┼─────────────┼───────────────┼─────────┘ │
│           │             │               │           │
│  ┌────────▼──┐ ┌────────▼─────┐ ┌──────▼────────┐ │
│  │ Sentry    │ │ Grafana      │ │ Consul        │ │
│  │ (HTTP)    │ │ (HTTP)       │ │ (HTTP)        │ │
│  └───────────┘ └──────────────┘ └───────────────┘ │
│  ┌───────────┐ ┌──────────────┐ ┌───────────────┐ │
│  │CloudWatch │ │ Azure Mon.   │ │ Any HTTP API  │ │
│  │(AWS SDK)  │ │ (REST)       │ │ (custom)      │ │
│  └───────────┘ └──────────────┘ └───────────────┘ │
└─────────────────────────────────────────────────────┘

Runtimes suportados (qualquer um):
├── Docker puro (docker run / docker compose)
├── AWS ECS Fargate / ECS EC2
├── Azure Container Instances
├── VM com Docker instalado
├── Kubernetes (se o cliente usar)
├── systemd service (sem Docker)
└── Bare metal`}</Code>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Protocol Buffer Definition</h4>
        <Code title="proto/relay/v1/relay.proto">{`syntax = "proto3";
package relay.v1;

// ─── Serviço principal: backend é o gRPC server, relay é o client ───
// Relay abre stream bidirecional ao conectar.
// Backend envia queries pelo stream, relay responde pelo mesmo stream.

service RelayService {
  // Stream bidirecional: relay conecta, backend envia queries, relay retorna results
  rpc Connect (stream RelayMessage) returns (stream BackendMessage);
  
  // Health check unário (relay reporta status dos endpoints)
  rpc ReportHealth (HealthReport) returns (HealthAck);
}

// ─── Mensagens Relay → Backend ───
message RelayMessage {
  oneof payload {
    HandshakeRequest handshake = 1;    // Primeiro msg: auth + capabilities
    QueryResult      query_result = 2; // Resultado de uma query
    QueryError       query_error = 3;  // Erro ao executar query
  }
}

message HandshakeRequest {
  string tenant_id = 1;
  string relay_token = 2;              // Token rotacionado (24h TTL)
  string relay_version = 3;
  repeated string capabilities = 4;    // ["sentry", "grafana", "consul", "http"]
  repeated EndpointInfo endpoints = 5; // Endpoints configurados + health
}

message QueryResult {
  string query_id = 1;                 // Correlation ID
  int32  status_code = 2;              // HTTP status do endpoint interno
  bytes  body = 3;                     // Response body (JSON, comprimido)
  map<string, string> headers = 4;     // Response headers relevantes
  int64  duration_ms = 5;              // Latência do request interno
}

message QueryError {
  string query_id = 1;
  string error = 2;                    // Mensagem de erro
  ErrorType type = 3;
  
  enum ErrorType {
    UNKNOWN = 0;
    TIMEOUT = 1;
    CONNECTION_REFUSED = 2;
    NOT_FOUND = 3;
    AUTH_FAILED = 4;
    ENDPOINT_DISABLED = 5;
  }
}

// ─── Mensagens Backend → Relay ───
message BackendMessage {
  oneof payload {
    HandshakeResponse handshake = 1;    // Auth aceita/rejeitada
    QueryRequest      query = 2;        // Query para executar localmente
    ConfigUpdate      config = 3;       // Atualização de config remota
  }
}

message QueryRequest {
  string query_id = 1;                 // Correlation ID único
  string endpoint = 2;                 // Nome do endpoint: "sentry", "grafana", etc.
  string method = 3;                   // GET, POST, PUT
  string path = 4;                     // /api/0/issues/12345/
  map<string, string> params = 5;      // Query params
  bytes  body = 6;                     // Request body (para POST)
  int32  timeout_ms = 7;              // Max tempo para essa query (default: 30s)
}

message HandshakeResponse {
  bool   accepted = 1;
  string error = 2;                    // Motivo da rejeição
  int64  token_expires_at = 3;         // Quando o token expira
  RelayConfig config = 4;              // Config remota (rate limits, etc.)
}

// ─── Health ───
message HealthReport {
  string tenant_id = 1;
  repeated EndpointHealth endpoints = 2;
  RelayMetrics relay = 3;
}

message EndpointHealth {
  string name = 1;
  bool   healthy = 2;
  int64  latency_ms = 3;
  string error = 4;
  int64  last_check = 5;              // Unix timestamp
}

message RelayMetrics {
  int64  uptime_seconds = 1;
  int64  queries_total = 2;
  int64  queries_failed = 3;
  double memory_mb = 4;
  double cpu_percent = 5;
}

message EndpointInfo {
  string name = 1;
  string type = 2;                    // "sentry", "grafana", "consul", "custom"
  bool   healthy = 3;
  repeated string capabilities = 4;  // ["alerts", "issues", "releases"]
}

message ConfigUpdate {
  repeated string allowed_paths = 1;  // Whitelist atualizada
  int32 max_requests_per_minute = 2;
  int64 token_refresh = 3;           // Novo token
}

message RelayConfig {
  int32 max_requests_per_minute = 1;
  int32 health_interval_seconds = 2;
  int32 default_timeout_ms = 3;
}`}</Code>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Relay Implementation (TypeScript + ConnectRPC)</h4>
        <Code title="relay/src/main.ts — open-source, runtime-agnostic">{`// Agent Relay — container leve (~50MB distroless image)
// gRPC client via ConnectRPC (suporta gRPC + gRPC-Web + Connect protocol)
// Se proxy do cliente não suporta HTTP/2: fallback automático para Connect/HTTP1.1

import { createGrpcTransport } from "@connectrpc/connect-node";
import { RelayService } from "./gen/relay/v1/relay_connect";

class AgentRelay {
  private stream: AsyncIterable<BackendMessage>;
  private endpoints: Map<string, EndpointHandler>;

  async start(config: RelayConfig) {
    const transport = createGrpcTransport({
      baseUrl: config.backendUrl,        // https://relay.ai-sre.com.br
      httpVersion: "2",                  // gRPC nativo
      // Fallback: se HTTP/2 bloqueado, ConnectRPC degrada para HTTP/1.1+JSON
    });

    const client = createClient(RelayService, transport);

    // Stream bidirecional: relay envia, backend envia
    this.stream = client.connect(this.outboundMessages());

    // Handshake
    await this.sendHandshake(config);

    // Loop principal: receber queries do backend, executar, retornar
    for await (const msg of this.stream) {
      if (msg.payload.case === "query") {
        // Executar query no endpoint interno (fire-and-forget no stream)
        this.handleQuery(msg.payload.value).catch(this.handleError);
      }
      if (msg.payload.case === "config") {
        this.applyConfig(msg.payload.value);
      }
    }
  }

  private async handleQuery(query: QueryRequest): Promise<void> {
    const endpoint = this.endpoints.get(query.endpoint);
    if (!endpoint) {
      await this.sendError(query.queryId, "ENDPOINT_DISABLED");
      return;
    }

    // Rate limit local
    if (!this.rateLimiter.allow(query.endpoint)) {
      await this.sendError(query.queryId, "RATE_LIMITED");
      return;
    }

    // Whitelist check: path permitido?
    if (!this.isAllowedPath(query.endpoint, query.path)) {
      await this.sendError(query.queryId, "PATH_NOT_ALLOWED");
      return;
    }

    try {
      // Executar request HTTP no endpoint interno
      const response = await endpoint.execute({
        method: query.method,
        path: query.path,
        params: query.params,
        body: query.body,
        timeoutMs: query.timeoutMs || 30_000,
      });

      await this.sendResult({
        queryId: query.queryId,
        statusCode: response.status,
        body: response.body,           // Comprimido via gRPC built-in
        headers: response.headers,
        durationMs: response.durationMs,
      });
    } catch (err) {
      await this.sendError(query.queryId, classifyError(err));
    }
  }
}

// Endpoint handler: adapta auth local para cada tipo
class EndpointHandler {
  constructor(
    private baseUrl: string,            // http://sentry.internal:9000
    private auth: LocalAuth | null,     // Token/basic auth LOCAL — nunca sai do relay
  ) {}

  async execute(req: InternalRequest): Promise<InternalResponse> {
    const headers: Record<string, string> = {};
    if (this.auth?.type === "bearer") {
      headers["Authorization"] = "Bearer " + this.auth.token;
    }
    // Auth resolve LOCALMENTE. Backend nunca vê esses tokens.
    const res = await fetch(this.baseUrl + req.path + toQueryString(req.params), {
      method: req.method,
      headers,
      body: req.body,
      signal: AbortSignal.timeout(req.timeoutMs),
    });
    return { status: res.status, body: await res.arrayBuffer(), ... };
  }
}`}</Code>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Setup do Cliente (1 comando)</h4>
        <Code title="docker-compose.yml (roda em qualquer lugar)">{`# Funciona em: Docker puro, ECS, ACI, VM, K8s, bare metal
version: "3.8"
services:
  sre-relay:
    image: ghcr.io/ai-sre-br/agent-relay:latest
    restart: always
    environment:
      RELAY_BACKEND_URL: https://relay.ai-sre.com.br
      RELAY_TENANT_ID: \${TENANT_ID}
      RELAY_TOKEN: \${RELAY_TOKEN}
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
    # Segurança hardened
    read_only: true
    security_opt:
      - no-new-privileges:true
    deploy:
      resources:
        limits:
          memory: 128M
          cpus: "0.25"
    healthcheck:
      test: ["CMD", "/relay", "healthcheck"]
      interval: 30s
      timeout: 5s

# Alternativa sem Docker (systemd):
# curl -L https://releases.ai-sre.com.br/relay/latest/linux-amd64 -o /usr/local/bin/sre-relay
# chmod +x /usr/local/bin/sre-relay
# sre-relay --config /etc/sre-relay/config.yaml`}</Code>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { title: "Segurança", color: "border-red-300", items: [
            "Outbound-only (443): zero portas no firewall",
            "TLS 1.3 + mTLS opcional (relay certificate)",
            "Token rotacionado a cada 24h via backend",
            "Credenciais locais NUNCA saem do relay",
            "Whitelist de paths por endpoint",
            "Rate limit local por endpoint",
            "Read-only filesystem + no-new-privileges",
            "Image distroless (zero shell, zero utils)"
          ]},
          { title: "Resiliência", color: "border-blue-300", items: [
            "Auto-reconnect com exponential backoff + jitter",
            "gRPC deadline propagation (timeout por query)",
            "Circuit breaker por endpoint (trip após 5 erros)",
            "Graceful degradation: endpoint down = skip, não crash",
            "Health report a cada 60s ao backend",
            "Zero state: relay pode reiniciar a qualquer momento",
            "Multi-relay: N instâncias para HA (sem coordenação)"
          ]},
          { title: "Operação", color: "border-green-300", items: [
            "Image ~50MB (distroless base)",
            "128MB RAM / 0.25 vCPU",
            "Logs estruturados (JSON) para debugging",
            "OpenTelemetry traces (relay → backend latência)",
            "Auto-update via Watchtower ou image tag",
            "Binary nativo como alternativa (sem Docker)",
            "Config remota via gRPC ConfigUpdate message"
          ]},
        ].map((col, i) => (
          <div key={i} className={`bg-white border-2 ${col.color} rounded-lg p-4`}>
            <h5 className="font-bold text-gray-900 text-sm mb-2">{col.title}</h5>
            {col.items.map((item, j) => <p key={j} className="text-xs text-gray-600 mb-1">• {item}</p>)}
          </div>
        ))}
      </div>
    </div>
  ),

  "vs-resolve": () => (
    <div className="space-y-5">
      <h3 className="text-xl font-bold text-gray-900">Agent Relay vs Resolve AI Satellite</h3>

      <Alert type="warning">
        <strong>Contexto:</strong> A Resolve.ai usa o "Satellite" — componente na infra do cliente com propósito similar.
        Eles definiram o padrão DELES, não o do mercado. Podemos fazer melhor porque nosso contexto é diferente.
      </Alert>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg text-xs">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left w-44">Aspecto</th>
              <th className="px-3 py-2 text-left">Resolve Satellite</th>
              <th className="px-3 py-2 text-left">Nosso Agent Relay</th>
              <th className="px-3 py-2 text-center w-16">Quem ganha</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {[
              ["Protocolo", "gRPC/HTTP2 bidirecional (conexões 30+ min)", "gRPC/HTTP2 bidirecional via ConnectRPC (fallback HTTP/1.1)", "🟰"],
              ["Runtime required", "Kubernetes (acessa K8s API server)", "Qualquer: Docker, VM, ECS, ACI, K8s, bare metal, binary nativo", "🟢 Nós"],
              ["Service discovery", "Kubernetes API only (pods, services, deployments)", "Consul + ECS + AKS + K8s + qualquer API HTTP custom", "🟢 Nós"],
              ["Infra model", "K8s namespaces, pods, deployments", "Serviços genéricos — funciona com qualquer topologia", "🟢 Nós"],
              ["Observability sources", "Datadog, Splunk, Grafana (via proxy)", "Sentry, Grafana, Consul, CloudWatch, Azure Monitor, qualquer HTTP", "🟢 Nós"],
              ["Dependency mapping", "K8s service mesh / network policies", "Consul intentions, cloud API discovery, manual config", "🟰"],
              ["Scraping interval", "5min default (K8s API)", "Configurável por fonte (Consul: 5min, health: 60s)", "🟰"],
              ["Install method", "Helm chart (K8s only)", "docker compose | docker run | binary | Helm | ECS task def", "🟢 Nós"],
              ["Credenciais", "Ficam no cliente", "Ficam no cliente", "🟰"],
              ["Open source", "Não (proprietary)", "Sim — cliente pode auditar código", "🟢 Nós"],
              ["Contrato de API", "Provavelmente internal proto", ".proto público, versionado, com code-gen", "🟢 Nós"],
              ["Fallback HTTP/1.1", "Não documentado", "ConnectRPC degrada para HTTP/1.1+JSON automaticamente", "🟢 Nós"],
              ["Data redaction", "Sim (antes de transmitir)", "Sim (configurável por endpoint + regex patterns)", "🟰"],
              ["Clientes ideais", "Enterprises com K8s clusters", "Qualquer empresa com recursos em rede privada", "🟢 Nós"],
            ].map(([aspect, resolve, us, winner], i) => (
              <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                <td className="px-3 py-2 font-medium text-gray-900">{aspect}</td>
                <td className="px-3 py-2 text-gray-600">{resolve}</td>
                <td className="px-3 py-2 text-gray-700">{us}</td>
                <td className="px-3 py-2 text-center">{winner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
          <h5 className="font-bold text-red-800 mb-2">Limitações do Resolve Satellite</h5>
          <div className="text-xs text-red-700 space-y-1">
            <p><strong>Kubernetes-dependent:</strong> Sem K8s, o Satellite não faz service discovery nem dependency mapping. Nossos 2 clientes não usam K8s — o Satellite deles não serviria.</p>
            <p><strong>Closed-source:</strong> Cliente não pode auditar o que roda na infra dele. Em ambiente regulado (bancos, saúde), isso é bloqueante.</p>
            <p><strong>Install via Helm only:</strong> Sem K8s = sem install. Não tem opção Docker puro ou binary.</p>
            <p><strong>Foco em scraping:</strong> Satellite foca em monitorar K8s API. Não é um proxy genérico para qualquer API interna.</p>
          </div>
        </div>

        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
          <h5 className="font-bold text-green-800 mb-2">Vantagens do Nosso Agent Relay</h5>
          <div className="text-xs text-green-700 space-y-1">
            <p><strong>Runtime-agnostic:</strong> Funciona em qualquer lugar onde roda um container ou binário. ECS, VMs, bare metal, K8s — qualquer um.</p>
            <p><strong>Proxy genérico:</strong> Qualquer API HTTP interna é acessível. Sentry self-hosted, Grafana, Consul, APIs custom, databases com REST API.</p>
            <p><strong>Open-source:</strong> Cliente audita cada linha. Essencial para compliance (LGPD, SOC 2, regulatórios).</p>
            <p><strong>ConnectRPC fallback:</strong> Se proxy interno não suporta HTTP/2, degrada para HTTP/1.1 automaticamente. Zero configuração extra.</p>
            <p><strong>Multi-source discovery:</strong> Consul, ECS API, AKS API, K8s API — a fonte de verdade do service discovery depende do cliente, não de nós.</p>
            <p><strong>Mercado BR:</strong> Maioria das empresas mid-market brasileiras NÃO usa Kubernetes. Usam ECS, VMs, ou bare metal. O Satellite não as atenderia.</p>
          </div>
        </div>
      </div>

      <Alert type="success">
        <strong>Posicionamento:</strong> O Satellite da Resolve foi feito para Silicon Valley (K8s everywhere, 
        cloud-native, enterprise). Nosso Agent Relay é feito para o mundo real — onde empresas têm 
        infra heterogênea, VMs legadas, ECS, Consul, e não vão migrar para K8s só para usar nosso produto.
        Isso é diferenciação real, não feature parity.
      </Alert>
    </div>
  ),

  "sentry": () => (
    <div className="space-y-5">
      <h3 className="text-xl font-bold text-gray-900">Sentry Integration — Parser + Investigation Client</h3>
      <Alert type="warning">
        <strong>Cliente 1:</strong> Sentry self-hosted dentro de VPC (AWS). Alertas via webhook, investigação via API — tudo pelo relay.
      </Alert>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Sentry como Alert Source</h4>
        <Code title="src/modules/ingestion/parsers/sentry-parser.ts">{`// Sentry webhook → relay → nosso backend → normalização
// Sentry envia: issue alerts, metric alerts, error events

interface SentryWebhookPayload {
  action: "created" | "resolved" | "regression";
  data: {
    issue: {
      id: string;
      title: string;            // "TypeError: Cannot read property 'x'"
      culprit: string;          // "app/api/checkout.handler"
      level: "fatal"|"error"|"warning"|"info";
      count: number;            // Total de ocorrências
      firstSeen: string;
      lastSeen: string;
      metadata: {
        type: string;           // Exception type
        value: string;          // Exception message
        filename: string;
        function: string;
      };
      project: { slug: string; name: string; };
    };
    event?: {
      breadcrumbs?: Array<{     // Trail de ações antes do erro
        category: string;       // "http", "console", "query"
        message: string;
        timestamp: number;
        data?: Record<string, unknown>;
      }>;
      exception?: {
        values: Array<{
          type: string;
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

function parseSentryAlert(payload: SentryWebhookPayload): NormalizedAlert {
  const issue = payload.data.issue;
  return {
    source: "sentry",
    externalId: issue.id,
    title: issue.title,
    severity: mapSeverity(issue.level, issue.count),
    // fatal → P1 | error+count>100 → P2 | error → P3 | warning → P4
    service: extractServiceFromCulprit(issue.culprit),
    timestamp: new Date(issue.lastSeen),
    rawPayload: payload,
    metadata: {
      exceptionType: issue.metadata.type,
      filename: issue.metadata.filename,
      eventCount: issue.count,
      hasBreadcrumbs: !!payload.data.event?.breadcrumbs?.length,
      hasStacktrace: !!payload.data.event?.exception?.values?.length,
    },
  };
}`}</Code>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Sentry Tools para Sub-Agentes</h4>
        <Code title="Tools registrados quando alerta vem do Sentry">{`// Cada tool faz request via relay → Sentry API interno

const sentryTools = [
  {
    name: "sentry_get_stacktrace",
    description: "Full stack trace with source code context",
    // → frames com filename, function, lineno, context_line
    // Valor: mostra EXATAMENTE onde o código quebrou
  },
  {
    name: "sentry_get_breadcrumbs",
    description: "Event breadcrumbs: trail of actions before the error",
    // → HTTP request → DB query → cache miss → crash
    // Valor: reconstruir o CAMINHO que levou ao erro
  },
  {
    name: "sentry_search_similar_issues",
    description: "Find similar issues in the same project",
    // → issues com mesmo exception type, ordenados por frequência
    // Valor: "isso já aconteceu antes? como resolvemos?"
  },
  {
    name: "sentry_get_releases",
    description: "Recent releases/deploys with commits and authors",
    // → releases com commit hashes, deploy dates, authors
    // Valor: correlacionar deploy → erro (Change Detector)
  },
  {
    name: "sentry_get_event_tags",
    description: "Tags and context: server, environment, release, URL",
    // → server_name, environment, runtime version
    // Valor: qual server? qual ambiente? qual versão?
  },
];

// Exemplo de investigação completa:
// 1. Alert: "TypeError: Cannot read property 'price' of undefined"
// 2. sentry_get_stacktrace → crash em checkout.handler:45
// 3. sentry_get_breadcrumbs → POST /checkout → query products → null → crash
// 4. sentry_get_releases → deploy v2.3.4 há 2h por dev@empresa.com
// 5. Hipótese: "Deploy v2.3.4 mudou query de products, campo price ausente"
//    Confidence: 89%  |  Evidence: stacktrace + breadcrumbs + deploy timing`}</Code>
      </div>

      <Alert type="success">
        <strong>Diferencial:</strong> Sentry breadcrumbs são a melhor evidence chain que existe —
        mostram exatamente o que aconteceu antes do crash. Nenhum outro alert source tem isso.
        Nosso agent usa breadcrumbs como evidência natural na hipótese.
      </Alert>
    </div>
  ),

  "consul": () => (
    <div className="space-y-5">
      <h3 className="text-xl font-bold text-gray-900">Consul Integration — Knowledge Graph Source</h3>
      <Alert type="warning">
        <strong>Cliente 2:</strong> Consul para service discovery na Azure VPN. Fonte de verdade para topologia, health, e dependências.
      </Alert>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Consul → Knowledge Graph (sync a cada 5min)</h4>
        <Code title="src/modules/knowledge/sources/consul-sync.ts">{`// Consul HTTP API via relay → popula Knowledge Graph no DynamoDB

class ConsulKnowledgeSync {
  async sync(tenantId: string) {
    const consul = this.getConsulClient(tenantId); // via relay

    // 1. Serviços registrados
    // GET /v1/catalog/services
    const services = await consul.getServices();
    // → { "api-gateway": ["v2","prod"], "auth-service": ["v1","prod"], ... }

    // 2. Instâncias + health por serviço
    // GET /v1/health/service/:name
    for (const svc of services) {
      const instances = await consul.getServiceInstances(svc.name);
      await this.knowledgeGraph.upsertService({
        tenantId,
        serviceId: svc.name,
        instances: instances.length,
        health: worstHealth(instances), // passing|warning|critical
        tags: svc.tags,
        meta: instances[0]?.meta,       // version, team, repo URL
      });
    }

    // 3. Dependências via Consul Connect intentions
    // GET /v1/connect/intentions
    const intentions = await consul.getIntentions();
    // → [{ Source: "api-gateway", Destination: "auth-service", Action: "allow" }]
    // ISSO É O GRAFO DE DEPENDÊNCIAS — de graça!
    for (const i of intentions.filter(i => i.action === "allow")) {
      await this.knowledgeGraph.upsertDependency({
        tenantId,
        source: i.sourceName,
        target: i.destinationName,
        type: "consul_intention",
      });
    }

    // 4. Detectar mudanças (topology drift)
    const changes = this.detectChanges(tenantId, services, intentions);
    // Ex: { type: "service_unhealthy", service: "auth-service",
    //       was: "passing", now: "critical" }
    if (changes.length) {
      this.eventBus.emit("knowledge.topology_changed", { tenantId, changes });
    }
  }
}

// DynamoDB adjacency list:
// PK=T#t1|SVC#auth-service  SK=META
//   → { instances: 3, health: "passing", version: "2.3.4", team: "platform" }
// PK=T#t1|SVC#auth-service  SK=DEP#api-gateway
//   → { type: "consul_intention" }
// PK=T#t1|SVC#auth-service  SK=DEP#user-db
//   → { type: "consul_intention" }
// PK=T#t1|SVC#auth-service  SK=INC#inc-789
//   → { severity: "P2", rootCause: "..." }`}</Code>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Consul Tools para Sub-Agentes</h4>
        <Code title="Tools disponíveis quando tenant usa Consul">{`const consulTools = [
  {
    name: "consul_list_services",
    description: "All registered services with health status",
    // "Quais serviços estão rodando e qual o status de cada um?"
  },
  {
    name: "consul_get_service_health",
    description: "Detailed health for all instances of a service",
    // "O auth-service está healthy? Quantas instâncias?"
  },
  {
    name: "consul_get_dependencies",
    description: "Upstream and downstream dependencies for a service",
    // "Quem depende do auth-service? De quem ele depende?"
    // → blast radius analysis
  },
  {
    name: "consul_get_config",
    description: "Configuration from Consul KV store",
    // "Alguém mudou um feature flag ou config recentemente?"
  },
  {
    name: "consul_compare_topology",
    description: "Diff topology vs N hours ago",
    // "O que mudou na topologia nas últimas 4h?"
  },
];`}</Code>
      </div>
    </div>
  ),

  "customers": () => (
    <div className="space-y-5">
      <h3 className="text-xl font-bold text-gray-900">Deploy por Cliente — Visão Completa</h3>

      <div className="bg-white border-2 border-orange-300 rounded-lg p-5">
        <h4 className="font-bold text-orange-800 mb-3">Cliente 1: AWS + Slack + Sentry + VPC (sem K8s)</h4>
        <Code title="Arquitetura">{`
┌────────────────────────────────────────────┐
│  NOSSO SaaS (sa-east-1)                   │
│  Backend ◄── Relay Gateway (gRPC) ◄── AI  │
│  Slack Bot ────► Slack API                 │
└─────────────────────▲──────────────────────┘
                      │ gRPC/HTTP2 (443)
         ─────────────┼──── INTERNET ────────
                      │
┌─────────────────────┼──────────────────────┐
│  AWS VPC            │                      │
│  ┌──────────────────┴────────────────────┐ │
│  │  Agent Relay (ECS task ou EC2)        │ │
│  └────┬──────────────────┬───────────────┘ │
│       │                  │                 │
│  ┌────▼──────┐    ┌──────▼──────────┐     │
│  │ Sentry    │    │ CloudWatch      │     │
│  │ self-host │    │ (logs/metrics)  │     │
│  └───────────┘    └─────────────────┘     │
│  IAM Role: STS AssumeRole + External ID   │
└────────────────────────────────────────────┘

Onboarding (~30 min):
1. CloudFormation → IAM Role + External ID
2. docker compose up → Relay na VPC
3. /sre connect no Slack
4. Sentry webhook → aponta pro relay`}</Code>
      </div>

      <div className="bg-white border-2 border-blue-300 rounded-lg p-5">
        <h4 className="font-bold text-blue-800 mb-3">Cliente 2: Azure + Teams + Grafana + Consul + VPN (sem K8s)</h4>
        <Code title="Arquitetura">{`
┌────────────────────────────────────────────┐
│  NOSSO SaaS (Brazil South)                │
│  Backend ◄── Relay Gateway (gRPC) ◄── AI  │
│  Teams Bot ────► Bot Framework            │
└─────────────────────▲──────────────────────┘
                      │ gRPC/HTTP2 (443)
         ─────────────┼──── INTERNET ────────
                      │
┌─────────────────────┼──────────────────────┐
│  Azure VNet + VPN   │                      │
│  ┌──────────────────┴────────────────────┐ │
│  │  Agent Relay (ACI ou VM)              │ │
│  └────┬───────────┬──────────┬───────────┘ │
│       │           │          │             │
│  ┌────▼────┐ ┌────▼────┐ ┌──▼──────────┐ │
│  │ Grafana │ │ Consul  │ │Azure Monitor │ │
│  └─────────┘ └─────────┘ └─────────────┘ │
│  Lighthouse delegation + Managed Identity │
└────────────────────────────────────────────┘

Onboarding (~30 min):
1. ARM template → Lighthouse delegation
2. docker compose up → Relay no VNet
3. /sre connect no Teams
4. Consul auto-popula Knowledge Graph`}</Code>
      </div>

      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-bold text-green-900 mb-2">Checklist Final: 100% coberto</h4>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-bold text-gray-800 mb-1">Já tínhamos no PRD:</p>
            <p className="text-green-700">✅ AWS STS + Azure Lighthouse</p>
            <p className="text-green-700">✅ Slack + Teams adapters</p>
            <p className="text-green-700">✅ CloudWatch + Azure Monitor + Grafana parsers</p>
            <p className="text-green-700">✅ Multi-agent investigation pipeline</p>
            <p className="text-green-700">✅ Approval gates + audit trail</p>
          </div>
          <div>
            <p className="font-bold text-gray-800 mb-1">Adicionado com ADR-010:</p>
            <p className="text-blue-700">🆕 Agent Relay (gRPC, runtime-agnostic)</p>
            <p className="text-blue-700">🆕 Sentry parser + investigation tools</p>
            <p className="text-blue-700">🆕 Consul sync → Knowledge Graph</p>
            <p className="text-blue-700">🆕 .proto contract (versionado, public)</p>
            <p className="text-blue-700">🆕 ConnectRPC fallback (HTTP/1.1)</p>
          </div>
        </div>
      </div>
    </div>
  ),

  "roadmap": () => (
    <div className="space-y-5">
      <h3 className="text-xl font-bold text-gray-900">Impacto no Roadmap</h3>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Componentes por Sprint</h4>
        <table className="min-w-full bg-white border border-gray-200 rounded-lg text-xs">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left">Sprint</th>
              <th className="px-3 py-2 text-left">Componente</th>
              <th className="px-3 py-2 text-center">Dias</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {[
              ["1-2", ".proto definition + ConnectRPC server (Relay Gateway)", "+2d"],
              ["1-2", "Agent Relay container (gRPC client + endpoint router)", "+4d"],
              ["1-2", "Relay auth (token rotation, mTLS setup)", "+1d"],
              ["3-4", "Sentry parser (webhook → NormalizedAlert)", "+2d"],
              ["3-4", "Sentry client (API via relay) + investigation tools", "+2d"],
              ["3-4", "Consul client (via relay) + Knowledge Graph sync", "+3d"],
              ["3-4", "Knowledge Graph entities (ServiceNode, Dependency)", "+1d"],
              ["5-7", "Sentry tools para sub-agentes (stacktrace, breadcrumbs)", "+2d"],
              ["5-7", "Consul tools para sub-agentes (topology, deps)", "+2d"],
              ["8-9", "Relay monitoring dashboard + auto-update", "+1d"],
            ].map(([sprint, comp, days], i) => (
              <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                <td className="px-3 py-2 font-medium">{sprint}</td>
                <td className="px-3 py-2 text-gray-700">{comp}</td>
                <td className="px-3 py-2 text-center font-bold text-blue-700">{days}</td>
              </tr>
            ))}
            <tr className="bg-blue-50 font-bold">
              <td className="px-3 py-2" colSpan={2}>Total ADR-010</td>
              <td className="px-3 py-2 text-center text-blue-700">+20 dias (~4 sem)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Timeline Total</h4>
        <table className="min-w-full bg-white border border-gray-200 rounded-lg text-xs">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left">Sprint</th>
              <th className="px-3 py-2 text-center">PRD base</th>
              <th className="px-3 py-2 text-center">+ADR-009</th>
              <th className="px-3 py-2 text-center">+ADR-010</th>
              <th className="px-3 py-2 text-center">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {[
              ["Foundation + Ports", "4 sem", "+2d", "+7d (relay+proto)", "~6 sem"],
              ["Ingestion + Triage", "4 sem", "+3d", "+5d (Sentry+Consul)", "~6 sem"],
              ["Deep Search", "6 sem", "—", "+4d (tools)", "~7 sem"],
              ["Chat + Remediation", "4 sem", "+5d", "+1d", "~5 sem"],
              ["Enterprise + SOC2", "6 sem", "+2d", "—", "~6.5 sem"],
            ].map(([s, base, a9, a10, total], i) => (
              <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                <td className="px-3 py-2 font-medium">{s}</td>
                <td className="px-3 py-2 text-center">{base}</td>
                <td className="px-3 py-2 text-center text-amber-700">{a9}</td>
                <td className="px-3 py-2 text-center text-blue-700">{a10}</td>
                <td className="px-3 py-2 text-center font-bold">{total}</td>
              </tr>
            ))}
            <tr className="bg-green-50 font-bold">
              <td className="px-3 py-2">TOTAL</td>
              <td className="px-3 py-2 text-center">24 sem</td>
              <td className="px-3 py-2 text-center text-amber-700">+12d</td>
              <td className="px-3 py-2 text-center text-blue-700">+20d</td>
              <td className="px-3 py-2 text-center text-green-700">~30.5 semanas</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Alert type="info">
        <strong>Paralelização:</strong> Relay é repo separado — dev dedicado pode construir em paralelo ao core.
        Sentry parser e Consul client são módulos isolados. Com 2 devs: ~27 semanas.
      </Alert>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Project Structure Atualizada</h4>
        <Code title="Novos paths adicionados">{`src/
├── modules/
│   ├── ingestion/parsers/
│   │   └── sentry-parser.ts              # 🆕
│   ├── knowledge/
│   │   ├── graph.ts                      # 🆕 Adjacency list queries
│   │   ├── sources/
│   │   │   ├── consul-sync.ts            # 🆕
│   │   │   ├── aws-ecs-sync.ts
│   │   │   └── azure-aks-sync.ts
│   │   └── entities/
│   │       ├── service-node.ts           # 🆕
│   │       └── dependency-edge.ts        # 🆕
│
├── infra/
│   ├── relay/
│   │   ├── relay-gateway.ts              # 🆕 gRPC server (ConnectRPC)
│   │   ├── relay-router.ts              # 🆕 Route queries to connected relays
│   │   └── relay-health.ts              # 🆕 Monitor relay fleet
│   ├── sentry/
│   │   └── sentry-client.ts             # 🆕 Via relay
│   ├── consul/
│   │   └── consul-client.ts             # 🆕 Via relay
│
├── proto/
│   └── relay/v1/
│       └── relay.proto                   # 🆕 Contrato público, versionado
│
└── relay/                                # 🆕 Repo separado (OPEN-SOURCE)
    ├── Dockerfile                        #   Distroless, ~50MB
    ├── proto/ (symlink)
    ├── src/
    │   ├── main.ts
    │   ├── grpc-client.ts               #   ConnectRPC + fallback HTTP/1.1
    │   ├── endpoint-router.ts           #   Route to local endpoints
    │   ├── health.ts
    │   └── config.ts
    ├── docker-compose.yml               #   Para cliente
    └── install.sh                       #   Binary install (sem Docker)`}</Code>
      </div>
    </div>
  ),
};

export default function ADR010v2() {
  const [activeTab, setActiveTab] = useState("adr010");
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gradient-to-r from-purple-800 to-blue-800 text-white px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="bg-purple-600 px-2 py-0.5 rounded text-xs font-bold">ADR-010 v2</span>
            <h1 className="text-xl font-bold">Agent Relay — gRPC + Runtime-Agnostic</h1>
          </div>
          <p className="text-purple-200 text-sm mt-0.5">Melhor que o Resolve Satellite: sem dependência de K8s, gRPC com fallback, open-source</p>
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
