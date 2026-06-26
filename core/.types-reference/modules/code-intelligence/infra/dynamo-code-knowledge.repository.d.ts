import type { ICodeKnowledgeRepository } from '../domain/code-knowledge.repository.js';
import type { RepoNode } from '../domain/repo-node.entity.js';
import type { PackageDependency } from '../domain/package-dependency.entity.js';
import type { RepoServiceMap } from '../domain/repo-service-map.entity.js';
import type { TenantId, ServiceNodeId } from '../../../shared/domain/value-objects.js';
export declare class DynamoCodeKnowledgeRepository implements ICodeKnowledgeRepository {
    upsertRepo(repo: RepoNode): Promise<RepoNode>;
    getRepo(tenantId: TenantId, repoFullName: string): Promise<RepoNode | null>;
    listRepos(tenantId: TenantId): Promise<RepoNode[]>;
    upsertDependency(dep: PackageDependency): Promise<PackageDependency>;
    getDependencies(tenantId: TenantId, repoFullName: string): Promise<PackageDependency[]>;
    getDependents(tenantId: TenantId, packageName: string): Promise<PackageDependency[]>;
    clearDependencies(tenantId: TenantId, repoFullName: string): Promise<void>;
    upsertRepoServiceMap(mapping: RepoServiceMap): Promise<RepoServiceMap>;
    getReposByService(tenantId: TenantId, serviceId: ServiceNodeId): Promise<RepoServiceMap[]>;
    getServicesByRepo(tenantId: TenantId, repoFullName: string): Promise<RepoServiceMap[]>;
}
