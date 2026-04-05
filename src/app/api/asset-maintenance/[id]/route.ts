import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

async function getMaintenanceForAccess(db: any, id: string) {
  const result = await db.query(
    `SELECT am.id, fa.company_id
     FROM asset_maintenance am
     INNER JOIN fixed_assets fa ON fa.id = am.asset_id
     WHERE am.id = $1
     LIMIT 1`,
    [id]
  );

  return result.rows[0] || null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;
    const scoped = await getMaintenanceForAccess(db, id);

    if (!scoped) {
      return NextResponse.json({ error: 'Maintenance record not found' }, { status: 404 });
    }

    const queryCompanyId = getCompanyIdFromRequest(request);
    const companyId = queryCompanyId || scoped.company_id;

    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (scoped.company_id && scoped.company_id !== companyId) {
      return NextResponse.json({ error: 'Maintenance record not found' }, { status: 404 });
    }

    const result = await db.query(
      `SELECT am.*,
              fa.id AS asset_ref_id,
              fa.name AS asset_name,
              fa.asset_number AS asset_tag,
              e.first_name AS employee_first_name,
              e.last_name AS employee_last_name,
              e.employee_number AS employee_number
       FROM asset_maintenance am
       INNER JOIN fixed_assets fa ON fa.id = am.asset_id
       LEFT JOIN employees e ON e.id = am.performed_by_employee_id
       WHERE am.id = $1
       LIMIT 1`,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Maintenance record not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...row,
      assets: row.asset_ref_id
        ? {
            id: row.asset_ref_id,
            name: row.asset_name,
            asset_tag: row.asset_tag,
          }
        : null,
      employees: row.employee_first_name
        ? {
            first_name: row.employee_first_name,
            last_name: row.employee_last_name,
            employee_number: row.employee_number,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Error fetching maintenance record:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;
    const scoped = await getMaintenanceForAccess(db, id);

    if (!scoped) {
      return NextResponse.json({ error: 'Maintenance record not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, scoped.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const body = await request.json();
    const {
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
    } = body;

    const updateResult = await db.query(
      `UPDATE asset_maintenance
       SET maintenance_type = COALESCE($2, maintenance_type),
           scheduled_date = COALESCE($3::date, scheduled_date),
           performed_date = COALESCE($4::date, performed_date),
           performed_by_employee_id = COALESCE($5, performed_by_employee_id),
           performed_by_vendor = COALESCE($6, performed_by_vendor),
           description = COALESCE($7, description),
           cost = COALESCE($8, cost),
           status = COALESCE($9, status),
           notes = COALESCE($10, notes),
           next_maintenance_date = COALESCE($11::date, next_maintenance_date)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        maintenance_type || null,
        scheduled_date || null,
        performed_date || null,
        performed_by_employee_id || null,
        performed_by_vendor || null,
        description || null,
        typeof cost === 'number' ? cost : null,
        status || null,
        notes || null,
        next_maintenance_date || null,
      ]
    );

    return NextResponse.json(updateResult.rows[0]);
  } catch (error: any) {
    console.error('Error updating maintenance record:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
