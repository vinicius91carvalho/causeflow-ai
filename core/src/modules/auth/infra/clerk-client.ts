import { createClerkClient } from '@clerk/backend';
import { config } from '../../../shared/config/index.js';
import { instrumentedCall } from '../../../shared/infra/observability/outbound.js';

let _client: ReturnType<typeof createClerkClient> | null = null;

export function getClerkClient() {
    if (!_client) {
        _client = createClerkClient({ secretKey: config.clerk.secretKey });
    }
    return _client;
}

/**
 * Instrumented Clerk user lookup. Use instead of getClerkClient().users.getUser() directly.
 */
export function clerkGetUser(userId: string) {
    return instrumentedCall('clerk', 'getUser', () => getClerkClient().users.getUser(userId));
}

/**
 * Instrumented Clerk user list lookup. Use instead of getClerkClient().users.getUserList() directly.
 */
export function clerkGetUserList(params: Parameters<ReturnType<typeof createClerkClient>['users']['getUserList']>[0]): Promise<Awaited<ReturnType<ReturnType<typeof createClerkClient>['users']['getUserList']>>> {
    return instrumentedCall('clerk', 'getUserList', () => getClerkClient().users.getUserList(params));
}
