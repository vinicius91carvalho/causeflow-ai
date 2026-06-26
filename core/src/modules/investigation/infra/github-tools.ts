import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { ICodeRepository } from '../../../shared/application/ports/code-repository.port.js';

export interface GitHubToolDeps {
    codeRepo: ICodeRepository;
    knownRepos?: string[];
}

// --- Zod Schemas ---
export const getRecentCommitsInputSchema = z.object({
    owner: z.string().describe('GitHub repository owner (org or user)'),
    repo: z.string().describe('GitHub repository name'),
    branch: z.string().optional().describe('Branch name (defaults to default branch)'),
    since: z.string().optional().describe('ISO 8601 start time to filter commits'),
    limit: z.number().optional().default(10).describe('Max number of commits to return'),
});
export const getCommitDiffInputSchema = z.object({
    owner: z.string().describe('GitHub repository owner'),
    repo: z.string().describe('GitHub repository name'),
    sha: z.string().describe('Commit SHA to get the diff for'),
});
export const getFileContentInputSchema = z.object({
    owner: z.string().describe('GitHub repository owner'),
    repo: z.string().describe('GitHub repository name'),
    path: z.string().describe('File path within the repository (e.g., "Dockerfile", "src/config.ts")'),
    ref: z.string().optional().describe('Git ref (branch, tag, or commit SHA)'),
});
export const getDeploymentsInputSchema = z.object({
    owner: z.string().describe('GitHub repository owner'),
    repo: z.string().describe('GitHub repository name'),
    environment: z.string().optional().describe('Filter by deployment environment (e.g., "production")'),
    limit: z.number().optional().default(5).describe('Max number of deployments to return'),
});
// --- Helper ---
function zodToInputSchema(schema: z.ZodTypeAny) {
    const { $schema: _, ...rest } = zodToJsonSchema(schema);
    return rest;
}
// --- Tool Definitions ---
export const GITHUB_TOOLS = [
    {
        name: 'get_recent_commits',
        description: 'List recent commits for a repository. Use to find recent code changes that may correlate with the incident.',
        inputSchema: zodToInputSchema(getRecentCommitsInputSchema),
        maxResultChars: 15_000,
        isConcurrencySafe: true,
    },
    {
        name: 'get_commit_diff',
        description: 'Get the diff/patch for a specific commit. Use to inspect what code changed in a suspicious commit.',
        inputSchema: zodToInputSchema(getCommitDiffInputSchema),
        maxResultChars: 20_000,
        isConcurrencySafe: true,
    },
    {
        name: 'get_file_content',
        description: 'Read a specific file from a repository. Use to inspect configuration files, Dockerfiles, or source code related to the incident.',
        inputSchema: zodToInputSchema(getFileContentInputSchema),
        maxResultChars: 15_000,
        isConcurrencySafe: true,
    },
    {
        name: 'get_deployments',
        description: 'List recent deployments. Use to correlate deployment events with incident timeline.',
        inputSchema: zodToInputSchema(getDeploymentsInputSchema),
        maxResultChars: 10_000,
        isConcurrencySafe: true,
    },
];
// --- Repo Resolution ---
/**
 * Resolves the correct owner/repo from known repos when the LLM guesses wrong.
 *
 * Matching strategy (first match wins):
 * 1. Exact match: owner/repo already matches a known repo
 * 2. Repo name match: the repo part matches (e.g. "sample-payment-service" in "causeflow/sample-payment-service")
 * 3. Substring match: the repo name contains or is contained in a known repo name (e.g. "payment-service" → "sample-payment-service")
 */
function resolveRepo(owner: string, repo: string, knownRepos: string[]): { owner: string; repo: string } {
    if (knownRepos.length === 0)
        return { owner, repo };
    const fullName = `${owner}/${repo}`;
    // Exact match
    if (knownRepos.includes(fullName))
        return { owner, repo };
    // Repo name exact match
    for (const known of knownRepos) {
        const [kOwner, kRepo] = known.split('/');
        if (kRepo === repo && kOwner)
            return { owner: kOwner, repo: kRepo };
    }
    // Substring match (repo contains or is contained in known repo name)
    const repoLower = repo.toLowerCase();
    for (const known of knownRepos) {
        const [kOwner, kRepo] = known.split('/');
        if (!kOwner || !kRepo) continue;
        const kRepoLower = kRepo.toLowerCase();
        if (kRepoLower.includes(repoLower) || repoLower.includes(kRepoLower)) {
            return { owner: kOwner, repo: kRepo };
        }
    }
    // No match — return as-is (will get 404, agent handles it)
    return { owner, repo };
}
export function createGitHubToolHandler(deps: GitHubToolDeps): (name: string, input: Record<string, unknown>) => Promise<string | null> {
    const known = deps.knownRepos ?? [];
    return async (name, input) => {
        try {
            switch (name) {
                case 'get_recent_commits': {
                    const validated = getRecentCommitsInputSchema.parse(input);
                    const { owner, repo } = resolveRepo(validated.owner, validated.repo, known);
                    const commits = await deps.codeRepo.listRecentCommits(owner, repo, {
                        branch: validated.branch,
                        since: validated.since,
                        limit: validated.limit,
                    });
                    return JSON.stringify(commits);
                }
                case 'get_commit_diff': {
                    const validated = getCommitDiffInputSchema.parse(input);
                    const { owner, repo } = resolveRepo(validated.owner, validated.repo, known);
                    const diff = await deps.codeRepo.getCommitDiff(owner, repo, validated.sha);
                    return JSON.stringify(diff);
                }
                case 'get_file_content': {
                    const validated = getFileContentInputSchema.parse(input);
                    const { owner, repo } = resolveRepo(validated.owner, validated.repo, known);
                    const file = await deps.codeRepo.getFileContent(owner, repo, validated.path, validated.ref);
                    return JSON.stringify(file);
                }
                case 'get_deployments': {
                    const validated = getDeploymentsInputSchema.parse(input);
                    const { owner, repo } = resolveRepo(validated.owner, validated.repo, known);
                    const deployments = await deps.codeRepo.listDeployments(owner, repo, {
                        environment: validated.environment,
                        limit: validated.limit,
                    });
                    return JSON.stringify(deployments);
                }
                default:
                    return null;
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return JSON.stringify({ error: msg });
        }
    };
}
