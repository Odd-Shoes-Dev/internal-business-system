import { describe, expect, it } from 'vitest';
import { normalizeWhatsAppNumber } from './whatsapp';

describe('normalizeWhatsAppNumber', () => {
  it('handles local, international and formatted numbers', () => {
    expect(normalizeWhatsAppNumber('0772 123 456', '256')).toBe('256772123456');
    expect(normalizeWhatsAppNumber('+256 772-123-456', '256')).toBe('256772123456');
    expect(normalizeWhatsAppNumber('00254712345678', '256')).toBe('254712345678');
    expect(normalizeWhatsAppNumber('256772123456', '256')).toBe('256772123456');
    expect(normalizeWhatsAppNumber('  ', '256')).toBeNull();
  });
});
