import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export const dynamic = 'force-dynamic';

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
    const locationResult = await db.query('SELECT * FROM locations WHERE id = $1 LIMIT 1', [id]);
    const data = locationResult.rows[0];

    if (!data) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, data.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Get inventory count at this location
    const inventoryResult = await db.query(
      'SELECT COALESCE(SUM(quantity), 0) AS total_quantity FROM inventory_by_location WHERE location_id = $1',
      [id]
    );
    const totalQuantity = Number(inventoryResult.rows[0]?.total_quantity || 0);

    return NextResponse.json({ ...data, total_inventory: totalQuantity });
  } catch (error: any) {
    console.error('Error fetching location:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const { id } = await params;

    const existingResult = await db.query('SELECT id, company_id FROM locations WHERE id = $1 LIMIT 1', [id]);
    const existing = existingResult.rows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const allowedFields = [
      'name',
      'code',
      'type',
      'address',
      'city',
      'state',
      'postal_code',
      'country',
      'phone',
      'email',
      'manager_name',
      'is_active',
    ];

    const updates: string[] = [];
    const paramsList: any[] = [id];

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        paramsList.push(body[field]);
        updates.push(`${field} = $${paramsList.length}`);
      }
    }

    if (updates.length === 0) {
      const currentResult = await db.query('SELECT * FROM locations WHERE id = $1 LIMIT 1', [id]);
      return NextResponse.json(currentResult.rows[0]);
    }

    const updateResult = await db.query(
      `UPDATE locations
       SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      paramsList
    );

    const data = updateResult.rows[0];

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error updating location:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

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
    const locationResult = await db.query('SELECT id, company_id FROM locations WHERE id = $1 LIMIT 1', [id]);
    const location = locationResult.rows[0];
    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, location.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Check if location has inventory
    const inventoryResult = await db.query('SELECT id FROM inventory_by_location WHERE location_id = $1 LIMIT 1', [id]);
    const inventoryData = inventoryResult.rows;

    if (inventoryData && inventoryData.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete location with existing inventory' },
        { status: 400 }
      );
    }

    await db.query('DELETE FROM locations WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting location:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
