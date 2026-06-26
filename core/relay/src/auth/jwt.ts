import { SignJWT, jwtVerify, importSPKI, createRemoteJWKSet, type JWTVerifyGetKey, type KeyLike } from 'jose';

export interface RelayJwtPayload {
  tenantId: string;
  relayId: string;
  scope: 'relay';
}

export interface JwtVerifierConfig {
  jwksUrl?: string;
  publicKeyPem?: string;
  sharedSecret?: string;
  issuer?: string;
  audience?: string;
}

export class RelayJwtVerifier {
  constructor(private readonly config: JwtVerifierConfig) {
    if (!config.jwksUrl && !config.publicKeyPem && !config.sharedSecret) {
      throw new Error('JwtVerifierConfig requires one of: jwksUrl, publicKeyPem, sharedSecret');
    }
  }

  async verify(token: string): Promise<RelayJwtPayload> {
    const options = {
      issuer: this.config.issuer,
      audience: this.config.audience,
    };

    let payload;
    if (this.config.jwksUrl) {
      const jwks: JWTVerifyGetKey = createRemoteJWKSet(new URL(this.config.jwksUrl));
      ({ payload } = await jwtVerify(token, jwks, options));
    } else if (this.config.publicKeyPem) {
      const key: KeyLike = await importSPKI(this.config.publicKeyPem, 'RS256');
      ({ payload } = await jwtVerify(token, key, options));
    } else {
      const key = new TextEncoder().encode(this.config.sharedSecret!);
      ({ payload } = await jwtVerify(token, key, options));
    }

    const tenantId = payload['tenantId'];
    const scope = payload['scope'];
    if (typeof tenantId !== 'string' || scope !== 'relay') {
      throw new Error('Invalid relay token payload');
    }

    return {
      tenantId,
      relayId: typeof payload['relayId'] === 'string' ? payload['relayId'] : '',
      scope: 'relay',
    };
  }
}

export async function signRelayJwt(params: {
  secret: string;
  tenantId: string;
  relayId: string;
  ttlSeconds?: number;
  issuer?: string;
  audience?: string;
}): Promise<string> {
  const secret = new TextEncoder().encode(params.secret);
  return new SignJWT({
    tenantId: params.tenantId,
    relayId: params.relayId,
    scope: 'relay',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${params.ttlSeconds ?? 3600}s`)
    .setIssuer(params.issuer ?? 'causeflow-control-plane')
    .setAudience(params.audience ?? 'causeflow-relay')
    .setSubject(`relay:${params.tenantId}:${params.relayId}`)
    .sign(secret);
}
