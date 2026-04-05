import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/fleet/[id] - Get vehicle details
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const vehicleResult = await db.query('SELECT * FROM vehicles WHERE id = $1 LIMIT 1', [id]);
    const vehicle = vehicleResult.rows[0];

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, vehicle.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const maintenanceResult = await db.query('SELECT * FROM vehicle_maintenance WHERE vehicle_id = $1 ORDER BY created_at DESC', [id]);
    const rentalsResult = await db.query('SELECT * FROM car_rentals WHERE vehicle_id = $1 ORDER BY created_at DESC', [id]);
    const imagesResult = await db.query('SELECT * FROM vehicle_images WHERE vehicle_id = $1 ORDER BY created_at DESC', [id]);

    const data = {
      ...vehicle,
      maintenance: maintenanceResult.rows,
      rentals: rentalsResult.rows,
      images: imagesResult.rows,
    };

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/fleet/[id] - Update vehicle
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const body = await request.json();

    const existingResult = await db.query('SELECT id, company_id FROM vehicles WHERE id = $1 LIMIT 1', [id]);
    const existing = existingResult.rows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const fields = Object.keys(body);
    if (fields.length === 0) {
      return NextResponse.json({ data: existing }, { status: 200 });
    }

    const setSql = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map((f) => body[f]);

    const updateResult = await db.query(
      `UPDATE vehicles
       SET ${setSql}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, ...values]
    );

    return NextResponse.json({ data: updateResult.rows[0] }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/fleet/[id] - Delete vehicle
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const vehicleResult = await db.query('SELECT id, company_id FROM vehicles WHERE id = $1 LIMIT 1', [id]);
    const vehicle = vehicleResult.rows[0];

    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, vehicle.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const bookingsCheck = await db.query('SELECT id FROM bookings WHERE assigned_vehicle_id = $1 LIMIT 1', [id]);
    const rentalsCheck = await db.query('SELECT id FROM car_rentals WHERE vehicle_id = $1 LIMIT 1', [id]);

    if (bookingsCheck.rowCount || rentalsCheck.rowCount) {
      return NextResponse.json(
        { error: 'Cannot delete vehicle that is used in bookings or rentals. Please mark as out of service instead.' },
        { status: 400 }
      );
    }

    await db.query('DELETE FROM vehicles WHERE id = $1', [id]);

    return NextResponse.json({ message: 'Vehicle deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
