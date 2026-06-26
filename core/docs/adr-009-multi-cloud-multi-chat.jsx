import { useState } from "react";

const sections = [
  {
    id: "overview",
    title: "Visão Geral",
    icon: "🌐",
    content: () => (
      <div className="space-y-6">
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r">
          <p className="text-blue-800 font-bold text-lg">Contexto do Negócio</p>
          <p className="text-blue-700 mt-1">
            Dois clientes iniciais: um usa <strong>AWS + Slack</strong>, o outro <strong>Azure + Teams</strong>.
            A plataforma precisa ser multi-cloud e multi-chat <strong>desde o dia 1</strong>,
            mas sem over-engineering — abstrações limpas com 2 implementações concretas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border-2 border-orange-300 rounded-lg p-5">
            <h3 className="font-bold text-gray-900 text-lg mb-3">☁️ Cloud Providers</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-orange-50 p-3 rounded">
                <span className="text-2xl">🟠</span>
                <div>
                  <p className="font-bold text-gray-900">AWS</p>
                  <p className="text-sm text-gray-600">Cross-Account AssumeRole + External ID (ADR-008)</p>
                  <p className="text-xs text-gray-500 mt-1">Cliente cria IAM Role → nós assumimos com STS</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-blue-50 p-3 rounded">
                <span className="text-2xl">🔵</span>
                <div>
                  <p className="font-bold text-gray-900">Azure</p>
                  <p className="text-sm text-gray-600">Azure Lighthouse (Delegated Resource Management)</p>
                  <p className="text-xs text-gray-500 mt-1">Cliente deploya ARM template → nós acessamos via delegation</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border-2 border-purple-300 rounded-lg p-5">
            <h3 className="font-bold text-gray-900 text-lg mb-3">💬 Chat Platforms</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-purple-50 p-3 rounded">
                <span className="text-2xl">💜</span>
                <div>
                  <p className="font-bold text-gray-900">Slack</p>
                  <p className="text-sm text-gray-600">V2 OAuth 2.0 → multi-workspace distribution</p>
                  <p className="text-xs text-gray-500 mt-1">Bolt SDK + Slack OAuth. "Add to Slack" button.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 bg-indigo-50 p-3 rounded">
                <span className="text-2xl">🟣</span>
                <div>
                  <p className="font-bold text-gray-900">Microsoft Teams</p>
                  <p className="text-sm text-gray-600">Single-tenant Bot → Teams App Store</p>
                  <p className="text-xs text-gray-500 mt-1">Bot Framework SDK. Multi-tenant bot depreciado Jul/2025.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-900 text-white rounded-lg p-5">
          <h3 className="font-bold text-lg mb-3">Princípio Arquitetural: Port & Adapter (Hexagonal)</h3>
          <div className="font-mono text-xs text-green-400 overflow-x-auto">
            <pre>{`┌──────────────────────────────────────────────────────────────────┐
│                        CORE DOMAIN                               │
│  Ingestion → Triage → Investigation → Remediation → Knowledge   │
│                                                                  │
│  Interfaces (Ports):                                             │
│  ├── CloudProvider    { getLogs, getMetrics, describeInfra, ... }│
│  ├── ChatPlatform     { sendMessage, createChannel, askApproval }│
│  ├── AlertSource      { parseWebhook, normalizeAlert }           │
│  └── CredentialVendor { vendCredentials, validateIntegration }   │
└───────────┬──────────────────────────────────┬───────────────────┘
            │                                  │
   ┌────────┴────────┐               ┌────────┴────────┐
   │    ADAPTERS      │               │    ADAPTERS      │
   │  (Cloud)         │               │  (Chat)          │
   │                  │               │                  │
   │ ┌──────────────┐ │               │ ┌──────────────┐ │
   │ │ AWS Adapter  │ │               │ │ Slack Adapter│ │
   │ │ - STS        │ │               │ │ - Bolt SDK   │ │
   │ │ - CloudWatch │ │               │ │ - OAuth V2   │ │
   │ │ - ECS/EC2    │ │               │ │ - Webhooks   │ │
   │ └──────────────┘ │               │ └──────────────┘ │
   │ ┌──────────────┐ │               │ ┌──────────────┐ │
   │ │Azure Adapter │ │               │ │Teams Adapter │ │
   │ │ - Lighthouse │ │               │ │ - Bot Frmwk  │ │
   │ │ - Monitor    │ │               │ │ - Graph API  │ │
   │ │ - ARM        │ │               │ │ - Entra ID   │ │
   │ └──────────────┘ │               │ └──────────────┘ │
   └──────────────────┘               └──────────────────┘`}</pre>
          </div>
          <p className="text-gray-400 text-sm mt-3">
            O core domain NUNCA importa AWS SDK ou Slack SDK diretamente. 
            Tudo passa por interfaces tipadas. Trocar de provider = implementar o adapter.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "cloud-ports",
    title: "Cloud Provider Ports",
    icon: "☁️",
    content: () => (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900">Interfaces Abstratas — Cloud Provider</h3>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs overflow-x-auto">
            <pre>{`// src/shared/ports/cloud-provider.ts

// ═══════════════════════════════════════════════
// PORT: CloudProvider — abstração multi-cloud
// ═══════════════════════════════════════════════

export type CloudProviderType = 'aws' | 'azure';

// Credenciais genéricas — cada adapter resolve internamente
export interface CloudCredentials {
  provider: CloudProviderType;
  tenantId: string;
  expiresAt: Date;
  // Opaque: cada adapter sabe interpretar
  raw: Record<string, unknown>;
}

// ── Logs ──
export interface LogQuery {
  service: string;       // "api-gateway", "order-service"
  timeRange: TimeRange;  // { start: Date, end: Date }
  filter?: string;       // free-text ou structured query
  limit?: number;
}

export interface LogEntry {
  timestamp: Date;
  message: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  service: string;
  metadata: Record<string, string>;
  raw: unknown;  // original do provider
}

// ── Metrics ──
export interface MetricQuery {
  name: string;          // "CPUUtilization", "ErrorRate"
  service: string;
  timeRange: TimeRange;
  period: number;        // seconds (60, 300, etc)
  stat: 'avg' | 'max' | 'min' | 'sum' | 'p99';
}

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  unit: string;
}

// ── Infrastructure ──
export interface ServiceInfo {
  id: string;            // arn:aws:ecs:... ou /subscriptions/...
  name: string;
  type: 'container' | 'vm' | 'serverless' | 'database' | 'loadbalancer';
  status: 'running' | 'stopped' | 'degraded' | 'unknown';
  region: string;
  metadata: Record<string, string>;
  raw: unknown;
}

// ── Changes/Deploys ──
export interface RecentChange {
  id: string;
  type: 'deployment' | 'config_change' | 'scaling' | 'infra_change';
  service: string;
  timestamp: Date;
  actor: string;         // "deploy-pipeline", "john@acme.com"
  description: string;
  status: 'success' | 'failed' | 'in_progress' | 'rolled_back';
  raw: unknown;
}

// ── Remediation Actions ──
export interface RemediationAction {
  type: 'restart_service' | 'scale_up' | 'rollback_deploy' | 'reboot_instance';
  target: string;        // service ID
  params: Record<string, unknown>;
}

export interface RemediationResult {
  success: boolean;
  action: RemediationAction;
  detail: string;
  timestamp: Date;
}

// ═══════════════════════════════════════════════
// PORT INTERFACE
// ═══════════════════════════════════════════════
export interface CloudProvider {
  readonly type: CloudProviderType;
  
  // Logs
  queryLogs(creds: CloudCredentials, query: LogQuery): Promise<LogEntry[]>;
  
  // Metrics
  queryMetrics(creds: CloudCredentials, query: MetricQuery): Promise<MetricDataPoint[]>;
  
  // Infrastructure
  describeServices(creds: CloudCredentials, filters?: ServiceFilter): Promise<ServiceInfo[]>;
  describeService(creds: CloudCredentials, serviceId: string): Promise<ServiceInfo>;
  
  // Changes
  getRecentChanges(creds: CloudCredentials, timeRange: TimeRange): Promise<RecentChange[]>;
  
  // Remediation (requires approval)
  executeRemediation(creds: CloudCredentials, action: RemediationAction): Promise<RemediationResult>;
  
  // Health check
  validateConnection(creds: CloudCredentials): Promise<{ healthy: boolean; detail?: string }>;
}

// ═══════════════════════════════════════════════
// PORT: CredentialVendor — abstração multi-cloud
// ═══════════════════════════════════════════════
export interface CredentialVendor {
  readonly provider: CloudProviderType;
  
  // Vende credenciais temporárias para um sub-agente
  vendCredentials(
    tenantId: string,
    agentRole: AgentRole,
    incidentId: string,
  ): Promise<CloudCredentials>;
  
  // Valida que a integração está correta
  validateIntegration(tenantId: string): Promise<IntegrationHealth>;
  
  // Setup: valida role/delegation antes de ativar
  validateSetup(config: IntegrationSetupConfig): Promise<SetupValidation>;
}`}</pre>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-bold text-amber-900 mb-2">Por que Port/Adapter e não Strategy Pattern?</h4>
          <p className="text-amber-800 text-sm">
            Strategy seria suficiente para trocar algoritmos, mas Port/Adapter nos dá mais: 
            cada adapter é um módulo completo com suas próprias dependências (AWS SDK vs Azure SDK), 
            configuração, e testes. O core domain não tem <code>import</code> de nenhum SDK externo.
            Em testes, injetamos adapters mock que simulam respostas sem tocar em cloud.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "azure-adapter",
    title: "Azure: Lighthouse",
    icon: "🔵",
    content: () => (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900">Azure Adapter — Lighthouse Delegation</h3>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-bold text-blue-900 mb-2">Azure Lighthouse vs AWS AssumeRole</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-blue-100">
                  <th className="px-3 py-2 text-left font-bold text-blue-900">Aspecto</th>
                  <th className="px-3 py-2 text-left font-bold text-orange-700">AWS (AssumeRole)</th>
                  <th className="px-3 py-2 text-left font-bold text-blue-700">Azure (Lighthouse)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-200">
                {[
                  { aspect: "Mecanismo", aws: "STS AssumeRole → credenciais temporárias", azure: "Delegated Resource Management → RBAC nativo" },
                  { aspect: "Onboarding", aws: "CloudFormation / Terraform cria IAM Role", azure: "ARM Template cria Registration Definition" },
                  { aspect: "Credenciais", aws: "Access Key + Secret + Session Token (1h)", azure: "Sem credenciais extras — usa token do nosso Service Principal" },
                  { aspect: "Isolamento", aws: "External ID por tenant (confused deputy)", azure: "managedByTenantId + RBAC assignment por delegation" },
                  { aspect: "Permissões", aws: "IAM Policy (custom, feature-gated)", azure: "Built-in RBAC Roles (Reader, Contributor, etc)" },
                  { aspect: "Revogação", aws: "Cliente deleta IAM Role", azure: "Cliente remove delegation a qualquer momento" },
                  { aspect: "Auditoria", aws: "CloudTrail (AssumeRole events)", azure: "Activity Log (ambos tenants veem)" },
                  { aspect: "Session scope", aws: "Session Policy por sub-agente", azure: "Managed Identity por sub-agente (cada um com RBAC)" },
                ].map((row, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 font-bold text-gray-900">{row.aspect}</td>
                    <td className="px-3 py-2 text-gray-700">{row.aws}</td>
                    <td className="px-3 py-2 text-gray-700">{row.azure}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-gray-900 mb-3">Onboarding Azure — ARM Template</h4>
          <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs overflow-x-auto">
            <pre>{`// ARM Template para Azure Lighthouse delegation
{
  "$schema": "https://schema.management.azure.com/.../deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "managedByTenantId": {
      "type": "string",
      "defaultValue": "OUR-ENTRA-TENANT-ID",
      "metadata": { "description": "SRE Platform tenant ID" }
    }
  },
  "resources": [{
    "type": "Microsoft.ManagedServices/registrationDefinitions",
    "apiVersion": "2022-10-01",
    "name": "[guid('sre-platform-delegation')]",
    "properties": {
      "registrationDefinitionName": "SRE Platform - AI SRE Investigation",
      "description": "Permite à SRE Platform investigar incidentes",
      "managedByTenantId": "[parameters('managedByTenantId')]",
      "authorizations": [
        {
          // Nosso Service Principal - READ ONLY para investigação
          "principalId": "SP-INVESTIGATION-GROUP-ID",
          "principalIdDisplayName": "SRE Platform - Investigation",
          "roleDefinitionId": "acdd72a7-3385-48ef-bd42-f606fba81ae7"
          // ↑ Reader role — apenas leitura
        },
        {
          // Nosso SP para Log Analytics
          "principalId": "SP-LOG-ANALYZER-ID",
          "principalIdDisplayName": "SRE Platform - Log Analyzer",
          "roleDefinitionId": "73c42c96-874c-492b-b04d-ab87d138a893"
          // ↑ Log Analytics Reader
        },
        {
          // Nosso SP para Monitoring
          "principalId": "SP-MONITORING-ID",
          "principalIdDisplayName": "SRE Platform - Monitoring",
          "roleDefinitionId": "43d0d8ad-25c7-4714-9337-8ba259a9fe05"
          // ↑ Monitoring Reader
        },
        {
          // OPCIONAL: Remediation (Contributor em RG específico)
          "principalId": "SP-REMEDIATION-ID",
          "principalIdDisplayName": "SRE Platform - Remediation",
          "roleDefinitionId": "b24988ac-6180-42a0-ab88-20f7382dd24c"
          // ↑ Contributor — apenas se cliente habilitar remediation
        },
        {
          // Poder de remoção — para não ficar "preso"
          "principalId": "SP-ADMIN-ID",
          "principalIdDisplayName": "SRE Platform - Admin",
          "roleDefinitionId": "91c1777a-f3dc-4fae-b103-61d183457e46"
          // ↑ Managed Services Registration Assignment Delete Role
        }
      ]
    }
  }]
}

// No Azure, cada Service Principal = equivalente a um sub-agente com session policy
// Log Analyzer SP → só pode ler logs
// Monitoring SP → só pode ler métricas
// Remediation SP → Contributor, mas atrás de approval gate`}</pre>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-gray-900 mb-3">Azure Credential Vendor (adapter)</h4>
          <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs overflow-x-auto">
            <pre>{`// src/infra/cloud/azure/azure-credential-vendor.ts

import { DefaultAzureCredential } from 'az-identity-lib';

export class AzureCredentialVendor implements CredentialVendor {
  readonly provider = 'azure' as const;

  // No Azure Lighthouse, NÃO há "vending" de credenciais separadas.
  // Nosso Service Principal já tem acesso delegado via RBAC.
  // O "scoping" é feito via Service Principals diferentes por agente role.
  
  private spCredentials: Record<AgentRole, DefaultAzureCredential> = {
    'log-analyzer': new DefaultAzureCredential({
      managedIdentityClientId: process.env.AZURE_SP_LOG_ANALYZER_CLIENT_ID,
    }),
    'infra-inspector': new DefaultAzureCredential({
      managedIdentityClientId: process.env.AZURE_SP_INFRA_CLIENT_ID,
    }),
    'change-detector': new DefaultAzureCredential({
      managedIdentityClientId: process.env.AZURE_SP_MONITORING_CLIENT_ID,
    }),
    'runbook-executor': new DefaultAzureCredential({
      managedIdentityClientId: process.env.AZURE_SP_REMEDIATION_CLIENT_ID,
    }),
  };

  async vendCredentials(
    tenantId: string,
    agentRole: AgentRole,
    incidentId: string,
  ): Promise<CloudCredentials> {
    const tenant = await this.tenantStore.get(tenantId);
    const credential = this.spCredentials[agentRole];
    
    if (!credential) throw new UnknownAgentRoleError(agentRole);

    // Token para acessar recursos delegados do cliente
    const token = await credential.getToken(
      'https://management.azure.com/.default'
    );

    return {
      provider: 'azure',
      tenantId,
      expiresAt: new Date(token.expiresOnTimestamp),
      raw: {
        credential,  // DefaultAzureCredential (managed identity)
        subscriptionId: tenant.integration.azure.subscriptionId,
        resourceGroup: tenant.integration.azure.resourceGroup,
      },
    };
  }
  
  async validateIntegration(tenantId: string): Promise<IntegrationHealth> {
    // Verificar que a delegation ainda existe
    // Listar delegações e confirmar que nosso tenant está lá
    const creds = await this.vendCredentials(tenantId, 'infra-inspector', 'health-check');
    const client = new ManagedServicesClient(creds.raw.credential);
    
    // Se conseguir listar delegações, está saudável
    try {
      const assignments = client.registrationAssignments.list(
        \`/subscriptions/\${creds.raw.subscriptionId}\`
      );
      return { healthy: true };
    } catch {
      return { healthy: false, detail: 'Delegation removed or expired' };
    }
  }
}`}</pre>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-bold text-green-900 mb-2">Vantagem do Lighthouse</h4>
          <p className="text-green-800 text-sm">
            No Azure, não precisamos de Token Vending Machine. O <strong>Lighthouse delegation + Managed Identities</strong> faz 
            o equivalente: cada Managed Identity (por sub-agente) tem RBAC role assignment direto via delegation. 
            O Azure gerencia os tokens automaticamente. É mais simples que o modelo AWS, 
            mas com o mesmo nível de isolamento.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "chat-ports",
    title: "Chat Platform Ports",
    icon: "💬",
    content: () => (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900">Interfaces Abstratas — Chat Platform</h3>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs overflow-x-auto">
            <pre>{`// src/shared/ports/chat-platform.ts

export type ChatPlatformType = 'slack' | 'teams';

// ═══════════════════════════════════════════════
// Mensagens — abstração que funciona para ambos
// ═══════════════════════════════════════════════
export interface ChatMessage {
  // Blocks/Cards são representados como nossa abstração
  // Cada adapter converte para Slack Block Kit ou Teams Adaptive Cards
  sections: MessageSection[];
  threadId?: string;      // para reply em thread
  ephemeral?: boolean;    // só visível para 1 user
}

export interface MessageSection {
  type: 'text' | 'header' | 'divider' | 'actions' | 'fields' | 'code';
  text?: string;
  fields?: { label: string; value: string }[];
  actions?: MessageAction[];
  code?: { language: string; content: string };
  severity?: 'info' | 'warning' | 'error' | 'success';
}

export interface MessageAction {
  id: string;            // "approve_rollback", "dismiss"
  label: string;         // "✅ Aprovar Rollback"
  style?: 'primary' | 'danger' | 'default';
  value: string;         // payload quando clicado
}

// ═══════════════════════════════════════════════
// Approval Gate — componente crítico
// ═══════════════════════════════════════════════
export interface ApprovalRequest {
  incidentId: string;
  tenantId: string;
  action: string;        // "rollback_deploy", "restart_service"
  description: string;
  evidence: string;      // resumo da investigação
  risk: 'low' | 'medium' | 'high';
  timeout: number;       // seconds até auto-reject
}

export interface ApprovalResponse {
  approved: boolean;
  approvedBy?: string;   // "john@acme.com"
  timestamp: Date;
  channel: string;
}

// ═══════════════════════════════════════════════
// PORT INTERFACE
// ═══════════════════════════════════════════════
export interface ChatPlatform {
  readonly type: ChatPlatformType;
  
  // Enviar mensagem para canal/thread
  sendMessage(
    tenantId: string,
    channelId: string,
    message: ChatMessage,
  ): Promise<{ messageId: string; threadId: string }>;
  
  // Atualizar mensagem existente (ex: progresso investigação)
  updateMessage(
    tenantId: string,
    channelId: string,
    messageId: string,
    message: ChatMessage,
  ): Promise<void>;
  
  // Criar canal/chat dedicado para incidente (war room)
  createIncidentChannel(
    tenantId: string,
    incident: { id: string; title: string; severity: string },
  ): Promise<{ channelId: string; url: string }>;
  
  // Pedir aprovação com botões interativos
  requestApproval(
    tenantId: string,
    channelId: string,
    request: ApprovalRequest,
  ): Promise<ApprovalResponse>;
  
  // Registrar handler para interações (botões, comandos)
  onInteraction(handler: InteractionHandler): void;
  
  // Registrar handler para slash commands / mentions
  onCommand(command: string, handler: CommandHandler): void;
}

// ═══════════════════════════════════════════════
// Conversão: Nossa abstração → Slack/Teams
// ═══════════════════════════════════════════════
// 
// MessageSection { type: 'header', text: 'P1: API Down' }
//   → Slack: { "type": "header", "text": { "type": "plain_text", "text": "..." } }
//   → Teams: { "type": "TextBlock", "size": "Large", "weight": "Bolder", "text": "..." }
//
// MessageAction { id: 'approve', label: 'Aprovar', style: 'primary' }
//   → Slack: { "type": "button", "action_id": "approve", "style": "primary", ... }
//   → Teams: { "type": "Action.Submit", "title": "Aprovar", "style": "positive", ... }
//
// MessageSection { type: 'code', code: { language: 'json', content: '...' } }
//   → Slack: { "type": "section", "text": { "type": "mrkdwn", "text": "\\\`\\\`\\\`json\\n...\\n\\\`\\\`\\\`" } }
//   → Teams: { "type": "CodeBlock", "language": "json", "codeSnippet": "..." }`}</pre>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-bold text-purple-900 mb-2">Por que não usar Slack Block Kit diretamente?</h4>
          <p className="text-purple-800 text-sm">
            Se codificarmos mensagens em Block Kit no core domain, cada vez que adicionarmos 
            um chat provider temos que reescrever todos os templates. Com nossa abstração <code>MessageSection</code>, 
            o core define "o que" comunicar e cada adapter converte para o formato nativo. 
            Bonus: facilita testes — assertamos na estrutura semântica, não no JSON do Slack.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "slack",
    title: "Slack: Plug & Play",
    icon: "💜",
    content: () => (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900">Slack App — Multi-Workspace Distribution</h3>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-gray-900 mb-3">Como qualquer empresa "apenas pluga"</h4>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <span className="bg-purple-100 text-purple-700 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">1</span>
              <div>
                <p className="font-bold text-gray-900">Cliente clica "Add to Slack" no dashboard</p>
                <p className="text-sm text-gray-600">Botão redireciona para <code>slack.com/oauth/v2/authorize</code> com scopes mínimos.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="bg-purple-100 text-purple-700 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">2</span>
              <div>
                <p className="font-bold text-gray-900">Admin do workspace autoriza</p>
                <p className="text-sm text-gray-600">Slack mostra quais permissões nosso bot precisa. Admin aprova.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="bg-purple-100 text-purple-700 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">3</span>
              <div>
                <p className="font-bold text-gray-900">Redirect callback com authorization code</p>
                <p className="text-sm text-gray-600">Nosso backend troca code por <code>bot_access_token</code> via <code>oauth.v2.access</code>.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="bg-purple-100 text-purple-700 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">4</span>
              <div>
                <p className="font-bold text-gray-900">Token armazenado (encrypted) vinculado ao tenant</p>
                <p className="text-sm text-gray-600">DynamoDB: <code>PK=tenant_abc, SK=chat#slack</code>. Token criptografado com KMS.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="bg-purple-100 text-purple-700 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">5</span>
              <div>
                <p className="font-bold text-gray-900">Bot ativo! Pronto para receber alertas e interagir.</p>
                <p className="text-sm text-gray-600">Bot aparece no workspace do cliente. Pode criar canais, enviar mensagens, receber comandos.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-gray-900 mb-3">Implementação: Bolt SDK + Custom InstallationStore</h4>
          <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs overflow-x-auto">
            <pre>{`// src/infra/chat/slack/slack-app.ts

import { App, Installation, InstallationQuery } from 'slack-app-sdk';

// Custom store: tokens no DynamoDB (encrypted)
class DynamoInstallationStore {
  async storeInstallation(installation: Installation): Promise<void> {
    const tenantId = await this.resolveTeamToTenant(
      installation.team?.id || installation.enterprise?.id
    );
    
    await this.db.put({
      pk: \`TENANT#\${tenantId}\`,
      sk: 'CHAT#slack',
      data: {
        // Token criptografado com KMS antes de armazenar
        botToken: await this.kms.encrypt(installation.bot?.token),
        botId: installation.bot?.id,
        teamId: installation.team?.id,
        teamName: installation.team?.name,
        enterpriseId: installation.enterprise?.id,
        isEnterpriseInstall: installation.isEnterpriseInstall,
        installedBy: installation.user.id,
        installedAt: new Date().toISOString(),
        scopes: installation.bot?.scopes,
      },
    });
  }

  async fetchInstallation(query: InstallationQuery<boolean>): Promise<Installation> {
    const tenantId = await this.resolveTeamToTenant(
      query.teamId || query.enterpriseId
    );
    
    const record = await this.db.get({
      pk: \`TENANT#\${tenantId}\`,
      sk: 'CHAT#slack',
    });
    
    return {
      bot: {
        token: await this.kms.decrypt(record.data.botToken),
        scopes: record.data.scopes,
        id: record.data.botId,
        userId: record.data.botId,
      },
      team: { id: record.data.teamId, name: record.data.teamName },
      enterprise: record.data.enterpriseId 
        ? { id: record.data.enterpriseId } : undefined,
      isEnterpriseInstall: record.data.isEnterpriseInstall,
      user: { id: record.data.installedBy, token: undefined, scopes: undefined },
      tokenType: 'bot',
      appId: process.env.SLACK_APP_ID,
      authVersion: 'v2',
    };
  }
}

// App Bolt multi-workspace
const slackApp = new App({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  stateSecret: process.env.SLACK_STATE_SECRET,
  
  scopes: [
    'channels:manage',      // criar canais de incidente
    'channels:read',        // listar canais
    'chat:write',           // enviar mensagens
    'commands',             // slash commands
    'groups:read',          // ler canais privados
    'incoming-webhook',     // webhooks
    'users:read',           // resolver nomes de usuários
  ],
  
  installationStore: new DynamoInstallationStore(),
  
  installerOptions: {
    directInstall: false,
    installPath: '/slack/install',
    redirectUriPath: '/slack/oauth_redirect',
  },
});

// Scopes mínimas — NÃO pedimos:
// ❌ channels:history (não lemos mensagens dos clientes)
// ❌ files:read (não acessamos arquivos)
// ❌ admin.* (não precisamos de admin)
// ❌ users:read.email (não precisamos de emails)`}</pre>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-bold text-red-900 mb-2">⚠️ Segurança dos Tokens Slack</h4>
          <p className="text-red-800 text-sm">
            Tokens Slack (<code>xoxb-*</code>) são <strong>long-lived</strong> e não expiram. 
            São o equivalente a access keys no mundo Slack. Por isso: criptografados com KMS no DynamoDB, 
            acesso restrito via IAM policy, e auditados via hash chain. O cliente pode revogar 
            a qualquer momento desinstalando o app do workspace.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "teams",
    title: "Teams: Plug & Play",
    icon: "🟣",
    content: () => (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900">Teams App — Single-Tenant Bot + App Store</h3>

        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
          <p className="text-red-800 font-bold">⚠️ Breaking Change: Multi-tenant Bot Depreciado</p>
          <p className="text-red-700 text-sm mt-1">
            Microsoft depreciou a criação de bots multi-tenant em <strong>Julho 2025</strong>. 
            O caminho recomendado agora é: criar bot <strong>single-tenant</strong> no nosso Entra ID → 
            publicar na <strong>Teams App Store</strong> → outros tenants instalam de lá. 
            O bot recebe o <code>tenantId</code> em cada activity payload para identificar o cliente.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-gray-900 mb-3">Como qualquer empresa "apenas pluga"</h4>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <span className="bg-indigo-100 text-indigo-700 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">1</span>
              <div>
                <p className="font-bold text-gray-900">Admin busca "SRE Platform" na Teams App Store</p>
                <p className="text-sm text-gray-600">Ou recebe link direto durante onboarding no nosso dashboard.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="bg-indigo-100 text-indigo-700 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">2</span>
              <div>
                <p className="font-bold text-gray-900">Admin consent via Entra ID</p>
                <p className="text-sm text-gray-600">Admin consente permissões do nosso app (ChannelMessage.Send, etc).</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="bg-indigo-100 text-indigo-700 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">3</span>
              <div>
                <p className="font-bold text-gray-900">Bot instalado no tenant do cliente</p>
                <p className="text-sm text-gray-600">Enterprise app criado no Entra ID do cliente. Bot pode receber mensagens.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="bg-indigo-100 text-indigo-700 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">4</span>
              <div>
                <p className="font-bold text-gray-900">Vinculação tenant: /sre connect</p>
                <p className="text-sm text-gray-600">Usuário executa comando no Teams com API key do dashboard → vincula Teams tenant ao nosso tenant.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="bg-indigo-100 text-indigo-700 font-bold rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">5</span>
              <div>
                <p className="font-bold text-gray-900">Bot ativo! Interações via Adaptive Cards.</p>
                <p className="text-sm text-gray-600">Approval gates, status updates, war rooms — tudo via Adaptive Cards no Teams.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-gray-900 mb-3">Implementação: Bot Framework + Adaptive Cards</h4>
          <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs overflow-x-auto">
            <pre>{`// src/infra/chat/teams/teams-adapter.ts

import { TeamsActivityHandler, CardFactory, TurnContext } from 'ms-bot-sdk';

class SrePlatformTeamsBot extends TeamsActivityHandler {
  
  constructor(
    private tenantStore: TenantStore,
    private chatPlatformCore: ChatPlatformCore,
  ) {
    super();
  }
  
  // Identificar tenant a partir da mensagem recebida
  private async resolveTenant(context: TurnContext): Promise<string> {
    const teamsTenantId = context.activity.conversation.tenantId;
    // Mapear Entra tenant ID → nosso tenant ID
    const tenant = await this.tenantStore.findByEntraTenantId(teamsTenantId);
    if (!tenant) throw new TenantNotLinkedError(teamsTenantId);
    return tenant.id;
  }

  // Converter nossa MessageSection → Adaptive Card
  private toAdaptiveCard(message: ChatMessage): any {
    const body = message.sections.flatMap(section => {
      switch (section.type) {
        case 'header':
          return [{ type: 'TextBlock', size: 'Large', 
                    weight: 'Bolder', text: section.text,
                    color: section.severity === 'error' ? 'Attention' : 'Default' }];
        case 'text':
          return [{ type: 'TextBlock', text: section.text, wrap: true }];
        case 'fields':
          return [{ type: 'FactSet', 
                    facts: section.fields.map(f => ({ title: f.label, value: f.value })) }];
        case 'code':
          return [{ type: 'CodeBlock', language: section.code.language,
                    codeSnippet: section.code.content }];
        case 'actions':
          return []; // Actions go in separate array
        case 'divider':
          return [{ type: 'TextBlock', text: '---', separator: true }];
        default:
          return [];
      }
    });
    
    const actions = message.sections
      .filter(s => s.type === 'actions')
      .flatMap(s => s.actions.map(a => ({
        type: 'Action.Submit',
        title: a.label,
        style: a.style === 'danger' ? 'destructive' : 'positive',
        data: { actionId: a.id, value: a.value },
      })));

    return CardFactory.adaptiveCard({
      type: 'AdaptiveCard',
      version: '1.5',
      body,
      actions,
    });
  }

  // Enviar para o canal do cliente
  async sendToChannel(tenantId: string, channelId: string, message: ChatMessage) {
    const installation = await this.tenantStore.getTeamsInstallation(tenantId);
    const card = this.toAdaptiveCard(message);
    
    await this.adapter.continueConversationAsync(
      process.env.TEAMS_APP_ID,
      installation.conversationReference,
      async (context) => {
        await context.sendActivity({ attachments: [card] });
      }
    );
  }
}

// manifest.json (Teams App Package)
const manifest = {
  "$schema": "https://developer.microsoft.com/json-schemas/teams/v1.17/MicrosoftTeams.schema.json",
  "manifestVersion": "1.17",
  "version": "1.0.0",
  "id": "SRE-PLATFORM-APP-ID",
  "name": { "short": "SRE Platform", "full": "AI SRE Platform" },
  "description": {
    "short": "AI-powered incident investigation and response",
    "full": "Autonomous AI SRE that investigates, diagnoses, and resolves incidents"
  },
  "bots": [{
    "botId": "BOT-ENTRA-APP-ID",
    "scopes": ["team", "personal", "groupChat"],
    "commandLists": [{
      "scopes": ["team"],
      "commands": [
        { "title": "status", "description": "Status de incidentes ativos" },
        { "title": "investigate", "description": "Iniciar investigação manual" },
        { "title": "connect", "description": "Vincular este Teams ao tenant" }
      ]
    }]
  }],
  "permissions": ["identity", "messageTeamMembers"],
  "validDomains": ["api.sreplatform.com.br"]
};`}</pre>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "module-structure",
    title: "Estrutura Final",
    icon: "📁",
    content: () => (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900">Modular Monolith — Estrutura Atualizada</h3>

        <div className="bg-gray-900 text-green-400 rounded-lg p-5 font-mono text-xs overflow-x-auto">
          <pre>{`src/
├── main.ts
├── shared/
│   ├── ports/                          # ← INTERFACES (nenhum import de SDK)
│   │   ├── cloud-provider.ts           #    CloudProvider, CredentialVendor
│   │   ├── chat-platform.ts            #    ChatPlatform, ApprovalGate
│   │   ├── alert-source.ts             #    AlertParser, AlertNormalizer
│   │   └── observability.ts            #    Tracer, MetricRecorder
│   ├── config/
│   ├── auth/
│   ├── events/
│   ├── types/
│   └── errors/
│
├── modules/                            # ← CORE DOMAIN (provider-agnostic)
│   ├── ingestion/
│   │   ├── parsers/
│   │   │   ├── datadog-parser.ts       #    Datadog webhook → normalized alert
│   │   │   ├── grafana-parser.ts       #    Grafana webhook → normalized alert
│   │   │   ├── azure-monitor-parser.ts #    Azure Monitor → normalized alert
│   │   │   └── prometheus-parser.ts
│   │   ├── normalizer.ts
│   │   └── dedup.ts
│   │
│   ├── triage/                         #    Usa CloudProvider port (não AWS SDK)
│   ├── investigation/                  #    Orquestra sub-agentes via ports
│   ├── remediation/                    #    ApprovalGate via ChatPlatform port
│   ├── knowledge/
│   ├── tenant/
│   └── audit/
│
├── infra/                              # ← ADAPTERS (importam SDKs específicos)
│   ├── cloud/
│   │   ├── aws/                        #    Implementa CloudProvider + CredentialVendor
│   │   │   ├── aws-cloud-provider.ts   #    CloudWatch Logs, EC2, ECS
│   │   │   ├── aws-credential-vendor.ts#    STS AssumeRole + Session Policies (ADR-008)
│   │   │   ├── aws-onboarding.ts       #    CloudFormation template generation
│   │   │   └── __tests__/
│   │   │
│   │   └── azure/                      #    Implementa CloudProvider + CredentialVendor
│   │       ├── azure-cloud-provider.ts #    Log Analytics, Azure Monitor, ARM
│   │       ├── azure-credential-vendor.ts#  Lighthouse + Managed Identities
│   │       ├── azure-onboarding.ts     #    ARM template generation
│   │       └── __tests__/
│   │
│   ├── chat/
│   │   ├── slack/                      #    Implementa ChatPlatform
│   │   │   ├── slack-adapter.ts        #    Bolt SDK, Block Kit conversion
│   │   │   ├── slack-app.ts            #    OAuth V2, Installation Store
│   │   │   ├── slack-approval-gate.ts  #    Interactive messages → approval
│   │   │   └── __tests__/
│   │   │
│   │   └── teams/                      #    Implementa ChatPlatform
│   │       ├── teams-adapter.ts        #    Bot Framework, Adaptive Cards
│   │       ├── teams-bot.ts            #    Activity handlers
│   │       ├── teams-approval-gate.ts  #    Adaptive Card actions → approval
│   │       └── __tests__/
│   │
│   ├── db/                             #    DynamoDB (ElectroDB)
│   ├── queue/                          #    SQS
│   ├── cache/                          #    Redis
│   ├── agent/                          #    Claude Agent SDK wrapper
│   └── observability/                  #    Langfuse
│
└── infra-as-code/
    ├── cdk/                            #    CDK stacks
    ├── templates/
    │   ├── aws-integration-cf.yml      #    CloudFormation para clientes AWS
    │   └── azure-integration-arm.json  #    ARM template para clientes Azure
    └── terraform/
        └── provider/                   #    Terraform provider source`}</pre>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-gray-900 mb-3">Provider Registry — Resolução Dinâmica</h4>
          <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs overflow-x-auto">
            <pre>{`// src/shared/provider-registry.ts

// Registra adapters no boot da aplicação
export class ProviderRegistry {
  private cloudProviders = new Map<CloudProviderType, CloudProvider>();
  private chatPlatforms = new Map<ChatPlatformType, ChatPlatform>();
  private credentialVendors = new Map<CloudProviderType, CredentialVendor>();

  registerCloud(provider: CloudProvider, vendor: CredentialVendor) {
    this.cloudProviders.set(provider.type, provider);
    this.credentialVendors.set(vendor.provider, vendor);
  }

  registerChat(platform: ChatPlatform) {
    this.chatPlatforms.set(platform.type, platform);
  }

  // Resolver provider para um tenant específico
  async resolveForTenant(tenantId: string): Promise<{
    cloud: CloudProvider;
    chat: ChatPlatform;
    credentials: CredentialVendor;
  }> {
    const tenant = await this.tenantStore.get(tenantId);
    
    return {
      cloud: this.cloudProviders.get(tenant.cloudProvider),
      chat: this.chatPlatforms.get(tenant.chatPlatform),
      credentials: this.credentialVendors.get(tenant.cloudProvider),
    };
  }
}

// Boot: main.ts
const registry = new ProviderRegistry();
registry.registerCloud(new AwsCloudProvider(), new AwsCredentialVendor());
registry.registerCloud(new AzureCloudProvider(), new AzureCredentialVendor());
registry.registerChat(new SlackAdapter());
registry.registerChat(new TeamsAdapter());

// Uso no core domain (investigation module):
async function investigate(incidentId: string, tenantId: string) {
  const { cloud, chat, credentials } = await registry.resolveForTenant(tenantId);
  
  // Obter credenciais para o sub-agente
  const creds = await credentials.vendCredentials(tenantId, 'log-analyzer', incidentId);
  
  // Buscar logs — MESMO CÓDIGO para AWS e Azure
  const logs = await cloud.queryLogs(creds, { service: 'api', timeRange, limit: 100 });
  
  // Notificar — MESMO CÓDIGO para Slack e Teams
  await chat.sendMessage(tenantId, incidentChannelId, {
    sections: [
      { type: 'header', text: 'Investigação Iniciada', severity: 'info' },
      { type: 'text', text: \`Analisando \${logs.length} log entries...\` },
    ],
  });
}`}</pre>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "roadmap",
    title: "Roadmap Impacto",
    icon: "📅",
    content: () => (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900">Impacto no Roadmap de 24 Semanas</h3>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-amber-800 text-sm">
            <strong>Mudança principal:</strong> Os sprints 1-2 agora incluem as interfaces (ports) e 
            o provider registry. O Sprint 3-4 implementa os parsers de Azure Monitor além de Datadog/Grafana.
            Slack e Teams ficam no Sprint 8-9 (junto com integrações).
          </p>
        </div>

        <div className="space-y-3">
          {[
            { sprint: "1-2", weeks: "1-4", title: "Foundation + Ports", delta: "+2 dias", items: [
              "✅ Definir interfaces CloudProvider, ChatPlatform, CredentialVendor",
              "✅ Implementar ProviderRegistry",
              "✅ DynamoDB entities para Integration (AWS + Azure)",
              "✅ CloudFormation template para clientes AWS",
              "✅ ARM template para clientes Azure",
              "🆕 Docker compose com LocalStack (AWS) + Azurite (Azure local)",
            ]},
            { sprint: "3-4", weeks: "5-8", title: "Ingestion + Triage", delta: "+3 dias", items: [
              "✅ Parsers: Datadog, Grafana, Prometheus",
              "🆕 Parser: Azure Monitor alerts",
              "✅ AWS Cloud Provider adapter (CloudWatch Logs, EC2, ECS)",
              "🆕 Azure Cloud Provider adapter (Log Analytics, Azure Monitor, ARM)",
              "✅ AWS Credential Vendor (STS + Session Policies)",
              "🆕 Azure Credential Vendor (Lighthouse + Managed Identities)",
            ]},
            { sprint: "5-7", weeks: "9-14", title: "Deep Search Engine", delta: "Sem impacto", items: [
              "Sub-agentes usam CloudProvider port — provider-agnostic",
              "Eval suite roda com mock adapters (não precisa de cloud real)",
              "Orchestrator resolve provider via ProviderRegistry",
            ]},
            { sprint: "8-9", weeks: "15-18", title: "Chat + Remediation", delta: "+5 dias", items: [
              "✅ Slack adapter: Bolt SDK + OAuth V2 + InstallationStore",
              "🆕 Teams adapter: Bot Framework + Adaptive Cards",
              "✅ Slack approval gate (interactive messages)",
              "🆕 Teams approval gate (Adaptive Card actions)",
              "🆕 Teams App manifest + submission prep",
              "✅ Remediation via ChatPlatform port",
            ]},
            { sprint: "10-12", weeks: "19-24", title: "Enterprise + SOC 2", delta: "+2 dias", items: [
              "🆕 Teams App Store submission + validation",
              "🆕 Azure Lighthouse onboarding wizard",
              "✅ SOC 2 evidence para ambos os providers",
              "✅ Beta com 2 design partners (1 AWS+Slack, 1 Azure+Teams)",
            ]},
          ].map((sprint, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-gray-900">
                  Sprint {sprint.sprint} (Semanas {sprint.weeks}) — {sprint.title}
                </h4>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                  sprint.delta === 'Sem impacto' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>{sprint.delta}</span>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                {sprint.items.map((item, j) => (
                  <p key={j} className={item.startsWith('🆕') ? 'text-blue-700 font-medium' : ''}>{item}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-bold text-green-900 mb-2">Impacto Total: ~12 dias adicionais</h4>
          <p className="text-green-800 text-sm">
            Distribuídos ao longo de 24 semanas. O investimento upfront nas interfaces (ports) 
            é pequeno mas o ROI é enorme: o core domain (70%+ do código) é 100% provider-agnostic.
            Adicionar GCP ou Discord no futuro = apenas implementar o adapter, zero mudança no core.
          </p>
        </div>
      </div>
    ),
  },
];

export default function ADR009MultiProviderAbstraction() {
  const [activeSection, setActiveSection] = useState("overview");
  const currentSection = sections.find((s) => s.id === activeSection);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gradient-to-r from-gray-900 to-blue-900 text-white px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <span>AI SRE Platform</span>
            <span>›</span>
            <span>Architecture Decision Records</span>
          </div>
          <h1 className="text-2xl font-bold">
            ADR-009: Multi-Cloud & Multi-Chat Provider Abstraction
          </h1>
          <p className="text-gray-300 mt-1">
            AWS + Azure | Slack + Teams — Port & Adapter desde o dia 1
          </p>
          <div className="flex gap-3 mt-3">
            <span className="px-2 py-0.5 bg-blue-600 rounded text-xs font-bold">ESTRATÉGICO</span>
            <span className="px-2 py-0.5 bg-green-600 rounded text-xs font-bold">ACEITO</span>
            <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">v1.0 — Fev 2026</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row gap-6">
          <nav className="md:w-56 flex-shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full text-left px-4 py-3 text-sm border-b border-gray-100 last:border-0 transition-colors ${
                    activeSection === section.id
                      ? "bg-gray-900 text-white font-bold"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="mr-2">{section.icon}</span>
                  {section.title}
                </button>
              ))}
            </div>
          </nav>

          <main className="flex-1 min-w-0">
            {currentSection && currentSection.content()}
          </main>
        </div>
      </div>
    </div>
  );
}
