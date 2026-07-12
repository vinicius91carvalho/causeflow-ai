/**
 * Postgres CodeKnowledge repository implementation for the OSS runtime (AC-040).
 * Replaces DynamoCodeKnowledgeRepository in the OSS path.
 */
import { serviceNodeId } from '../../../shared/domain/value-objects.js';
import {
  pgDelete,
  pgGet,
  pgInsert,
  pgQuery,
  pgUpdate,
} from '../../../shared/infra/db/postgres/pg-utils.js';
import type { ICodeKnowledgeRepository } from '../domain/code-knowledge.repository.js';
import type { RepoNode } from '../domain/repo-node.entity.js';
import type { Pattern } from '../domain/pattern.entity.js';
import type { PackageDependency } from '../domain/package-dependency.entity.js';
import type { RepoServiceMap } from '../domain/repo-service-map.entity.js';
import type { ServiceEdge } from '../domain/service-edge.entity.js';
import type { ServiceNodeId, TenantId } from '../../../shared/domain/value-objects.js';

// --- Helpers ---

function repoEntityId(repoFullName: string): string {
  return `repo:${repoFullName}`;
}

function depEntityId(repoFullName: string, packageName: string): string {
  return `dep:${repoFullName}:${packageName}`;
}

function mappingEntityId(repoFullName: string, serviceId: string): string {
  return `map:${repoFullName}:${serviceId}`;
}

// --- toDomain ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRepoNode(row: any): RepoNode {
  return {
    tenantId: row.tenant_id as TenantId,
    repoFullName: row.data['repoFullName'] as string,
    provider: (row.data['provider'] ?? 'github') as 'github',
    language: row.data['language'] as string | undefined,
    defaultBranch: row.data['defaultBranch'] as string | undefined,
    lastCommitSha: row.data['lastCommitSha'] as string | undefined,
    lastIndexedAt: row.data['lastIndexedAt'] as string | undefined,
    fileCount: row.data['fileCount'] as number | undefined,
    config: row.data['config'] as RepoNode['config'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDep(row: any): PackageDependency {
  return {
    tenantId: row.tenant_id as TenantId,
    repoFullName: row.data['repoFullName'] as string,
    packageName: row.data['packageName'] as string,
    version: row.data['version'] as string,
    declaredIn: row.data['declaredIn'] as string,
    isDev: (row.data['isDev'] ?? false) as boolean,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toMapping(row: any): RepoServiceMap {
  return {
    tenantId: row.tenant_id as TenantId,
    repoFullName: row.data['repoFullName'] as string,
    serviceId: serviceNodeId(row.data['serviceId'] as string),
    deployTarget: row.data['deployTarget'] as string | undefined,
    environment: row.data['environment'] as string | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toServiceEdge(row: any): ServiceEdge {
  return {
    tenantId: row.tenant_id as TenantId,
    edgeId: row.data['edgeId'] as string,
    sourceService: row.data['sourceService'] as string,
    targetService: row.data['targetService'] as string,
    edgeType: row.data['edgeType'] as ServiceEdge['edgeType'],
    protocol: row.data['protocol'] as string | undefined,
    traffic: row.data['traffic'] as ServiceEdge['traffic'],
    isCriticalPath: (row.data['isCriticalPath'] ?? false) as boolean,
    metadata: row.data['metadata'] as Record<string, unknown> | undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPattern(row: any): Pattern {
  return {
    tenantId: row.tenant_id as TenantId,
    patternId: row.entity_id.replace(/^pattern:/, ''),
    repoFullName: row.data['repoFullName'] as string,
    symptoms: row.data['symptoms'] as Pattern['symptoms'],
    rootCause: row.data['rootCause'] as Pattern['rootCause'],
    fix: row.data['fix'] as Pattern['fix'],
    confidence: (row.data['confidence'] ?? 0) as number,
    occurrences: (row.data['occurrences'] ?? 0) as number,
    status: (row.data['status'] ?? 'active') as string,
    firstSeen: row.data['firstSeen'] as string,
    lastSeen: row.data['lastSeen'] as string,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgCodeKnowledgeRepository implements ICodeKnowledgeRepository {
  // --- RepoNode ---

  async upsertRepo(repo: RepoNode): Promise<RepoNode> {
    const data: Record<string, unknown> = {
      repoFullName: repo.repoFullName,
      provider: repo.provider,
      language: repo.language,
      defaultBranch: repo.defaultBranch,
      lastCommitSha: repo.lastCommitSha,
      lastIndexedAt: repo.lastIndexedAt,
      fileCount: repo.fileCount,
      config: repo.config,
    };
    const eid = repoEntityId(repo.repoFullName);
    const existing = await pgGet('repo_nodes', repo.tenantId, eid);
    if (existing) {
      const row = await pgUpdate('repo_nodes', repo.tenantId, eid, data);
      return toRepoNode(row);
    }
    const row = await pgInsert('repo_nodes', repo.tenantId, eid, data);
    return toRepoNode(row);
  }

  async getRepo(tenantId: TenantId, repoFullName: string): Promise<RepoNode | null> {
    const row = await pgGet('repo_nodes', tenantId, repoEntityId(repoFullName));
    if (!row) return null;
    return toRepoNode(row);
  }

  async listRepos(tenantId: TenantId): Promise<RepoNode[]> {
    const rows = await pgQuery('repo_nodes', 'tenant_id = $1', [tenantId], {
      orderBy: 'created_at DESC',
    });
    return rows.map(toRepoNode);
  }

  // --- PackageDependency ---

  async upsertDependency(dep: PackageDependency): Promise<PackageDependency> {
    const data: Record<string, unknown> = {
      repoFullName: dep.repoFullName,
      packageName: dep.packageName,
      version: dep.version,
      declaredIn: dep.declaredIn,
      isDev: dep.isDev,
    };
    const eid = depEntityId(dep.repoFullName, dep.packageName);
    const existing = await pgGet('package_dependencies', dep.tenantId, eid);
    if (existing) {
      const row = await pgUpdate('package_dependencies', dep.tenantId, eid, data);
      return toDep(row);
    }
    const row = await pgInsert('package_dependencies', dep.tenantId, eid, data);
    return toDep(row);
  }

  async getDependencies(tenantId: TenantId, repoFullName: string): Promise<PackageDependency[]> {
    const rows = await pgQuery(
      'package_dependencies',
      "tenant_id = $1 AND data->>'repoFullName' = $2",
      [tenantId, repoFullName],
      { orderBy: 'created_at ASC' },
    );
    return rows.map(toDep);
  }

  async getDependents(tenantId: TenantId, packageName: string): Promise<PackageDependency[]> {
    const rows = await pgQuery(
      'package_dependencies',
      "tenant_id = $1 AND data->>'packageName' = $2",
      [tenantId, packageName],
      { orderBy: 'created_at ASC' },
    );
    return rows.map(toDep);
  }

  async clearDependencies(tenantId: TenantId, repoFullName: string): Promise<void> {
    const rows = await pgQuery(
      'package_dependencies',
      "tenant_id = $1 AND data->>'repoFullName' = $2",
      [tenantId, repoFullName],
    );
    for (const row of rows) {
      await pgDelete('package_dependencies', tenantId, row.entity_id);
    }
  }

  // --- RepoServiceMap ---

  async upsertRepoServiceMap(mapping: RepoServiceMap): Promise<RepoServiceMap> {
    const data: Record<string, unknown> = {
      repoFullName: mapping.repoFullName,
      serviceId: mapping.serviceId,
      deployTarget: mapping.deployTarget,
      environment: mapping.environment,
    };
    const eid = mappingEntityId(mapping.repoFullName, String(mapping.serviceId));
    const existing = await pgGet('repo_service_maps', mapping.tenantId, eid);
    if (existing) {
      const row = await pgUpdate('repo_service_maps', mapping.tenantId, eid, data);
      return toMapping(row);
    }
    const row = await pgInsert('repo_service_maps', mapping.tenantId, eid, data);
    return toMapping(row);
  }

  async getReposByService(tenantId: TenantId, serviceId: ServiceNodeId): Promise<RepoServiceMap[]> {
    const rows = await pgQuery('repo_service_maps', "tenant_id = $1 AND data->>'serviceId' = $2", [
      tenantId,
      serviceId,
    ]);
    return rows.map(toMapping);
  }

  async getServicesByRepo(tenantId: TenantId, repoFullName: string): Promise<RepoServiceMap[]> {
    const rows = await pgQuery(
      'repo_service_maps',
      "tenant_id = $1 AND data->>'repoFullName' = $2",
      [tenantId, repoFullName],
    );
    return rows.map(toMapping);
  }

  // --- ServiceEdge ---

  async upsertServiceEdge(edge: ServiceEdge): Promise<ServiceEdge> {
    const data: Record<string, unknown> = {
      edgeId: edge.edgeId,
      sourceService: edge.sourceService,
      targetService: edge.targetService,
      edgeType: edge.edgeType,
      protocol: edge.protocol,
      traffic: edge.traffic,
      isCriticalPath: edge.isCriticalPath,
      metadata: edge.metadata,
    };
    const eid = `${edge.edgeId}`;
    const existing = await pgGet('service_edges', edge.tenantId, eid);
    if (existing) {
      const row = await pgUpdate('service_edges', edge.tenantId, eid, data);
      return toServiceEdge(row);
    }
    const row = await pgInsert('service_edges', edge.tenantId, eid, data);
    return toServiceEdge(row);
  }

  async listServiceEdges(tenantId: TenantId): Promise<ServiceEdge[]> {
    const rows = await pgQuery('service_edges', 'tenant_id = $1', [tenantId], {
      orderBy: 'created_at ASC',
    });
    return rows.map(toServiceEdge);
  }

  // --- Pattern ---

  async upsertPattern(pattern: Pattern): Promise<Pattern> {
    const data: Record<string, unknown> = {
      repoFullName: pattern.repoFullName,
      symptoms: pattern.symptoms,
      rootCause: pattern.rootCause,
      fix: pattern.fix,
      confidence: pattern.confidence,
      occurrences: pattern.occurrences,
      status: pattern.status,
      firstSeen: pattern.firstSeen,
      lastSeen: pattern.lastSeen,
    };
    const eid = `pattern:${pattern.patternId}`;
    const existing = await pgGet('patterns', pattern.tenantId, eid);
    if (existing) {
      const row = await pgUpdate('patterns', pattern.tenantId, eid, data);
      return toPattern(row);
    }
    const row = await pgInsert('patterns', pattern.tenantId, eid, data);
    return toPattern(row);
  }

  // --- Search ---

  async search(tenantId: TenantId, query: string): Promise<RepoNode[]> {
    const allRepos = await this.listRepos(tenantId);
    const q = query.toLowerCase();

    // Get code patterns matching the query, ordered by confidence
    let patterns: Array<{ patternId: string; confidence: number; symptoms: string }> = [];
    try {
      const patternRows = await pgQuery('patterns', 'tenant_id = $1', [tenantId]);
      patterns = patternRows
        .filter((r) => {
          const symptoms = JSON.stringify(r.data['symptoms'] ?? '').toLowerCase();
          return symptoms.includes(q);
        })
        .map((r) => ({
          patternId: r.entity_id.replace(/^pattern:/, ''),
          confidence: (r.data['confidence'] as number) ?? 0,
          symptoms: JSON.stringify(r.data['symptoms'] ?? ''),
        }))
        .sort((a, b) => b.confidence - a.confidence);
    } catch {
      // Pattern query failed — continue with repo-only results
    }

    // Match repos — by name/language OR by having a matching pattern
    let matchedRepos = allRepos.filter((repo) => {
      const name = repo.repoFullName.toLowerCase();
      const lang = repo.language?.toLowerCase() ?? '';
      return name.includes(q) || lang.includes(q);
    });

    // If no repos matched by name/language but patterns exist, return all repos
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
