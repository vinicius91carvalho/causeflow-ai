import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { IRelayGateway } from '../../../shared/application/ports/relay-gateway.port.js';
export declare function createRelayRoutes(relayGateway: IRelayGateway): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
