import { useState } from "react";

const tabs = [
  { id: "insight", label: "O Insight", icon: "💡" },
  { id: "arch", label: "Arquitetura", icon: "🏗️" },
  { id: "security", label: "Segurança", icon: "🔐" },
  { id: "agent", label: "Code Analyzer Agent", icon: "🤖" },
  { id: "examples", label: "Exemplos Reais", icon: "🔍" },
  { id: "impl", label: "Implementação", icon: "⚙️" },
];

const Code = ({ children, title }) => (
  <div className="bg-slate-950 border border-slate-800 text-green-400 rounded-lg p-4 font-mono text-xs overflow-x-auto leading-relaxed">
    {title && <div className="text-slate-600 mb-2">// {title}</div>}
    <pre>{children}</pre>
  </div>
);

export default function CodeKnowledgeBase() {
  const [activeTab, setActiveTab] = useState("insight");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
            <span className="text-amber-400">Code Knowledge Base</span>
            <span className="text-slate-500"> — Visão cross-repo segura para o AI Agent</span>
          </h1>
          <p className="text-slate-600 text-xs mt-1">Replicando o poder do "Claude Code na pasta raiz" em produção</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "text-slate-500 hover:text-slate-300 border border-transparent hover:border-slate-700"
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "insight" && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-6">
              <h2 className="text-amber-400 text-sm font-bold mb-4" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
                O Problema: Visão Isolada vs Visão Completa
              </h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                  <p className="text-red-400 text-xs font-bold mb-3">❌ SEM visão cross-repo (como nosso PRD estava)</p>
                  <Code title="Agent investiga incidente no checkout">{`
# Agent vê: logs do checkout-service
ERROR checkout.handler:45 
  Cannot read property 'price' of undefined

# Agent vê: CloudTrail
Deploy v2.3.4 at 14:00 by ci-bot

# Agent vê: métricas
Error rate: 0% → 12% at 14:05

# Diagnóstico: "Deploy causou o erro"
# Confiança: 70%
# 
# MAS NÃO SABE:
# - O QUE mudou no deploy
# - Se mudança foi no checkout ou em dependência
# - Se shared-lib foi atualizado
# - Se config do Terraform mudou
# - Qual PR, quem aprovou, o que o review disse`}</Code>
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
                  <p className="text-emerald-400 text-xs font-bold mb-3">✅ COM visão cross-repo (como você usa localmente)</p>
                  <Code title="Agent vê TODOS os repos do cliente">{`
# Agent vê: stack trace do Sentry
ERROR checkout.handler:45
  Cannot read property 'price' of undefined

# Agent busca: "quem mudou checkout.handler.ts?"
→ PR #847 por @dev, mergeado 14:00
→ Diff: removeu campo 'price' da query

# Agent busca: "checkout importa de onde?"
→ import { ProductClient } from '@acme/shared-sdk'
→ shared-sdk v2.1.0 → v2.2.0 no package.json

# Agent busca: "o que mudou no shared-sdk v2.2.0?"
→ PR #203: refatorou ProductResponse interface
→ campo 'price' renomeado para 'unitPrice'

# Agent busca: "quem mais usa shared-sdk?"
→ payment-service, inventory-service, analytics
→ "Esses serviços vão quebrar também!"

# Diagnóstico: "shared-sdk v2.2.0 renomeou
#  'price' → 'unitPrice'. checkout-service 
#  atualizou SDK mas não atualizou o handler."
# Confiança: 97%
# Fix: mudar linha 45 para 'unitPrice'
# Blast radius: payment + inventory também
# PR sugerido: [gerar automaticamente]`}</Code>
                </div>
              </div>

              <div className="mt-4 bg-slate-800/50 rounded-lg p-4">
                <p className="text-amber-400 text-xs font-bold mb-2">A diferença é gigante:</p>
                <div className="text-xs text-slate-300 space-y-1">
                  <p>Sem código: <span className="text-red-400">"algo no deploy causou erro"</span> — genérico, incompleto, 70% confiança</p>
                  <p>Com código isolado: <span className="text-amber-400">"PR #847 mudou checkout.handler"</span> — melhor, mas não vê a causa raiz no shared-sdk</p>
                  <p>Com visão cross-repo: <span className="text-emerald-400">"shared-sdk renomeou field, 4 serviços afetados, aqui está o fix para cada um"</span> — completo, 97% confiança</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "arch" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold mb-2" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
              Code Knowledge Base — Arquitetura
            </h2>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 overflow-x-auto">
              <pre className="text-xs leading-relaxed">{`
  `}<span className="text-amber-400">{`Modo local (como você usa):`}</span>{`
  
  ~/projects/
  ├── checkout-service/
  ├── payment-gateway/
  ├── shared-sdk/
  ├── infra-terraform/
  └── mobile-app/
  
  $ claude-code ~/projects/    ← Claude vê TUDO, em memória, temporário
  
  
  `}<span className="text-emerald-400">{`Modo produção (para clientes):`}</span>{`
  
  Dois mecanismos complementares:

  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                     │
  │  `}<span className="text-cyan-400">{`MECANISMO 1: API On-Demand (leitura sob demanda)`}</span>{`                 │
  │                                                                     │
  │  Agent precisa ler um arquivo?                                      │
  │  → Chama GitHub API / Azure Repos API em tempo real                │
  │  → Lê APENAS o que precisa para a investigação atual               │
  │  → Nada é armazenado permanentemente                               │
  │                                                                     │
  │  Orquestrador                                                       │
  │       │                                                             │
  │       │  "Preciso ver checkout.handler.ts"                          │
  │       ▼                                                             │
  │  ┌──────────────┐     GET /repos/acme/checkout/contents/            │
  │  │ Code Analyzer│────────────────────────────────────►  GitHub API  │
  │  │  Sub-Agent   │◄────────────────────────────────────  (read-only) │
  │  └──────────────┘     200 OK { content: base64(...) }               │
  │       │                                                             │
  │       │  "Quais repos importam @acme/shared-sdk?"                   │
  │       ▼                                                             │
  │  ┌──────────────┐     GET /search/code?q=@acme/shared-sdk          │
  │  │ Code Analyzer│────────────────────────────────────►  GitHub API  │
  │  │  Sub-Agent   │◄────────────────────────────────────  (read-only) │
  │  └──────────────┘     200 OK { items: [4 repos] }                   │
  │                                                                     │
  │  ✅ Zero storage: não clonamos nada                                 │
  │  ✅ Sempre atualizado: lê direto do source of truth                │
  │  ✅ Seguro: GitHub App com read-only scope                         │
  │  ⚠️  Limitação: search do GitHub pode ser lento para repos grandes │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘
  
  ┌─────────────────────────────────────────────────────────────────────┐
  │                                                                     │
  │  `}<span className="text-purple-400">{`MECANISMO 2: Code Index (visão cross-repo pré-computada)`}</span>{`         │
  │                                                                     │
  │  Periodicamente indexa a estrutura e dependências dos repos.        │
  │  NÃO armazena código fonte — apenas metadados e relacionamentos.   │
  │                                                                     │
  │  ┌──────────┐    webhook: push/PR merge                             │
  │  │ GitHub / │───────────────────────────────►  ┌─────────────────┐ │
  │  │ Az Repos │                                  │  Code Indexer   │ │
  │  └──────────┘                                  │  (Lambda/ECS)   │ │
  │                                                └────────┬────────┘ │
  │                                                         │          │
  │  O que indexa (metadados, NÃO código):                  ▼          │
  │  ┌──────────────────────────────────────────────────────────────┐  │
  │  │  `}<span className="text-amber-400">{`Code Knowledge Graph`}</span>{` (DynamoDB)                             │  │
  │  │                                                              │  │
  │  │  REPO#checkout-service                                       │  │
  │  │  ├── FILE_MAP: { src/handler.ts, src/client.ts, ... }      │  │
  │  │  ├── IMPORTS: @acme/shared-sdk@2.2.0, @acme/auth-lib@1.0   │  │
  │  │  ├── DEPLOYS_TO: ecs/checkout-cluster                       │  │
  │  │  ├── CI: github-actions/deploy.yml                          │  │
  │  │  ├── DOCKERFILE: node:20, port 3000                         │  │
  │  │  └── LAST_CHANGE: PR #847, 2h ago, @dev                    │  │
  │  │                                                              │  │
  │  │  PACKAGE#@acme/shared-sdk                                    │  │
  │  │  ├── CURRENT_VERSION: 2.2.0                                 │  │
  │  │  ├── USED_BY: [checkout, payment, inventory, analytics]     │  │
  │  │  ├── BREAKING_CHANGES: v2.2.0 renamed 'price' → 'unitPrice'│  │
  │  │  └── LAST_CHANGE: PR #203, 3d ago, @senior-dev             │  │
  │  │                                                              │  │
  │  │  SERVICE_MAP#checkout → payment-gateway                      │  │
  │  │  SERVICE_MAP#checkout → shared-sdk                           │  │
  │  │  SERVICE_MAP#payment  → shared-sdk                           │  │
  │  └──────────────────────────────────────────────────────────────┘  │
  │                                                                     │
  │  ✅ Busca instantânea: "quem usa shared-sdk?" → ms, não segundos  │
  │  ✅ Dependency graph completo sem ler código                       │
  │  ✅ Não armazena código fonte — só metadados                       │
  │  ✅ Atualiza via webhook (push/PR) — sempre fresco                 │
  │  ✅ Alimenta o Knowledge Graph que já temos (mesma tabela DynamoDB)│
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘
  
  
  `}<span className="text-emerald-400">{`Na investigação, os dois mecanismos trabalham juntos:`}</span>{`
  
  1. Incidente no checkout-service
  2. Agent consulta Code Index: "checkout depende de quem?" → instantâneo
     → shared-sdk@2.2.0, auth-lib@1.0, payment-gateway
  3. Agent consulta Code Index: "o que mudou no shared-sdk recentemente?"
     → PR #203 renomeou 'price' → 'unitPrice' (3 dias atrás)
  4. Agent chama GitHub API on-demand: "mostra o diff do PR #203"
     → Lê o diff específico, vê a mudança exata
  5. Agent chama GitHub API on-demand: "mostra checkout.handler.ts:45"
     → Lê a linha que crashou, confirma que usa 'price' (antigo)
  6. Agent consulta Code Index: "quem mais usa shared-sdk?"
     → payment, inventory, analytics → blast radius
  7. Diagnóstico completo com evidência no código`}</pre>
            </div>
          </div>
        )}

        {activeTab === "security" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold mb-2" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
              Segurança: Como acessar código do cliente sem risco
            </h2>

            <div className="bg-slate-900 border border-red-500/30 rounded-xl p-5">
              <h3 className="text-red-400 text-xs font-bold mb-3">PRINCÍPIOS INVIOLÁVEIS</h3>
              <div className="space-y-2 text-xs text-slate-300">
                <p><span className="text-red-400 font-bold">1.</span> <strong>NUNCA clonamos repositórios inteiros.</strong> Lemos arquivos específicos on-demand via API. É como ver uma página de um livro sem copiar o livro inteiro.</p>
                <p><span className="text-red-400 font-bold">2.</span> <strong>NUNCA armazenamos código fonte.</strong> O Code Index guarda metadados (imports, deps, file paths) — não o código em si. Código é lido em tempo real da API e descartado após a investigação.</p>
                <p><span className="text-red-400 font-bold">3.</span> <strong>NUNCA misturamos código entre tenants.</strong> GitHub App/Token é por tenant, isolado. Tenant A não pode ver repos do Tenant B.</p>
                <p><span className="text-red-400 font-bold">4.</span> <strong>Código NUNCA é usado para treinar modelos.</strong> É input de uma investigação específica. Vai no contexto do Claude como prompt, não como training data. Anthropic não treina com inputs de API.</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-slate-200 text-xs font-bold mb-3">MECANISMO DE ACESSO POR PROVIDER</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-orange-400 text-xs font-bold mb-2">GitHub (Cliente 1)</p>
                  <Code title="GitHub App — Instalação por Organização">{`
# Cliente instala nossa GitHub App na org dele
# Escopo MÍNIMO:

permissions:
  contents: read        # Ler arquivos e diffs
  pull_requests: read   # Ver PRs e reviews
  metadata: read        # Listar repos
  # Nenhuma permissão de write

# O que NÃO pedimos:
  # ❌ write (não alteramos nada)
  # ❌ admin (não gerenciamos repos)
  # ❌ webhooks:write (só read)
  # ❌ secrets (nunca)
  # ❌ actions:write (não rodamos CI)

# Autenticação:
# GitHub App gera JWT → Installation Token
# Token expira em 1h, renovado automaticamente
# Escopo limitado aos repos que cliente autorizou
# Cliente pode revogar a qualquer momento

# Rate limits:
# 5000 requests/hora por installation
# Suficiente para investigações paralelas`}</Code>
                </div>

                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-blue-400 text-xs font-bold mb-2">Azure Repos (Cliente 2)</p>
                  <Code title="Azure DevOps — Service Connection">{`
# Opção A: PAT (Personal Access Token)
#   Scope: Code (Read)
#   Gerado pelo admin do cliente
#   Armazenado no Vault (criptografado)

# Opção B: Service Principal (recomendado)
#   Via Entra ID (antigo Azure AD)
#   Scope: vso.code (read-only)
#   Sem token estático — OAuth2 flow

# O que NÃO pedimos:
  # ❌ vso.code_write
  # ❌ vso.build_execute
  # ❌ vso.release_manage
  # ❌ Nenhum write de qualquer tipo

# Azure DevOps API:
# GET /org/project/_apis/git/repositories
# GET /org/project/_apis/git/repositories/
#     {repo}/items?path=/src/handler.ts
# GET /org/project/_apis/git/repositories/
#     {repo}/diffs/commits
# GET /org/project/_apis/git/pullrequests`}</Code>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-slate-200 text-xs font-bold mb-3">CICLO DE VIDA DO CÓDIGO NA INVESTIGAÇÃO</h3>
              <Code title="O que acontece com o código durante uma investigação">{`
Incidente → Agent precisa ver código
     │
     ▼
┌─────────────────────────────────────────────────────────┐
│ 1. BUSCA NO INDEX (DynamoDB)                            │
│    "Quais repos afetados? Quais deps?"                  │
│    → Retorna METADADOS, não código                      │
│    → PK=TENANT#t1|REPO#checkout  SK=IMPORTS             │
│    → { "@acme/shared-sdk": "2.2.0" }                   │
│    Armazenado? SIM (são só metadados, não código)       │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 2. LEITURA ON-DEMAND (GitHub/Azure API)                 │
│    "Mostra src/checkout.handler.ts linhas 40-50"        │
│    → GET /repos/acme/checkout/contents/src/handler.ts   │
│    → Recebe conteúdo do arquivo                         │
│    Armazenado? NÃO. Vai direto pro contexto do Claude.  │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 3. CONTEXTO DO CLAUDE (prompt da investigação)          │
│    "Aqui está o código que crashou: [trecho]"           │
│    "Aqui está o diff do PR #847: [diff]"                │
│    → Claude analisa, gera hipótese                      │
│    Armazenado? NÃO pelo Claude (Anthropic API policy).  │
│    O trecho aparece no trace do Langfuse como input,    │
│    mas Langfuse é self-hosted na NOSSA infra.           │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ 4. RESULTADO DA INVESTIGAÇÃO                            │
│    "Root cause: PR #847 usou campo 'price' que foi      │
│     renomeado para 'unitPrice' no shared-sdk v2.2.0"   │
│    Armazenado? SIM — mas é o DIAGNÓSTICO, não código.   │
│    O que salvamos: texto da hipótese + confidence.       │
│    O que NÃO salvamos: código fonte, diffs, conteúdo.   │
└─────────────────────────────────────────────────────────┘

Resumo:
  Metadados (imports, deps, file paths): ✅ Indexados no DynamoDB
  Código fonte lido durante investigação: ❌ Transiente, descartado
  Código no contexto do Claude: ❌ Não retido (API policy Anthropic)
  Diagnóstico e evidências textuais: ✅ Salvos (sem código inline)`}</Code>
            </div>

            <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-5">
              <h3 className="text-emerald-400 text-xs font-bold mb-3">CONTROLE DO CLIENTE</h3>
              <div className="grid grid-cols-3 gap-3 text-xs text-slate-300">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-emerald-400 font-bold mb-1">Escopo granular</p>
                  <p>Cliente escolhe QUAIS repos o agent pode acessar. Não é "todos ou nenhum" — é lista explicit de repos autorizados.</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-emerald-400 font-bold mb-1">Revogação instantânea</p>
                  <p>Desinstalar GitHub App ou revogar Service Principal = acesso cortado imediatamente. Sem residual.</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-emerald-400 font-bold mb-1">Audit trail</p>
                  <p>Cada leitura de arquivo logada: qual agent, qual investigação, qual arquivo, quando. Auditável pelo cliente.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "agent" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold mb-2" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
              Code Analyzer — 5º Sub-Agente
            </h2>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <p className="text-amber-400 text-xs font-bold mb-3">ANTES: 4 SUB-AGENTES → AGORA: 5 SUB-AGENTES</p>
              <Code title="Sub-agentes atualizados">{`
Orchestrator (recebe incidente, coordena investigação)
│
├── Log Analyzer        → CloudWatch / Azure Monitor / Sentry
│                         "O que os logs dizem?"
│
├── Infra Inspector     → EC2/ECS/Lambda/DynamoDB / Azure VMs/AKS
│                         "Qual o estado da infra?"
│
├── Change Detector     → CloudTrail / Activity Log / Consul
│                         "Quem mudou o quê, quando?"
│
├── `}<span className="text-amber-400">{`Code Analyzer`}</span>{`        → `}<span className="text-amber-400">{`GitHub / Azure Repos + Code Index`}</span>{`
│   `}<span className="text-amber-400">{`(NOVO)`}</span>{`                 `}<span className="text-amber-400">{`"O QUE EXATAMENTE mudou no código?"`}</span>{`
│                         `}<span className="text-amber-400">{`"Quem depende disso?"`}</span>{`
│                         `}<span className="text-amber-400">{`"Qual o blast radius?"`}</span>{`
│
└── Runbook Executor    → Ações (após approval gate)
                          "Executa o fix"`}</Code>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-slate-200 text-xs font-bold mb-3">TOOLS DO CODE ANALYZER</h3>
              <Code title="src/modules/investigation/agents/code-analyzer/tools.ts">{`
const codeAnalyzerTools = [

  // ─── BUSCA NO INDEX (instantâneo, metadados) ───

  {
    name: "code_get_service_dependencies",
    description: "Get all dependencies of a service (packages, imports, internal libs)",
    params: { serviceName: "string" },
    // → { imports: ["@acme/shared-sdk@2.2.0", "pg@8.11"], 
    //     internalDeps: ["auth-lib", "config-core"],
    //     deployTarget: "ecs/checkout-cluster" }
    // Fonte: Code Index (DynamoDB), sem API call
  },

  {
    name: "code_find_dependents",
    description: "Find all services that depend on a package or internal lib",
    params: { packageName: "string" },
    // → { dependents: ["checkout", "payment", "inventory", "analytics"],
    //     versions: { "checkout": "2.2.0", "payment": "2.1.0" } }
    // CRUCIAL: identifica blast radius cross-repo
  },

  {
    name: "code_get_recent_changes",
    description: "Recent PRs/commits in a repo or across all repos",
    params: { repoName?: "string", hoursAgo?: "number" },
    // → [{ repo: "shared-sdk", pr: 203, title: "Refactor ProductResponse",
    //       author: "@senior-dev", merged: "3d ago", 
    //       filesChanged: ["src/types.ts", "src/client.ts"] }]
    // Fonte: Code Index (atualizado via webhook)
  },

  {
    name: "code_get_service_map",
    description: "Complete map of services, their repos, deploy targets, and relationships",
    params: {},
    // → Grafo completo: repo → serviço → deploy target → dependências
    // Alimenta o Knowledge Graph
  },

  // ─── LEITURA ON-DEMAND (GitHub/Azure API, tempo real) ───

  {
    name: "code_read_file",
    description: "Read a specific file from a repo (or specific lines)",
    params: { repo: "string", path: "string", startLine?: "number", endLine?: "number" },
    // → Conteúdo do arquivo (ou trecho)
    // Uso: ler o código exato que crashou (stack trace → file:line)
  },

  {
    name: "code_get_pr_diff",
    description: "Get the full diff of a Pull Request",
    params: { repo: "string", prNumber: "number" },
    // → Diff completo: arquivos alterados, linhas adicionadas/removidas
    // Uso: ver EXATAMENTE o que um PR mudou
  },

  {
    name: "code_get_pr_details",
    description: "Get PR metadata: title, description, reviews, checks, author",
    params: { repo: "string", prNumber: "number" },
    // → { title, body, author, reviewers, status, checks, mergedAt }
    // Uso: contexto humano (por que a mudança foi feita?)
  },

  {
    name: "code_search_across_repos",
    description: "Search for a string/pattern across all authorized repos",
    params: { query: "string", fileExtension?: "string" },
    // → GitHub Code Search API / Azure Search
    // Uso: "quem mais usa essa função que quebrou?"
  },

  {
    name: "code_get_commit_history",
    description: "Get commit history for a specific file",
    params: { repo: "string", path: "string", limit?: "number" },
    // → [{ sha, message, author, date }]
    // Uso: "quando essa linha foi modificada pela última vez?"
  },

  {
    name: "code_read_ci_config",
    description: "Read CI/CD configuration (GitHub Actions / Azure Pipelines)",
    params: { repo: "string" },
    // → Conteúdo de .github/workflows/*.yml ou azure-pipelines.yml
    // Uso: "como esse serviço é deployado? Tem canary? Tem rollback?"
  },

  // ─── AÇÃO (pós-approval) ───

  {
    name: "code_generate_fix_pr",
    description: "Generate a PR with the suggested fix (REQUIRES APPROVAL)",
    params: { repo: "string", branch: "string", changes: "FileChange[]", title: "string" },
    // → Cria branch, commita mudanças, abre PR
    // NUNCA executado sem approval gate humano
    // Requer scope adicional: contents:write (só ativado se cliente autorizar)
  },
];`}</Code>
            </div>

            <div className="bg-slate-900 border border-purple-500/30 rounded-xl p-5">
              <h3 className="text-purple-400 text-xs font-bold mb-3">CORRELAÇÃO: SENTRY + GIT + CLOUDTRAIL = 97% CONFIANÇA</h3>
              <Code title="Como os 5 sub-agentes colaboram">{`
Incidente: "checkout retornando 500"

Log Analyzer:
  "847 erros 500 nos últimos 30min em checkout-service"
  "Exception: TypeError at checkout.handler.ts:45"

Infra Inspector:
  "checkout-service: 3 tasks healthy, CPU 12%, memory 45%"
  "Infra normal — não é resource exhaustion"

Change Detector (CloudTrail):
  "Deploy de checkout-service v2.3.4 às 14:00 via CodeDeploy"
  "Nenhuma outra mudança de infra"

`}<span className="text-amber-400">{`Code Analyzer (NOVO — transforma a investigação):`}</span>{`
  1. "PR #847 mergeado às 13:55 por @dev"
  2. "Diff mostra: package.json changed @acme/shared-sdk 2.1.0 → 2.2.0"
  3. "shared-sdk PR #203 (3 dias atrás): renomeou 'price' → 'unitPrice'"
  4. "checkout.handler.ts:45 ainda usa 'product.price' (campo antigo)"
  5. "Outros afetados: payment-service (usa 2.1.0 — safe por agora)"
     "                 inventory-service (usa 2.2.0 — VAI QUEBRAR)"
  6. "Sugestão de fix: trocar 'product.price' → 'product.unitPrice'"
  7. [Pode gerar PR com o fix se aprovado]

Sentry (via Relay):
  Stack trace confirma: crash em checkout.handler.ts:45
  Breadcrumbs: POST /checkout → query products → product.price → undefined

Synthesis (Opus):
  "Root cause: PR #847 atualizou shared-sdk para v2.2.0 que renomeou
   'price' para 'unitPrice'. checkout.handler.ts:45 não foi atualizado.
   
   Confiança: 97%
   Evidências: stack trace + diff do PR + changelog do shared-sdk
   
   Blast radius: inventory-service também usa v2.2.0 e terá o mesmo
   problema quando acessar o campo 'price'. Requer fix preventivo.
   
   Ações sugeridas:
   1. [URGENTE] Fix checkout: product.price → product.unitPrice (PR ready)
   2. [PREVENTIVO] Fix inventory: mesmo fix (PR ready)
   3. [OPCIONAL] Rollback checkout para v2.3.3 como medida temporária"`}</Code>
            </div>
          </div>
        )}

        {activeTab === "examples" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold mb-2" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
              Cenários onde Code Analyzer faz diferença decisiva
            </h2>

            {[
              {
                title: "Dependency breaking change (cross-repo)",
                color: "border-red-500/30",
                without: "Agent sabe que houve deploy, correlaciona por tempo. Diagnóstico: 'provavelmente o deploy'. Confiança: 65%.",
                with: "Agent vê o diff, identifica que shared-lib renomeou campo, encontra 3 outros serviços afetados, sugere fix + fix preventivo. Confiança: 97%.",
              },
              {
                title: "Config change via IaC (Terraform/CDK)",
                color: "border-amber-500/30",
                without: "CloudTrail mostra 'UpdateStack'. Agent não sabe o que mudou na stack.",
                with: "Agent lê diff do commit no infra-terraform/: 'timeout mudou de 30s para 5s no ALB'. Correlaciona com timeout errors nos logs. Confiança: 94%.",
              },
              {
                title: "Environment variable changed",
                color: "border-blue-500/30",
                without: "Logs mostram 'connection refused to database'. Agent suspeita de infra. Investiga rede, security groups — perde tempo.",
                with: "Agent vê PR recente que mudou DATABASE_URL no .env.production para novo endpoint. Confirma que novo endpoint não está acessível da VPC. Confiança: 91%.",
              },
              {
                title: "Dockerfile change broke build",
                color: "border-purple-500/30",
                without: "Deploy falhou. CloudTrail diz 'UpdateService FAILED'. Agent não sabe por quê.",
                with: "Agent lê Dockerfile: base image mudou de node:20 para node:22. Lê CI logs: 'node-canvas requires node <= 20'. Aponta fix: reverter base image. Confiança: 96%.",
              },
              {
                title: "Feature flag + code interaction",
                color: "border-emerald-500/30",
                without: "Erro intermitente em 10% dos requests. Agent não encontra causa nos logs — parece aleatório.",
                with: "Agent busca no código: if (featureFlags.newCheckout). Consulta Consul KV: flag habilitada para 10% dos usuários. Lê diff do PR #912: novo checkout tem bug no cálculo de frete. Confiança: 88%.",
              },
            ].map((scenario, i) => (
              <div key={i} className={`bg-slate-900 border ${scenario.color} rounded-xl p-5`}>
                <h3 className="text-slate-200 text-sm font-bold mb-3">{i+1}. {scenario.title}</h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-red-500/5 rounded-lg p-3">
                    <p className="text-red-400 font-bold mb-1">Sem código:</p>
                    <p className="text-slate-400">{scenario.without}</p>
                  </div>
                  <div className="bg-emerald-500/5 rounded-lg p-3">
                    <p className="text-emerald-400 font-bold mb-1">Com Code Analyzer:</p>
                    <p className="text-slate-400">{scenario.with}</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-5">
              <h3 className="text-amber-400 text-xs font-bold mb-2">IMPACTO NA ACURÁCIA ESTIMADA</h3>
              <div className="grid grid-cols-3 gap-4 text-center text-xs">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-3xl font-bold text-red-400">~65%</p>
                  <p className="text-slate-500 mt-1">Sem código<br/>(só logs + métricas + deploys)</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-3xl font-bold text-amber-400">~80%</p>
                  <p className="text-slate-500 mt-1">Com código isolado<br/>(só o repo do serviço afetado)</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-3xl font-bold text-emerald-400">~92%</p>
                  <p className="text-slate-500 mt-1">Com visão cross-repo<br/>(Code Index + on-demand)</p>
                </div>
              </div>
              <p className="text-slate-500 text-xs mt-3 text-center">
                A visão cross-repo é o que faz a Resolve.ai conseguir apontar "o PR exato que introduziu o bug".
                É o diferenciador #1 de qualidade de diagnóstico.
              </p>
            </div>
          </div>
        )}

        {activeTab === "impl" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold mb-2" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
              Implementação: O que adicionar ao PRD
            </h2>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-slate-200 text-xs font-bold mb-3">NOVOS COMPONENTES</h3>
              <Code title="Adições à estrutura do projeto">{`
src/
├── modules/
│   ├── knowledge/
│   │   ├── sources/
│   │   │   ├── consul-sync.ts             # Já temos (ADR-010)
│   │   │   ├── github-indexer.ts           # 🆕 Indexa repos GitHub
│   │   │   └── azure-repos-indexer.ts      # 🆕 Indexa repos Azure DevOps
│   │   └── entities/
│   │       ├── service-node.ts             # Já temos
│   │       ├── dependency-edge.ts          # Já temos
│   │       ├── repo-node.ts               # 🆕 Repo metadata + imports
│   │       └── package-node.ts            # 🆕 Shared lib tracking
│   │
│   ├── investigation/
│   │   ├── agents/
│   │   │   ├── log-analyzer/              # Já temos
│   │   │   ├── infra-inspector/           # Já temos
│   │   │   ├── change-detector/           # Já temos
│   │   │   ├── code-analyzer/             # 🆕 5º sub-agente
│   │   │   │   ├── tools.ts              # 🆕 12 tools (index + on-demand)
│   │   │   │   ├── system-prompt.ts       # 🆕 Instruções especializadas
│   │   │   │   └── context-builder.ts     # 🆕 Monta contexto de código
│   │   │   └── runbook-executor/          # Já temos
│
├── infra/
│   ├── git/
│   │   ├── github-client.ts               # 🆕 GitHub App API client
│   │   ├── azure-repos-client.ts          # 🆕 Azure DevOps API client
│   │   └── git-provider.ts               # 🆕 Port (interface comum)
│   │
│   ├── relay/                             # Já temos (ADR-010)
│   ├── sentry/                            # Já temos (ADR-010)
│   └── consul/                            # Já temos (ADR-010)`}</Code>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-slate-200 text-xs font-bold mb-3">SPRINT ALLOCATION</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-3 py-2 text-left text-slate-400">Sprint</th>
                      <th className="px-3 py-2 text-left text-slate-400">Componente</th>
                      <th className="px-3 py-2 text-center text-slate-400">Dias</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {[
                      ["1-2", "GitHub App setup + github-client.ts (API wrapper)", "+2d"],
                      ["1-2", "Azure Repos Service Principal + azure-repos-client.ts", "+2d"],
                      ["1-2", "git-provider.ts Port (interface comum GitHub/Azure)", "+1d"],
                      ["3-4", "Code Indexer: webhook listener + metadata extractor", "+3d"],
                      ["3-4", "ElectroDB entities: RepoNode, PackageNode", "+1d"],
                      ["3-4", "Code Index sync: imports, deps, file map", "+2d"],
                      ["5-7", "Code Analyzer sub-agent: tools + system prompt", "+3d"],
                      ["5-7", "Integration com Orchestrator (5º agente paralelo)", "+1d"],
                      ["5-7", "PR generation tool (com approval gate)", "+2d"],
                      ["8-9", "Cross-repo search optimization + caching", "+1d"],
                    ].map(([s, c, d], i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-slate-300">{s}</td>
                        <td className="px-3 py-2 text-slate-400">{c}</td>
                        <td className="px-3 py-2 text-center text-amber-400 font-bold">{d}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-amber-500/30">
                      <td className="px-3 py-2 text-amber-400 font-bold" colSpan={2}>Total Code Analyzer</td>
                      <td className="px-3 py-2 text-center text-amber-400 font-bold">+18d (~3.5 sem)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-5">
              <h3 className="text-emerald-400 text-xs font-bold mb-3">TIMELINE TOTAL ATUALIZADA</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-3 py-2 text-left text-slate-400">Componente</th>
                      <th className="px-3 py-2 text-center text-slate-400">Dias adicionais</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    <tr><td className="px-3 py-2 text-slate-300">PRD base</td><td className="px-3 py-2 text-center text-slate-300">24 semanas</td></tr>
                    <tr><td className="px-3 py-2 text-slate-300">+ ADR-009 (multi-cloud, multi-chat)</td><td className="px-3 py-2 text-center text-cyan-400">+12 dias</td></tr>
                    <tr><td className="px-3 py-2 text-slate-300">+ ADR-010 (relay, Sentry, Consul)</td><td className="px-3 py-2 text-center text-purple-400">+20 dias</td></tr>
                    <tr><td className="px-3 py-2 text-slate-300">+ Code Analyzer (GitHub, Azure Repos)</td><td className="px-3 py-2 text-center text-amber-400">+18 dias</td></tr>
                    <tr className="border-t border-emerald-500/30">
                      <td className="px-3 py-2 text-emerald-400 font-bold">Total</td>
                      <td className="px-3 py-2 text-center text-emerald-400 font-bold">24sem + 50d = ~34 semanas</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-slate-500">Com 2 devs paralelos</td>
                      <td className="px-3 py-2 text-center text-slate-500">~28 semanas</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-slate-500">Fase 1 MVP (só reativo + AWS + GitHub)</td>
                      <td className="px-3 py-2 text-center text-emerald-400 font-bold">~14-16 semanas</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-slate-500 text-xs mt-3">
                Code Analyzer justifica cada dia extra. A diferença entre 65% e 92% de acurácia 
                é a diferença entre "ferramenta interessante" e "indispensável".
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
