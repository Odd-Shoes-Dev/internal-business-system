import {
  getCompanyIdFromRequest,
  requireCompanyAccess,
  requireSessionUser,
} from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/employees - List all employees with optional filters
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const status = searchParams.get('status');
    const department = searchParams.get('department');
    const isActive = searchParams.get('is_active');

    const conditions: string[] = ['company_id = $1'];
    const params: any[] = [companyId];

    if (status && status !== 'all') {
      params.push(status);
      conditions.push(`employment_status = $${params.length}`);
    }

    if (department && department !== 'all') {
      params.push(department);
      conditions.push(`department = $${params.length}`);
    }

    if (isActive !== null && isActive !== undefined) {
      params.push(isActive === 'true');
      conditions.push(`is_active = $${params.length}`);
    }

    const result = await db.query(
      `SELECT *
       FROM employees
       WHERE ${conditions.join(' AND ')}
       ORDER BY first_name ASC`,
      params
    );

    return NextResponse.json({ data: result.rows }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/employees - Create a new employee
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    const { company_id, ...employeeData } = body;

    // Multi-tenant: Validate company_id
    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    // Validate required fields
    if (!employeeData.employee_number || !employeeData.first_name || !employeeData.last_name || !employeeData.hire_date || !employeeData.job_title || !employeeData.basic_salary) {
      return NextResponse.json(
        { error: 'Missing required fields: employee_number, first_name, last_name, hire_date, job_title, basic_salary' },
        { status: 400 }
      );
    }

    const companyAccessError = await requireCompanyAccess(user.id, company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Check for duplicate employee number
    const existing = await db.query<{ id: string }>(
      'SELECT id FROM employees WHERE employee_number = $1 LIMIT 1',
      [employeeData.employee_number]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'Employee number already exists' },
        { status: 409 }
      );
    }

    // Create the employee
    const insertResult = await db.query(
      `INSERT INTO employees (
         company_id, employee_number, first_name, last_name, other_names,
         email, phone, national_id, nssf_number, tin,
         date_of_birth, gender, nationality, address,
         emergency_contact_name, emergency_contact_phone,
         job_title, department, employment_type, employment_status,
         hire_date, basic_salary, salary_currency, pay_frequency,
         bank_name, bank_branch, bank_account_number, bank_account_name,
         is_active, notes
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, $12, $13, $14,
         $15, $16,
         $17, $18, $19, $20,
         $21, $22, $23, $24,
         $25, $26, $27, $28,
         $29, $30
       )
       RETURNING *`,
      [
        company_id,
        employeeData.employee_number,
        employeeData.first_name,
        employeeData.last_name,
        employeeData.other_names || null,
        employeeData.email || null,
        employeeData.phone || null,
        employeeData.national_id || null,
        employeeData.nssf_number || null,
        employeeData.tin || null,
        employeeData.date_of_birth || null,
        employeeData.gender || null,
        employeeData.nationality || 'Ugandan',
        employeeData.address || null,
        employeeData.emergency_contact_name || null,
        employeeData.emergency_contact_phone || null,
        employeeData.job_title,
        employeeData.department || null,
        employeeData.employment_type || 'full_time',
        'active',
        employeeData.hire_date,
        employeeData.basic_salary,
        employeeData.salary_currency || 'UGX',
        employeeData.pay_frequency || 'monthly',
        employeeData.bank_name || null,
        employeeData.bank_branch || null,
        employeeData.bank_account_number || null,
        employeeData.bank_account_name || null,
        true,
        employeeData.notes || null,
      ]
    );

    return NextResponse.json({ data: insertResult.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
