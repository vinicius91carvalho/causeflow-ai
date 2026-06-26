import { useState } from "react";

const tabs = [
  { id: "overview", label: "Visão Geral", icon: "◉" },
  { id: "decisions", label: "Decisões Técnicas", icon: "⚙" },
  { id: "arch", label: "Arquitetura", icon: "△" },
  { id: "data", label: "Data Layer", icon: "▤" },
  { id: "agents", label: "Agent Runtime", icon: "⬢" },
  { id: "obs", label: "Observabilidade", icon: "◎" },
  { id: "dx", label: "DX & Testing", icon: "▣" },
  { id: "security", label: "Security", icon: "◈" },
  { id: "impl", label: "Implementação", icon: "▶" },
];

function Badge({ children, color = "#3f3f46", bg = "#18181b" }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.04em",
        border: `1px solid ${color}`,
        background: bg,
        color,
      }}
    >
      {children}
    </span>
  );
}

function Section({ title, color = "#a1a1aa", children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3
        style={{
          fontSize: 13,
          fontWeight: 700,
          color,
          marginBottom: 12,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

function Card({ title, subtitle, border = "#27272a", children }) {
  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        background: "#0f0f12",
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#fafafa",
            marginBottom: subtitle ? 4 : 10,
          }}
        >
          {title}
        </div>
      )}
      {subtitle && (
        <div
          style={{
            fontSize: 11,
            color: "#71717a",
            marginBottom: 10,
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </div>
      )}
      {children}
    </div>
  );
}

function Code({ children }) {
  return (
    <pre
      style={{
        margin: 0,
        padding: 14,
        background: "#0a0a0c",
        borderRadius: 6,
        fontSize: 10.5,
        lineHeight: 1.55,
        color: "#d4d4d8",
        overflowX: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        border: "1px solid #1c1c1f",
      }}
    >
      {children}
    </pre>
  );
}

function DecisionCard({ title, decision, reasoning, alternatives, trade }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        border: "1px solid #27272a",
        borderRadius: 8,
        marginBottom: 8,
        background: "#0f0f12",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "12px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          color: "#fafafa",
        }}
      >
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 11, color: "#10b981", marginTop: 2 }}>
            → {decision}
          </div>
        </div>
        <span
          style={{
            color: "#71717a",
            fontSize: 11,
            transform: open ? "rotate(90deg)" : "rotate(0)",
            transition: "transform 0.15s",
          }}
        >
          ▸
        </span>
      </button>
      {open && (
        <div
          style={{
            padding: "0 14px 14px",
            borderTop: "1px solid #1c1c1f",
          }}
        >
          <div style={{ marginTop: 10 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "#6366f1",
                marginBottom: 4,
                letterSpacing: "0.04em",
              }}
            >
              RACIONAL
            </div>
            <div
              style={{ fontSize: 11, color: "#a1a1aa", lineHeight: 1.6 }}
            >
              {reasoning}
            </div>
          </div>
          {alternatives && (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#f59e0b",
                  marginBottom: 4,
                  letterSpacing: "0.04em",
                }}
              >
                ALTERNATIVAS DESCARTADAS
              </div>
              <div
                style={{ fontSize: 11, color: "#a1a1aa", lineHeight: 1.6 }}
              >
                {alternatives}
              </div>
            </div>
          )}
          {trade && (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#ef4444",
                  marginBottom: 4,
                  letterSpacing: "0.04em",
                }}
              >
                TRADE-OFFS
              </div>
              <div
                style={{ fontSize: 11, color: "#a1a1aa", lineHeight: 1.6 }}
              >
                {trade}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArchLayer({ name, color, items }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        border: `1px solid ${color}30`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 6,
        marginBottom: 6,
        background: "#0c0c0f",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          padding: "10px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          color,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.02em",
        }}
      >
        {name}
        <span
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0)",
            transition: "transform 0.15s",
          }}
        >
          ▸
        </span>
      </button>
      {open && (
        <div style={{ padding: "0 12px 10px" }}>
          {items.map((item, i) => (
            <div
              key={i}
              style={{
                padding: "6px 10px",
                background: "#111114",
                borderRadius: 4,
                marginTop: 4,
                fontSize: 11,
                color: "#a1a1aa",
                lineHeight: 1.5,
              }}
            >
              <span style={{ color, fontWeight: 600 }}>
                {item.name}
              </span>{" "}
              — {item.desc}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PRD() {
  const [tab, setTab] = useState("overview");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#09090b",
        color: "#e4e4e7",
        fontFamily:
          "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid #27272a",
          padding: "16px 20px",
          background: "linear-gradient(180deg, #0f0f12 0%, #09090b 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 5,
              background: "linear-gradient(135deg, #10b981, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
            }}
          >
            📋
          </div>
          <div>
            <h1
              style={{
                fontSize: 15,
                fontWeight: 700,
                margin: 0,
                color: "#fafafa",
              }}
            >
              PRD — AI SRE Platform
            </h1>
            <p style={{ fontSize: 10, color: "#52525b", margin: 0 }}>
              v1.0 • TypeScript + Hono + DynamoDB + ECS Fargate • Modular
              Monolith • SOC-First
            </p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div
        style={{
          display: "flex",
          gap: 1,
          padding: "8px 20px",
          borderBottom: "1px solid #18181b",
          overflowX: "auto",
          background: "#0c0c0f",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "6px 10px",
              borderRadius: 5,
              border:
                tab === t.id
                  ? "1px solid #3f3f46"
                  : "1px solid transparent",
              background: tab === t.id ? "#18181b" : "transparent",
              color: tab === t.id ? "#fafafa" : "#52525b",
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "inherit",
              transition: "all 0.12s",
            }}
          >
            <span style={{ marginRight: 4 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "20px", maxWidth: 880, margin: "0 auto" }}>
        {/* ===== OVERVIEW ===== */}
        {tab === "overview" && (
          <div>
            <Section title="◉ Visão Geral do Produto" color="#10b981">
              <Card
                title="Missão"
                border="#065f46"
              >
                <div
                  style={{
                    fontSize: 12,
                    color: "#d4d4d8",
                    lineHeight: 1.7,
                  }}
                >
                  Ser o <strong style={{ color: "#10b981" }}>primeiro AI SRE autônomo enterprise-grade do Brasil</strong>. Uma plataforma que recebe alertas de qualquer stack de observabilidade, investiga incidentes autonomamente com deep search via multi-agentes Claude, e propõe (ou executa com approval) remediações — tudo com SOC 2 + LGPD compliance desde o dia zero.
                </div>
              </Card>

              <Card title="Personas" border="#27272a">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { role: "SRE / On-call Engineer", need: "Reduzir MTTR, menos fadiga de alerta, context switching mínimo" },
                    { role: "Engineering Manager", need: "Visibilidade de incidentes, métricas de reliability, redução de toil" },
                    { role: "VP/CTO", need: "SOC 2 compliance, redução de custos, time-to-market" },
                    { role: "Platform Engineer", need: "Integração fácil, APIs, não ser mais um tool na stack" },
                  ].map((p, i) => (
                    <div key={i} style={{ padding: "8px 10px", background: "#18181b", borderRadius: 4 }}>
                      <div style={{ fontSize: 10, color: "#6366f1", fontWeight: 600 }}>{p.role}</div>
                      <div style={{ fontSize: 10, color: "#a1a1aa", marginTop: 2, lineHeight: 1.4 }}>{p.need}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Métricas de Sucesso (North Stars)" border="#27272a">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { metric: "MTTR Reduction", target: "≥ 60%", period: "vs baseline do cliente" },
                    { metric: "RCA Accuracy", target: "≥ 75%", period: "validated by human" },
                    { metric: "Alert-to-Insight", target: "< 3 min", period: "P1/P2 incidents" },
                    { metric: "Agent Cost/Incident", target: "< $2.50", period: "token + compute" },
                    { metric: "SOC 2 Type I", target: "Q2 2026", period: "audit passed" },
                    { metric: "NPS On-call", target: "≥ 50", period: "engineers satisfaction" },
                  ].map((m, i) => (
                    <div key={i} style={{ padding: "8px 10px", background: "#18181b", borderRadius: 4 }}>
                      <div style={{ fontSize: 10, color: "#71717a" }}>{m.metric}</div>
                      <div style={{ fontSize: 13, color: "#fafafa", fontWeight: 700 }}>{m.target}</div>
                      <div style={{ fontSize: 9, color: "#52525b" }}>{m.period}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Stack Definitiva" border="#6366f1">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[
                    ["Runtime", "TypeScript + Node.js 22"],
                    ["Framework", "Hono (HTTP + WebSocket)"],
                    ["Database", "DynamoDB (Single Table, DynamoORM)"],
                    ["Cache / Queue", "ElastiCache Redis + SQS"],
                    ["AI Engine", "Claude Agent SDK (TS)"],
                    ["Compute", "ECS Fargate (containers)"],
                    ["IaC", "CDK (TypeScript)"],
                    ["Observability", "LLMTrace (self-hosted) + CloudWatch"],
                    ["Testing", "AWSLocal Pro + Vitest"],
                    ["Architecture", "Modular Monolith (modlito)"],
                    ["CI/CD", "GitHub Actions + ECR"],
                    ["Security", "Vault + OPA + gVisor"],
                  ].map(([k, v], i) => (
                    <div key={i} style={{ padding: "6px 10px", background: "#18181b", borderRadius: 4, display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 10, color: "#71717a" }}>{k}</span>
                      <span style={{ fontSize: 10, color: "#c4b5fd", fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </Section>
          </div>
        )}

        {/* ===== TECHNICAL DECISIONS ===== */}
        {tab === "decisions" && (
          <div>
            <Section title="⚙ Decisões Técnicas — ADRs" color="#f59e0b">
              <div style={{ fontSize: 11, color: "#71717a", marginBottom: 16, lineHeight: 1.6 }}>
                Cada decisão é um ADR (Architecture Decision Record) com racional, alternativas descartadas e trade-offs.
              </div>

              <DecisionCard
                title="ADR-001: Onde rodar os agentes?"
                decision="ECS Fargate com containers efêmeros por investigação"
                reasoning="O Claude Agent SDK mantém estado conversacional e executa comandos em ambiente persistente — isso elimina Lambda. A Anthropic recomenda explicitamente containers sandboxed para o SDK. Fargate dá isolamento por task sem gerenciar EC2. O custo dominante são tokens (~$0.05/hr container vs ~$2-5/investigação em tokens). Container efêmero = spin up no alerta, investigar, spin down. Para deep search com multi-turns longos (10-30 turns), Lambda tem timeout de 15min que não é suficiente. O cold start de Fargate (~30s) é aceitável porque o alerta já tem latência natural."
                alternatives="Lambda: Timeout de 15min é hard limit. Para investigações complexas (P1/P2) que podem levar 20-40min com deep search, é deal-breaker. Custo de GB/s em Lambda para processamento intensivo de tokens é mais caro que Fargate sustained. Não suporta o padrão de long-running agent loop do SDK. | EC2: Overhead operacional de gerenciar instâncias. Sem scale-to-zero. Segurança mais difícil (shared kernel). | EKS: Muito complexo para o estágio atual. Overhead operacional de gerenciar cluster K8s. Vai ser avaliado em fase 2 se precisarmos de scheduling mais fino."
                trade="Cold start de ~30s no Fargate (mitigação: manter 1 warm task por tenant tier). Custo de container idle se configurado com min tasks > 0. Complexidade de orchestrar lifecycle de containers efêmeros."
              />

              <DecisionCard
                title="ADR-002: Um agente ou multi-agentes?"
                decision="Multi-agente com Orchestrator + Sub-agentes especializados"
                reasoning="O padrão da Resolve.ai (multi-agent parallel hypothesis) prova que investigações de incidentes se beneficiam de especialização. Cada sub-agente tem system prompt otimizado para sua domain (logs, infra, changes, runbooks). Investigação paralela reduz latência total (3 agentes paralelos em 2min > 1 agente sequencial em 6min). O Claude Agent SDK suporta sub-agentes nativamente via Task tool. Isolamento de contexto: cada sub-agente recebe APENAS o contexto que precisa (least privilege de informação). Facilita eval: podemos avaliar qualidade de cada sub-agente independentemente."
                alternatives="Agente único com tools: Mais simples, mas perde paralelismo e especialização. Context window se enche rápido com dados de logs + infra + código. Não permite eval granular por domínio. | Framework externo (LangGraph, CrewAI): Adiciona dependência e complexidade. O Claude Agent SDK já tem primitivos suficientes. Preferimos zero-dependency no core."
                trade="Mais tokens consumidos (cada sub-agente tem seu próprio contexto). Orquestração adicional no Orchestrator. Necessidade de definir well-typed contracts entre agentes."
              />

              <DecisionCard
                title="ADR-003: Performance sem perder qualidade de análise"
                decision="Estratégia de 3 camadas: Triage rápido → Deep Search → Synthesis"
                reasoning="Nem todo alerta precisa de deep search. Camada 1 (Triage): Sonnet 4.5 classifica severidade e decide se precisa investigar (< 5s, ~$0.02). Camada 2 (Deep Search): Para P1/P2, sub-agentes Sonnet 4.5 investigam em paralelo (~2-5min, ~$1-3). Camada 3 (Synthesis): Orchestrator Opus sintetiza apenas quando necessário para hipóteses complexas (~30s, ~$0.50). 80% dos alertas são resolvidos na Camada 1 (noise filtering, known patterns). Isso mantém custo médio baixo sem sacrificar profundidade nos incidents que importam."
                alternatives="Opus para tudo: Custo proibitivo (~10x mais caro que Sonnet). Latência maior sem ganho proporcional para triage simples. | Sonnet para tudo: Perde capacidade de reasoning profundo nos P1 complexos. | Modelo local (Llama): Sem tooling, sem qualidade comparável, overhead operacional imenso."
                trade="Complexidade de routing entre modelos. Necessidade de definir thresholds de escalation bem calibrados. Risco de under-escalation (mitigação: bias para investigar na dúvida, métricas de accuracy por camada)."
              />

              <DecisionCard
                title="ADR-004: Por que Modular Monolith e não Microservices?"
                decision="Modlito: um único deployable, módulos isolados por bounded context"
                reasoning="No estágio atual (0→1), velocidade de iteração > distribuição. Um monolito modular roda inteiro com `docker compose up` em localhost. Refatorar para microservices depois é trivial se os módulos estão bem isolados (cada módulo = futuro service). Debugging é 10x mais fácil (single process, single log stream). Deploy é 1 container ao invés de 5+. Compartilhamento de tipos TypeScript entre módulos sem gRPC/proto. Testes e2e cobrem o sistema inteiro sem orchestração de múltiplos services."
                alternatives="Microservices desde o início: Over-engineering para um time pequeno. Network latency entre services. Distributed tracing obrigatório. Docker compose com 10+ containers para dev local. | Serverless (Lambda functions): Já descartado pelo ADR-001. Fragmentação de código em 50+ functions dificulta reasoning sobre o sistema."
                trade="Risk de acoplamento se não disciplinar module boundaries. Single point of failure (mitigação: Fargate multi-AZ + health checks). Scaling é uniform (todo o monolito scala junto)."
              />

              <DecisionCard
                title="ADR-005: DynamoDB Single Table com DynamoORM"
                decision="Uma tabela DynamoDB com DynamoORM para type-safe single-table design"
                reasoning="DynamoDB dá single-digit ms latency para lookups por PK/SK — perfeito para buscar incidentes, tenants, audit trail. DynamoORM abstrai a complexidade de single-table design mantendo type safety pleno em TypeScript. Collections do DynamoORM = joins eficientes (buscar incident + evidências + timeline em uma query). Pay-per-request pricing = custo zero quando idle, escala infinita sem provisioning. Funciona 100% com AWSLocal Pro para testes locais. Sem overhead de connection pooling, migrations, ou schema changes."
                alternatives="PostgreSQL (RDS/Aurora): Ótimo para queries ad-hoc, mas overhead de connection management, migrations, e cold start em serverless. Custo mínimo de ~$50/mês mesmo idle. | MongoDB: Sem type safety forte. Custo operacional de gerenciar cluster. | Supabase/Planetscale: Vendor lock-in diferente, sem vantagem clara sobre DynamoDB para nosso access pattern."
                trade="Queries ad-hoc são limitadas (sem SQL JOIN). GSIs têm custo adicional. Mudanças de access pattern requerem redesign de indexes. Mitigação: usar DynamoDB Streams → OpenSearch para queries analíticas."
              />

              <DecisionCard
                title="ADR-006: LLMTrace self-hosted para Agent Observability"
                decision="LLMTrace self-hosted no Fargate para observability de LLM/agentes"
                reasoning="LLMTrace é open-source, tem integração nativa com Anthropic/Bedrock, e pode ser self-hosted no Fargate (data sovereignty = LGPD). Captura traces completos de cada investigação (cada turn, cada tool call, cada token). Permite prompt versioning e A/B testing de system prompts com dados reais. Evals: LLM-as-judge para avaliar qualidade de RCA automaticamente. Métricas de cost, latency, accuracy por sub-agente, por tenant, por tipo de incidente. Dataset management para criar suites de eval. NÃO precisamos alterar prompts por intuição — temos dados."
                alternatives="Helicone: Closed-source, dados fora do Brasil. | Datadog LLM Observability: Caro, vendor lock-in. | Custom solution: Reinventar a roda, months de desenvolvimento. | Arize/Phoenix: Menos maduro, menos community."
                trade="Overhead de hospedar + manter LLMTrace (mitigação: Fargate auto-scaling + IaC). Outra infra para gerenciar. Storage de traces pode crescer (mitigação: retention policies + S3 archive)."
              />

              <DecisionCard
                title="ADR-007: AWSLocal Pro para ambiente de testes"
                decision="AWSLocal Pro para simular AWS completa (DynamoDB, SQS, Secrets Manager, etc.)"
                reasoning="Permite rodar TODA a infra AWS localmente: DynamoDB, SQS, Secrets Manager, CloudWatch, IAM. Testes e2e rodam contra infra real-like sem custo AWS. Cada PR pode ter seu próprio stack efêmero. Para onboarding de clientes: podemos criar 'sandbox environments' que simulam o ambiente do cliente para testar integrações. CI/CD roda testes contra AWSLocal antes de deploy — zero surpresas. Testes de eval do agente podem rodar contra dados sintéticos em DynamoDB local."
                alternatives="AWS real em conta de dev: Custo, lentidão, cleanup difícil. | Moto (mock AWS): Menos fidelidade que AWSLocal Pro, gaps em serviços complexos. | TestHarness: Bom para DB, mas não simula serviços AWS managed."
                trade="Custo da licença Pro (~$35/dev/mês). Nem 100% fidedigno ao AWS real (edge cases). Para DynamoDB, AWSLocal Pro tem excelente fidelidade."
              />
            </Section>
          </div>
        )}

        {/* ===== ARCHITECTURE ===== */}
        {tab === "arch" && (
          <div>
            <Section title="△ Arquitetura — Modular Monolith" color="#6366f1">
              <Card
                title="Visão de alto nível"
                subtitle="Um container ECS Fargate por instância. Internamente, módulos isolados por bounded context. Comunicação interna via in-process event bus."
                border="#6366f1"
              >
                <Code>{`project/
├── src/
│   ├── main.ts                    # Entry point (Hono app)
│   ├── shared/                    # Shared kernel
│   │   ├── config/                # Environment, feature flags
│   │   ├── auth/                  # JWT validation, RBAC
│   │   ├── events/                # In-process EventBus (typed)
│   │   ├── db/                    # DynamoORM service + entities
│   │   ├── errors/                # Error hierarchy
│   │   ├── middleware/            # Rate limit, audit, cors, tenant
│   │   └── types/                 # Shared domain types
│   │
│   ├── modules/
│   │   ├── ingestion/             # 🔌 Alert intake
│   │   │   ├── routes.ts          # POST /webhooks/:provider
│   │   │   ├── parsers/           # Datadog, Grafana, Prometheus, etc.
│   │   │   ├── normalizer.ts      # Alert → canonical IncidentEvent
│   │   │   └── dedup.ts           # Deduplication + correlation
│   │   │
│   │   ├── triage/                # 🎯 Fast classification (Camada 1)
│   │   │   ├── classifier.ts      # Sonnet: severity, service, urgency
│   │   │   ├── noise-filter.ts    # Known patterns, auto-resolve
│   │   │   └── escalation.ts      # Decide: auto-resolve | investigate
│   │   │
│   │   ├── investigation/         # 🔍 Deep Search (Camada 2+3)
│   │   │   ├── orchestrator.ts    # Main agent loop
│   │   │   ├── agents/
│   │   │   │   ├── log-analyzer.ts
│   │   │   │   ├── infra-inspector.ts
│   │   │   │   ├── change-detector.ts
│   │   │   │   └── runbook-executor.ts
│   │   │   ├── synthesis.ts       # Hypothesis ranking
│   │   │   └── evidence.ts        # Evidence chain builder
│   │   │
│   │   ├── remediation/           # 🔧 Actions + Approval
│   │   │   ├── approval-gate.ts   # Human-in-the-loop
│   │   │   ├── executor.ts        # Sandboxed action execution
│   │   │   └── rollback.ts        # Auto-rollback on failure
│   │   │
│   │   ├── knowledge/             # 🧠 Learning + Knowledge Graph
│   │   │   ├── graph.ts           # Service dependency map
│   │   │   ├── patterns.ts        # Past incident patterns
│   │   │   └── runbooks.ts        # Customer runbook store
│   │   │
│   │   ├── tenant/                # 🏢 Multi-tenancy
│   │   │   ├── routes.ts          # CRUD tenants, integrations
│   │   │   ├── onboarding.ts      # Setup wizard
│   │   │   └── billing.ts         # Usage tracking
│   │   │
│   │   └── audit/                 # 📋 Compliance & Audit
│   │       ├── logger.ts          # Immutable audit trail
│   │       ├── hash-chain.ts      # Tamper-proof verification
│   │       └── export.ts          # SOC 2 report generation
│   │
│   └── infra/                     # Infrastructure adapters
│       ├── dynamodb.ts            # DynamoDB client + DynamoORM svc
│       ├── sqs.ts                 # Queue producer/consumer
│       ├── redis.ts               # Cache client
│       ├── claude.ts              # Agent SDK wrapper
│       ├── slack.ts               # Slack Bot (approval + notifs)
│       └── secrets.ts             # Vault / Secrets Manager
│
├── cdk/                           # AWS CDK (TypeScript)
│   ├── stacks/
│   │   ├── network.ts             # VPC, subnets, security groups
│   │   ├── compute.ts             # ECS cluster, task definitions
│   │   ├── data.ts                # DynamoDB, ElastiCache, SQS
│   │   ├── observability.ts       # LLMTrace stack, CloudWatch
│   │   └── security.ts            # Secrets Manager, IAM roles
│   └── app.ts
│
├── docker/
│   ├── Dockerfile                 # Multi-stage build
│   ├── Dockerfile.agent           # Agent container (gVisor)
│   └── docker-compose.yml         # Local dev (all services)
│
├── tests/
│   ├── unit/                      # Vitest unit tests
│   ├── integration/               # AWSLocal Pro tests
│   ├── eval/                      # Agent evaluation suites
│   │   ├── datasets/              # Known incident scenarios
│   │   ├── judges/                # LLM-as-judge evaluators
│   │   └── runner.ts              # Eval pipeline
│   └── e2e/                       # Full flow tests
│
└── awslocal/
    ├── init-aws.sh                # Bootstrap DynamoDB, SQS, etc.
    └── terraform/                 # AWSLocal infra (optional)`}</Code>
              </Card>

              <div style={{ fontSize: 11, color: "#a1a1aa", marginBottom: 12, lineHeight: 1.6 }}>
                Cada módulo tem interface pública (routes + events emitidos) e internals privados. Comunicação entre módulos é APENAS via typed EventBus ou explicit imports de types.
              </div>

              <ArchLayer
                name="EDGE — API Gateway + Auth"
                color="#10b981"
                items={[
                  { name: "Hono Router", desc: "Routes com middleware chain: auth → tenant → rate-limit → audit → handler" },
                  { name: "JWT + RBAC", desc: "JWT validation com roles (admin, engineer, viewer). API keys para webhooks." },
                  { name: "Tenant Context", desc: "Middleware injeta tenantId em cada request. Toda query DynamoDB usa tenantId como PK prefix." },
                ]}
              />
              <ArchLayer
                name="MODULES — Business Logic"
                color="#6366f1"
                items={[
                  { name: "Ingestion", desc: "Normaliza alertas de N providers para formato canônico. Dedup por fingerprint." },
                  { name: "Triage", desc: "Classificação rápida com Sonnet. Noise filter baseado em patterns conhecidos." },
                  { name: "Investigation", desc: "Deep Search orquestrado. Sub-agentes paralelos. Hypothesis ranking." },
                  { name: "Remediation", desc: "Propõe ações. Approval gate via Slack. Executa em sandbox. Rollback automático." },
                  { name: "Knowledge", desc: "Knowledge graph de serviços. Pattern matching. Runbook storage." },
                ]}
              />
              <ArchLayer
                name="INFRA — Adapters & External"
                color="#f59e0b"
                items={[
                  { name: "DynamoDB", desc: "DynamoORM entities. Single table. Collections para queries complexas." },
                  { name: "SQS", desc: "Alert queue (buffer). Investigation queue (async processing)." },
                  { name: "Redis", desc: "Cache de triage decisions. Rate limiting counters. Session state." },
                  { name: "Claude SDK", desc: "Wrapper com retry, circuit breaker, token tracking, audit logging." },
                  { name: "LLMTrace", desc: "Trace de cada agent call. Prompt versioning. Eval scores." },
                ]}
              />
              <ArchLayer
                name="AGENT CONTAINERS — Isolated Runtime"
                color="#ef4444"
                items={[
                  { name: "gVisor runtime", desc: "Intercepta syscalls em userspace. Mesmo se agent for comprometido, não escapa." },
                  { name: "Network: --network none", desc: "Agent só se comunica via Unix socket → proxy. Proxy controla allowlist de domains." },
                  { name: "Credentials: Envoy proxy", desc: "Credenciais NUNCA no container. Proxy injeta API keys nas requests." },
                  { name: "Ephemeral", desc: "Container criado por investigação, destruído ao terminar. Zero state residual." },
                ]}
              />
            </Section>
          </div>
        )}

        {/* ===== DATA LAYER ===== */}
        {tab === "data" && (
          <div>
            <Section title="▤ Data Layer — DynamoDB Single Table Design" color="#f59e0b">
              <Card
                title="DynamoORM Entity Design"
                subtitle="Uma tabela, múltiplas entities. Partition Key = tenantId prefix. GSIs para access patterns secundários."
                border="#f59e0b"
              >
                <Code>{`// src/shared/db/entities/incident.ts
// ── DynamoORM Entity Definition ──
const { Entity } = DynamoORM;

export const Incident = new Entity({
  model: {
    entity: 'incident',
    version: '1',
    service: 'sre'
  },
  attributes: {
    tenantId:    { type: 'string', required: true },
    incidentId:  { type: 'string', required: true },
    severity:    { type: ['P1','P2','P3','P4'] as const, required: true },
    status:      { type: ['open','investigating','mitigated','resolved'] as const },
    title:       { type: 'string' },
    sourceAlert: { type: 'map', properties: {
      provider: { type: 'string' },  // datadog, grafana, etc.
      alertId:  { type: 'string' },
      rawPayload: { type: 'string' } // JSON stringified
    }},
    services:    { type: 'set', items: 'string' },
    hypothesis:  { type: 'list', items: { type: 'map', properties: {
      rank:       { type: 'number' },
      cause:      { type: 'string' },
      confidence: { type: 'number' },
      evidence:   { type: 'list', items: 'string' },
      remediation:{ type: 'string' }
    }}},
    timeline:    { type: 'list', items: { type: 'map', properties: {
      timestamp:  { type: 'string' },
      action:     { type: 'string' },
      actor:      { type: 'string' }, // agent:orchestrator | human:john
      detail:     { type: 'string' }
    }}},
    metrics:     { type: 'map', properties: {
      ttd:        { type: 'number' }, // time to detect (ms)
      tti:        { type: 'number' }, // time to investigate (ms)
      ttr:        { type: 'number' }, // time to resolve (ms)
      tokenCost:  { type: 'number' }, // total tokens used
      agentTurns: { type: 'number' }
    }},
    createdAt:   { type: 'string', default: () => new Date().toISOString() },
    resolvedAt:  { type: 'string' },
  },
  indexes: {
    // PK: tenant, SK: incident (get by ID, list by tenant)
    primary: {
      pk: { field: 'pk', composite: ['tenantId'] },
      sk: { field: 'sk', composite: ['incidentId'] }
    },
    // GSI1: severity + status (filter by priority)
    bySeverity: {
      index: 'gsi1pk-gsi1sk-index',
      pk: { field: 'gsi1pk', composite: ['tenantId'] },
      sk: { field: 'gsi1sk', composite: ['severity', 'status'] }
    },
    // GSI2: time-based (recent incidents)
    byTime: {
      index: 'gsi2pk-gsi2sk-index',
      pk: { field: 'gsi2pk', composite: ['tenantId'] },
      sk: { field: 'gsi2sk', composite: ['createdAt'] }
    }
  }
});

// Collection: buscar incident + evidências + audit em 1 query
export const IncidentDetail = new Service({
  incident: Incident,
  evidence: Evidence,
  auditLog: AuditEntry,
});
// → IncidentDetail.collection.byIncident({ tenantId, incidentId })`}</Code>
              </Card>

              <Card title="Access Patterns" border="#27272a">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[
                    ["Get incident by ID", "PK=tenant, SK=incident"],
                    ["List incidents by tenant", "PK=tenant, SK begins_with"],
                    ["Filter by severity+status", "GSI1: tenant + severity#status"],
                    ["Recent incidents", "GSI2: tenant + createdAt (desc)"],
                    ["Incident + evidence + audit", "Collection: byIncident"],
                    ["Agent audit trail", "PK=tenant, SK=audit#timestamp"],
                    ["Tenant config", "PK=tenant, SK=config#"],
                    ["Runbooks by service", "PK=tenant, SK=runbook#service"],
                  ].map(([pattern, impl], i) => (
                    <div key={i} style={{ padding: "6px 8px", background: "#18181b", borderRadius: 4 }}>
                      <div style={{ fontSize: 10, color: "#fbbf24", fontWeight: 600 }}>{pattern}</div>
                      <div style={{ fontSize: 10, color: "#71717a", marginTop: 2 }}>{impl}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="DynamoDB Streams → OpenSearch (Fase 2)" subtitle="Para queries analíticas que DynamoDB não suporta bem." border="#27272a">
                <div style={{ fontSize: 11, color: "#a1a1aa", lineHeight: 1.6 }}>
                  DynamoDB Streams captura changes → Lambda fan-out → OpenSearch para: full-text search em incident details, analytics dashboard (MTTR trends, patterns), correlation queries cross-tenant (anonimizadas). Não é blocker para MVP — DynamoORM Collections cobrem 90% dos access patterns.
                </div>
              </Card>
            </Section>
          </div>
        )}

        {/* ===== AGENT RUNTIME ===== */}
        {tab === "agents" && (
          <div>
            <Section title="⬢ Agent Runtime — Claude Agent SDK" color="#a78bfa">
              <Card
                title="Estratégia de 3 Camadas"
                border="#7c3aed"
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    {
                      layer: "Camada 1: Triage",
                      model: "Sonnet 4.5",
                      latency: "< 5s",
                      cost: "~$0.02",
                      desc: "Classifica, filtra noise, decide se investiga",
                      pct: "80% dos alertas resolvidos aqui"
                    },
                    {
                      layer: "Camada 2: Deep Search",
                      model: "Sonnet 4.5 × N",
                      latency: "2-5 min",
                      cost: "~$1-3",
                      desc: "Sub-agentes paralelos investigam",
                      pct: "P1/P2 incidents"
                    },
                    {
                      layer: "Camada 3: Synthesis",
                      model: "Opus 4.5",
                      latency: "~30s",
                      cost: "~$0.50",
                      desc: "Sintetiza hipóteses complexas",
                      pct: "Apenas quando necessário"
                    },
                  ].map((l, i) => (
                    <div key={i} style={{ padding: 10, background: "#18181b", borderRadius: 6, border: "1px solid #27272a" }}>
                      <div style={{ fontSize: 10, color: "#a78bfa", fontWeight: 700, marginBottom: 6 }}>{l.layer}</div>
                      <div style={{ fontSize: 10, color: "#fafafa" }}>{l.model}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                        <Badge color="#10b981" bg="#052e16">{l.latency}</Badge>
                        <Badge color="#f59e0b" bg="#1c1917">{l.cost}</Badge>
                      </div>
                      <div style={{ fontSize: 9, color: "#71717a", marginTop: 6, lineHeight: 1.4 }}>{l.desc}</div>
                      <div style={{ fontSize: 9, color: "#6366f1", marginTop: 4, fontWeight: 600 }}>{l.pct}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Agent SDK Wrapper — Production-Grade" border="#7c3aed">
                <Code>{`// src/infra/claude.ts — Production wrapper
// ── Claude Agent SDK ──
const { ClaudeSDKClient, ClaudeAgentOptions } = AgentSDK;
// ── LLM Observability SDK ──
const { LLMTraceClient } = ObservabilitySDK;

interface AgentConfig {
  name: string;
  systemPrompt: string;
  model: 'sonnet' | 'opus';
  maxTurns: number;
  tools: string[];
  tenantId: string;
  incidentId: string;
}

export class SecureAgentRunner {
  private llmtrace: LLMTrace;
  private metrics: AgentMetrics;

  constructor(private config: AgentConfig) {
    this.llmtrace = new LLMTrace({ /* self-hosted config */ });
    this.metrics = new AgentMetrics(config.name);
  }

  async run(prompt: string): Promise<AgentResult> {
    const trace = this.llmtrace.trace({
      name: \`\${this.config.name}:\${this.config.incidentId}\`,
      metadata: {
        tenantId: this.config.tenantId,
        model: this.config.model,
      },
    });

    const startTime = Date.now();
    let totalTokens = 0;
    let turns = 0;

    try {
      const client = new ClaudeSDKClient({
        systemPrompt: this.config.systemPrompt,
        model: this.config.model === 'opus' 
          ? 'claude-opus-4-6' 
          : 'claude-sonnet-4-5-20250929',
        maxTurns: this.config.maxTurns,
        allowedTools: this.config.tools,
        permissionMode: 'plan', // NUNCA acceptEdits
      });

      const results: any[] = [];

      for await (const msg of client.stream(prompt)) {
        turns++;
        
        // Track tokens per turn
        const span = trace.span({
          name: \`turn-\${turns}\`,
          input: { prompt: msg.input },
          output: { response: msg.output },
        });

        // Circuit breaker: abort se agente entrar em loop
        if (turns > this.config.maxTurns) {
          span.update({ metadata: { aborted: 'max_turns' } });
          break;
        }

        // Output validation antes de qualquer ação
        if (msg.toolUse) {
          const validated = await this.validateAction(msg.toolUse);
          if (!validated.safe) {
            span.update({ metadata: { blocked: validated.reason } });
            continue; // Skip unsafe action
          }
        }

        results.push(msg);
        span.end();
      }

      const duration = Date.now() - startTime;
      
      // Métricas para LLMTrace + CloudWatch
      trace.update({
        output: { results },
        metadata: { duration, turns, totalTokens },
      });
      
      this.metrics.record({
        duration, turns, totalTokens, success: true
      });

      return { results, duration, turns, totalTokens };

    } catch (error) {
      trace.update({ 
        output: { error: error.message },
        metadata: { failed: true }
      });
      this.metrics.record({ success: false, error });
      throw error;
    } finally {
      trace.end();
      await this.llmtrace.flushAsync();
    }
  }

  private async validateAction(toolUse: any): Promise<ValidationResult> {
    // OPA policy check: is this action allowed for this tenant?
    // Destructive actions (rollback, scale) ALWAYS require approval
    // Read-only actions (query logs, check metrics) auto-approved
    return PolicyEngine.evaluate(
      this.config.tenantId,
      toolUse
    );
  }
}`}</Code>
              </Card>

              <Card title="Sub-Agent Prompts — Versionados no LLMTrace" border="#27272a">
                <div style={{ fontSize: 11, color: "#a1a1aa", lineHeight: 1.6 }}>
                  Cada system prompt é gerenciado como um Prompt no LLMTrace com versioning. Isso permite: A/B test de prompts com métricas reais de accuracy, rollback de prompt se quality degradar, histórico de changes por prompt, e linking prompt version → trace → eval score. O fluxo é: alterar prompt no LLMTrace → rodar eval suite → comparar scores → promover versão.
                </div>
              </Card>
            </Section>
          </div>
        )}

        {/* ===== OBSERVABILITY ===== */}
        {tab === "obs" && (
          <div>
            <Section title="◎ Observabilidade — Data-Driven, não intuição" color="#10b981">
              <Card
                title="Stack de Observability"
                border="#065f46"
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    {
                      tool: "LLMTrace (self-hosted)",
                      purpose: "Agent observability",
                      tracks: "Traces, token cost, latency, prompt versions, eval scores"
                    },
                    {
                      tool: "CloudWatch",
                      purpose: "Infra observability",
                      tracks: "Container metrics, API latency, error rates, SQS depth"
                    },
                    {
                      tool: "OpenTelemetry (Hono)",
                      purpose: "Application tracing",
                      tracks: "Request traces, module spans, external call durations"
                    },
                    {
                      tool: "CloudWatch Custom Metrics",
                      purpose: "Business metrics",
                      tracks: "MTTR, incidents/day, triage accuracy, agent accuracy"
                    },
                  ].map((t, i) => (
                    <div key={i} style={{ padding: 10, background: "#18181b", borderRadius: 6 }}>
                      <div style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}>{t.tool}</div>
                      <div style={{ fontSize: 10, color: "#fafafa", marginTop: 2 }}>{t.purpose}</div>
                      <div style={{ fontSize: 10, color: "#71717a", marginTop: 4, lineHeight: 1.4 }}>{t.tracks}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Agent Eval Pipeline — MLOps S-Tier" subtitle="Não alteramos prompts por intuição. Alteramos por dados." border="#10b981">
                <Code>{`// tests/eval/runner.ts — Evaluation Pipeline
interface EvalScenario {
  id: string;
  name: string;
  input: {
    alert: CanonicalAlert;     // O alerta que dispara investigação
    mockData: {                // Dados mockados do "ambiente"
      logs: string[];
      metrics: MetricPoint[];
      recentDeploys: Deploy[];
      infraState: InfraSnapshot;
    };
  };
  expected: {
    rootCause: string;         // RCA esperado (human-validated)
    severity: 'P1'|'P2'|'P3'|'P4';
    affectedServices: string[];
    remediation: string;       // Ação esperada
  };
}

// Pipeline:
// 1. Load dataset de scenarios (DynamoDB ou JSON)
// 2. Para cada scenario, rodar agent pipeline
// 3. Comparar output vs expected (LLM-as-judge)
// 4. Calcular scores (accuracy, precision, recall)
// 5. Push scores → LLMTrace (linked to prompt version)
// 6. Dashboard: compare prompt versions by score

async function runEvalSuite(
  promptVersion: string,
  scenarios: EvalScenario[]
) {
  const results = [];
  
  for (const scenario of scenarios) {
    const agentOutput = await runAgentPipeline(scenario.input);
    
    // LLM-as-Judge: Claude avalia se o RCA está correto
    const judgeScore = await llmJudge({
      scenario: scenario.expected,
      agentOutput,
      rubric: \`
        Score 0-1 on each:
        - rootCauseAccuracy: RCA matches expected?
        - severityAccuracy: Severity correct?
        - actionRelevance: Remediation makes sense?
        - evidenceQuality: Evidence chain is solid?
      \`
    });
    
    // Push score to LLMTrace linked to prompt version
    llmtrace.score({
      traceId: agentOutput.traceId,
      name: 'eval_accuracy',
      value: judgeScore.overall,
      comment: judgeScore.reasoning,
    });
    
    results.push({ scenario: scenario.id, ...judgeScore });
  }
  
  return calculateSuiteMetrics(results);
}

// Run on every prompt change:
// $ pnpm eval --prompt-version=v12 --suite=standard
// Output: v12 accuracy=0.78 vs v11 accuracy=0.74 ✅ +5.4%`}</Code>
              </Card>

              <Card title="Dashboards — O que medimos" border="#27272a">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {[
                    "RCA accuracy (por agente)",
                    "MTTR (por tenant, por severity)",
                    "Token cost/investigação",
                    "Triage accuracy (noise filter)",
                    "Latência P50/P95/P99",
                    "Agent turns/investigação",
                    "Prompt version performance",
                    "Escalation rate (C1→C2→C3)",
                    "Human override rate",
                    "Eval suite regression",
                    "Incidents/dia por tenant",
                    "Cost per tenant per month",
                  ].map((m, i) => (
                    <div key={i} style={{ padding: "6px 8px", background: "#18181b", borderRadius: 4, fontSize: 10, color: "#a1a1aa" }}>
                      {m}
                    </div>
                  ))}
                </div>
              </Card>
            </Section>
          </div>
        )}

        {/* ===== DX & TESTING ===== */}
        {tab === "dx" && (
          <div>
            <Section title="▣ Developer Experience & Testing" color="#f59e0b">
              <Card title="Local Dev — Um comando" border="#f59e0b">
                <Code>{`# docker-compose.yml — Dev environment completo
services:
  app:
    build: .
    ports: ["3000:3000"]
    volumes: ["./src:/app/src"]  # Hot reload
    environment:
      - NODE_ENV=development
      - DYNAMODB_ENDPOINT=http://awslocal:4566
      - SQS_ENDPOINT=http://awslocal:4566
      - REDIS_URL=redis://redis:6379
      - TRACE_HOST=http://llmtrace:3001
      - ANTHROPIC_API_KEY=\${ANTHROPIC_API_KEY}
    depends_on: [awslocal, redis, llmtrace]

  awslocal:
    image: awslocal/awslocal-pro
    ports: ["4566:4566"]
    environment:
      - AWSLOCAL_AUTH_TOKEN=\${AWSLOCAL_AUTH_TOKEN}
      - SERVICES=dynamodb,sqs,secretsmanager,iam,cloudwatch
      - DYNAMODB_SHARE_DB=1
    volumes:
      - "./awslocal/init-aws.sh:/etc/awslocal/init/ready.d/init.sh"

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  llmtrace:
    image: llmtrace/llmtrace:2
    ports: ["3001:3000"]
    environment:
      - DATABASE_URL=postgresql://llmtrace:llmtrace@llmtrace-db:5432/llmtrace
    depends_on: [llmtrace-db]
    
  llmtrace-db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=llmtrace
      - POSTGRES_PASSWORD=llmtrace
      - POSTGRES_DB=llmtrace

# Dev commands:
# pnpm dev        → docker compose up + hot reload
# pnpm test       → vitest (unit + integration contra AWSLocal)
# pnpm eval       → run eval suite against real Claude
# pnpm test:e2e   → full flow: webhook → triage → investigate → resolve`}</Code>
              </Card>

              <Card title="Testing Strategy — Pirâmide com Eval" border="#27272a">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    {
                      level: "Unit Tests (Vitest)",
                      desc: "Parsers, normalizers, dedup logic, DynamoORM entities. Mocked dependencies. Fast, deterministic.",
                      pct: "~60%"
                    },
                    {
                      level: "Integration Tests (AWSLocal)",
                      desc: "DynamoDB CRUD, SQS publish/consume, full module flows against real-like AWS services.",
                      pct: "~25%"
                    },
                    {
                      level: "Agent Evals (LLMTrace)",
                      desc: "Known scenarios → agent pipeline → LLM-as-judge. Mede accuracy, cost, latency. Roda em CI para cada PR que toca prompts.",
                      pct: "~10%"
                    },
                    {
                      level: "E2E Tests",
                      desc: "Webhook HTTP → full pipeline → Slack notification. Usa AWSLocal + mock Slack API. Smoke test de cada deploy.",
                      pct: "~5%"
                    },
                  ].map((t, i) => (
                    <div key={i} style={{ padding: 10, background: "#18181b", borderRadius: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#fbbf24", fontWeight: 600 }}>{t.level}</span>
                        <Badge color="#71717a">{t.pct}</Badge>
                      </div>
                      <div style={{ fontSize: 10, color: "#a1a1aa", marginTop: 4, lineHeight: 1.4 }}>{t.desc}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="AWSLocal Pro — Sandbox por Cliente" subtitle="Para onboarding e testes de integração com ambiente do cliente" border="#f59e0b">
                <Code>{`// tests/integration/sandbox.ts
// Cria ambiente efêmero que simula infra do cliente

// ── AWS Local Testing Container ──
const { LocalContainer } = TestHarness;

async function createClientSandbox(clientConfig: ClientConfig) {
  const container = await new AWSLocalContainer()
    .withServices('dynamodb,sqs,cloudwatch,secretsmanager')
    .start();

  // Seed com dados sintéticos que simulam o ambiente do cliente
  await seedDynamoDB(container, {
    services: clientConfig.services,     // api, db, cache, etc.
    incidents: generateSyntheticIncidents(50),
    runbooks: clientConfig.runbooks,
  });

  // Simula alertas do provider do cliente
  await seedSQS(container, {
    alerts: generateAlerts({
      provider: clientConfig.alertProvider, // datadog, grafana
      patterns: clientConfig.commonPatterns,
    }),
  });

  return {
    endpoint: container.getConnectionUri(),
    cleanup: () => container.stop(),
  };
}

// Usage no CI:
// 1. Cria sandbox com config do prospect
// 2. Roda agent pipeline contra sandbox
// 3. Valida que integrações funcionam
// 4. Gera relatório de compatibility
// 5. Destrói sandbox`}</Code>
              </Card>
            </Section>
          </div>
        )}

        {/* ===== SECURITY ===== */}
        {tab === "security" && (
          <div>
            <Section title="◈ Security — SOC-First Architecture" color="#ef4444">
              <Card title="Threat Model (STRIDE)" border="#991b1b">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[
                    { threat: "Spoofing", mitigation: "mTLS entre services. JWT com short TTL. API keys com rotation." },
                    { threat: "Tampering", mitigation: "Audit trail com hash chain imutável. Container images signed." },
                    { threat: "Repudiation", mitigation: "TODA ação de agente logada com timestamp, actor, e evidence." },
                    { threat: "Info Disclosure", mitigation: "Encryption at-rest (AES-256) + in-transit (TLS 1.3). Tenant isolation." },
                    { threat: "Denial of Service", mitigation: "Rate limiting por tenant. Circuit breakers. Auto-scaling." },
                    { threat: "Elevation of Privilege", mitigation: "RBAC + OPA policies. Least privilege por agente. Approval gates." },
                  ].map((t, i) => (
                    <div key={i} style={{ padding: "8px 10px", background: "#18181b", borderRadius: 4 }}>
                      <div style={{ fontSize: 10, color: "#f87171", fontWeight: 600 }}>{t.threat}</div>
                      <div style={{ fontSize: 10, color: "#a1a1aa", marginTop: 2, lineHeight: 1.4 }}>{t.mitigation}</div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card title="Agent-Specific Security" subtitle="O maior risco é um agente comprometido por prompt injection via dados de telemetria" border="#ef4444">
                <Code>{`// Defesas contra prompt injection em dados de telemetria

// 1. Input Sanitization — antes de passar para o agente
function sanitizeTelemetryForAgent(data: TelemetryData): string {
  // Strip potential injection patterns from log messages
  const sanitized = data.logs.map(log => ({
    ...log,
    message: stripInjectionPatterns(log.message),
  }));
  
  // Limit payload size (prevent context stuffing)
  return JSON.stringify(sanitized).slice(0, MAX_CONTEXT_SIZE);
}

// 2. Output Validation — antes de executar qualquer ação
function validateAgentAction(action: AgentAction): ValidationResult {
  // Allowlist de ações possíveis por role
  const allowedActions = POLICY_ENGINE.getActions(
    action.tenantId,
    action.agentRole
  );
  
  if (!allowedActions.includes(action.type)) {
    return { safe: false, reason: 'action_not_allowed' };
  }
  
  // Destructive actions SEMPRE requerem approval
  if (DESTRUCTIVE_ACTIONS.includes(action.type)) {
    return { safe: false, reason: 'requires_human_approval' };
  }
  
  // Validate action targets são do tenant correto
  if (!action.targets.every(t => t.tenantId === action.tenantId)) {
    return { safe: false, reason: 'cross_tenant_violation' };
  }
  
  return { safe: true };
}

// 3. Network Isolation — agente não tem acesso direto
// Container rodando com --network=none
// Toda comunicação via Unix socket → Envoy proxy
// Proxy enforça domain allowlist:
//   - api.anthropic.com (Claude API)
//   - *.datadoghq.com (se tenant usa Datadog)
//   - Nenhum outro domínio`}</Code>
              </Card>

              <Card title="Audit Trail — Tamper-Proof" border="#27272a">
                <Code>{`// src/modules/audit/hash-chain.ts
// Cada entry tem hash do entry anterior → cadeia imutável

interface AuditEntry {
  entryId: string;
  tenantId: string;
  timestamp: string;
  actor: string;          // agent:log-analyzer | human:john@acme.com
  action: string;         // investigated | proposed_rollback | approved
  detail: string;
  incidentId: string;
  previousHash: string;   // hash do entry anterior
  hash: string;           // SHA-256(entry + previousHash)
}

// Verificação de integridade: percorrer chain e validar hashes
// Se qualquer entry foi alterado, hash chain quebra
// Para SOC 2 audit: export completo com verificação de integridade`}</Code>
              </Card>
            </Section>
          </div>
        )}

        {/* ===== IMPLEMENTATION ===== */}
        {tab === "impl" && (
          <div>
            <Section title="▶ Implementação — Roadmap Técnico" color="#a78bfa">
              {[
                {
                  sprint: "Sprint 1-2 (Weeks 1-4)",
                  title: "Foundation",
                  color: "#10b981",
                  tasks: [
                    "Setup repo: TypeScript + Hono + ESLint + Prettier",
                    "Docker compose: AWSLocal Pro + Redis + LLMTrace",
                    "DynamoORM entities: Tenant, Incident, Evidence, AuditLog",
                    "Hono middleware: auth, tenant context, rate limit, audit",
                    "CDK stack: DynamoDB table, VPC, ECS cluster (skeleton)",
                    "CI: GitHub Actions → lint → test → build",
                  ]
                },
                {
                  sprint: "Sprint 3-4 (Weeks 5-8)",
                  title: "Ingestion + Triage",
                  color: "#6366f1",
                  tasks: [
                    "Webhook parsers: Datadog, Grafana, Prometheus",
                    "Alert normalizer → CanonicalAlert type",
                    "Deduplication + correlation engine",
                    "Triage agent (Sonnet): classify + noise filter",
                    "SQS integration: alert queue → triage consumer",
                    "LLMTrace integration: trace every agent call",
                  ]
                },
                {
                  sprint: "Sprint 5-7 (Weeks 9-14)",
                  title: "Deep Search Engine",
                  color: "#f59e0b",
                  tasks: [
                    "Orchestrator agent + sub-agent dispatch",
                    "Log Analyzer sub-agent + mock data sources",
                    "Infra Inspector sub-agent + K8s/cloud queries",
                    "Change Detector sub-agent + git integration",
                    "Hypothesis synthesis + evidence chain builder",
                    "Parallel execution + circuit breaker + timeout",
                    "Agent eval suite: 20+ scenarios, LLM-as-judge",
                  ]
                },
                {
                  sprint: "Sprint 8-9 (Weeks 15-18)",
                  title: "Remediation + Integrations",
                  color: "#ef4444",
                  tasks: [
                    "Approval gate: Slack integration (approve/reject)",
                    "Sandboxed action executor (gVisor container)",
                    "Runbook executor sub-agent",
                    "Post-mortem auto-generation",
                    "Slack bot: war room creation, status updates",
                    "Webhook output: notify customer systems",
                  ]
                },
                {
                  sprint: "Sprint 10-12 (Weeks 19-24)",
                  title: "Enterprise + SOC 2",
                  color: "#a78bfa",
                  tasks: [
                    "SSO/SAML + SCIM provisioning",
                    "RBAC refinement + OPA policies",
                    "Audit trail export + SOC 2 evidence collection",
                    "Tenant onboarding wizard",
                    "Billing module: usage tracking per tenant",
                    "SOC 2 Type I audit prep + documentation",
                    "Beta launch com 3-5 design partners",
                  ]
                },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    border: `1px solid ${s.color}30`,
                    borderLeft: `3px solid ${s.color}`,
                    borderRadius: 6,
                    padding: 14,
                    marginBottom: 10,
                    background: "#0f0f12",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#fafafa" }}>{s.title}</div>
                    <Badge color={s.color} bg={`${s.color}15`}>{s.sprint}</Badge>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                    {s.tasks.map((t, j) => (
                      <div key={j} style={{ fontSize: 10, color: "#a1a1aa", padding: "4px 8px", background: "#18181b", borderRadius: 3, lineHeight: 1.4 }}>
                        <span style={{ color: "#52525b" }}>▸</span> {t}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <Card title="Definition of Done — MVP" border="#a78bfa">
                <div style={{ fontSize: 11, color: "#a1a1aa", lineHeight: 1.7 }}>
                  {[
                    "Recebe alert de Datadog/Grafana via webhook",
                    "Triage automático com Sonnet: classifica P1-P4, filtra noise",
                    "Deep search para P1/P2: 3 sub-agentes paralelos investigam",
                    "Hypothesis ranking com evidence chain",
                    "Propõe remediação via Slack com approval gate",
                    "Audit trail imutável de toda investigação",
                    "LLMTrace: traces completos + eval suite com 20+ cenários + accuracy > 70%",
                    "Multi-tenant isolation comprovável",
                    "docker compose up roda tudo local",
                    "CI: lint + test + eval + build em < 10min",
                  ].map((item, i) => (
                    <div key={i} style={{ marginBottom: 4 }}>
                      <span style={{ color: "#a78bfa" }}>☐</span> {item}
                    </div>
                  ))}
                </div>
              </Card>
            </Section>
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: "1px solid #18181b",
          padding: "12px 20px",
          textAlign: "center",
          fontSize: 9,
          color: "#27272a",
        }}
      >
        PRD AI SRE Platform v1.0 • Confidencial • Feb 2026
      </div>
    </div>
  );
}
