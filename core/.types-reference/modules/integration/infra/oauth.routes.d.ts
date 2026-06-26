/**
 * Integration routes for project management tools.
 *
 * Notion: OAuth2 flow (authorize → callback → token exchange → KMS encrypt → save)
 * Shortcut: API Token (client pastes token → KMS encrypt → save)
 * Trello: API Token (client pastes token → KMS encrypt → save)
 *         Trello API Key is ours (server config), client provides only their Token.
 *
 * Security:
 * - All tokens encrypted with KMS envelope encryption (AES-256-GCM) before storage
 * - No route EVER returns a plaintext token
 * - Status endpoint returns only connection metadata
 */
import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import type { OAuthTokenStore } from '../../../shared/application/ports/oauth-token-store.port.js';
import type { IntegrationToolProvider } from '../../../shared/application/ports/integration-tool-provider.port.js';
export interface OAuthDeps {
    oauthTokenStore: OAuthTokenStore;
    composioToolProvider?: IntegrationToolProvider;
}
export declare function createOAuthRoutes(deps: OAuthDeps): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
