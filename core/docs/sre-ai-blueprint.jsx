import { useState } from "react";

const sections = [
  {
    id: "market",
    title: "Análise de Mercado",
    icon: "◎",
  },
  {
    id: "competitors",
    title: "Concorrentes & Oportunidade",
    icon: "⬡",
  },
  {
    id: "architecture",
    title: "Arquitetura SOC-First",
    icon: "△",
  },
  {
    id: "sdk",
    title: "Claude Agent SDK Deep Search",
    icon: "⬢",
  },
  {
    id: "security",
    title: "Security Framework",
    icon: "◈",
  },
  {
    id: "roadmap",
    title: "Roadmap Enterprise",
    icon: "▣",
  },
];

const marketData = {
  resolveAI: {
    funding: "$150M+",
    valuation: "$1B",
    clients: "DoorDash, Zscaler, Uni",
    tech: "Multi-agent system, OpenTelemetry",
    mttr: "73% faster RCA",
    differentials: [
      "Fundadores criaram OpenTelemetry + ex-Splunk",
      "SOC 2 Type II certified",
      "Multi-agent parallel hypothesis investigation",
      "Knowledge graph de infraestrutura",
      "Integra com Datadog, Splunk, New Relic, AWS, GCP, Azure, K8s",
    ],
  },
  brazil: {
    tam: "R$ 12.3B desperdiçados em downtime/ano",
    adoption: "83% das empresas ainda são reativas",
    costPerTicket: "R$ 2.847 (reativo) vs R$ 67 (preditivo)",
    gap: "67% temem perder controle dos processos",
    opportunity:
      "Diferença de R$ 40M/ano por empresa média entre modelo reativo vs preditivo",
  },
};

const competitors = [
  {
    name: "Elven Works",
    type: "🇧🇷 Nacional",
    focus: "Observabilidade + SRE Services",
    strengths: [
      "500+ empresas atendidas em 10 anos",
      "Plataforma SaaS de monitoramento + gestão de incidentes",
      "Equipe de SRE como serviço profissional",
    ],
    weaknesses: [
      "Sem IA agêntica / sem AI SRE autônomo",
      "Modelo consultivo tradicional",
      "Não tem deep search automatizado",
    ],
    threat: "Média",
  },
  {
    name: "Mandic Cloud",
    type: "🇧🇷 Nacional",
    focus: "Cloud + SRE managed services",
    strengths: [
      "Líder cloud corporativo BR",
      "Experiência com grandes empresas",
      "Four Golden Signals, MTTF/MTTR",
    ],
    weaknesses: [
      "100% humano, sem IA",
      "Modelo legacy de operação",
      "Sem automação inteligente",
    ],
    threat: "Baixa",
  },
  {
    name: "PagerDuty",
    type: "🌍 Global (BR presence)",
    focus: "Incident Management + AIOps add-on",
    strengths: [
      "Brand recognition global",
      "AIOps como add-on",
      "PagerDuty Copilot (AI assistant)",
    ],
    weaknesses: [
      "Não é AI-first — IA é bolt-on",
      "Caro para mercado BR",
      "Sem sub-agentes especializados",
    ],
    threat: "Alta",
  },
  {
    name: "incident.io",
    type: "🌍 Global",
    focus: "Slack-native incident management + AI",
    strengths: [
      "AI SRE para investigação",
      "Slack-native UX excelente",
      "Post-mortems automáticos",
    ],
    weaknesses: [
      "Sem presença BR",
      "Sem LGPD compliance",
      "Não entende contexto local",
    ],
    threat: "Média",
  },
  {
    name: "Datadog AIOps",
    type: "🌍 Global",
    focus: "Observability + Watchdog AI",
    strengths: [
      "Full-stack monitoring",
      "ML anomaly detection (Watchdog)",
      "Ecossistema massivo",
    ],
    weaknesses: [
      "Não faz investigação autônoma",
      "Custo proibitivo em escala no BR",
      "Vendor lock-in pesado",
    ],
    threat: "Alta",
  },
];

const architectureLayers = [
  {
    layer: "CAMADA 1 — INGESTÃO SEGURA",
    color: "#0a2f1f",
    border: "#10b981",
    items: [
      {
        title: "API Gateway (mTLS)",
        desc: "Todas as conexões com TLS 1.3 mútuo. Certificados gerenciados por Vault.",
      },
      {
        title: "Webhook Receivers",
        desc: "Endpoints para Datadog, Grafana, PagerDuty, Prometheus, CloudWatch, Zabbix.",
      },
      {
        title: "Event Bus (Kafka/NATS)",
        desc: "Buffer de eventos com encryption at-rest. Retention policy configurável por tenant.",
      },
      {
        title: "Tenant Isolation",
        desc: "Cada cliente em namespace isolado. Zero data leakage entre tenants.",
      },
    ],
  },
  {
    layer: "CAMADA 2 — ORQUESTRAÇÃO DE AGENTES",
    color: "#1a1a3e",
    border: "#6366f1",
    items: [
      {
        title: "Orchestrator Agent (Claude Agent SDK)",
        desc: "Agente principal que recebe alertas e decide qual sub-agente acionar.",
      },
      {
        title: "Sub-Agent: Log Analyzer",
        desc: "Deep search em logs com contexto temporal. Correlaciona padrões across services.",
      },
      {
        title: "Sub-Agent: Infra Inspector",
        desc: "Analisa K8s, cloud resources, network topology. Identifica dependency chains.",
      },
      {
        title: "Sub-Agent: Code Reviewer",
        desc: "Analisa recent deployments, git blame, PR history para correlacionar changes.",
      },
      {
        title: "Sub-Agent: Runbook Executor",
        desc: "Executa runbooks com human-in-the-loop approval. Sandbox isolado por ação.",
      },
    ],
  },
  {
    layer: "CAMADA 3 — DEEP SEARCH ENGINE",
    color: "#2d1a0e",
    border: "#f59e0b",
    items: [
      {
        title: "Parallel Hypothesis Generator",
        desc: "Gera N hipóteses simultaneamente e valida cada uma contra evidências reais.",
      },
      {
        title: "Evidence Collector",
        desc: "Busca provas em metrics, logs, traces, changes, past incidents em paralelo.",
      },
      {
        title: "Temporal Correlator",
        desc: "Correlaciona timeline de deploys, config changes, alerts e métricas.",
      },
      {
        title: "Knowledge Graph Builder",
        desc: "Mapa vivo de dependências, owners, SLOs e incident history por serviço.",
      },
    ],
  },
  {
    layer: "CAMADA 4 — SEGURANÇA & COMPLIANCE",
    color: "#2a0a0a",
    border: "#ef4444",
    items: [
      {
        title: "Audit Trail Imutável",
        desc: "Toda ação de agente logada com hash chain. Tamper-proof e queryable.",
      },
      {
        title: "RBAC + Policy Engine (OPA)",
        desc: "Políticas granulares: quem pode ver o quê, quais ações agentes podem executar.",
      },
      {
        title: "Data Residency (BR)",
        desc: "Dados em região São Paulo. LGPD-compliant desde day 0.",
      },
      {
        title: "Secrets Management (Vault)",
        desc: "Zero secrets em código. Rotação automática. Least privilege por agente.",
      },
    ],
  },
];

const securityFramework = [
  {
    phase: "Fase 0 — Foundations (Mês 1-2)",
    status: "critical",
    items: [
      "Política de segurança documentada (ISO 27001 style)",
      "LGPD Data Processing Agreement template",
      "Threat modeling da arquitetura (STRIDE)",
      "Definir Trust Boundaries entre agentes",
      "Encryption at-rest (AES-256) e in-transit (TLS 1.3)",
      "Identity: OAuth 2.0 + OIDC para autenticação",
      "Multi-tenancy isolation design",
      "Incident response plan interno",
    ],
  },
  {
    phase: "Fase 1 — SOC 2 Type I Prep (Mês 3-5)",
    status: "high",
    items: [
      "TSC Security (obrigatório): access controls, monitoring, incident response",
      "TSC Availability: SLOs internos, DR plan, failover testing",
      "TSC Confidentiality: data classification, encryption, retention policies",
      "Risk assessment formal + risk register",
      "Vendor risk management (Anthropic, cloud providers)",
      "Employee security awareness training",
      "Background checks para equipe com acesso a dados de produção",
      "Ferramenta de compliance automation (Vanta, Drata, ou Comp AI)",
    ],
  },
  {
    phase: "Fase 2 — Agent Security (Mês 3-6)",
    status: "high",
    items: [
      "Sandboxing: cada agente em container isolado com seccomp profile",
      "Permission boundaries: agentes NUNCA executam sem approval gate",
      "Prompt injection protection: sanitização de inputs de telemetria",
      "Output validation: LLM outputs são validados antes de ações",
      "Rate limiting por agente e por tenant",
      "Circuit breaker: agente para se detectar loop ou anomalia",
      "Immutable audit log: TODA decisão de agente é registrada",
      "Human-in-the-loop obrigatório para ações destrutivas (rollback, scaling)",
    ],
  },
  {
    phase: "Fase 3 — SOC 2 Type II + LGPD (Mês 6-12)",
    status: "medium",
    items: [
      "3-6 meses de evidência operacional coletada",
      "Penetration testing por terceiro (annual)",
      "LGPD: DPO nomeado, DPIA completo, consent management",
      "Continuous monitoring com alertas de compliance drift",
      "Auditoria SOC 2 Type II com firma CPA credenciada",
      "ISO 27001 roadmap (para enterprise tier)",
      "Bug bounty program (opcional mas diferenciador)",
      "SOC 2 report disponível para prospects via NDA",
    ],
  },
];

const deepSearchFlow = [
  {
    step: 1,
    title: "Alert Intake",
    desc: "Alerta chega via webhook. Orchestrator classifica severidade e contexto.",
    code: `// Orchestrator Agent - Alert Intake
const orchestrator = new ClaudeSDKClient({
  system_prompt: \`Você é o AI SRE Orchestrator.
    Classifique severidade (P1-P4).
    Identifique serviços afetados.
    Acione sub-agentes relevantes.\`,
  allowed_tools: ["Read", "WebSearch"],
  permission_mode: "plan"  // NUNCA acceptEdits em prod
});`,
  },
  {
    step: 2,
    title: "Parallel Deep Search",
    desc: "Sub-agentes disparam em paralelo buscando evidências de múltiplas fontes.",
    code: `// Parallel sub-agent dispatch
const investigations = await Promise.allSettled([
  // Sub-Agent 1: Busca em logs
  query({
    prompt: \`Analise logs dos últimos 30min para 
    \${service}. Busque erros, latency spikes, 
    padrões anômalos.\`,
    options: {
      system_prompt: LOG_ANALYZER_PROMPT,
      max_turns: 10
    }
  }),
  // Sub-Agent 2: Infra check
  query({
    prompt: \`Verifique saúde de infra para 
    \${service}: K8s pods, CPU, memory, network.\`,
    options: {
      system_prompt: INFRA_INSPECTOR_PROMPT,
      max_turns: 8
    }
  }),
  // Sub-Agent 3: Recent changes
  query({
    prompt: \`Liste deploys e config changes 
    nas últimas 2h. Correlacione com timeline.\`,
    options: {
      system_prompt: CHANGE_ANALYZER_PROMPT,
      max_turns: 6
    }
  })
]);`,
  },
  {
    step: 3,
    title: "Hypothesis Synthesis",
    desc: "Orchestrator sintetiza evidências e gera hipóteses rankeadas por probabilidade.",
    code: `// Hypothesis synthesis com structured output
const synthesis = await query({
  prompt: \`Com base nas evidências coletadas:
    Logs: \${logFindings}
    Infra: \${infraFindings}  
    Changes: \${changeFindings}
    
    Gere hipóteses de root cause rankeadas.
    Para cada hipótese, cite as evidências.\`,
  options: {
    system_prompt: SYNTHESIS_PROMPT,
    output_format: {
      type: "object",
      properties: {
        hypotheses: {
          type: "array",
          items: {
            type: "object",
            properties: {
              rank: { type: "number" },
              cause: { type: "string" },
              confidence: { type: "number" },
              evidence: { type: "array" },
              remediation: { type: "string" },
              requires_approval: { type: "boolean" }
            }
          }
        },
        timeline: { type: "array" },
        affected_services: { type: "array" }
      }
    }
  }
});`,
  },
  {
    step: 4,
    title: "Action + Approval Gate",
    desc: "Ações propostas passam por approval gate. Human-in-the-loop para P1/P2.",
    code: `// Approval Gate - CRITICAL SECURITY LAYER
const action = synthesis.hypotheses[0].remediation;

if (incident.severity <= 2) {
  // P1/P2: SEMPRE requer human approval
  await notifySlack({
    channel: incident.war_room,
    message: formatActionProposal(action),
    buttons: ["✅ Approve", "❌ Reject", "🔄 Modify"]
  });
  // Aguarda approval com timeout
  const approval = await waitForApproval({
    timeout: "5m",
    escalation: incident.oncall_chain
  });
  if (!approval.approved) return;
}

// Executa em sandbox isolado
await executeInSandbox({
  action,
  tenant: incident.tenant_id,
  audit_trail: true,  // SEMPRE
  rollback_ready: true
});`,
  },
];

const roadmap = [
  {
    quarter: "Q1 2026",
    title: "Foundation & MVP",
    items: [
      "Core architecture com multi-tenancy",
      "Claude Agent SDK integration com sub-agentes",
      "Integração: Datadog, Grafana, Prometheus",
      "SOC 2 Type I prep started",
      "LGPD compliance framework",
      "3-5 beta customers (design partners)",
    ],
    milestone: "Private Beta",
  },
  {
    quarter: "Q2 2026",
    title: "Deep Search & Security",
    items: [
      "Deep Search Engine com parallel hypotheses",
      "Knowledge Graph v1 (service dependencies)",
      "Audit trail imutável",
      "SOC 2 Type I audit",
      "Slack/Teams integration",
      "Post-mortem automation",
    ],
    milestone: "SOC 2 Type I ✓",
  },
  {
    quarter: "Q3 2026",
    title: "Enterprise Launch",
    items: [
      "GA Launch para mercado BR",
      "SSO/SAML + SCIM provisioning",
      "Custom runbook builder",
      "Proactive alerting (predição de incidentes)",
      "10-20 enterprise customers",
      "AWS Marketplace listing",
    ],
    milestone: "GA Launch 🇧🇷",
  },
  {
    quarter: "Q4 2026",
    title: "Scale & Compliance",
    items: [
      "SOC 2 Type II audit",
      "ISO 27001 prep",
      "Multi-cloud support (AWS + GCP + Azure)",
      "Self-healing automation (nível avançado)",
      "Cost optimization agent",
      "Expansion LATAM (Colômbia, México)",
    ],
    milestone: "SOC 2 Type II ✓",
  },
];

function ThreatBadge({ level }) {
  const colors = {
    Baixa: { bg: "#052e16", text: "#4ade80", border: "#166534" },
    Média: { bg: "#1c1917", text: "#fbbf24", border: "#854d0e" },
    Alta: { bg: "#1c0404", text: "#f87171", border: "#991b1b" },
  };
  const c = colors[level];
  return (
    <span
      style={{
        padding: "2px 10px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        backgroundColor: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
      }}
    >
      {level}
    </span>
  );
}

function StatusDot({ status }) {
  const colors = {
    critical: "#ef4444",
    high: "#f59e0b",
    medium: "#10b981",
  };
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: colors[status],
        marginRight: 8,
        boxShadow: `0 0 8px ${colors[status]}60`,
      }}
    />
  );
}

export default function SREBlueprint() {
  const [activeSection, setActiveSection] = useState("market");
  const [expandedCompetitor, setExpandedCompetitor] = useState(null);
  const [expandedLayer, setExpandedLayer] = useState(0);
  const [expandedPhase, setExpandedPhase] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#09090b",
        color: "#e4e4e7",
        fontFamily:
          "'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
      }}
    >
      {/* Header */}
      <div
        style={{
          borderBottom: "1px solid #27272a",
          padding: "20px 24px",
          background: "linear-gradient(180deg, #0f0f12 0%, #09090b 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: "linear-gradient(135deg, #10b981, #6366f1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              fontWeight: 800,
            }}
          >
            ⚡
          </div>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "-0.02em",
              color: "#fafafa",
            }}
          >
            AI SRE Brasil — Strategic Blueprint
          </h1>
        </div>
        <p
          style={{
            fontSize: 12,
            color: "#71717a",
            margin: 0,
            marginLeft: 44,
          }}
        >
          Enterprise SRE-as-a-Service • Claude Agent SDK • SOC-First
          Architecture
        </p>
      </div>

      {/* Navigation */}
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: "12px 24px",
          borderBottom: "1px solid #18181b",
          overflowX: "auto",
          background: "#0c0c0f",
        }}
      >
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            style={{
              padding: "8px 14px",
              borderRadius: 6,
              border:
                activeSection === s.id
                  ? "1px solid #3f3f46"
                  : "1px solid transparent",
              background: activeSection === s.id ? "#18181b" : "transparent",
              color: activeSection === s.id ? "#fafafa" : "#71717a",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "inherit",
              letterSpacing: "0.02em",
              transition: "all 0.15s",
            }}
          >
            <span style={{ marginRight: 6 }}>{s.icon}</span>
            {s.title}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "24px", maxWidth: 900, margin: "0 auto" }}>
        {/* MARKET ANALYSIS */}
        {activeSection === "market" && (
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#10b981",
                marginBottom: 20,
                letterSpacing: "-0.01em",
              }}
            >
              ◎ Análise de Mercado — Por que agora, por que Brasil
            </h2>

            {/* Resolve.ai Card */}
            <div
              style={{
                border: "1px solid #27272a",
                borderRadius: 8,
                padding: 20,
                marginBottom: 16,
                background: "#0f0f12",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <h3
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    margin: 0,
                    color: "#fafafa",
                  }}
                >
                  🎯 Benchmark: Resolve.ai
                </h3>
                <span
                  style={{
                    fontSize: 11,
                    color: "#6366f1",
                    fontWeight: 600,
                  }}
                >
                  Unicórnio — $1B valuation
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {[
                  ["Funding", marketData.resolveAI.funding],
                  ["MTTR Reduction", marketData.resolveAI.mttr],
                  ["Clients", marketData.resolveAI.clients],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      padding: "10px 12px",
                      background: "#18181b",
                      borderRadius: 6,
                      border: "1px solid #27272a",
                    }}
                  >
                    <div
                      style={{ fontSize: 10, color: "#71717a", marginBottom: 4 }}
                    >
                      {label}
                    </div>
                    <div
                      style={{ fontSize: 13, fontWeight: 600, color: "#fafafa" }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "#a1a1aa", lineHeight: 1.7 }}>
                {marketData.resolveAI.differentials.map((d, i) => (
                  <div key={i} style={{ marginBottom: 4 }}>
                    <span style={{ color: "#6366f1", marginRight: 8 }}>▸</span>
                    {d}
                  </div>
                ))}
              </div>
            </div>

            {/* Brazil Opportunity */}
            <div
              style={{
                border: "1px solid #065f46",
                borderRadius: 8,
                padding: 20,
                background:
                  "linear-gradient(135deg, #022c22 0%, #0f0f12 100%)",
              }}
            >
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  margin: 0,
                  marginBottom: 16,
                  color: "#10b981",
                }}
              >
                🇧🇷 Oportunidade Brasil — O gap é ENORME
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {[
                  ["Desperdício anual em downtime", marketData.brazil.tam],
                  ["Empresas reativas", marketData.brazil.adoption],
                  [
                    "Custo/ticket: reativo vs preditivo",
                    marketData.brazil.costPerTicket,
                  ],
                  ["Barreira cultural", marketData.brazil.gap],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      padding: "10px 12px",
                      background: "#0a1f15",
                      borderRadius: 6,
                      border: "1px solid #065f46",
                    }}
                  >
                    <div
                      style={{ fontSize: 10, color: "#6ee7b7", marginBottom: 4 }}
                    >
                      {label}
                    </div>
                    <div
                      style={{ fontSize: 12, fontWeight: 600, color: "#fafafa" }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  padding: 12,
                  background: "#052e16",
                  borderRadius: 6,
                  border: "1px solid #166534",
                  fontSize: 12,
                  color: "#4ade80",
                  fontWeight: 600,
                }}
              >
                💡 Insight chave: {marketData.brazil.opportunity}
              </div>
            </div>
          </div>
        )}

        {/* COMPETITORS */}
        {activeSection === "competitors" && (
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#f59e0b",
                marginBottom: 8,
              }}
            >
              ⬡ Mapa Competitivo — Onde estão os gaps
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "#71717a",
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              Nenhum player no Brasil oferece AI SRE autônomo com deep search.
              Os nacionais são consultivos/manuais, os globais são caros e sem
              contexto local (LGPD, português, infra BR).
            </p>

            {competitors.map((c, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid #27272a",
                  borderRadius: 8,
                  marginBottom: 8,
                  overflow: "hidden",
                  background: "#0f0f12",
                }}
              >
                <button
                  onClick={() =>
                    setExpandedCompetitor(expandedCompetitor === i ? null : i)
                  }
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "transparent",
                    border: "none",
                    color: "#fafafa",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>
                      {c.name}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: "#71717a",
                        background: "#18181b",
                        padding: "2px 8px",
                        borderRadius: 4,
                      }}
                    >
                      {c.type}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <ThreatBadge level={c.threat} />
                    <span
                      style={{
                        color: "#71717a",
                        fontSize: 12,
                        transform:
                          expandedCompetitor === i
                            ? "rotate(90deg)"
                            : "rotate(0)",
                        transition: "transform 0.15s",
                      }}
                    >
                      ▸
                    </span>
                  </div>
                </button>

                {expandedCompetitor === i && (
                  <div
                    style={{
                      padding: "0 16px 16px",
                      borderTop: "1px solid #27272a",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "#a1a1aa",
                        padding: "10px 0",
                        borderBottom: "1px solid #1c1c1f",
                        marginBottom: 12,
                      }}
                    >
                      Foco: {c.focus}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 12,
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#4ade80",
                            fontWeight: 600,
                            marginBottom: 8,
                            letterSpacing: "0.05em",
                          }}
                        >
                          STRENGTHS
                        </div>
                        {c.strengths.map((s, j) => (
                          <div
                            key={j}
                            style={{
                              fontSize: 11,
                              color: "#a1a1aa",
                              marginBottom: 4,
                              lineHeight: 1.5,
                            }}
                          >
                            <span style={{ color: "#4ade80" }}>+</span> {s}
                          </div>
                        ))}
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "#f87171",
                            fontWeight: 600,
                            marginBottom: 8,
                            letterSpacing: "0.05em",
                          }}
                        >
                          WEAKNESSES (NOSSO GAP)
                        </div>
                        {c.weaknesses.map((w, j) => (
                          <div
                            key={j}
                            style={{
                              fontSize: 11,
                              color: "#a1a1aa",
                              marginBottom: 4,
                              lineHeight: 1.5,
                            }}
                          >
                            <span style={{ color: "#f87171" }}>−</span> {w}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Our positioning */}
            <div
              style={{
                marginTop: 20,
                padding: 16,
                border: "1px solid #6366f1",
                borderRadius: 8,
                background:
                  "linear-gradient(135deg, #1e1b4b 0%, #0f0f12 100%)",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#a5b4fc",
                  marginBottom: 10,
                }}
              >
                🚀 Nosso Posicionamento Estratégico
              </div>
              <div
                style={{ fontSize: 12, color: "#c7d2fe", lineHeight: 1.7 }}
              >
                <div style={{ marginBottom: 6 }}>
                  <strong style={{ color: "#fafafa" }}>
                    AI SRE autônomo, SOC-first, 100% localizado
                  </strong>
                </div>
                <div style={{ marginBottom: 4 }}>
                  ▸ Deep search com Claude Agent SDK (o que ninguém no BR tem)
                </div>
                <div style={{ marginBottom: 4 }}>
                  ▸ LGPD-native: dados em SP, DPO, DPIA desde day 0
                </div>
                <div style={{ marginBottom: 4 }}>
                  ▸ Preço acessível para mid-market BR (não é enterprise-only)
                </div>
                <div style={{ marginBottom: 4 }}>
                  ▸ Português nativo, entende contexto cultural e técnico BR
                </div>
                <div>
                  ▸ SOC 2 Type II como diferencial competitivo contra locais
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ARCHITECTURE */}
        {activeSection === "architecture" && (
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#6366f1",
                marginBottom: 8,
              }}
            >
              △ Arquitetura SOC-First — Security by Design
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "#71717a",
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              Cada camada foi projetada com segurança como requisito primário,
              não como afterthought. Zero-trust entre agentes. Tenant
              isolation total.
            </p>

            {architectureLayers.map((layer, i) => (
              <div
                key={i}
                style={{
                  border: `1px solid ${layer.border}40`,
                  borderRadius: 8,
                  marginBottom: 8,
                  overflow: "hidden",
                  background: layer.color,
                }}
              >
                <button
                  onClick={() =>
                    setExpandedLayer(expandedLayer === i ? null : i)
                  }
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "transparent",
                    border: "none",
                    color: layer.border,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.03em",
                  }}
                >
                  {layer.layer}
                  <span
                    style={{
                      transform:
                        expandedLayer === i ? "rotate(90deg)" : "rotate(0)",
                      transition: "transform 0.15s",
                    }}
                  >
                    ▸
                  </span>
                </button>
                {expandedLayer === i && (
                  <div style={{ padding: "0 16px 16px" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      {layer.items.map((item, j) => (
                        <div
                          key={j}
                          style={{
                            padding: 12,
                            background: "#09090b",
                            borderRadius: 6,
                            border: `1px solid ${layer.border}30`,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: layer.border,
                              marginBottom: 4,
                            }}
                          >
                            {item.title}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#a1a1aa",
                              lineHeight: 1.5,
                            }}
                          >
                            {item.desc}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* SDK DEEP SEARCH */}
        {activeSection === "sdk" && (
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#f59e0b",
                marginBottom: 8,
              }}
            >
              ⬢ Claude Agent SDK — Deep Search Flow
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "#71717a",
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              Técnica de deep search com sub-agentes paralelos. Cada agente
              investiga uma dimensão diferente. O orchestrator sintetiza e
              propõe ações com approval gate.
            </p>

            {/* Step selector */}
            <div
              style={{
                display: "flex",
                gap: 6,
                marginBottom: 16,
              }}
            >
              {deepSearchFlow.map((step, i) => (
                <button
                  key={i}
                  onClick={() => setActiveStep(i)}
                  style={{
                    flex: 1,
                    padding: "10px 8px",
                    borderRadius: 6,
                    border:
                      activeStep === i
                        ? "1px solid #f59e0b"
                        : "1px solid #27272a",
                    background: activeStep === i ? "#1c1917" : "#0f0f12",
                    color: activeStep === i ? "#fbbf24" : "#71717a",
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "center",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: 16, marginBottom: 4 }}>
                    {step.step}
                  </div>
                  {step.title}
                </button>
              ))}
            </div>

            {/* Active step detail */}
            <div
              style={{
                border: "1px solid #854d0e",
                borderRadius: 8,
                overflow: "hidden",
                background: "#1c1917",
              }}
            >
              <div
                style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid #854d0e40",
                }}
              >
                <h3
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    margin: 0,
                    color: "#fbbf24",
                  }}
                >
                  Step {deepSearchFlow[activeStep].step}:{" "}
                  {deepSearchFlow[activeStep].title}
                </h3>
                <p
                  style={{
                    fontSize: 12,
                    color: "#a1a1aa",
                    margin: "6px 0 0",
                    lineHeight: 1.5,
                  }}
                >
                  {deepSearchFlow[activeStep].desc}
                </p>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: 16,
                  background: "#0c0a09",
                  fontSize: 11,
                  lineHeight: 1.6,
                  color: "#d6d3d1",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {deepSearchFlow[activeStep].code}
              </pre>
            </div>

            <div
              style={{
                marginTop: 16,
                padding: 14,
                border: "1px solid #854d0e",
                borderRadius: 8,
                background: "#1c1917",
                fontSize: 12,
                color: "#fde68a",
                lineHeight: 1.6,
              }}
            >
              <strong>⚠️ Princípios de segurança no SDK:</strong>
              <div style={{ marginTop: 8, color: "#d6d3d1" }}>
                ▸ <code style={{ color: "#fbbf24" }}>permission_mode: "plan"</code>{" "}
                NUNCA "acceptEdits" em produção
                <br />
                ▸ Sub-agentes em containers isolados (seccomp + AppArmor)
                <br />
                ▸ Timeout em TODOS os agentes (circuit breaker)
                <br />
                ▸ Output validation antes de qualquer ação
                <br />▸ Audit trail com hash chain imutável para cada step
              </div>
            </div>
          </div>
        )}

        {/* SECURITY FRAMEWORK */}
        {activeSection === "security" && (
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#ef4444",
                marginBottom: 8,
              }}
            >
              ◈ Security Framework — SOC-First desde Day 0
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "#71717a",
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              Framework de segurança desenhado para ser enterprise-ready desde o
              início. Não é bolt-on — é foundational. Combina SOC 2 + LGPD +
              Agent Security.
            </p>

            {securityFramework.map((phase, i) => (
              <div
                key={i}
                style={{
                  border: "1px solid #27272a",
                  borderRadius: 8,
                  marginBottom: 8,
                  overflow: "hidden",
                  background: "#0f0f12",
                }}
              >
                <button
                  onClick={() =>
                    setExpandedPhase(expandedPhase === i ? null : i)
                  }
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "transparent",
                    border: "none",
                    color: "#fafafa",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <StatusDot status={phase.status} />
                    {phase.phase}
                  </div>
                  <span
                    style={{
                      color: "#71717a",
                      transform:
                        expandedPhase === i ? "rotate(90deg)" : "rotate(0)",
                      transition: "transform 0.15s",
                    }}
                  >
                    ▸
                  </span>
                </button>
                {expandedPhase === i && (
                  <div
                    style={{
                      padding: "0 16px 16px",
                      borderTop: "1px solid #18181b",
                    }}
                  >
                    {phase.items.map((item, j) => (
                      <div
                        key={j}
                        style={{
                          padding: "8px 12px",
                          marginTop: 6,
                          background: "#18181b",
                          borderRadius: 4,
                          fontSize: 11,
                          color: "#a1a1aa",
                          lineHeight: 1.5,
                          borderLeft: "2px solid #3f3f46",
                        }}
                      >
                        <span
                          style={{ color: "#71717a", marginRight: 6 }}
                        >
                          {j + 1}.
                        </span>
                        {item}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div
              style={{
                marginTop: 16,
                padding: 14,
                border: "1px solid #991b1b",
                borderRadius: 8,
                background: "#1c0404",
                fontSize: 12,
                color: "#fca5a5",
                lineHeight: 1.6,
              }}
            >
              <strong>🔐 SOC-First Mindset:</strong>
              <div style={{ marginTop: 6, color: "#d6d3d1" }}>
                O diferencial competitivo contra players nacionais é ter SOC 2
                Type II + LGPD compliance enquanto eles oferecem serviço manual
                sem certificação. Para enterprise BR (bancos, fintechs,
                seguradoras), isso é deal-breaker e nós seremos os primeiros
                AI SRE brasileiros a oferecer isso.
              </div>
            </div>
          </div>
        )}

        {/* ROADMAP */}
        {activeSection === "roadmap" && (
          <div>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#a78bfa",
                marginBottom: 20,
              }}
            >
              ▣ Roadmap Enterprise — 2026
            </h2>

            {roadmap.map((q, i) => (
              <div
                key={i}
                style={{
                  position: "relative",
                  paddingLeft: 28,
                  marginBottom: 24,
                }}
              >
                {/* Timeline line */}
                {i < roadmap.length - 1 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 9,
                      top: 20,
                      bottom: -24,
                      width: 1,
                      background: "#27272a",
                    }}
                  />
                )}
                {/* Timeline dot */}
                <div
                  style={{
                    position: "absolute",
                    left: 4,
                    top: 5,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: i === 0 ? "#a78bfa" : "#27272a",
                    border: `2px solid ${i === 0 ? "#a78bfa" : "#3f3f46"}`,
                  }}
                />

                <div
                  style={{
                    border: "1px solid #27272a",
                    borderRadius: 8,
                    padding: 16,
                    background: "#0f0f12",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: 10,
                          color: "#a78bfa",
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                        }}
                      >
                        {q.quarter}
                      </span>
                      <h3
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          margin: "4px 0 0",
                          color: "#fafafa",
                        }}
                      >
                        {q.title}
                      </h3>
                    </div>
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 700,
                        background: "#1e1b4b",
                        color: "#c4b5fd",
                        border: "1px solid #4c1d95",
                      }}
                    >
                      {q.milestone}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 6,
                    }}
                  >
                    {q.items.map((item, j) => (
                      <div
                        key={j}
                        style={{
                          fontSize: 11,
                          color: "#a1a1aa",
                          padding: "6px 10px",
                          background: "#18181b",
                          borderRadius: 4,
                          lineHeight: 1.4,
                        }}
                      >
                        <span style={{ color: "#71717a" }}>▸</span> {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid #18181b",
          padding: "16px 24px",
          textAlign: "center",
          fontSize: 10,
          color: "#3f3f46",
        }}
      >
        AI SRE Brasil Blueprint v1.0 • Confidencial • Feb 2026
      </div>
    </div>
  );
}
