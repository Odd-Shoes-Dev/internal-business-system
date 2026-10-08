import { beforeAll, describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret } from './secret-box';

describe('secret-box', () => {
  beforeAll(() => {
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  });

  it('round-trips and uses a fresh IV each time', () => {
    const a = encryptSecret('EAAG-token');
    const b = encryptSecret('EAAG-token');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('EAAG-token');
  });

  it('rejects tampered data', () => {
    const parts = encryptSecret('secret').split(':');
    parts[3] = Buffer.from('tampered').toString('base64');
    expect(() => decryptSecret(parts.join(':'))).toThrow();
  });
});
