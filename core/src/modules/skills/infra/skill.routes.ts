import { Hono } from 'hono';
import { z } from 'zod';
import { tenantId as toTenantId } from '../../../shared/domain/value-objects.js';
import { skillId } from '../domain/skill.entity.js';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { CreateSkillUseCase, ListSkillsUseCase, GetSkillUseCase, UpdateSkillUseCase, DeleteSkillUseCase } from '../application/crud-skills.usecase.js';
import type { PinRunbookUseCase } from '../application/pin-runbook.usecase.js';

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

const pinRunbookSchema = z.object({
    remediationId: z.string().uuid(),
});

export function createSkillRoutes(deps: {
    createSkill: CreateSkillUseCase;
    listSkills: ListSkillsUseCase;
    getSkill: GetSkillUseCase;
    updateSkill: UpdateSkillUseCase;
    deleteSkill: DeleteSkillUseCase;
    pinRunbook: PinRunbookUseCase;
}): Hono<AppEnv> {
    const app = new Hono<AppEnv>();

    // POST /api/v1/skills
    app.post('/api/v1/skills', async (c) => {
        const tid = toTenantId(c.get('tenantId'));
        const body = createSkillSchema.parse(await c.req.json());
        const skill = await deps.createSkill.execute({ tenantId: tid, ...body });
        return c.json(skill, 201);
    });

    // GET /api/v1/skills
    app.get('/api/v1/skills', async (c) => {
        const tid = toTenantId(c.get('tenantId'));
        const skills = await deps.listSkills.execute(tid);
        return c.json(skills);
    });

    // GET /api/v1/skills/:id
    app.get('/api/v1/skills/:id', async (c) => {
        const tid = toTenantId(c.get('tenantId'));
        const id = skillId(c.req.param('id'));
        const skill = await deps.getSkill.execute(tid, id);
        if (!skill) return c.json({ error: 'Skill not found' }, 404);
        return c.json(skill);
    });

    // POST /api/v1/skills/:id/runbook — pin a successful remediation (AC-025)
    app.post('/api/v1/skills/:id/runbook', async (c) => {
        const tid = toTenantId(c.get('tenantId'));
        const id = skillId(c.req.param('id'));
        const body = pinRunbookSchema.parse(await c.req.json());
        const result = await deps.pinRunbook.execute({
            tenantId: tid,
            skillId: id,
            remediationId: body.remediationId,
        });
        return c.json(result, 201);
    });

    // PATCH /api/v1/skills/:id
    app.patch('/api/v1/skills/:id', async (c) => {
        const tid = toTenantId(c.get('tenantId'));
        const id = skillId(c.req.param('id'));
        const body = updateSkillSchema.parse(await c.req.json());
        const skill = await deps.updateSkill.execute(tid, id, body);
        return c.json(skill);
    });

    // DELETE /api/v1/skills/:id
    app.delete('/api/v1/skills/:id', async (c) => {
        const tid = toTenantId(c.get('tenantId'));
        const id = skillId(c.req.param('id'));
        await deps.deleteSkill.execute(tid, id);
        return c.json({ ok: true });
    });

    return app;
}
