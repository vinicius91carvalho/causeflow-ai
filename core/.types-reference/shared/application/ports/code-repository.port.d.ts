export interface CodeCommit {
    sha: string;
    message: string;
    author: string;
    date: string;
    files?: Array<{
        filename: string;
        status: string;
        additions: number;
        deletions: number;
    }>;
}
export interface CodeFile {
    path: string;
    content: string;
    size: number;
    sha: string;
}
export interface CodeDeployment {
    id: number;
    sha: string;
    environment: string;
    createdAt: string;
    status: string;
}
export interface CommitDiff {
    sha: string;
    message: string;
    files: Array<{
        filename: string;
        patch?: string;
        status: string;
    }>;
}
export interface PRMetadata {
    number: number;
    title: string;
    state: string;
    author: string;
    mergedAt?: string;
    updatedAt: string;
    headBranch: string;
    baseBranch: string;
}
export interface CreatedBranch {
    ref: string;
    sha: string;
}
export interface CreatedOrUpdatedFile {
    path: string;
    sha: string;
}
export interface CreatedPullRequest {
    number: number;
    url: string;
    htmlUrl: string;
}
export interface ICodeRepository {
    listRecentCommits(owner: string, repo: string, opts?: {
        branch?: string;
        since?: string;
        until?: string;
        limit?: number;
    }): Promise<CodeCommit[]>;
    getCommitDiff(owner: string, repo: string, sha: string): Promise<CommitDiff>;
    getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<CodeFile>;
    listDeployments(owner: string, repo: string, opts?: {
        environment?: string;
        limit?: number;
    }): Promise<CodeDeployment[]>;
    getTree(owner: string, repo: string, ref?: string): Promise<string[]>;
    listPRs(owner: string, repo: string, opts?: {
        state?: string;
        limit?: number;
    }): Promise<PRMetadata[]>;
    createBranch(owner: string, repo: string, branchName: string, baseSha: string): Promise<CreatedBranch>;
    createOrUpdateFile(owner: string, repo: string, path: string, content: string, message: string, branch: string, existingSha?: string): Promise<CreatedOrUpdatedFile>;
    createPullRequest(owner: string, repo: string, opts: {
        title: string;
        body: string;
        head: string;
        base: string;
        draft?: boolean;
    }): Promise<CreatedPullRequest>;
}
