import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { CheckBetaAllowlistUseCase } from '../application/check-beta-allowlist.usecase.js';
const checkSchema = z.object({
    email: z.string().email(),
});
export function createBetaAllowlistRoutes(useCase: CheckBetaAllowlistUseCase): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/"> {
    const app = new Hono();
    // POST /v1/beta-allowlist/check — check if email is in beta allowlist (public)
    app.post('/check', zValidator('json', checkSchema), async (c) => {
        const { email } = c.req.valid('json');
        const result = await useCase.execute(email);
        return c.json(result);
    });
    return app;
}
