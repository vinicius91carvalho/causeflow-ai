import { Hono } from 'hono';
import type { CheckBetaAllowlistUseCase } from '../application/check-beta-allowlist.usecase.js';
export declare function createBetaAllowlistRoutes(useCase: CheckBetaAllowlistUseCase): Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
