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

// GET /api/fleet - List all vehicles with optional filters
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

    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('search');
    const status = searchParams.get('status');
    const vehicleType = searchParams.get('vehicle_type');

    const where: string[] = ['company_id = $1'];
    const params: any[] = [companyId];

    if (searchQuery) {
      params.push(`%${searchQuery}%`);
      const i = params.length;
      where.push(`(registration_number ILIKE $${i} OR make ILIKE $${i} OR model ILIKE $${i})`);
    }

    if (status && status !== 'all') {
      params.push(status);
      where.push(`status = $${params.length}`);
    }

    if (vehicleType && vehicleType !== 'all') {
      params.push(vehicleType);
      where.push(`vehicle_type = $${params.length}`);
    }

    const result = await db.query(
      `SELECT *
       FROM vehicles
       WHERE ${where.join(' AND ')}
       ORDER BY registration_number ASC`,
      params
    );

    return NextResponse.json({ data: result.rows }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/fleet - Create a new vehicle
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    if (!body.registration_number || !body.make || !body.model || !body.vehicle_type) {
      return NextResponse.json(
        { error: 'Missing required fields: registration_number, make, model, vehicle_type' },
        { status: 400 }
      );
    }

    const companyId = body.company_id || getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const existing = await db.query(
      'SELECT id FROM vehicles WHERE registration_number = $1 AND company_id = $2 LIMIT 1',
      [body.registration_number, companyId]
    );

    if (existing.rowCount) {
      return NextResponse.json({ error: 'Vehicle with this registration number already exists' }, { status: 409 });
    }

    const insertResult = await db.query(
      `INSERT INTO vehicles (
         company_id, registration_number, make, model, vehicle_type,
         status, seating_capacity, daily_rate_usd, purchase_price,
         year, color, mileage, notes, created_by
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9,
         $10, $11, $12, $13, $14
       )
       RETURNING *`,
      [
        companyId,
        body.registration_number,
        body.make,
        body.model,
        body.vehicle_type,
        body.status || 'available',
        body.seating_capacity || null,
        body.daily_rate_usd || null,
        body.purchase_price || null,
        body.year || null,
        body.color || null,
        body.mileage || null,
        body.notes || null,
        user.id,
      ]
    );

    return NextResponse.json({ data: insertResult.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
