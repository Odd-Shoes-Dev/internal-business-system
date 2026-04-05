import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/hotels/[id] - Get hotel details
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const hotelResult = await db.query(
      `SELECT h.*,
              d.id AS destination_ref_id,
              d.name AS destination_name,
              d.country AS destination_country,
              d.description AS destination_description
       FROM hotels h
       LEFT JOIN destinations d ON d.id = h.destination_id
       WHERE h.id = $1
       LIMIT 1`,
      [id]
    );
    const hotel = hotelResult.rows[0];

    if (!hotel) {
      return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, hotel.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const roomTypesResult = await db.query(
      'SELECT * FROM hotel_room_types WHERE hotel_id = $1 ORDER BY created_at ASC',
      [id]
    );
    const imagesResult = await db.query(
      'SELECT * FROM hotel_images WHERE hotel_id = $1 ORDER BY display_order ASC, created_at ASC',
      [id]
    );

    const data = {
      ...hotel,
      destination: hotel.destination_ref_id
        ? {
            id: hotel.destination_ref_id,
            name: hotel.destination_name,
            country: hotel.destination_country,
            description: hotel.destination_description,
          }
        : null,
      room_types: roomTypesResult.rows,
      images: imagesResult.rows,
    };

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/hotels/[id] - Update hotel
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const body = await request.json();

    const existingResult = await db.query('SELECT id, company_id FROM hotels WHERE id = $1 LIMIT 1', [id]);
    const existing = existingResult.rows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const allowedFields = [
      'name',
      'address',
      'contact_person',
      'phone',
      'email',
      'website',
      'star_rating',
      'check_in_time',
      'check_out_time',
      'amenities',
      'notes',
      'is_active',
      'destination_id',
    ];

    const updates: string[] = [];
    const params: any[] = [id];

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        params.push(body[field]);
        updates.push(`${field} = $${params.length}`);
      }
    }

    if (updates.length > 0) {
      await db.query(
        `UPDATE hotels
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $1`,
        params
      );
    }

    const updatedResult = await db.query(
      `SELECT h.*,
              d.id AS destination_ref_id,
              d.name AS destination_name,
              d.country AS destination_country
       FROM hotels h
       LEFT JOIN destinations d ON d.id = h.destination_id
       WHERE h.id = $1
       LIMIT 1`,
      [id]
    );

    const row = updatedResult.rows[0];
    const data = {
      ...row,
      destination: row.destination_ref_id
        ? {
            id: row.destination_ref_id,
            name: row.destination_name,
            country: row.destination_country,
          }
        : null,
    };

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/hotels/[id] - Delete hotel
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    // Check if hotel is used in any bookings
    const hotelResult = await db.query('SELECT id, company_id FROM hotels WHERE id = $1 LIMIT 1', [id]);
    const hotel = hotelResult.rows[0];
    if (!hotel) {
      return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, hotel.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const bookingResult = await db.query('SELECT id FROM booking_hotels WHERE hotel_id = $1 LIMIT 1', [id]);
    const booking = bookingResult.rows[0];

    if (booking) {
      return NextResponse.json(
        { error: 'Cannot delete hotel that is used in bookings. Please deactivate it instead.' },
        { status: 400 }
      );
    }

    await db.query('DELETE FROM hotels WHERE id = $1', [id]);

    return NextResponse.json({ message: 'Hotel deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
