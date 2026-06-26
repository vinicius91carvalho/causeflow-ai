**CAUSEFLOW AI**

*O Detetive de Problemas da sua Stack*

**Website Blueprint & Plano de Implementação**

Versão 3.0 --- Fevereiro 2026

Baseado no Business Plan v1.1.0 e análise competitiva atualizada

Concorrentes diretos: resolve.ai · incident.io · Rootly · IncidentFox

**Confidencial**

# 1. Visão Geral do Projeto

Este documento define toda a estrutura, conteúdo, textos finais e plano de
implementação de cada página do website do CauseFlow AI. Foi construído a
partir do Business Plan v1.1.0 e de análise competitiva profunda dos quatro
concorrentes diretos: resolve.ai (avaliado em \$1B, \$150M+ em funding),
incident.io (\$96.2M em funding, \$400M valuation), Rootly (\$15.2M em
funding) e IncidentFox (YC W26, open-core, early-stage).

O CauseFlow AI ocupa uma posição de mercado não contestada: é a ponte
entre investigação automatizada de SRE e resolução de issues de clientes
--- um gap que nenhum competidor endereça. O site deve comunicar isso de
forma clara, profissional e acessível para times de engenharia de 2 a 50
pessoas.

## 1.1 Internacionalização (i18n)

O idioma padrão do site é **inglês (EN)**. O português brasileiro (PT-BR)
será disponibilizado como idioma secundário.

- Rotas padrão em inglês: `/product`, `/pricing`, `/compare`, etc.
- Rotas em português: `/pt-br/product`, `/pt-br/pricing`, `/pt-br/compare`, etc.
- Seletor de idioma no header (bandeira ou dropdown EN/PT-BR).
- Todos os textos deste blueprint devem ser traduzidos para inglês como conteúdo primário, mantendo PT-BR como tradução.
- SEO: hreflang tags para cada página indicando as versões EN e PT-BR.

## 1.2 Posicionamento Estratégico

| **Aspecto** | **resolve.ai** | **incident.io** | **Rootly** | **IncidentFox** | **CauseFlow AI** |
|---|---|---|---|---|---|
| Público-alvo | Enterprise (Coinbase, DoorDash, Salesforce) | Mid-market a enterprise | Mid-market a enterprise | Startups e SMBs (Slack-native) | Startups e SMBs (2--50 engenheiros) |
| Função core | Investigação autônoma multi-agente | Orquestração + AI emergente | Orquestração + AI SRE | AI SRE agent: triage + fix scripts | Investigação AI cross-tool + customer issues |
| Pricing | Custom enterprise (sem preço público) | \$19--45/user/mês | \$20/user/mês | Open-core (sem preço público ainda) | Usage-based: \$0--\$399/mês (por investigação) |
| AI RCA | Multi-agente, Knowledge Base | Correlaciona código + métricas | Confidence scores + hipóteses | Análise de codebase + logs + deploys | LLM Gateway multi-modelo + Knowledge Base |
| Customer issue resolution | Não | Não | Não | Não | Sim --- diferencial único |
| Auto-fix PRs | Sim | Sim | Sim | Sim (fix scripts com aprovação) | Sim (com human-in-the-loop) |
| Onboarding | Demo com vendedor | Self-service + free tier | 14 dias trial | Auto-setup via análise de codebase | Self-service, setup \< 10 min, free tier |
| SMB-otimizado | Não | Free tier, mas trending enterprise | Startup discounts (\<25) | Sim (open-core, self-host) | Sim --- core target |
| Funding | \$150M+ (\$1B val) | \$96.2M (\$400M val) | \$15.2M (Series A) | YC W26 (early-stage) | Bootstrap (founders) |
| MCP server | Usa internamente | Sim (GoLang) | Sim (TypeScript) | Não (open-core Python) | MCP + core proprietário |
| Open source | Não | Não | Não | Sim (Apache-2.0) | Não |

## 1.3 Diferenciais Únicos do CauseFlow AI

- **Cross-tool + Customer Context:** Único agente que cruza Slack + GitHub + Jira + Logs + DB + HubSpot e resolve tanto alertas de infra quanto issues de clientes numa investigação unificada.

- **Pricing usage-based:** Per-investigation pricing (\$0.50--\$0.20/investigação) vs. \$19--45/user/mês dos competidores. SMBs pagam pelo valor real.

- **Knowledge Base:** Aprende com cada investigação, construindo grafo de dependências de serviços e blast radius. Problemas recorrentes resolvidos em segundos.

- **Audit trail imutável:** Cada ação do agente é registrada em log visível ao cliente. Transparência total.

- **Entry points naturais:** Recebe problemas via Slack, Jira card, interface web ou email de cliente. Sem dashboards complexos.

## 1.4 Escopo deste Documento

Este blueprint cobre as seguintes páginas:

| **Página** | **URL (EN)** | **URL (PT-BR)** | **Prioridade** |
|---|---|---|---|
| Homepage | / | /pt-br | CRÍTICA |
| Product / How It Works | /product | /pt-br/product | CRÍTICA |
| Security | /security | /pt-br/security | CRÍTICA |
| Integrations | /integrations | /pt-br/integrations | CRÍTICA |
| Pricing | /pricing | /pt-br/pricing | CRÍTICA |
| Compare (hub) | /compare | /pt-br/compare | CRÍTICA |
| CauseFlow vs resolve.ai | /vs/resolve-ai | /pt-br/vs/resolve-ai | CRÍTICA |
| CauseFlow vs incident.io | /vs/incident-io | /pt-br/vs/incident-io | CRÍTICA |
| CauseFlow vs Rootly | /vs/rootly | /pt-br/vs/rootly | CRÍTICA |
| CauseFlow vs IncidentFox | /vs/incidentfox | /pt-br/vs/incidentfox | CRÍTICA |
| About Us | /about | /pt-br/about | ALTA |
| Get Started / Sign Up | /get-started | /pt-br/get-started | CRÍTICA |
| Privacy Policy | /privacy | /pt-br/privacy | ALTA |
| Terms of Service | /terms | /pt-br/terms | ALTA |

# 2. Navegação Global (Header + Footer)

## 2.1 Header (Fixo / Sticky)

O header deve ser sticky (fixo no topo ao rolar).

| **Elemento** | **Tipo** | **Destino** | **Notas** |
|---|---|---|---|
| Logo CauseFlow AI | Link | / | Logo à esquerda |
| Product | Link | /product | |
| Integrations | Link | /integrations | |
| Pricing | Link | /pricing | DIFERENCIAL: resolve.ai não tem |
| Security | Link | /security | |
| Compare | Link | /compare | DIFERENCIAL: mostra que não temos medo de comparar |
| About | Link | /about | |
| EN/PT-BR | Seletor de idioma | toggle | Bandeira ou dropdown |
| \[Sign In\] | Link | /login | À direita do nav |
| \[Get Started Free\] | Botão CTA | /get-started | |

*No mobile: header colapsa em hamburger menu. O botão "Get Started Free"
permanece visível à direita do ícone do menu.*

## 2.2 Footer

Layout em 4 colunas + linha inferior:

| **Coluna** | **Conteúdo** |
|---|---|
| CauseFlow AI | Logo + descrição curta: "Intelligent incident investigation for engineering teams." + ícones sociais (GitHub, LinkedIn, Twitter/X). |
| Product | Links: How It Works, Integrations, Security, Pricing, Compare |
| Company | Links: About Us, Contact, Platform Status |
| Legal | Links: Privacy Policy, Terms of Service, LGPD/GDPR |

*Linha inferior: "© 2026 CauseFlow AI. All rights reserved." + badges de "LGPD Compliant" e "GDPR Compliant".*

# 3. Homepage (/)

A homepage é a página mais importante do site. Deve comunicar em 5
segundos: o que o CauseFlow faz, para quem, e por que é diferente.
Estrutura em 8 seções sequenciais.

## 3.1 Seção Hero (Acima da Dobra)

Seção com fundo escuro. Layout em 2 colunas: texto à esquerda, screenshot/animação do produto à direita.

### Conteúdo --- Coluna Esquerda

**Badge no topo:** "Investigate production incidents in minutes, not hours"

**Headline (H1):** "Your Stack's Problem Detective"

**Subheadline:** "CauseFlow AI connects to Slack, GitHub, Jira, CloudWatch and HubSpot, cross-references all data sources and delivers the root cause with fix recommendations. All in under 5 minutes."

**CTA Primário:** "Get Started Free"

**CTA Secundário:** "Watch Demo →"

**Texto de confiança:** "Setup in 10 minutes · 5 free investigations/month · No credit card required"

### Conteúdo --- Coluna Direita

Screenshot do produto mostrando uma investigação em andamento.
Preferencialmente um componente animado que simula o agente investigando
em tempo real: conectando ao Slack, lendo logs, identificando a causa
raiz. Se não tiver screenshot real, usar mockup de alta fidelidade.

## 3.2 Barra de Tecnologias Suportadas

**Título:** "Connects to the tools your team already uses"

Logos em scroll infinito horizontal (carrossel automático): Slack,
GitHub, Jira, AWS CloudWatch, HubSpot, Trello, PostgreSQL, MySQL,
Linear, Sentry, MongoDB, Confluence, Datadog, PagerDuty, Grafana.

Adicionar que muitas outras ainda serão desenvolvidas.

## 3.3 Seção de Métricas de Impacto

3 cards com métricas:

| **Métrica** | **Número em Destaque** | **Descrição** |
|---|---|---|
| MTTR Reduction | 95% | From 2--4 hours down to under 5 minutes per investigation |
| Cost per Investigation | \$0.50--\$0.20 | Far less than the engineering hours spent manually analyzing the problem |
| Downtime Cost Avoided | \$14,000/min | Average downtime cost for digital businesses |

## 3.4 Seção "Como Funciona"

**Título da seção:** "How CauseFlow investigates your problems"

**Subtítulo:** "From any problem source, through all your tools, to the root cause --- in minutes."

6 cards:

| **Card** | **Título** | **Descrição** | **Ícone Sugerido** |
|---|---|---|---|
| 1 | Receives the problem from any source | Via web interface, Slack, Jira or customer email. Describe the problem and CauseFlow starts investigating immediately. | Inbox / message received |
| 2 | Investigates all sources automatically | Connects to GitHub (commits, PRs, releases), CloudWatch (error logs), Jira (tickets), Slack (messages) and HubSpot (customer impact) simultaneously. | Magnifying glass with gear |
| 3 | Identifies root cause with evidence | Cross-references logs, commits, tickets and metrics to deliver the root cause with confidence score and event timeline. | Target / bullseye |
| 4 | Recommends specific fixes | Suggests the exact fix: deploy revert, config adjustment, code fix PR. All with human-in-the-loop. | Wrench |
| 5 | Learns from every investigation | Builds a Knowledge Base that accelerates future resolutions of recurring problems. | Brain |
| 6 | Complete and transparent audit trail | Every agent action is recorded in an immutable log visible to the customer. You see exactly what the agent did, when, and what data it accessed. | Shield with check |

## 3.5 Seção Diferencial: Técnico + Negócio

Seção com fundo escuro. 2 colunas: texto à esquerda, diagrama/animação à direita mostrando o fluxo cross-tool.

**Título:** "The first agent that crosses technical data with business tools"

**Parágrafo:** "While competitors focus only on infrastructure, CauseFlow investigates the complete problem context. Receive a customer report 'I think my data was deleted' and CauseFlow automatically queries the customer's account in the database, checks audit logs for recent changes, determines if a deployment caused the issue, and generates both a technical fix and an explanation for the customer."

*Diagrama visual mostrando: Customer issue (HubSpot) → Agent investigates GitHub + CloudWatch + DB → Result: technical fix + customer response.*

## 3.6 Seção "Múltiplas Formas de Usar"

**Título:** "Use CauseFlow in the way that makes most sense for your team"

| **Modo** | **Título** | **Descrição** |
|---|---|---|
| Via Slack | Via Slack | Send a message in Slack describing the problem and the agent investigates right in the incident channel. Results appear as a thread. |
| Via Jira/Trello | Via Jira/Trello | Assign a card to CauseFlow and it investigates automatically. The final report becomes a comment on the card. |
| Via Web Interface | Via Web Interface | Access the dashboard, describe the problem, and follow the investigation in real-time with visible audit trail. |
| Via API | Via API | Integrate CauseFlow into your alerting pipeline. Trigger investigations via REST API with result webhooks. |
| Via MCP | Via MCP Server | Use CauseFlow as an MCP tool inside your AI coding agent or IDE. |
| Via Agent | Via AI Agent | Let the CauseFlow agent work autonomously within your workflow. |

## 3.7 Seção de Segurança (Resumo)

**Título:** "Enterprise Security from Day 1"

6 items com checkmark + texto:

| **#** | **Compromisso** | **Descrição Curta** |
|---|---|---|
| 1 | On-demand reading | The agent reads, analyzes and discards. Your data never leaves the perimeter. |
| 2 | Isolated encryption | Each tenant has individual KMS encryption via AWS. |
| 3 | Immutable audit trail | Every agent action is logged and visible to the customer. |
| 4 | No external training | Your data is never used to train third-party models. |
| 5 | Read-only by default | The agent never writes without explicit approval (human-in-the-loop). |
| 6 | Right to deletion | Delete all your data at any time. |

**Badges abaixo:** "LGPD and GDPR compliant since launch. SOC 2 Type II roadmap." + Botão: "Learn more about Security →"

## 3.8 Seção CTA Final

Seção com fundo escuro, full-width.

**Título:** "Ready to investigate problems in minutes?"

**Subtítulo:** "Setup in 10 minutes. 5 free investigations per month. No credit card required."

**CTA Primário:** "Get Started Free"

**CTA Secundário:** "Or schedule a personalized demo"

# 4. Página de Produto (/product)

Página dedicada a explicar em profundidade como o CauseFlow funciona.
Foco em workflow visual, screenshots/mockups e diferenças técnicas.

## 4.1 Hero da Página de Produto

Seção com fundo escuro. Demo interativa embedada ou vídeo Loom de 60 segundos.

**Título:** "Intelligent Investigation for your Engineering and Support team"

**Subtítulo:** "CauseFlow connects to the tools your team already uses, automatically investigates logs, commits, tickets and metrics, and delivers the root cause in minutes."

**CTA:** "Get Started Free" + "Watch Interactive Demo"

## 4.2 Workflow de Investigação --- 3 Fases

Apresentar as 3 fases do produto conforme o Business Plan, cada uma com
sub-steps visuais.

### FASE 1 --- Assisted Investigation + Remediation

Esta é a fase do MVP. Timeline vertical com 4 steps:

| **Step** | **Título** | **Descrição Detalhada** |
|---|---|---|
| 1.1 | Receives the problem | Via web interface, Slack message, Jira/Trello card or customer email. The user describes the problem in natural language and the agent starts the investigation. |
| 1.2 | Connects to all sources | Slack (messages from #incidents channel), GitHub (commits, PRs, recent releases), Jira (related tickets), CloudWatch (error logs), HubSpot (affected customer data). All in parallel. |
| 1.3 | Analyzes and correlates | Cross-references data from all sources using multi-model LLM (Claude Haiku 4.5 as default, Sonnet 4.5 for complex cases). Generates hypotheses, tests against evidence, classifies with confidence score. |
| 1.4 | Delivers complete report | Probable root cause + confidence score (0--100%) + chronological event timeline + specific fix recommendations + customer impact (if applicable). |

**Semi-autonomous Remediation:** With user approval, the agent executes
the fix plan: generates PRs on GitHub, executes kubectl commands,
remediation scripts, deploy revert. Always with human-in-the-loop
before any destructive action.

### FASE 2 --- Intelligent Knowledge Base

**Título:** "The more you use it, the faster it resolves"

The system learns from every resolved investigation, building a
Knowledge Base that maps service dependencies and blast radius.
When a similar problem is detected, CauseFlow suggests the previous
solution immediately --- recurring problems resolved in seconds,
not hours.

### FASE 3 --- Autonomous Remediation (Roadmap)

Seção com badge "Coming Soon", mostrando o roadmap futuro.

**Título:** "Auto-healing with guardrails"

Automatic correction with configurable approval: deploy revert, config
adjustment, automatic scaling. Integration marketplace and autonomous
L1 ticket resolution.

## 4.3 Seção "Full Visibility: Audit Trail"

Seção com fundo escuro, mostrando um exemplo real de audit trail em formato de terminal/código.

**Título:** "See exactly what the agent did"

**Subtítulo:** "Total transparency. Every agent action is recorded in an immutable log visible to you."

**Exemplo de Audit Trail (mostrar como bloco de código estilizado):**

```
Investigation #4821 --- 2026-02-12T14:32:00Z

├── [14:32:01] Connected to Slack (workspace: acme-corp)
│   Read 23 messages in #incidents
├── [14:32:05] Connected to GitHub
│   Read 3 recent commits + 1 open PR
├── [14:32:08] Connected to Jira
│   Read ticket ACME-1234
├── [14:32:10] Connected to CloudWatch
│   Read 847 log lines (ERROR)
├── [14:32:15] LLM Analysis
│   Input: 12,400 tokens | Output: 2,100 tokens
└── [14:32:22] Result:
    Deploy #482 introduced null pointer in /payments
    Confidence: 87% | Duration: 21s
```

*Este bloco deve ser renderizado no site com animação de typing (cada
linha aparecendo progressivamente) para dar sensação de tempo real.*

## 4.4 Seção: Technical Architecture (Simplified)

Diagrama visual mostrando a arquitetura híbrida MCP + Core Proprietário:

- Connectivity layer: MCP servers (8,620+ available in the ecosystem, adopted by OpenAI, Google, Microsoft)

- Proprietary core: Planning engine, hypothesis generation, learning and Knowledge Base

- LLM Gateway: Intelligent router by complexity (Claude Haiku 4.5 default → Sonnet 4.5 for complex)

- Security: AWS Bedrock (ISO/IEC 42001), KMS per-tenant, PII Gateway (Presidio)

*Keep simple and visual. Don't get into too much technical detail --- that goes in the documentation.*

# 5. Página de Segurança (/security)

Esta é a página mais importante para conversão de times maiores. O
resolve.ai dedica uma página inteira com múltiplas seções. Precisamos
replicar esse nível de detalhe.

## 5.1 Hero da Página de Segurança

**Título:** "Security you can audit"

**Subtítulo:** "Your data never leaves the perimeter. The agent reads on demand, analyzes and discards. Everything it did is recorded in an immutable audit trail visible to you."

## 5.2 Six Data Privacy Commitments

Organizados em 2 pilares de 3 itens cada.

### Pilar 1 --- Minimum Access with Full Control

| **CauseFlow Commitment** | **Technical Detail** | **resolve.ai Equivalent** |
|---|---|---|
| On-demand reading, no persistence | The agent reads data only during active investigation. After analysis, data is discarded. We don't store raw customer data. | No Data Ingestion |
| Least privilege access | Each integration uses read-only credentials with minimum scope via OAuth. The agent never has write access unless explicitly authorized. | Least Privilege Access |
| No writing by default | The agent is read-only. Remediation actions require explicit user approval (human-in-the-loop) before any destructive action. | No Write Access |

### Pilar 2 --- Isolation and Transparency

| **CauseFlow Commitment** | **Technical Detail** | **resolve.ai Equivalent** |
|---|---|---|
| Tenant isolation | Each customer has individual KMS encryption via AWS. Data is never mixed between customers. LLM calls contain data from exactly one tenant. | No Data Mixing |
| No cross-training | Customer data is never used to train models for other customers. Fine-tuning is exclusive per account when applicable. | No Cross-Customer Models / Exclusive Fine-Tuning |
| Immutable audit trail | Each investigation generates detailed log in S3 with Object Lock (WORM). The log is visible to the customer and cannot be altered. Includes: sources accessed, data read, tokens processed, result. | Auditable |

## 5.3 Compliance e Certificações

| **Certification** | **Status** | **Details** |
|---|---|---|
| LGPD | Compliant since launch | KMS per-tenant + TTL + right-to-delete. Data subject requests fulfilled in 15 days. Breach notification in 72h. |
| GDPR | Compliant since launch | Same mechanisms cover GDPR. Standard Contractual Clauses for cross-border transfers. |
| SOC 2 Type I | Roadmap: month 6--9 | Via Vanta or Drata. Investment: \$500--\$1,000/month. |
| SOC 2 Type II | Roadmap: month 12--18 | Investment: \$25K--\$65K total first year. |
| ISO 27001 / HIPAA | Roadmap: Year 2+ | As enterprise demand requires. |

## 5.4 Security Architecture (Diagram)

OBS: Verificar se essa area esta compartilhando muitas informacoes que
concorrentes poderão utilizar.

Diagrama visual da infraestrutura AWS:

- Client (HTTPS) → WAF → ALB → ECS Tasks (private subnets)

- ECS Tasks → NAT Gateway → External APIs (Slack, GitHub, etc.)

- Credentials in AWS Secrets Manager with automatic rotation

- RDS/DynamoDB in private subnet with no internet exposure

- All logs centralized in CloudWatch + S3 Object Lock

- Data at rest: AES-256 via KMS per-tenant. Data in transit: TLS 1.3

## 5.5 Data Isolation (Multi-tenancy)

OBS: Verificar se essa area esta compartilhando muitas informacoes que
concorrentes poderão utilizar.

| **Layer** | **Isolation Mechanism** |
|---|---|
| Application | Tenant ID required in every query, log and record. LLM calls containing data from exactly one tenant. |
| Database | PostgreSQL with Row Level Security (RLS) by tenant_id. |
| Vector database | Pinecone namespaces (hard partitions per tenant) or Weaviate multi-tenancy (1M+ tenants). |
| Infrastructure | Each investigation runs in ephemeral ECS Task with restricted IAM Role. Container destroyed upon completion. |
| PII Gateway | Microsoft Presidio detects and anonymizes emails, phones, SSNs, cards. Reversible anonymization. |
| Encryption | Data at rest: AES-256 via KMS per-tenant. Data in transit: TLS 1.3. |

## 5.6 AWS Bedrock as LLM Provider

AWS Bedrock offers the strongest privacy guarantees in the market:

- AWS does not use customer data to train models

- Model providers have zero access to prompts/completions

- ISO/IEC 42001 certification (first major cloud provider)

- PrivateLink support for VPC-private connectivity

- Guardrails for PII detection/redaction

## 5.7 CTA da Página de Segurança

**Título:** "Enterprise Security. Startup Pricing."

**CTA Primário:** "Get Started Free"

**CTA Secundário:** "Schedule a Security Demo"

# 6. Página de Integrações (/integrations)

## 6.1 Hero

**Título:** "Connect your tools in minutes"

**Subtítulo:** "CauseFlow integrates with the tools your team already uses. OAuth or API key --- no complex setup, no agent to install."

## 6.2 Filtros e Catálogo

Filtros horizontais: All | Communication | Code | Monitoring | Project Management | CRM & Business | Database

| **Integration** | **Category** | **Phase** | **What It Does** | **Differentiator vs Competitors** |
|---|---|---|---|---|
| Slack | Communication | MVP | Receives problems and responds in Slack. Reads incident channel messages. | All have it |
| GitHub | Code | MVP | Analyzes commits, PRs and recent releases. Generates fix PRs. | All have it |
| Jira | Management | MVP | Reads tickets, creates comments with investigation results. | All have it |
| AWS CloudWatch | Monitoring | MVP | Analyzes error logs, metrics and alarms. | resolve.ai has it, incident.io doesn't |
| HubSpot | CRM | MVP | Checks customer impact, account data, history. | NO competitor has this --- differentiator! |
| Trello | Management | MVP | Alternative to Jira for smaller teams. | No competitor has it |
| PostgreSQL / MySQL | DB | V1 | Read-only queries to validate data state. | resolve.ai doesn't have it, others neither |
| Linear | Management | V1 | Integration with Linear for teams using it as tracker. | Rootly doesn't have it |
| Sentry | Monitoring | V2 | Real-time errors and exceptions. | Common |
| MongoDB | DB | V2 | Queries on NoSQL databases. | No competitor has it |
| Datadog | Monitoring | V2 | Metrics, logs and traces. | resolve.ai and incident.io have it |
| PagerDuty | Monitoring | V2 | Alerts and on-call schedules. | incident.io and Rootly have it |
| Grafana | Monitoring | V2 | Dashboards and alerts. | resolve.ai has it |
| Confluence | Knowledge | V2 | Internal documentation and runbooks. | resolve.ai has it |
| Custom Webhooks | API | V3 | Custom integrations via REST API. | All have it |

## 6.3 Integration Principles (6 Cards)

| **Principle** | **Description** |
|---|---|
| Setup in minutes | OAuth or API key --- no complex setup, no agent to install. Average setup: 3 minutes per integration. |
| Read-only by default | The agent only reads. Never modifies your data without explicit approval. |
| Only what's needed | Fetches only the data relevant to the active investigation. No mass collection. |
| No sensitive data | Automatic PII/sensitive data redaction via Microsoft Presidio. |
| Technical + Business | First platform to cross technical tools (GitHub, CloudWatch) with CRM (HubSpot) and support. |
| Open API | REST API for custom integrations and result webhooks. |

# 7. Página de Preços (/pricing)

Esta página é o nosso GRANDE DIFERENCIAL. Nenhum dos concorrentes
diretos (resolve.ai) oferece preços públicos transparentes com modelo
usage-based. incident.io e Rootly usam per-seat pricing
(\$19--45/user/mês). O CauseFlow usa preço por investigação.

## 7.1 Hero

**Título:** "Simple pricing. Pay for what you use."

**Subtítulo:** "No mandatory annual contracts. No surprises. Start free and scale as you grow."

## 7.2 Tabela de Planos

5 planos, com o plano Pro destacado como "Most popular":

| | **Free** | **Starter** | **Pro** (Most popular) | **Business** | **Enterprise** |
|---|---|---|---|---|---|
| Price | \$0/month | \$49/month | \$149/month | \$399/month | Custom |
| Investigations included | 5/month | 100/month | 500/month | 2,000/month | Unlimited |
| Overage | --- | \$0.50/each | \$0.35/each | \$0.20/each | Negotiated |
| Target | Individual devs | Teams 2--5 devs | Teams 5--20 devs | Orgs 20--50 devs | 50+ devs |
| Integrations | All | All | All | All | All + custom |
| Audit trail | ✓ | ✓ | ✓ | ✓ | ✓ |
| Knowledge Base | --- | ✓ | ✓ | ✓ | ✓ |
| Remediation (PRs) | --- | ✓ | ✓ | ✓ | ✓ |
| RBAC | --- | --- | ✓ | ✓ | ✓ + SSO/SAML |
| Support | Community | Email | Slack Connect | Dedicated | Dedicated + SLA |
| CTA | Start Now | Create Account | Create Account | Create Account | Talk to Sales |

## 7.3 Pricing Comparison: CauseFlow vs. Competitors

Seção crucial que mostra a vantagem do modelo usage-based vs. per-seat:

**Título:** "Why pay per user if only 2--3 people investigate incidents?"

| **Scenario** | **CauseFlow (Pro)** | **incident.io (Pro)** | **Rootly (Pro)** | **resolve.ai** | **IncidentFox** |
|---|---|---|---|---|---|
| Team of 5 devs | \$149/month (500 inv.) | \$225/month (\$45 x 5) | \$100/month (\$20 x 5) | Doesn't serve (enterprise only) | Open-core (self-host) |
| Team of 10 devs | \$149/month (500 inv.) | \$450/month (\$45 x 10) | \$200/month (\$20 x 10) | Doesn't serve | Open-core (self-host) |
| Team of 20 devs | \$399/month (2,000 inv.) | \$900/month (\$45 x 20) | \$400/month (\$20 x 20) | Doesn't serve | Open-core (self-host) |
| Team of 50 devs | Custom | \$2,250/month (\$45 x 50) | \$1,000/month (\$20 x 50) | Custom (6-7 fig. ACV) | Open-core (self-host) |
| What you pay for | Per actual investigation | Per user, even without investigating | Per user, even without investigating | Enterprise contract | Self-hosted infra costs |
| Customer issues | ✓ Included | ✗ Not available | ✗ Not available | ✗ Not available | ✗ Not available |

## 7.4 ROI Calculator

Componente interativo na página:

**Input 1:** "How many incidents/investigations does your team do per month?" --- slider de 1 a 500.

**Input 2:** "How long does each investigation take on average?" --- dropdown: 30min, 1h, 2h, 4h.

**Input 3:** "How many engineers on the team?" --- slider de 1 a 100.

**Output:**

- Hours saved per month: \[calculation\]

- CauseFlow cost: \[recommended plan\]

- Equivalent cost on incident.io: \[engineers x \$45\]

- Equivalent cost on Rootly: \[engineers x \$20\]

- Estimated annual savings: \[difference\]

## 7.5 Pricing FAQ

| **Question** | **Answer** |
|---|---|
| What counts as an investigation? | Every time CauseFlow receives a problem and runs a complete investigation (connecting to sources, analyzing data, generating report) counts as 1 investigation. |
| Can I change plans? | Yes, at any time. Upgrade is immediate, downgrade on next cycle. |
| Do I need a credit card for the Free plan? | No. The Free plan doesn't require a credit card. |
| Is there an annual discount? | Yes. Pre-paid credits offer 10--20% progressive discount. |
| What if I exceed the limit? | You pay the overage price of your plan per additional investigation. No surprises --- you configure consumption alerts. |
| How does it work for Brazilian companies? | We accept international payment via Stripe. LGPD compliant since launch. |

# 8. Página de Comparação Hub (/compare)

Página dedicada a comparar o CauseFlow com os quatro concorrentes diretos.
Ser honesto e factual --- mostrar onde somos superiores E onde os
concorrentes são mais maduros (ex: compliance). Isso constrói confiança.

Esta página serve como hub com tabela geral e links para as páginas
individuais de comparação.

## 8.1 Hero

**Título:** "How CauseFlow compares"

**Subtítulo:** "Total transparency. See exactly where we're better, where we're different, and where we're growing."

## 8.2 Tabela Comparativa Geral

| **Dimension** | **CauseFlow AI** | **resolve.ai** | **incident.io** | **Rootly** | **IncidentFox** |
|---|---|---|---|---|---|
| Core function | AI investigation cross-tool + customer issues | Autonomous multi-agent investigation | Orchestration + emerging AI | Orchestration + AI SRE | AI SRE agent: triage + fix scripts |
| Target | SMBs (2--50 engineers) | Enterprise (Coinbase, DoorDash) | Mid-market to enterprise | Mid-market to enterprise | Startups (Slack-native) |
| Pricing | \$0--\$399/month (per investigation) | Custom enterprise (no public pricing) | \$19--45/user/month | \$20/user/month | Open-core (no public pricing) |
| Free tier | ✓ 5 investigations/month | ✗ Playground only | ✓ Basic (limited) | ✗ 14-day trial | ✓ Open-core self-host |
| AI RCA (Root Cause) | ✓ Multi-model LLM + Knowledge Base | ✓ Proprietary multi-agent | ✓ Correlates code + metrics | ✓ Confidence scores | ✓ Codebase analysis + logs |
| Customer issue resolution | ✓ Unique differentiator | ✗ | ✗ | ✗ | ✗ |
| Auto-fix PRs | ✓ With human-in-the-loop | ✓ | ✓ Button generates PRs | ✓ Drafts PRs | ✓ Fix scripts with approval |
| Knowledge Base | ✓ | ✓ 50K+ nodes/env | ✗ | ✗ | ✗ |
| Onboarding | Self-service, \< 10 min | Demo with sales rep | Self-service | Demo + trial | Auto-setup via codebase scan |
| MCP server | ✓ MCP + proprietary core | Uses MCP internally | ✓ GoLang | ✓ TypeScript | ✗ (Python open-core) |
| CRM integration | ✓ HubSpot (MVP) | ✗ | ✗ | ✗ | ✗ |
| DB integration | ✓ PostgreSQL/MySQL | ✗ | ✗ | ✗ | ✗ |
| SOC 2 | Roadmap (month 6--18) | ✓ Type II | ✓ Type II | ✓ Type II | ✗ (early-stage) |
| Open source | ✗ | ✗ | ✗ | ✗ | ✓ Apache-2.0 |
| Funding | Bootstrap | \$150M+ (\$1B valuation) | \$96.2M (\$400M val) | \$15.2M (Series A) | YC W26 (early-stage) |

**Links para páginas individuais:**

- "See detailed comparison: CauseFlow vs resolve.ai →" → /vs/resolve-ai
- "See detailed comparison: CauseFlow vs incident.io →" → /vs/incident-io
- "See detailed comparison: CauseFlow vs Rootly →" → /vs/rootly
- "See detailed comparison: CauseFlow vs IncidentFox →" → /vs/incidentfox

## 8.3 CTA da Página de Comparação

**Título:** "See for yourself. 5 free investigations."

**CTA:** "Get Started Free --- setup in 10 minutes"

# 9. Página Individual: CauseFlow vs resolve.ai (/vs/resolve-ai)

## 9.1 Hero

**Título:** "CauseFlow AI vs resolve.ai"

**Subtítulo:** "Enterprise investigation power, startup pricing"

## 9.2 Contexto

O resolve.ai é a referência de mercado em investigação autônoma de
incidentes. Fundado pelos co-criadores do OpenTelemetry, com exits para
VMware e Splunk, levantou \$125M em Series A com valuation de \$1B. Seus
clientes incluem Coinbase, DoorDash e Salesforce.

## 9.3 Tabela Comparativa Detalhada

| **Feature** | **CauseFlow AI** | **resolve.ai** |
|---|---|---|
| Core function | AI investigation cross-tool + customer issues | Autonomous multi-agent investigation |
| Target | SMBs (2--50 engineers) | Enterprise (Fortune 500) |
| Pricing | \$0--\$399/month (per investigation) | Custom enterprise (6-7 figure ACV) |
| Free tier | ✓ 5 investigations/month | ✗ Playground only |
| Customer issue resolution | ✓ Unique differentiator | ✗ |
| CRM integration | ✓ HubSpot | ✗ |
| DB integration | ✓ PostgreSQL/MySQL | ✗ |
| Knowledge Base | ✓ Growing | ✓ 50K+ nodes, 500K+ edges per env |
| Onboarding | Self-service, \< 10 min | Demo with sales rep |
| SOC 2 | Roadmap | ✓ Type II |
| HIPAA | Roadmap | ✓ |
| MCP server | ✓ MCP + proprietary core | Uses MCP internally |

## 9.4 Where CauseFlow is better

- Transparent pricing: plans from \$0/month vs. 6-7 figure enterprise contracts
- Self-service: setup in 10 minutes vs. sales process with demos
- Customer issue resolution: investigates customer-reported problems, not just infra alerts
- CRM (HubSpot) and database (PostgreSQL/MySQL) integration
- SMB-first: designed for teams of 2--50 engineers

## 9.5 Where resolve.ai is more mature

- Knowledge Base with 50,000+ nodes and 500,000+ edges per enterprise environment
- SOC 2 Type II, GDPR and HIPAA already certified
- Proprietary multi-agent architecture with DSL (Gragg)
- Enterprise scale with Fortune 500 clients

## 9.6 CTA

**CTA:** "Get Started Free --- setup in 10 minutes"

# 10. Página Individual: CauseFlow vs incident.io (/vs/incident-io)

## 10.1 Hero

**Título:** "CauseFlow AI vs incident.io"

**Subtítulo:** "Real AI investigation vs. process orchestration"

## 10.2 Contexto

O incident.io é uma plataforma de orquestração de incidentes com AI
emergente. Levantou \$96.2M em Series B com valuation de \$400M. Foca em
gerenciar o workflow humano: criar canais no Slack, atribuir roles,
rastrear timelines, gerar postmortems.

**Diferença fundamental:**

incident.io otimiza os 20--30% do trabalho que é coordenação de
processos. CauseFlow automatiza os 70--80% que é investigação técnica
real (análise de logs, teste de hipóteses, identificação de causa raiz).

## 10.3 Tabela Comparativa Detalhada

| **Feature** | **CauseFlow AI** | **incident.io** |
|---|---|---|
| Core function | AI investigation cross-tool + customer issues | Orchestration + emerging AI |
| Target | SMBs (2--50 engineers) | Mid-market to enterprise |
| Pricing | \$149/month (500 inv.) | \$45/user/month |
| Team of 10 cost | \$149/month | \$450/month |
| Customer issue resolution | ✓ | ✗ |
| DB + CRM integration | ✓ | ✗ |
| Knowledge Base | ✓ | ✗ |
| Status pages | Roadmap | ✓ |
| On-call management | Roadmap | ✓ |
| Post-mortems | Roadmap | ✓ |
| SOC 2 | Roadmap | ✓ Type II |

## 10.4 Where CauseFlow is better

- Autonomous root cause investigation (not just orchestration)
- Integrated customer issue resolution
- Per-investigation pricing: \$149/month (500 inv.) vs. \$450/month (10 users x \$45)
- Database and CRM integration
- Knowledge Base that learns from every investigation

## 10.5 Where incident.io is more mature

- Complete orchestration ecosystem (status pages, on-call, post-mortems)
- SOC 2 Type II certified
- Dedicated comparison pages and aggressive marketing
- Free tier with basic orchestration features

## 10.6 CTA

**CTA:** "Get Started Free --- setup in 10 minutes"

# 11. Página Individual: CauseFlow vs Rootly (/vs/rootly)

## 11.1 Hero

**Título:** "CauseFlow AI vs Rootly"

**Subtítulo:** "Deep investigation vs. rapid response"

## 11.2 Contexto

O Rootly é uma plataforma de incident management com AI SRE, com \$15.2M
em funding (Series A liderada por Renegade Partners e Google Gradient
Ventures). Foco em Slack-native incident response com AI para gerar
confidence scores e hipóteses.

## 11.3 Tabela Comparativa Detalhada

| **Feature** | **CauseFlow AI** | **Rootly** |
|---|---|---|
| Core function | AI investigation cross-tool + customer issues | Orchestration + AI SRE |
| Target | SMBs (2--50 engineers) | Mid-market to enterprise |
| Pricing | \$149/month (500 inv.) | \$20/user/month |
| Team of 10 cost | \$149/month | \$200/month |
| Customer issue resolution | ✓ | ✗ |
| Knowledge Base | ✓ | ✗ |
| DB + CRM integration | ✓ | ✗ |
| Retrospectives | Roadmap | ✓ |
| MCP server | ✓ MCP + proprietary | ✓ TypeScript (open-source) |
| SOC 2 | Roadmap | ✓ Type II |

## 11.4 Where CauseFlow is better

- Cross-tool investigation crossing technical data with CRM
- Customer issue resolution (Rootly doesn't have it)
- Knowledge Base for recurring problems
- Database integration (PostgreSQL/MySQL)
- Competitive price: \$149/month vs. \$200/month (10 users x \$20) but with AI investigation included

## 11.5 Where Rootly is more mature

- SOC 2 Type II certified
- Startup program with flexible pricing for teams \< 25
- MCP server in TypeScript (open-source)
- Automated retrospectives and post-mortems

## 11.6 CTA

**CTA:** "Get Started Free --- setup in 10 minutes"

# 12. Página Individual: CauseFlow vs IncidentFox (/vs/incidentfox)

## 12.1 Hero

**Título:** "CauseFlow AI vs IncidentFox"

**Subtítulo:** "Managed SaaS with customer context vs. open-core SRE agent"

## 12.2 Contexto

IncidentFox é um AI SRE agent open-core (Apache-2.0) que faz triage,
coordena e corrige incidentes de produção. Fundado em 2025 por Jimmy Wei
e Long Yi, é parte do batch YC W26. Foco em Slack-native workflow com
análise automatizada de codebase e histórico de incidentes passados.
Abordagem open-core permite self-hosting com containers isolados e
proxy seguro para credenciais.

## 12.3 Tabela Comparativa Detalhada

| **Feature** | **CauseFlow AI** | **IncidentFox** |
|---|---|---|
| Core function | AI investigation cross-tool + customer issues | AI SRE triage + fix scripts |
| Target | SMBs (2--50 engineers) | Startups (Slack-native teams) |
| Pricing | \$0--\$399/month (SaaS usage-based) | Open-core (self-host free, cloud TBD) |
| Deployment | Managed SaaS (AWS) | Self-hosted or cloud |
| Customer issue resolution | ✓ Unique differentiator | ✗ |
| CRM integration (HubSpot) | ✓ | ✗ |
| DB integration | ✓ PostgreSQL/MySQL | ✗ |
| Knowledge Base | ✓ Evolving graph | ✗ (uses OpenRAG for retrieval) |
| MCP server | ✓ MCP + proprietary core | ✗ (Python native) |
| Open source | ✗ | ✓ Apache-2.0 |
| Slack-native | ✓ (one of many entry points) | ✓ (primary interface) |
| Setup approach | OAuth/API key, \< 10 min | Auto-analyzes codebase + Slack history |
| Audit trail | ✓ Immutable S3 Object Lock | ✓ Transparent (open-core) |
| SOC 2 | Roadmap | ✗ (early-stage) |
| Maturity | MVP in production | Early-stage (YC W26) |

## 12.4 Where CauseFlow is better

- Customer issue resolution: investigates customer-reported problems, not just infra alerts
- CRM integration (HubSpot) bridges technical + business context
- Database integration for data validation (PostgreSQL/MySQL)
- Knowledge Base that learns and improves over time
- Managed SaaS: no infrastructure to maintain, built-in compliance (LGPD/GDPR)
- Multiple entry points: Slack, Jira, Web, API, MCP --- not just Slack
- Usage-based pricing with clear tiers vs. undefined pricing model

## 12.5 Where IncidentFox is different

- Open-core (Apache-2.0): full source code visibility and self-hosting option
- Auto-setup: analyzes codebase and Slack history to understand the stack automatically
- Sandbox isolation: each investigation in isolated container with ephemeral filesystem
- YC-backed with potential for rapid growth
- No vendor lock-in for self-hosted deployments

## 12.6 CTA

**CTA:** "Get Started Free --- setup in 10 minutes"

# 13. Página Sobre Nós (/about)

## 13.1 Hero

**Título:** "Engineers solving problems for engineers"

**Missão:** "We believe investigating production problems shouldn't consume hours of your team's time. CauseFlow exists so engineers can focus on building, not firefighting."

## 13.2 Seção Founders

2 cards com foto, nome, papel e background:

| **Role** | **Background** | **Responsibility** |
|---|---|---|
| Founder / CEO | Engineering Manager leading multiple squads, experience in infra, observability and DORA metrics. | Product, operations, GTM, financial management |
| Co-founder / CTO | AI Agent development specialist. | Architecture, core development, LLM integrations |

## 13.3 What Sets Us Apart

3 cards de valores:

- **MVP in real production:** CauseFlow is already running in a real production environment. It's not vaporware.

- **Bootstrap with 90% margins:** No investor dependency. Variable costs of \$0.006--\$0.09 per investigation enable sustainable growth.

- **Uncontested category:** Bridge between SRE investigation and customer issue resolution --- a gap no competitor addresses.

## 13.4 Future Vision

Timeline do roadmap:

| **Period** | **Product** | **Business** |
|---|---|---|
| Month 1 | Commercial MVP: Slack + GitHub + Jira + Web + customer issues + automatic PRs | First 5 customers |
| Month 2--3 | New integrations (CloudWatch, Trello, Linear, DBs) via MCP | 20 customers |
| Month 4--6 | Knowledge Base, dashboard, proactive alerts, PII Gateway | \$10K MRR |
| Month 7--12 | Semi-autonomous remediation, CI/CD integration | \$40K MRR |
| Year 2 | Auto-healing, integration marketplace, autonomous L1 resolution | \$200K MRR |

# 14. Página Get Started (/get-started)

Página com 2 colunas: formulário à esquerda, benefícios à direita.

## 14.1 Formulário

**Título:** "Start investigating in minutes"

**Subtítulo:** "Create your free account. 5 investigations per month, all integrations. No credit card."

**Campos do formulário:**

- Full name
- Work email
- Company name
- Team size (dropdown: 1--5, 6--20, 21--50, 50+)
- Button: "Create Free Account"

Opção de login social: "Sign in with Google" / "Sign in with GitHub"

## 14.2 Benefits

Lista com checkmarks:

- 5 free investigations per month
- All integrations available
- Setup in under 10 minutes
- No credit card required
- Complete audit trail
- LGPD and GDPR compliant

## 14.3 Alternative Section

**Text:** "Need help evaluating? Schedule a personalized 15-minute demo."

**CTA:** "Schedule Demo" --- link para Calendly/Cal.com

# 15. Stack Técnica do Website

| **Layer** | **Technology** | **Justification** |
|---|---|---|
| Framework | Next.js Latest (App Router) | SSG for performance, React for components, used by resolve.ai and incident.io |
| Styling | Tailwind CSS + Shadcn | Utility-first, fast to iterate, industry standard |
| Hosting | SST on AWS | Automatic deploy, global CDN, SSL included |
| Analytics | Google Analytics 4 + Hotjar | Traffic + heatmaps/recordings |
| Forms | Formspree or Supabase | No custom backend for MVP |
| Interactive demo | Navattic, Storylane or Arcade | No competitor has this --- first-mover advantage |
| i18n | next-intl or next-i18next | EN as default, PT-BR as secondary language |
| Domain | causeflow.ai | Purchased |

## 15.1 Performance

- Target LCP (Largest Contentful Paint): \< 2 seconds

- Target CLS (Cumulative Layout Shift): \< 0.1

- Images: WebP with fallback, lazy loading

- Fonts: preload most used variants

- JS bundle: \< 200KB gzipped

# 16. Páginas Legais

## 16.1 Privacy Policy (/privacy)

Página com texto jurídico cobrindo:

- Data collected: email, name, company, platform usage data
- How we use data: service operation, communication, analytics
- Customer data (processed during investigations): read on demand, discarded after analysis, never used for training
- Sharing: only with infra providers (AWS Bedrock) under strict terms
- Retention: account data until deletion. Audit trails per contracted period.
- LGPD rights: access, correction, deletion, portability. Deadline: 15 days.
- GDPR rights: same + right to objection, review of automated decisions (Art. 22)
- International transfers: Standard Contractual Clauses
- DPO / data controller contact

## 16.2 Terms of Service (/terms)

Página com termos cobrindo:

- Service definition and limitations
- Plans, pricing and billing policy
- Intellectual property (CauseFlow owns the platform, customer owns their data)
- SLA (when applicable for Business/Enterprise plans)
- Limitation of liability
- Cancellation and refund policy
- Acceptable use (prohibition of malicious use)
- Jurisdiction and venue

*Both pages must be reviewed by a lawyer before launch.*

# 17. Checklist de Lançamento

Tudo que precisa estar pronto antes de ir ao ar:

## 17.1 Páginas (Mínimo Viável)

- □ Homepage completa com todas as 8 seções
- □ Página de Product com workflow, audit trail e modos de uso
- □ Página de Security com 6 compromissos + compliance + arquitetura
- □ Página de Integrations com catálogo e princípios
- □ Página de Pricing com tabela, comparação e calculadora de ROI
- □ Página de Compare (hub) com tabela geral
- □ Página individual: CauseFlow vs resolve.ai
- □ Página individual: CauseFlow vs incident.io
- □ Página individual: CauseFlow vs Rootly
- □ Página individual: CauseFlow vs IncidentFox
- □ Página About com founders e roadmap
- □ Página Get Started funcional com formulário
- □ Privacy Policy e Terms of Service
- □ Todas as páginas responsivas (mobile-first)
- □ i18n: versão EN (default) + PT-BR

## 17.2 Trust Signals

- □ Seção de Security na homepage
- □ Badges de LGPD/GDPR compliance
- □ Exemplo visual do audit trail (com animação)
- □ Screenshot ou vídeo demo do produto
- □ Logos das tecnologias suportadas

## 17.3 Técnico

- □ SSL/HTTPS configurado
- □ Google Analytics 4 instalado
- □ SEO básico: meta tags, sitemap.xml, robots.txt
- □ Open Graph + Twitter Cards para cada página
- □ hreflang tags para EN/PT-BR
- □ Performance: LCP \< 2s, CLS \< 0.1
- □ Acessibilidade básica (alt texts, contraste, keyboard nav)
- □ Google Search Console configurado

## 17.4 Conteúdo

- □ Todos os textos em inglês (idioma padrão) revisados
- □ Todos os textos em PT-BR traduzidos e revisados
- □ Screenshots reais do produto (ou mockups de alta fidelidade)
- □ Vídeo demo de 60 segundos gravado
- □ Ícones e ilustrações consistentes

## 17.5 Próximos Passos (V2 do Site)

- Blog com conteúdo técnico e thought leadership
- Página de Case Studies / Clientes
- Documentação / API Reference (docs.causeflow.ai)
- Glossário para SEO long-tail
- Página de migração Opsgenie (/migrate/opsgenie)
- Carreiras
- Newsletter signup

# 18. Regras de Desenvolvimento (Instruções para Agentes)

Este documento serve como instrução para agentes AI que irão implementar o
website. As regras abaixo devem ser seguidas rigorosamente.

## 18.1 Arquitetura do Projeto

**Monorepo por contexto:** O projeto utiliza uma arquitetura de monorepo
onde os módulos são divididos por contexto de domínio, com um pacote shared
entre eles.

Estrutura esperada:

```
causeflow-website/
├── packages/
│   ├── shared/             # Tipos, utils, constantes, i18n keys compartilhados
│   ├── ui/                 # Componentes de UI reutilizáveis (design system)
│   ├── web/                # Next.js app (pages, routes, layouts)
│   ├── analytics/          # Google Analytics, Hotjar, tracking events
│   └── forms/              # Lógica de formulários e validação
├── package.json            # Workspace root
└── tsconfig.base.json      # TypeScript base config
```

**Clean Architecture:** Cada pacote segue Clean Architecture com separação
clara de camadas:

- **Domain:** Entidades, interfaces, tipos de negócio
- **Application:** Use cases, services, DTOs
- **Infrastructure:** Implementações concretas, APIs, adapters
- **Presentation:** Componentes React, hooks, pages

## 18.2 TDD (Test-Driven Development)

Seguir rigorosamente a ordem:

1. **Testes unitários PRIMEIRO:** Escrever testes unitários antes de implementar qualquer componente ou função. Red → Green → Refactor.

2. **Testes de integração DEPOIS:** Após a implementação dos componentes, escrever testes de integração que verificam a interação entre módulos.

3. **Testes de fluxo (E2E) POR ÚLTIMO:** Após integração, escrever testes de fluxo que simulam o comportamento do usuário end-to-end.

4. **Rodar testes após cada implementação:** Após finalizar cada feature/página, rodar TODOS os testes para verificar se algo quebrou. Corrigir imediatamente qualquer falha.

## 18.3 Mobile First

Implementar sempre seguindo a ordem de resoluções:

1. **Mobile (< 640px)** --- implementar primeiro
2. **Tablet (640px--1024px)** --- ampliar
3. **Desktop (1024px--1280px)** --- ampliar
4. **Wide Desktop (> 1280px)** --- ampliar

Nunca implementar desktop primeiro e depois adaptar para mobile.

## 18.4 Code Review Automatizado

Após a finalização de cada implementação, rodar um review para:

- Verificar se o código está limpo e performático
- Remover componentes que não são mais utilizados
- Verificar imports não utilizados
- Garantir que não há código duplicado
- Verificar se os nomes de variáveis/funções são descritivos
- Remover console.logs e código de debug

## 18.5 Checklist de Implementação

Para CADA página ou feature, criar uma checklist de tarefas no planejamento
e atualizar conforme resolver os itens. Formato:

```
## [Nome da Página/Feature]
- [ ] Escrever testes unitários
- [ ] Implementar componentes (mobile first)
- [ ] Ampliar para tablet
- [ ] Ampliar para desktop
- [ ] Escrever testes de integração
- [ ] Escrever testes E2E
- [ ] Rodar todos os testes
- [ ] Review de código (limpo + performático)
- [ ] Verificar segurança
- [ ] Verificar performance
- [ ] Remover componentes não utilizados
```

## 18.6 Segurança

Verificar após CADA implementação:

- Sanitização de inputs em formulários (XSS prevention)
- CSP (Content Security Policy) headers
- Não expor dados sensíveis no client-side
- HTTPS enforced
- Dependências sem vulnerabilidades conhecidas (npm audit)
- Rate limiting em endpoints de formulário
- CORS configurado corretamente
- Tokens e API keys nunca expostos no código frontend

## 18.7 Performance

Verificar após CADA implementação:

- LCP \< 2 segundos
- CLS \< 0.1
- FID/INP \< 200ms
- Imagens otimizadas (WebP, lazy loading, dimensões corretas)
- Fontes com preload e font-display: swap
- Bundle size dentro do limite (\< 200KB gzipped)
- Sem re-renders desnecessários
- Componentes com lazy loading onde aplicável
- Static generation (SSG) para todas as páginas de conteúdo

## 18.8 Uso de Agentes

Utilizar agentes sempre que possível para:

- Pesquisa de dependências e bibliotecas
- Geração de boilerplate
- Execução paralela de tarefas independentes
- Code review automatizado
- Verificação de acessibilidade
- Auditoria de performance (Lighthouse)
- Verificação de segurança (npm audit, headers)

**--- Fim do Documento --- CauseFlow AI Website Blueprint v3.0**
