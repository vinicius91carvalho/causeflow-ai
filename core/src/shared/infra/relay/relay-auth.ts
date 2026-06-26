/**
 * JWT-based authentication for the database relay control-plane connection.
 *
 * Each relay container authenticates with a per-tenant JWT (issued by the API
 * from a short-lived provisioning flow), not with a shared global secret.
 */
import { SignJWT, jwtVerify } from 'jose';
import { config } from '../../config/index.js';

const ALGORITHM = 'HS256';

export interface RelayJwtPayload {
    tenantId: string;
    relayId: string;
    scope: 'relay';
}

function getSecret(): Uint8Array {
    return new TextEncoder().encode(config.auth.jwtSecret);
}

export async function issueRelayToken(params: {
    tenantId: string;
    relayId: string;
    ttlSeconds?: number;
}): Promise<string> {
    const ttl = params.ttlSeconds ?? 60 * 60 * 24; // 24h default
    return new SignJWT({
        tenantId: params.tenantId,
        relayId: params.relayId,
        scope: 'relay',
    })
        .setProtectedHeader({ alg: ALGORITHM })
        .setIssuedAt()
        .setIssuer('causeflow-control-plane')
        .setAudience('causeflow-relay')
        .setSubject(`relay:${params.tenantId}:${params.relayId}`)
        .setExpirationTime(`${ttl}s`)
        .sign(getSecret());
}

export async function verifyRelayToken(token: string): Promise<RelayJwtPayload> {
    const { payload } = await jwtVerify(token, getSecret(), {
        algorithms: [ALGORITHM],
        issuer: 'causeflow-control-plane',
        audience: 'causeflow-relay',
    });

    const tenantId = payload['tenantId'];
    const relayId = payload['relayId'];
    const scope = payload['scope'];

    if (typeof tenantId !== 'string' || typeof relayId !== 'string' || scope !== 'relay') {
        throw new Error('Invalid relay token payload');
    }

    return { tenantId, relayId, scope: 'relay' };
}
