import { useState } from "react";

const tabs = [
  { id: "gap", label: "Gap Analysis", icon: "🔍" },
  { id: "pillars", label: "5 Pilares vs Nós", icon: "🏛️" },
  { id: "warpeace", label: "War/Peace Time", icon: "⚔️" },
  { id: "eval", label: "Eval Framework", icon: "📋" },
  { id: "buildvsbuy", label: "Build vs Buy Intel", icon: "🧠" },
  { id: "actions", label: "Action Items", icon: "✅" },
];

const Badge = ({ children, color = "gray" }) => {
  const c = { green: "bg-green-100 text-green-800", red: "bg-red-100 text-red-800", amber: "bg-amber-100 text-amber-800", blue: "bg-blue-100 text-blue-800", purple: "bg-purple-100 text-purple-800", gray: "bg-gray-100 text-gray-800" };
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${c[color]}`}>{children}</span>;
};

const sections = {
  gap: () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-gray-900 to-yellow-900 text-white rounded-lg p-5">
        <h3 className="text-xl font-bold">Resolve.ai Buyers Guide — Competitive Intelligence</h3>
        <p className="text-gray-300 text-sm mt-1">20 páginas de playbook enterprise. Abaixo: o que aprendemos e o que precisamos ajustar no nosso PRD.</p>
      </div>

      <h4 className="font-bold text-lg text-gray-900">Feature Parity Check</h4>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg text-xs">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left w-48">Capability (Resolve)</th>
              <th className="px-3 py-2 text-center w-20">Nós?</th>
              <th className="px-3 py-2 text-left">Status no PRD</th>
              <th className="px-3 py-2 text-left">Gap / Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {[
              ["Multi-agent architecture", "✅", "ADR-002: Orchestrator + 4 sub-agentes", "Paridade. Eles têm agents para Code, Infra, Logs, Metrics, Traces."],
              ["Knowledge Graph (live)", "⚠️", "knowledge/ module planejado mas sem detalhe", "GAP CRÍTICO: Precisamos detalhar knowledge graph — topologia de serviços, dependências, deploy history como grafo vivo, não docs estáticos"],
              ["Memory System (learning)", "⚠️", "Langfuse traces + conhecimento genérico", "GAP: Eles enfatizam 'learns from every incident'. Precisamos de persistent memory por tenant — padrões aprendidos, RCAs anteriores, feedback loops"],
              ["Peace-time operations", "❌", "PRD foca 99% em war-time (incidentes)", "GAP CRÍTICO: Eles dedicam metade do guide a peace-time. On-call prep, vibe debugging, health briefs, cost anomalies. Precisamos de módulo dedicado"],
              ["War-time (incident response)", "✅", "Pipeline completo: Ingestion→Triage→Investigation→Remediation", "Paridade. Nosso deep search é provavelmente mais avançado."],
              ["Hypothesis ranking + evidence chains", "✅", "Investigation module: hypothesis ranking com confidence scores", "Paridade. Eles enfatizam 'transparent reasoning path' — nosso Langfuse traces cobre isso."],
              ["Approval-gated remediation", "✅", "ADR-008: Approval gate via Slack/Teams, resource-scoped creds", "Vantagem nossa: session policies por sub-agente + resource-scoped creds é mais granular que o que eles descrevem"],
              ["Code-aware (repo integration)", "⚠️", "Change Detector olha deploys, mas não analisa código", "GAP: Eles conectam com GitHub/GitLab repos. Precisamos de sub-agente que lê diffs de PRs recentes, Dockerfiles, config changes"],
              ["CI/CD integration", "❌", "Não mencionado no PRD", "GAP: Eles trace failures through deploy pipelines. Integrar com GitHub Actions, ArgoCD, Jenkins para correlacionar deploys com incidentes"],
              ["Post-mortem auto-generation", "⚠️", "Mencionado brevemente em remediation", "GAP: Eles geram post-mortems completos + 'new memories'. Precisamos de módulo de post-mortem que alimenta o knowledge graph"],
              ["Proactive detection", "❌", "Reagimos a alertas, não detectamos proativamente", "GAP: Eles detectam regressions 'before they become incidents'. Precisamos de peace-time scanner que analisa tendências"],
              ["PR generation", "❌", "Não mencionado", "GAP: Eles geram PRs com fix. Ex: Dockerfile com imagem incompatível → PR com correção. Alto valor percebido."],
              ["Natural language queries", "⚠️", "Sub-agentes recebem prompts, mas não há interface NLP", "GAP: Eles permitem 'checkout slow' → mapeamento automático. Precisamos de NL interface no Slack/Teams para queries ad-hoc"],
              ["Vibe debugging", "❌", "Não mencionado", "GAP: Conceito deles de explorar sinais sutis antes de virarem incidentes. É peace-time + NL queries combinados"],
              ["On-call prep briefs", "❌", "Não mencionado", "GAP: Auto-gerar resumo do estado do sistema para engenheiro que está começando turno de on-call"],
              ["Audit trail (every step)", "✅", "ADR-008: hash chain tamper-proof + Langfuse traces", "Vantagem nossa: hash chain + session tags é mais robusto que 'audit trail' genérico"],
              ["Multi-cloud support", "✅", "ADR-009: AWS + Azure com Port & Adapter", "Vantagem nossa: eles mencionam multi-cloud mas sem detalhe. Nosso ADR-009 é muito mais específico"],
              ["Slack-native", "✅", "ADR-009: Slack + Teams adapters", "Paridade. Eles focam Slack. Nós cobrimos Slack + Teams"],
              ["SOC 2 / compliance", "✅", "ADR-008: SOC 2 evidence automation + LGPD", "Vantagem nossa: LGPD é diferencial para Brasil. Eles mencionam SOC2/GDPR/HIPAA genericamente"],
            ].map(([cap, status, prd, gap], i) => (
              <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                <td className="px-3 py-2 font-medium text-gray-900">{cap}</td>
                <td className="px-3 py-2 text-center text-lg">{status}</td>
                <td className="px-3 py-2 text-gray-600">{prd}</td>
                <td className="px-3 py-2 text-gray-700">{gap}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-700">8</div>
          <div className="text-xs text-green-600">Paridade ou Vantagem</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-amber-700">5</div>
          <div className="text-xs text-amber-600">Parcialmente coberto</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-red-700">6</div>
          <div className="text-xs text-red-600">Gap (não temos)</div>
        </div>
      </div>
    </div>
  ),

  pillars: () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900">5 Pilares Resolve.ai vs Nosso PRD</h3>
      <p className="text-sm text-gray-600">A Resolve definiu esses 5 pilares como framework de avaliação para que compradores avaliem soluções. É um checklist que eles desenharam para ganhar. Precisamos ser competitivos em todos.</p>

      {[
        {
          pillar: "I. Knowledge",
          desc: "Grafo de serviços, dependências, deploy history, configs, code, runbooks, incident history — vivo, atualizado em minutos.",
          resolve: "Knowledge graph que se atualiza automaticamente. Testa mudando topologia e verificando se a investigação reflete.",
          us: "knowledge/ module planejado mas genérico. Não temos knowledge graph explícito.",
          gap: "critical",
          action: "Criar Knowledge Graph Module: service catalog auto-discovered via cloud APIs + deploy history + incident history + runbook index. Atualização contínua via CloudTrail/Activity Log events. ElectroDB entity: ServiceNode (id, dependencies[], lastDeploy, recentIncidents[], healthStatus). Graph queries: 'quais serviços dependem de X?' crucial para blast radius analysis.",
        },
        {
          pillar: "II. Reasoning",
          desc: "Planejar investigações, gerar/testar hipóteses, abandonar paths incorretos com citações, ranking por confidence.",
          resolve: "Teste: 2 incidentes com sintomas similares mas causas diferentes. Agent deve branchar e abandonar hipóteses erradas.",
          us: "Investigation module com hypothesis ranking, confidence scores, evidence chains. Deep search com 3 sub-agentes paralelos.",
          gap: "ok",
          action: "Já forte. Adicionar: hypothesis branching explícito (testar hipótese A e B em paralelo, citar por que abandonou A). Gravar 'rejected hypotheses' no audit trail — isso é o que eles chamam de 'transparent reasoning path'.",
        },
        {
          pillar: "III. Action",
          desc: "Executar read + write no stack: queries em logs/metrics/traces, rollbacks, PRs, config changes com approval gates.",
          resolve: "Teste: definir remediation com approval gate (ex: revert feature flag). Sistema propõe, pede approval, executa, verifica.",
          us: "Read via sub-agentes. Write via approval gate + resource-scoped creds. Mas não geramos PRs nem feature flag reverts.",
          gap: "partial",
          action: "Adicionar ações de write: (1) Generate PR via GitHub API (com diff sugerido). (2) Revert feature flag via LaunchDarkly/Unleash API. (3) Trigger rollback via deploy pipeline webhook. Cada ação = novo tool no Agent SDK com session policy específica.",
        },
        {
          pillar: "IV. Learning",
          desc: "Performance melhora com outcomes e feedback sem retraining manual. Padrões de incidentes resolvidos aceleram futuros.",
          resolve: "Teste: resolver incidente classe X, trigger near-duplicate. Espera diagnóstico mais rápido e recomendações mais confiantes.",
          us: "Langfuse traces + eval suite. Mas não temos persistent memory por tenant nem feedback loop de outcomes.",
          gap: "critical",
          action: "Criar Tenant Memory System: (1) Após cada incidente resolvido, extrair 'pattern' (symptoms → root cause → fix). (2) Armazenar como entity no DynamoDB: Pattern { tenantId, symptoms[], rootCause, fix, confidence, occurrences }. (3) Na próxima investigação, retrieval de patterns similares como context para o agente. (4) Feedback loop: engenheiro valida/corrige RCA → atualiza pattern confidence. É RAG operacional por tenant.",
        },
        {
          pillar: "V. Collaboration",
          desc: "Trabalha onde engenheiros trabalham (Slack/Teams), explica steps, aceita redirecionamento, handoff limpo.",
          resolve: "Teste: mid-investigation, pedir ao agent para mudar foco. Deve preservar contexto e postar summary coerente.",
          us: "Slack + Teams adapters com approval gates e war rooms. Mas não temos redirecionamento mid-investigation nem context preservation.",
          gap: "partial",
          action: "Adicionar: (1) /sre redirect [new focus] — muda foco da investigação preservando contexto anterior. (2) /sre explain — pede step-by-step do raciocínio atual. (3) /sre summary — gera resumo executivo do estado atual. (4) Bi-directional: engenheiro manda mensagem no thread e agente incorpora como 'human feedback signal'.",
        },
      ].map((p, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className={`px-4 py-2 flex items-center justify-between ${p.gap === "critical" ? "bg-red-600" : p.gap === "partial" ? "bg-amber-500" : "bg-green-600"} text-white`}>
            <span className="font-bold">{p.pillar}</span>
            <Badge color={p.gap === "critical" ? "red" : p.gap === "partial" ? "amber" : "green"}>
              {p.gap === "critical" ? "GAP CRÍTICO" : p.gap === "partial" ? "PARCIAL" : "OK"}
            </Badge>
          </div>
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-700"><strong>O que significa:</strong> {p.desc}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <p className="text-xs font-bold text-yellow-800 mb-1">Resolve.ai</p>
                <p className="text-xs text-yellow-700">{p.resolve}</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-xs font-bold text-blue-800 mb-1">Nosso PRD</p>
                <p className="text-xs text-blue-700">{p.us}</p>
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <p className="text-xs font-bold text-gray-800 mb-1">📋 Action Item</p>
              <p className="text-xs text-gray-700">{p.action}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  ),

  warpeace: () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900">War Time vs Peace Time — O Gap Mais Importante</h3>

      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
        <p className="text-red-800 font-bold">Insight mais valioso do Buyers Guide</p>
        <p className="text-red-700 text-sm mt-1">
          A Resolve dedica <strong>metade do documento</strong> a peace-time operations. 
          Nosso PRD é 99% war-time. Isso é um gap estratégico enorme — peace-time é o que gera 
          <strong> daily active usage</strong> e <strong>stickiness</strong>. Se clientes só usam na emergência, 
          churn é alto. Se usam todo dia, retenção é altíssima.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border-2 border-red-300 rounded-lg p-4">
          <h4 className="font-bold text-red-800 text-lg mb-3">⚔️ War Time (já temos)</h4>
          <div className="space-y-2 text-sm text-gray-700">
            <p>✅ Alert ingestion + normalization</p>
            <p>✅ Auto-triage P1-P4</p>
            <p>✅ Deep search: 3 sub-agentes em paralelo</p>
            <p>✅ Hypothesis ranking + evidence chains</p>
            <p>✅ Approval-gated remediation</p>
            <p>✅ War room auto-creation (Slack/Teams)</p>
            <p>✅ Audit trail completo</p>
            <p className="font-bold text-green-700 mt-2">Resolve benchmark: Alert→RCA em 7min. Nós: target similar com deep search.</p>
          </div>
        </div>

        <div className="bg-white border-2 border-amber-300 rounded-lg p-4">
          <h4 className="font-bold text-amber-800 text-lg mb-3">☮️ Peace Time (NÃO temos)</h4>
          <div className="space-y-2 text-sm text-gray-700">
            <p>❌ <strong>On-call prep briefs:</strong> Resumo de saúde do sistema para início de turno</p>
            <p>❌ <strong>Vibe debugging:</strong> Explorar sinais sutis antes de virarem incidentes</p>
            <p>❌ <strong>Health summaries:</strong> "Como está o checkout hoje?"</p>
            <p>❌ <strong>Dependency questions:</strong> "Quais serviços dependem do auth-service?"</p>
            <p>❌ <strong>Cost/latency anomaly triage:</strong> Detectar spikes proativamente</p>
            <p>❌ <strong>Change risk briefs:</strong> "Esse deploy é safe?"</p>
            <p>❌ <strong>Operational reports:</strong> Sintetizar estado para stakeholders</p>
            <p className="font-bold text-red-700 mt-2">SEM peace-time = produto usado 5% do tempo. COM peace-time = usado 100% do tempo.</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Novo Módulo Proposto: Peace-Time Operations</h4>
        <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs overflow-x-auto">
          <pre>{`// src/modules/peacetime/
├── on-call-briefing.ts      // Gera resumo para início de turno
│   └── "5 alerts ativos, 2 deploys nas últimas 4h, latência P99 do
│        checkout subiu 23% desde ontem, auth-service com memory
│        usage crescente (78%→86% em 6h)"
│
├── health-query.ts           // NL queries sobre estado do sistema
│   └── /sre health checkout  → status, deps, recent changes, alerts
│   └── /sre deps auth-service → upstream/downstream dependency graph
│   └── /sre changes today     → todos os deploys + config changes
│
├── anomaly-scanner.ts        // Proactive detection (runs every 15min)
│   └── Compara métricas atuais com baseline (7-day rolling avg)
│   └── Se desvio > 2σ → notifica no canal, NÃO como alert, como "heads up"
│   └── "⚡ Heads up: latência P99 do payment-service subiu 45ms/hr
│        nas últimas 3h. Padrão similar ao incidente INC-234 (config
│        de connection pool). Investigar?"
│
├── change-risk.ts            // Pre-deploy risk assessment
│   └── /sre risk-check [deploy-id]
│   └── Analisa: serviços afetados, blast radius, incidentes similares
│   └── "Risco MÉDIO: deploy afeta auth-service que tem 12 dependentes.
│        Último deploy similar (v2.3.1) causou INC-189. Recomendo:
│        canary deploy + monitorar connection pool por 30min"
│
├── report-generator.ts       // Relatórios periódicos
│   └── Weekly reliability report: MTTR, incidents, top offenders
│   └── Post-deploy report: impacto de cada deploy nas métricas
│
└── knowledge-capture.ts      // Auto-extrair patterns de incidentes resolvidos
    └── Após resolução: extrair (symptoms, root_cause, fix, blast_radius)
    └── Armazenar como Pattern entity no knowledge graph
    └── Na próxima investigação similar: "Padrão similar ao INC-234,
         resolvido com rollback de config. Confidence: 87%"`}</pre>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-bold text-green-900 mb-2">Impacto no Roadmap</h4>
        <p className="text-green-800 text-sm">
          Peace-time module entra no <strong>Sprint 8-9</strong> junto com Chat adapters — faz sentido 
          porque peace-time é primariamente interação via Slack/Teams. O anomaly-scanner pode entrar 
          no <strong>Sprint 5-7</strong> junto com deep search (reutiliza os mesmos sub-agentes em modo proativo).
        </p>
      </div>
    </div>
  ),

  eval: () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Framework de Avaliação — Copiar Para Nós</h3>
      <p className="text-sm text-gray-600">A Resolve definiu critérios de avaliação que compradores enterprise vão usar. Se nós proativamente demonstrarmos compliance com esses critérios, ganhamos credibilidade imediata.</p>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">6 Dimensões de Avaliação (deles) → Nosso Checklist</h4>
        <div className="space-y-3">
          {[
            { dim: "1. Integration breadth & depth", test: "Correlacionar spike em Datadog com config change em Terraform → single narrative", us: "✅ Multi-source parsers + CloudProvider port. Mas precisamos de integração com IaC tools (Terraform state, CloudFormation events)", action: "Adicionar parser para Terraform Cloud webhooks + CloudFormation events" },
            { dim: "2. Alert triage & signal-to-noise", test: "Cascading failure em 3 serviços → espera 1 root narrative, não 3 pages separados", us: "✅ Dedup + correlation no ingestion module. Mas precisamos testar cascading failure explicitly", action: "Adicionar cenário no eval suite: cascading failure → single narrative" },
            { dim: "3. NL understanding & query flexibility", test: "Usar termos internos e gíria de time. 'checkout slow' → serviços corretos", us: "⚠️ Não temos NL query interface. Só reagimos a alerts", action: "Peace-time module resolve isso. /sre + natural language no Slack/Teams" },
            { dim: "4. Accuracy, evidence & explainability", test: "'Show me the evidence' → inline citations + chain-of-logic summary", us: "✅ Langfuse traces + hypothesis evidence chains. Mas precisamos de 'show me the evidence' command", action: "Adicionar /sre evidence [incident-id] → lista de evidências com links diretos para logs/metrics" },
            { dim: "5. Dependency & change awareness", test: "Roll change upstream → linkage imediato quando downstream error rate sobe", us: "⚠️ Change Detector olha deploys, mas não mapeia upstream→downstream automaticamente", action: "Knowledge graph com dependency edges resolve isso. Change event no upstream → auto-check downstream health" },
            { dim: "6. Scalability & extensibility", test: "20 investigações paralelas, schema change mid-run, onboard new team em 1 dia", us: "✅ ECS Fargate = escala horizontal. ElectroDB = schema evolution. Multi-tenant from day 1", action: "Load test no eval suite: 20 concurrent investigations" },
          ].map((d, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge color="blue">{d.dim.split('.')[0]}.</Badge>
                <span className="font-bold text-gray-900 text-sm">{d.dim.split('. ')[1]}</span>
              </div>
              <p className="text-xs text-gray-500 mb-1"><strong>Teste deles:</strong> {d.test}</p>
              <p className="text-xs text-gray-700 mb-1"><strong>Nós:</strong> {d.us}</p>
              <p className="text-xs text-blue-700"><strong>→ Ação:</strong> {d.action}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">Anti-Demo Tests (copiar para nosso eval suite)</h4>
        <p className="text-sm text-gray-600 mb-3">A Resolve ensina compradores a testar com cenários difíceis. Se prepararmos nosso eval suite para esses cenários, estaremos prontos para qualquer PoC.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { test: "Noisy Data", desc: "Injetar ruído em 1 sinal. Agent deve down-rank, não perseguir o ruído.", eval: "Cenário: log com stack trace irrelevante + métrica de CPU spike não correlacionada. Agent deve identificar a causa real ignorando noise." },
            { test: "Novelty", desc: "Reproduzir issue com versão nova de código. Agent não deve depender só de histórico.", eval: "Cenário: mesmo serviço, mesmo sintoma, mas root cause totalmente diferente dos últimos 10 incidentes." },
            { test: "Drift", desc: "Mudar schema de telemetria mid-evaluation. Sistema deve adaptar sem retraining.", eval: "Cenário: renomear campo 'error_code' para 'err_code' em runtime. Agent deve lidar gracefully." },
            { test: "Time Pressure", desc: "Cap investigação em 10 minutos. Avaliar qualidade da melhor resposta disponível.", eval: "Cenário: P1 com maxTurns=15. Agent deve produzir 'best available answer' mesmo que investigação incompleta." },
          ].map((t, i) => (
            <div key={i} className="bg-gray-50 border border-gray-200 rounded p-3">
              <p className="font-bold text-gray-900 text-sm">{t.test}</p>
              <p className="text-xs text-gray-600">{t.desc}</p>
              <p className="text-xs text-blue-700 mt-1"><strong>Eval:</strong> {t.eval}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-bold text-purple-900 mb-2">Métricas de Sucesso (deles) → Nosso Dashboard</h4>
        <div className="grid grid-cols-2 gap-2 text-xs text-purple-800">
          <div><strong>War Time:</strong> MTTR delta, RCA quality, first-team-right rate, evidence latency, alert consolidation, handoff quality</div>
          <div><strong>Peace Time:</strong> On-call prep time, queries answered, detection lead time, toil reduction, knowledge capture</div>
          <div><strong>6-12 months targets:</strong> 25-30% MTTR reduction, 50% fewer war rooms, 10-15% capacity reclaimed, 85%+ satisfaction</div>
          <div><strong>Nosso eval suite:</strong> Precisamos medir TODAS essas métricas desde o dia 1 do beta. Langfuse custom metrics + tenant dashboard.</div>
        </div>
      </div>
    </div>
  ),

  buildvsbuy: () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Build vs Buy — Intel Estratégico</h3>
      <p className="text-sm text-gray-600">O Chapter 2 deles é basicamente FUD contra build in-house. Mas contém verdades que precisamos endereçar proativamente porque nossos clientes VÃO ler esse guide.</p>

      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r">
        <p className="font-bold text-amber-800">Os argumentos anti-build que nossos clientes vão ouvir:</p>
        <div className="text-sm text-amber-700 mt-2 space-y-1">
          <p>• 95% das iniciativas custom AI não chegam a produção (MIT 2025)</p>
          <p>• 40% dos projetos agentic AI serão abandonados até 2027 (Gartner)</p>
          <p>• Build leva 12-18 meses com 10+ engenheiros, e fica frágil em produção</p>
          <p>• Custo de oportunidade: engenheiros building infra vs building produto</p>
          <p>• Model updates quebram prompts. Sem CI/CD de agentes, sistema fica frágil</p>
        </div>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
        <p className="font-bold text-blue-800">Como isso nos afeta (somos BUILD, vendendo como BUY):</p>
        <div className="text-sm text-blue-700 mt-2 space-y-2">
          <p><strong>1. Precisamos parecer "buy":</strong> Nosso produto deve dar value em dias, não meses. 
          Onboarding 1-click (CloudFormation/ARM template + Add to Slack) é essencial. 
          Se levar semanas para setup, cliente pensa "poderia ter buildado".</p>
          <p><strong>2. 3 Layers deles são nosso checklist:</strong> Foundation (knowledge graph), Intelligence (agents + orchestration), Trust & Safety (guardrails + audit). Precisamos demonstrar maturidade nos 3.</p>
          <p><strong>3. "Agent CI/CD" é diferenciador:</strong> Eles mencionam que model updates quebram stability. 
          Nosso eval suite (Langfuse + LLM-as-judge + golden datasets) é exatamente isso. 
          Precisamos marketar como "Agent CI/CD" — regression testing automático para cada model update.</p>
          <p><strong>4. Customization at the edge:</strong> Eles recomendam "buy foundational, customize at the edge". 
          Precisamos oferecer: (a) Custom runbooks por tenant, (b) Custom alert rules, 
          (c) Custom knowledge base (runbooks do cliente ingestados no knowledge graph), 
          (d) Tenant-specific patterns learned from their incidents.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h4 className="font-bold text-gray-900 mb-3">3 Layers de Produção (deles) vs Nosso PRD</h4>
        <div className="space-y-3">
          {[
            { layer: "1. Foundation Layer", theirs: "Knowledge representation, Agent CI/CD, robust data pipelines", ours: "ElectroDB entities, Langfuse eval suite, webhook parsers. GAP: knowledge graph não está detalhado, agent CI/CD não está formalizado como feature", action: "Formalizar: Knowledge Graph Module + Agent CI/CD Pipeline (eval suite runs on every PR + model update)" },
            { layer: "2. Intelligence Layer", theirs: "Post-training optimization, production-grade orchestration, model supervision", ours: "3-layer model strategy (Sonnet/Opus), orchestrator + sub-agents, Langfuse tracking. OK mas precisamos de: prompt versioning rollback automático, model supervision alerts", action: "Adicionar: prompt version A/B testing com auto-rollback se accuracy cai >5%. Langfuse já suporta isso." },
            { layer: "3. Trust & Safety Layer", theirs: "Confidence scoring, audit trails, guardrails, approval workflows", ours: "Approval gates, session policies, hash chain audit, OPA policies. FORTE. Vantagem nossa.", action: "Adicionar: confidence scoring explícito (agent expressa 'confidence: 73%' em cada hipótese) + 'uncertainty mode' quando confidence < 50% (pede ajuda humana)" },
          ].map((l, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3">
              <p className="font-bold text-gray-900 text-sm">{l.layer}</p>
              <p className="text-xs text-gray-500"><strong>Resolve:</strong> {l.theirs}</p>
              <p className="text-xs text-gray-700"><strong>Nós:</strong> {l.ours}</p>
              <p className="text-xs text-blue-700 mt-1"><strong>→</strong> {l.action}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  ),

  actions: () => (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900">Action Items — Priorizado por Impacto</h3>

      {[
        { priority: "P0", color: "red", title: "Peace-Time Operations Module", why: "Gap mais importante. Sem isso, produto é usado 5% do tempo. A Resolve dedica metade do guide a isso.", effort: "Sprint 8-9 (junto com chat adapters)", items: ["On-call prep briefs (/sre briefing)", "Health queries (/sre health [service])", "Anomaly scanner proativo (15min intervals)", "Change risk assessment (/sre risk-check)", "Weekly reliability reports auto-gerados"] },
        { priority: "P0", color: "red", title: "Knowledge Graph Module", why: "Pilar 1 da Resolve. Sem knowledge graph, investigações começam do zero toda vez. É o 'memory' de longo prazo.", effort: "Sprint 3-4 (junto com cloud adapters)", items: ["ServiceNode entity (id, deps, deploys, incidents, health)", "Auto-discovery via cloud APIs (ECS, AKS, etc)", "Dependency mapping (upstream/downstream)", "Continuous update via CloudTrail/Activity Log events", "Pattern entity (symptoms → root_cause → fix) de incidentes resolvidos"] },
        { priority: "P1", color: "amber", title: "Code & CI/CD Integration", why: "A Resolve gera PRs e traça failures em pipelines. Alto valor percebido por engenheiros.", effort: "Sprint 5-7 (sub-agente adicional)", items: ["Code Analyzer sub-agent: lê PRs recentes, Dockerfiles, config changes", "GitHub/GitLab API integration para ler diffs e gerar PRs", "CI/CD webhook parser: GitHub Actions, ArgoCD", "Deploy pipeline tracing: correlacionar deploy → incidente"] },
        { priority: "P1", color: "amber", title: "Confidence Scoring + Uncertainty Mode", why: "Pilar II da Resolve. Engenheiros não confiam em AI que é 'confiante mas errada'. Expressar incerteza = trust.", effort: "Sprint 5-7 (no orchestrator)", items: ["Cada hipótese: confidence score 0-100%", "Se confidence < 50%: 'uncertainty mode' → pede input humano", "Rejected hypotheses gravadas no audit trail com reason", "/sre evidence [incident] → lista de evidências com links"] },
        { priority: "P1", color: "amber", title: "Tenant Memory System (Learning Loop)", why: "Pilar IV da Resolve. Sem isso, plataforma não aprende. Cada incidente começa do zero.", effort: "Sprint 8-9", items: ["Post-incident pattern extraction automática", "Pattern entity: symptoms[], rootCause, fix, confidence, occurrences", "RAG retrieval de patterns similares no início de cada investigação", "Feedback loop: engenheiro valida/corrige → confidence update"] },
        { priority: "P2", color: "blue", title: "Agent CI/CD Pipeline", why: "Diferenciador: model updates não quebram. Marketar como 'Agent CI/CD'.", effort: "Sprint 5-7", items: ["Eval suite roda em cada PR que muda prompts", "Eval suite roda em cada model update (Anthropic release)", "Auto-rollback de prompt version se accuracy degrada >5%", "Golden dataset: 50+ cenários com expected outcomes"] },
        { priority: "P2", color: "blue", title: "Post-Mortem Auto-Generation", why: "Valor percebido alto. Engenheiros odeiam escrever post-mortems. Auto-gerar + alimentar knowledge graph.", effort: "Sprint 8-9", items: ["Template: timeline, root cause, impact, fix, action items", "Auto-preencher com dados da investigação", "Gerar 'new memories' (patterns) para knowledge graph", "Export para Notion/Confluence/Google Docs"] },
      ].map((item, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className={`px-4 py-2 flex items-center justify-between ${item.color === "red" ? "bg-red-600" : item.color === "amber" ? "bg-amber-500" : "bg-blue-500"} text-white`}>
            <span className="font-bold">{item.priority}: {item.title}</span>
            <span className="text-xs opacity-80">{item.effort}</span>
          </div>
          <div className="p-4">
            <p className="text-sm text-gray-700 mb-2"><strong>Por quê:</strong> {item.why}</p>
            <div className="space-y-1">
              {item.items.map((it, j) => <p key={j} className="text-xs text-gray-600">• {it}</p>)}
            </div>
          </div>
        </div>
      ))}

      <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-5">
        <h4 className="font-bold text-green-900 mb-2">Resumo: O que muda no nosso PRD</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="font-bold text-green-800">Novos módulos:</p>
            <p className="text-green-700 text-xs">• Peace-Time Operations (P0)</p>
            <p className="text-green-700 text-xs">• Knowledge Graph (P0)</p>
            <p className="text-green-700 text-xs">• Tenant Memory System (P1)</p>
            <p className="text-green-700 text-xs">• Code & CI/CD Integration (P1)</p>
          </div>
          <div>
            <p className="font-bold text-blue-800">Melhorias em módulos existentes:</p>
            <p className="text-blue-700 text-xs">• Investigation: confidence scoring + rejected hypotheses</p>
            <p className="text-blue-700 text-xs">• Remediation: PR generation + feature flag revert</p>
            <p className="text-blue-700 text-xs">• Agent Runtime: Agent CI/CD pipeline</p>
            <p className="text-blue-700 text-xs">• Eval Suite: anti-demo tests (noise, novelty, drift, pressure)</p>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-3">
          <strong>Impacto no timeline:</strong> ~3 semanas adicionais distribuídas nos Sprints 3-9. 
          Total: 24 semanas → ~27 semanas, OU realocar post-mortem e agent CI/CD para post-MVP.
        </p>
      </div>
    </div>
  ),
};

export default function ResolveAnalysis() {
  const [activeTab, setActiveTab] = useState("gap");
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gradient-to-r from-gray-900 to-yellow-800 text-white px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-xl font-bold">Competitive Analysis: Resolve.ai Buyers Guide</h1>
          <p className="text-yellow-200 text-sm mt-0.5">Gaps, oportunidades e action items para nosso PRD</p>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
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
