import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { serviceNodeId } from '../../../shared/domain/value-objects.js';
import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { ICodeKnowledgeRepository } from '../../code-intelligence/domain/code-knowledge.repository.js';
import type { ICodeRepository } from '../../../shared/application/ports/code-repository.port.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface CodeAnalyzerToolDeps {
    codeKnowledgeRepo: ICodeKnowledgeRepository;
    codeRepo?: ICodeRepository;
    tenantId: TenantId;
}

// --- Zod Schemas ---
const getServiceReposSchema = z.object({
    serviceId: z.string().describe('Service ID to find associated repositories'),
});
const getDependenciesSchema = z.object({
    repoFullName: z.string().describe('Full repository name (owner/repo) to get dependencies for'),
});
const findDependentsSchema = z.object({
    packageName: z.string().describe('Package name to find dependents of (e.g., "@acme/shared-sdk")'),
});
const getRepoInfoSchema = z.object({
    repoFullName: z.string().describe('Full repository name (owner/repo) to get metadata for'),
});
const readFileSchema = z.object({
    owner: z.string().describe('GitHub repository owner'),
    repo: z.string().describe('GitHub repository name'),
    path: z.string().describe('File path within the repository'),
    ref: z.string().optional().describe('Git ref (branch, tag, or commit SHA)'),
});
const getRecentCommitsSchema = z.object({
    owner: z.string().describe('GitHub repository owner'),
    repo: z.string().describe('GitHub repository name'),
    branch: z.string().optional().describe('Branch name'),
    since: z.string().optional().describe('ISO 8601 start time'),
    limit: z.number().optional().default(10).describe('Max commits to return'),
});
const getCommitDiffSchema = z.object({
    owner: z.string().describe('GitHub repository owner'),
    repo: z.string().describe('GitHub repository name'),
    sha: z.string().describe('Commit SHA to get diff for'),
});
const listPRsSchema = z.object({
    owner: z.string().describe('GitHub repository owner'),
    repo: z.string().describe('GitHub repository name'),
    state: z.string().optional().default('closed').describe('PR state filter'),
    limit: z.number().optional().default(10).describe('Max PRs to return'),
});
const getTreeSchema = z.object({
    owner: z.string().describe('GitHub repository owner'),
    repo: z.string().describe('GitHub repository name'),
    ref: z.string().optional().describe('Git ref (branch, tag, or commit SHA). Defaults to default branch.'),
});
// --- Helper ---
function zodToInputSchema(schema: z.ZodType) {
    const { $schema: _, ...rest } = zodToJsonSchema(schema);
    return rest;
}
// --- Tool Definitions ---
export const CODE_ANALYZER_TOOLS = [
    // Index tools (DynamoDB, instant)
    {
        name: 'code_get_service_repos',
        description: 'Get repositories associated with a service. Returns repo names, deploy targets, and environments.',
        inputSchema: zodToInputSchema(getServiceReposSchema),
    },
    {
        name: 'code_get_dependencies',
        description: 'Get package dependencies for a repository. Returns package names, versions, and whether they are dev dependencies.',
        inputSchema: zodToInputSchema(getDependenciesSchema),
    },
    {
        name: 'code_find_dependents',
        description: 'Find all repositories that depend on a specific package. Useful for blast radius analysis across repos.',
        inputSchema: zodToInputSchema(findDependentsSchema),
    },
    {
        name: 'code_get_repo_info',
        description: 'Get indexed metadata for a repository: language, file count, last commit, config detection (Dockerfile, CI, IaC).',
        inputSchema: zodToInputSchema(getRepoInfoSchema),
    },
    {
        name: 'code_list_repos',
        description: 'List all indexed repositories for the current tenant.',
        inputSchema: zodToInputSchema(z.object({})),
    },
    // On-demand tools (GitHub API)
    {
        name: 'code_read_file',
        description: 'Read a specific file from a GitHub repository. Use to inspect source code, configs, or manifests.',
        inputSchema: zodToInputSchema(readFileSchema),
    },
    {
        name: 'code_get_recent_commits',
        description: 'List recent commits for a repository. Use to find code changes that may correlate with the incident.',
        inputSchema: zodToInputSchema(getRecentCommitsSchema),
    },
    {
        name: 'code_get_commit_diff',
        description: 'Get the diff for a specific commit. Inspect what changed in a suspicious commit.',
        inputSchema: zodToInputSchema(getCommitDiffSchema),
    },
    {
        name: 'code_list_prs',
        description: 'List recent pull requests for a repository. Useful for understanding recent merged changes.',
        inputSchema: zodToInputSchema(listPRsSchema),
    },
    {
        name: 'code_get_tree',
        description: 'List all files in a repository. Use this FIRST to discover the file structure before reading specific files.',
        inputSchema: zodToInputSchema(getTreeSchema),
    },
];
export function createCodeAnalyzerToolHandler(deps: CodeAnalyzerToolDeps): (name: string, input: Record<string, unknown>) => Promise<string | null> {
    return async (name, input) => {
        try {
            switch (name) {
                // --- Index tools ---
                case 'code_get_service_repos': {
                    const validated = getServiceReposSchema.parse(input);
                    const repos = await deps.codeKnowledgeRepo.getReposByService(deps.tenantId, serviceNodeId(validated.serviceId));
                    return JSON.stringify(repos);
                }
                case 'code_get_dependencies': {
                    const validated = getDependenciesSchema.parse(input);
                    const dependencies = await deps.codeKnowledgeRepo.getDependencies(deps.tenantId, validated.repoFullName);
                    return JSON.stringify(dependencies);
                }
                case 'code_find_dependents': {
                    const validated = findDependentsSchema.parse(input);
                    const dependents = await deps.codeKnowledgeRepo.getDependents(deps.tenantId, validated.packageName);
                    return JSON.stringify(dependents);
                }
                case 'code_get_repo_info': {
                    const validated = getRepoInfoSchema.parse(input);
                    const repo = await deps.codeKnowledgeRepo.getRepo(deps.tenantId, validated.repoFullName);
                    if (!repo)
                        return JSON.stringify({ error: 'Repository not indexed' });
                    return JSON.stringify(repo);
                }
                case 'code_list_repos': {
                    const repos = await deps.codeKnowledgeRepo.listRepos(deps.tenantId);
                    return JSON.stringify(repos);
                }
                // --- On-demand tools (GitHub API) ---
                case 'code_read_file': {
                    if (!deps.codeRepo)
                        return JSON.stringify({ error: 'GitHub not configured for this tenant' });
                    const validated = readFileSchema.parse(input);
                    const file = await deps.codeRepo.getFileContent(validated.owner, validated.repo, validated.path, validated.ref);
                    return JSON.stringify(file);
                }
                case 'code_get_recent_commits': {
                    if (!deps.codeRepo)
                        return JSON.stringify({ error: 'GitHub not configured for this tenant' });
                    const validated = getRecentCommitsSchema.parse(input);
                    const commits = await deps.codeRepo.listRecentCommits(validated.owner, validated.repo, {
                        branch: validated.branch,
                        since: validated.since,
                        limit: validated.limit,
                    });
                    return JSON.stringify(commits);
                }
                case 'code_get_commit_diff': {
                    if (!deps.codeRepo)
                        return JSON.stringify({ error: 'GitHub not configured for this tenant' });
                    const validated = getCommitDiffSchema.parse(input);
                    const diff = await deps.codeRepo.getCommitDiff(validated.owner, validated.repo, validated.sha);
                    return JSON.stringify(diff);
                }
                case 'code_list_prs': {
                    if (!deps.codeRepo)
                        return JSON.stringify({ error: 'GitHub not configured for this tenant' });
                    const validated = listPRsSchema.parse(input);
                    const prs = await deps.codeRepo.listPRs(validated.owner, validated.repo, {
                        state: validated.state,
                        limit: validated.limit,
                    });
                    return JSON.stringify(prs);
                }
                case 'code_get_tree': {
                    if (!deps.codeRepo)
                        return JSON.stringify({ error: 'GitHub not configured for this tenant' });
                    const validated = getTreeSchema.parse(input);
                    const files = await deps.codeRepo.getTree(validated.owner, validated.repo, validated.ref);
                    return JSON.stringify({ files, totalFiles: files.length });
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
