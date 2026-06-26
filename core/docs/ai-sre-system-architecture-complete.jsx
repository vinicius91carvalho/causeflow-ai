import { useState } from "react";

const tabs = [
  { id: "flow", label: "Fluxo Completo", icon: "🔄" },
  { id: "triggers", label: "Triggers & Modos", icon: "⚡" },
  { id: "tickets", label: "Gestão de Tickets", icon: "🎫" },
  { id: "c1", label: "Cliente 1 (AWS)", icon: "🔶" },
  { id: "c2", label: "Cliente 2 (Azure)", icon: "🔷" },
  { id: "viability", label: "Viabilidade", icon: "🎯" },
];

const Box = ({ children, bg = "bg-white", border = "border-gray-200", className = "" }) => (
  <div className={`${bg} border ${border} rounded-lg p-4 ${className}`}>{children}</div>
);

export default function SystemDiagram() {
  const [activeTab, setActiveTab] = useState("flow");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <span className="text-emerald-400">AI SRE</span> <span className="text-slate-400">— System Architecture</span>
          </h1>
          <p className="text-slate-500 text-xs mt-1">Fluxo completo, triggers, tickets, deploy por cliente, viabilidade</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "text-slate-500 hover:text-slate-300 border border-transparent hover:border-slate-700"
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "flow" && (
          <div className="space-y-6">
            <div className="text-center mb-2">
              <h2 className="text-lg font-bold" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
                Fluxo Completo: Do Problema à Resolução
              </h2>
              <p className="text-slate-500 text-xs">3 entradas → 1 pipeline → múltiplas saídas</p>
            </div>

            {/* MAIN FLOW DIAGRAM */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 overflow-x-auto">
              <pre className="text-xs leading-relaxed" style={{ fontFamily: "'JetBrains Mono'" }}>{`
  ┌─────────────────────────────────────────────────────────────────────────────────────┐
  │                              3 FORMAS DE ENTRADA                                   │
  │                                                                                     │
  │   ┌──────────────┐     ┌───────────────────┐     ┌──────────────────────────────┐  │
  │   │`}<span className="text-red-400">{` ⚡ ALERTA `}</span>{`    │     │`}<span className="text-amber-400">{` 👤 INPUT MANUAL  `}</span>{`│     │`}<span className="text-emerald-400">{` 🔍 DETECÇÃO PROATIVA      `}</span>{`│  │
  │   │  Automático   │     │  Slack / Teams    │     │  Anomaly Scanner (15min)     │  │
  │   │              │     │                   │     │                              │  │
  │   │ • Datadog    │     │ /sre investigate  │     │ • Métricas vs baseline 7d    │  │
  │   │ • Grafana    │     │   "checkout lento"│     │ • Desvio > 2σ → alerta       │  │
  │   │ • Sentry     │     │                   │     │ • Consul health changes      │  │
  │   │ • CloudWatch │     │ /sre ticket       │     │ • Deploy sem incidente?      │  │
  │   │ • PagerDuty  │     │   "cliente X com  │     │                              │  │
  │   │   (webhook)  │     │    erro no login" │     │  (Peace-Time Module)         │  │
  │   └──────┬───────┘     └────────┬──────────┘     └──────────────┬───────────────┘  │
  └──────────┼──────────────────────┼───────────────────────────────┼───────────────────┘
             │                      │                               │
             ▼                      ▼                               ▼
  ┌──────────────────────────────────────────────────────────────────────────────────────┐
  │                     `}<span className="text-cyan-400">{`INGESTION + NORMALIZAÇÃO`}</span>{`                                      │
  │                                                                                      │
  │   Qualquer entrada → mesmo formato:                                                  │
  │   { source, severity, title, service, timestamp, metadata }                          │
  │                                                                                      │
  │   • Parser por source (Sentry, Grafana, manual, anomaly)                             │
  │   • Deduplicação (mesmo alerta de múltiplas fontes)                                  │
  │   • Correlação (3 alertas do mesmo incidente → 1 investigation)                      │
  └─────────────────────────────────────┬────────────────────────────────────────────────┘
                                        │
                                        ▼
  ┌──────────────────────────────────────────────────────────────────────────────────────┐
  │                        `}<span className="text-yellow-400">{`TRIAGE (Layer 1 — Sonnet, <5s)`}</span>{`                              │
  │                                                                                      │
  │   "É sério? É novo? Precisa de investigação?"                                        │
  │                                                                                      │
  │   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────────────────┐   │
  │   │  P1: CRÍTICO │    │  P3: BAIXO   │    │  NOISE: Já visto, auto-resolvido,   │   │
  │   │  → War Room  │    │  → Queue     │    │  duplicata → descarta              │   │
  │   │  → Investiga │    │  → Investiga │    │  `}<span className="text-slate-600">{`(80% dos alertas param aqui)`}</span>{`       │   │
  │   │    AGORA      │    │    quando    │    └──────────────────────────────────────┘   │
  │   └──────┬───────┘    │    possível  │                                               │
  │          │            └──────┬───────┘                                               │
  └──────────┼───────────────────┼───────────────────────────────────────────────────────┘
             │                   │
             ▼                   ▼
  ┌──────────────────────────────────────────────────────────────────────────────────────┐
  │                  `}<span className="text-orange-400">{`INVESTIGATION (Layer 2 — Sonnet ×N paralelo, 2-5min)`}</span>{`              │
  │                                                                                      │
  │   Orchestrator dispara sub-agentes EM PARALELO:                                      │
  │                                                                                      │
  │   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐  │
  │   │ `}<span className="text-blue-400">{`📋 Log Analyzer`}</span>{` │ │ `}<span className="text-purple-400">{`🏗️ Infra Insp.`}</span>{`  │ │ `}<span className="text-green-400">{`🔄 Change Det. `}</span>{`│ │ `}<span className="text-red-400">{`🐛 Sentry Deep`}</span>{` │  │
  │   │                 │ │                 │ │                 │ │ `}<span className="text-red-400">{`(se aplicável) `}</span>{`│  │
  │   │ CloudWatch Logs │ │ Lambda configs  │ │ CloudTrail      │ │                 │  │
  │   │ Azure Log Anal. │ │ DynamoDB tables │ │ Deploy history  │ │ Stack traces    │  │
  │   │ (via AssumeRole)│ │ ECS/EC2 status  │ │ Git commits     │ │ Breadcrumbs     │  │
  │   │                 │ │ Consul health   │ │ Config changes  │ │ (via Relay)     │  │
  │   └────────┬────────┘ └────────┬────────┘ └────────┬────────┘ └────────┬────────┘  │
  │            │                   │                    │                   │           │
  │            └───────────────────┴────────────────────┴───────────────────┘           │
  │                                        │                                            │
  │                                        ▼                                            │
  │                          `}<span className="text-pink-400">{`SYNTHESIS (Layer 3 — Opus, ~30s)`}</span>{`                           │
  │                                                                                      │
  │   Combina evidências → Hipóteses ranqueadas:                                         │
  │   #1: "Deploy v2.3.4 removeu campo price" — 89% confiança                           │
  │   #2: "DynamoDB throttling na tabela products" — 34% confiança                      │
  │   #3: [descartada] "Cache invalidation" — 12% → insuficiente                        │
  │                                                                                      │
  └─────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
  ┌──────────────────────────────────────────────────────────────────────────────────────┐
  │                      `}<span className="text-emerald-400">{`COMUNICAÇÃO + AÇÃO`}</span>{`                                             │
  │                                                                                      │
  │   ┌───────────────────┐   ┌───────────────────────┐   ┌─────────────────────────┐   │
  │   │ `}<span className="text-blue-400">{`💬 Slack / Teams`}</span>{`   │   │ `}<span className="text-amber-400">{`🔐 Approval Gate`}</span>{`       │   │ `}<span className="text-green-400">{`📊 Post-Resolution`}</span>{`   │   │
  │   │                   │   │                       │   │                         │   │
  │   │ War room thread   │   │ "Rollback v2.3.4?"   │   │ • RCA automático        │   │
  │   │ com diagnóstico   │   │                       │   │ • Post-mortem draft     │   │
  │   │ e evidências      │   │  ✅ Engenheiro aprova │   │ • Pattern → memória     │   │
  │   │                   │   │  → Executa rollback   │   │ • Métricas (MTTR, etc)  │   │
  │   │ Timeline visual   │   │                       │   │ • Ticket fechado        │   │
  │   │ de tudo que       │   │  ❌ Engenheiro rejeita│   │                         │   │
  │   │ aconteceu         │   │  → Sugere alternativa │   │                         │   │
  │   └───────────────────┘   └───────────────────────┘   └─────────────────────────┘   │
  └──────────────────────────────────────────────────────────────────────────────────────┘`}
              </pre>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Via AssumeRole (fora da VPC)", color: "text-cyan-400", border: "border-cyan-500/30", items: [
                  "CloudWatch Logs + Metrics",
                  "Lambda (listar, descrever, config)",
                  "DynamoDB (tabelas, métricas, throttling)",
                  "CloudTrail (quem fez o quê)",
                  "ECS / EC2 (status, deploys)",
                  "S3, SQS, SNS, ALB...",
                  "Azure Monitor, Activity Log",
                ]},
                { label: "Via Relay (dentro da VPC/VPN)", color: "text-emerald-400", border: "border-emerald-500/30", items: [
                  "Sentry self-hosted (stack traces)",
                  "Grafana interno (dashboards, alerts)",
                  "Consul (services, deps, health)",
                  "APIs internas da aplicação",
                  "Prometheus (se self-hosted)",
                  "Qualquer HTTP endpoint interno",
                ]},
                { label: "Via Chat Platform (interação)", color: "text-amber-400", border: "border-amber-500/30", items: [
                  "Slack: war rooms, threads, botões",
                  "Teams: adaptive cards, approvals",
                  "Input manual do engenheiro",
                  "Redirecionamento mid-investigation",
                  "Approval gates (rollback, restart)",
                  "Feedback (RCA correto? fix funcionou?)",
                ]},
              ].map((col, i) => (
                <div key={i} className={`bg-slate-900 border ${col.border} rounded-lg p-4`}>
                  <h4 className={`${col.color} text-xs font-bold mb-3`}>{col.label}</h4>
                  {col.items.map((item, j) => <p key={j} className="text-slate-400 text-xs mb-1">→ {item}</p>)}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "triggers" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
              3 Modos de Trigger — Não é só reativo
            </h2>

            <div className="space-y-4">
              {/* TRIGGER 1: REACTIVE */}
              <div className="bg-slate-900 border border-red-500/30 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-bold">MODO 1: REATIVO</span>
                  <span className="text-slate-500 text-xs">O alerta chega → agente investiga automaticamente</span>
                </div>
                <pre className="text-xs leading-relaxed text-slate-300">{`
   Datadog/Grafana/Sentry/CloudWatch
              │
              │ webhook (HTTP POST)
              ▼
   ┌─────────────────────┐      ┌──────────────────────┐      ┌────────────────────┐
   │  Ingestion Module   │─────►│  Triage (Sonnet <5s) │─────►│  Investigation     │
   │  • Parse webhook    │      │  • P1? War room agora│      │  • 3 sub-agentes   │
   │  • Normalize        │      │  • P3? Fila           │      │  • 2-5 min         │
   │  • Deduplica        │      │  • Noise? Descarta   │      │  • Hipóteses + RCA │
   └─────────────────────┘      └──────────────────────┘      └────────────────────┘
                                                                        │
   `}<span className="text-red-400">{`Trigger: AUTOMÁTICO`}</span>{`                                                 ▼
   `}<span className="text-red-400">{`Intervenção humana: ZERO até aqui`}</span>{`                       Slack/Teams: diagnóstico
   `}<span className="text-red-400">{`Tempo: alerta → diagnóstico em 3-7 min`}</span>{`                 + proposta de ação
                                                              + approval gate`}</pre>
                <p className="text-slate-500 text-xs mt-3">
                  <strong className="text-red-400">Quando:</strong> Qualquer alerta de qualquer source configurada.
                  O engenheiro só entra para aprovar a remediação (ou nem isso, se auto-approval estiver habilitado para ações de baixo risco).
                </p>
              </div>

              {/* TRIGGER 2: MANUAL */}
              <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full text-xs font-bold">MODO 2: MANUAL</span>
                  <span className="text-slate-500 text-xs">Humano descreve o problema → agente investiga</span>
                </div>
                <pre className="text-xs leading-relaxed text-slate-300">{`
   Engenheiro no Slack:                    Suporte técnico no Teams:
   ┌─────────────────────────────┐        ┌──────────────────────────────────────┐
   │ /sre investigate            │        │ /sre ticket                          │
   │ "checkout retornando 500    │        │ "Cliente Acme reportou que login     │
   │  desde as 14h, clientes     │        │  está travando no app mobile desde   │
   │  reclamando no Twitter"     │        │  ontem. Erro: timeout no auth."      │
   └──────────────┬──────────────┘        └───────────────────┬────────────────┘
                  │                                            │
                  ▼                                            ▼
   ┌────────────────────────────────────────────────────────────────────────────┐
   │  NL Parser: extrai serviço, sintomas, contexto temporal                   │
   │  "checkout" → service: checkout-api                                       │
   │  "500 desde 14h" → timerange: 14:00-now, symptom: HTTP 500               │
   │  "login travando + timeout auth" → services: [auth-service, mobile-bff]  │
   └────────────────────────────────────────┬───────────────────────────────────┘
                                            │
                                            ▼
                                   Mesmo pipeline de investigação
                                   (sub-agentes, hipóteses, RCA)

   `}<span className="text-amber-400">{`Trigger: HUMANO (texto livre em linguagem natural)`}</span>{`
   `}<span className="text-amber-400">{`Funciona como: "Google para infra" — pergunta o que quiser`}</span>{`
   `}<span className="text-amber-400">{`Também serve como: ticket de suporte técnico interno`}</span></pre>
                <div className="mt-3 bg-slate-800 rounded-lg p-3">
                  <p className="text-xs text-amber-300 font-bold mb-1">Exemplos de input manual:</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                    <p>• <code className="text-amber-200">/sre investigate</code> "API lenta para clientes na região Sul"</p>
                    <p>• <code className="text-amber-200">/sre ticket</code> "Cliente reportou erro ao gerar boleto"</p>
                    <p>• <code className="text-amber-200">/sre health</code> "Como está o checkout agora?"</p>
                    <p>• <code className="text-amber-200">/sre why</code> "Por que o deploy de ontem causou pico de erros?"</p>
                    <p>• <code className="text-amber-200">/sre risk</code> "É seguro deployar agora?"</p>
                    <p>• <code className="text-amber-200">/sre deps</code> "O que depende do auth-service?"</p>
                  </div>
                </div>
              </div>

              {/* TRIGGER 3: PROACTIVE */}
              <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold">MODO 3: PROATIVO</span>
                  <span className="text-slate-500 text-xs">Agente monitora continuamente e detecta antes do incidente</span>
                </div>
                <pre className="text-xs leading-relaxed text-slate-300">{`
   ┌────────────────────────────────────────────────────────────────────────────┐
   │  `}<span className="text-emerald-400">{`PEACE-TIME MODULE (roda 24/7, sem trigger humano)`}</span>{`                        │
   │                                                                            │
   │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │
   │  │ Anomaly Scanner  │  │ On-Call Briefing  │  │ Change Risk Assessor    │ │
   │  │ • A cada 15 min  │  │ • No início do   │  │ • A cada deploy         │ │
   │  │ • Compara com    │  │   turno do on-call│  │ • "Esse deploy é seguro │ │
   │  │   baseline 7 dias│  │ • "5 alertas      │  │   dado o estado atual?" │ │
   │  │ • Latência subiu │  │   ativos, P99     │  │ • Blast radius analysis │ │
   │  │   23%? Notifica  │  │   checkout +23%,  │  │ • Incidentes similares? │ │
   │  │ • CPU trend →    │  │   deploy há 2h"   │  │                         │ │
   │  │   vai estourar   │  │                   │  │                         │ │
   │  │   em 4h? Avisa   │  │  ┌────────────┐  │  │                         │ │
   │  └──────┬───────────┘  │  │ Enviado    │  │  └────────────┬────────────┘ │
   │         │              │  │ automático │  │               │              │
   │         ▼              │  │ no Slack/  │  │               ▼              │
   │  Se desvio > 2σ:      │  │ Teams      │  │  Se risco alto:             │
   │  "Atenção: latência   │  └────────────┘  │  "⚠️ Deploy similar causou  │
   │  do checkout subindo  └──────────────────┘  incidente P1 há 2 semanas. │
   │  anormalmente.                              Recomendo: canary deploy." │
   │  Investigar agora?"                                                     │
   │  [Sim, investigar] [Ignorar]                                            │
   └────────────────────────────────────────────────────────────────────────────┘

   `}<span className="text-emerald-400">{`Trigger: AUTOMÁTICO + CONTÍNUO`}</span>{`
   `}<span className="text-emerald-400">{`Diferença do reativo: detecta ANTES do alerta formal`}</span>{`
   `}<span className="text-emerald-400">{`Valor: transforma de bombeiro (apaga incêndio) em vigia (previne incêndio)`}</span></pre>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-200 mb-3" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
                Resumo: Quando cada modo é usado
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-3 py-2 text-left text-slate-400">Modo</th>
                      <th className="px-3 py-2 text-left text-slate-400">Quando</th>
                      <th className="px-3 py-2 text-left text-slate-400">Quem inicia</th>
                      <th className="px-3 py-2 text-left text-slate-400">% do uso estimado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    <tr><td className="px-3 py-2 text-red-400 font-bold">Reativo</td><td className="px-3 py-2 text-slate-300">Alerta dispara</td><td className="px-3 py-2 text-slate-300">Máquina (webhook)</td><td className="px-3 py-2 text-slate-300">~40% (war time)</td></tr>
                    <tr><td className="px-3 py-2 text-amber-400 font-bold">Manual</td><td className="px-3 py-2 text-slate-300">Engenheiro/suporte com dúvida ou ticket</td><td className="px-3 py-2 text-slate-300">Humano (Slack/Teams)</td><td className="px-3 py-2 text-slate-300">~25% (on-demand)</td></tr>
                    <tr><td className="px-3 py-2 text-emerald-400 font-bold">Proativo</td><td className="px-3 py-2 text-slate-300">Anomalia detectada, deploy novo, início turno</td><td className="px-3 py-2 text-slate-300">Máquina (scheduled)</td><td className="px-3 py-2 text-slate-300">~35% (peace time)</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-slate-500 text-xs mt-3">
                Sem o modo proativo e manual, o produto seria usado só em emergências (~5% do tempo) → alto churn.
                Com os 3 modos, o produto é usado o dia inteiro → alta retenção.
              </p>
            </div>
          </div>
        )}

        {activeTab === "tickets" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
              Gestão de Tickets de Suporte Técnico
            </h2>

            <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-5">
              <p className="text-amber-400 text-xs font-bold mb-3">FLUXO: TICKET DE SUPORTE → INVESTIGAÇÃO → RESOLUÇÃO</p>
              <pre className="text-xs leading-relaxed text-slate-300">{`
   `}<span className="text-amber-400">{`SUPORTE NÍVEL 1 (humano ou chatbot)`}</span>{`
   "Cliente reportou: checkout não finaliza"
              │
              ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  /sre ticket "checkout não finaliza para cliente Acme, erro 500"  │
   │                                                                     │
   │  Sistema cria:                                                      │
   │  ┌────────────────────────────────────────────────────────────────┐ │
   │  │ TICKET #SRE-2847                                              │ │
   │  │ Status: INVESTIGATING                                         │ │
   │  │ Source: manual (suporte)                                      │ │
   │  │ Service: checkout-api (inferido de "checkout")                │ │
   │  │ Symptoms: HTTP 500 (inferido de "erro 500")                   │ │
   │  │ Customer: Acme                                                │ │
   │  │ Opened by: @maria.suporte                                    │ │
   │  │ SLA: 4h (P3 default, pode ser reclassificado pelo triage)    │ │
   │  └────────────────────────────────────────────────────────────────┘ │
   └─────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  `}<span className="text-cyan-400">{`INVESTIGAÇÃO AUTOMÁTICA (mesmo pipeline do alerta)`}</span>{`               │
   │                                                                     │
   │  Thread no Slack/Teams com atualizações em tempo real:             │
   │                                                                     │
   │  🤖 Bot: "Investigando checkout-api..."                            │
   │  🤖 Bot: "Encontrei 847 erros 500 nos últimos 30min"              │
   │  🤖 Bot: "Stack trace aponta para payment-gateway timeout"        │
   │  🤖 Bot: "Deploy v3.1.2 há 45min mudou timeout de 5s → 2s"       │
   │  🤖 Bot: "Diagnóstico: timeout do payment-gateway reduzido"       │
   │  🤖 Bot: "Confiança: 91%. Ação sugerida: reverter timeout."      │
   │                                                                     │
   │  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────────┐ │
   │  │ ✅ Aprovar    │  │ 🔄 Alternativa│  │ 👤 Escalar para eng.  │ │
   │  │ revert config │  │               │  │                         │ │
   │  └──────┬───────┘  └───────────────┘  └─────────────────────────┘ │
   └─────────┼───────────────────────────────────────────────────────────┘
             │
             ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │  `}<span className="text-green-400">{`PÓS-RESOLUÇÃO`}</span>{`                                                     │
   │                                                                     │
   │  TICKET #SRE-2847                                                  │
   │  Status: RESOLVED ✅                                                │
   │  MTTR: 8 minutos                                                   │
   │  Root Cause: Config change (timeout 5s→2s) em deploy v3.1.2       │
   │  Fix: Revert do timeout para 5s                                    │
   │  Post-mortem: [auto-gerado, link]                                  │
   │                                                                     │
   │  → Resposta para suporte:                                          │
   │    "Problema identificado e resolvido. Timeout de integração       │
   │     com gateway de pagamento havia sido reduzido. Revertido.       │
   │     Cliente deve conseguir finalizar compras agora."               │
   │                                                                     │
   │  → Pattern salvo na memória:                                       │
   │    {symptoms: ["500 checkout"], cause: "timeout config change"}    │
   └─────────────────────────────────────────────────────────────────────┘`}</pre>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-200 mb-3" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
                Funcionalidades de Ticket
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-emerald-400 text-xs font-bold mb-2">O que faz (MVP):</p>
                  <div className="text-xs text-slate-400 space-y-1">
                    <p>✅ Criar ticket via Slack/Teams com texto livre</p>
                    <p>✅ Auto-classificar severidade e serviço afetado</p>
                    <p>✅ Investigar automaticamente (mesmo pipeline)</p>
                    <p>✅ Thread com atualizações em tempo real</p>
                    <p>✅ Approval gates para ações</p>
                    <p>✅ Resolver e documentar automaticamente</p>
                    <p>✅ Histórico pesquisável por tenant</p>
                    <p>✅ Métricas: MTTR, volume, top offenders</p>
                  </div>
                </div>
                <div>
                  <p className="text-amber-400 text-xs font-bold mb-2">O que NÃO faz (não é ITSM completo):</p>
                  <div className="text-xs text-slate-400 space-y-1">
                    <p>⚠️ Não substitui Jira/ServiceNow para workflows complexos</p>
                    <p>⚠️ Não tem SLA management com escalonamento automático</p>
                    <p>⚠️ Não tem customer portal (é interno, via Slack/Teams)</p>
                    <p>⚠️ Não tem CMDB completo</p>
                    <p className="text-slate-600 mt-2">→ Mas integra COM Jira/ServiceNow:</p>
                    <p className="text-slate-400">→ Cria ticket lá quando resolvido</p>
                    <p className="text-slate-400">→ Atualiza status bidirecionalmente</p>
                    <p className="text-slate-400">→ Sincroniza resolução e RCA</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-purple-500/30 rounded-xl p-5">
              <h3 className="text-sm font-bold text-purple-400 mb-3">Escalonamento Inteligente</h3>
              <pre className="text-xs leading-relaxed text-slate-300">{`
   Ticket chega → Agent investiga
        │
        ├─── `}<span className="text-green-400">{`Resolvido com alta confiança (>80%)`}</span>{`
        │    → Sugere fix → humano aprova → resolve
        │    → MTTR: 5-10 min
        │
        ├─── `}<span className="text-amber-400">{`Parcialmente resolvido (40-80% confiança)`}</span>{`
        │    → Apresenta hipóteses com evidências
        │    → "Não tenho certeza. Duas possibilidades:"
        │    → Engenheiro escolhe ou investiga mais
        │    → MTTR: 15-30 min
        │
        └─── `}<span className="text-red-400">{`Não conseguiu resolver (<40% confiança)`}</span>{`
             → "Não consegui identificar a causa com certeza."
             → "Aqui está tudo que encontrei: [evidências]"
             → "Recomendo escalar para @team-platform"
             → Cria thread com todo contexto para o humano
             → MTTR: depende do humano, mas com headstart`}</pre>
              <p className="text-slate-500 text-xs mt-3">
                O agente NUNCA finge que sabe. Se não tem confiança, diz explicitamente e
                escala com todo o contexto que já coletou — o engenheiro não começa do zero.
              </p>
            </div>
          </div>
        )}

        {activeTab === "c1" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
              <span className="text-orange-400">Cliente 1:</span> AWS + Slack + Sentry + VPC + Lambda + DynamoDB
            </h2>

            <div className="bg-slate-900 border border-orange-500/30 rounded-xl p-6 overflow-x-auto">
              <pre className="text-xs leading-relaxed">{`
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                        `}<span className="text-emerald-400">{`NOSSO SaaS (sa-east-1)`}</span>{`                          │
  │                                                                         │
  │  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────────┐  │
  │  │  Slack Bot   │   │ Relay Gateway│   │  Orchestrator + Agents    │  │
  │  │  (Bolt SDK)  │   │ (gRPC server)│   │  (Claude Agent SDK)       │  │
  │  └──────┬───────┘   └──────▲───────┘   └─────┬──────────────┬──────┘  │
  │         │                  │                  │              │         │
  │         │                  │            `}<span className="text-cyan-400">{`AssumeRole`}</span>{`        `}<span className="text-cyan-400">{`AssumeRole`}</span>{`    │
  └─────────┼──────────────────┼──────────────────┼──────────────┼─────────┘
            │                  │                  │              │
   ─────────┼──────────────────┼──────────────────┼──────────────┼───── INTERNET
            │                  │                  │              │
            ▼                  │                  │              │
  ┌──────────────┐             │                  │              │
  │  Slack API   │             │                  │              │
  │  (cloud)     │             │                  │              │
  └──────────────┘             │                  │              │
                               │                  ▼              ▼
                  ┌────────────┼──────────────────────────────────────────────┐
                  │  `}<span className="text-orange-400">{`AWS ACCOUNT DO CLIENTE`}</span>{`                                      │
                  │                                                            │
                  │  ┌─────────────────────────┐                               │
                  │  │  `}<span className="text-cyan-400">{`APIs Públicas da AWS`}</span>{`    │  ← Acessíveis de fora       │
                  │  │  (Control Plane)        │     com AssumeRole           │
                  │  │                         │                               │
                  │  │  • CloudWatch Logs      │  Log Analyzer usa isso       │
                  │  │  • CloudWatch Metrics   │  para buscar logs/métricas   │
                  │  │  • Lambda (Describe)    │  Infra Inspector lista       │
                  │  │  • DynamoDB (Describe)  │  funções, tabelas, config    │
                  │  │  • CloudTrail Events    │  Change Detector vê quem    │
                  │  │  • ECS (Describe)       │  fez deploy, mudou config   │
                  │  │  • S3, SQS, SNS, ALB   │                               │
                  │  └─────────────────────────┘                               │
                  │                                                            │
                  │  `}<span className="text-slate-600">{`─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─`}</span>{`   │
                  │                                                            │
                  │  ┌─ VPC (rede fechada) ─────────────────────────────────┐  │
                  │  │                                                      │  │
                  │  │   ┌────────────────────────────────────────┐        │  │
                  │  │   │ `}<span className="text-emerald-400">{`Agent Relay`}</span>{` (ECS task ou EC2 t3.micro)  │        │  │
                  │  │   │ gRPC outbound → nosso backend          │        │  │
                  │  │   └──────────────┬─────────────────────────┘        │  │
                  │  │                  │                                   │  │
                  │  │           ┌──────▼──────┐                           │  │
                  │  │           │   Sentry    │  ← Só isso precisa       │  │
                  │  │           │  self-hosted│     do relay              │  │
                  │  │           │  :9000      │                           │  │
                  │  │           └─────────────┘                           │  │
                  │  │                                                      │  │
                  │  │   ┌─────────┐ ┌──────────┐ ┌─────────┐            │  │
                  │  │   │ Lambda  │ │ DynamoDB  │ │  ECS    │ ← Esses   │  │
                  │  │   │functions│ │  tables   │ │services │   são      │  │
                  │  │   └─────────┘ └──────────┘ └─────────┘   acessados│  │
                  │  │                                            via API  │  │
                  │  │     `}<span className="text-slate-500">{`(rodam na VPC mas são managed services`}</span>{`     pública │  │
                  │  │      `}<span className="text-slate-500">{`com control plane público da AWS)`}</span>{`             │  │
                  │  └──────────────────────────────────────────────────────┘  │
                  │                                                            │
                  │  ┌─────────────────────────────────────────────────────┐  │
                  │  │ IAM Role: sre-platform-role                         │  │
                  │  │ Trust: nossa conta bastion                          │  │
                  │  │ External ID: uuid-v4-único                          │  │
                  │  │ Permissions:                                         │  │
                  │  │  • logs:FilterLogEvents, logs:GetLogEvents          │  │
                  │  │  • lambda:ListFunctions, lambda:GetFunction         │  │
                  │  │  • dynamodb:DescribeTable, dynamodb:ListTables      │  │
                  │  │  • cloudtrail:LookupEvents                          │  │
                  │  │  • cloudwatch:GetMetricData                         │  │
                  │  │  • ecs:Describe*, ec2:Describe*                     │  │
                  │  └─────────────────────────────────────────────────────┘  │
                  └────────────────────────────────────────────────────────────┘`}</pre>
            </div>
          </div>
        )}

        {activeTab === "c2" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
              <span className="text-blue-400">Cliente 2:</span> Azure + Teams + Grafana + Consul + VPN
            </h2>

            <div className="bg-slate-900 border border-blue-500/30 rounded-xl p-6 overflow-x-auto">
              <pre className="text-xs leading-relaxed">{`
  ┌─────────────────────────────────────────────────────────────────────────┐
  │                        `}<span className="text-emerald-400">{`NOSSO SaaS (Brazil South)`}</span>{`                       │
  │                                                                         │
  │  ┌──────────────┐   ┌──────────────┐   ┌────────────────────────────┐  │
  │  │ Teams Bot    │   │ Relay Gateway│   │  Orchestrator + Agents    │  │
  │  │(Bot Framewk) │   │ (gRPC server)│   │  (Claude Agent SDK)       │  │
  │  └──────┬───────┘   └──────▲───────┘   └─────┬─────────────────────┘  │
  │         │                  │                  │                        │
  │         │                  │            `}<span className="text-cyan-400">{`Lighthouse`}</span>{`                   │
  └─────────┼──────────────────┼──────────────────┼────────────────────────┘
            │                  │                  │
   ─────────┼──────────────────┼──────────────────┼──────────────── INTERNET
            │                  │                  │
            ▼                  │                  │
  ┌──────────────┐             │                  │
  │  Teams API   │             │                  │
  │  (cloud)     │             │                  │
  └──────────────┘             │                  ▼
                  ┌────────────┼──────────────────────────────────────────────┐
                  │  `}<span className="text-blue-400">{`AZURE SUBSCRIPTION DO CLIENTE`}</span>{`                              │
                  │                                                            │
                  │  ┌─────────────────────────┐                               │
                  │  │  `}<span className="text-cyan-400">{`APIs Públicas Azure`}</span>{`     │  ← Acessíveis de fora       │
                  │  │  (Control Plane)        │     com Lighthouse           │
                  │  │                         │                               │
                  │  │  • Azure Monitor Logs   │  Log Analyzer                │
                  │  │  • Azure Monitor Metrics│  Infra Inspector             │
                  │  │  • Activity Log         │  Change Detector             │
                  │  │  • Resource Manager     │  (quem deployou o quê)      │
                  │  │  • App Service, VMs     │                               │
                  │  └─────────────────────────┘                               │
                  │                                                            │
                  │  `}<span className="text-slate-600">{`─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─`}</span>{`   │
                  │                                                            │
                  │  ┌─ VNet + VPN (rede fechada) ─────────────────────────┐  │
                  │  │                                                      │  │
                  │  │   ┌──────────────────────────────────────────┐      │  │
                  │  │   │ `}<span className="text-emerald-400">{`Agent Relay`}</span>{` (ACI ou VM)                    │      │  │
                  │  │   │ gRPC outbound → nosso backend             │      │  │
                  │  │   └──────┬─────────────┬──────────────────────┘      │  │
                  │  │          │             │                              │  │
                  │  │   ┌──────▼────┐  ┌─────▼─────┐                      │  │
                  │  │   │  Grafana  │  │  Consul   │  ← Esses precisam   │  │
                  │  │   │  :3000    │  │  :8500    │    do relay          │  │
                  │  │   │ (alertas) │  │ (services)│                      │  │
                  │  │   └───────────┘  └───────────┘                      │  │
                  │  │                                                      │  │
                  │  │   ┌────────────┐ ┌───────────┐                      │  │
                  │  │   │ App VMs    │ │ Databases │ ← APIs internas     │  │
                  │  │   │            │ │           │   também via relay   │  │
                  │  │   └────────────┘ └───────────┘   se necessário     │  │
                  │  └──────────────────────────────────────────────────────┘  │
                  │                                                            │
                  │  ┌─────────────────────────────────────────────────────┐  │
                  │  │ Lighthouse Delegation                                │  │
                  │  │ Permissions:                                         │  │
                  │  │  • Log Analytics Reader                              │  │
                  │  │  • Monitoring Reader                                 │  │
                  │  │  • Reader (resource enumeration)                    │  │
                  │  └─────────────────────────────────────────────────────┘  │
                  └────────────────────────────────────────────────────────────┘`}</pre>
            </div>
          </div>
        )}

        {activeTab === "viability" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
              É viável? Análise honesta.
            </h2>

            <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-5">
              <h3 className="text-emerald-400 text-sm font-bold mb-3">O QUE FUNCIONA — temos fundação sólida</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { area: "Arquitetura", items: [
                    "Multi-agent com Claude Agent SDK: a ferramenta certa (Anthropic investiu pesado nisso)",
                    "Port & Adapter: mesmo código para AWS e Azure, testado em conceito",
                    "DynamoDB single table: pattern maduro, ElectroDB simplifica muito",
                    "Agent Relay com gRPC: padrão de mercado validado (Datadog, Resolve, todos fazem isso)"
                  ]},
                  { area: "Segurança", items: [
                    "AssumeRole/Lighthouse: credenciais temporárias, zero armazenamento — padrão enterprise",
                    "Session policies por sub-agente: mais granular que a concorrência",
                    "Approval gates: humano no loop para ações destrutivas",
                    "LGPD-native: diferenciador real no Brasil"
                  ]},
                  { area: "Mercado", items: [
                    "Zero concorrente com AI agentic SRE no Brasil",
                    "Resolve.ai cobra enterprise pricing ($$$) e não atende mid-market BR",
                    "2 clientes com interesse real e stacks mapeados",
                    "Dor é concreta: engenheiros gastam 84% do tempo apagando incêndio"
                  ]},
                  { area: "Tecnologia", items: [
                    "Claude Agent SDK é production-ready (não é protótipo)",
                    "3-layer model strategy controla custo (80% resolvido com Sonnet barato)",
                    "TypeScript end-to-end: um dev full-stack faz tudo",
                    "Langfuse open-source para observabilidade de AI"
                  ]},
                ].map((col, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-lg p-3">
                    <p className="text-emerald-400 text-xs font-bold mb-2">{col.area}:</p>
                    {col.items.map((item, j) => <p key={j} className="text-slate-400 text-xs mb-1">✅ {item}</p>)}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-red-500/30 rounded-xl p-5">
              <h3 className="text-red-400 text-sm font-bold mb-3">RISCOS REAIS — onde pode dar errado</h3>
              <div className="space-y-3">
                {[
                  {
                    risk: "1. Qualidade do diagnóstico AI",
                    severity: "ALTO",
                    detail: "Se o agent der diagnóstico errado nos primeiros incidentes, engenheiro perde confiança e nunca mais usa.",
                    mitigation: "Começar com modo uncertainty: agent apresenta hipóteses com confiança, nunca afirma 100%. Golden dataset com 50+ cenários reais dos clientes para validar antes de ir ao vivo. Primeiro mês em shadow mode (agent investiga mas não age, humano compara)."
                  },
                  {
                    risk: "2. Custo de tokens em escala",
                    severity: "MÉDIO",
                    detail: "Investigação profunda pode custar $2-5 por incidente. Se cliente tem 200 alertas/dia (maioria noise), custo explode.",
                    mitigation: "Layer 1 (triage com Sonnet) filtra 80% do noise por ~$0.02 cada. Só os 20% que passam vão para deep search. Custo real estimado: $50-150/mês por tenant mid-market. Viável."
                  },
                  {
                    risk: "3. Complexidade de integração real",
                    severity: "MÉDIO",
                    detail: "Cada cliente tem stack diferente, naming conventions próprios, logs em formatos inesperados. O PRD assume mundo ideal.",
                    mitigation: "Onboarding manual nos 2 primeiros clientes. Aprender com eles. Customização por tenant: runbooks, naming maps, alert rules. Evitar generalizar cedo demais."
                  },
                  {
                    risk: "4. Timeline de 27-30 semanas com equipe pequena",
                    severity: "MÉDIO",
                    detail: "PRD é ambicioso. Com 1-2 devs, qualquer imprevisto atrasa tudo.",
                    mitigation: "MVP mínimo para Cliente 1 em 12-14 semanas: reativo only (sem peace-time), AWS only, Slack only, Sentry + CloudWatch only. Cliente 2 (Azure) entra na sprint seguinte. Peace-time e tickets são fase 2."
                  },
                  {
                    risk: "5. Confiança do cliente em AI em produção",
                    severity: "BAIXO",
                    detail: "67% das empresas BR temem perder controle. Cliente pode resistir a dar acesso read-only à infra.",
                    mitigation: "Começar com acesso mínimo (só CloudWatch logs). Provar valor. Expandir gradualmente. Approval gates visíveis. Relay open-source para transparência."
                  },
                ].map((r, i) => (
                  <div key={i} className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        r.severity === "ALTO" ? "bg-red-500/20 text-red-400" :
                        r.severity === "MÉDIO" ? "bg-amber-500/20 text-amber-400" :
                        "bg-green-500/20 text-green-400"
                      }`}>{r.severity}</span>
                      <span className="text-slate-200 text-xs font-bold">{r.risk}</span>
                    </div>
                    <p className="text-slate-500 text-xs mb-1">{r.detail}</p>
                    <p className="text-slate-400 text-xs"><strong className="text-cyan-400">Mitigação:</strong> {r.mitigation}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-5">
              <h3 className="text-amber-400 text-sm font-bold mb-3">MINHA RECOMENDAÇÃO: MVP FASEADO</h3>
              <pre className="text-xs leading-relaxed text-slate-300">{`
  Em vez de entregar tudo em 30 semanas, entregar em 3 fases:

  `}<span className="text-emerald-400">{`FASE 1: "Prova de Valor" (12-14 semanas) — Cliente 1`}</span>{`
  ─────────────────────────────────────────────────────
  ✅ Reativo only (alertas → investigação → diagnóstico)
  ✅ AWS only (AssumeRole + CloudWatch + Lambda + DynamoDB)
  ✅ Sentry via Relay
  ✅ Slack only
  ✅ Triage + Investigation + Hipóteses com confiança
  ✅ Approval gate para ações
  ❌ Sem peace-time, sem tickets, sem proativo
  
  Meta: "O agente diagnosticou corretamente 70%+ dos P1/P2"
  Se falhar aqui → pivotar antes de investir mais

  `}<span className="text-blue-400">{`FASE 2: "Segundo Cliente" (+6 semanas = semana 18-20)`}</span>{`
  ─────────────────────────────────────────────────────
  ✅ Azure adapter (Lighthouse + Azure Monitor)
  ✅ Teams adapter
  ✅ Consul → Knowledge Graph
  ✅ Grafana via Relay
  ✅ Input manual (/sre investigate "problema X")
  ✅ Tickets básicos (/sre ticket)

  Meta: "Funciona em 2 clouds, 2 chat platforms, com input manual"

  `}<span className="text-purple-400">{`FASE 3: "Produto Completo" (+8 semanas = semana 26-28)`}</span>{`
  ─────────────────────────────────────────────────────
  ✅ Peace-time (anomaly scanner, on-call briefs, health queries)
  ✅ Proativo (detecção antes do incidente)
  ✅ Tenant memory (aprende com incidentes anteriores)
  ✅ Post-mortem auto-gerado
  ✅ Agent CI/CD (eval suite com auto-rollback)
  ✅ Jira/ServiceNow sync

  Meta: "Produto usado o dia inteiro, não só em emergências"`}</pre>
            </div>

            <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 rounded-xl p-5">
              <h3 className="text-emerald-400 text-sm font-bold mb-3" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
                Veredito final: É viável?
              </h3>
              <div className="text-xs text-slate-300 space-y-2">
                <p><strong className="text-emerald-400">Sim, é viável.</strong> Mas com ressalvas importantes.</p>
                <p>A tecnologia está madura (Claude Agent SDK, gRPC, DynamoDB, ConnectRPC). A arquitetura faz sentido. Os dois clientes têm stacks cobertas pelo PRD + ADR-010. O mercado brasileiro não tem concorrente direto.</p>
                <p>O risco não é técnico — é de <strong className="text-amber-400">execução e qualidade do AI</strong>. Se o primeiro diagnóstico em produção for errado, o cliente perde confiança. Por isso a Fase 1 focada é essencial: provar que o agent acerta antes de expandir.</p>
                <p>O PRD como está é <strong className="text-cyan-400">completo demais para um MVP</strong>. É um PRD de produto maduro. Para os dois clientes iniciais, a Fase 1 + 2 resolve. Peace-time e proativo são diferenciais de retenção — importantes, mas para depois de provar que a investigação funciona.</p>
                <p className="text-slate-500 mt-2">Bottom line: entregar Fase 1 em 12-14 semanas com 1-2 devs é factível. Provar valor. Iterar. Expandir.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
