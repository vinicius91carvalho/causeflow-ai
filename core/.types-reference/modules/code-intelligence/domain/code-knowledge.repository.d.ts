import type { TenantId, ServiceNodeId } from '../../../shared/domain/value-objects.js';
import type { RepoNode } from './repo-node.entity.js';
import type { PackageDependency } from './package-dependency.entity.js';
import type { RepoServiceMap } from './repo-service-map.entity.js';
export interface ICodeKnowledgeRepository {
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
