import type { QueryExecutor } from '@/lib/accounting/provider-accounting';
import { parsePosSettings, type PosSettings } from '@/lib/pos/settings';

export async function getPosSettingsWithDb(q: QueryExecutor, companyId: string): Promise<PosSettings> {
  const result = await q.query<{ pos: unknown }>("SELECT settings -> 'pos' AS pos FROM companies WHERE id = $1", [companyId]);
  return parsePosSettings(result.rows[0]?.pos);
}

export async function savePosSettingsWithDb(q: QueryExecutor, companyId: string, settings: PosSettings): Promise<void> {
  await q.query(
    `UPDATE companies
     SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{pos}', $2::jsonb, true), updated_at = NOW()
     WHERE id = $1`,
    [companyId, JSON.stringify(settings)]
  );
}
