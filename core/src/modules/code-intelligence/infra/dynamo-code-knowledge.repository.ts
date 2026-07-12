import { serviceNodeId } from '../../../shared/domain/value-objects.js';
import { RepoNodeEntity } from '../../../shared/infra/db/entities/RepoNodeEntity.js';
import { PackageDependencyEntity } from '../../../shared/infra/db/entities/PackageDependencyEntity.js';
import { RepoServiceMapEntity } from '../../../shared/infra/db/entities/RepoServiceMapEntity.js';
import { ServiceEdgeEntity } from '../../../shared/infra/db/entities/ServiceEdgeEntity.js';
import { PatternEntity } from '../../../shared/infra/db/entities/PatternEntity.js';
import type { ICodeKnowledgeRepository } from '../domain/code-knowledge.repository.js';
import type { RepoNode } from '../domain/repo-node.entity.js';
import type { Pattern } from '../domain/pattern.entity.js';
import type { PackageDependency } from '../domain/package-dependency.entity.js';
import type { RepoServiceMap } from '../domain/repo-service-map.entity.js';
import type { ServiceEdge } from '../domain/service-edge.entity.js';
import type { ServiceNodeId, TenantId } from '../../../shared/domain/value-objects.js';
function toRepoNode(raw: Record<string, any>) {
  return {
    tenantId: raw['tenantId'],
    repoFullName: raw['repoFullName'],
    provider: raw['provider'] ?? 'github',
    language: raw['language'],
    defaultBranch: raw['defaultBranch'],
    lastCommitSha: raw['lastCommitSha'],
    lastIndexedAt: raw['lastIndexedAt'],
    fileCount: raw['fileCount'],
    config: raw['config'],
    createdAt: raw['createdAt'],
    updatedAt: raw['updatedAt'],
  };
}
function toDep(raw: Record<string, any>) {
  return {
    tenantId: raw['tenantId'],
    repoFullName: raw['repoFullName'],
    packageName: raw['packageName'],
    version: raw['version'],
    declaredIn: raw['declaredIn'],
    isDev: raw['isDev'],
    createdAt: raw['createdAt'],
    updatedAt: raw['updatedAt'],
  };
}
function toMapping(raw: Record<string, any>) {
  return {
    tenantId: raw['tenantId'],
    repoFullName: raw['repoFullName'],
    serviceId: serviceNodeId(raw['serviceId']),
    deployTarget: raw['deployTarget'],
    environment: raw['environment'],
    createdAt: raw['createdAt'],
    updatedAt: raw['updatedAt'],
  };
}
export class DynamoCodeKnowledgeRepository {
  // --- RepoNode ---
  async upsertRepo(repo: RepoNode): Promise<RepoNode> {
    const result = await RepoNodeEntity.upsert({
      tenantId: repo.tenantId,
      repoFullName: repo.repoFullName,
      provider: repo.provider,
      language: repo.language,
      defaultBranch: repo.defaultBranch,
      lastCommitSha: repo.lastCommitSha,
      lastIndexedAt: repo.lastIndexedAt,
      fileCount: repo.fileCount,
      config: repo.config,
    }).go({ response: 'all_new' });
    return toRepoNode(result.data);
  }
  async getRepo(tenantId: TenantId, repoFullName: string): Promise<RepoNode | null> {
    const result = await RepoNodeEntity.get({ tenantId, repoFullName }).go();
    if (!result.data) return null;
    return toRepoNode(result.data);
  }
  async listRepos(tenantId: TenantId): Promise<RepoNode[]> {
    const result = await RepoNodeEntity.query.primary({ tenantId }).go();
    return result.data.map((item) => toRepoNode(item));
  }
  // --- PackageDependency ---
  async upsertDependency(dep: PackageDependency): Promise<PackageDependency> {
    const result = await PackageDependencyEntity.upsert({
      tenantId: dep.tenantId,
      repoFullName: dep.repoFullName,
      packageName: dep.packageName,
      version: dep.version,
      declaredIn: dep.declaredIn,
      isDev: dep.isDev,
    }).go({ response: 'all_new' });
    return toDep(result.data);
  }
  async getDependencies(tenantId: TenantId, repoFullName: string): Promise<PackageDependency[]> {
    const result = await PackageDependencyEntity.query.primary({ tenantId, repoFullName }).go();
    return result.data.map((item) => toDep(item));
  }
  async getDependents(tenantId: TenantId, packageName: string): Promise<PackageDependency[]> {
    const result = await PackageDependencyEntity.query.byPackage({ tenantId, packageName }).go();
    return result.data.map((item) => toDep(item));
  }
  async clearDependencies(tenantId: TenantId, repoFullName: string): Promise<void> {
    const existing = await PackageDependencyEntity.query.primary({ tenantId, repoFullName }).go();
    for (const item of existing.data) {
      await PackageDependencyEntity.delete({
        tenantId: item.tenantId,
        repoFullName: item.repoFullName,
        packageName: item.packageName,
      }).go();
    }
  }
  // --- RepoServiceMap ---
  async upsertRepoServiceMap(mapping: RepoServiceMap): Promise<RepoServiceMap> {
    const result = await RepoServiceMapEntity.upsert({
      tenantId: mapping.tenantId,
      repoFullName: mapping.repoFullName,
      serviceId: mapping.serviceId,
      deployTarget: mapping.deployTarget,
      environment: mapping.environment,
    }).go({ response: 'all_new' });
    return toMapping(result.data);
  }
  async getReposByService(tenantId: TenantId, serviceId: ServiceNodeId): Promise<RepoServiceMap[]> {
    const result = await RepoServiceMapEntity.query.primary({ tenantId, serviceId }).go();
    return result.data.map((item) => toMapping(item));
  }
  async getServicesByRepo(tenantId: TenantId, repoFullName: string): Promise<RepoServiceMap[]> {
    const result = await RepoServiceMapEntity.query.byRepo({ tenantId, repoFullName }).go();
    return result.data.map((item) => toMapping(item));
  }
  // --- ServiceEdge ---
  async upsertServiceEdge(edge: ServiceEdge): Promise<ServiceEdge> {
    const result = await ServiceEdgeEntity.upsert({
      tenantId: edge.tenantId,
      edgeId: edge.edgeId,
      sourceService: edge.sourceService,
      targetService: edge.targetService,
      edgeType: edge.edgeType,
      protocol: edge.protocol,
      traffic: edge.traffic,
      isCriticalPath: edge.isCriticalPath,
      metadata: edge.metadata,
    }).go({ response: 'all_new' });
    return result.data as unknown as ServiceEdge;
  }
  async listServiceEdges(tenantId: TenantId): Promise<ServiceEdge[]> {
    const result = await ServiceEdgeEntity.query.primary({ tenantId }).go();
    return result.data as unknown as ServiceEdge[];
  }
  // --- Pattern ---
  async upsertPattern(pattern: Pattern): Promise<Pattern> {
    const result = await PatternEntity.upsert({
      tenantId: pattern.tenantId,
      patternId: pattern.patternId,
      symptoms: pattern.symptoms,
      rootCause: pattern.rootCause,
      fix: pattern.fix,
      confidence: pattern.confidence,
      occurrences: pattern.occurrences,
      status: pattern.status,
      firstSeen: pattern.firstSeen,
      lastSeen: pattern.lastSeen,
    }).go({ response: 'all_new' });
    return result.data as unknown as Pattern;
  }

  // --- Search (returns repos + patterns ranked by confidence) ---
  async search(tenantId: TenantId, query: string): Promise<RepoNode[]> {
    const allRepos = await this.listRepos(tenantId);
    const q = query.toLowerCase();

    // Get code patterns matching the query, ordered by confidence
    let patterns: Array<{ patternId: string; confidence: number; symptoms: string }> = [];
    try {
      const patternResult = await PatternEntity.query.primary({ tenantId }).go();
      patterns = patternResult.data
        .filter((p: Record<string, unknown>) => {
          const symptoms = JSON.stringify(p.symptoms ?? '').toLowerCase();
          return symptoms.includes(q);
        })
        .map((p: Record<string, unknown>) => ({
          patternId: p.patternId as string,
          confidence: (p.confidence as number) ?? 0,
          symptoms: JSON.stringify(p.symptoms ?? ''),
        }))
        .sort(
          (a: { confidence: number }, b: { confidence: number }) => b.confidence - a.confidence,
        );
    } catch {
      // Pattern query failed — continue with repo-only results
    }

    // Match repos — by name/language OR by having a matching pattern
    const matchingPatternRepoNames = new Set(patterns.map(() => '')); // patterns don't carry repo ref in the ElectroDB entity
    let matchedRepos = allRepos.filter((repo) => {
      const name = repo.repoFullName.toLowerCase();
      const lang = repo.language?.toLowerCase() ?? '';
      return name.includes(q) || lang.includes(q);
    });

    // If no repos matched by name/language but patterns exist, return all repos
    // (patterns are associated with the tenant, not individual repos in the current schema)
    if (matchedRepos.length === 0 && patterns.length > 0) {
      matchedRepos = allRepos;
    }

    // Attach top pattern confidence as ranking score
    const topConfidence = patterns.length > 0 ? patterns[0]!.confidence : 0;
    return matchedRepos.map((repo) => ({
      ...repo,
      confidence: topConfidence,
      matchedPatterns: patterns.slice(0, 5),
    }));
  }
}
