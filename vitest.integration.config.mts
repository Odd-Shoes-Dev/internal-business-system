import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'path';

// Integration tests run the real API route handlers against the database in
// NEON_DATABASE_URL inside one transaction that is always rolled back.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    include: ['tests/integration/**/*.int.test.ts'],
    environment: 'node',
    // .env, .env.local, ... (all keys, not only VITE_*)
    env: loadEnv('test', process.cwd(), ''),
    testTimeout: 120000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
