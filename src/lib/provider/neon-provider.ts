import { getSessionUser as getNeonSessionUser } from '@/lib/auth/session';
import { getNeonPool } from '@/lib/db/neon';
import type { DbProvider, SessionUser } from '@/lib/provider/types';

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
    const result = await this.query(
      `SELECT 1
       FROM user_companies
       WHERE user_id = $1 AND company_id = $2
       LIMIT 1`,
      [userId, companyId]
    );

    return result.rowCount > 0;
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
