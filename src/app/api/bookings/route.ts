import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/bookings - List all bookings with optional filters
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const status = searchParams.get('status');
    const bookingType = searchParams.get('booking_type');
    const customerId = searchParams.get('customer_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    const where: string[] = ['b.company_id = $1'];
    const params: any[] = [companyId];

    if (status && status !== 'all') {
      params.push(status);
      where.push(`b.status = $${params.length}`);
    }

    if (bookingType && bookingType !== 'all') {
      params.push(bookingType);
      where.push(`b.booking_type = $${params.length}`);
    }

    if (customerId) {
      params.push(customerId);
      where.push(`b.customer_id = $${params.length}`);
    }

    if (startDate) {
      params.push(startDate);
      where.push(`b.travel_start_date >= $${params.length}::date`);
    }

    if (endDate) {
      params.push(endDate);
      where.push(`b.travel_end_date <= $${params.length}::date`);
    }

    const result = await db.query(
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
              h.id AS hotel_ref_id,
              h.name AS hotel_name,
              h.star_rating AS hotel_star_rating,
              v.id AS vehicle_ref_id,
              v.vehicle_type AS vehicle_type,
              v.registration_number AS vehicle_registration_number,
              v.daily_rate_usd AS vehicle_daily_rate_usd
       FROM bookings b
       LEFT JOIN customers c ON c.id = b.customer_id
       LEFT JOIN tour_packages tp ON tp.id = b.tour_package_id
       LEFT JOIN hotels h ON h.id = b.hotel_id
       LEFT JOIN vehicles v ON v.id = b.assigned_vehicle_id
       WHERE ${where.join(' AND ')}
       ORDER BY b.created_at DESC`,
      params
    );

    const data = result.rows.map((row: any) => ({
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
            package_code: row.tour_package_code,
            duration_days: row.tour_package_duration_days,
          }
        : null,
      hotel: row.hotel_ref_id
        ? {
            id: row.hotel_ref_id,
            name: row.hotel_name,
            star_rating: row.hotel_star_rating,
          }
        : null,
      vehicle: row.vehicle_ref_id
        ? {
            id: row.vehicle_ref_id,
            vehicle_type: row.vehicle_type,
            registration_number: row.vehicle_registration_number,
            daily_rate_usd: row.vehicle_daily_rate_usd,
          }
        : null,
    }));

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/bookings - Create a new booking
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const { company_id, ...bookingData } = body;

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    if (!bookingData.customer_id || !bookingData.booking_type || !bookingData.travel_start_date || !bookingData.travel_end_date) {
      return NextResponse.json(
        { error: 'Missing required fields: customer_id, booking_type, travel_start_date, travel_end_date' },
        { status: 400 }
      );
    }

    const companyAccessError = await requireCompanyAccess(user.id, company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (bookingData.tour_package_id && bookingData.status === 'confirmed') {
      const numberOfPeople = bookingData.number_of_people || 1;
      const availResult = await db.query<{ available: boolean }>(
        'SELECT check_tour_availability($1, $2) AS available',
        [bookingData.tour_package_id, numberOfPeople]
      );
      if (!availResult.rows[0]?.available) {
        return NextResponse.json(
          { error: `Insufficient availability. Tour package has less than ${numberOfPeople} slots available.` },
          { status: 400 }
        );
      }
    }

    const latestBooking = await db.query(
      `SELECT booking_number
       FROM bookings
       WHERE company_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [company_id]
    );

    let nextNumber = 1;
    const last = latestBooking.rows[0]?.booking_number;
    if (last) {
      const match = String(last).match(/BK-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const bookingNumber = `BK-${nextNumber.toString().padStart(6, '0')}`;

    const insertResult = await db.query(
      `INSERT INTO bookings (
         company_id, booking_number, customer_id, booking_type,
         travel_start_date, travel_end_date, number_of_people, created_by,
         tour_package_id, hotel_id, assigned_vehicle_id, status,
         total, amount_paid, balance_due, currency, exchange_rate, notes,
         booking_date, num_adults, num_children, num_infants,
         subtotal, discount_amount, tax_amount,
         special_requests, dietary_requirements,
         room_type, num_rooms, rental_type, pickup_location, dropoff_location
       ) VALUES (
         $1, $2, $3, $4,
         $5::date, $6::date, $7, $8,
         $9, $10, $11, $12,
         $13, $14, $15, $16, $17, $18,
         $19, $20, $21, $22,
         $23, $24, $25,
         $26, $27,
         $28, $29, $30, $31, $32
       )
       RETURNING *`,
      [
        company_id,
        bookingNumber,
        bookingData.customer_id,
        bookingData.booking_type,
        bookingData.travel_start_date,
        bookingData.travel_end_date,
        bookingData.number_of_people || 1,
        user.id,
        bookingData.tour_package_id || null,
        bookingData.hotel_id || null,
        bookingData.assigned_vehicle_id || null,
        bookingData.status || 'inquiry',
        bookingData.total || 0,
        bookingData.amount_paid || 0,
        bookingData.balance_due ?? bookingData.total ?? 0,
        bookingData.currency || 'USD',
        bookingData.exchange_rate || 1,
        bookingData.notes || null,
        bookingData.booking_date || null,
        bookingData.num_adults ?? null,
        bookingData.num_children ?? null,
        bookingData.num_infants ?? null,
        bookingData.subtotal ?? null,
        bookingData.discount_amount ?? null,
        bookingData.tax_amount ?? null,
        bookingData.special_requests || null,
        bookingData.dietary_requirements || null,
        bookingData.room_type || null,
        bookingData.num_rooms ?? null,
        bookingData.rental_type || null,
        bookingData.pickup_location || null,
        bookingData.dropoff_location || null,
      ]
    );

    const created = insertResult.rows[0];

    const joined = await db.query(
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
      [created.id]
    );

    const row = joined.rows[0];
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

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
