import { Hono } from 'hono';
import type { AppContext } from './bootstrap.js';
import type { AppEnv } from './shared/infra/http/hono-types.js';
export declare function createApp(ctx: AppContext): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
