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
} from '../../application/ports/code-repository.port.js';

/**
 * A static code repository that returns fixture-like data for any repo URL.
 * Used in dev/test when no real GitHub/Composio credentials are available.
 *
 * The file tree includes a package.json with dependencies, a Dockerfile,
 * CI workflows, and source files so that IndexRepositoryUseCase can
 * exercise all its detection logic (language, config, dependencies).
 */
const STATIC_FILES: Record<string, string> = {
  'package.json': JSON.stringify({
    name: 'payment-service',
    version: '1.0.0',
    dependencies: {
      express: '^4.18.0',
      'retry-axios': '^3.0.0',
      lodash: '^4.17.21',
    },
    devDependencies: {
      typescript: '^5.7.0',
      vitest: '^2.1.0',
    },
  }),
  'src/services/retry-handler.ts': `import { retry } from 'retry-axios';

export async function fetchWithRetry(url: string, maxRetries = 3) {
  return retry(url, {
    retry: maxRetries,
    backoff: 'exponential',
  });
}
`,
  'src/services/payment.service.ts': `import { fetchWithRetry } from './retry-handler.js';

export class PaymentService {
  async processPayment(id: string) {
    return fetchWithRetry(\`/api/payments/\${id}\`);
  }
}
`,
  'src/config.ts': `export const config = {
  requestTimeoutMs: 30000,
  retryCount: 3,
};
`,
  Dockerfile: `FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY dist/ ./dist/
CMD ["node", "dist/index.js"]
`,
  '.github/workflows/ci.yml': `name: CI
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test
`,
  'infra/main.tf': `resource "aws_ecs_service" "app" {
  name = "payment-service"
}
`,
};

export class StaticCodeRepository implements ICodeRepository {
  async listRecentCommits(
    _owner: string,
    _repo: string,
    _opts?: { branch?: string; since?: string; until?: string; limit?: number },
  ): Promise<CodeCommit[]> {
    return [
      {
        sha: 'a1b2c3d4',
        message: 'feat: add retry handler',
        author: 'dev@acme.com',
        date: new Date().toISOString(),
        files: [
          {
            filename: 'src/services/retry-handler.ts',
            status: 'added',
            additions: 25,
            deletions: 0,
          },
        ],
      },
    ];
  }

  async getCommitDiff(_owner: string, _repo: string, sha: string): Promise<CommitDiff> {
    return {
      sha,
      message: 'feat: add retry handler',
      files: [
        {
          filename: 'src/services/retry-handler.ts',
          status: 'added',
          patch: `+export async function fetchWithRetry(url: string, maxRetries = 3) {\n+  return retry(url, { retry: maxRetries });\n+}`,
        },
      ],
    };
  }

  async getFileContent(
    _owner: string,
    _repo: string,
    path: string,
    _ref?: string,
  ): Promise<CodeFile> {
    const content = STATIC_FILES[path];
    if (content === undefined) {
      throw new Error(`File '${path}' not found in static repository`);
    }
    return {
      path,
      content,
      size: Buffer.byteLength(content, 'utf-8'),
      sha: `static-${path.replace(/[^\w]/g, '-')}`,
    };
  }

  async listDeployments(
    _owner: string,
    _repo: string,
    _opts?: { environment?: string; limit?: number },
  ): Promise<CodeDeployment[]> {
    return [];
  }

  async getTree(_owner: string, _repo: string, _ref?: string): Promise<string[]> {
    return Object.keys(STATIC_FILES);
  }

  async listPRs(
    _owner: string,
    _repo: string,
    _opts?: { state?: string; limit?: number },
  ): Promise<PRMetadata[]> {
    return [];
  }

  async createBranch(
    _owner: string,
    _repo: string,
    branchName: string,
    baseSha: string,
  ): Promise<CreatedBranch> {
    return { ref: `refs/heads/${branchName}`, sha: baseSha };
  }

  async createOrUpdateFile(
    _owner: string,
    _repo: string,
    path: string,
    _content: string,
    _message: string,
    _branch: string,
    _existingSha?: string,
  ): Promise<CreatedOrUpdatedFile> {
    return { path, sha: `static-${path.replace(/[^\w]/g, '-')}` };
  }

  async createPullRequest(
    _owner: string,
    _repo: string,
    _opts: { title: string; body: string; head: string; base: string; draft?: boolean },
  ): Promise<CreatedPullRequest> {
    return {
      number: 1,
      url: `https://api.github.com/repos/${_owner}/${_repo}/pulls/1`,
      htmlUrl: `https://github.com/${_owner}/${_repo}/pull/1`,
    };
  }
}
