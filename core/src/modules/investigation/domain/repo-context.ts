import type { RepoServiceMap } from '../../code-intelligence/domain/repo-service-map.entity.js';

export interface RepoContextEntry {
    repoFullName: string;
    serviceId: string;
    role: 'PRIMARY' | 'NEIGHBOR';
}

export function collectRepos(primaryMappings: RepoServiceMap[], neighborMappings: RepoServiceMap[]): RepoContextEntry[] {
    const seen = new Set<string>();
    const entries: RepoContextEntry[] = [];
    for (const m of primaryMappings) {
        if (!seen.has(m.repoFullName)) {
            seen.add(m.repoFullName);
            entries.push({ repoFullName: m.repoFullName, serviceId: m.serviceId, role: 'PRIMARY' });
        }
    }
    for (const m of neighborMappings) {
        if (!seen.has(m.repoFullName)) {
            seen.add(m.repoFullName);
            entries.push({ repoFullName: m.repoFullName, serviceId: m.serviceId, role: 'NEIGHBOR' });
        }
    }
    return entries;
}
export function formatRepoContext(entries: RepoContextEntry[]): string {
    if (entries.length === 0)
        return '';
    const lines = entries.map((e) => {
        const [owner, repo] = e.repoFullName.split('/');
        return `  - [${e.role}] owner="${owner}" repo="${repo}" (service: ${e.serviceId})`;
    });
    return `

IMPORTANT — GitHub Repositories for this tenant (use ONLY these repos in GitHub tool calls):
${lines.join('\n')}
Do NOT guess repository names. Use the exact owner and repo values listed above.`;
}
/**
 * Matches the incident text against known service names from the graph.
 *
 * Strategy: longest match wins (more specific).
 * "payment-service-high-error-rate" matches "payment-service" over "service".
 */
export function matchServiceId(incident: { title: string; description: string }, serviceNames: string[]): string | undefined {
    if (serviceNames.length === 0)
        return undefined;
    const text = `${incident.title} ${incident.description}`.toLowerCase();
    // Sort by length descending — longest (most specific) match wins
    const sorted = [...serviceNames].sort((a, b) => b.length - a.length);
    for (const name of sorted) {
        if (text.includes(name.toLowerCase())) {
            return name;
        }
    }
    return undefined;
}
