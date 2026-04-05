import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/bank-transfers/[id] - Get bank transfer details
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const result = await db.query(
      `SELECT bt.*,
              fa.id AS from_account_ref_id,
              fa.name AS from_account_name,
              fa.account_number AS from_account_number,
              ta.id AS to_account_ref_id,
              ta.name AS to_account_name,
              ta.account_number AS to_account_number,
              up.id AS approved_by_user_id,
              up.full_name AS approved_by_user_full_name,
              COALESCE(fa.company_id, ta.company_id) AS company_id
       FROM bank_transfers bt
       LEFT JOIN bank_accounts fa ON fa.id = bt.from_account_id
       LEFT JOIN bank_accounts ta ON ta.id = bt.to_account_id
       LEFT JOIN user_profiles up ON up.id = bt.approved_by
       WHERE bt.id = $1
       LIMIT 1`,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Bank transfer not found' }, { status: 404 });
    }

    if (!row.company_id) {
      return NextResponse.json({ error: 'Transfer company could not be resolved' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, row.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const data = {
      ...row,
      from_account: row.from_account_ref_id
        ? {
            id: row.from_account_ref_id,
            account_name: row.from_account_name,
            account_number: row.from_account_number,
          }
        : null,
      to_account: row.to_account_ref_id
        ? {
            id: row.to_account_ref_id,
            account_name: row.to_account_name,
            account_number: row.to_account_number,
          }
        : null,
      approved_by_user: row.approved_by_user_id
        ? {
            id: row.approved_by_user_id,
            full_name: row.approved_by_user_full_name,
          }
        : null,
    };

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/bank-transfers/[id] - Cancel bank transfer
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const existingResult = await db.query(
      `SELECT bt.id, bt.status, COALESCE(fa.company_id, ta.company_id) AS company_id
       FROM bank_transfers bt
       LEFT JOIN bank_accounts fa ON fa.id = bt.from_account_id
       LEFT JOIN bank_accounts ta ON ta.id = bt.to_account_id
       WHERE bt.id = $1
       LIMIT 1`,
      [id]
    );

    const existing = existingResult.rows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Bank transfer not found' }, { status: 404 });
    }

    if (!existing.company_id) {
      return NextResponse.json({ error: 'Transfer company could not be resolved' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (existing.status === 'completed') {
      return NextResponse.json({ error: 'Cannot cancel completed bank transfer' }, { status: 400 });
    }

    await db.query('UPDATE bank_transfers SET status = $2 WHERE id = $1', [id, 'cancelled']);

    return NextResponse.json({ message: 'Bank transfer cancelled successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
