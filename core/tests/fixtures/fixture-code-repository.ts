import type {
  ICodeRepository,
  CodeCommit,
  CommitDiff,
  CodeFile,
  CodeDeployment,
  PRMetadata,
  CreatedBranch,
  CreatedOrUpdatedFile,
  CreatedPullRequest,
} from '../../src/shared/application/ports/code-repository.port.js';
import type { FixtureScenario } from './scenarios/index.js';

export class FixtureCodeRepository implements ICodeRepository {
  constructor(private scenario: FixtureScenario) {}

  async listRecentCommits(
    _owner: string,
    _repo: string,
    opts?: { branch?: string; since?: string; until?: string; limit?: number },
  ): Promise<CodeCommit[]> {
    let commits = [...this.scenario.commits];

    if (opts?.since) {
      const sinceDate = new Date(opts.since).getTime();
      commits = commits.filter((c) => new Date(c.date).getTime() >= sinceDate);
    }

    if (opts?.until) {
      const untilDate = new Date(opts.until).getTime();
      commits = commits.filter((c) => new Date(c.date).getTime() <= untilDate);
    }

    // Sort by date descending (most recent first)
    commits.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (opts?.limit && opts.limit > 0) {
      commits = commits.slice(0, opts.limit);
    }

    return commits;
  }

  async getCommitDiff(_owner: string, _repo: string, sha: string): Promise<CommitDiff> {
    const diff = this.scenario.diffs[sha];
    if (!diff) {
      throw new Error(`Commit ${sha} not found in fixture scenario '${this.scenario.name}'`);
    }
    return diff;
  }

  async getFileContent(_owner: string, _repo: string, path: string, _ref?: string): Promise<CodeFile> {
    const file = this.scenario.files[path];
    if (!file) {
      throw new Error(`File '${path}' not found in fixture scenario '${this.scenario.name}'`);
    }
    return file;
  }

  async listDeployments(
    _owner: string,
    _repo: string,
    opts?: { environment?: string; limit?: number },
  ): Promise<CodeDeployment[]> {
    let deployments = [...this.scenario.deployments];

    if (opts?.environment) {
      deployments = deployments.filter((d) => d.environment === opts.environment);
    }

    // Sort by createdAt descending
    deployments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (opts?.limit && opts.limit > 0) {
      deployments = deployments.slice(0, opts.limit);
    }

    return deployments;
  }

  async getTree(_owner: string, _repo: string, _ref?: string): Promise<string[]> {
    return Object.keys(this.scenario.files);
  }

  async listPRs(
    _owner: string,
    _repo: string,
    _opts?: { state?: string; limit?: number },
  ): Promise<PRMetadata[]> {
    return [];
  }

  async createBranch(_owner: string, _repo: string, branchName: string, baseSha: string): Promise<CreatedBranch> {
    return { ref: `refs/heads/${branchName}`, sha: baseSha };
  }

  async createOrUpdateFile(_owner: string, _repo: string, path: string, _content: string, _message: string, _branch: string, _existingSha?: string): Promise<CreatedOrUpdatedFile> {
    return { path, sha: 'stub-sha-' + path.replace(/\//g, '-') };
  }

  async createPullRequest(_owner: string, _repo: string, _opts: { title: string; body: string; head: string; base: string; draft?: boolean }): Promise<CreatedPullRequest> {
    return { number: 1, url: `https://api.github.com/repos/stub/repo/pulls/1`, htmlUrl: `https://github.com/stub/repo/pull/1` };
  }
}

export interface SpyCall {
  method: string;
  args: unknown[];
}

export class SpyCodeRepository extends FixtureCodeRepository {
  readonly calls: SpyCall[] = [];

  override async createBranch(owner: string, repo: string, branchName: string, baseSha: string): Promise<CreatedBranch> {
    this.calls.push({ method: 'createBranch', args: [owner, repo, branchName, baseSha] });
    return super.createBranch(owner, repo, branchName, baseSha);
  }

  override async createOrUpdateFile(owner: string, repo: string, path: string, content: string, message: string, branch: string, existingSha?: string): Promise<CreatedOrUpdatedFile> {
    this.calls.push({ method: 'createOrUpdateFile', args: [owner, repo, path, content, message, branch, existingSha] });
    return super.createOrUpdateFile(owner, repo, path, content, message, branch, existingSha);
  }

  override async createPullRequest(owner: string, repo: string, opts: { title: string; body: string; head: string; base: string; draft?: boolean }): Promise<CreatedPullRequest> {
    this.calls.push({ method: 'createPullRequest', args: [owner, repo, opts] });
    return super.createPullRequest(owner, repo, opts);
  }
}
