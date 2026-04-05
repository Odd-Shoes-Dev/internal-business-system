import { NextRequest, NextResponse } from 'next/server';
import { getDbProvider } from '@/lib/provider';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/bank-accounts/[id] - Get single bank account
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const params = await context.params;

    const data = await db.query('SELECT * FROM bank_accounts WHERE id = $1 LIMIT 1', [params.id]);
    if (!data.rowCount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, (data.rows[0] as any).company_id);
    if (accessError) return accessError;

    return NextResponse.json({ data: data.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/bank-accounts/[id] - Update bank account
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const params = await context.params;
    const body = await request.json();

    // Check if bank account exists
    const existing = await db.query('SELECT id, company_id FROM bank_accounts WHERE id = $1 LIMIT 1', [params.id]);
    if (!existing.rowCount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const companyId = (existing.rows[0] as any).company_id;
    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    // If this is being set as primary, unset other primary accounts
    if (body.is_primary) {
      await db.query(
        'UPDATE bank_accounts SET is_primary = FALSE WHERE company_id = $1 AND is_primary = TRUE AND id <> $2',
        [companyId, params.id]
      );
    }

    const data = await db.query(
      `UPDATE bank_accounts
       SET name = $1,
           bank_name = $2,
           account_number_encrypted = NULL,
           routing_number = $3,
           account_type = $4,
           currency = $5,
           is_primary = $6,
           is_active = $7,
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        body.name,
        body.bank_name,
        body.routing_number || null,
        body.account_type,
        body.currency,
        body.is_primary,
        body.is_active,
        params.id,
      ]
    );

    return NextResponse.json({ data: data.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/bank-accounts/[id] - Delete or deactivate bank account
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const params = await context.params;

    const account = await db.query('SELECT id, company_id FROM bank_accounts WHERE id = $1 LIMIT 1', [params.id]);
    if (!account.rowCount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, (account.rows[0] as any).company_id);
    if (accessError) return accessError;

    // Check if account has transactions
    const transactions = await db.query(
      'SELECT id FROM bank_transactions WHERE bank_account_id = $1 LIMIT 1',
      [params.id]
    );

    // If has transactions, soft delete (deactivate)
    if (transactions.rowCount > 0) {
      const data = await db.query(
        'UPDATE bank_accounts SET is_active = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *',
        [params.id]
      );

      return NextResponse.json({ 
        data: data.rows[0], 
        message: 'Bank account deactivated (has transactions)' 
      });
    }

    // Otherwise, hard delete
    await db.query('DELETE FROM bank_accounts WHERE id = $1', [params.id]);

    return NextResponse.json({ 
      message: 'Bank account deleted successfully' 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
