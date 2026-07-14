import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/customers/[id]/credits - Unapplied payment credits for a customer
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const { id } = await params;

    const customer = await db.query<{ company_id: string }>(
      'SELECT company_id FROM customers WHERE id = $1 LIMIT 1',
      [id]
    );
    if (!customer.rowCount) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, customer.rows[0].company_id);
    if (accessError) return accessError;

    // Payments with remaining unapplied balance
    const result = await db.query<any>(
      `SELECT
         pr.id,
         pr.payment_number,
         pr.payment_date,
         pr.amount,
         pr.currency,
         pr.payment_method,
         pr.notes,
         COALESCE(SUM(pa.amount_applied), 0)           AS total_applied,
         pr.amount - COALESCE(SUM(pa.amount_applied), 0) AS available_credit
       FROM payments_received pr
       LEFT JOIN payment_applications pa ON pa.payment_id = pr.id
       WHERE pr.customer_id = $1
       GROUP BY pr.id
       HAVING pr.amount - COALESCE(SUM(pa.amount_applied), 0) > 0.01
       ORDER BY pr.payment_date DESC`,
      [id]
    );

    const totalCredit = result.rows.reduce(
      (sum, row) => sum + Number(row.available_credit),
      0
    );

    return NextResponse.json({
      data: result.rows,
      total_credit: totalCredit,
      currency: result.rows[0]?.currency || null,
    });
  } catch (error: any) {
    console.error('Error fetching customer credits:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
