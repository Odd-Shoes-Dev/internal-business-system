import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const { id } = await context.params;

    const tourResult = await db.query('SELECT id, company_id FROM tour_packages WHERE id = $1 LIMIT 1', [id]);
    const tour = tourResult.rows[0];
    if (!tour) {
      return NextResponse.json({ error: 'Tour package not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, tour.company_id);
    if (accessError) return accessError;

    const result = await db.query(
      'SELECT * FROM tour_package_images WHERE tour_package_id = $1 ORDER BY display_order ASC, created_at ASC',
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

    const tourResult = await db.query('SELECT id, company_id FROM tour_packages WHERE id = $1 LIMIT 1', [id]);
    const tour = tourResult.rows[0];
    if (!tour) {
      return NextResponse.json({ error: 'Tour package not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, tour.company_id);
    if (accessError) return accessError;

    if (!body.image_url) {
      return NextResponse.json({ error: 'image_url is required' }, { status: 400 });
    }

    const result = await db.query(
      `INSERT INTO tour_package_images (tour_package_id, image_url, is_primary, display_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, body.image_url, body.is_primary === true, Number(body.display_order || 0)]
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

    const tourResult = await db.query('SELECT id, company_id FROM tour_packages WHERE id = $1 LIMIT 1', [id]);
    const tour = tourResult.rows[0];
    if (!tour) {
      return NextResponse.json({ error: 'Tour package not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, tour.company_id);
    if (accessError) return accessError;

    if (body.is_primary === true) {
      await db.query('UPDATE tour_package_images SET is_primary = false WHERE tour_package_id = $1', [id]);
    }

    const updates: string[] = [];
    const values: any[] = [imageId, id];

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
      `UPDATE tour_package_images
       SET ${updates.join(', ')}
       WHERE id = $1 AND tour_package_id = $2
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

    const tourResult = await db.query('SELECT id, company_id FROM tour_packages WHERE id = $1 LIMIT 1', [id]);
    const tour = tourResult.rows[0];
    if (!tour) {
      return NextResponse.json({ error: 'Tour package not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, tour.company_id);
    if (accessError) return accessError;

    await db.query('DELETE FROM tour_package_images WHERE id = $1 AND tour_package_id = $2', [imageId, id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
