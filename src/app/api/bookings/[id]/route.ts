import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/bookings/[id] - Get booking details
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const bookingResult = await db.query(
      `SELECT b.*,
              c.id AS customer_ref_id,
              c.name AS customer_name,
              c.email AS customer_email,
              c.phone AS customer_phone,
              c.country AS customer_country,
              tp.id AS tour_package_ref_id,
              tp.name AS tour_package_name,
              tp.package_code AS tour_package_code,
              tp.duration_days AS tour_package_duration_days,
              tp.price_per_person AS tour_package_price_per_person,
              tp.currency AS tour_package_currency,
              h.id AS hotel_ref_id,
              h.name AS hotel_name,
              h.star_rating AS hotel_star_rating,
              h.address AS hotel_address,
              h.phone AS hotel_phone,
              v.id AS vehicle_ref_id,
              v.registration_number AS vehicle_registration_number,
              v.vehicle_type AS vehicle_type,
              v.seating_capacity AS vehicle_seating_capacity,
              v.daily_rate_usd AS vehicle_daily_rate_usd
       FROM bookings b
       LEFT JOIN customers c ON c.id = b.customer_id
       LEFT JOIN tour_packages tp ON tp.id = b.tour_package_id
       LEFT JOIN hotels h ON h.id = b.hotel_id
       LEFT JOIN vehicles v ON v.id = b.assigned_vehicle_id
       WHERE b.id = $1
       LIMIT 1`,
      [id]
    );

    const booking = bookingResult.rows[0];
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, booking.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const guestsResult = await db.query('SELECT * FROM booking_guests WHERE booking_id = $1 ORDER BY created_at ASC', [id]);
    const activitiesResult = await db.query('SELECT * FROM booking_activities WHERE booking_id = $1 ORDER BY created_at ASC', [id]);
    const paymentsResult = await db.query('SELECT * FROM booking_payments WHERE booking_id = $1 ORDER BY created_at DESC', [id]);

    const data = {
      ...booking,
      customer: booking.customer_ref_id
        ? {
            id: booking.customer_ref_id,
            name: booking.customer_name,
            email: booking.customer_email,
            phone: booking.customer_phone,
            country: booking.customer_country,
          }
        : null,
      tour_package: booking.tour_package_ref_id
        ? {
            id: booking.tour_package_ref_id,
            name: booking.tour_package_name,
            package_code: booking.tour_package_code,
            duration_days: booking.tour_package_duration_days,
            price_per_person: booking.tour_package_price_per_person,
            currency: booking.tour_package_currency,
          }
        : null,
      hotel: booking.hotel_ref_id
        ? {
            id: booking.hotel_ref_id,
            name: booking.hotel_name,
            star_rating: booking.hotel_star_rating,
            address: booking.hotel_address,
            phone: booking.hotel_phone,
          }
        : null,
      vehicle: booking.vehicle_ref_id
        ? {
            id: booking.vehicle_ref_id,
            registration_number: booking.vehicle_registration_number,
            vehicle_type: booking.vehicle_type,
            seating_capacity: booking.vehicle_seating_capacity,
            daily_rate_usd: booking.vehicle_daily_rate_usd,
          }
        : null,
      guests: guestsResult.rows,
      activities: activitiesResult.rows,
      payments: paymentsResult.rows,
    };

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/bookings/[id] - Update booking
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const body = await request.json();

    const existingResult = await db.query(
      'SELECT id, company_id, status, tour_package_id, number_of_people FROM bookings WHERE id = $1 LIMIT 1',
      [id]
    );
    const existing = existingResult.rows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (body.status === 'confirmed' && existing.status !== 'confirmed' && (body.tour_package_id || existing.tour_package_id)) {
      const numberOfPeople = body.number_of_people || existing.number_of_people || 1;
      const tourPackageId = body.tour_package_id || existing.tour_package_id;

      const availResult = await db.query<{ available: boolean }>(
        'SELECT check_tour_availability($1, $2) AS available',
        [tourPackageId, numberOfPeople]
      );

      if (!availResult.rows[0]?.available) {
        return NextResponse.json(
          { error: `Insufficient availability. Tour package has less than ${numberOfPeople} slots available.` },
          { status: 400 }
        );
      }
    }

    const fields = Object.keys(body);
    if (fields.length === 0) {
      return NextResponse.json({ data: existing }, { status: 200 });
    }

    const values = fields.map((f) => body[f]);
    const setSql = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');

    const updateResult = await db.query(
      `UPDATE bookings
       SET ${setSql}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, ...values]
    );

    const updated = updateResult.rows[0];

    const joinedResult = await db.query(
      `SELECT b.*,
              c.id AS customer_ref_id,
              c.name AS customer_name,
              c.email AS customer_email,
              c.phone AS customer_phone,
              c.country AS customer_country,
              tp.id AS tour_package_ref_id,
              tp.name AS tour_package_name,
              tp.duration_days AS tour_package_duration_days
       FROM bookings b
       LEFT JOIN customers c ON c.id = b.customer_id
       LEFT JOIN tour_packages tp ON tp.id = b.tour_package_id
       WHERE b.id = $1
       LIMIT 1`,
      [updated.id]
    );

    const row = joinedResult.rows[0];
    const data = {
      ...row,
      customer: row.customer_ref_id
        ? {
            id: row.customer_ref_id,
            name: row.customer_name,
            email: row.customer_email,
            phone: row.customer_phone,
            country: row.customer_country,
          }
        : null,
      tour_package: row.tour_package_ref_id
        ? {
            id: row.tour_package_ref_id,
            name: row.tour_package_name,
            duration_days: row.tour_package_duration_days,
          }
        : null,
    };

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/bookings/[id] - Delete booking
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const bookingResult = await db.query('SELECT id, company_id, status FROM bookings WHERE id = $1 LIMIT 1', [id]);
    const booking = bookingResult.rows[0];

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, booking.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (booking.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft bookings can be deleted. Please cancel confirmed bookings instead.' },
        { status: 400 }
      );
    }

    await db.query('DELETE FROM bookings WHERE id = $1', [id]);

    return NextResponse.json({ message: 'Booking deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
