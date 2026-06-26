import { useState } from "react";

// ═══════════════════════════════════════════════════════════════
// ADR-010: Knowledge Graph + Self-Improvement + Peace-Time Ops
// The 3 pillars that differentiate us from Resolve.ai
// ═══════════════════════════════════════════════════════════════

const groups = [
  { id: "kg", label: "Knowledge Graph", icon: "🧠" },
  { id: "si", label: "Self-Improvement", icon: "🔄" },
  { id: "pt", label: "Peace-Time Ops", icon: "☮️" },
  { id: "impl", label: "Implementação", icon: "⚙️" },
];

const Badge = ({ children, color = "gray" }) => {
  const c = { green: "bg-green-100 text-green-800", red: "bg-red-100 text-red-800", amber: "bg-amber-100 text-amber-800", blue: "bg-blue-100 text-blue-800", purple: "bg-purple-100 text-purple-800", cyan: "bg-cyan-100 text-cyan-800", gray: "bg-gray-100 text-gray-800" };
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${c[color]}`}>{children}</span>;
};
const Code = ({ children, title }) => (
  <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-xs overflow-x-auto leading-relaxed">
    {title && <div className="text-gray-500 mb-2 text-xs">// {title}</div>}
    <pre className="whitespace-pre-wrap">{children}</pre>
  </div>
);
const Card = ({ title, children, accent = "gray" }) => {
  const b = { blue: "border-l-4 border-blue-500", red: "border-l-4 border-red-500", green: "border-l-4 border-green-500", amber: "border-l-4 border-amber-500", purple: "border-l-4 border-purple-500", cyan: "border-l-4 border-cyan-500", gray: "border border-gray-200" };
  return <div className={`bg-white rounded-lg p-5 ${b[accent]}`}>{title && <h4 className="font-bold text-gray-900 mb-3">{title}</h4>}{children}</div>;
};
const Alert = ({ type = "info", children }) => {
  const s = { info: "bg-blue-50 border-blue-200 text-blue-800", warning: "bg-amber-50 border-amber-200 text-amber-800", error: "bg-red-50 border-red-200 text-red-800", success: "bg-green-50 border-green-200 text-green-800" };
  return <div className={`border rounded-lg p-4 text-sm ${s[type]}`}>{children}</div>;
};

const sections = [
  // ═══════════════════════════════════════
  // KNOWLEDGE GRAPH
  // ═══════════════════════════════════════
  {
    id: "kg-overview", group: "kg", title: "Visão Geral", icon: "🌐",
    content: () => (
      <div className="space-y-5">
        <div className="bg-gradient-to-r from-purple-700 to-blue-700 text-white rounded-lg p-6">
          <h3 className="text-2xl font-bold mb-2">Knowledge Graph — O Cérebro da Plataforma</h3>
          <p className="text-purple-200">Grafo vivo de serviços, dependências, deploys, incidentes e padrões. Se atualiza automaticamente a cada mudança no ambiente. É o que transforma investigações de "começar do zero" para "começar sabendo tudo".</p>
        </div>

        <Alert type="error">
          <strong>Por que é o Gap #1:</strong> A Resolve.ai testa fornecedores quebrando a topologia de staging e verificando se o sistema atualiza o grafo em minutos. Sem Knowledge Graph, cada investigação é stateless — o agente não sabe quais serviços existem, o que depende de quê, nem o que mudou. É como um médico que nunca viu o histórico do paciente.
        </Alert>

        <Card title="O que o Knowledge Graph Responde" accent="purple">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
            <div className="space-y-1">
              <p className="font-bold text-purple-800">Topology</p>
              <p>• Quais serviços existem e qual o status de cada um?</p>
              <p>• Qual o tipo de cada serviço? (API, worker, database, cache)</p>
              <p>• Em que região/cluster cada serviço roda?</p>
              <p>• Quantas instâncias/replicas de cada?</p>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-purple-800">Dependências</p>
              <p>• Quem chama quem? (upstream → downstream)</p>
              <p>• Se o auth-service cair, quais serviços são afetados?</p>
              <p>• Quais serviços compartilham o mesmo database/cache?</p>
              <p>• Qual o blast radius de uma mudança no serviço X?</p>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-purple-800">Mudanças</p>
              <p>• Quais deploys aconteceram nas últimas N horas?</p>
              <p>• Quem fez o deploy e qual o diff?</p>
              <p>• Houve feature flag changes? Config changes? Infra changes?</p>
              <p>• Correlação temporal: deploy X → 15min depois → alert Y</p>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-purple-800">Histórico</p>
              <p>• Este serviço teve incidentes antes? Quais padrões?</p>
              <p>• Última vez que vimos estes sintomas, qual foi a causa?</p>
              <p>• Qual o MTTR médio deste serviço? Está melhorando?</p>
              <p>• Quem é o owner team? Quem resolveu da última vez?</p>
            </div>
          </div>
        </Card>

        <Card title="Resolve faz X. Nós fazemos X+Y." accent="green">
          <div className="text-sm text-gray-700 space-y-2">
            <p><strong>Resolve:</strong> Knowledge graph que se atualiza. "Living representation." Vago sobre implementação.</p>
            <p><strong>Nós, além disso:</strong></p>
            <p>• <strong>Graph temporal:</strong> Cada nó e edge tem timestamp — podemos fazer "time-travel" para ver o estado no momento do incidente</p>
            <p>• <strong>Blast radius scoring:</strong> Cada nó tem blast_radius_score calculado por fanout de dependências × criticidade</p>
            <p>• <strong>Health signal aggregation:</strong> Cada nó agrega sinais de saúde (latência, error rate, saturation) em real-time</p>
            <p>• <strong>Pattern memory integrado:</strong> O grafo não é só topologia — inclui padrões aprendidos de incidentes passados POR NÓ (detalhado na seção Self-Improvement)</p>
          </div>
        </Card>
      </div>
    ),
  },
  {
    id: "kg-entities", group: "kg", title: "Data Model", icon: "💾",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">ElectroDB Entities — Knowledge Graph</h3>
        <p className="text-sm text-gray-600">4 entidades core que formam o grafo. Todas no mesmo DynamoDB table (single-table design), com Collections para queries cross-entity eficientes.</p>

        <Code title="ServiceNode — Nó principal do grafo">{`const ServiceNode = new Entity({
  model: { entity: 'serviceNode', version: '1', service: 'sre' },
  attributes: {
    tenantId:       { type: 'string', required: true },
    serviceId:      { type: 'string', required: true },  // 'payment-api', 'auth-service'
    
    // ── Identity ──
    name:           { type: 'string' },       // Human-readable
    type:           { type: ['api','worker','database','cache','queue','gateway','cdn','external'] },
    runtime:        { type: 'string' },       // 'ecs-fargate', 'eks', 'azure-aks', 'lambda'
    language:       { type: 'string' },       // 'typescript', 'python', 'java'
    repository:     { type: 'string' },       // 'github.com/org/payment-api'
    
    // ── Topology ──
    cloudProvider:  { type: ['aws','azure'] },
    region:         { type: 'string' },       // 'sa-east-1', 'brazilsouth'
    cluster:        { type: 'string' },       // 'prod-cluster-1'
    namespace:      { type: 'string' },       // k8s namespace ou ECS cluster
    replicas:       { type: 'number' },
    
    // ── Ownership ──
    ownerTeam:      { type: 'string' },       // 'payments-team'
    ownerSlack:     { type: 'string' },       // '#payments-oncall'
    escalationPath: { type: 'list', items: { type: 'string' } },
    
    // ── Health (atualizado a cada 5min) ──
    health: {
      type: 'map',
      properties: {
        status:        { type: ['healthy','degraded','down','unknown'] },
        latencyP50:    { type: 'number' },    // ms
        latencyP99:    { type: 'number' },
        errorRate:     { type: 'number' },    // 0.0 - 1.0
        saturation:    { type: 'number' },    // CPU/mem % (0-1)
        lastChecked:   { type: 'string' },    // ISO timestamp
      },
    },
    
    // ── Graph Metadata ──
    blastRadius:    { type: 'number' },       // 0-100 score (computed)
    criticality:    { type: ['critical','high','medium','low'] },
    dependencyCount:{ type: 'number' },       // total downstream deps
    
    // ── Incident History ──
    incidentCount30d:  { type: 'number' },
    lastIncidentId:    { type: 'string' },
    mttrAvg30d:        { type: 'number' },    // seconds
    
    // ── Discovery ──
    discoveredAt:   { type: 'string' },
    discoveredBy:   { type: ['auto_aws','auto_azure','manual','cicd_webhook'] },
    lastUpdated:    { type: 'string' },
  },
  indexes: {
    primary:      { pk: { field: 'pk', composite: ['tenantId'] },
                    sk: { field: 'sk', composite: ['serviceId'] } },
    byTeam:       { index: 'gsi1', pk: { composite: ['tenantId','ownerTeam'] },
                    sk: { composite: ['serviceId'] } },
    byHealth:     { index: 'gsi2', pk: { composite: ['tenantId','health.status'] },
                    sk: { composite: ['blastRadius'] } },  // degraded first, high blast first
  },
  // Collection: tenant services — query all nodes + edges in one call
  collection: 'tenantGraph',
});`}</Code>

        <Code title="ServiceEdge — Aresta de dependência">{`const ServiceEdge = new Entity({
  model: { entity: 'serviceEdge', version: '1', service: 'sre' },
  attributes: {
    tenantId:     { type: 'string', required: true },
    edgeId:       { type: 'string', required: true },  // 'payment-api->auth-service'
    
    // ── Relationship ──
    sourceService:  { type: 'string' },     // upstream caller
    targetService:  { type: 'string' },     // downstream dependency
    edgeType:       { type: ['calls','reads','writes','publishes','subscribes','shares_db'] },
    protocol:       { type: ['http','grpc','tcp','sqs','sns','kafka','redis'] },
    
    // ── Traffic (atualizado a cada 5min) ──
    traffic: {
      type: 'map',
      properties: {
        rps:          { type: 'number' },     // requests per second
        errorRate:    { type: 'number' },     // 0.0 - 1.0
        latencyP50:   { type: 'number' },
        latencyP99:   { type: 'number' },
      },
    },
    
    // ── Criticality ──
    isCriticalPath:  { type: 'boolean' },    // true = no fallback if target dies
    hasFallback:     { type: 'boolean' },    // circuit breaker, retry, cache
    hasCircuitBreaker:{ type: 'boolean' },
    
    // ── Discovery ──
    discoveredBy: { type: ['trace_analysis','config_scan','manual','service_mesh'] },
    confidence:   { type: 'number' },        // 0-1 (auto-discovered = lower)
    firstSeen:    { type: 'string' },
    lastSeen:     { type: 'string' },        // stale edges get flagged
  },
  indexes: {
    primary:     { pk: { composite: ['tenantId'] },
                   sk: { composite: ['edgeId'] } },
    bySource:    { index: 'gsi1', pk: { composite: ['tenantId','sourceService'] },
                   sk: { composite: ['targetService'] } },
    byTarget:    { index: 'gsi2', pk: { composite: ['tenantId','targetService'] },
                   sk: { composite: ['sourceService'] } },
  },
  collection: 'tenantGraph',
});`}</Code>

        <Code title="ChangeEvent — Timeline de mudanças">{`const ChangeEvent = new Entity({
  model: { entity: 'changeEvent', version: '1', service: 'sre' },
  attributes: {
    tenantId:     { type: 'string', required: true },
    changeId:     { type: 'string', required: true },
    
    // ── What changed ──
    changeType:   { type: ['deploy','config','infra','feature_flag','scale','rollback','migration'] },
    serviceId:    { type: 'string' },         // affected service node
    description:  { type: 'string' },         // "Deployed v2.4.1 to payment-api"
    
    // ── Source of truth ──
    source:       { type: ['cloudtrail','activity_log','cicd_webhook','github','argocd','manual'] },
    sourceRef:    { type: 'string' },         // commit SHA, deploy ID, event ID
    
    // ── Who & When ──
    actor:        { type: 'string' },         // "joao@empresa.com" or "github-actions"
    timestamp:    { type: 'string' },
    
    // ── Impact (calculated post-hoc) ──
    riskScore:    { type: 'number' },         // 0-100 (based on blast radius + time)
    affectedServices: { type: 'list', items: { type: 'string' } },
    
    // ── Diff (para deploys) ──
    diff: {
      type: 'map',
      properties: {
        commitSha:    { type: 'string' },
        prUrl:        { type: 'string' },
        filesChanged: { type: 'number' },
        linesAdded:   { type: 'number' },
        linesRemoved: { type: 'number' },
        summary:      { type: 'string' },     // LLM-generated 1-line summary
      },
    },
    
    // ── Post-incident linkage ──
    linkedIncidentId: { type: 'string' },     // se este change causou incidente
    linkedAt:         { type: 'string' },
  },
  indexes: {
    primary:       { pk: { composite: ['tenantId'] },
                     sk: { composite: ['changeId'] } },
    byService:     { index: 'gsi1', pk: { composite: ['tenantId','serviceId'] },
                     sk: { composite: ['timestamp'] } },    // changes for a service, by time
    byTime:        { index: 'gsi2', pk: { composite: ['tenantId'] },
                     sk: { composite: ['timestamp'] } },    // all changes, by time
  },
});`}</Code>
        
        <Alert type="info">
          <strong>Collection Query:</strong> <code>tenantGraph</code> collection retorna ServiceNodes + ServiceEdges em uma única query DynamoDB. Isso permite reconstruir o grafo completo do tenant com 1 round-trip (~50ms).
        </Alert>
      </div>
    ),
  },
  {
    id: "kg-discovery", group: "kg", title: "Auto-Discovery", icon: "🔎",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Auto-Discovery — O Grafo se Constrói Sozinho</h3>
        <p className="text-sm text-gray-600">3 camadas de discovery que mantêm o grafo atualizado sem intervenção manual. O grafo cresce organicamente conforme o sistema evolui.</p>

        <Card title="Layer 1: Infrastructure Scan (batch, a cada 15 min)" accent="blue">
          <Code title="AWS Discovery">{`async function discoverAWSServices(tenantId: string) {
  const { cloud, credentials } = await registry.resolveForTenant(tenantId);
  const creds = await credentials.vendCredentials(tenantId, 'infra-inspector', 'discovery');
  
  // ECS Services
  const ecsClusters = await cloud.listClusters(creds);
  for (const cluster of ecsClusters) {
    const services = await cloud.describeServices(creds, { cluster });
    for (const svc of services) {
      await knowledgeGraph.upsertNode({
        tenantId, serviceId: svc.serviceName,
        type: 'api', runtime: 'ecs-fargate',
        cluster: cluster.name, region: creds.region,
        replicas: svc.desiredCount,
        health: { status: svc.runningCount === svc.desiredCount ? 'healthy' : 'degraded' },
        discoveredBy: 'auto_aws',
      });
    }
  }
  
  // RDS Instances → nodes tipo 'database'
  // ElastiCache → nodes tipo 'cache'
  // SQS Queues → nodes tipo 'queue'
  // ALB/NLB → nodes tipo 'gateway'
  // Lambda → nodes tipo 'worker'
  
  // Equivalente Azure: AKS pods, Azure SQL, Redis Cache, Service Bus, App Gateway
}`}</Code>
          <div className="text-xs text-gray-600 mt-2 space-y-1">
            <p><strong>Frequência:</strong> A cada 15 min para infraestrutura. Usa credenciais read-only (Log Analyzer session policy).</p>
            <p><strong>Delta detection:</strong> Compara com snapshot anterior. Se node sumiu → marca como 'decommissioned'. Se novo → marca como 'discovered'.</p>
          </div>
        </Card>

        <Card title="Layer 2: Event-Driven Updates (real-time)" accent="green">
          <Code title="CloudTrail / Activity Log → Graph Updates">{`// SQS consumer para eventos de mudança
async function handleCloudEvent(event: CloudEvent) {
  switch (event.type) {
    case 'ecs:UpdateService':
    case 'ecs:CreateService':
      await knowledgeGraph.upsertNode({
        tenantId: event.tenantId,
        serviceId: extractServiceName(event),
        replicas: event.detail.desiredCount,
        lastUpdated: event.timestamp,
      });
      await knowledgeGraph.addChangeEvent({
        tenantId: event.tenantId,
        changeType: event.type.includes('Create') ? 'deploy' : 'scale',
        serviceId: extractServiceName(event),
        actor: event.userIdentity,
        timestamp: event.timestamp,
        source: 'cloudtrail',
      });
      break;
      
    case 'codedeploy:DeploymentSucceeded':
      const deploy = event.detail;
      await knowledgeGraph.addChangeEvent({
        changeType: 'deploy',
        serviceId: deploy.applicationName,
        diff: {
          commitSha: deploy.revision?.gitHubLocation?.commitId,
          summary: await summarizeDeployWithLLM(deploy), // 1-line summary via Sonnet
        },
      });
      // Calcular riskScore baseado no blast radius do serviço
      const node = await knowledgeGraph.getNode(tenantId, deploy.applicationName);
      const risk = calculateDeployRisk(node, deploy);
      await knowledgeGraph.updateChangeEvent(changeId, { riskScore: risk });
      break;
      
    // GitHub webhook: push, PR merge → diff summary
    // Terraform Cloud: plan applied → infra change
    // LaunchDarkly: flag changed → feature_flag change
  }
}`}</Code>
        </Card>

        <Card title="Layer 3: Trace-Based Dependency Discovery (passive)" accent="purple">
          <Code title="OpenTelemetry Traces → Dependency Edges">{`// Processa traces para descobrir quem chama quem
async function discoverDependenciesFromTraces(tenantId: string) {
  const { cloud, credentials } = await registry.resolveForTenant(tenantId);
  const creds = await credentials.vendCredentials(tenantId, 'log-analyzer', 'trace-discovery');
  
  // Query traces das últimas 4 horas
  const traces = await cloud.queryTraces(creds, {
    timeRange: { last: '4h' },
    // X-Ray (AWS) ou Application Insights (Azure)
  });
  
  for (const trace of traces) {
    const spans = trace.segments;
    for (let i = 0; i < spans.length - 1; i++) {
      const parent = spans[i];
      const child = spans[i + 1];
      
      const edgeId = \`\${parent.serviceName}->\${child.serviceName}\`;
      await knowledgeGraph.upsertEdge({
        tenantId,
        edgeId,
        sourceService: parent.serviceName,
        targetService: child.serviceName,
        edgeType: inferEdgeType(child),  // 'calls' se HTTP, 'publishes' se SQS
        protocol: inferProtocol(child),
        traffic: {
          latencyP50: child.duration,
          errorRate: child.fault ? 1 : 0,
        },
        discoveredBy: 'trace_analysis',
        confidence: 0.95,  // high confidence — real traffic
        lastSeen: trace.timestamp,
      });
    }
  }
  
  // Detectar stale edges: se lastSeen > 7 dias, marcar como 'possibly_stale'
  await knowledgeGraph.flagStaleEdges(tenantId, { olderThan: '7d' });
}`}</Code>
          <p className="text-xs text-gray-600 mt-2"><strong>Sem traces?</strong> Fallback: parse config files (environment variables, connection strings) ou service mesh (Envoy, Istio) sidecar data. Confidence menor (0.7).</p>
        </Card>

        <Card title="Blast Radius Computation" accent="red">
          <Code title="Calculado a cada atualização do grafo">{`function computeBlastRadius(tenantId: string, serviceId: string): number {
  const edges = knowledgeGraph.getDownstreamEdges(tenantId, serviceId);
  
  let score = 0;
  const visited = new Set<string>();
  const queue = [{ service: serviceId, depth: 0 }];
  
  while (queue.length > 0) {
    const { service, depth } = queue.shift();
    if (visited.has(service) || depth > 5) continue;  // max 5 hops
    visited.add(service);
    
    const node = knowledgeGraph.getNode(tenantId, service);
    const critWeight = { critical: 10, high: 5, medium: 2, low: 1 }[node.criticality];
    const depthDecay = 1 / (depth + 1);  // closer deps = higher weight
    
    score += critWeight * depthDecay;
    
    // Buscar dependentes desse serviço (quem chama este nó)
    const dependents = knowledgeGraph.getEdgesByTarget(tenantId, service);
    for (const dep of dependents) {
      if (dep.isCriticalPath && !dep.hasFallback) {
        queue.push({ service: dep.sourceService, depth: depth + 1 });
      }
    }
  }
  
  return Math.min(Math.round(score), 100);
  // blast_radius = 87 → "se este serviço cair, impacta 87% da criticidade do sistema"
}`}</Code>
        </Card>
      </div>
    ),
  },
  {
    id: "kg-queries", group: "kg", title: "Graph Queries", icon: "🔍",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Knowledge Graph Queries — O que os Agentes Perguntam</h3>
        <p className="text-sm text-gray-600">Interface KnowledgeGraph que os sub-agentes usam durante investigações E peace-time. Cada query é O(1) ou O(N) no DynamoDB — sem graph database separada.</p>

        <Code title="src/shared/ports/knowledge-graph.ts">{`export interface KnowledgeGraph {
  // ── Topology ──
  getNode(tenantId, serviceId): Promise<ServiceNode>;
  listNodes(tenantId, filters?: { team?, health?, type? }): Promise<ServiceNode[]>;
  getFullGraph(tenantId): Promise<{ nodes: ServiceNode[], edges: ServiceEdge[] }>;
  
  // ── Dependencies ──
  getUpstream(tenantId, serviceId): Promise<ServiceEdge[]>;    // quem ME chama
  getDownstream(tenantId, serviceId): Promise<ServiceEdge[]>;  // quem EU chamo
  getBlastRadius(tenantId, serviceId): Promise<{
    score: number;
    affectedServices: { serviceId: string; depth: number; critical: boolean }[];
  }>;
  getCriticalPath(tenantId, from: string, to: string): Promise<ServiceEdge[]>;
  
  // ── Changes ──
  getRecentChanges(tenantId, opts: { serviceId?, last?: string, limit?: number }): Promise<ChangeEvent[]>;
  getChangesInWindow(tenantId, start: string, end: string): Promise<ChangeEvent[]>;
  correlateChangeWithIncident(tenantId, incidentTimestamp: string): Promise<{
    suspiciousChanges: ChangeEvent[];  // changes nos 60min antes do incidente
    ranking: { changeId: string; suspicionScore: number }[];
  }>;
  
  // ── Health ──
  getSystemHealth(tenantId): Promise<{
    healthy: number; degraded: number; down: number; unknown: number;
    topOffenders: ServiceNode[];  // by incidentCount30d desc
    recentChanges: ChangeEvent[]; // last 4h
  }>;
  getDegradedServices(tenantId): Promise<ServiceNode[]>;
  
  // ── Time Travel ──
  getGraphSnapshot(tenantId, asOf: string): Promise<{ nodes: ServiceNode[], edges: ServiceEdge[] }>;
  
  // ── Mutations (auto-discovery + events) ──
  upsertNode(node: Partial<ServiceNode>): Promise<void>;
  upsertEdge(edge: Partial<ServiceEdge>): Promise<void>;
  addChangeEvent(event: Partial<ChangeEvent>): Promise<void>;
  flagStaleEdges(tenantId, opts: { olderThan: string }): Promise<number>;
}`}</Code>

        <Card title="Uso na Investigação: correlateChangeWithIncident" accent="amber">
          <Code>{`// Dentro do Orchestrator, ao iniciar investigação:
async function enrichInvestigationContext(tenantId, incidentTimestamp) {
  const kg = registry.resolveKnowledgeGraph(tenantId);
  
  // 1. Mudanças suspeitas nos últimos 60 min
  const { suspiciousChanges, ranking } = await kg.correlateChangeWithIncident(
    tenantId, incidentTimestamp
  );
  // → "Deploy v2.4.1 no payment-api há 23 min (suspicion: 89%)"
  // → "Config change no redis-cluster há 45 min (suspicion: 34%)"
  
  // 2. Blast radius do serviço afetado
  const { score, affectedServices } = await kg.getBlastRadius(tenantId, affectedServiceId);
  // → "blast_radius: 87/100 — afeta auth-service, checkout, order-service"
  
  // 3. Histórico do serviço
  const node = await kg.getNode(tenantId, affectedServiceId);
  // → "payment-api: 5 incidentes nos últimos 30d, MTTR médio: 47min"
  // → "Owner: payments-team, Slack: #payments-oncall"
  
  // 4. Padrões aprendidos (do Self-Improvement module)
  const patterns = await learningEngine.findSimilarPatterns(tenantId, symptoms);
  // → "Padrão INC-234: mesmos sintomas, root cause: connection pool config"
  
  // Tudo isso vira contexto para o Orchestrator antes de acionar sub-agentes
  return { suspiciousChanges, ranking, blastRadius: score, affectedServices, node, patterns };
}`}</Code>
        </Card>
      </div>
    ),
  },
  // ═══════════════════════════════════════
  // SELF-IMPROVEMENT (LEARNING ENGINE)
  // ═══════════════════════════════════════
  {
    id: "si-overview", group: "si", title: "Visão Geral", icon: "🧬",
    content: () => (
      <div className="space-y-5">
        <div className="bg-gradient-to-r from-green-700 to-teal-700 text-white rounded-lg p-6">
          <h3 className="text-2xl font-bold mb-2">Self-Improvement Engine — Além da Resolve</h3>
          <p className="text-green-200">A Resolve diz "learns from every incident". Nós vamos além: 5 feedback loops que fazem a plataforma ficar mais inteligente a cada interação, e NÃO só com incidentes.</p>
        </div>

        <Alert type="warning">
          <strong>O Problema da Resolve:</strong> Eles falam de "learning" como pilar mas são vagos na implementação. Dizem "persistent memory" e "knowledge graph learns" sem explicar COMO. É provável que seja RAG simples (vetor de incidentes passados). Nós podemos fazer muito melhor.
        </Alert>

        <Card title="5 Feedback Loops — Mais que RAG" accent="green">
          <div className="space-y-4">
            {[
              { loop: "1. Pattern Extraction", icon: "🔬", desc: "Após cada incidente resolvido, extrair padrão estruturado: (symptoms, root_cause, fix, blast_radius, context). Armazenado como entity no DynamoDB. Usado como retrieval context nas próximas investigações. Diferente de RAG puro: o padrão é ESTRUTURADO, não texto livre.", diff: "RAG: busca por similaridade textual. Nós: match por symptoms + service type + infra context." },
              { loop: "2. Confidence Evolution", icon: "📈", desc: "Cada padrão tem confidence score que EVOLUI. Começa em 50% (primeira ocorrência). Sobe quando: engenheiro confirma RCA, padrão resolve outro incidente. Desce quando: engenheiro corrige o RCA, padrão falha. Após 3 confirmações → 90%+ → vira candidato a runbook automático.", diff: "Resolve: 'improves from outcomes'. Nós: cada padrão tem lifecycle rastreável com audit trail." },
              { loop: "3. Human Feedback Integration", icon: "👤", desc: "Engenheiro interage via Slack/Teams: confirmar/rejeitar hipótese, corrigir RCA, adicionar contexto. Cada interação é um sinal de treino. Não precisamos de fine-tuning — usamos os sinais para re-rankear padrões e ajustar confidence.", diff: "Resolve: 'feedback without manual retraining'. Nós: feedback granular (hipótese A errada, B correta, por quê)." },
              { loop: "4. Cross-Incident Learning", icon: "🔗", desc: "Detectar padrões cross-service: 'toda vez que team-X deploya no horário Y, incidentes aumentam 3x'. Ou: 'deployments do service-A seguidos de config change no service-B em <30min causam cascading failure 40% das vezes'. São meta-padrões que nenhum humano detectaria.", diff: "Resolve: 'learn from outcomes'. Nós: aprender RELAÇÕES CAUSAIS entre mudanças e incidentes." },
              { loop: "5. Auto-Runbook Generation", icon: "📝", desc: "Quando um padrão atinge confidence >90% e >3 ocorrências, gerar runbook automaticamente. O runbook inclui: detection (quais sinais monitorar), diagnosis (quais queries rodar), remediation (quais ações tomar). Pode virar remediação automática com approval gate.", diff: "Resolve: 'patterns reduce toil'. Nós: padrões VIRAM runbooks executáveis automaticamente." },
            ].map((l, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{l.icon}</span>
                  <span className="font-bold text-gray-900">{l.loop}</span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{l.desc}</p>
                <div className="bg-green-50 border border-green-200 rounded p-2">
                  <p className="text-xs text-green-800"><strong>Diferencial vs Resolve:</strong> {l.diff}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    ),
  },
  {
    id: "si-entities", group: "si", title: "Data Model", icon: "💾",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Entities do Self-Improvement Engine</h3>

        <Code title="Pattern — Padrão aprendido de incidentes">{`const Pattern = new Entity({
  model: { entity: 'pattern', version: '1', service: 'sre' },
  attributes: {
    tenantId:      { type: 'string', required: true },
    patternId:     { type: 'string', required: true },
    
    // ── Fingerprint (para matching) ──
    symptoms: {
      type: 'list', items: {
        type: 'map', properties: {
          signal:    { type: ['error_rate_spike','latency_increase','5xx_spike',
                             'oom_kill','connection_timeout','queue_depth',
                             'cpu_saturation','disk_full','cert_expired','dns_failure'] },
          service:   { type: 'string' },      // 'payment-api' ou '*' para qualquer
          threshold: { type: 'string' },      // '>5%', '>500ms', '>90%'
        },
      },
    },
    serviceType:    { type: 'string' },       // 'api', 'database', etc — para match genérico
    infraContext:   { type: 'string' },       // 'ecs-fargate', 'eks', 'azure-aks'
    
    // ── Root Cause (aprendido) ──
    rootCause: {
      type: 'map', properties: {
        category:   { type: ['config_change','code_regression','infra_failure',
                            'dependency_failure','capacity','security','external'] },
        description:{ type: 'string' },
        evidence:   { type: 'list', items: { type: 'string' } },  // log lines, metric names
      },
    },
    
    // ── Fix (aprendido) ──
    fix: {
      type: 'map', properties: {
        action:      { type: ['rollback_deploy','revert_config','scale_up','restart',
                              'flush_cache','rotate_cert','failover','manual'] },
        description: { type: 'string' },
        automated:   { type: 'boolean' },     // true = can be auto-executed
        runbookId:   { type: 'string' },      // ref to auto-generated runbook
      },
    },
    
    // ── Confidence Lifecycle ──
    confidence:    { type: 'number' },        // 0.0 - 1.0
    occurrences:   { type: 'number' },        // quantas vezes visto
    confirmations: { type: 'number' },        // vezes que humano confirmou
    rejections:    { type: 'number' },        // vezes que humano rejeitou
    lastSeen:      { type: 'string' },
    firstSeen:     { type: 'string' },
    
    // ── Lifecycle Status ──
    status: { type: ['learning','stable','runbook_candidate','auto_remediation','deprecated'] },
    //  learning:            < 3 ocorrências, confidence < 0.7
    //  stable:              >= 3 ocorrências, confidence >= 0.7
    //  runbook_candidate:   confidence >= 0.9, >= 5 ocorrências
    //  auto_remediation:    runbook approved for auto-execution
    //  deprecated:          confidence dropped < 0.3 ou 90d sem ocorrência
    
    // ── Provenance ──
    sourceIncidents: { type: 'list', items: { type: 'string' } },  // IDs dos incidentes fonte
    lastFeedback:    { type: 'string' },      // ISO timestamp
  },
  indexes: {
    primary:       { pk: { composite: ['tenantId'] },
                     sk: { composite: ['patternId'] } },
    byCategory:    { index: 'gsi1', pk: { composite: ['tenantId','rootCause.category'] },
                     sk: { composite: ['confidence'] } },
    byStatus:      { index: 'gsi2', pk: { composite: ['tenantId','status'] },
                     sk: { composite: ['occurrences'] } },
  },
});`}</Code>

        <Code title="FeedbackEvent — Registro de cada interação humana">{`const FeedbackEvent = new Entity({
  model: { entity: 'feedback', version: '1', service: 'sre' },
  attributes: {
    tenantId:      { type: 'string', required: true },
    feedbackId:    { type: 'string', required: true },
    
    // ── Context ──
    incidentId:    { type: 'string' },
    patternId:     { type: 'string' },
    hypothesisId:  { type: 'string' },
    
    // ── Feedback ──
    type:          { type: ['confirm_rca','reject_rca','correct_rca','confirm_fix',
                           'reject_fix','add_context','redirect_investigation',
                           'rate_quality','approve_runbook'] },
    actor:         { type: 'string' },       // "joao@empresa.com"
    channel:       { type: ['slack','teams','dashboard','api'] },
    
    // ── Detail ──
    originalValue: { type: 'string' },       // o que o agente disse
    correctedValue:{ type: 'string' },       // o que o humano corrigiu
    freeText:      { type: 'string' },       // contexto adicional do humano
    
    // ── Impact ──
    confidenceDelta: { type: 'number' },     // +0.15 ou -0.20
    timestamp:     { type: 'string' },
  },
  indexes: {
    primary:      { pk: { composite: ['tenantId'] },
                    sk: { composite: ['feedbackId'] } },
    byIncident:   { index: 'gsi1', pk: { composite: ['tenantId','incidentId'] },
                    sk: { composite: ['timestamp'] } },
    byPattern:    { index: 'gsi2', pk: { composite: ['tenantId','patternId'] },
                    sk: { composite: ['timestamp'] } },
  },
});`}</Code>
      </div>
    ),
  },
  {
    id: "si-engine", group: "si", title: "Learning Engine", icon: "🔬",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Learning Engine — Os 5 Loops em Detalhe</h3>

        <Card title="Loop 1: Pattern Extraction (pós-incidente)" accent="green">
          <Code>{`// Roda automaticamente quando incidente é resolvido
async function extractPattern(tenantId: string, incidentId: string) {
  const incident = await incidentStore.get(tenantId, incidentId);
  const investigation = await investigationStore.get(tenantId, incidentId);
  
  // Usar Claude Sonnet para extrair padrão estruturado da investigação
  const extraction = await agentSdk.run({
    model: 'sonnet-4.5',
    systemPrompt: PATTERN_EXTRACTION_PROMPT,
    userPrompt: \`
      Incident: \${JSON.stringify(incident)}
      Investigation: \${JSON.stringify(investigation)}
      
      Extract a structured pattern:
      1. symptoms: list of observable signals that indicated this incident
      2. rootCause: category + description + evidence
      3. fix: action taken + whether it could be automated
      4. contextFactors: what infra/config/timing conditions made this happen
    \`,
  });
  
  // Verificar se padrão similar já existe
  const existing = await patternMatcher.findSimilar(tenantId, extraction.symptoms);
  
  if (existing && existing.similarity > 0.85) {
    // Incrementar ocorrência do padrão existente
    await patternStore.update(tenantId, existing.patternId, {
      occurrences: existing.occurrences + 1,
      confidence: bayesianUpdate(existing.confidence, true),  // observation confirms pattern
      lastSeen: new Date().toISOString(),
      sourceIncidents: [...existing.sourceIncidents, incidentId],
    });
    await promoteIfReady(tenantId, existing.patternId);
  } else {
    // Criar novo padrão
    await patternStore.create({
      tenantId, patternId: generateId(),
      symptoms: extraction.symptoms,
      rootCause: extraction.rootCause,
      fix: extraction.fix,
      confidence: 0.50,  // starts at 50%
      occurrences: 1, confirmations: 0, rejections: 0,
      status: 'learning',
      sourceIncidents: [incidentId],
    });
  }
}`}</Code>
        </Card>

        <Card title="Loop 2: Confidence Evolution (Bayesian)" accent="blue">
          <Code>{`// Confidence evolui com Bayesian update — não é linear!
function bayesianUpdate(prior: number, positive: boolean): number {
  // P(pattern correct | evidence) via Bayes
  const likelihoodIfTrue = positive ? 0.9 : 0.2;   // P(evidence | correct)
  const likelihoodIfFalse = positive ? 0.3 : 0.8;   // P(evidence | incorrect)
  
  const numerator = likelihoodIfTrue * prior;
  const denominator = numerator + likelihoodIfFalse * (1 - prior);
  
  return Math.max(0.05, Math.min(0.99, numerator / denominator));
}

// Lifecycle transitions baseadas em confidence + ocorrências
async function promoteIfReady(tenantId: string, patternId: string) {
  const pattern = await patternStore.get(tenantId, patternId);
  
  if (pattern.status === 'learning' && 
      pattern.confidence >= 0.70 && pattern.occurrences >= 3) {
    await patternStore.update(tenantId, patternId, { status: 'stable' });
    // Notificar team: "Novo padrão estável detectado para payment-api"
  }
  
  if (pattern.status === 'stable' && 
      pattern.confidence >= 0.90 && pattern.occurrences >= 5) {
    await patternStore.update(tenantId, patternId, { status: 'runbook_candidate' });
    // Gerar runbook automaticamente (Loop 5)
    await generateRunbook(tenantId, patternId);
    // Notificar team: "Runbook candidato gerado. Revisar e aprovar?"
  }
  
  if (pattern.confidence < 0.30 || 
      daysSince(pattern.lastSeen) > 90) {
    await patternStore.update(tenantId, patternId, { status: 'deprecated' });
  }
}

// Exemplo de evolução real:
// Incidente 1: payment-api timeout → config change → confidence: 0.50
// Incidente 2: mesmos sintomas → engenheiro confirma → confidence: 0.73 → status: stable
// Incidente 3: mesmos sintomas → auto-detecta → confidence: 0.86
// Incidente 4: engenheiro confirma de novo → confidence: 0.93 → status: runbook_candidate
// Engenheiro aprova runbook → status: auto_remediation
// Próximo incidente idêntico: AUTO-RESOLVE com approval gate!`}</Code>
        </Card>

        <Card title="Loop 3: Human Feedback Integration" accent="purple">
          <Code>{`// Slack/Teams: botão de feedback em cada hipótese apresentada
// ┌──────────────────────────────────────────────────────┐
// │ 🔍 Hipótese #1 (confidence: 78%)                     │
// │ Root cause: Config change no connection pool           │
// │ há 23 min (deploy v2.4.1 por joao@empresa.com)        │
// │                                                        │
// │ Evidence: Log line "max connections reached" +          │
// │ Latency spike coincide com deploy timestamp             │
// │                                                        │
// │ [✅ Correto] [❌ Incorreto] [✏️ Parcial] [💬 Contexto] │
// └──────────────────────────────────────────────────────┘

async function handleFeedback(interaction: SlackInteraction) {
  const { action, incidentId, hypothesisId, patternId } = interaction.data;
  
  switch (action) {
    case 'confirm':
      // Boost confidence do padrão + registrar feedback
      await learningEngine.recordFeedback({
        tenantId, incidentId, patternId, hypothesisId,
        type: 'confirm_rca',
        actor: interaction.userId,
        confidenceDelta: +0.15,
      });
      break;
      
    case 'reject':
      // Penalizar confidence + pedir correção
      await learningEngine.recordFeedback({
        type: 'reject_rca',
        confidenceDelta: -0.20,
      });
      // Abrir modal: "Qual foi a causa real?"
      await chat.openModal(interaction, CORRECTION_MODAL);
      break;
      
    case 'correct':
      // Registrar correção + criar/atualizar padrão com a causa real
      const correction = interaction.modalValues;
      await learningEngine.recordFeedback({
        type: 'correct_rca',
        originalValue: hypothesis.rootCause,
        correctedValue: correction.actualRootCause,
        freeText: correction.additionalContext,
        confidenceDelta: -0.25,  // penalize original
      });
      // Criar novo padrão (ou boostar existente) com a correção
      await learningEngine.extractPatternFromCorrection(tenantId, incidentId, correction);
      break;
      
    case 'add_context':
      // Contexto adicional alimenta futuras investigações
      // "Isso acontece toda segunda-feira de manhã por causa do batch job"
      await learningEngine.recordFeedback({
        type: 'add_context',
        freeText: interaction.text,
        // Sem confidenceDelta — apenas enriquecimento
      });
      break;
  }
}`}</Code>
        </Card>

        <Card title="Loop 4: Cross-Incident Learning (meta-padrões)" accent="amber">
          <Code>{`// Roda semanalmente: analisa todos os incidentes do tenant para detectar
// correlações que nenhum humano detectaria
async function discoverMetaPatterns(tenantId: string) {
  const incidents = await incidentStore.list(tenantId, { last: '90d' });
  const changes = await knowledgeGraph.getRecentChanges(tenantId, { last: '90d' });
  
  // Usar Claude Opus para análise profunda de correlações
  const analysis = await agentSdk.run({
    model: 'opus-4.5',
    systemPrompt: META_PATTERN_ANALYSIS_PROMPT,
    userPrompt: \`
      Analyze these \${incidents.length} incidents and \${changes.length} changes.
      Find non-obvious correlations:
      
      1. TIME PATTERNS: Do incidents cluster on specific days/hours?
         (e.g., "Monday 9am deployments cause 3x more incidents")
      
      2. CHANGE CASCADES: Do changes in service A reliably precede 
         incidents in service B within N minutes?
         (e.g., "auth-service deploy → payment-api timeout within 30min, 40% of the time")
      
      3. CAPACITY PATTERNS: Do incidents correlate with traffic patterns?
         (e.g., "incidents spike when RPS > 1000 on payment-api, usually Thursday 3pm")
      
      4. TEAM PATTERNS: Do specific teams/actors correlate with incident types?
         (e.g., "deployments by CI/CD (not humans) have 2x fewer incidents")
      
      5. RECOVERY PATTERNS: Which fix actions actually resolve vs just mask?
         (e.g., "restart fixes symptoms but issue recurs within 24h — real fix is config change")
      
      Return structured MetaPattern[] with evidence and confidence.
    \`,
  });
  
  for (const metaPattern of analysis.patterns) {
    await patternStore.createMetaPattern({
      tenantId, ...metaPattern,
      confidence: 0.60,  // meta-patterns start cautiously
      status: 'learning',
    });
    
    // Notificar: "🔍 Insight detectado: deployments no payment-api entre 
    //  17h-19h têm 3.2x mais chance de causar incidentes que deployments 
    //  entre 10h-14h. Baseado em 14 incidentes nos últimos 90 dias."
  }
}`}</Code>
        </Card>

        <Card title="Loop 5: Auto-Runbook Generation" accent="red">
          <Code>{`// Quando pattern atinge runbook_candidate, gerar runbook executável
async function generateRunbook(tenantId: string, patternId: string) {
  const pattern = await patternStore.get(tenantId, patternId);
  
  const runbook = await agentSdk.run({
    model: 'sonnet-4.5',
    systemPrompt: RUNBOOK_GENERATION_PROMPT,
    userPrompt: \`
      Generate an executable runbook from this pattern:
      Pattern: \${JSON.stringify(pattern)}
      
      The runbook must have 3 phases:
      1. DETECT: What signals trigger this runbook? (metrics, logs, alerts)
         → These become the anomaly scanner rules
      2. DIAGNOSE: What queries confirm the root cause?
         → CloudWatch/Log Analytics queries, specific log patterns
      3. REMEDIATE: What actions fix it?
         → API calls, config changes, rollbacks — with pre/post validation
      
      Each step must be:
      - Specific (exact query, exact API call)
      - Safe (read-only diagnosis, write only with approval)
      - Verifiable (how to confirm the fix worked)
    \`,
  });
  
  await runbookStore.create({
    tenantId, runbookId: generateId(),
    patternId,
    name: \`Auto: \${pattern.rootCause.description}\`,
    status: 'pending_review',  // humano precisa aprovar antes de auto-execute
    detect: runbook.detect,    // → alimenta anomaly scanner
    diagnose: runbook.diagnose,
    remediate: runbook.remediate,
    approvedBy: null,
    approvedAt: null,
  });
  
  // Notificar team no Slack/Teams:
  // "📝 Runbook auto-gerado para 'connection pool exhaustion on payment-api'
  //  Baseado em 5 incidentes (confidence: 93%). 
  //  Revisar e aprovar: [link para dashboard]
  //  [✅ Aprovar] [✏️ Editar] [❌ Rejeitar]"
}`}</Code>
        </Card>
      </div>
    ),
  },
  {
    id: "si-retrieval", group: "si", title: "Pattern Retrieval", icon: "🎯",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Pattern Matching — Mais Inteligente que RAG</h3>

        <Alert type="info">
          <strong>Por que não RAG puro?</strong> RAG busca por similaridade textual (embedding cosine). Para incidentes, texto similar ≠ causa similar. "payment-api 502 error" pode ser: config change, dependency timeout, OOM kill, cert expired — textos similares, causas completamente diferentes. Nosso matching usa SYMPTOMS ESTRUTURADOS + infra context.
        </Alert>

        <Code title="Pattern Matcher — Structured Symptom Matching">{`class PatternMatcher {
  // Buscar padrões similares usando symptoms ESTRUTURADOS
  async findSimilar(tenantId: string, currentSymptoms: Symptom[]): Promise<PatternMatch[]> {
    
    // Fase 1: DynamoDB query — filtrar por categoria de root cause
    // (reduz universo de padrões de 1000 para ~50)
    const candidates = await patternStore.listByStatus(tenantId, {
      status: ['stable', 'runbook_candidate', 'auto_remediation'],
      minConfidence: 0.5,
    });
    
    // Fase 2: Structured matching — cada symptom é um sinal discreto
    const scored = candidates.map(pattern => {
      let score = 0;
      let matchedSymptoms = 0;
      
      for (const currentSym of currentSymptoms) {
        for (const patternSym of pattern.symptoms) {
          // Match exato de signal type
          if (currentSym.signal === patternSym.signal) {
            score += 0.3;
            matchedSymptoms++;
            
            // Bonus: mesmo serviço
            if (currentSym.service === patternSym.service) score += 0.3;
            // Bonus: mesmo tipo de serviço (genérico)
            else if (patternSym.service === '*') score += 0.1;
          }
        }
      }
      
      // Bonus: mesmo tipo de infra
      const currentNode = knowledgeGraph.getNode(tenantId, currentSymptoms[0].service);
      if (currentNode?.runtime === pattern.infraContext) score += 0.2;
      
      // Penalidade: padrão tem symptoms que NÃO estamos vendo
      const unmatchedPatternSymptoms = pattern.symptoms.length - matchedSymptoms;
      score -= unmatchedPatternSymptoms * 0.1;
      
      // Weight by confidence
      const finalScore = score * pattern.confidence;
      
      return {
        pattern,
        matchScore: finalScore,
        matchedSymptoms,
        totalPatternSymptoms: pattern.symptoms.length,
      };
    });
    
    // Top 3, score > 0.4
    return scored
      .filter(s => s.matchScore > 0.4)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);
  }
}

// Como isso aparece para o agente no contexto da investigação:
// ┌──────────────────────────────────────────────────────────┐
// │ 🧠 PATTERNS ENCONTRADOS (do Knowledge Graph):             │
// │                                                            │
// │ 1. [93% confidence] Connection pool exhaustion             │
// │    Visto 5x nos últimos 60d. Último: INC-234 (12 dias).   │
// │    Sintomas: error_rate_spike + connection_timeout          │
// │    Fix: Revert config do pool size (RUNBOOK DISPONÍVEL)    │
// │                                                            │
// │ 2. [71% confidence] Dependency timeout cascade             │
// │    Visto 3x. Quando auth-service → 500ms, payment cascata. │
// │    Fix: Circuit breaker timeout adjustment.                 │
// │                                                            │
// │ 3. [55% confidence] Memory leak after deploy               │
// │    Visto 2x em serviços TypeScript no ECS.                  │
// │    Fix: Rollback + investigate heap snapshot.               │
// └──────────────────────────────────────────────────────────┘`}</Code>
      </div>
    ),
  },
  // ═══════════════════════════════════════
  // PEACE-TIME OPERATIONS
  // ═══════════════════════════════════════
  {
    id: "pt-overview", group: "pt", title: "Visão Geral", icon: "🌅",
    content: () => (
      <div className="space-y-5">
        <div className="bg-gradient-to-r from-sky-700 to-indigo-700 text-white rounded-lg p-6">
          <h3 className="text-2xl font-bold mb-2">Peace-Time Operations — Usado Todos os Dias</h3>
          <p className="text-sky-200">War-time é 5% do tempo. Peace-time é 95%. Se o produto só funciona em emergências, o churn é inevitável. Peace-time cria daily habit, stickiness, e gera os dados que alimentam o Self-Improvement Engine.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { n: "95%", d: "Tempo em peace-time", c: "text-sky-700" },
            { n: "DAU", d: "Daily Active Users via Slack/Teams", c: "text-green-700" },
            { n: "~40", d: "Queries/dia por eng (target)", c: "text-purple-700" },
            { n: "-50%", d: "On-call prep time (target)", c: "text-amber-700" },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <div className={`text-xl font-bold ${s.c}`}>{s.n}</div>
              <div className="text-xs text-gray-500 mt-1">{s.d}</div>
            </div>
          ))}
        </div>

        <Card title="6 Peace-Time Capabilities" accent="blue">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {[
              { cap: "On-Call Briefing", desc: "Auto-gera resumo para início de turno: estado do sistema, alertas ativos, deploys recentes, incidentes abertos, risks identificados.", cmd: "/sre briefing", when: "Início de cada turno on-call (automático ou sob demanda)" },
              { cap: "Health Queries", desc: "Perguntas em linguagem natural sobre o estado do sistema. Mapeia termos internos para serviços, métricas e logs corretos.", cmd: "/sre health [service]  ·  /sre deps [service]  ·  /sre changes today", when: "Ad-hoc, quando engenheiro quer entender algo" },
              { cap: "Anomaly Scanner", desc: "Scanner proativo a cada 15min. Compara métricas com baseline (7d rolling). Notifica como 'heads up', não como alert — sem page, sem noise.", cmd: "Automático. Notifica no canal #sre-insights", when: "Contínuo, 24/7" },
              { cap: "Change Risk Assessment", desc: "Antes de um deploy, analisar: blast radius, incidentes similares, dependentes afetados, horário de risco.", cmd: "/sre risk-check [deploy-id ou service]", when: "Pré-deploy (integrável com CI/CD como gate)" },
              { cap: "Vibe Debugging", desc: "Explorar sinais sutis: 'algo parece estranho no checkout'. Agent investiga sem urgência: trends, anomalias, comparações.", cmd: "/sre investigate [descrição livre]", when: "Quando engenheiro tem intuição mas não tem dados" },
              { cap: "Operational Reports", desc: "Weekly: reliability report (MTTR, top offenders, trends). Per-deploy: impacto nas métricas. Per-team: ownership health.", cmd: "/sre report [weekly | deploy:id | team:name]", when: "Semanal automático + sob demanda" },
            ].map((c, i) => (
              <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="font-bold text-gray-900">{c.cap}</p>
                <p className="text-xs text-gray-600 mt-1">{c.desc}</p>
                <div className="mt-2 bg-gray-800 text-green-400 rounded px-2 py-1 font-mono text-xs">{c.cmd}</div>
                <p className="text-xs text-gray-400 mt-1">{c.when}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    ),
  },
  {
    id: "pt-code", group: "pt", title: "Implementação", icon: "💻",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Peace-Time — Código dos Módulos Principais</h3>

        <Code title="On-Call Briefing — gerado no início de cada turno">{`async function generateOnCallBriefing(tenantId: string, team?: string) {
  const kg = registry.resolveKnowledgeGraph(tenantId);
  const le = registry.resolveLearningEngine(tenantId);
  
  // Coletar contexto dos últimos turnos (12h)
  const [systemHealth, recentChanges, activeAlerts, openIncidents, degradedSvcs] = 
    await Promise.all([
      kg.getSystemHealth(tenantId),
      kg.getRecentChanges(tenantId, { last: '12h' }),
      alertStore.getActive(tenantId, { team }),
      incidentStore.listOpen(tenantId),
      kg.getDegradedServices(tenantId),
    ]);
  
  // Buscar insights do anomaly scanner
  const anomalies = await anomalyScanner.getRecentAnomalies(tenantId, { last: '12h' });
  
  // Buscar meta-patterns relevantes (e.g., "Monday morning deployments risky")
  const warnings = await le.getTimeBasedWarnings(tenantId);
  
  // Gerar briefing via Sonnet (rápido, <3s)
  const briefing = await agentSdk.run({
    model: 'sonnet-4.5',
    maxTurns: 1,
    systemPrompt: ON_CALL_BRIEFING_PROMPT,
    userPrompt: JSON.stringify({
      systemHealth, recentChanges, activeAlerts, openIncidents,
      degradedSvcs, anomalies, warnings,
    }),
  });
  
  // Enviar como message sections no canal do team
  await chat.sendMessage(tenantId, teamChannelId, {
    sections: [
      { type: 'header', text: '☀️ On-Call Briefing — ' + team, severity: 'info' },
      { type: 'fields', fields: [
        { label: '🟢 Healthy', value: systemHealth.healthy.toString() },
        { label: '🟡 Degraded', value: systemHealth.degraded.toString() },
        { label: '🔴 Down', value: systemHealth.down.toString() },
        { label: '📊 Alertas ativos', value: activeAlerts.length.toString() },
      ]},
      { type: 'text', text: briefing.summary },
      ...(anomalies.length > 0 ? [{
        type: 'text', text: '⚡ **Anomalias detectadas:**\\n' + 
          anomalies.map(a => \`• \${a.service}: \${a.description}\`).join('\\n'),
        severity: 'warning',
      }] : []),
      ...(recentChanges.length > 0 ? [{
        type: 'text', text: '🚀 **Mudanças recentes (' + recentChanges.length + '):**\\n' +
          recentChanges.slice(0, 5).map(c => 
            \`• \${c.serviceId}: \${c.description} (\${c.actor}, \${timeAgo(c.timestamp)})\`
          ).join('\\n'),
      }] : []),
      ...(warnings.length > 0 ? [{
        type: 'text', text: '🧠 **Insights do Learning Engine:**\\n' +
          warnings.map(w => \`• \${w.message}\`).join('\\n'),
        severity: 'info',
      }] : []),
      { type: 'actions', actions: [
        { id: 'deep-dive', label: '🔍 Investigar anomalia', style: 'primary', value: 'deep-dive' },
        { id: 'ack', label: '✅ Acknowledged', style: 'default', value: 'ack' },
      ]},
    ],
  });
}`}</Code>

        <Code title="Anomaly Scanner — proativo, roda a cada 15min">{`class AnomalyScanner {
  // Roda a cada 15 minutos via cron
  async scan(tenantId: string) {
    const kg = registry.resolveKnowledgeGraph(tenantId);
    const nodes = await kg.listNodes(tenantId, { health: ['healthy', 'degraded'] });
    const { cloud, credentials } = await registry.resolveForTenant(tenantId);
    
    for (const node of nodes) {
      const creds = await credentials.vendCredentials(tenantId, 'log-analyzer', 'anomaly-scan');
      
      // Pegar métricas atuais vs baseline (7-day rolling average)
      const [current, baseline] = await Promise.all([
        cloud.queryMetrics(creds, { service: node.serviceId, period: '15m' }),
        this.getBaseline(tenantId, node.serviceId),  // cached 7d rolling avg
      ]);
      
      const anomalies = [];
      
      // Latência: desvio > 2 sigma
      if (current.latencyP99 > baseline.latencyP99.mean + 2 * baseline.latencyP99.stddev) {
        anomalies.push({
          signal: 'latency_increase',
          current: current.latencyP99,
          baseline: baseline.latencyP99.mean,
          deviation: (current.latencyP99 - baseline.latencyP99.mean) / baseline.latencyP99.stddev,
        });
      }
      
      // Error rate: aumento > 50% do baseline
      if (current.errorRate > baseline.errorRate.mean * 1.5 && current.errorRate > 0.01) {
        anomalies.push({ signal: 'error_rate_creep', current: current.errorRate, ... });
      }
      
      // Saturation: CPU/mem trending up (slope positivo por >1h)
      if (current.cpuTrend?.slope > 0 && current.cpuTrend?.durationMinutes > 60) {
        anomalies.push({ signal: 'saturation_trending', ... });
      }
      
      if (anomalies.length > 0) {
        // Verificar se já notificamos sobre isso (dedup: 1h cooldown)
        const recentNotification = await this.getRecentNotification(tenantId, node.serviceId);
        if (recentNotification && minutesSince(recentNotification) < 60) continue;
        
        // Correlacionar com changes recentes
        const recentChanges = await kg.getRecentChanges(tenantId, {
          serviceId: node.serviceId, last: '4h'
        });
        
        // Buscar padrões similares
        const patterns = await learningEngine.findSimilarPatterns(tenantId, anomalies);
        
        // Notificar como "heads up" (NÃO como alert!)
        await chat.sendMessage(tenantId, insightsChannelId, {
          sections: [
            { type: 'header', text: '⚡ Heads Up: ' + node.name, severity: 'warning' },
            { type: 'text', text: formatAnomalies(anomalies) },
            ...(recentChanges.length > 0 ? [{
              type: 'text', text: '🔗 Possível correlação: ' + recentChanges[0].description,
            }] : []),
            ...(patterns.length > 0 ? [{
              type: 'text', text: '🧠 Padrão similar: ' + patterns[0].pattern.rootCause.description +
                ' (confidence: ' + Math.round(patterns[0].pattern.confidence * 100) + '%)',
            }] : []),
            { type: 'actions', actions: [
              { id: 'investigate', label: '🔍 Investigar', style: 'primary' },
              { id: 'snooze', label: '😴 Snooze 4h', style: 'default' },
              { id: 'dismiss', label: '✖️ Dismiss', style: 'default' },
            ]},
          ],
        });
      }
    }
  }
}`}</Code>

        <Code title="Change Risk Assessment — pré-deploy">{`async function assessChangeRisk(tenantId: string, serviceId: string, deployInfo: DeployInfo) {
  const kg = registry.resolveKnowledgeGraph(tenantId);
  const le = registry.resolveLearningEngine(tenantId);
  
  // 1. Blast radius
  const { score: blastScore, affectedServices } = await kg.getBlastRadius(tenantId, serviceId);
  
  // 2. Histórico de incidentes pós-deploy neste serviço
  const deployHistory = await kg.getRecentChanges(tenantId, { serviceId, last: '90d' });
  const postDeployIncidents = deployHistory.filter(d => d.linkedIncidentId);
  const incidentRate = postDeployIncidents.length / Math.max(deployHistory.length, 1);
  
  // 3. Padrões conhecidos de risco para este serviço
  const riskPatterns = await le.getPatternsByService(tenantId, serviceId);
  
  // 4. Fatores temporais (meta-patterns)
  const timeRisks = await le.getTimeBasedWarnings(tenantId);
  
  // 5. Score composto
  const riskScore = Math.round(
    blastScore * 0.3 +
    incidentRate * 100 * 0.3 +
    (riskPatterns.length > 0 ? 30 : 0) * 0.2 +
    (timeRisks.length > 0 ? 20 : 0) * 0.2
  );
  
  const riskLevel = riskScore > 70 ? 'HIGH' : riskScore > 40 ? 'MEDIUM' : 'LOW';
  
  return {
    riskLevel, riskScore,
    blastRadius: { score: blastScore, affected: affectedServices },
    deployHistoryIncidentRate: incidentRate,
    knownRiskPatterns: riskPatterns,
    timeBasedWarnings: timeRisks,
    recommendations: generateRecommendations(riskLevel, { blastScore, incidentRate, riskPatterns }),
    // "MEDIUM risk. Recomendações: canary deploy, monitorar connection pool por 30min,
    //  evitar deploy junto com auth-service (correlação histórica)."
  };
}`}</Code>
      </div>
    ),
  },
  // ═══════════════════════════════════════
  // IMPLEMENTATION
  // ═══════════════════════════════════════
  {
    id: "impl-structure", group: "impl", title: "Module Structure", icon: "📦",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Estrutura de Módulos Atualizada</h3>
        <Code title="src/ — com Knowledge Graph, Self-Improvement e Peace-Time">{`src/
├── shared/
│   └── ports/
│       ├── cloud-provider.ts
│       ├── chat-platform.ts
│       ├── knowledge-graph.ts          # ★ NOVO — interface do grafo
│       ├── learning-engine.ts          # ★ NOVO — interface do self-improvement
│       ├── alert-source.ts
│       └── observability.ts
│
├── modules/
│   ├── ingestion/                      # Alert parsers + normalizer
│   ├── triage/                         # Fast classification (Layer 1)
│   ├── investigation/                  # Deep Search (Layer 2+3)
│   │
│   ├── knowledge/                      # ★★★ KNOWLEDGE GRAPH
│   │   ├── graph-store.ts              #   ElectroDB: ServiceNode, ServiceEdge, ChangeEvent
│   │   ├── discovery/
│   │   │   ├── infra-scanner.ts        #   Layer 1: scan AWS/Azure a cada 15min
│   │   │   ├── event-processor.ts      #   Layer 2: CloudTrail/Activity Log → graph
│   │   │   └── trace-analyzer.ts       #   Layer 3: traces → dependency edges
│   │   ├── blast-radius.ts             #   Graph traversal + scoring
│   │   ├── health-aggregator.ts        #   Métricas → node health status
│   │   └── graph-queries.ts            #   Implementação da interface
│   │
│   ├── learning/                       # ★★★ SELF-IMPROVEMENT ENGINE
│   │   ├── pattern-store.ts            #   ElectroDB: Pattern, FeedbackEvent, MetaPattern
│   │   ├── pattern-extractor.ts        #   Loop 1: incident → structured pattern
│   │   ├── confidence-engine.ts        #   Loop 2: Bayesian confidence evolution
│   │   ├── feedback-handler.ts         #   Loop 3: Slack/Teams feedback → confidence
│   │   ├── meta-analyzer.ts            #   Loop 4: cross-incident correlation (weekly)
│   │   ├── runbook-generator.ts        #   Loop 5: pattern → auto-runbook
│   │   ├── pattern-matcher.ts          #   Structured symptom matching (not RAG)
│   │   └── learning-scheduler.ts       #   Cron: meta-analysis, pattern cleanup
│   │
│   ├── peacetime/                      # ★★★ PEACE-TIME OPERATIONS
│   │   ├── on-call-briefing.ts         #   Generate shift briefings
│   │   ├── health-query.ts             #   NL queries about system state
│   │   ├── anomaly-scanner.ts          #   Proactive 15min scan
│   │   ├── change-risk.ts              #   Pre-deploy risk assessment
│   │   ├── vibe-debugger.ts            #   Free-form investigation (non-urgent)
│   │   ├── report-generator.ts         #   Weekly/deploy/team reports
│   │   └── slash-commands.ts           #   /sre command router
│   │
│   ├── remediation/                    # Actions + approval gate
│   ├── tenant/                         # Multi-tenancy
│   └── audit/                          # Compliance
│
└── infra/                              # Adapters (AWS, Azure, Slack, Teams)`}</Code>

        <Card title="Impacto no Roadmap" accent="green">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border border-gray-200 rounded">
              <thead><tr className="bg-gray-800 text-white"><th className="px-3 py-2 text-left">Sprint</th><th className="px-3 py-2 text-left">Antes (PRD v2)</th><th className="px-3 py-2 text-left">Agora (PRD v3)</th><th className="px-3 py-2 text-center">Delta</th></tr></thead>
              <tbody className="divide-y divide-gray-200">
                {[
                  ["1-2 (w1-4)", "Foundation + ports", "+ KnowledgeGraph port + Pattern entity + GraphStore scaffold", "+1d"],
                  ["3-4 (w5-8)", "Ingestion + triage + cloud adapters", "+ Infra Scanner (auto-discovery) + Event Processor + ChangeEvent entity + Blast radius computation", "+4d"],
                  ["5-7 (w9-14)", "Deep Search sub-agents", "+ Trace Analyzer (dependency edges) + Pattern Extractor (loop 1) + Confidence Engine (loop 2) + Pattern Matcher + Anomaly Scanner (peace-time proactive)", "+5d"],
                  ["8-9 (w15-18)", "Chat + remediation", "+ Feedback Handler (loop 3, Slack/Teams buttons) + On-Call Briefing + Health Query + Slash Commands + Vibe Debugger + Change Risk Assessment", "+5d"],
                  ["10-12 (w19-24)", "Enterprise + SOC 2", "+ Meta Analyzer (loop 4, weekly) + Runbook Generator (loop 5) + Report Generator + Agent CI/CD pipeline formalized", "+3d"],
                ].map(([s, before, after, delta], i) => (
                  <tr key={i} className={i % 2 ? "bg-gray-50" : ""}>
                    <td className="px-3 py-2 font-bold">{s}</td>
                    <td className="px-3 py-2 text-gray-600">{before}</td>
                    <td className="px-3 py-2 text-blue-700">{after}</td>
                    <td className="px-3 py-2 text-center font-bold text-amber-600">{delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-700 mt-3">
            <strong>Total adicional: ~18 dias (+3.5 semanas).</strong> Roadmap vai de 24 para ~28 semanas. 
            Alternativa: mover Meta Analyzer (loop 4) e Runbook Generator (loop 5) para post-MVP → economiza ~5 dias → 26 semanas.
          </p>
        </Card>
      </div>
    ),
  },
  {
    id: "impl-flow", group: "impl", title: "Fluxo Integrado", icon: "🔄",
    content: () => (
      <div className="space-y-5">
        <h3 className="text-xl font-bold text-gray-900">Como Tudo Se Conecta</h3>
        <p className="text-sm text-gray-600">O Knowledge Graph, Self-Improvement e Peace-Time não são módulos isolados — eles se alimentam mutuamente em um ciclo virtuoso.</p>

        <Code title="O Ciclo Virtuoso Completo">{`┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  ☮️ PEACE-TIME (95% do tempo)                                   │
│  ┌───────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ Anomaly       │  │ On-Call      │  │ Change Risk        │   │
│  │ Scanner       │─▶│ Briefing     │  │ Assessment         │   │
│  │ (cada 15min)  │  │ (cada turno) │  │ (pré-deploy)       │   │
│  └───────┬───────┘  └──────┬───────┘  └────────┬───────────┘   │
│          │                 │                    │               │
│          │    Reads from   ▼      Reads from    │               │
│          │  ┌──────────────────────────────┐    │               │
│          └─▶│    🧠 KNOWLEDGE GRAPH        │◀───┘               │
│             │  Nodes + Edges + Changes     │                    │
│             │  Health + Blast Radius        │                    │
│             └──────────────┬───────────────┘                    │
│                            │                                    │
│                            │ Enriches investigation context     │
│                            ▼                                    │
│  ⚔️ WAR-TIME (5% do tempo)                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Alert → Triage → Deep Search (+ KG context + Patterns)  │   │
│  │       → Hypothesis ranking → Approval → Remediation      │   │
│  └──────────────────────────────┬───────────────────────────┘   │
│                                 │                               │
│                                 │ After resolution              │
│                                 ▼                               │
│  🔄 SELF-IMPROVEMENT                                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Loop 1: Extract pattern (symptoms → root cause → fix)    │   │
│  │ Loop 2: Update confidence (Bayesian)                     │   │
│  │ Loop 3: Process human feedback (confirm/reject/correct)  │───┐
│  │ Loop 4: Cross-incident meta-analysis (weekly)            │   │
│  │ Loop 5: Generate runbooks (when confidence > 90%)        │   │
│  └──────────────────────────────┬───────────────────────────┘   │
│                                 │                               │
│                    Feeds back into                              │
│                                 ▼                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │    🧠 KNOWLEDGE GRAPH (patterns, runbooks, meta-insights)│   │
│  │    → Enriches next investigation                         │   │
│  │    → Enriches next anomaly scan                          │   │
│  │    → Enriches next on-call briefing                      │◀──┘
│  │    → Enriches next change risk assessment                │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Cada ciclo torna a plataforma mais inteligente.               │
│  Após 30 dias: patterns estáveis, briefings relevantes.        │
│  Após 90 dias: runbooks auto-gerados, meta-insights.           │
│  Após 180 dias: remediação semi-autônoma para padrões comuns.  │
└─────────────────────────────────────────────────────────────────┘`}</Code>

        <Alert type="success">
          <strong>Por que isso é melhor que a Resolve:</strong> A Resolve fala de "5 pillars" separados. Nós temos um <strong>ciclo integrado</strong> onde peace-time GERA dados que alimentam o learning, que MELHORA peace-time, que ENRIQUECE war-time. Cada incidente resolvido torna os 3 módulos melhores. Cada dia de peace-time gera baselines melhores para o anomaly scanner. É um flywheel, não 5 features separadas.
        </Alert>

        <Card title="Métricas de Maturidade por Tenant" accent="purple">
          <div className="space-y-2 text-sm text-gray-700">
            <p><strong>Semana 1:</strong> Knowledge Graph com topologia básica (auto-discovered). Investigations sem patterns. Briefings genéricos.</p>
            <p><strong>Mês 1:</strong> ~10-20 patterns em status 'learning'. Anomaly scanner com baselines de 7 dias. Briefings com contexto de changes recentes.</p>
            <p><strong>Mês 3:</strong> 5-15 patterns 'stable' (confidence 70%+). Meta-patterns emergindo. Briefings com insights do Learning Engine. Investigations 40% mais rápidas por padrão matching.</p>
            <p><strong>Mês 6:</strong> 2-5 runbooks auto-gerados e aprovados. Remediação semi-autônoma para padrões recorrentes. MTTR 50%+ menor. Change risk assessment preciso.</p>
            <p className="font-bold text-purple-800 mt-2">Isso é o moat competitivo: quanto mais tempo o cliente usa, mais difícil trocar. Cada padrão aprendido é valor perdido se migrar.</p>
          </div>
        </Card>
      </div>
    ),
  },
];

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════
export default function ADR010DeepDive() {
  const [activeSection, setActiveSection] = useState("kg-overview");
  const [collapsed, setCollapsed] = useState({});
  const currentSection = sections.find((s) => s.id === activeSection);
  const currentGroup = groups.find((g) => g.id === currentSection?.group);
  const toggleGroup = (gid) => setCollapsed((p) => ({ ...p, [gid]: !p[gid] }));

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-gradient-to-r from-gray-900 via-purple-900 to-green-900 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl font-bold">ADR-010: Knowledge Graph + Self-Improvement + Peace-Time</h1>
          <p className="text-gray-400 text-sm mt-0.5">Os 3 pilares que nos diferenciam da Resolve.ai — Deep Dive Técnico</p>
          <div className="flex gap-2 mt-2">
            <Badge color="purple">Knowledge Graph</Badge>
            <Badge color="green">Self-Improvement</Badge>
            <Badge color="blue">Peace-Time</Badge>
            <Badge color="amber">v3.0</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5">
        <div className="flex flex-col md:flex-row gap-5">
          <nav className="md:w-52 flex-shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {groups.map((group) => (
                <div key={group.id}>
                  <button onClick={() => toggleGroup(group.id)}
                    className="w-full text-left px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 flex items-center justify-between">
                    <span>{group.icon} {group.label}</span>
                    <span className="text-gray-400">{collapsed[group.id] ? "▸" : "▾"}</span>
                  </button>
                  {!collapsed[group.id] && sections
                    .filter((s) => s.group === group.id)
                    .map((section) => (
                      <button key={section.id} onClick={() => setActiveSection(section.id)}
                        className={`w-full text-left px-4 py-2 text-sm border-b border-gray-50 transition-colors ${
                          activeSection === section.id
                            ? "bg-gray-900 text-white font-bold"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}>
                        <span className="mr-1.5 text-xs">{section.icon}</span>
                        {section.title}
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </nav>

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
