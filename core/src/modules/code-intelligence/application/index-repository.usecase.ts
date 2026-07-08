import { logger } from '../../../shared/infra/logger.js';
import type { ICodeKnowledgeRepository } from '../domain/code-knowledge.repository.js';
import type { ICodeRepository } from '../../../shared/application/ports/code-repository.port.js';
import type { IEventBus } from '../../../shared/domain/events.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';

export interface IndexRepositoryInput {
    tenantId: TenantId;
    repoFullName: string;
    ref?: string;
}

const LANG_MAP = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.go': 'go',
    '.java': 'java',
    '.rs': 'rust',
    '.rb': 'ruby',
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.c': 'c',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
};
function detectLanguage(files: string[]) {
    const counts: Record<string, number> = {};
    for (const file of files) {
        const ext = file.substring(file.lastIndexOf('.'));
        const lang = LANG_MAP[ext as keyof typeof LANG_MAP];
        if (lang) {
            counts[lang] = (counts[lang] ?? 0) + 1;
        }
    }
    let dominant: string | undefined;
    let max = 0;
    for (const [lang, count] of Object.entries(counts)) {
        if (count > max) {
            max = count;
            dominant = lang;
        }
    }
    return dominant;
}
export class IndexRepositoryUseCase {
    codeKnowledgeRepo;
    codeRepoFactory;
    eventBus;
    constructor(codeKnowledgeRepo: ICodeKnowledgeRepository, codeRepoFactory: (tenantId: TenantId) => ICodeRepository | undefined, eventBus: IEventBus) {
        this.codeKnowledgeRepo = codeKnowledgeRepo;
        this.codeRepoFactory = codeRepoFactory;
        this.eventBus = eventBus;
    }
    async execute(input: IndexRepositoryInput): Promise<void> {
        const { tenantId, repoFullName, ref } = input;
        const [owner, repo] = repoFullName.split('/');
        if (!owner || !repo) {
            logger.warn({ repoFullName }, 'Invalid repoFullName for indexing');
            return;
        }
        const codeRepo = this.codeRepoFactory(tenantId);
        if (!codeRepo) {
            logger.warn({ tenantId, repoFullName }, 'No code repository available for tenant');
            return;
        }
        let hasDockerfile = false;
        let hasCi = false;
        let hasIac = false;
        let files = [];
        // 1. Get file tree
        try {
            files = await codeRepo.getTree(owner, repo, ref);
        }
        catch (err) {
            logger.error({ err, repoFullName }, 'Failed to get repo tree');
            return;
        }
        // 2. Read package.json → parse dependencies
        try {
            const pkgFile = await codeRepo.getFileContent(owner, repo, 'package.json', ref);
            const pkg = JSON.parse(pkgFile.content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
            await this.codeKnowledgeRepo.clearDependencies(tenantId, repoFullName);
            const allDeps = [];
            if (pkg.dependencies) {
                for (const [name, version] of Object.entries(pkg.dependencies)) {
                    allDeps.push({ name, version, isDev: false });
                }
            }
            if (pkg.devDependencies) {
                for (const [name, version] of Object.entries(pkg.devDependencies)) {
                    allDeps.push({ name, version, isDev: true });
                }
            }
            for (const dep of allDeps) {
                await this.codeKnowledgeRepo.upsertDependency({
                    tenantId,
                    repoFullName,
                    packageName: dep.name,
                    version: dep.version,
                    declaredIn: 'package.json',
                    isDev: dep.isDev,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            }
        }
        catch {
            // No package.json — not a JS/TS project, skip deps
        }
        // 3. Detect config files
        hasDockerfile = files.some((f) => f === 'Dockerfile' || f.endsWith('/Dockerfile'));
        hasCi = files.some((f) => f.startsWith('.github/workflows/'));
        hasIac = files.some((f) => f.endsWith('.tf') ||
            f.includes('cdk') ||
            f.includes('cloudformation') ||
            f.endsWith('serverless.yml'));
        // 4. Detect language
        const language = detectLanguage(files);
        // 5. Upsert repo node
        await this.codeKnowledgeRepo.upsertRepo({
            tenantId,
            repoFullName,
            provider: 'github',
            language,
            lastCommitSha: ref,
            lastIndexedAt: new Date().toISOString(),
            fileCount: files.length,
            config: { dockerfile: hasDockerfile, ci: hasCi, iac: hasIac },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
        // 6. Create service edge for this repo (placeholder — real service discovery happens later)
        const edgeId = `edge-${repoFullName.replace(/[/.]/g, '-')}`;
        await this.codeKnowledgeRepo.upsertServiceEdge({
            tenantId,
            edgeId,
            sourceService: repoFullName,
            targetService: 'external',
            edgeType: 'http',
            isCriticalPath: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });

        // 7. Emit event
        await this.eventBus.publish({
            eventType: 'knowledge.repo_indexed',
            occurredAt: new Date().toISOString(),
            tenantId,
            payload: { repoFullName, language, fileCount: files.length },
        });
        logger.info({ tenantId, repoFullName, language, fileCount: files.length }, 'Repository indexed');
    }
}
