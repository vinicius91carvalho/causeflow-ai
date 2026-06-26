import type { RepoServiceMap } from '../../code-intelligence/domain/repo-service-map.entity.js';
export interface RepoContextEntry {
    repoFullName: string;
    serviceId: string;
    role: 'PRIMARY' | 'NEIGHBOR';
}
export declare function collectRepos(primaryMappings: RepoServiceMap[], neighborMappings: RepoServiceMap[]): RepoContextEntry[];
export declare function formatRepoContext(entries: RepoContextEntry[]): string;
/**
 * Matches the incident text against known service names from the graph.
 *
 * Strategy: longest match wins (more specific).
 * "payment-service-high-error-rate" matches "payment-service" over "service".
 */
export declare function matchServiceId(incident: {
    title: string;
    description: string;
}, serviceNames: string[]): string | undefined;
