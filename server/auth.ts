/**
 * Prototype authentication helpers (login/sign-up feature).
 *
 * This is deliberately a SMALL, explainable flow for a hackathon — it is NOT
 * production-grade identity. It is structured so it can later be swapped for a
 * real IdP (OIDC / session service) without touching the rest of the app:
 *   • passwords  → salted scrypt hashes (node:crypto, zero new dependencies),
 *                  compared with timingSafeEqual; plain text is never stored
 *                  or logged;
 *   • sessions   → stateless HMAC-signed tokens ("userId.expiry"), so no
 *                  session table is needed and the API stays serverless-friendly.
 *
 * Signing secret: JALSAFA_AUTH_SECRET if set, else TURSO_AUTH_TOKEN (already a
 * server-side secret on Vercel, keeps tokens valid across cold starts), else a
 * dev fallback (fine locally; set JALSAFA_AUTH_SECRET in production).
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 } as const;

/** `scrypt$<salt>$<hash>` — salt and hash are hex. Plain text never stored. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEYLEN, SCRYPT_OPTS).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== KEYLEN) return false;
  const actual = scryptSync(password, salt, KEYLEN, SCRYPT_OPTS);
  return timingSafeEqual(actual, expected); // constant-time compare
}

const SECRET =
  process.env.JALSAFA_AUTH_SECRET ?? process.env.TURSO_AUTH_TOKEN ?? 'jalsafa-prototype-dev-secret';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Token = base64url("userId.expiry") + "." + hmac(payload). Opaque to clients. */
export function signToken(userId: string): string {
  const payload = `${userId}.${Date.now() + TOKEN_TTL_MS}`;
  const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

/** Returns the userId when the token is authentic and unexpired, else null. */
export function verifyToken(token: string): string | null {
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  const payload = Buffer.from(b64, 'base64url').toString('utf8');
  const expected = createHmac('sha256', SECRET).update(payload).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const dot = payload.lastIndexOf('.');
  if (dot < 0) return null;
  const userId = payload.slice(0, dot);
  const expiry = Number(payload.slice(dot + 1));
  if (!userId || !Number.isFinite(expiry) || Date.now() > expiry) return null;
  return userId;
}
