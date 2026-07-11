import { SignJWT } from 'jose';

const DEFAULT_SECRET = 'test-secret';
const DEFAULT_ISSUER = 'causeflow';
const DEFAULT_AUDIENCE = 'causeflow-api';

export interface LocalJwtClaims {
  sub: string;
  email?: string;
  tenant_id?: string;
  roles?: string[];
}

export async function signLocalJwt(
  claims: LocalJwtClaims,
  opts?: { secret?: string; issuer?: string; audience?: string; expiresIn?: string },
): Promise<string> {
  const secret = new TextEncoder().encode(opts?.secret ?? DEFAULT_SECRET);
  const builder = new SignJWT({
    email: claims.email,
    tenant_id: claims.tenant_id,
    roles: claims.roles ?? [],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuer(opts?.issuer ?? DEFAULT_ISSUER)
    .setAudience(opts?.audience ?? DEFAULT_AUDIENCE)
    .setIssuedAt();

  if (opts?.expiresIn) {
    builder.setExpirationTime(opts.expiresIn);
  } else {
    builder.setExpirationTime('1h');
  }

  return builder.sign(secret);
}

export async function signExpiredLocalJwt(claims: LocalJwtClaims): Promise<string> {
  const secret = new TextEncoder().encode(DEFAULT_SECRET);
  return new SignJWT({
    email: claims.email,
    tenant_id: claims.tenant_id,
    roles: claims.roles ?? [],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuer(DEFAULT_ISSUER)
    .setAudience(DEFAULT_AUDIENCE)
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .sign(secret);
}
