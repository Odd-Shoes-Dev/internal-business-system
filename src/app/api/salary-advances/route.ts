import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { searchParams } = new URL(request.url);
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    const status = searchParams.get('status');

    const params: any[] = [companyId];
    const where: string[] = ['e.company_id = $1'];
    if (status && status !== 'all') {
      params.push(status);
      where.push(`sa.status = $${params.length}`);
    }

    const result = await db.query(
      `SELECT sa.*, e.first_name, e.last_name, e.employee_number,
              up.full_name AS approver_name
       FROM salary_advances sa
       INNER JOIN employees e ON e.id = sa.employee_id
       LEFT JOIN user_profiles up ON up.id = sa.approved_by
       WHERE ${where.join(' AND ')}
       ORDER BY sa.advance_date DESC, sa.created_at DESC`,
      params
    );

    return NextResponse.json({
      data: result.rows.map((row: any) => ({
        ...row,
        employee: {
          first_name: row.first_name,
          last_name: row.last_name,
          employee_number: row.employee_number,
        },
        approver: row.approver_name ? { full_name: row.approver_name } : undefined,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();

    if (!body.employee_id || !body.advance_date || !body.amount || !body.repayment_months) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const employeeResult = await db.query('SELECT id, company_id FROM employees WHERE id = $1 LIMIT 1', [body.employee_id]);
    const employee = employeeResult.rows[0];
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, employee.company_id);
    if (accessError) return accessError;

    const result = await db.query(
      `INSERT INTO salary_advances (
         employee_id, advance_date, amount, reason, repayment_months, status, created_by
       ) VALUES ($1, $2::date, $3, $4, $5, 'pending', $6)
       RETURNING *`,
      [
        body.employee_id,
        body.advance_date,
        Number(body.amount),
        body.reason || null,
        Number(body.repayment_months),
        user.id,
      ]
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
