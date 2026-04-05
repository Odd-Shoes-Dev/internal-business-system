import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);
    const hotelId = searchParams.get('hotel_id');

    if (!hotelId) {
      return NextResponse.json({ error: 'hotel_id is required' }, { status: 400 });
    }

    const hotelResult = await db.query(
      'SELECT id, company_id FROM hotels WHERE id = $1 LIMIT 1',
      [hotelId]
    );
    const hotel = hotelResult.rows[0];

    if (!hotel) {
      return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
    }

    const companyId = getCompanyIdFromRequest(request) || hotel.company_id;
    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (hotel.company_id !== companyId) {
      return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
    }

    const result = await db.query(
      `SELECT *
       FROM hotel_images
       WHERE hotel_id = $1
       ORDER BY display_order ASC, created_at ASC`,
      [hotelId]
    );

    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
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
    const { hotel_id, image_url, is_primary, display_order, caption } = body;

    if (!hotel_id || !image_url) {
      return NextResponse.json({ error: 'hotel_id and image_url are required' }, { status: 400 });
    }

    const hotelResult = await db.query(
      'SELECT id, company_id FROM hotels WHERE id = $1 LIMIT 1',
      [hotel_id]
    );
    const hotel = hotelResult.rows[0];

    if (!hotel) {
      return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, hotel.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (is_primary) {
      await db.query('UPDATE hotel_images SET is_primary = false WHERE hotel_id = $1', [hotel_id]);
    }

    const insertResult = await db.query(
      `INSERT INTO hotel_images (hotel_id, image_url, is_primary, display_order, caption)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        hotel_id,
        image_url,
        !!is_primary,
        typeof display_order === 'number' ? display_order : 0,
        caption || null,
      ]
    );

    return NextResponse.json({ data: insertResult.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
