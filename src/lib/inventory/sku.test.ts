import { describe, expect, it } from 'vitest';
import { formatSku, skuPrefix } from './sku';

describe('sku', () => {
  it('prefixes by type and pads the number', () => {
    expect(skuPrefix('service')).toBe('SRV');
    expect(skuPrefix('inventory')).toBe('PRD');
    expect(skuPrefix(undefined)).toBe('PRD');
    expect(formatSku('PRD', 42)).toBe('PRD-000042');
  });
});
