import { getSessionUser as getNeonSessionUser } from '@/lib/auth/session';
import { getNeonPool } from '@/lib/db/neon';
import type { DbProvider, SessionUser } from '@/lib/provider/types';
import { TtlCache } from '@/lib/ttl-cache';

// Only confirmed memberships are cached, so a user who just joined a company is never
// refused. Nothing in the app removes memberships today; if that is added, clear the
// entry here or accept up to 60s of continued access on other server instances.
const companyAccessCache = new TtlCache<true>(60 * 1000);

export class NeonDbProvider implements DbProvider {
  async getSessionUser(): Promise<SessionUser | null> {
    const user = await getNeonSessionUser();
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name ?? null,
      role: user.role ?? null,
    };
  }

  async query<T = any>(text: string, params: any[] = []): Promise<{ rows: T[]; rowCount: number }> {
    const pool = getNeonPool();
    const result = await pool.query(text, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? 0,
    };
  }

  async hasCompanyAccess(userId: string, companyId: string): Promise<boolean> {
    const cacheKey = `${userId}:${companyId}`;
    if (companyAccessCache.get(cacheKey)) {
      return true;
    }

    const result = await this.query(
      `SELECT 1
       FROM user_companies
       WHERE user_id = $1 AND company_id = $2
       LIMIT 1`,
      [userId, companyId]
    );

    if (result.rowCount > 0) {
      companyAccessCache.set(cacheKey, true);
      return true;
    }
    return false;
  }

  async transaction<T>(
    fn: (tx: { query<U = any>(text: string, params?: any[]): Promise<{ rows: U[]; rowCount: number }> }) => Promise<T>
  ): Promise<T> {
    const pool = getNeonPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const tx = {
        query: async <U = any>(text: string, params: any[] = []) => {
          const result = await client.query(text, params);
          return {
            rows: result.rows as U[],
            rowCount: result.rowCount ?? 0,
          };
        },
      };

      const value = await fn(tx);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
