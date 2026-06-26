/**
 * JWT-based authentication for investigation relay sessions.
 *
 * Each investigation gets a short-lived JWT (10 min) scoped to
 * a specific tenantId + incidentId. Workers receive the token via
 * env var, dashboard users receive it via the API.
 */
import { SignJWT, jwtVerify } from 'jose';
import { config } from '../../config/index.js';

const ALGORITHM = 'HS256';
const TOKEN_EXPIRY = '15m'; // Longer than investigation timeout (10 min) to avoid mid-investigation expiry

function getSecret(): Uint8Array {
    return new TextEncoder().encode(config.auth.jwtSecret);
}

export interface InvestigationRelayTokenPayload {
    tenantId: string;
    incidentId: string;
    role: 'worker' | 'dashboard';
}

/** Create a short-lived JWT for an investigation relay session */
export async function createRelayToken(payload: InvestigationRelayTokenPayload): Promise<string> {
    return new SignJWT({
        tenantId: payload.tenantId,
        incidentId: payload.incidentId,
        role: payload.role,
    })
        .setProtectedHeader({ alg: ALGORITHM })
        .setIssuedAt()
        .setExpirationTime(TOKEN_EXPIRY)
        .setSubject(`relay:${payload.tenantId}:${payload.incidentId}`)
        .sign(getSecret());
}

/** Verify a relay JWT and return the payload. Throws on invalid/expired token. */
export async function verifyRelayToken(token: string): Promise<InvestigationRelayTokenPayload> {
    const { payload } = await jwtVerify(token, getSecret(), {
        algorithms: [ALGORITHM],
    });

    const tenantId = payload['tenantId'] as string | undefined;
    const incidentId = payload['incidentId'] as string | undefined;
    const role = payload['role'] as 'worker' | 'dashboard' | undefined;

    if (!tenantId || !incidentId || !role) {
        throw new Error('Invalid relay token: missing tenantId, incidentId, or role');
    }

    return { tenantId, incidentId, role };
}
