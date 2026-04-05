import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { id } = await context.params;
    const body = await request.json();

    const existingResult = await db.query(
      `SELECT er.id, e.company_id
       FROM employee_reimbursements er
       INNER JOIN employees e ON e.id = er.employee_id
       WHERE er.id = $1
       LIMIT 1`,
      [id]
    );
    const existing = existingResult.rows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Reimbursement not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, existing.company_id);
    if (accessError) return accessError;

    const fields: string[] = [];
    const values: any[] = [id];

    if (Object.prototype.hasOwnProperty.call(body, 'status')) {
      values.push(body.status);
      fields.push(`status = $${values.length}`);
      values.push(user.id);
      fields.push(`approved_by = $${values.length}`);
      values.push(new Date().toISOString());
      fields.push(`approved_at = $${values.length}`);
    }

    if (Object.prototype.hasOwnProperty.call(body, 'paid_in_payroll_id')) {
      values.push(body.paid_in_payroll_id || null);
      fields.push(`paid_in_payroll_id = $${values.length}`);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields provided' }, { status: 400 });
    }

    const result = await db.query(
      `UPDATE employee_reimbursements
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      values
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
