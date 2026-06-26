import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { serviceNodeId } from '../../../shared/domain/value-objects.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { ICodeKnowledgeRepository } from '../domain/code-knowledge.repository.js';
import type { SuggestRepoMappingUseCase } from '../application/suggest-repo-mapping.usecase.js';

export interface CodeKnowledgeUseCases {
    codeKnowledgeRepo: ICodeKnowledgeRepository;
    suggestRepoMapping: SuggestRepoMappingUseCase;
}

const repoMappingSchema = z.object({
    mappings: z.array(z.object({
        repoFullName: z.string().min(1),
        serviceId: z.string().min(1),
        deployTarget: z.string().optional(),
        environment: z.string().optional(),
    })).min(1),
});
export function createCodeKnowledgeRoutes(useCases: CodeKnowledgeUseCases) {
    const app = new Hono<AppEnv>();
    // List repos
    app.get('/repos', async (c) => {
        const tenantId = c.get('tenantId');
        const repos = await useCases.codeKnowledgeRepo.listRepos(tenantId);
        return c.json(repos);
    });
    // Get repo details
    app.get('/repos/:owner/:repo', async (c) => {
        const tenantId = c.get('tenantId');
        const repoFullName = `${c.req.param('owner')}/${c.req.param('repo')}`;
        const repo = await useCases.codeKnowledgeRepo.getRepo(tenantId, repoFullName);
        if (!repo)
            return c.json({ error: 'Repository not found' }, 404);
        return c.json(repo);
    });
    // Get repo dependencies
    app.get('/repos/:owner/:repo/deps', async (c) => {
        const tenantId = c.get('tenantId');
        const repoFullName = `${c.req.param('owner')}/${c.req.param('repo')}`;
        const deps = await useCases.codeKnowledgeRepo.getDependencies(tenantId, repoFullName);
        return c.json(deps);
    });
    // Get dependents for a package
    app.get('/deps/:packageName/dependents', async (c) => {
        const tenantId = c.get('tenantId');
        const packageName = decodeURIComponent(c.req.param('packageName'));
        const dependents = await useCases.codeKnowledgeRepo.getDependents(tenantId, packageName);
        return c.json(dependents);
    });
    // Auto-suggest repo mappings
    app.get('/repo-suggestions', async (c) => {
        const tenantId = c.get('tenantId');
        const suggestions = await useCases.suggestRepoMapping.execute(tenantId);
        return c.json(suggestions);
    });
    // Apply repo mappings (batch)
    app.post('/repo-mappings', zValidator('json', repoMappingSchema), async (c) => {
        const tenantId = c.get('tenantId');
        const { mappings } = c.req.valid('json');
        const results = [];
        for (const m of mappings) {
            const result = await useCases.codeKnowledgeRepo.upsertRepoServiceMap({
                tenantId,
                repoFullName: m.repoFullName,
                serviceId: serviceNodeId(m.serviceId),
                deployTarget: m.deployTarget,
                environment: m.environment,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            results.push(result);
        }
        return c.json(results, 201);
    });
    // Get repos for a service
    app.get('/services/:serviceId/repos', async (c) => {
        const tenantId = c.get('tenantId');
        const sid = serviceNodeId(c.req.param('serviceId'));
        const repos = await useCases.codeKnowledgeRepo.getReposByService(tenantId, sid);
        return c.json(repos);
    });
    return app;
}
