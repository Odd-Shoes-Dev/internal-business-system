import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

async function resolveCompanyId(db: any, userId: string, request: NextRequest): Promise<string | null> {
  const requested = getCompanyIdFromRequest(request);
  if (requested) {
    return requested;
  }

  const result = await db.query(
    `SELECT company_id
     FROM user_companies
     WHERE user_id = $1
     ORDER BY is_primary DESC, joined_at ASC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0]?.company_id || null;
}

// GET /api/fleet/stats - Get fleet statistics
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const companyId = await resolveCompanyId(db, user.id, request);
    if (!companyId) {
      return NextResponse.json({ error: 'No company found for user' }, { status: 403 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const vehiclesResult = await db.query(
      `SELECT status, vehicle_type, purchase_price
       FROM vehicles
       WHERE company_id = $1`,
      [companyId]
    );
    const vehicles = vehiclesResult.rows;

    const maintenanceResult = await db.query(
      `SELECT vm.cost
       FROM vehicle_maintenance vm
       INNER JOIN vehicles v ON v.id = vm.vehicle_id
       WHERE v.company_id = $1`,
      [companyId]
    );
    const maintenance = maintenanceResult.rows;

    const stats = {
      totalVehicles: vehicles.length,
      available: vehicles.filter((v: any) => v.status === 'available').length,
      inUse: vehicles.filter((v: any) => v.status === 'in_use').length,
      maintenance: vehicles.filter((v: any) => v.status === 'maintenance').length,
      outOfService: vehicles.filter((v: any) => v.status === 'out_of_service').length,
      totalValue: vehicles.reduce((sum: number, v: any) => sum + Number(v.purchase_price || 0), 0),
      totalMaintenanceCost: maintenance.reduce((sum: number, m: any) => sum + Number(m.cost || 0), 0),
      byType: {
        safari_4x4: vehicles.filter((v: any) => v.vehicle_type === 'safari_4x4').length,
        minibus: vehicles.filter((v: any) => v.vehicle_type === 'minibus').length,
        land_cruiser: vehicles.filter((v: any) => v.vehicle_type === 'land_cruiser').length,
        coaster: vehicles.filter((v: any) => v.vehicle_type === 'coaster').length,
        sedan: vehicles.filter((v: any) => v.vehicle_type === 'sedan').length,
        other: vehicles.filter((v: any) => v.vehicle_type === 'other').length,
      },
    };

    return NextResponse.json(stats, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
