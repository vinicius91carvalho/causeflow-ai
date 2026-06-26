import { useState } from "react";

// ═══════════════════════════════════════════════════════════════
// COMPLETE PRD — AI SRE PLATFORM (Brazil)
// Includes: Original PRD + ADR-008 (Credentials) + ADR-009 (Multi-Cloud/Chat)
// ═══════════════════════════════════════════════════════════════

// ── Section Group Definitions ──
const groups = [
  { id: "strategy", label: "Estratégia", icon: "🎯" },
  { id: "architecture", label: "Arquitetura", icon: "🏗️" },
  { id: "security", label: "Segurança", icon: "🔐" },
  { id: "providers", label: "Multi-Provider", icon: "🌐" },
  { id: "implementation", label: "Implementação", icon: "⚙️" },
];

// ── Reusable Components ──
const Badge = ({ children, color = "gray" }) => {
  const colors = { green: "bg-green-100 text-green-700", red: "bg-red-100 text-red-700", blue: "bg-blue-100 text-blue-700", amber: "bg-amber-100 text-amber-700", purple: "bg-purple-100 text-purple-700", gray: "bg-gray-100 text-gray-700" };
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors[color]}`}>{children}</span>;
};
const Code = ({ children, title }) => (
  <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs overflow-x-auto leading-relaxed">
    {title && <div className="text-gray-500 mb-2">// {title}</div>}
    <pre>{children}</pre>
  </div>
);
const Card = ({ title, children, accent = "gray" }) => {
  const borders = { blue: "border-l-4 border-blue-500", red: "border-l-4 border-red-500", green: "border-l-4 border-green-500", amber: "border-l-4 border-amber-500", purple: "border-l-4 border-purple-500", gray: "border border-gray-200" };
  return <div className={`bg-white rounded-lg p-5 ${borders[accent]}`}>{title && <h4 className="font-bold text-gray-900 mb-3">{title}</h4>}{children}</div>;
};
const Alert = ({ type = "info", children }) => {
  const styles = { info: "bg-blue-50 border-blue-200 text-blue-800", warning: "bg-amber-50 border-amber-200 text-amber-800", error: "bg-red-50 border-red-200 text-red-800", success: "bg-green-50 border-green-200 text-green-800" };
  return <div className={`border rounded-lg p-4 text-sm ${styles[type]}`}>{children}</div>;
};

// ═══════════════════════════════════════════════════════════════
// ALL SECTIONS
// ═══════════════════════════════════════════════════════════════
const sections = [
  // ────────────────────────────────────────
  // GROUP: STRATEGY
  // ────────────────────────────────────────
  {
    id: "overview", group: "strategy", title: "Visão Geral", icon: "📋",
    content: () => (
      <div className="space-y-5">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6">
          <h3 className="text-2xl font-bold mb-2">AI SRE Platform — O Resolve.ai do Brasil</h3>
          <p className="text-blue-100">Plataforma autônoma de SRE com IA que investiga, diagnostica e resolve incidentes usando deep search com Claude Agent SDK. SOC-first, LGPD-native, 100% localizada.</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { n: "R$ 12.3B", d: "Desperdício anual com downtime no BR" },
            { n: "83%", d: "Empresas BR ainda reativas" },
            { n: "R$ 2.847", d: "Custo/ticket reativo" },
            { n: "R$ 67", d: "Custo/incidente preditivo" },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-blue-700">{s.n}</div>
              <div className="text-xs text-gray-500 mt-1">{s.d}</div>
            </div>
          ))}
        </div>
        <Card title="Benchmark: Resolve.ai">
          <div className="text-sm text-gray-600 space-y-1">
            <p>$150M+ funding, $1B valuation, SOC 2 Type II. Multi-agent system, 73% faster MTTR.</p>
            <p>Clientes: DoorDash, Zscaler. Fundada por criadores do OpenTelemetry + ex-Splunk.</p>
          </div>
        </Card>
        <Card title="Gap no Brasil">
          <div className="text-sm text-gray-600 space-y-1">
            <p>67% das empresas temem perder controle dos processos. Barreira cultural + falta de player nacional.</p>
            <p><strong>Posicionamento:</strong> AI SRE autônomo, SOC-first, LGPD-native, dados em São Paulo, preço acessível mid-market.</p>
          </div>
        </Card>
        <Card title="Concorrentes">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="font-bold text-gray-900">Nacionais</p>
              <p className="text-gray-600">Elven Works: 500+ empresas, observabilidade, SEM agentic AI</p>
              <p className="text-gray-600">Mandic Cloud: Líder cloud, SRE managed, 100% humano</p>
            </div>
            <div>
              <p className="font-bold text-gray-900">Globais no BR</p>
              <p className="text-gray-600">PagerDuty: AIOps bolt-on, caro para BR</p>
              <p className="text-gray-600">incident.io: Slack-native, sem LGPD, sem presença local</p>
              <p className="text-gray-600">Datadog AIOps: Watchdog ML, custo proibitivo em escala</p>
            </div>
          </div>
        </Card>
      </div>
    ),
  },
  {
    id: "stack", group: "strategy", title: "Tech Stack", icon: "🔧",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Stack Técnica Completa</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg text-sm">
            <tbody className="divide-y divide-gray-200">
              {[
                ["Runtime", "TypeScript + Node.js 22"],
                ["Framework", "Hono (HTTP + WebSocket)"],
                ["Database", "DynamoDB (Single Table, ElectroDB)"],
                ["Cache / Queue", "ElastiCache Redis + SQS"],
                ["AI Engine", "Claude Agent SDK (TypeScript)"],
                ["Compute", "ECS Fargate (containers efêmeros)"],
                ["IaC", "CDK (TypeScript)"],
                ["Observability", "Langfuse (self-hosted) + CloudWatch + OpenTelemetry"],
                ["Testing", "LocalStack Pro + Vitest"],
                ["Architecture", "Modular Monolith (Modlito)"],
                ["CI/CD", "GitHub Actions + ECR"],
                ["Security", "Vault + OPA + gVisor"],
                ["Cloud Providers", "AWS + Azure (Port & Adapter)"],
                ["Chat Platforms", "Slack (Bolt SDK) + Teams (Bot Framework)"],
              ].map(([k, v], i) => (
                <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                  <td className="px-4 py-2 font-bold text-gray-900 w-40">{k}</td>
                  <td className="px-4 py-2 text-gray-700">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Alert type="info">
          <strong>Sanitização no artefato:</strong> Nomes de pacotes npm são renomeados no código de exemplo para evitar bloqueio do renderer. Mapeamento: DynamoORM = ElectroDB, LLMTrace = Langfuse, AWSLocal = LocalStack Pro, az-identity-lib = @azure/identity, slack-app-sdk = @slack/bolt, ms-bot-sdk = botbuilder.
        </Alert>
      </div>
    ),
  },
  // ────────────────────────────────────────
  // GROUP: ARCHITECTURE
  // ────────────────────────────────────────
  {
    id: "adrs", group: "architecture", title: "ADRs 001–007", icon: "📐",
    content: () => (
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-900">Architecture Decision Records</h3>
        {[
          { id: "001", title: "Agent Runtime: ECS Fargate", decision: "Containers efêmeros. Claude Agent SDK mantém estado conversacional e executa comandos em ambiente persistente. Lambda eliminado (timeout 15min insuficiente para deep search 20-40min). Custo dominante é tokens (~$2-5/investigação), não compute (~$0.05/hr).", rejected: "Lambda (timeout), EC2 (overhead operacional), EKS (complexo demais)" },
          { id: "002", title: "Multi-Agent Architecture", decision: "Orquestrador + sub-agentes especializados (Log Analyzer, Infra Inspector, Change Detector, Runbook Executor). Investigação paralela (3 agentes em 2min > 1 sequencial em 6min). Claude Agent SDK suporta sub-agentes nativamente via Task tool.", rejected: "Single agent (perde paralelismo), LangGraph/CrewAI (dependência externa)" },
          { id: "003", title: "3-Layer Performance Strategy", decision: "Layer 1 (Triage): Sonnet 4.5, <5s, ~$0.02 — classifica, filtra noise (80% resolvido aqui). Layer 2 (Deep Search): Sonnet 4.5 ×N paralelo, 2-5min, ~$1-3. Layer 3 (Synthesis): Opus 4.5, ~30s, ~$0.50 — síntese complexa.", rejected: "Opus para tudo (10x custo), Sonnet para tudo (perde raciocínio profundo)" },
          { id: "004", title: "Modular Monolith", decision: "Single deployable, módulos isolados por bounded context. docker compose up roda tudo local. 10x mais fácil debug (processo único, log stream único). Shared TypeScript types sem gRPC/proto.", rejected: "Microservices from start (over-engineering), serverless functions (fragmentação)" },
          { id: "005", title: "DynamoDB Single Table + ElectroDB", decision: "Single-digit ms latency. ElectroDB abstrai complexidade single-table com TypeScript type safety. Collections = joins eficientes. Pay-per-request = zero custo quando idle.", rejected: "PostgreSQL (connection overhead), MongoDB (sem type safety), Supabase (vendor lock-in)" },
          { id: "006", title: "Langfuse Self-Hosted (Observability)", decision: "Open-source, integração nativa Anthropic. Self-hosted em Fargate (LGPD data sovereignty). Traces completos, prompt versioning, A/B testing, LLM-as-judge evals. Métricas: custo, latência, accuracy por sub-agente/tenant.", rejected: "Helicone (closed-source), Datadog LLM Obs (caro), custom solution (meses de dev)" },
          { id: "007", title: "LocalStack Pro (Testing)", decision: "Simula AWS completa localmente: DynamoDB, SQS, Secrets Manager, CloudWatch. E2E tests contra infra real-like sem custos AWS. Cada PR = ephemeral stack.", rejected: "AWS dev account (custo), Moto (menos fidelidade), Testcontainers (não simula managed services)" },
        ].map((adr) => (
          <div key={adr.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge color="blue">ADR-{adr.id}</Badge>
              <span className="font-bold text-gray-900">{adr.title}</span>
            </div>
            <p className="text-sm text-gray-700 mb-2">{adr.decision}</p>
            <p className="text-xs text-red-600"><strong>Rejeitados:</strong> {adr.rejected}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "modules", group: "architecture", title: "Módulos", icon: "📦",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Modular Monolith — Estrutura Completa</h3>
        <Code title="Project Structure (Port & Adapter)">{`src/
├── main.ts
├── shared/
│   ├── ports/                          # INTERFACES (zero SDK imports)
│   │   ├── cloud-provider.ts           #   CloudProvider, CredentialVendor
│   │   ├── chat-platform.ts            #   ChatPlatform, ApprovalGate
│   │   ├── alert-source.ts             #   AlertParser, AlertNormalizer
│   │   └── observability.ts            #   Tracer, MetricRecorder
│   ├── provider-registry.ts            # Resolução dinâmica por tenant
│   ├── config/ | auth/ | events/ | db/ | errors/ | middleware/ | types/
│
├── modules/                            # CORE DOMAIN (provider-agnostic)
│   ├── ingestion/
│   │   ├── parsers/                    #   Datadog, Grafana, Azure Monitor, Prometheus
│   │   ├── normalizer.ts | dedup.ts
│   ├── triage/                         #   Fast classification (Layer 1)
│   ├── investigation/                  #   Deep Search (Layer 2+3), orchestrator, sub-agents
│   ├── remediation/                    #   Actions + approval gate
│   ├── knowledge/                      #   Knowledge graph, patterns, runbooks
│   ├── tenant/                         #   Multi-tenancy, onboarding, billing
│   └── audit/                          #   Compliance, immutable audit trail
│
├── infra/                              # ADAPTERS (importam SDKs específicos)
│   ├── cloud/
│   │   ├── aws/                        #   CloudProvider + CredentialVendor (STS)
│   │   └── azure/                      #   CloudProvider + CredentialVendor (Lighthouse)
│   ├── chat/
│   │   ├── slack/                      #   ChatPlatform (Bolt SDK, OAuth V2)
│   │   └── teams/                      #   ChatPlatform (Bot Framework, Adaptive Cards)
│   ├── db/ | queue/ | cache/ | agent/ | observability/
│
└── infra-as-code/
    ├── cdk/                            #   CDK stacks
    ├── templates/
    │   ├── aws-integration-cf.yml      #   CloudFormation para clientes AWS
    │   └── azure-integration-arm.json  #   ARM template para clientes Azure
    └── terraform/provider/             #   Terraform provider source`}</Code>
        <Card title="4-Layer Design">
          <div className="text-sm text-gray-600 space-y-2">
            <p><strong>1. EDGE:</strong> Hono router, JWT+RBAC, tenant context middleware, rate limiting</p>
            <p><strong>2. MODULES:</strong> Business logic isolada por bounded context, EventBus in-process</p>
            <p><strong>3. INFRA:</strong> ElectroDB entities, SQS queues, Redis cache, Claude SDK wrapper</p>
            <p><strong>4. AGENT CONTAINERS:</strong> gVisor runtime, --network none, Envoy proxy para credential injection</p>
          </div>
        </Card>
        <Card title="Provider Registry">
          <Code>{`const registry = new ProviderRegistry();
registry.registerCloud(new AwsCloudProvider(), new AwsCredentialVendor());
registry.registerCloud(new AzureCloudProvider(), new AzureCredentialVendor());
registry.registerChat(new SlackAdapter());
registry.registerChat(new TeamsAdapter());

// Uso no core domain — MESMO CÓDIGO para qualquer provider:
async function investigate(incidentId, tenantId) {
  const { cloud, chat, credentials } = await registry.resolveForTenant(tenantId);
  const creds = await credentials.vendCredentials(tenantId, 'log-analyzer', incidentId);
  const logs = await cloud.queryLogs(creds, { service: 'api', timeRange, limit: 100 });
  await chat.sendMessage(tenantId, channelId, {
    sections: [{ type: 'header', text: 'Investigação Iniciada', severity: 'info' }],
  });
}`}</Code>
        </Card>
      </div>
    ),
  },
  {
    id: "data-layer", group: "architecture", title: "Data Layer", icon: "💾",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">DynamoDB Single Table Design</h3>
        <Code title="ElectroDB Entity — Incident">{`const Incident = new Entity({
  model: { entity: 'incident', version: '1', service: 'sre' },
  attributes: {
    tenantId, incidentId,
    severity: ['P1','P2','P3','P4'],
    status: ['open','investigating','mitigated','resolved'],
    hypothesis: [{ rank, cause, confidence, evidence[], remediation }],
    timeline: [{ timestamp, action, actor, detail }],
    metrics: { ttd, tti, ttr, tokenCost, agentTurns },
  },
  indexes: {
    primary:    { pk: ['tenantId'], sk: ['incidentId'] },
    bySeverity: { gsi1: pk: ['tenantId'], sk: ['severity','status'] },
    byTime:     { gsi2: pk: ['tenantId'], sk: ['createdAt'] },
  },
});`}</Code>
        <Code title="Integration Entity (AWS + Azure)">{`const Integration = new Entity({
  model: { entity: 'integration', version: '1', service: 'sre' },
  attributes: {
    tenantId, provider: ['aws', 'azure'],
    // AWS: roleArn + externalId | Azure: subscriptionId + resourceGroup
    roleArn, externalId, accountId,       // AWS
    subscriptionId, resourceGroup,         // Azure
    managedByTenantId,                     // Azure Lighthouse
    features: { logAccess, metricAccess, infraAccess, remediation },
    status: ['active', 'pending_setup', 'broken', 'disabled'],
    setupMethod: ['cloudformation', 'terraform', 'cdk', 'arm_template', 'manual'],
  },
  indexes: {
    primary:     { pk: ['tenantId'], sk: ['provider'] },
    byAccountId: { gsi1: pk: ['accountId'], sk: ['tenantId'] },  // unicidade AWS
    byStatus:    { gsi2: pk: ['status'], sk: ['lastHealthCheck'] },
  },
});`}</Code>
        <Card title="8 Access Patterns Primários">
          <div className="text-sm text-gray-600 space-y-1">
            <p>1. Get incident by ID: PK=tenant, SK=incident</p>
            <p>2. List by tenant: PK=tenant, SK begins_with</p>
            <p>3. Filter severity+status: GSI1</p>
            <p>4. Recent incidents: GSI2 (createdAt desc)</p>
            <p>5. Incident + evidence + audit: Collection query</p>
            <p>6. Agent audit trail por tenant</p>
            <p>7. Integration por provider (AWS/Azure)</p>
            <p>8. Integrations que precisam de health check: GSI2 status</p>
          </div>
        </Card>
      </div>
    ),
  },
  {
    id: "agent-runtime", group: "architecture", title: "Agent Runtime", icon: "🤖",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Claude Agent SDK — Production Wrapper</h3>
        <Code title="Secure Agent Runner">{`class SecureAgentRunner {
  async run(prompt: string): Promise<AgentResult> {
    const trace = this.llmtrace.trace({ name, metadata: { tenantId, model } });
    
    const client = new AgentSDKClient({
      systemPrompt, model, maxTurns,
      allowedTools, permissionMode: 'plan' // NEVER acceptEdits
    });
    
    for await (const msg of client.stream(prompt)) {
      if (turns > maxTurns) break;              // Circuit breaker
      if (msg.toolUse) {
        const validated = await this.validateAction(msg.toolUse);
        if (!validated.safe) continue;           // Skip unsafe
      }
      span.end();
    }
    
    trace.update({ output, metadata: { duration, turns, totalTokens } });
    await this.llmtrace.flushAsync();
  }
  
  private async validateAction(toolUse): Promise<ValidationResult> {
    return PolicyEngine.evaluate(tenantId, toolUse); // OPA policy check
  }
}`}</Code>
        <Card title="Sub-Agent Architecture">
          <div className="text-sm text-gray-600 space-y-2">
            <p><strong>Orchestrator:</strong> Recebe alerta normalizado, decide quais sub-agentes acionar em paralelo.</p>
            <p><strong>Log Analyzer:</strong> Busca e analisa logs via CloudProvider port (CloudWatch ou Log Analytics).</p>
            <p><strong>Infra Inspector:</strong> Descreve estado atual da infraestrutura (ECS/EC2 ou Azure VMs/AKS).</p>
            <p><strong>Change Detector:</strong> Identifica deploys e mudanças recentes (CloudTrail ou Activity Log).</p>
            <p><strong>Runbook Executor:</strong> Executa ações de remediação APENAS após approval gate humano.</p>
          </div>
        </Card>
        <Alert type="info">Prompts dos sub-agentes gerenciados como Prompts versionados no Langfuse. A/B testing com métricas reais de accuracy, rollback em degradação de qualidade.</Alert>
      </div>
    ),
  },
  // ────────────────────────────────────────
  // GROUP: SECURITY
  // ────────────────────────────────────────
  {
    id: "cred-mgmt", group: "security", title: "ADR-008: Credenciais", icon: "🔑",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">ADR-008: Cross-Account Credential Management</h3>
        <Alert type="error"><strong>Princípio:</strong> NUNCA armazenamos credenciais de clientes. Apenas IAM Roles (AWS) ou Lighthouse delegations (Azure) com credenciais 100% temporárias.</Alert>
        <Code title="AWS: Token Vending Machine (TVM)">{`// Fluxo: Tenant → TVM → STS AssumeRole → Credenciais Temporárias (1h)
async vendCredentials(tenantId, agentRole, incidentId) {
  const tenant = await this.tenantStore.get(tenantId);
  const sessionPolicy = SESSION_POLICIES[agentRole]; // READ-ONLY por padrão
  
  const response = await sts.send(new AssumeRoleCommand({
    RoleArn: tenant.integration.roleArn,
    ExternalId: tenant.integration.externalId,    // UUID v4 único
    RoleSessionName: \`sre-\${agentRole}-\${incidentId.slice(0,8)}\`,
    DurationSeconds: 3600,
    Policy: sessionPolicy,                        // Scoped por sub-agente
    Tags: [
      { Key: 'TenantId', Value: tenantId },
      { Key: 'IncidentId', Value: incidentId },
      { Key: 'AgentRole', Value: agentRole },
    ],
    TransitiveTagKeys: ['TenantId', 'IncidentId', 'AgentRole'],
  }));
  return { ...response.Credentials, provider: 'aws', tenantId };
}`}</Code>
        <Card title="Session Policies por Sub-Agente">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead><tr className="bg-gray-100"><th className="px-3 py-2 text-left">Sub-Agente</th><th className="px-3 py-2 text-left">Permissões</th><th className="px-3 py-2">Write?</th></tr></thead>
              <tbody className="divide-y divide-gray-200">
                {[
                  ["Log Analyzer", "logs:FilterLogEvents, logs:GetLogEvents, logs:StartQuery", "❌"],
                  ["Infra Inspector", "ec2:Describe*, ecs:Describe*, ecs:List*, elb:Describe*", "❌"],
                  ["Change Detector", "cloudtrail:LookupEvents, codedeploy:Get*, codedeploy:List*", "❌"],
                  ["Runbook Executor (pendente)", "DENY ALL — bloqueado até approval", "🔒"],
                  ["Runbook Executor (aprovado)", "ecs:UpdateService, ec2:RebootInstances (resource-scoped)", "✅ + Humano"],
                ].map(([a, p, w], i) => (
                  <tr key={i}><td className="px-3 py-2 font-medium">{a}</td><td className="px-3 py-2 font-mono text-gray-600">{p}</td><td className="px-3 py-2 text-center">{w}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Guardrails no Onboarding" accent="amber">
          <div className="text-sm text-gray-700 space-y-1">
            <p>1. Tentamos AssumeRole SEM External ID → se funcionar, rejeitamos (role vulnerável)</p>
            <p>2. Listamos policies → se AdministratorAccess, rejeitamos (over-privileged)</p>
            <p>3. Cada AWS Account ID só registrado em 1 tenant (anti confused-deputy)</p>
            <p>4. Drift detection diário: External ID enforced? Role existe? Policies OK?</p>
          </div>
        </Card>
        <Card title="Conta Bastion Dedicada" accent="blue">
          <p className="text-sm text-gray-700">
            Seguindo padrão Datadog: conta AWS dedicada como proxy para assumir roles em clientes. 
            Isola o crown jewel (outbound-integration-role) de qualquer workload. 
            CloudTrail monitoring com alertas para: humano assumindo role, IP não-AWS, volume anômalo.
          </p>
        </Card>
      </div>
    ),
  },
  {
    id: "onboarding", group: "security", title: "Onboarding Cloud", icon: "🚀",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Onboarding — 3 Opções por Provider</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="AWS — 3 Opções" accent="amber">
            <div className="space-y-3 text-sm">
              <div className="bg-orange-50 p-3 rounded">
                <p className="font-bold text-orange-800">1. CloudFormation Quick-Create</p>
                <p className="text-orange-700 text-xs">1 clique. Template no S3 público. ExternalID como param NoEcho. Feature-gated: LogAccess, MetricAccess, Remediation.</p>
              </div>
              <div className="bg-orange-50 p-3 rounded">
                <p className="font-bold text-orange-800">2. Terraform Provider</p>
                <p className="text-orange-700 text-xs">Resource sreplatform_aws_integration. Gera External ID + IAM Policy automaticamente com base nos features habilitados.</p>
              </div>
              <div className="bg-orange-50 p-3 rounded">
                <p className="font-bold text-orange-800">3. CDK Construct (L3)</p>
                <p className="text-orange-700 text-xs">npm package @sre-platform/cdk-constructs. High-level, type-safe.</p>
              </div>
            </div>
          </Card>
          <Card title="Azure — 3 Opções" accent="blue">
            <div className="space-y-3 text-sm">
              <div className="bg-blue-50 p-3 rounded">
                <p className="font-bold text-blue-800">1. ARM Template (Portal)</p>
                <p className="text-blue-700 text-xs">Deploy no portal Azure. Cria Registration Definition com Lighthouse delegation. Service Principals por sub-agente com RBAC roles.</p>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <p className="font-bold text-blue-800">2. Terraform Provider</p>
                <p className="text-blue-700 text-xs">Resource sreplatform_azure_integration. Gera ARM template e delegation automaticamente.</p>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <p className="font-bold text-blue-800">3. Marketplace Offer</p>
                <p className="text-blue-700 text-xs">Oferta Managed Services no Azure Marketplace. Cliente compra → delegation automática.</p>
              </div>
            </div>
          </Card>
        </div>
        <Alert type="info">
          <strong>Azure Lighthouse vs AWS AssumeRole:</strong> No Azure, não há Token Vending Machine — Lighthouse + Managed Identities fazem o equivalente. Cada Managed Identity (por sub-agente) tem RBAC role assignment direto. Azure gerencia tokens automaticamente.
        </Alert>
      </div>
    ),
  },
  {
    id: "threat-model", group: "security", title: "Threat Model", icon: "⚔️",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Análise de Ameaças</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg text-xs">
            <thead><tr className="bg-gray-800 text-white"><th className="px-3 py-2 text-left">Ameaça</th><th className="px-3 py-2 text-left">Vetor</th><th className="px-3 py-2 text-left">Mitigação</th></tr></thead>
            <tbody className="divide-y divide-gray-200">
              {[
                ["Confused Deputy", "Atacante registra conta A → role B", "External ID único + validação + 1 account/tenant"],
                ["Credential Theft", "Backend comprometido", "Creds 1h + session policies + conta bastion"],
                ["Privilege Escalation", "Sub-agente extrapola escopo", "Session policy por agente = interseção com role"],
                ["Lateral Movement", "Creds tenant A → acessa B", "External ID diferente + session tags"],
                ["Insider Threat", "Operador assume role", "CloudTrail alert + role só assumível por ECS tasks"],
                ["Role Drift", "Cliente add AdminAccess", "Daily drift detection + rejeição + notificação"],
                ["Prompt Injection → Action", "Log injeta instrução", "Session policy READ-ONLY + approval gate para write"],
                ["Unauthorized Remediation", "Agent executa write sem approval", "DENY ALL default + novas creds após approval"],
                ["Spoofing", "Falsificação de identidade entre serviços", "mTLS + JWT short TTL + API key rotation"],
                ["Tampering", "Alteração de registros de auditoria", "Hash chain (tamper-proof) + signed container images"],
              ].map(([t, v, m], i) => (
                <tr key={i} className={i % 2 ? "bg-gray-50" : ""}><td className="px-3 py-2 font-bold">{t}</td><td className="px-3 py-2 text-gray-600">{v}</td><td className="px-3 py-2 text-green-700">{m}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <Card title="Worst Case: Backend Totalmente Comprometido" accent="red">
          <div className="text-sm text-gray-700 space-y-1">
            <p>1. Credenciais temporárias (1h) + session policies read-only</p>
            <p>2. Write impossível sem approval gate (Slack/Teams interaction do cliente)</p>
            <p>3. Mass-assume detectado por anomaly detection</p>
            <p>4. Conta bastion isolada + IP range monitoring</p>
            <p>5. Clientes com aws:SourceIp condition = creds inutilizáveis fora da rede</p>
          </div>
        </Card>
        <Card title="SOC 2 + LGPD" accent="green">
          <div className="grid grid-cols-2 gap-3 text-xs text-gray-700">
            <div><strong>CC6.1 Logical Access:</strong> IAM Roles, session policies, zero long-lived creds</div>
            <div><strong>CC6.3 Authorization:</strong> Feature-gated policies, approval gate, resource-scoped</div>
            <div><strong>CC7.1 Monitoring:</strong> CloudTrail, anomaly detection, daily drift checks</div>
            <div><strong>LGPD Art. 46:</strong> Creds efêmeras, TLS 1.3, session policies restritivas</div>
            <div><strong>LGPD Art. 37:</strong> Audit trail tamper-proof, session tags rastreáveis</div>
            <div><strong>Data Residency:</strong> Conta bastion sa-east-1, dados nunca saem do Brasil</div>
          </div>
        </Card>
      </div>
    ),
  },
  // ────────────────────────────────────────
  // GROUP: MULTI-PROVIDER
  // ────────────────────────────────────────
  {
    id: "cloud-ports", group: "providers", title: "Cloud: Ports", icon: "☁️",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">CloudProvider Port — Abstração Multi-Cloud</h3>
        <Code title="src/shared/ports/cloud-provider.ts">{`export interface CloudProvider {
  readonly type: 'aws' | 'azure';
  
  queryLogs(creds, query: LogQuery): Promise<LogEntry[]>;
  queryMetrics(creds, query: MetricQuery): Promise<MetricDataPoint[]>;
  describeServices(creds, filters?): Promise<ServiceInfo[]>;
  getRecentChanges(creds, timeRange): Promise<RecentChange[]>;
  executeRemediation(creds, action): Promise<RemediationResult>;
  validateConnection(creds): Promise<{ healthy: boolean }>;
}

export interface CredentialVendor {
  readonly provider: 'aws' | 'azure';
  vendCredentials(tenantId, agentRole, incidentId): Promise<CloudCredentials>;
  validateIntegration(tenantId): Promise<IntegrationHealth>;
  validateSetup(config): Promise<SetupValidation>;
}

// Tipos normalizados (provider-agnostic):
interface LogEntry { timestamp, message, level, service, metadata, raw }
interface MetricDataPoint { timestamp, value, unit }
interface ServiceInfo { id, name, type, status, region, metadata, raw }
interface RecentChange { id, type, service, timestamp, actor, description, status }`}</Code>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card title="AWS Adapter" accent="amber">
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>queryLogs:</strong> CloudWatch Logs → FilterLogEvents</p>
              <p><strong>queryMetrics:</strong> CloudWatch → GetMetricData</p>
              <p><strong>describeServices:</strong> ECS + EC2 + ELB Describe*</p>
              <p><strong>getRecentChanges:</strong> CloudTrail LookupEvents + CodeDeploy</p>
              <p><strong>credentials:</strong> STS AssumeRole + Session Policies (TVM)</p>
            </div>
          </Card>
          <Card title="Azure Adapter" accent="blue">
            <div className="text-sm text-gray-600 space-y-1">
              <p><strong>queryLogs:</strong> Log Analytics → KQL queries</p>
              <p><strong>queryMetrics:</strong> Azure Monitor → Metrics API</p>
              <p><strong>describeServices:</strong> ARM → Resource Graph queries</p>
              <p><strong>getRecentChanges:</strong> Activity Log + Deployments API</p>
              <p><strong>credentials:</strong> Lighthouse delegation + Managed Identities</p>
            </div>
          </Card>
        </div>
      </div>
    ),
  },
  {
    id: "chat-ports", group: "providers", title: "Chat: Ports", icon: "💬",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">ChatPlatform Port — Abstração Multi-Chat</h3>
        <Code title="src/shared/ports/chat-platform.ts">{`export interface ChatPlatform {
  readonly type: 'slack' | 'teams';
  
  sendMessage(tenantId, channelId, message: ChatMessage): Promise<{ messageId, threadId }>;
  updateMessage(tenantId, channelId, messageId, message): Promise<void>;
  createIncidentChannel(tenantId, incident): Promise<{ channelId, url }>;
  requestApproval(tenantId, channelId, request: ApprovalRequest): Promise<ApprovalResponse>;
  onInteraction(handler: InteractionHandler): void;
  onCommand(command: string, handler: CommandHandler): void;
}

// Nossa abstração de mensagem (convertida para Block Kit ou Adaptive Cards):
interface ChatMessage {
  sections: MessageSection[];
  threadId?: string;
}
interface MessageSection {
  type: 'text' | 'header' | 'divider' | 'actions' | 'fields' | 'code';
  text?: string;
  fields?: { label: string; value: string }[];
  actions?: { id, label, style, value }[];
  code?: { language: string; content: string };
  severity?: 'info' | 'warning' | 'error' | 'success';
}`}</Code>
        <Alert type="info">
          <strong>Conversão automática:</strong> MessageSection type: 'header' → Slack: Block Kit header → Teams: TextBlock Large+Bolder. MessageAction style: 'danger' → Slack: button style: danger → Teams: Action.Submit style: destructive.
        </Alert>
      </div>
    ),
  },
  {
    id: "slack", group: "providers", title: "Slack Adapter", icon: "💜",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Slack — "Add to Slack" Multi-Workspace</h3>
        <Card title="Fluxo de Instalação" accent="purple">
          <div className="space-y-2 text-sm text-gray-700">
            <p><strong>1.</strong> Cliente clica "Add to Slack" → redireciona para OAuth V2 authorize</p>
            <p><strong>2.</strong> Admin do workspace autoriza scopes mínimos</p>
            <p><strong>3.</strong> Callback com code → troca por bot_access_token via oauth.v2.access</p>
            <p><strong>4.</strong> Token criptografado (KMS) armazenado no DynamoDB vinculado ao tenant</p>
            <p><strong>5.</strong> Bot ativo no workspace! Cria canais, envia mensagens, recebe comandos.</p>
          </div>
        </Card>
        <Code title="Bolt SDK + DynamoDB InstallationStore">{`// Scopes mínimos — NÃO pedimos channels:history, files:read, admin.*
const slackApp = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  scopes: [
    'channels:manage',    // criar canais de incidente
    'channels:read',      // listar canais
    'chat:write',         // enviar mensagens
    'commands',           // slash commands
    'groups:read',        // ler canais privados
    'incoming-webhook',   // webhooks
    'users:read',         // resolver nomes
  ],
  installationStore: new DynamoInstallationStore(), // tokens encrypted com KMS
});`}</Code>
        <Alert type="warning">
          <strong>Tokens Slack são long-lived!</strong> xoxb-* não expiram. São equivalentes a access keys. Por isso: criptografados com KMS, acesso restrito via IAM, auditados. Cliente pode revogar desinstalando o app.
        </Alert>
      </div>
    ),
  },
  {
    id: "teams", group: "providers", title: "Teams Adapter", icon: "🟣",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Teams — Single-Tenant Bot + App Store</h3>
        <Alert type="error">
          <strong>Breaking Change:</strong> Microsoft depreciou bots multi-tenant em Julho 2025. Caminho recomendado: bot single-tenant no nosso Entra ID → publicar na Teams App Store → outros tenants instalam de lá.
        </Alert>
        <Card title="Fluxo de Instalação" accent="blue">
          <div className="space-y-2 text-sm text-gray-700">
            <p><strong>1.</strong> Admin busca "SRE Platform" na Teams App Store (ou recebe link direto)</p>
            <p><strong>2.</strong> Admin consent via Entra ID — consente permissões do app</p>
            <p><strong>3.</strong> Enterprise app criado no Entra ID do cliente</p>
            <p><strong>4.</strong> Vinculação: /sre connect com API key do dashboard → mapeia Entra tenant → nosso tenant</p>
            <p><strong>5.</strong> Bot ativo! Interações via Adaptive Cards.</p>
          </div>
        </Card>
        <Code title="Bot Framework + Adaptive Cards">{`class SrePlatformTeamsBot extends TeamsActivityHandler {
  // Identificar tenant a partir da mensagem
  private async resolveTenant(context: TurnContext) {
    const teamsTenantId = context.activity.conversation.tenantId;
    return this.tenantStore.findByEntraTenantId(teamsTenantId);
  }

  // Converter MessageSection → Adaptive Card
  private toAdaptiveCard(message: ChatMessage) {
    const body = message.sections.flatMap(section => {
      switch (section.type) {
        case 'header': return [{ type:'TextBlock', size:'Large', weight:'Bolder', text:section.text }];
        case 'fields': return [{ type:'FactSet', facts:section.fields.map(f=>({title:f.label,value:f.value})) }];
        case 'code':   return [{ type:'CodeBlock', language:section.code.language, codeSnippet:section.code.content }];
        default: return [{ type:'TextBlock', text:section.text, wrap:true }];
      }
    });
    const actions = message.sections.filter(s=>s.type==='actions').flatMap(s=>
      s.actions.map(a=>({ type:'Action.Submit', title:a.label, data:{actionId:a.id,value:a.value} }))
    );
    return CardFactory.adaptiveCard({ type:'AdaptiveCard', version:'1.5', body, actions });
  }
}`}</Code>
      </div>
    ),
  },
  // ────────────────────────────────────────
  // GROUP: IMPLEMENTATION
  // ────────────────────────────────────────
  {
    id: "observability", group: "implementation", title: "Observabilidade", icon: "📊",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Observabilidade — Data-Driven Optimization</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { title: "Langfuse (self-hosted)", desc: "Agent traces, token cost, latência, prompt versions, eval scores" },
            { title: "CloudWatch", desc: "Container metrics, API latency, error rates, SQS depth" },
            { title: "OpenTelemetry (Hono)", desc: "Request traces, module spans, external call durations" },
            { title: "Custom Metrics", desc: "MTTR, incidents/day, triage accuracy, agent accuracy" },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="font-bold text-gray-900 text-sm">{s.title}</p>
              <p className="text-xs text-gray-600">{s.desc}</p>
            </div>
          ))}
        </div>
        <Code title="Agent Eval Pipeline (LLM-as-Judge)">{`async function runEvalSuite(promptVersion, scenarios) {
  for (const scenario of scenarios) {
    const agentOutput = await runAgentPipeline(scenario.input);
    
    const judgeScore = await llmJudge({
      scenario: scenario.expected, agentOutput,
      rubric: 'Score 0-1: rootCauseAccuracy, severityAccuracy, actionRelevance, evidenceQuality'
    });
    
    llmtrace.score({ traceId, name: 'eval_accuracy', value: judgeScore.overall });
  }
}
// Run: pnpm eval --prompt-version=v12`}</Code>
        <Card title="12 Key Metrics">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-600">
            {["RCA accuracy/agente", "MTTR por tenant/severity", "Token cost/investigação", "Triage accuracy", "Latência P50/P95/P99", "Agent turns/investigação", "Prompt version performance", "Escalation rate", "Human override rate", "Eval suite regression", "Incidents/dia", "Cost per tenant/mês"].map((m, i) => (
              <div key={i} className="bg-gray-50 p-2 rounded">{m}</div>
            ))}
          </div>
        </Card>
      </div>
    ),
  },
  {
    id: "dx", group: "implementation", title: "DX & Testing", icon: "🧪",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Developer Experience & Testing</h3>
        <Code title="One Command Local Dev">{`# docker-compose.yml
services:
  app:       { build: ., ports: [3000], volumes: [./src:/app/src] }
  awslocal:  { image: awslocal-pro, environment: [SERVICES=dynamodb,sqs,secretsmanager] }
  azurite:   { image: azurite:latest }  # Azure Storage/Queue emulator
  redis:     { image: redis:7-alpine }
  llmtrace:  { image: llmtrace:2, depends_on: [llmtrace-db] }

# Commands:
# pnpm dev     → docker compose up + hot reload
# pnpm test    → vitest (unit + integration vs AWSLocal + Azurite)
# pnpm eval    → eval suite against real Claude
# pnpm test:e2e → full flow: webhook → resolve`}</Code>
        <Card title="Testing Pyramid">
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center gap-2"><Badge color="green">60%</Badge> <strong>Unit Tests:</strong> Parsers, normalizers, dedup, entities. Mocked dependencies.</div>
            <div className="flex items-center gap-2"><Badge color="blue">25%</Badge> <strong>Integration:</strong> DynamoDB CRUD, SQS, full modules contra AWSLocal + Azurite.</div>
            <div className="flex items-center gap-2"><Badge color="purple">10%</Badge> <strong>Agent Evals:</strong> Known scenarios → agent → LLM-as-judge. Accuracy, cost, latency.</div>
            <div className="flex items-center gap-2"><Badge color="amber">5%</Badge> <strong>E2E:</strong> Webhook → full pipeline → Slack/Teams mock. Smoke test por deploy.</div>
          </div>
        </Card>
      </div>
    ),
  },
  {
    id: "roadmap", group: "implementation", title: "Roadmap 24 Semanas", icon: "📅",
    content: () => (
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-900">Implementation Roadmap</h3>
        {[
          { s: "1-2", w: "1-4", t: "Foundation + Ports", items: ["Repo TS + Hono + docker compose (AWSLocal + Azurite + Redis + Langfuse)", "ElectroDB entities (Tenant, Incident, Evidence, AuditLog, Integration)", "Interfaces: CloudProvider, ChatPlatform, CredentialVendor, ProviderRegistry", "Hono middleware (auth, tenant, rate limit, audit)", "CloudFormation template (AWS) + ARM template (Azure)", "CDK skeleton + CI (GitHub Actions)"] },
          { s: "3-4", w: "5-8", t: "Ingestion + Triage", items: ["Webhook parsers: Datadog, Grafana, Prometheus, Azure Monitor", "Alert normalizer + dedup + correlation", "Triage agent (Sonnet 4.5) — classifica P1-P4, filtra noise", "AWS Cloud Provider adapter (CloudWatch, EC2, ECS)", "Azure Cloud Provider adapter (Log Analytics, Azure Monitor, ARM)", "AWS Credential Vendor (STS + Session Policies) + Azure Credential Vendor (Lighthouse)", "SQS integration + Langfuse integration"] },
          { s: "5-7", w: "9-14", t: "Deep Search Engine", items: ["Orchestrator + sub-agent dispatch (provider-agnostic via ports)", "Log Analyzer + Infra Inspector + Change Detector sub-agents", "Hypothesis synthesis + evidence chain", "Parallel execution + circuit breaker", "Agent eval suite: 20+ scenarios, LLM-as-judge, accuracy tracking"] },
          { s: "8-9", w: "15-18", t: "Chat + Remediation", items: ["Slack adapter: Bolt SDK + OAuth V2 + DynamoDB InstallationStore", "Teams adapter: Bot Framework + Adaptive Cards + App manifest", "Approval gate (Slack interactive messages + Teams Adaptive Card actions)", "Sandboxed action executor (gVisor)", "Runbook executor + post-mortem auto-generation", "War room: auto-create incident channel (Slack) / chat (Teams)"] },
          { s: "10-12", w: "19-24", t: "Enterprise + SOC 2", items: ["SSO/SAML + SCIM + RBAC + OPA policies", "Audit trail export + SOC 2 evidence generation", "Tenant onboarding wizard (AWS CloudFormation + Azure ARM + Slack OAuth + Teams App Store)", "Billing module", "Teams App Store submission + validation", "SOC 2 Type I audit prep", "Beta launch: 2 design partners (1 AWS+Slack, 1 Azure+Teams)"] },
        ].map((sprint) => (
          <div key={sprint.s} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge color="blue">Sprint {sprint.s}</Badge>
              <span className="font-bold text-gray-900">{sprint.t}</span>
              <span className="text-xs text-gray-400 ml-auto">Semanas {sprint.w}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-gray-600">
              {sprint.items.map((item, i) => <p key={i}>• {item}</p>)}
            </div>
          </div>
        ))}
        <Card title="MVP — Definition of Done" accent="green">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 text-xs text-gray-700">
            {[
              "☐ Recebe alertas de Datadog/Grafana/Azure Monitor via webhook",
              "☐ Triage P1-P4, filtra noise (AWS + Azure)",
              "☐ Deep search P1/P2: 3 sub-agentes paralelos",
              "☐ Hypothesis ranking com evidence chain",
              "☐ Propõe remediação via Slack/Teams com approval gate",
              "☐ Immutable audit trail de todas investigações",
              "☐ Langfuse: traces + eval suite 20+ cenários + accuracy >70%",
              "☐ Multi-tenant + multi-cloud + multi-chat isolation provável",
              "☐ docker compose up roda tudo local",
              "☐ CI: lint + test + eval + build <10min",
            ].map((item, i) => <p key={i}>{item}</p>)}
          </div>
        </Card>
      </div>
    ),
  },
];

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function CompletePRD() {
  const [activeSection, setActiveSection] = useState("overview");
  const [collapsed, setCollapsed] = useState({});
  const currentSection = sections.find((s) => s.id === activeSection);
  const currentGroup = groups.find((g) => g.id === currentSection?.group);

  const toggleGroup = (gid) => setCollapsed((p) => ({ ...p, [gid]: !p[gid] }));

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold">AI SRE Platform — Product Requirements Document</h1>
          <p className="text-gray-400 text-sm mt-0.5">Complete: Strategy + Architecture + Security + Multi-Provider + Implementation</p>
          <div className="flex gap-2 mt-2">
            <Badge color="green">v2.0</Badge>
            <Badge color="blue">Fev 2026</Badge>
            <Badge color="purple">AWS + Azure</Badge>
            <Badge color="amber">Slack + Teams</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5">
        <div className="flex flex-col md:flex-row gap-5">
          {/* Sidebar */}
          <nav className="md:w-52 flex-shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {groups.map((group) => (
                <div key={group.id}>
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 flex items-center justify-between"
                  >
                    <span>{group.icon} {group.label}</span>
                    <span className="text-gray-400">{collapsed[group.id] ? "▸" : "▾"}</span>
                  </button>
                  {!collapsed[group.id] && sections
                    .filter((s) => s.group === group.id)
                    .map((section) => (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full text-left px-4 py-2 text-sm border-b border-gray-50 transition-colors ${
                          activeSection === section.id
                            ? "bg-gray-900 text-white font-bold"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span className="mr-1.5 text-xs">{section.icon}</span>
                        {section.title}
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </nav>

          {/* Content */}
          <main className="flex-1 min-w-0">
            {currentGroup && (
              <div className="text-xs text-gray-400 mb-3">
                {currentGroup.icon} {currentGroup.label} › {currentSection?.title}
              </div>
            )}
            {currentSection && currentSection.content()}
          </main>
        </div>
      </div>
    </div>
  );
}
