import { NeonDbProvider } from '@/lib/provider/neon-provider';
import type { DbProvider } from '@/lib/provider/types';

const providerName = (process.env.APP_DB_PROVIDER || 'neon').toLowerCase();

let singleton: DbProvider | null = null;

export function getDbProvider(): DbProvider {
  if (singleton) {
    return singleton;
  }

  switch (providerName) {
    case 'neon':
      singleton = new NeonDbProvider();
      return singleton;
    default:
      throw new Error(`Unsupported APP_DB_PROVIDER: ${providerName}`);
  }
}
