import { serviceNodeId } from '../../../shared/domain/value-objects.js';
import type { ICodeKnowledgeRepository } from '../domain/code-knowledge.repository.js';
import type { AgentMemory } from '../../../shared/application/ports/agent-memory.port.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface RepoSuggestion {
    repoFullName: string;
    serviceId: string;
    score: number;
    reason: string;
}

export class SuggestRepoMappingUseCase {
    codeKnowledgeRepo;
    agentMemory;
    constructor(codeKnowledgeRepo: ICodeKnowledgeRepository, agentMemory?: AgentMemory) {
        this.codeKnowledgeRepo = codeKnowledgeRepo;
        this.agentMemory = agentMemory;
    }
    async execute(tenantId: TenantId): Promise<RepoSuggestion[]> {
        // Discover service names from Hindsight memory (topology tags)
        const serviceNames = await this.discoverServices(tenantId);
        if (serviceNames.length === 0)
            return [];

        // Get all repos from code knowledge (indexed via Composio)
        const allRepos = await this.codeKnowledgeRepo.listRepos(tenantId);
        if (allRepos.length === 0)
            return [];

        // Check existing mappings to avoid duplicates
        const existingMappings = new Set();
        for (const svcName of serviceNames) {
            const sid = serviceNodeId(svcName);
            const repos = await this.codeKnowledgeRepo.getReposByService(tenantId, sid);
            for (const r of repos) {
                existingMappings.add(`${r.repoFullName}::${svcName}`);
            }
        }
        const suggestions: RepoSuggestion[] = [];
        for (const repo of allRepos) {
            const repoFullName = repo.repoFullName;
            const repoName = repoFullName.split('/')[1]?.toLowerCase() ?? '';
            for (const serviceName of serviceNames) {
                const key = `${repoFullName}::${serviceName}`;
                if (existingMappings.has(key))
                    continue;
                const svcLower = serviceName.toLowerCase();
                let score = 0;
                let reason = '';
                if (repoName === svcLower) {
                    score = 1.0;
                    reason = 'exact name match';
                }
                else if (repoName.includes(svcLower) || svcLower.includes(repoName)) {
                    score = 0.8;
                    reason = 'name contains match';
                }
                else if (svcLower.startsWith(repoName) || repoName.startsWith(svcLower)) {
                    score = 0.7;
                    reason = 'prefix match';
                }
                else {
                    const repoWords = new Set(repoName.split(/[-_]/));
                    const serviceWords = new Set(svcLower.split(/[-_]/));
                    const overlap = [...repoWords].filter((w) => serviceWords.has(w) && w.length > 2);
                    if (overlap.length > 0) {
                        score = 0.6;
                        reason = `keyword overlap: ${overlap.join(', ')}`;
                    }
                }
                if (score > 0) {
                    suggestions.push({ repoFullName, serviceId: serviceName, score, reason });
                }
            }
        }
        return suggestions.sort((a, b) => b.score - a.score);
    }
    async discoverServices(tenantId: TenantId) {
        if (!this.agentMemory)
            return [];
        try {
            const memories = await this.agentMemory.recall(tenantId, 'all known services and their names', {
                maxResults: 20,
                tags: ['topology'],
                budget: 'low',
            });
            // Extract service-like names from memory text
            const pattern = /\b([a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:-(?:service|api|worker|db|cache|queue|gateway|proxy)))\b/gi;
            const found = new Set<string>();
            for (const m of memories) {
                const matches = m.text.match(pattern) ?? [];
                for (const match of matches)
                    found.add(match.toLowerCase());
            }
            return [...found];
        }
        catch {
            return [];
        }
    }
}
