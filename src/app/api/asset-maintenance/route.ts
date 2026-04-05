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
    const maintenanceType = searchParams.get('maintenance_type');

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
      where.push(`am.status = $${params.length}`);
    }

    if (assetId) {
      params.push(assetId);
      where.push(`am.asset_id = $${params.length}`);
    }

    if (maintenanceType) {
      params.push(maintenanceType);
      where.push(`am.maintenance_type = $${params.length}`);
    }

    const result = await db.query(
      `SELECT am.*,
              fa.id AS asset_ref_id,
              fa.name AS asset_name,
              fa.asset_number AS asset_tag,
              ac.name AS asset_category_name,
              e.first_name AS employee_first_name,
              e.last_name AS employee_last_name,
              e.employee_number AS employee_number
       FROM asset_maintenance am
       INNER JOIN fixed_assets fa ON fa.id = am.asset_id
       LEFT JOIN asset_categories ac ON ac.id = fa.category_id
       LEFT JOIN employees e ON e.id = am.performed_by_employee_id
       WHERE ${where.join(' AND ')}
       ORDER BY am.scheduled_date DESC`,
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
      employees: row.employee_first_name
        ? {
            first_name: row.employee_first_name,
            last_name: row.employee_last_name,
            employee_number: row.employee_number,
          }
        : null,
    }));

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching maintenance records:', error);
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
      maintenance_type,
      scheduled_date,
      performed_date,
      performed_by_employee_id,
      performed_by_vendor,
      description,
      cost,
      status,
      notes,
      next_maintenance_date,
      company_id,
    } = body;

    if (!asset_id || !maintenance_type || !scheduled_date || !description) {
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

    const insertResult = await db.query(
      `INSERT INTO asset_maintenance (
         asset_id, maintenance_type, scheduled_date, performed_date,
         performed_by_employee_id, performed_by_vendor, description,
         cost, status, notes, next_maintenance_date
       ) VALUES (
         $1, $2, $3::date, $4::date,
         $5, $6, $7,
         $8, $9, $10, $11::date
       )
       RETURNING *`,
      [
        asset_id,
        maintenance_type,
        scheduled_date,
        performed_date || null,
        performed_by_employee_id || null,
        performed_by_vendor || null,
        description,
        cost || null,
        status || 'scheduled',
        notes || null,
        next_maintenance_date || null,
      ]
    );

    return NextResponse.json(insertResult.rows[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating maintenance record:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

