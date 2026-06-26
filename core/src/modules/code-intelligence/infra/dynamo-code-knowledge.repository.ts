import { serviceNodeId } from '../../../shared/domain/value-objects.js';
import { RepoNodeEntity } from '../../../shared/infra/db/entities/RepoNodeEntity.js';
import { PackageDependencyEntity } from '../../../shared/infra/db/entities/PackageDependencyEntity.js';
import { RepoServiceMapEntity } from '../../../shared/infra/db/entities/RepoServiceMapEntity.js';
import type { ICodeKnowledgeRepository } from '../domain/code-knowledge.repository.js';
import type { RepoNode } from '../domain/repo-node.entity.js';
import type { PackageDependency } from '../domain/package-dependency.entity.js';
import type { RepoServiceMap } from '../domain/repo-service-map.entity.js';
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
        if (!result.data)
            return null;
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
}
