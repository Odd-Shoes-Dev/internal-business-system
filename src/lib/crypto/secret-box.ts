import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Encrypts small secrets (e.g. a company's WhatsApp API token) before they are stored.
// AES-256-GCM with a key from APP_ENCRYPTION_KEY: 32 bytes as base64 or hex.
// Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

const PREFIX = 'v1';

function getKey(): Buffer {
  const raw = process.env.APP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('APP_ENCRYPTION_KEY is not set; cannot store or read encrypted secrets');
  }
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('APP_ENCRYPTION_KEY must be 32 bytes (base64 or 64 hex characters)');
  }
  return key;
}

export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

export function decryptSecret(payload: string): string {
  const [prefix, iv, tag, data] = payload.split(':');
  if (prefix !== PREFIX || !iv || !tag || !data) {
    throw new Error('Unrecognised encrypted secret format');
  }
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
