import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assetId = searchParams.get('asset_id');
    const employeeId = searchParams.get('employee_id');

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const params: any[] = [companyId];
    const where = ['fa.company_id = $1'];

    if (status) {
      params.push(status);
      where.push(`aa.status = $${params.length}`);
    }

    if (assetId) {
      params.push(assetId);
      where.push(`aa.asset_id = $${params.length}`);
    }

    if (employeeId) {
      params.push(employeeId);
      where.push(`aa.employee_id = $${params.length}`);
    }

    const result = await db.query(
      `SELECT aa.*,
              fa.id AS asset_ref_id,
              fa.name AS asset_name,
              fa.asset_number AS asset_tag,
              ac.name AS asset_category_name,
              e.id AS employee_ref_id,
              e.first_name AS employee_first_name,
              e.last_name AS employee_last_name,
              e.employee_number AS employee_number,
              e.department AS employee_department
       FROM asset_assignments aa
       INNER JOIN fixed_assets fa ON fa.id = aa.asset_id
       LEFT JOIN asset_categories ac ON ac.id = fa.category_id
       LEFT JOIN employees e ON e.id = aa.employee_id
       WHERE ${where.join(' AND ')}
       ORDER BY aa.assignment_date DESC`,
      params
    );

    const data = result.rows.map((row) => ({
      ...row,
      assets: row.asset_ref_id
        ? {
            id: row.asset_ref_id,
            name: row.asset_name,
            asset_tag: row.asset_tag,
            asset_categories: row.asset_category_name ? { name: row.asset_category_name } : null,
          }
        : null,
      employees: row.employee_ref_id
        ? {
            id: row.employee_ref_id,
            first_name: row.employee_first_name,
            last_name: row.employee_last_name,
            employee_number: row.employee_number,
            department: row.employee_department,
          }
        : null,
    }));

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching asset assignments:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const {
      asset_id,
      employee_id,
      assignment_date,
      expected_return_date,
      condition_at_assignment,
      notes,
      company_id,
    } = body;

    if (!asset_id || !employee_id || !assignment_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const resolvedCompanyId = company_id || getCompanyIdFromRequest(request);
    if (!resolvedCompanyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, resolvedCompanyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const assetResult = await db.query(
      'SELECT id FROM fixed_assets WHERE id = $1 AND company_id = $2 LIMIT 1',
      [asset_id, resolvedCompanyId]
    );
    if (!assetResult.rowCount) {
      return NextResponse.json({ error: 'Asset not found for company' }, { status: 404 });
    }

    const existingAssignment = await db.query(
      `SELECT id
       FROM asset_assignments
       WHERE asset_id = $1
         AND status = 'assigned'
       LIMIT 1`,
      [asset_id]
    );

    if (existingAssignment.rowCount) {
      return NextResponse.json({ error: 'Asset is already assigned to another employee' }, { status: 400 });
    }

    const insertResult = await db.query(
      `INSERT INTO asset_assignments (
         asset_id, employee_id, assignment_date, expected_return_date,
         condition_at_assignment, status, notes
       ) VALUES ($1, $2, $3::date, $4::date, $5, 'assigned', $6)
       RETURNING *`,
      [
        asset_id,
        employee_id,
        assignment_date,
        expected_return_date || null,
        condition_at_assignment || 'good',
        notes || null,
      ]
    );

    return NextResponse.json(insertResult.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating asset assignment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

