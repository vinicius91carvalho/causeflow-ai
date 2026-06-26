import { Hono } from 'hono';
import { z } from 'zod';
import { tenantId as toTenantId } from '../../../shared/domain/value-objects.js';
import { skillId } from '../domain/skill.entity.js';
import type { CreateSkillUseCase, ListSkillsUseCase, GetSkillUseCase, UpdateSkillUseCase, DeleteSkillUseCase } from '../application/crud-skills.usecase.js';

const createSkillSchema = z.object({
    name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens'),
    displayName: z.string().min(1).max(200),
    description: z.string().min(1).max(1000),
    whenToUse: z.string().min(1).max(500),
    systemPrompt: z.string().min(1).max(10000),
    allowedTools: z.array(z.string()).min(1),
    model: z.string().optional(),
    maxTurns: z.number().int().min(1).max(20).optional(),
    minToolCalls: z.number().int().min(0).max(10).optional(),
});

const updateSkillSchema = createSkillSchema.partial().extend({
    isEnabled: z.boolean().optional(),
});

export function createSkillRoutes(deps: {
    createSkill: CreateSkillUseCase;
    listSkills: ListSkillsUseCase;
    getSkill: GetSkillUseCase;
    updateSkill: UpdateSkillUseCase;
    deleteSkill: DeleteSkillUseCase;
}): Hono {
    const app = new Hono();

    // POST /api/v1/tenants/:tenantId/skills
    app.post('/api/v1/tenants/:tenantId/skills', async (c) => {
        const tid = toTenantId(c.req.param('tenantId'));
        const body = createSkillSchema.parse(await c.req.json());
        const skill = await deps.createSkill.execute({ tenantId: tid, ...body });
        return c.json(skill, 201);
    });

    // GET /api/v1/tenants/:tenantId/skills
    app.get('/api/v1/tenants/:tenantId/skills', async (c) => {
        const tid = toTenantId(c.req.param('tenantId'));
        const skills = await deps.listSkills.execute(tid);
        return c.json(skills);
    });

    // GET /api/v1/tenants/:tenantId/skills/:id
    app.get('/api/v1/tenants/:tenantId/skills/:id', async (c) => {
        const tid = toTenantId(c.req.param('tenantId'));
        const id = skillId(c.req.param('id'));
        const skill = await deps.getSkill.execute(tid, id);
        if (!skill) return c.json({ error: 'Skill not found' }, 404);
        return c.json(skill);
    });

    // PUT /api/v1/tenants/:tenantId/skills/:id
    app.put('/api/v1/tenants/:tenantId/skills/:id', async (c) => {
        const tid = toTenantId(c.req.param('tenantId'));
        const id = skillId(c.req.param('id'));
        const body = updateSkillSchema.parse(await c.req.json());
        const skill = await deps.updateSkill.execute(tid, id, body);
        return c.json(skill);
    });

    // DELETE /api/v1/tenants/:tenantId/skills/:id
    app.delete('/api/v1/tenants/:tenantId/skills/:id', async (c) => {
        const tid = toTenantId(c.req.param('tenantId'));
        const id = skillId(c.req.param('id'));
        await deps.deleteSkill.execute(tid, id);
        return c.json({ ok: true });
    });

    return app;
}
