import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/bank-transfers/[id]/approve - Approve bank transfer
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `Can only approve pending transfers. Current status: ${existing.status}` },
        { status: 400 }
      );
    }

    const updateResult = await db.query(
      `UPDATE bank_transfers
       SET status = 'approved',
           approved_by = $2,
           approved_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, user.id]
    );

    const updated = updateResult.rows[0];

    const joinedResult = await db.query(
      `SELECT bt.*,
              fa.id AS from_account_ref_id,
              fa.name AS from_account_name,
              ta.id AS to_account_ref_id,
              ta.name AS to_account_name
       FROM bank_transfers bt
       LEFT JOIN bank_accounts fa ON fa.id = bt.from_account_id
       LEFT JOIN bank_accounts ta ON ta.id = bt.to_account_id
       WHERE bt.id = $1
       LIMIT 1`,
      [updated.id]
    );

    const row = joinedResult.rows[0];
    const data = {
      ...row,
      from_account: row.from_account_ref_id
        ? {
            id: row.from_account_ref_id,
            account_name: row.from_account_name,
          }
        : null,
      to_account: row.to_account_ref_id
        ? {
            id: row.to_account_ref_id,
            account_name: row.to_account_name,
          }
        : null,
    };

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
