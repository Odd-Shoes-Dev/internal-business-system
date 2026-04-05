import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { id } = await context.params;

    const vehicleResult = await db.query('SELECT id, company_id FROM vehicles WHERE id = $1 LIMIT 1', [id]);
    const vehicle = vehicleResult.rows[0];
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, vehicle.company_id);
    if (accessError) return accessError;

    const result = await db.query(
      'SELECT * FROM vehicle_images WHERE vehicle_id = $1 ORDER BY display_order ASC, created_at ASC',
      [id]
    );

    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { id } = await context.params;
    const body = await request.json();

    const vehicleResult = await db.query('SELECT id, company_id FROM vehicles WHERE id = $1 LIMIT 1', [id]);
    const vehicle = vehicleResult.rows[0];
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, vehicle.company_id);
    if (accessError) return accessError;

    if (!body.image_url) {
      return NextResponse.json({ error: 'image_url is required' }, { status: 400 });
    }

    const result = await db.query(
      `INSERT INTO vehicle_images (vehicle_id, image_url, caption, is_primary, display_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        id,
        body.image_url,
        body.caption || null,
        body.is_primary === true,
        Number(body.display_order || 0),
      ]
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { id } = await context.params;
    const body = await request.json();
    const imageId = body.image_id as string | undefined;

    if (!imageId) {
      return NextResponse.json({ error: 'image_id is required' }, { status: 400 });
    }

    const vehicleResult = await db.query('SELECT id, company_id FROM vehicles WHERE id = $1 LIMIT 1', [id]);
    const vehicle = vehicleResult.rows[0];
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, vehicle.company_id);
    if (accessError) return accessError;

    if (body.is_primary === true) {
      await db.query('UPDATE vehicle_images SET is_primary = false WHERE vehicle_id = $1', [id]);
    }

    const updates: string[] = [];
    const values: any[] = [imageId, id];

    if (Object.prototype.hasOwnProperty.call(body, 'caption')) {
      values.push(body.caption || null);
      updates.push(`caption = $${values.length}`);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'is_primary')) {
      values.push(Boolean(body.is_primary));
      updates.push(`is_primary = $${values.length}`);
    }
    if (Object.prototype.hasOwnProperty.call(body, 'display_order')) {
      values.push(Number(body.display_order || 0));
      updates.push(`display_order = $${values.length}`);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const result = await db.query(
      `UPDATE vehicle_images
       SET ${updates.join(', ')}
       WHERE id = $1 AND vehicle_id = $2
       RETURNING *`,
      values
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('image_id');

    if (!imageId) {
      return NextResponse.json({ error: 'image_id is required' }, { status: 400 });
    }

    const vehicleResult = await db.query('SELECT id, company_id FROM vehicles WHERE id = $1 LIMIT 1', [id]);
    const vehicle = vehicleResult.rows[0];
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, vehicle.company_id);
    if (accessError) return accessError;

    await db.query('DELETE FROM vehicle_images WHERE id = $1 AND vehicle_id = $2', [imageId, id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
