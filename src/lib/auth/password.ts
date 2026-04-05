import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';

const ITERATIONS = 210000;
const KEYLEN = 32;
const DIGEST = 'sha256';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return `${ITERATIONS}:${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 3) {
    return false;
  }

  const [iterText, salt, hashHex] = parts;
  const iterations = Number(iterText);
  if (!Number.isFinite(iterations) || !salt || !hashHex) {
    return false;
  }

  const candidate = pbkdf2Sync(password, salt, iterations, KEYLEN, DIGEST);
  const expected = Buffer.from(hashHex, 'hex');

  if (candidate.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(candidate, expected);
}
