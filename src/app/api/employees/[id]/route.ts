import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/employees/[id] - Get a single employee
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;

    const employeeResult = await db.query<any>(
      'SELECT * FROM employees WHERE id = $1 LIMIT 1',
      [id]
    );
    const employee = employeeResult.rows[0];

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, employee.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const [allowances, deductions, advances, reimbursements] = await Promise.all([
      db.query('SELECT * FROM employee_allowances WHERE employee_id = $1 ORDER BY created_at DESC', [id]),
      db.query('SELECT * FROM employee_deductions WHERE employee_id = $1 ORDER BY created_at DESC', [id]),
      db.query('SELECT * FROM salary_advances WHERE employee_id = $1 ORDER BY created_at DESC', [id]),
      db.query('SELECT * FROM employee_reimbursements WHERE employee_id = $1 ORDER BY created_at DESC', [id]),
    ]);

    const data = {
      ...employee,
      allowances: allowances.rows,
      deductions: deductions.rows,
      advances: advances.rows,
      reimbursements: reimbursements.rows,
    };

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/employees/[id] - Update an employee
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;
    const body = await request.json();

    // Get current employee data
    const currentEmployeeResult = await db.query<any>(
      'SELECT * FROM employees WHERE id = $1 LIMIT 1',
      [id]
    );
    const currentEmployee = currentEmployeeResult.rows[0];

    if (!currentEmployee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, currentEmployee.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // If changing employee number, check for duplicates
    if (body.employee_number && body.employee_number !== currentEmployee.employee_number) {
      const existing = await db.query<{ id: string }>(
        'SELECT id FROM employees WHERE employee_number = $1 AND id <> $2 LIMIT 1',
        [body.employee_number, id]
      );

      if (existing.rows.length > 0) {
        return NextResponse.json(
          { error: 'Employee number already exists' },
          { status: 409 }
        );
      }
    }

    // Handle employment status changes
    const updateData: any = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    // If terminating, set termination date
    if (body.employment_status === 'terminated' && !body.termination_date) {
      updateData.termination_date = new Date().toISOString().split('T')[0];
      updateData.is_active = false;
    }

    // If reactivating, clear termination date
    if (body.employment_status === 'active' && currentEmployee.employment_status === 'terminated') {
      updateData.termination_date = null;
      updateData.is_active = true;
    }

    const fields = Object.keys(updateData);
    if (fields.length === 0) {
      return NextResponse.json({ data: currentEmployee }, { status: 200 });
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 1}`).join(', ');
    const values = fields.map((field) => updateData[field]);

    const updateResult = await db.query<any>(
      `UPDATE employees SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`,
      [...values, id]
    );

    const data = updateResult.rows[0];

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/employees/[id] - Delete an employee (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;

    const employeeResult = await db.query<any>(
      'SELECT id, company_id, employment_status FROM employees WHERE id = $1 LIMIT 1',
      [id]
    );
    const employee = employeeResult.rows[0];

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, employee.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Check if employee has payslips
    const payslips = await db.query('SELECT id FROM payslips WHERE employee_id = $1 LIMIT 1', [id]);

    if (payslips.rows.length > 0) {
      // Soft delete - mark as inactive instead of deleting
      const softDeleteResult = await db.query<any>(
        `UPDATE employees
         SET is_active = false,
             employment_status = 'terminated',
             termination_date = $1,
             updated_at = $2
         WHERE id = $3
         RETURNING *`,
        [new Date().toISOString().split('T')[0], new Date().toISOString(), id]
      );

      const data = softDeleteResult.rows[0];

      return NextResponse.json({
        data,
        message: 'Employee marked as terminated (has payroll history)',
      }, { status: 200 });
    }

    // Hard delete if no payslips
    await db.query('DELETE FROM employees WHERE id = $1', [id]);

    return NextResponse.json({
      message: 'Employee deleted successfully',
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
