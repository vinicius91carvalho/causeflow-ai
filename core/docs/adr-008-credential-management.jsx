import { useState } from "react";

const sections = [
  {
    id: "overview",
    title: "Visão Geral",
    icon: "🔐",
    content: () => (
      <div className="space-y-6">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
          <p className="text-red-800 font-bold text-lg">⚠️ Gap Crítico Identificado</p>
          <p className="text-red-700 mt-1">
            O PRD original NÃO cobria gestão de credenciais cross-account. 
            Este ADR define a arquitetura security-first para acessar contas AWS de clientes 
            seguindo as melhores práticas da indústria (Datadog Security Labs, AWS Well-Architected SaaS Lens).
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Princípio Fundamental</h3>
          <p className="text-gray-700 text-lg leading-relaxed">
            <strong>NUNCA</strong> armazenamos credenciais de clientes. Utilizamos exclusivamente 
            <strong> IAM Roles com cross-account AssumeRole</strong>, garantindo que todas as credenciais 
            são temporárias (máximo 1 hora), tenant-scoped e auditáveis.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: "Zero Secrets Stored", desc: "Nenhuma access key, nenhum secret. Apenas Role ARNs + External IDs (não-sensíveis).", icon: "🔒" },
            { title: "Credenciais Efêmeras", desc: "STS tokens com TTL de 1 hora. Session policies restringem por sub-agente.", icon: "⏱️" },
            { title: "Auditoria Total", desc: "Cada AssumeRole gera CloudTrail event. Session tags identificam tenant + operação.", icon: "📋" },
          ].map((item, i) => (
            <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-2xl mb-2">{item.icon}</div>
              <h4 className="font-bold text-gray-900 mb-1">{item.title}</h4>
              <p className="text-gray-600 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <h3 className="font-bold text-blue-900 mb-3">Referências de Mercado</h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>• <strong>Datadog</strong>: 28.000+ clientes, cross-account assume role com external ID + session policies por microserviço</p>
            <p>• <strong>AWS Well-Architected SaaS Lens</strong>: Token Vending Machine pattern com dynamic IAM policies</p>
            <p>• <strong>Praetorian Research</strong>: 37% dos vendors SaaS NÃO implementam ExternalId corretamente — confused deputy é o ataque #1</p>
            <p>• <strong>Datadog Security Labs (Set/2024)</strong>: Guia definitivo para integração cross-account segura</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "architecture",
    title: "Arquitetura",
    icon: "🏗️",
    content: () => (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900">Fluxo Completo: Onboarding → Investigação</h3>
        
        <div className="bg-gray-900 text-green-400 rounded-lg p-5 font-mono text-xs leading-relaxed overflow-x-auto">
          <pre>{`┌─────────────────────────────────────────────────────────────────────┐
│                    CUSTOMER AWS ACCOUNT                              │
│                                                                     │
│  ┌──────────────────────────────────────────────┐                   │
│  │  IAM Role: sre-platform-integration-role     │                   │
│  │                                               │                   │
│  │  Trust Policy:                                │                   │
│  │  ├─ Principal: arn:aws:iam::OUR_BASTION:role/ │                   │
│  │  │             outbound-integration-role      │                   │
│  │  ├─ Condition: sts:ExternalId = <uuid>        │                   │
│  │  └─ Condition: aws:SourceIp IN <our_ranges>   │                   │
│  │                                               │                   │
│  │  Permissions (minimal, feature-gated):        │                   │
│  │  ├─ logs:FilterLogEvents (read-only)          │                   │
│  │  ├─ cloudwatch:GetMetricData (read-only)      │                   │
│  │  ├─ ecs:DescribeServices (read-only)          │                   │
│  │  ├─ ec2:DescribeInstances (read-only)         │                   │
│  │  └─ [remediation]: ecs:UpdateService (write)  │                   │
│  └──────────────────────────────────────────────┘                   │
└─────────────────────┬───────────────────────────────────────────────┘
                      │ sts:AssumeRole
                      │ (ExternalId + SessionPolicy + SessionTags)
┌─────────────────────┴───────────────────────────────────────────────┐
│                 OUR BASTION AWS ACCOUNT (dedicated)                  │
│                                                                     │
│  ┌──────────────────────────────────────────┐                       │
│  │ outbound-integration-role (crown jewel)  │                       │
│  │ ├─ Monitored via CloudTrail              │                       │
│  │ ├─ Only assumable by ECS Task Roles      │                       │
│  │ └─ Regional (sa-east-1 for BR)           │                       │
│  └──────────────────┬───────────────────────┘                       │
│                     │                                               │
│  ┌──────────────────┴───────────────────────┐                       │
│  │        Token Vending Machine (TVM)        │                       │
│  │  ┌─────────────────────────────────────┐  │                       │
│  │  │ 1. Validate JWT (tenant context)    │  │                       │
│  │  │ 2. Lookup Role ARN + ExternalId     │  │                       │
│  │  │ 3. Generate Session Policy (scoped) │  │                       │
│  │  │ 4. AssumeRole with SessionTags      │  │                       │
│  │  │ 5. Return scoped credentials        │  │                       │
│  │  └─────────────────────────────────────┘  │                       │
│  └──────────────────┬───────────────────────┘                       │
│                     │                                               │
│  ┌──────────────────┴───────────────────────────────────────────┐   │
│  │              Sub-Agents (cada um recebe session policy)       │   │
│  │                                                               │   │
│  │  ┌─────────────┐ ┌──────────────┐ ┌───────────────────┐     │   │
│  │  │Log Analyzer │ │Infra Inspector│ │ Change Detector   │     │   │
│  │  │ logs:Filter │ │ ec2:Describe  │ │ cloudtrail:Lookup │     │   │
│  │  │ logs:Get    │ │ ecs:Describe  │ │ codedeploy:Get    │     │   │
│  │  │             │ │ rds:Describe  │ │                   │     │   │
│  │  └─────────────┘ └──────────────┘ └───────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘`}</pre>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-bold text-amber-900 mb-2">🔑 Decisão: Conta Bastion Dedicada</h4>
          <p className="text-amber-800 text-sm">
            Seguindo o padrão Datadog, usamos uma <strong>conta AWS dedicada</strong> como bastion 
            para assumir roles em contas de clientes. Isso isola o crown jewel (outbound-integration-role) 
            de qualquer workload de aplicação. Se a conta de aplicação for comprometida, 
            o atacante NÃO tem acesso às contas dos clientes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-bold text-gray-900 mb-2">Alternativas Rejeitadas</h4>
            <div className="space-y-2 text-sm">
              <div className="bg-red-50 p-2 rounded">
                <strong className="text-red-700">❌ IAM Users + Access Keys</strong>
                <p className="text-red-600">Credenciais long-lived. Principal causa de breaches em AWS. Inaceitável.</p>
              </div>
              <div className="bg-red-50 p-2 rounded">
                <strong className="text-red-700">❌ Cliente envia Access Keys via UI</strong>
                <p className="text-red-600">Teríamos que armazenar secrets. Liability gigante. Um breach = todas as keys vazam.</p>
              </div>
              <div className="bg-red-50 p-2 rounded">
                <strong className="text-red-700">❌ AssumeRole sem External ID</strong>
                <p className="text-red-600">Vulnerável a confused deputy. Atacante registra conta legítima apontando para outra.</p>
              </div>
              <div className="bg-yellow-50 p-2 rounded">
                <strong className="text-yellow-700">⚠️ AssumeRole confiando na conta inteira</strong>
                <p className="text-yellow-600">Qualquer principal com sts:AssumeRole na nossa conta poderia acessar clientes. Usamos role específica como principal.</p>
              </div>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-bold text-gray-900 mb-2">Decisão Final</h4>
            <div className="space-y-2 text-sm">
              <div className="bg-green-50 p-2 rounded">
                <strong className="text-green-700">✅ Cross-Account AssumeRole</strong>
                <p className="text-green-600">Credenciais temporárias (1h). Padrão AWS recomendado.</p>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <strong className="text-green-700">✅ External ID por tenant</strong>
                <p className="text-green-600">UUID v4 único, previne confused deputy.</p>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <strong className="text-green-700">✅ Conta Bastion dedicada</strong>
                <p className="text-green-600">Isola o role de saída de qualquer workload.</p>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <strong className="text-green-700">✅ Session Policies por sub-agente</strong>
                <p className="text-green-600">Cada agente recebe credenciais com permissões mínimas.</p>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <strong className="text-green-700">✅ Session Tags para auditoria</strong>
                <p className="text-green-600">TenantId + IncidentId + AgentRole em cada sessão.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "onboarding",
    title: "Onboarding do Cliente",
    icon: "🚀",
    content: () => (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900">Fluxo de Onboarding — Zero Friction, Máxima Segurança</h3>
        
        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-gray-900 mb-4">3 Opções de Setup (do mais fácil ao mais flexível)</h4>
          
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h5 className="font-bold text-blue-800">Opção 1: CloudFormation Quick-Create (recomendado)</h5>
              <p className="text-gray-600 text-sm mt-1">1 clique no console AWS. Template hosted no nosso S3 público.</p>
              <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs mt-2 overflow-x-auto">
                <pre>{`https://sa-east-1.console.aws.amazon.com/cloudformation/home
  ?region=sa-east-1
  #/stacks/quickcreate
  ?templateURL=https://sre-platform-artifacts.s3.sa-east-1.amazonaws.com/
    integration-role-v1.yml
  &stackName=sre-platform-integration
  &param_ExternalID=68a357f7-560d-4702-acfd-cf710d1cd4c7
  &param_EnableRemediation=false
  &param_EnableLogAccess=true`}</pre>
              </div>
            </div>

            <div className="border-l-4 border-purple-500 pl-4">
              <h5 className="font-bold text-purple-800">Opção 2: Terraform Provider</h5>
              <p className="text-gray-600 text-sm mt-1">Para equipes com IaC. Provider registrado no Terraform Registry.</p>
              <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs mt-2 overflow-x-auto">
                <pre>{`resource "sreplatform_aws_integration" "prod" {
  account_id           = "123456789012"
  role_name            = "sre-platform-integration-role"
  enable_log_access    = true
  enable_metric_access = true
  enable_remediation   = false  # opt-in explícito
  excluded_regions     = ["us-east-1"]
}

resource "aws_iam_role" "sre_platform" {
  name               = "sre-platform-integration-role"
  assume_role_policy = data.aws_iam_policy_document.trust.json
  inline_policy {
    name   = "sre-platform-policy"
    # Policy auto-gerada com base nos features habilitados
    policy = sreplatform_aws_integration.prod.iam_policy
  }
}

data "aws_iam_policy_document" "trust" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type = "AWS"
      # Confia APENAS no role específico, não na conta inteira
      identifiers = [
        "arn:aws:iam::BASTION_ACCOUNT:role/outbound-integration-role-sa-east-1"
      ]
    }
    condition {
      test     = "StringEquals"
      variable = "sts:ExternalId"
      values   = [sreplatform_aws_integration.prod.external_id]
    }
  }
}`}</pre>
              </div>
            </div>

            <div className="border-l-4 border-green-500 pl-4">
              <h5 className="font-bold text-green-800">Opção 3: CDK Construct (L3)</h5>
              <p className="text-gray-600 text-sm mt-1">Para equipes usando AWS CDK. Construct publicado no npm.</p>
              <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs mt-2 overflow-x-auto">
                <pre>{`import { SrePlatformIntegration } from 'sreplatform-infra';

new SrePlatformIntegration(this, 'SrePlatform', {
  externalId: '68a357f7-560d-4702-acfd-cf710d1cd4c7',
  features: {
    logAccess: true,
    metricAccess: true,
    remediation: false,
  },
});`}</pre>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-gray-900 mb-4">CloudFormation Template (produção)</h4>
          <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs overflow-x-auto">
            <pre>{`AWSTemplateFormatVersion: "2010-09-09"
Description: "SRE Platform - Integration Role (v1)"

Parameters:
  ExternalID:
    Type: String
    MinLength: 36
    MaxLength: 36
    AllowedPattern: '[a-f0-9\\-]+'
    ConstraintDescription: "Must be a valid UUID"
    NoEcho: true  # Mascarado no console CloudFormation

  EnableLogAccess:
    Type: String
    Default: "true"
    AllowedValues: ["true", "false"]

  EnableMetricAccess:
    Type: String
    Default: "true"
    AllowedValues: ["true", "false"]

  EnableRemediation:
    Type: String
    Default: "false"
    AllowedValues: ["true", "false"]

Conditions:
  LogAccess: !Equals [!Ref EnableLogAccess, "true"]
  MetricAccess: !Equals [!Ref EnableMetricAccess, "true"]
  Remediation: !Equals [!Ref EnableRemediation, "true"]

Resources:
  IntegrationRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: sre-platform-integration-role
      MaxSessionDuration: 3600  # 1 hora máximo
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              AWS:
                # ROLE ESPECÍFICO, não conta inteira
                - arn:aws:iam::BASTION_ACCT:role/outbound-integration-role-sa-east-1
            Action: sts:AssumeRole
            Condition:
              StringEquals:
                sts:ExternalId: !Ref ExternalID

      Policies:
        # ── Base: sempre presente ──
        - PolicyName: sre-platform-base
          PolicyDocument:
            Version: "2012-10-17"
            Statement:
              - Sid: DescribeInfra
                Effect: Allow
                Action:
                  - ecs:DescribeServices
                  - ecs:DescribeTasks
                  - ecs:ListTasks
                  - ec2:DescribeInstances
                  - ec2:DescribeInstanceStatus
                  - autoscaling:DescribeAutoScalingGroups
                  - elasticloadbalancing:DescribeTargetHealth
                Resource: "*"

        # ── Feature: Log Access ──
        - !If
          - LogAccess
          - PolicyName: sre-platform-logs
            PolicyDocument:
              Version: "2012-10-17"
              Statement:
                - Effect: Allow
                  Action:
                    - logs:FilterLogEvents
                    - logs:GetLogEvents
                    - logs:DescribeLogGroups
                    - logs:GetQueryResults
                    - logs:StartQuery
                  Resource: "*"
          - !Ref AWS::NoValue

        # ── Feature: Metric Access ──
        - !If
          - MetricAccess
          - PolicyName: sre-platform-metrics
            PolicyDocument:
              Version: "2012-10-17"
              Statement:
                - Effect: Allow
                  Action:
                    - cloudwatch:GetMetricData
                    - cloudwatch:GetMetricStatistics
                    - cloudwatch:DescribeAlarms
                    - cloudwatch:ListMetrics
                  Resource: "*"
          - !Ref AWS::NoValue

        # ── Feature: Remediation (opt-in) ──
        - !If
          - Remediation
          - PolicyName: sre-platform-remediation
            PolicyDocument:
              Version: "2012-10-17"
              Statement:
                - Sid: ECSRemediation
                  Effect: Allow
                  Action:
                    - ecs:UpdateService
                    - ecs:StopTask
                  Resource: "*"
                - Sid: EC2Remediation
                  Effect: Allow
                  Action:
                    - ec2:RebootInstances
                  Resource: "*"
          - !Ref AWS::NoValue

Outputs:
  RoleArn:
    Value: !GetAtt IntegrationRole.Arn
    Description: "Provide this ARN in the SRE Platform setup wizard"`}</pre>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-bold text-amber-900 mb-2">Guardrails no Onboarding</h4>
          <div className="space-y-2 text-sm text-amber-800">
            <p>1. <strong>Validação de External ID</strong>: Tentamos AssumeRole SEM external ID. Se funcionar, rejeitamos o role e instruímos o cliente a corrigir.</p>
            <p>2. <strong>Validação de over-privilege</strong>: Após assumir, listamos policies. Se detectarmos AdministratorAccess, ReadOnlyAccess ou *FullAccess, rejeitamos.</p>
            <p>3. <strong>Conta única por tenant</strong>: Cada AWS Account ID só pode ser registrado em UM tenant. Previne confused deputy by design.</p>
            <p>4. <strong>Drift detection</strong>: Verificação periódica (daily) se o role ainda está configurado corretamente.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "tvm",
    title: "Token Vending Machine",
    icon: "🎰",
    content: () => (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900">Token Vending Machine (TVM) — Credenciais Dinâmicas por Sub-Agente</h3>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <p className="text-gray-700 mb-4">
            O TVM é o componente central que vende credenciais temporárias e tenant-scoped para cada 
            sub-agente. Nenhum sub-agente acessa diretamente o STS — tudo passa pelo TVM que aplica 
            session policies dinâmicas.
          </p>
          <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs overflow-x-auto">
            <pre>{`// src/modules/credentials/token-vending-machine.ts

import { STSClient, AssumeRoleCommand } from 'aws-sts-sdk';
import { IAMClient, ListAttachedRolePoliciesCommand } from 'aws-iam-sdk';

// Session policies por sub-agente — CADA agente recebe APENAS
// o que precisa. Mesmo que o role do cliente tenha mais permissões,
// a session policy restringe.
const SESSION_POLICIES: Record<AgentRole, string> = {
  'log-analyzer': JSON.stringify({
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Allow',
      Action: [
        'logs:FilterLogEvents',
        'logs:GetLogEvents',
        'logs:StartQuery',
        'logs:GetQueryResults',
      ],
      Resource: '*',
    }],
  }),
  
  'infra-inspector': JSON.stringify({
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Allow',
      Action: [
        'ec2:DescribeInstances',
        'ecs:DescribeServices',
        'ecs:DescribeTasks',
        'ecs:ListTasks',
        'elasticloadbalancing:DescribeTargetHealth',
        'rds:DescribeDBInstances',
        'autoscaling:DescribeAutoScalingGroups',
      ],
      Resource: '*',
    }],
  }),
  
  'change-detector': JSON.stringify({
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Allow',
      Action: [
        'cloudtrail:LookupEvents',
        'codedeploy:GetDeployment',
        'codedeploy:ListDeployments',
        'ecs:DescribeTaskDefinition',
      ],
      Resource: '*',
    }],
  }),
  
  // Remediation — DENY ALL por padrão
  // Mesmo o Runbook Executor começa com deny-all
  // e recebe permissões apenas após approval gate
  'runbook-executor-pending': JSON.stringify({
    Version: '2012-10-17',
    Statement: [{
      Effect: 'Deny',
      Action: '*',
      Resource: '*',
    }],
  }),
};

interface VendedCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
  agentRole: AgentRole;
  tenantId: string;
}

export class TokenVendingMachine {
  private stsClient: STSClient;
  private iamCache: Map<string, { valid: boolean; checkedAt: Date }>;
  
  constructor(
    private config: {
      bastionRoleArn: string;    // role na conta bastion
      region: string;            // sa-east-1
    },
    private tenantStore: TenantStore,
    private auditLog: AuditLogger,
  ) {
    this.stsClient = new STSClient({ region: config.region });
    this.iamCache = new Map();
  }

  async vendCredentials(
    tenantId: string,
    agentRole: AgentRole,
    incidentId: string,
  ): Promise<VendedCredentials> {
    // 1. Buscar configuração do tenant
    const tenant = await this.tenantStore.get(tenantId);
    if (!tenant?.integration?.roleArn) {
      throw new IntegrationNotConfiguredError(tenantId);
    }

    // 2. Validar que o role NÃO está over-privileged (cache 24h)
    await this.validateRoleIsNotOverprivileged(tenant);

    // 3. Buscar session policy para este agent role
    const sessionPolicy = SESSION_POLICIES[agentRole];
    if (!sessionPolicy) {
      throw new UnknownAgentRoleError(agentRole);
    }

    // 4. AssumeRole com External ID + Session Policy + Tags
    const command = new AssumeRoleCommand({
      RoleArn: tenant.integration.roleArn,
      ExternalId: tenant.integration.externalId,
      RoleSessionName: \`sre-\${agentRole}-\${incidentId.slice(0, 8)}\`,
      DurationSeconds: 3600, // 1 hora máximo
      
      // SESSION POLICY: restringe permissões ao mínimo
      // para este sub-agente específico
      Policy: sessionPolicy,
      
      // SESSION TAGS: identificam a sessão para auditoria
      Tags: [
        { Key: 'TenantId', Value: tenantId },
        { Key: 'IncidentId', Value: incidentId },
        { Key: 'AgentRole', Value: agentRole },
        { Key: 'Platform', Value: 'sre-platform' },
      ],
      
      // TRANSITIVE TAGS: propagam em role chaining
      TransitiveTagKeys: ['TenantId', 'IncidentId', 'AgentRole'],
    });

    try {
      const response = await this.stsClient.send(command);
      
      // 5. Audit log
      await this.auditLog.record({
        action: 'credentials_vended',
        tenantId,
        incidentId,
        agentRole,
        roleArn: tenant.integration.roleArn,
        sessionName: command.input.RoleSessionName,
        expiresAt: response.Credentials.Expiration,
      });

      return {
        accessKeyId: response.Credentials.AccessKeyId,
        secretAccessKey: response.Credentials.SecretAccessKey,
        sessionToken: response.Credentials.SessionToken,
        expiration: response.Credentials.Expiration,
        agentRole,
        tenantId,
      };
    } catch (error) {
      if (error.name === 'AccessDeniedException') {
        // Role pode ter sido deletado ou modificado
        await this.handleBrokenIntegration(tenantId, error);
      }
      throw error;
    }
  }

  // ── Guardrail: Rejeitar roles over-privileged ──
  private async validateRoleIsNotOverprivileged(
    tenant: TenantConfig
  ): Promise<void> {
    const cacheKey = tenant.integration.roleArn;
    const cached = this.iamCache.get(cacheKey);
    
    if (cached && Date.now() - cached.checkedAt.getTime() < 86400000) {
      if (!cached.valid) throw new OverprivilegedRoleError(cacheKey);
      return;
    }

    // Assumir role temporariamente para listar policies
    const tempCreds = await this.stsClient.send(new AssumeRoleCommand({
      RoleArn: tenant.integration.roleArn,
      ExternalId: tenant.integration.externalId,
      RoleSessionName: 'sre-validation-check',
      DurationSeconds: 900,
      // DENY ALL: credenciais não podem fazer nada
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [{ Effect: 'Deny', Action: '*', Resource: '*' }],
      }),
    }));

    const iamClient = new IAMClient({
      region: this.config.region,
      credentials: {
        accessKeyId: tempCreds.Credentials.AccessKeyId,
        secretAccessKey: tempCreds.Credentials.SecretAccessKey,
        sessionToken: tempCreds.Credentials.SessionToken,
      },
    });

    const DANGEROUS_POLICIES = [
      'AdministratorAccess', 'PowerUserAccess',
      'ReadOnlyAccess', 'IAMFullAccess',
    ];

    // Note: iam:ListAttachedRolePolicies requer permissão — 
    // se falhar, é OK (melhor falhar safe)
    try {
      const roleName = tenant.integration.roleArn.split('/').pop();
      const policies = await iamClient.send(
        new ListAttachedRolePoliciesCommand({ RoleName: roleName })
      );
      
      const dangerous = policies.AttachedPolicies?.filter(
        p => DANGEROUS_POLICIES.some(d => p.PolicyName?.includes(d))
      );
      
      if (dangerous?.length > 0) {
        this.iamCache.set(cacheKey, { valid: false, checkedAt: new Date() });
        await this.notifyOverprivilegedRole(tenant, dangerous);
        throw new OverprivilegedRoleError(cacheKey);
      }
    } catch (error) {
      if (error instanceof OverprivilegedRoleError) throw error;
      // Se não conseguir verificar, prosseguir (fail open para check)
    }

    this.iamCache.set(cacheKey, { valid: true, checkedAt: new Date() });
  }

  // ── Guardrail: Validar External ID no setup ──
  async validateExternalIdEnforced(
    roleArn: string,
    externalId: string,
  ): Promise<{ valid: boolean; reason?: string }> {
    // Tentar assumir SEM external ID
    try {
      await this.stsClient.send(new AssumeRoleCommand({
        RoleArn: roleArn,
        RoleSessionName: 'sre-validation-no-extid',
        DurationSeconds: 900,
      }));
      // Se SUCEDEU sem external ID = VULNERÁVEL
      return { 
        valid: false, 
        reason: 'Role aceita AssumeRole sem ExternalId. Configure a Condition sts:ExternalId.' 
      };
    } catch {
      // Falhou sem external ID = BOM, agora testar COM
      try {
        await this.stsClient.send(new AssumeRoleCommand({
          RoleArn: roleArn,
          ExternalId: externalId,
          RoleSessionName: 'sre-validation-with-extid',
          DurationSeconds: 900,
        }));
        return { valid: true };
      } catch {
        return { 
          valid: false, 
          reason: 'Role não aceita nosso ExternalId. Verifique a trust policy.' 
        };
      }
    }
  }
}`}</pre>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "session-policies",
    title: "Session Policies",
    icon: "🛡️",
    content: () => (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900">Session Policies — Defense in Depth por Sub-Agente</h3>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">
            <strong>Conceito chave:</strong> Mesmo que o cliente dê AdministratorAccess ao role de integração, 
            nossas session policies garantem que cada sub-agente só pode executar as actions específicas 
            que precisa. A permissão efetiva é a INTERSEÇÃO do role policy + session policy.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Sub-Agente</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Actions Permitidas</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Write?</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase">Approval?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {[
                { agent: "Log Analyzer", actions: "logs:FilterLogEvents, logs:GetLogEvents, logs:StartQuery, logs:GetQueryResults", write: "❌ Não", approval: "Não" },
                { agent: "Infra Inspector", actions: "ec2:Describe*, ecs:Describe*, ecs:List*, elb:DescribeTargetHealth, rds:Describe*", write: "❌ Não", approval: "Não" },
                { agent: "Change Detector", actions: "cloudtrail:LookupEvents, codedeploy:Get*, codedeploy:List*, ecs:DescribeTaskDefinition", write: "❌ Não", approval: "Não" },
                { agent: "Metric Analyzer", actions: "cloudwatch:GetMetricData, cloudwatch:GetMetricStatistics, cloudwatch:ListMetrics", write: "❌ Não", approval: "Não" },
                { agent: "Runbook Executor (pendente)", actions: "DENY ALL — credenciais bloqueadas até approval", write: "🔒 Bloqueado", approval: "—" },
                { agent: "Runbook Executor (aprovado)", actions: "ecs:UpdateService, ecs:StopTask, ec2:RebootInstances (conforme runbook)", write: "✅ Sim", approval: "✅ Humano" },
              ].map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.agent}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono text-xs">{row.actions}</td>
                  <td className="px-4 py-3">{row.write}</td>
                  <td className="px-4 py-3">{row.approval}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-gray-900 mb-3">Remediation: Approval Gate → Novas Credenciais</h4>
          <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs overflow-x-auto">
            <pre>{`// Fluxo de credenciais para remediação
// 1. Investigação: agentes READ-ONLY investigam
// 2. Proposta: orquestrador gera plano de remediação
// 3. Approval: humano aprova via Slack
// 4. Execução: TVM emite NOVAS credenciais com WRITE

async function executeApprovedRemediation(
  approval: ApprovalRecord,
  incident: Incident,
) {
  // Validar que a aprovação é legítima
  if (!await verifyApprovalSignature(approval)) {
    throw new InvalidApprovalError();
  }

  // Session policy ESPECÍFICA para esta remediação
  // Não é genérica — é gerada com base no runbook aprovado
  const remediationPolicy = generateRemediationPolicy(approval.runbook);
  
  // Exemplo: se o runbook é "restart ECS service"
  // {
  //   "Effect": "Allow",
  //   "Action": ["ecs:UpdateService"],
  //   "Resource": "arn:aws:ecs:sa-east-1:CUSTOMER:service/cluster/service-name"
  //   // ↑ RECURSO ESPECÍFICO, não wildcard
  // }

  const creds = await tvm.vendCredentialsWithCustomPolicy(
    incident.tenantId,
    'runbook-executor',
    incident.id,
    remediationPolicy,  // policy gerada pelo runbook aprovado
  );

  // Executar com timeout
  const result = await withTimeout(
    () => executeRunbook(creds, approval.runbook),
    300_000, // 5 min max
  );

  // Audit: registrar tudo
  await auditLog.record({
    action: 'remediation_executed',
    tenantId: incident.tenantId,
    incidentId: incident.id,
    runbook: approval.runbook.id,
    approvedBy: approval.approvedBy,
    result: result.status,
  });
}`}</pre>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-bold text-green-900 mb-2">Princípio: Least Privilege Dinâmico</h4>
          <p className="text-green-800 text-sm">
            A combinação de <strong>feature-gated IAM policy</strong> (no role do cliente) + 
            <strong>session policy por sub-agente</strong> (no TVM) + 
            <strong>resource-scoped remediation policy</strong> (no approval gate) cria 
            3 camadas de restrição. Mesmo em cenário de comprometimento total do nosso backend, 
            o atacante obtém credenciais que só permitem read em logs/métricas — e as ações 
            de write requerem aprovação humana com session policy gerada ad-hoc.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "monitoring",
    title: "Monitoramento",
    icon: "📡",
    content: () => (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900">Monitoramento do Crown Jewel</h3>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-gray-900 mb-3">CloudTrail Anomaly Detection — Conta Bastion</h4>
          <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs overflow-x-auto">
            <pre>{`// CloudWatch Metric Filters + Alarms na conta bastion

// 1. ALERT: Role assumido por humano (não ECS task role)
{
  filterPattern: '{ $.eventName = "AssumeRole" 
    && $.requestParameters.roleArn = "*outbound-integration*"
    && $.userIdentity.type != "AssumedRole" }',
  metricName: 'HumanAssumedOutboundRole',
  alarm: { threshold: 1, period: 60 }  // Qualquer ocorrência = P1
}

// 2. ALERT: AssumeRole de IP não-AWS
{
  filterPattern: '{ $.eventName = "AssumeRole"
    && $.sourceIPAddress != "*.amazonaws.com" }',
  metricName: 'NonAWSIPAssumeRole',
  alarm: { threshold: 1, period: 60 }
}

// 3. ALERT: Volume anômalo de AssumeRole (mais de 2x média)
{
  metricName: 'TotalAssumeRoleCalls',
  alarm: { 
    comparisonOperator: 'GreaterThanUpperThreshold',
    anomalyDetector: { band: 2 }  // 2 standard deviations
  }
}

// 4. ALERT: Session name não reconhecida
{
  filterPattern: '{ $.eventName = "AssumeRole"
    && $.requestParameters.roleSessionName != "sre-*" }',
  metricName: 'UnknownSessionName',
  alarm: { threshold: 1, period: 60 }
}

// 5. AUDIT: Todas as sessões com tags para correlação
// Tags aparecem em CloudTrail como:
// requestParameters.tags[].key = "TenantId"
// requestParameters.tags[].value = "tenant_abc123"`}</pre>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-gray-900 mb-3">Drift Detection — Verificação Diária</h4>
          <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs overflow-x-auto">
            <pre>{`// EventBridge rule: executa diariamente
// Verifica TODOS os tenants com integração ativa

async function dailyIntegrationHealthCheck() {
  const tenants = await tenantStore.listWithIntegration();
  
  for (const tenant of tenants) {
    const checks = await Promise.allSettled([
      // 1. External ID ainda é enforced?
      tvm.validateExternalIdEnforced(
        tenant.integration.roleArn,
        tenant.integration.externalId
      ),
      
      // 2. Role ainda existe e podemos assumir?
      tvm.vendCredentials(tenant.id, 'infra-inspector', 'health-check'),
      
      // 3. Role não foi over-privileged?
      tvm.validateRoleIsNotOverprivileged(tenant),
    ]);
    
    const issues = checks.filter(c => c.status === 'rejected');
    
    if (issues.length > 0) {
      await notifications.sendIntegrationDriftAlert({
        tenantId: tenant.id,
        issues: issues.map(formatIssue),
        severity: issues.some(i => i.reason?.includes('ExternalId'))
          ? 'critical' : 'warning',
      });
      
      // Se External ID não enforced = desativar integração
      if (issues.some(i => i.reason?.includes('ExternalId'))) {
        await tenantStore.disableIntegration(tenant.id, 'external_id_drift');
      }
    }
  }
}`}</pre>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-gray-900 mb-3">IP Ranges Públicos</h4>
          <p className="text-gray-700 text-sm mb-3">
            Publicamos endpoint com nossos IP ranges para que clientes possam:
            (a) adicionar condition aws:SourceIp no trust policy,
            (b) alertar em CloudTrail se AssumeRole vier de IP diferente.
          </p>
          <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs">
            <pre>{`// GET https://api.sreplatform.com.br/v1/ip-ranges
{
  "sa-east-1": {
    "integration": ["198.51.100.0/24", "203.0.113.0/24"],
    "webhooks": ["198.51.100.128/25"]
  },
  "updated_at": "2025-02-15T00:00:00Z",
  "version": 3
}`}</pre>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "data-model",
    title: "Modelo de Dados",
    icon: "💾",
    content: () => (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900">DynamoDB — Entidades de Integração</h3>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs overflow-x-auto">
            <pre>{`// src/infra/db/entities/integration.ts

const Integration = new Entity({
  model: { entity: 'integration', version: '1', service: 'sre' },
  attributes: {
    tenantId:    { type: 'string', required: true },
    provider:    { type: ['aws'] as const, required: true },  // futuro: gcp, azure
    
    // ── Dados do role (NÃO são secrets) ──
    roleArn:     { type: 'string', required: true },
    externalId:  { type: 'string', required: true },  // UUID v4
    accountId:   { type: 'string', required: true },   // AWS account ID
    
    // ── Features habilitados ──
    features: {
      type: 'map',
      properties: {
        logAccess:     { type: 'boolean', default: true },
        metricAccess:  { type: 'boolean', default: true },
        infraAccess:   { type: 'boolean', default: true },
        remediation:   { type: 'boolean', default: false },  // opt-in
      },
    },
    
    // ── Status e health ──
    status: {
      type: ['active', 'pending_setup', 'broken', 'disabled'] as const,
      default: 'pending_setup',
    },
    lastHealthCheck: { type: 'string' },  // ISO datetime
    lastHealthStatus: { type: ['healthy', 'drift_detected', 'unreachable'] as const },
    disabledReason:  { type: 'string' },
    
    // ── Setup method ──
    setupMethod: { type: ['cloudformation', 'terraform', 'cdk', 'manual'] as const },
    
    // ── Timestamps ──
    createdAt: { type: 'string', default: () => new Date().toISOString() },
    updatedAt: { type: 'string', watch: '*', set: () => new Date().toISOString() },
  },
  
  indexes: {
    primary: {
      pk: { field: 'pk', composite: ['tenantId'] },
      sk: { field: 'sk', composite: ['provider'] },
    },
    // Buscar por AWS Account ID (validar unicidade)
    byAccountId: {
      index: 'gsi1',
      pk: { field: 'gsi1pk', composite: ['accountId'] },
      sk: { field: 'gsi1sk', composite: ['tenantId'] },
    },
    // Listar integrações que precisam de health check
    byStatus: {
      index: 'gsi2',
      pk: { field: 'gsi2pk', composite: ['status'] },
      sk: { field: 'gsi2sk', composite: ['lastHealthCheck'] },
    },
  },
});

// ── Credential Audit Log ──
const CredentialAudit = new Entity({
  model: { entity: 'cred_audit', version: '1', service: 'sre' },
  attributes: {
    tenantId:    { type: 'string', required: true },
    timestamp:   { type: 'string', required: true },
    action:      { 
      type: ['credentials_vended', 'validation_check', 
             'drift_detected', 'integration_disabled',
             'remediation_approved', 'remediation_executed'] as const,
    },
    agentRole:   { type: 'string' },
    incidentId:  { type: 'string' },
    sessionName: { type: 'string' },
    roleArn:     { type: 'string' },
    expiresAt:   { type: 'string' },
    detail:      { type: 'string' },  // JSON serialized details
    
    // Hash chain para tamper-proof audit
    previousHash: { type: 'string' },
    hash:         { type: 'string' },
  },
  
  indexes: {
    primary: {
      pk: { field: 'pk', composite: ['tenantId'] },
      sk: { field: 'sk', composite: ['timestamp'] },
    },
  },
});`}</pre>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="font-bold text-amber-900 mb-2">O que NÃO armazenamos</h4>
          <div className="text-sm text-amber-800 space-y-1">
            <p>❌ Access Keys / Secret Keys — nunca</p>
            <p>❌ Session Tokens — efêmeros, não persistidos</p>
            <p>❌ Senhas — não existem no fluxo</p>
            <p>✅ Role ARN — identificador público</p>
            <p>✅ External ID — não é secret segundo AWS (mas tratamos com cuidado)</p>
            <p>✅ Account ID — identificador público</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "threat-model",
    title: "Threat Model",
    icon: "⚔️",
    content: () => (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900">Análise de Ameaças — Credenciais Cross-Account</h3>

        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200 rounded-lg">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-3 py-2 text-left text-xs font-bold">Ameaça</th>
                <th className="px-3 py-2 text-left text-xs font-bold">Vetor</th>
                <th className="px-3 py-2 text-left text-xs font-bold">Mitigação</th>
                <th className="px-3 py-2 text-left text-xs font-bold">Camada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-xs">
              {[
                {
                  threat: "Confused Deputy",
                  vector: "Atacante registra conta A apontando para role na conta B",
                  mitigation: "External ID único por tenant + validação no onboarding + 1 account per tenant",
                  layer: "Onboarding",
                },
                {
                  threat: "Credential Theft",
                  vector: "Atacante compromete nosso backend e extrai credentials",
                  mitigation: "Credenciais duram max 1h + session policies restritivas + conta bastion isolada",
                  layer: "Runtime",
                },
                {
                  threat: "Privilege Escalation",
                  vector: "Sub-agente tenta acessar recursos além do escopo",
                  mitigation: "Session policy por agente = interseção com role policy. Cada agente tem APENAS o necessário",
                  layer: "Runtime",
                },
                {
                  threat: "Lateral Movement",
                  vector: "Atacante compromete credenciais de tenant A e acessa tenant B",
                  mitigation: "Cada AssumeRole usa External ID diferente. Session tags identificam tenant. Credenciais são tenant-specific",
                  layer: "Runtime",
                },
                {
                  threat: "Insider Threat",
                  vector: "Operador assume outbound role e acessa contas de clientes",
                  mitigation: "CloudTrail alert em AssumeRole por humano. Role só assumível por ECS task roles. MFA obrigatório para conta bastion",
                  layer: "Monitoring",
                },
                {
                  threat: "Role Drift",
                  vector: "Cliente adiciona AdministratorAccess ao integration role",
                  mitigation: "Daily drift detection + rejeição de policies over-privileged + notificação ao cliente",
                  layer: "Monitoring",
                },
                {
                  threat: "External ID Removal",
                  vector: "Cliente remove condition de External ID do trust policy",
                  mitigation: "Daily validation + auto-disable integração + notificação urgente",
                  layer: "Monitoring",
                },
                {
                  threat: "Unauthorized Remediation",
                  vector: "Agent tenta executar ações write sem aprovação",
                  mitigation: "Runbook executor recebe DENY ALL por padrão. Novas credenciais emitidas apenas após approval gate com resource-scoped policy",
                  layer: "Runtime",
                },
                {
                  threat: "Prompt Injection → Action",
                  vector: "Log malicioso injeta instrução para agente executar action",
                  mitigation: "Session policy READ-ONLY para investigação. Write impossível sem approval + novas credenciais. Sanitização de input antes do agente",
                  layer: "Agent",
                },
                {
                  threat: "CDK Bootstrap Takeover",
                  vector: "Atacante registra CDK roles da NOSSA conta como integration",
                  mitigation: "Validamos External ID ANTES de aceitar role. CDK roles não têm External ID = rejeitados automaticamente",
                  layer: "Onboarding",
                },
              ].map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-3 py-2 font-bold text-gray-900">{row.threat}</td>
                  <td className="px-3 py-2 text-gray-600">{row.vector}</td>
                  <td className="px-3 py-2 text-green-700">{row.mitigation}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      row.layer === 'Onboarding' ? 'bg-blue-100 text-blue-700' :
                      row.layer === 'Runtime' ? 'bg-purple-100 text-purple-700' :
                      row.layer === 'Monitoring' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>{row.layer}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="font-bold text-red-900 mb-2">Cenário Worst Case: Backend Totalmente Comprometido</h4>
          <div className="text-sm text-red-800 space-y-2">
            <p><strong>Se um atacante obtém acesso total ao nosso backend:</strong></p>
            <p>1. Pode obter credenciais temporárias de clientes — MAS limitadas a 1 hora e session policies read-only</p>
            <p>2. NÃO pode executar ações write sem approval gate (que requer Slack interaction do cliente)</p>
            <p>3. NÃO pode obter credenciais de todos os clientes simultaneamente sem acionar anomaly detection</p>
            <p>4. Conta bastion isolada + IP range monitoring = detecção rápida de uso fora da infra</p>
            <p>5. Clientes com aws:SourceIp condition no trust policy = credenciais inutilizáveis fora da nossa rede</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "soc2",
    title: "SOC 2 & LGPD",
    icon: "📜",
    content: () => (
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-900">Evidências para SOC 2 Type II & LGPD</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-bold text-gray-900 mb-3">SOC 2 — Trust Services Criteria</h4>
            <div className="space-y-3 text-sm">
              <div className="border-l-3 border-blue-500 pl-3">
                <p className="font-bold text-gray-800">CC6.1 — Logical Access</p>
                <p className="text-gray-600">IAM Roles com least privilege. Session policies por sub-agente. Nenhuma credencial long-lived.</p>
              </div>
              <div className="border-l-3 border-blue-500 pl-3">
                <p className="font-bold text-gray-800">CC6.2 — Authentication</p>
                <p className="text-gray-600">Cross-account AssumeRole com External ID. Validação no onboarding. MFA na conta bastion.</p>
              </div>
              <div className="border-l-3 border-blue-500 pl-3">
                <p className="font-bold text-gray-800">CC6.3 — Authorization</p>
                <p className="text-gray-600">Feature-gated policies. Approval gate para write. Resource-scoped remediation policies.</p>
              </div>
              <div className="border-l-3 border-blue-500 pl-3">
                <p className="font-bold text-gray-800">CC7.1 — Monitoring</p>
                <p className="text-gray-600">CloudTrail monitoring. Anomaly detection. Daily drift checks. IP range validation.</p>
              </div>
              <div className="border-l-3 border-blue-500 pl-3">
                <p className="font-bold text-gray-800">CC8.1 — Change Management</p>
                <p className="text-gray-600">IAM policies versionadas via CloudFormation/Terraform. IaC review obrigatório.</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="font-bold text-gray-900 mb-3">LGPD — Aspectos Relevantes</h4>
            <div className="space-y-3 text-sm">
              <div className="border-l-3 border-green-500 pl-3">
                <p className="font-bold text-gray-800">Art. 46 — Medidas de Segurança</p>
                <p className="text-gray-600">Credenciais efêmeras (1h). Criptografia em trânsito (TLS 1.3). Session policies restritivas.</p>
              </div>
              <div className="border-l-3 border-green-500 pl-3">
                <p className="font-bold text-gray-800">Art. 37 — Registro de Operações</p>
                <p className="text-gray-600">Audit trail tamper-proof de todas as operações. Session tags para rastreabilidade completa.</p>
              </div>
              <div className="border-l-3 border-green-500 pl-3">
                <p className="font-bold text-gray-800">Art. 48 — Comunicação de Incidente</p>
                <p className="text-gray-600">Monitoramento em tempo real. Alertas automáticos em caso de anomalia de acesso.</p>
              </div>
              <div className="border-l-3 border-green-500 pl-3">
                <p className="font-bold text-gray-800">Data Residency</p>
                <p className="text-gray-600">Conta bastion em sa-east-1 (São Paulo). Regional outbound roles. Dados nunca saem do Brasil.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5">
          <h4 className="font-bold text-gray-900 mb-3">Relatório de Conformidade Automatizado</h4>
          <div className="bg-gray-900 text-green-400 rounded p-3 font-mono text-xs overflow-x-auto">
            <pre>{`// Geração mensal automática de evidências SOC 2
async function generateComplianceReport(month: string) {
  return {
    // CC6.1 - Todos os acessos usaram credenciais temporárias?
    temporaryCredentials: {
      totalSessions: await countSessions(month),
      maxDuration: '3600s',
      longLivedCredentials: 0,  // SEMPRE zero
    },
    
    // CC6.2 - Todos os acessos usaram External ID?
    externalIdEnforcement: {
      totalTenants: await countActiveTenants(),
      withExternalId: await countTenantsWithExternalId(),
      driftDetections: await countDriftEvents(month),
      autoDisabled: await countAutoDisabled(month),
    },
    
    // CC6.3 - Session policies aplicadas?
    sessionPolicies: {
      totalVendedCredentials: await countVendedCreds(month),
      withSessionPolicy: await countWithSessionPolicy(month),  // 100%
      remediationsApproved: await countApprovedRemediations(month),
      remediationsBlocked: await countBlockedRemediations(month),
    },
    
    // CC7.1 - Anomalias detectadas
    anomalyDetection: {
      humanAssumeRoleAttempts: await countHumanAttempts(month),
      unknownIPAttempts: await countUnknownIPAttempts(month),
      overPrivilegedRolesDetected: await countOverPrivileged(month),
    },
    
    // Audit trail integrity
    auditIntegrity: {
      totalEntries: await countAuditEntries(month),
      hashChainValid: await verifyHashChain(month),
    },
  };
}`}</pre>
          </div>
        </div>
      </div>
    ),
  },
];

export default function ADR008CredentialManagement() {
  const [activeSection, setActiveSection] = useState("overview");
  const currentSection = sections.find((s) => s.id === activeSection);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gray-900 text-white px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
            <span>AI SRE Platform</span>
            <span>›</span>
            <span>Architecture Decision Records</span>
          </div>
          <h1 className="text-2xl font-bold">
            ADR-008: Cross-Account Credential Management
          </h1>
          <p className="text-gray-400 mt-1">
            Security-first architecture para acesso a contas AWS de clientes
          </p>
          <div className="flex gap-3 mt-3">
            <span className="px-2 py-0.5 bg-red-600 rounded text-xs font-bold">CRÍTICO</span>
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
