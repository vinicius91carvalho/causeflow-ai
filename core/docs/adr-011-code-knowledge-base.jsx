import { useState } from "react";

const tabs = [
  { id: "decision", label: "ADR-011: Decisão", icon: "📐" },
  { id: "why-no-vectors", label: "Por que não Embeddings", icon: "🚫" },
  { id: "indexer", label: "Code Indexer", icon: "⚙️" },
  { id: "data-model", label: "Data Model", icon: "💾" },
  { id: "queries", label: "Queries em Ação", icon: "🔍" },
  { id: "phases", label: "Fases", icon: "📅" },
];

const Code = ({ children, title }) => (
  <div className="bg-slate-950 border border-slate-800 text-green-400 rounded-lg p-4 font-mono text-xs overflow-x-auto leading-relaxed">
    {title && <div className="text-slate-600 mb-2">// {title}</div>}
    <pre>{children}</pre>
  </div>
);

export default function ADR011() {
  const [activeTab, setActiveTab] = useState("decision");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <div className="border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="bg-violet-600 px-2 py-0.5 rounded text-xs font-bold">ADR-011</span>
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
              Code Knowledge Base — Indexação Estrutural sem Embeddings
            </h1>
          </div>
          <p className="text-slate-600 text-xs mt-1">Zero vector DB. DynamoDB adjacency list. Webhooks + API on-demand. Tree-sitter na Fase 2.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                  : "text-slate-500 hover:text-slate-300 border border-transparent hover:border-slate-700"
              }`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "decision" && (
          <div className="space-y-6">
            <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-violet-600 px-2 py-0.5 rounded text-xs font-bold">ADR-011</span>
                <span className="text-violet-400 text-xs">Aceito — Fev 2026</span>
              </div>
              <h2 className="text-lg font-bold mb-1" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
                Code Knowledge Base: Indexação Estrutural via DynamoDB
              </h2>
              <p className="text-slate-400 text-sm">Como dar visão cross-repo ao AI Agent sem clonar repositórios, sem embeddings, e sem vector databases.</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-slate-200 text-sm font-bold mb-3">Contexto</h3>
              <div className="text-xs text-slate-400 space-y-2">
                <p>O insight que originou esta ADR: rodar Claude Code na pasta raiz com todos os projetos dá visão completa e diagnósticos de alta precisão. O agent vê que <code className="text-amber-400">checkout-service</code> importa de <code className="text-amber-400">shared-sdk</code>, que a versão mudou, que 4 outros serviços usam a mesma lib, e que o campo renomeado é a causa do crash.</p>
                <p>Precisamos replicar essa visão cross-repo em produção, para múltiplos clientes, com segurança.</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-slate-200 text-sm font-bold mb-3">Opções Avaliadas</h3>
              <div className="space-y-3">
                {[
                  {
                    opt: "A", title: "Clone + Embedding + Vector DB (RAG clássico)",
                    status: "rejected",
                    desc: "Clonar todos os repos, chunkar código, gerar embeddings, armazenar em Pinecone/pgvector. Query via cosine similarity.",
                    pros: ["Busca semântica ('código que faz autenticação')"],
                    cons: [
                      "Embeddings capturam similaridade semântica, não relações estruturais",
                      "'Quem depende do shared-sdk?' → embedding não sabe responder",
                      "Chunks de código perdem contexto (imports cortados, funções partidas)",
                      "Clone de repos = armazenar código fonte do cliente (risco de segurança)",
                      "Vector DB é mais um componente para manter (Pinecone/Qdrant/pgvector)",
                      "Custo de embedding: re-processar a cada commit",
                      "Resultados imprecisos para queries estruturais"
                    ]
                  },
                  {
                    opt: "B", title: "Sourcegraph / CodeQL / Indexação pesada",
                    status: "rejected",
                    desc: "Usar ferramenta enterprise de code intelligence que faz indexação profunda com SCIP/LSIF.",
                    pros: ["Go-to-definition, find-references cross-repo", "Análise semântica profunda"],
                    cons: [
                      "Sourcegraph: caro ($$$), self-hosted complexo, over-engineering para nosso caso",
                      "CodeQL: focado em segurança (vulnerabilidades), não em dependency mapping",
                      "Ambos requerem clone completo dos repos",
                      "Latência: indexação leva minutos por repo",
                      "Dependência externa pesada para funcionalidade que precisamos parcialmente"
                    ]
                  },
                  {
                    opt: "C", title: "Indexação estrutural leve: metadados + DynamoDB + API on-demand",
                    status: "accepted",
                    desc: "Indexar apenas metadados estruturais (deps, imports, file maps, PR history) no DynamoDB. Ler código via GitHub/Azure API on-demand durante investigação. Zero clone, zero embedding.",
                    pros: [
                      "Queries estruturais instantâneas ('quem depende de X?' → ms)",
                      "Zero armazenamento de código fonte",
                      "Mesmo DynamoDB e pattern adjacency list que já usamos",
                      "Webhook-driven: atualiza a cada push/PR merge",
                      "API on-demand: lê código quando precisa, descarta depois",
                      "Sem componente novo: DynamoDB + Lambda/ECS (já temos)",
                      "Tree-sitter na Fase 2 para imports complexos",
                      "Seguro por design: metadados ≠ código"
                    ],
                    cons: [
                      "Sem busca semântica ('código que faz X')",
                      "API on-demand tem rate limit (5000 req/h GitHub)",
                      "Imports complexos (re-exports, dynamic imports) precisam de Tree-sitter"
                    ]
                  },
                ].map((o) => (
                  <div key={o.opt} className={`border rounded-lg p-4 ${o.status === "accepted" ? "border-emerald-500/30 bg-emerald-500/5" : "border-slate-700 bg-slate-800/30"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${o.status === "accepted" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                        {o.status === "accepted" ? "✅ ACEITA" : "❌ REJEITADA"}
                      </span>
                      <span className="text-slate-200 text-xs font-bold">Opção {o.opt}: {o.title}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{o.desc}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        {o.pros.map((p, i) => <p key={i} className="text-emerald-400/70 mb-0.5">+ {p}</p>)}
                      </div>
                      <div>
                        {o.cons.map((c, i) => <p key={i} className="text-red-400/70 mb-0.5">- {c}</p>)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
              <h3 className="text-emerald-400 text-sm font-bold mb-2">Decisão</h3>
              <p className="text-xs text-slate-300">
                <strong className="text-emerald-400">Opção C</strong> — Indexação estrutural leve. Metadados no DynamoDB (adjacency list),
                código lido on-demand via GitHub API / Azure Repos API. Zero embeddings, zero vector DB, zero clone.
                Tree-sitter na Fase 2 para análise de imports complexos. Claude interpreta o código — a indexação
                fornece o mapa de onde olhar, não o que interpretar.
              </p>
            </div>
          </div>
        )}

        {activeTab === "why-no-vectors" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
              Por que Embeddings não servem para Investigação de Incidentes
            </h2>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-slate-200 text-sm font-bold mb-3">O problema fundamental</h3>
              <p className="text-xs text-slate-400 mb-4">
                Embeddings capturam <strong className="text-amber-400">similaridade semântica</strong>. 
                Investigação de incidentes precisa de <strong className="text-emerald-400">relações estruturais</strong>. 
                São perguntas completamente diferentes.
              </p>

              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="px-3 py-2 text-left text-slate-400">Pergunta do Agent</th>
                      <th className="px-3 py-2 text-left text-slate-400">Tipo</th>
                      <th className="px-3 py-2 text-center text-slate-400">Embedding?</th>
                      <th className="px-3 py-2 text-center text-slate-400">Graph Query?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {[
                      ["Quem depende do @acme/shared-sdk?", "Relação", "❌ Não sabe", "✅ 2ms"],
                      ["O que mudou no PR #847?", "Lookup", "❌ Não sabe", "✅ 1ms"],
                      ["Qual o diff de checkout.handler.ts?", "API call", "❌ Irrelevante", "✅ API on-demand"],
                      ["Quais repos deployam no ECS cluster X?", "Relação", "❌ Não sabe", "✅ 3ms"],
                      ["Quem mais usa a função validatePrice()?", "Estrutural", "⚠️ Impreciso", "✅ Tree-sitter Fase 2"],
                      ["Quando shared-sdk mudou de versão?", "Temporal", "❌ Não sabe", "✅ 1ms"],
                      ["Quais arquivos o @dev mudou essa semana?", "Relação", "❌ Não sabe", "✅ 2ms"],
                      ["Encontre código similar a essa lógica", "Semântico", "✅ Bom nisso", "❌ Não faz"],
                    ].map(([q, type, emb, graph], i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-slate-300">{q}</td>
                        <td className="px-3 py-2 text-slate-500">{type}</td>
                        <td className="px-3 py-2 text-center">{emb}</td>
                        <td className="px-3 py-2 text-center">{graph}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-slate-500 mt-4">
                7 de 8 perguntas que o agent faz durante investigação são estruturais ou de lookup.
                Apenas 1 (busca semântica) beneficiaria de embeddings — e para essa, o Claude
                lendo o código diretamente via API é mais preciso que cosine similarity em chunks.
              </p>
            </div>

            <div className="bg-slate-900 border border-red-500/20 rounded-xl p-5">
              <h3 className="text-red-400 text-sm font-bold mb-3">Problemas concretos de embeddings para código</h3>
              <div className="space-y-3 text-xs text-slate-400">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-red-400 font-bold mb-1">1. Chunking destrói contexto</p>
                  <p>Um arquivo de 500 linhas é dividido em chunks de ~100 linhas. O import do <code className="text-amber-400">shared-sdk</code> 
                  está na linha 3, o uso está na linha 247. Ficam em chunks diferentes. O embedding de cada chunk 
                  não sabe que estão conectados.</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-red-400 font-bold mb-1">2. Relações cross-arquivo são invisíveis</p>
                  <p><code className="text-amber-400">checkout/handler.ts</code> importa de <code className="text-amber-400">shared-sdk/client.ts</code>. 
                  São dois arquivos em dois repos. Embedding de cada um é independente — não existe conceito de 
                  "A depende de B" no espaço vetorial.</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-red-400 font-bold mb-1">3. Custo e latência desnecessários</p>
                  <p>Re-embeddar a cada commit. Armazenar milhões de vetores. Query com cosine similarity.
                  Tudo isso para responder "quem usa shared-sdk?" — que é um <code className="text-emerald-400">begins_with</code> 
                  em DynamoDB retornando em 2ms.</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-red-400 font-bold mb-1">4. O Claude É o embedding</p>
                  <p>Quando o agent precisa entender código, ele lê o trecho via API e o Claude interpreta diretamente.
                  Claude com 200K de contexto entende código melhor que qualquer embedding de 1536 dimensões.
                  Embedding é uma compressão lossy — o Claude lendo o original é lossless.</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-emerald-500/20 rounded-xl p-5">
              <h3 className="text-emerald-400 text-sm font-bold mb-3">Nossa abordagem: estrutura primeiro, semântica quando necessário</h3>
              <Code>{`
Pergunta: "Por que checkout está retornando 500?"

Abordagem com embeddings (❌):
  1. Embedd a pergunta
  2. Busca vetorial em milhões de chunks de código
  3. Retorna top-10 chunks mais "similares"
  4. Chunks podem ser de qualquer arquivo, qualquer repo
  5. Claude tenta fazer sentido de fragmentos desconectados
  6. Resultado: impreciso, lento, caro

Nossa abordagem (✅):
  1. Sentry diz: crash em checkout.handler.ts:45
  2. Code Index diz: checkout depende de shared-sdk@2.2.0
  3. Code Index diz: shared-sdk teve PR #203 há 3 dias
  4. API on-demand: lê checkout.handler.ts:40-50 (10 linhas)
  5. API on-demand: lê diff do PR #203 (campos renomeados)
  6. Claude lê código real, não chunks fragmentados
  7. Resultado: preciso, rápido, barato

A diferença: nós sabemos ONDE olhar antes de ler.
Embeddings leem tudo esperando encontrar algo relevante.`}</Code>
            </div>
          </div>
        )}

        {activeTab === "indexer" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
              Code Indexer — Arquitetura Completa
            </h2>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 overflow-x-auto">
              <pre className="text-xs leading-relaxed">{`
  `}<span className="text-amber-400">{`FLUXO DE INDEXAÇÃO`}</span>{`

  ┌────────────────┐      ┌────────────────┐
  │    GitHub      │      │  Azure Repos   │
  │                │      │                │
  │ • push event   │      │ • push event   │
  │ • PR merged    │      │ • PR completed │
  │ • release      │      │ • build done   │
  └───────┬────────┘      └───────┬────────┘
          │ webhook                │ webhook (Service Hook)
          │                       │
          ▼                       ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  `}<span className="text-cyan-400">{`WEBHOOK RECEIVER`}</span>{` (Hono route no backend)                      │
  │                                                              │
  │  POST /webhooks/github/:tenantId                             │
  │  POST /webhooks/azure-repos/:tenantId                        │
  │                                                              │
  │  • Valida HMAC signature (GitHub) / Basic Auth (Azure)       │
  │  • Identifica tipo: push | pr_merge | release                │
  │  • Publica na fila                                           │
  └──────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  `}<span className="text-purple-400">{`SQS QUEUE`}</span>{` (code-indexer-queue)                                  │
  │                                                              │
  │  • Buffer para picos de commits                              │
  │  • DLQ para falhas                                           │
  │  • Dedup por messageId (mesmo commit não processa 2x)        │
  └──────────────────────────┬───────────────────────────────────┘
                             │
                             ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  `}<span className="text-emerald-400">{`CODE INDEXER`}</span>{` (Lambda ou ECS task)                               │
  │                                                              │
  │  Para cada evento:                                           │
  │                                                              │
  │  1. `}<span className="text-amber-400">{`DEPENDENCY EXTRACTION`}</span>{`                                     │
  │     Lê via API (NÃO clona):                                  │
  │     • package.json → npm deps + versions                     │
  │     • requirements.txt / pyproject.toml → pip deps           │
  │     • go.mod → go deps                                       │
  │     • pom.xml / build.gradle → java deps                     │
  │     • Cargo.toml → rust deps                                 │
  │     Resultado: lista de { name, version, declaredIn }        │
  │                                                              │
  │  2. `}<span className="text-amber-400">{`FILE MAP UPDATE`}</span>{`                                           │
  │     GET /repos/{repo}/git/trees/{sha}?recursive=true         │
  │     Resultado: lista de file paths no repo                   │
  │     (usado para: "checkout.handler.ts existe em qual repo?") │
  │                                                              │
  │  3. `}<span className="text-amber-400">{`CONFIG EXTRACTION`}</span>{`                                         │
  │     Lê paths conhecidos via API:                              │
  │     • Dockerfile → base image, exposed ports, CMD            │
  │     • .github/workflows/*.yml → deploy target, triggers      │
  │     • azure-pipelines.yml → stages, environments             │
  │     • terraform/*.tf → resources declarados                   │
  │     • docker-compose.yml → services, depends_on              │
  │     Resultado: { deployTarget, ciPipeline, dockerfile }      │
  │                                                              │
  │  4. `}<span className="text-amber-400">{`PR METADATA`}</span>{` (se evento = PR merge)                       │
  │     • PR number, title, author, reviewers                    │
  │     • Files changed (paths only, NÃO o diff)                 │
  │     • Merge timestamp                                        │
  │     • Linked issues (se houver)                              │
  │     Resultado: { pr, author, filesChanged, mergedAt }        │
  │                                                              │
  │  5. `}<span className="text-amber-400">{`UPSERT DYNAMODB`}</span>{`                                          │
  │     Escreve/atualiza entidades no Knowledge Graph            │
  │     (mesma tabela single-table que já usamos)                │
  │                                                              │
  └──────────────────────────────────────────────────────────────┘

  `}<span className="text-slate-500">{`Importante: NENHUM código fonte é armazenado.
  Apenas metadados estruturais: deps, paths, configs, PR metadata.
  Código é lido on-demand via API durante investigação e descartado.`}</span></pre>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-slate-200 text-sm font-bold mb-3">Implementação do Indexer</h3>
              <Code title="src/modules/knowledge/sources/code-indexer.ts">{`
class CodeIndexer {
  constructor(
    private git: GitProvider,      // GitHub ou Azure Repos (Port & Adapter)
    private knowledge: KnowledgeGraph,
    private eventBus: EventBus,
  ) {}

  // Chamado pelo SQS consumer para cada evento
  async processEvent(event: CodeEvent) {
    const { tenantId, repo, eventType, ref } = event;

    // 1. DEPENDENCIES — ler manifest files
    const deps = await this.extractDependencies(tenantId, repo);
    // Exemplo: [{ name: "@acme/shared-sdk", version: "2.2.0", file: "package.json" }]

    // 2. FILE MAP — estrutura do repo
    const files = await this.git.getTree(tenantId, repo, ref);
    // Exemplo: ["src/handler.ts", "src/client.ts", "Dockerfile", ...]

    // 3. CONFIG — paths conhecidos
    const config = await this.extractConfig(tenantId, repo);
    // Exemplo: { dockerfile: { base: "node:20", port: 3000 }, 
    //            ci: { tool: "github-actions", deployTarget: "ecs/checkout" } }

    // 4. PR METADATA (se aplicável)
    const pr = eventType === "pr_merge" 
      ? await this.git.getPRMetadata(tenantId, repo, event.prNumber)
      : null;

    // 5. UPSERT tudo no Knowledge Graph
    await this.knowledge.upsertRepo({
      tenantId, repo,
      language: detectLanguage(files),
      fileCount: files.length,
      lastCommit: ref,
      config,
    });

    // Upsert deps como edges no grafo
    for (const dep of deps) {
      await this.knowledge.upsertDependency({
        tenantId,
        source: repo,
        target: dep.name,
        type: "package_dependency",
        version: dep.version,
        declaredIn: dep.file,
      });
      // Edge reverso: PKG → USED_BY
      await this.knowledge.upsertDependent({
        tenantId,
        packageName: dep.name,
        repo,
        version: dep.version,
      });
    }

    // Upsert PR se houver
    if (pr) {
      await this.knowledge.upsertPR({
        tenantId, repo,
        prNumber: pr.number,
        title: pr.title,
        author: pr.author,
        filesChanged: pr.filesChanged,
        mergedAt: pr.mergedAt,
      });
    }

    // Detectar mudanças relevantes
    if (this.hasBreakingDependencyChange(deps, event.previousDeps)) {
      await this.eventBus.emit("knowledge.dependency_changed", {
        tenantId, repo,
        changes: this.diffDeps(deps, event.previousDeps),
        // Ex: { package: "@acme/shared-sdk", from: "2.1.0", to: "2.2.0" }
      });
    }
  }

  // Extrai deps de manifest files (sem clonar)
  private async extractDependencies(tenantId: string, repo: string) {
    const deps: Dependency[] = [];

    // Tentar package.json (Node/TS)
    const pkgJson = await this.git.readFile(tenantId, repo, "package.json");
    if (pkgJson) {
      const pkg = JSON.parse(pkgJson);
      for (const [name, version] of Object.entries({
        ...pkg.dependencies, ...pkg.devDependencies
      })) {
        deps.push({ name, version: version as string, file: "package.json" });
      }
    }

    // Tentar requirements.txt (Python)
    const reqTxt = await this.git.readFile(tenantId, repo, "requirements.txt");
    if (reqTxt) {
      for (const line of reqTxt.split("\\n")) {
        const match = line.match(/^([a-zA-Z0-9_-]+)==(.+)$/);
        if (match) deps.push({ name: match[1], version: match[2], file: "requirements.txt" });
      }
    }

    // Tentar go.mod, pom.xml, Cargo.toml...
    // Mesmo padrão: ler arquivo, parsear, extrair deps

    return deps;
  }

  // Extrai config de Dockerfile, CI, IaC
  private async extractConfig(tenantId: string, repo: string) {
    const config: RepoConfig = {};

    // Dockerfile
    const dockerfile = await this.git.readFile(tenantId, repo, "Dockerfile");
    if (dockerfile) {
      const fromMatch = dockerfile.match(/^FROM\\s+(.+)$/m);
      const exposeMatch = dockerfile.match(/^EXPOSE\\s+(\\d+)/m);
      config.dockerfile = {
        baseImage: fromMatch?.[1],
        port: exposeMatch ? parseInt(exposeMatch[1]) : undefined,
      };
    }

    // GitHub Actions
    const workflows = await this.git.listDirectory(tenantId, repo, ".github/workflows");
    if (workflows?.length) {
      config.ci = { tool: "github-actions", workflows: workflows.map(w => w.name) };
    }

    // Azure Pipelines
    const azPipeline = await this.git.readFile(tenantId, repo, "azure-pipelines.yml");
    if (azPipeline) {
      config.ci = { tool: "azure-pipelines" };
    }

    // Terraform
    const tfFiles = await this.git.listDirectory(tenantId, repo, "terraform");
    if (tfFiles?.length) {
      config.iac = { tool: "terraform", files: tfFiles.map(f => f.name) };
    }

    return config;
  }
}`}</Code>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-slate-200 text-sm font-bold mb-3">Git Provider — Port & Adapter (mesmo pattern de cloud/chat)</h3>
              <Code title="src/shared/ports/git-provider.ts">{`
// Interface: core domain não sabe se é GitHub ou Azure Repos
interface GitProvider {
  // Leitura de arquivos (on-demand, não clona)
  readFile(tenantId: string, repo: string, path: string): Promise<string | null>;
  listDirectory(tenantId: string, repo: string, path: string): Promise<FileEntry[]>;
  getTree(tenantId: string, repo: string, ref: string): Promise<string[]>;

  // PRs e commits
  getPRMetadata(tenantId: string, repo: string, prNumber: number): Promise<PRMetadata>;
  getPRDiff(tenantId: string, repo: string, prNumber: number): Promise<FileDiff[]>;
  getCommitHistory(tenantId: string, repo: string, path: string, limit: number): Promise<Commit[]>;
  getRecentPRs(tenantId: string, repo: string, limit: number): Promise<PRMetadata[]>;

  // Search
  searchCode(tenantId: string, query: string, options?: SearchOptions): Promise<CodeSearchResult[]>;
  
  // Repos
  listRepos(tenantId: string): Promise<RepoInfo[]>;

  // Write (requer approval gate + scope adicional)
  createPR(tenantId: string, repo: string, pr: CreatePRRequest): Promise<PRMetadata>;
}

// Adapter: GitHub
// src/infra/git/github-client.ts
// Usa GitHub App Installation Token (read-only)
// Endpoint: api.github.com

// Adapter: Azure Repos
// src/infra/git/azure-repos-client.ts
// Usa Service Principal OAuth token (read-only)
// Endpoint: dev.azure.com/{org}/_apis/git/`}</Code>
            </div>

            <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-5">
              <h3 className="text-amber-400 text-sm font-bold mb-3">Tree-sitter — Fase 2: Análise de Imports Profunda</h3>
              <Code title="Quando JSON.parse não basta">{`
// Fase 1 (MVP): JSON.parse de manifests (package.json, go.mod, etc.)
// Resolve 90% dos casos: dependências declaradas.

// Fase 2: Tree-sitter para imports dentro do código
// Resolve os 10% restantes: quem importa quais funções/tipos.

// Tree-sitter: parser AST universal, open-source (GitHub/Microsoft)
// npm: tree-sitter + tree-sitter-typescript + tree-sitter-python + ...
// Parse rápido: ~10ms por arquivo, sem executar código

// Exemplo: extrair imports de um arquivo TypeScript
import TreeSitter from "tree-sitter";
import TypeScript from "tree-sitter-typescript";

const parser = new TreeSitter();
parser.setLanguage(TypeScript.typescript);

function extractImports(code: string): ImportInfo[] {
  const tree = parser.parse(code);
  const imports: ImportInfo[] = [];

  // Query AST para import declarations
  const query = new TreeSitter.Query(TypeScript.typescript, \`
    (import_statement
      source: (string) @source
      (import_clause
        (named_imports
          (import_specifier
            name: (identifier) @name))))
  \`);

  for (const match of query.matches(tree.rootNode)) {
    imports.push({
      source: match.captures.find(c => c.name === "source")?.node.text,
      names: match.captures.filter(c => c.name === "name").map(c => c.node.text),
    });
  }
  return imports;
}

// Input:
//   import { ProductClient, PriceCalc } from '@acme/shared-sdk';
//   import { Logger } from '../utils/logger';
//
// Output:
//   [{ source: "@acme/shared-sdk", names: ["ProductClient", "PriceCalc"] },
//    { source: "../utils/logger", names: ["Logger"] }]
//
// Valor: saber que checkout usa ProductClient do shared-sdk
// Se ProductClient mudar → checkout é afetado
// Mais granular que "checkout depende de shared-sdk"

// QUANDO usar Tree-sitter:
// • Cliente reporta: "mudei shared-sdk, quem vai quebrar?"
// • Agent quer saber: quais FUNÇÕES/TIPOS são usados, não só o pacote
// • Blast radius fino: "só quem usa PriceCalc é afetado, não todo mundo"

// QUANDO NÃO usar (fica pro Claude):
// • Entender lógica de negócio
// • Interpretar o que um trecho de código faz
// • Identificar bugs (Claude lê o código diretamente)`}</Code>

              <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-emerald-400 font-bold mb-1">Linguagens suportadas</p>
                  <p className="text-slate-400">TypeScript, JavaScript, Python, Go, Java, Ruby, Rust, C#, PHP, Swift, Kotlin — 40+ linguagens</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-emerald-400 font-bold mb-1">Performance</p>
                  <p className="text-slate-400">~10ms por arquivo. Incremental: re-parse só o que mudou. Pode rodar no Lambda sem timeout.</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3">
                  <p className="text-emerald-400 font-bold mb-1">Quem usa</p>
                  <p className="text-slate-400">GitHub (Code Search, Linguist), VS Code, Neovim, Zed, Sourcegraph. Production-grade.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "data-model" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
              Data Model — DynamoDB Adjacency List
            </h2>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-slate-200 text-sm font-bold mb-3">Entidades do Code Knowledge Base</h3>
              <Code title="ElectroDB entities — mesma tabela single-table">{`
// ═══════════════════════════════════════════════
// REPO NODE — metadados de um repositório
// ═══════════════════════════════════════════════

const RepoNode = new Entity({
  model: { entity: "repo", version: "1", service: "sre" },
  attributes: {
    tenantId:      { type: "string", required: true },
    repoName:      { type: "string", required: true },  // "checkout-service"
    provider:      { type: ["github", "azure_repos"] },
    language:      { type: "string" },                   // "typescript"
    defaultBranch: { type: "string" },                   // "main"
    lastCommitSha: { type: "string" },
    lastIndexedAt: { type: "string" },
    fileCount:     { type: "number" },
    config: {
      type: "map",
      properties: {
        dockerfile: { type: "map", properties: {
          baseImage: { type: "string" },                 // "node:20-alpine"
          port:      { type: "number" },                 // 3000
        }},
        ci: { type: "map", properties: {
          tool:         { type: "string" },              // "github-actions"
          deployTarget: { type: "string" },              // "ecs/checkout-cluster"
          workflows:    { type: "list", items: { type: "string" } },
        }},
        iac: { type: "map", properties: {
          tool:  { type: "string" },                     // "terraform"
          files: { type: "list", items: { type: "string" } },
        }},
      },
    },
  },
  indexes: {
    primary: { pk: { composite: ["tenantId"] },
               sk: { composite: ["repoName"] } },
    byLanguage: { index: "gsi1",
                  pk: { composite: ["tenantId"] },
                  sk: { composite: ["language", "repoName"] } },
  },
});

// DynamoDB:
// PK=TENANT#t1  SK=REPO#checkout-service
// → { language: "typescript", lastCommitSha: "abc123",
//     config: { dockerfile: { baseImage: "node:20" },
//               ci: { tool: "github-actions", deployTarget: "ecs/checkout" } } }


// ═══════════════════════════════════════════════
// PACKAGE DEPENDENCY — edge: repo depends on package
// ═══════════════════════════════════════════════

const PackageDependency = new Entity({
  model: { entity: "pkg_dep", version: "1", service: "sre" },
  attributes: {
    tenantId:    { type: "string", required: true },
    repoName:    { type: "string", required: true },
    packageName: { type: "string", required: true },  // "@acme/shared-sdk"
    version:     { type: "string" },                   // "2.2.0"
    declaredIn:  { type: "string" },                   // "package.json"
    isDev:       { type: "boolean" },                  // devDependency?
  },
  indexes: {
    // "Quais packages checkout-service usa?"
    byRepo: { pk: { composite: ["tenantId", "repoName"] },
              sk: { composite: ["packageName"] } },
    // "Quem usa @acme/shared-sdk?" (edge reverso)
    byPackage: { index: "gsi1",
                 pk: { composite: ["tenantId", "packageName"] },
                 sk: { composite: ["repoName"] } },
  },
});

// DynamoDB:
// PK=TENANT#t1|REPO#checkout  SK=PKG_DEP#@acme/shared-sdk
// → { version: "2.2.0", declaredIn: "package.json" }
//
// GSI1:
// PK=TENANT#t1|PKG#@acme/shared-sdk  SK=USED_BY#checkout
// → { version: "2.2.0" }


// ═══════════════════════════════════════════════
// PR RECORD — histórico de PRs mergeados
// ═══════════════════════════════════════════════

const PRRecord = new Entity({
  model: { entity: "pr", version: "1", service: "sre" },
  attributes: {
    tenantId:     { type: "string", required: true },
    repoName:     { type: "string", required: true },
    prNumber:     { type: "number", required: true },
    title:        { type: "string" },
    author:       { type: "string" },                  // "@dev"
    reviewers:    { type: "list", items: { type: "string" } },
    filesChanged: { type: "list", items: { type: "string" } },
    mergedAt:     { type: "string" },                  // ISO timestamp
    linkedIssues: { type: "list", items: { type: "string" } },
  },
  indexes: {
    // "PRs recentes do checkout-service"
    byRepo: { pk: { composite: ["tenantId", "repoName"] },
              sk: { composite: ["mergedAt"] } },       // Sort by time desc
    // "PRs que mudaram src/handler.ts" → precisa de scan com filter
    // Para Fase 2: GSI com filesChanged flat
  },
});

// DynamoDB:
// PK=TENANT#t1|REPO#checkout  SK=PR#2026-02-15T14:00:00Z#847
// → { title: "Update shared-sdk", author: "@dev",
//     filesChanged: ["package.json", "src/handler.ts"], mergedAt: "..." }


// ═══════════════════════════════════════════════
// REPO-TO-SERVICE MAP — repo deploys to which service
// ═══════════════════════════════════════════════

const RepoServiceMap = new Entity({
  model: { entity: "repo_svc", version: "1", service: "sre" },
  attributes: {
    tenantId:    { type: "string", required: true },
    repoName:    { type: "string", required: true },
    serviceName: { type: "string", required: true },   // "checkout-api"
    deployTarget:{ type: "string" },                    // "ecs/checkout-cluster"
    environment: { type: "string" },                    // "production"
  },
  indexes: {
    // "Qual repo deploya o checkout-api?" 
    byService: { pk: { composite: ["tenantId", "serviceName"] },
                 sk: { composite: ["repoName"] } },
    // "O repo checkout deploya onde?"
    byRepo: { index: "gsi1",
              pk: { composite: ["tenantId", "repoName"] },
              sk: { composite: ["serviceName"] } },
  },
});

// DynamoDB:
// PK=TENANT#t1|SVC#checkout-api  SK=REPO#checkout-service
// → { deployTarget: "ecs/checkout-cluster", environment: "production" }
//
// Liga o mundo do código (repos) ao mundo da infra (services)
// Sentry diz "crash em checkout-api" → qual repo? → "checkout-service"
// CloudTrail diz "deploy no ecs/checkout" → qual repo? → qual PR?`}</Code>
            </div>

            <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-5">
              <h3 className="text-emerald-400 text-sm font-bold mb-3">O Knowledge Graph completo (tudo na mesma tabela)</h3>
              <Code title="Visão consolidada: infra + code + incidents">{`
// Uma única tabela DynamoDB com TODAS as entidades.
// Adjacency list pattern permite queries de grafo eficientes.

// ── INFRA (ADR-005, ADR-010) ──
// TENANT#t1|SVC#checkout-api      SK=META           → health, instances
// TENANT#t1|SVC#checkout-api      SK=DEP#auth-svc   → service dependency
// TENANT#t1|SVC#checkout-api      SK=INC#inc-789    → incidente vinculado

// ── CODE (ADR-011 — este) ──
// TENANT#t1|REPO#checkout-service SK=META           → language, config, CI
// TENANT#t1|REPO#checkout-service SK=PKG_DEP#sdk    → depends on sdk@2.2.0
// TENANT#t1|REPO#checkout-service SK=PR#2026-02-15  → PR metadata
// TENANT#t1|PKG#@acme/shared-sdk  SK=USED_BY#chkout → reverse edge
// TENANT#t1|SVC#checkout-api      SK=REPO#checkout  → service ↔ repo link

// ── CONSUL (ADR-010) ──
// TENANT#t1|SVC#auth-svc          SK=CONSUL_META    → instances, health
// TENANT#t1|SVC#auth-svc          SK=DEP#api-gw     → consul intention

// ── INCIDENTS ──
// TENANT#t1|INC#inc-789           SK=META           → severity, status, RCA
// TENANT#t1|INC#inc-789           SK=EVIDENCE#001   → hypothesis, confidence

// ── PATTERNS (Tenant Memory) ──
// TENANT#t1|PATTERN#ptr-001       SK=META           → symptoms, rootCause, fix

// Query exemplo durante investigação:
// 
// 1. Sentry: crash em "checkout-api"
//    → PK=TENANT#t1|SVC#checkout-api SK=REPO# 
//    → repo = "checkout-service"
//
// 2. "Quais deps do checkout-service?"
//    → PK=TENANT#t1|REPO#checkout-service SK begins_with PKG_DEP#
//    → [@acme/shared-sdk@2.2.0, @acme/auth-lib@1.0.3, ...]
//
// 3. "Quem mais usa shared-sdk?"
//    → GSI1: PK=TENANT#t1|PKG#@acme/shared-sdk SK begins_with USED_BY#
//    → [checkout@2.2.0, payment@2.1.0, inventory@2.2.0]
//
// 4. "PRs recentes do checkout-service?"
//    → PK=TENANT#t1|REPO#checkout-service SK begins_with PR#
//    → [PR #847 "Update shared-sdk" 2h ago]
//
// 5. "Qual a saúde do checkout-api na infra?"
//    → PK=TENANT#t1|SVC#checkout-api SK=META
//    → { health: "critical", instances: 3 }
//
// Tudo em ms. Zero embedding. Zero vector search.`}</Code>
            </div>
          </div>
        )}

        {activeTab === "queries" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
              Queries Reais durante Investigação
            </h2>

            {[
              {
                scenario: "Cenário 1: Sentry reporta crash em checkout-api",
                color: "border-red-500/30",
                steps: [
                  { query: "Qual repo deploya checkout-api?", type: "Index", dynamo: "PK=T#t1|SVC#checkout-api SK begins_with REPO#", result: "→ checkout-service", time: "2ms" },
                  { query: "Quais deps do checkout-service?", type: "Index", dynamo: "PK=T#t1|REPO#checkout-service SK begins_with PKG_DEP#", result: "→ shared-sdk@2.2.0, auth-lib@1.0", time: "2ms" },
                  { query: "PRs recentes do checkout-service?", type: "Index", dynamo: "PK=T#t1|REPO#checkout-service SK begins_with PR#", result: "→ PR #847 'Update shared-sdk' 2h ago", time: "2ms" },
                  { query: "Diff do PR #847?", type: "API", dynamo: "GET /repos/checkout/pulls/847/files", result: "→ package.json + src/handler.ts changed", time: "~200ms" },
                  { query: "Conteúdo de handler.ts linhas 40-50?", type: "API", dynamo: "GET /repos/checkout/contents/src/handler.ts", result: "→ product.price (campo antigo!)", time: "~200ms" },
                  { query: "Quem mais usa shared-sdk?", type: "Index", dynamo: "GSI1: PK=T#t1|PKG#shared-sdk SK begins_with USED_BY#", result: "→ payment@2.1.0, inventory@2.2.0", time: "2ms" },
                ]
              },
              {
                scenario: "Cenário 2: Latência alta pós-deploy",
                color: "border-amber-500/30",
                steps: [
                  { query: "Qual repo deployou no ECS checkout?", type: "Index", dynamo: "PK=T#t1|SVC#checkout-api SK=REPO#", result: "→ checkout-service", time: "2ms" },
                  { query: "PRs mergeados nas últimas 4h?", type: "Index", dynamo: "PK=T#t1|REPO#checkout SK begins_with PR#2026-02-15T10:", result: "→ PR #845, #846, #847", time: "3ms" },
                  { query: "Algum PR mudou Dockerfile?", type: "Index", dynamo: "Scan PR records for 'Dockerfile' in filesChanged", result: "→ PR #846 mudou Dockerfile", time: "5ms" },
                  { query: "O que mudou no Dockerfile?", type: "API", dynamo: "GET /repos/checkout/pulls/846/files", result: "→ Base image node:20 → node:22", time: "~200ms" },
                  { query: "CI config mudou?", type: "Index", dynamo: "PK=T#t1|REPO#checkout SK=META → config.ci", result: "→ deploy.yml unchanged", time: "2ms" },
                ]
              },
              {
                scenario: "Cenário 3: 'É seguro deployar?' (peace-time)",
                color: "border-emerald-500/30",
                steps: [
                  { query: "Deps do repo a ser deployado?", type: "Index", dynamo: "PK=T#t1|REPO#payment SK begins_with PKG_DEP#", result: "→ shared-sdk@2.1.0 (desatualizado!)", time: "2ms" },
                  { query: "Versão atual do shared-sdk?", type: "Index", dynamo: "PK=T#t1|PKG#shared-sdk SK=META", result: "→ latest: 2.2.0, breaking: price→unitPrice", time: "2ms" },
                  { query: "Incidentes recentes em serviços similares?", type: "Index", dynamo: "PK=T#t1|SVC#checkout-api SK begins_with INC#", result: "→ inc-789: shared-sdk breaking change (2h ago)", time: "2ms" },
                  { query: "Resultado:", type: "Agent", dynamo: "", result: "⚠️ RISCO: payment usa shared-sdk@2.1.0. Mesmo bug que causou inc-789.", time: "" },
                ]
              },
            ].map((s, i) => (
              <div key={i} className={`bg-slate-900 border ${s.color} rounded-xl p-5`}>
                <h3 className="text-slate-200 text-sm font-bold mb-3">{s.scenario}</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-2 py-1 text-left text-slate-500 w-6">#</th>
                        <th className="px-2 py-1 text-left text-slate-500">Pergunta do Agent</th>
                        <th className="px-2 py-1 text-center text-slate-500 w-16">Fonte</th>
                        <th className="px-2 py-1 text-left text-slate-500">Query / API Call</th>
                        <th className="px-2 py-1 text-left text-slate-500">Resultado</th>
                        <th className="px-2 py-1 text-center text-slate-500 w-14">Tempo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {s.steps.map((step, j) => (
                        <tr key={j}>
                          <td className="px-2 py-1 text-slate-600">{j+1}</td>
                          <td className="px-2 py-1 text-slate-300">{step.query}</td>
                          <td className="px-2 py-1 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-xs ${
                              step.type === "Index" ? "bg-emerald-500/20 text-emerald-400" :
                              step.type === "API" ? "bg-cyan-500/20 text-cyan-400" :
                              "bg-amber-500/20 text-amber-400"
                            }`}>{step.type}</span>
                          </td>
                          <td className="px-2 py-1 text-slate-500 font-mono" style={{ fontSize: "10px" }}>{step.dynamo}</td>
                          <td className="px-2 py-1 text-amber-400">{step.result}</td>
                          <td className="px-2 py-1 text-center text-slate-500">{step.time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            <div className="bg-slate-900 border border-violet-500/30 rounded-xl p-5">
              <h3 className="text-violet-400 text-sm font-bold mb-2">Padrão: Index primeiro, API só quando precisa</h3>
              <p className="text-xs text-slate-400">
                Queries no Index (DynamoDB) custam ~2ms e não gastam rate limit.
                Queries na API (GitHub/Azure) custam ~200ms e gastam rate limit (5000/h).
                O agent sempre consulta o Index primeiro para saber ONDE olhar,
                depois usa a API para ler o conteúdo específico. Isso minimiza API calls
                e maximiza velocidade. Em uma investigação típica: ~8 queries no Index + ~3 API calls.
              </p>
            </div>
          </div>
        )}

        {activeTab === "phases" && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold" style={{ fontFamily: "'Plus Jakarta Sans'" }}>
              Fases de Implementação
            </h2>

            <div className="space-y-4">
              {[
                {
                  phase: "Fase 1 — MVP", sprint: "Sprint 1-4", weeks: "~2 semanas",
                  color: "border-emerald-500/30",
                  items: [
                    { what: "Git Provider port + GitHub adapter", detail: "readFile, getPRDiff, getTree, getPRMetadata" },
                    { what: "Git Provider port + Azure Repos adapter", detail: "Mesma interface, Azure DevOps API" },
                    { what: "Webhook receiver", detail: "POST /webhooks/github, POST /webhooks/azure-repos" },
                    { what: "Code Indexer — dependency extraction", detail: "JSON.parse de package.json, requirements.txt, go.mod" },
                    { what: "Code Indexer — config extraction", detail: "Dockerfile, CI configs, file map" },
                    { what: "ElectroDB entities", detail: "RepoNode, PackageDependency, PRRecord, RepoServiceMap" },
                    { what: "Code Analyzer sub-agent — tools básicos", detail: "get_deps, find_dependents, recent_prs, read_file, get_pr_diff" },
                  ],
                  result: "Agent consegue: ver deps, identificar PRs recentes, ler código on-demand, calcular blast radius"
                },
                {
                  phase: "Fase 2 — Refinamento", sprint: "Sprint 5-7", weeks: "~1.5 semana",
                  color: "border-amber-500/30",
                  items: [
                    { what: "Tree-sitter integration", detail: "Parse imports de TS, Python, Go para granularidade de funções" },
                    { what: "Cross-repo search", detail: "GitHub Code Search API + cache de resultados" },
                    { what: "PR generation tool", detail: "Criar PR com fix sugerido (com approval gate)" },
                    { what: "Service ↔ Repo auto-mapping", detail: "Inferir qual repo deploya qual serviço via CI config" },
                  ],
                  result: "Agent consegue: blast radius fino (funções, não só packages), gerar PRs com fix, search cross-repo"
                },
                {
                  phase: "Fase 3 — Intelligence", sprint: "Sprint 8-9", weeks: "~1 semana",
                  color: "border-purple-500/30",
                  items: [
                    { what: "Breaking change detection", detail: "Comparar versões de deps, alertar se breaking change afeta outros repos" },
                    { what: "Code pattern memory", detail: "Após fix, registrar: 'quando shared-sdk muda field, verificar consumers'" },
                    { what: "Proactive code risk", detail: "Detectar deps desatualizadas, Dockerfiles com imagens vulneráveis" },
                  ],
                  result: "Agent aprende com fixes anteriores e previne problemas antes de acontecerem"
                },
              ].map((phase, i) => (
                <div key={i} className={`bg-slate-900 border ${phase.color} rounded-xl p-5`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-slate-200 text-sm font-bold">{phase.phase}</h3>
                    <div className="flex gap-2">
                      <span className="text-xs text-slate-500">{phase.sprint}</span>
                      <span className="text-xs text-violet-400 font-bold">{phase.weeks}</span>
                    </div>
                  </div>
                  <div className="space-y-1 mb-3">
                    {phase.items.map((item, j) => (
                      <div key={j} className="flex gap-2 text-xs">
                        <span className="text-emerald-400 mt-0.5">→</span>
                        <div>
                          <span className="text-slate-200 font-medium">{item.what}</span>
                          <span className="text-slate-500 ml-2">{item.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-amber-400 bg-slate-800/50 rounded p-2">{phase.result}</p>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <h3 className="text-slate-200 text-sm font-bold mb-3">Project Structure — Adições</h3>
              <Code title="Novos paths no projeto">{`
src/
├── shared/ports/
│   └── git-provider.ts                    # 🆕 Interface (read-only + write com approval)
│
├── modules/knowledge/
│   ├── sources/
│   │   ├── code-indexer.ts                # 🆕 Webhook → extract → DynamoDB
│   │   ├── github-indexer.ts              # 🆕 GitHub-specific extraction
│   │   ├── azure-repos-indexer.ts         # 🆕 Azure-specific extraction
│   │   └── treesitter-analyzer.ts         # 🆕 Fase 2: import analysis
│   └── entities/
│       ├── repo-node.ts                   # 🆕 Repository metadata
│       ├── package-dependency.ts          # 🆕 Package dep edge
│       ├── pr-record.ts                   # 🆕 PR history
│       └── repo-service-map.ts            # 🆕 Repo ↔ Service link
│
├── modules/investigation/agents/
│   └── code-analyzer/                     # 🆕 5th sub-agent
│       ├── tools.ts                       # 🆕 12 tools (index + API)
│       ├── system-prompt.ts               # 🆕 Specialized prompt
│       └── context-builder.ts             # 🆕 Build code context
│
├── infra/git/
│   ├── github-client.ts                   # 🆕 GitHub App API
│   ├── azure-repos-client.ts              # 🆕 Azure DevOps API
│   └── git-provider-registry.ts           # 🆕 Resolve by tenant`}</Code>
            </div>

            <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-5">
              <h3 className="text-violet-400 text-sm font-bold mb-2">Resumo ADR-011</h3>
              <div className="text-xs text-slate-300 space-y-1">
                <p><strong className="text-violet-400">Decisão:</strong> Indexação estrutural leve no DynamoDB + API on-demand. Zero embeddings, zero vector DB, zero clone.</p>
                <p><strong className="text-emerald-400">Indexa:</strong> Deps (package.json), file maps, configs (Dockerfile, CI), PR metadata. Tudo via webhooks.</p>
                <p><strong className="text-cyan-400">Lê on-demand:</strong> Código fonte, diffs de PRs, conteúdo de arquivos específicos. Via GitHub/Azure API.</p>
                <p><strong className="text-amber-400">Fase 2:</strong> Tree-sitter para imports granulares (quais funções/tipos são usados de qual pacote).</p>
                <p><strong className="text-slate-400">Princípio:</strong> O Index diz ONDE olhar. O Claude interpreta O QUÊ significa. Embedding tentaria fazer ambos — e faria ambos mal.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
