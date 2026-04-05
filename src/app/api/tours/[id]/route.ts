import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/tours/[id] - Get tour package details
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const tourResult = await db.query(
      `SELECT tp.*,
              d.id AS primary_destination_ref_id,
              d.name AS primary_destination_name,
              d.country AS primary_destination_country,
              d.description AS primary_destination_description
       FROM tour_packages tp
       LEFT JOIN destinations d ON d.id = tp.primary_destination_id
       WHERE tp.id = $1
       LIMIT 1`,
      [id]
    );

    const tour = tourResult.rows[0];
    if (!tour) {
      return NextResponse.json({ error: 'Tour package not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, tour.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const imagesResult = await db.query('SELECT * FROM tour_package_images WHERE tour_package_id = $1 ORDER BY created_at ASC', [id]);
    const itinerariesResult = await db.query('SELECT * FROM tour_itineraries WHERE tour_package_id = $1 ORDER BY day_number ASC', [id]);
    const destinationsResult = await db.query(
      `SELECT tpd.*, d.id AS destination_ref_id, d.name AS destination_name, d.country AS destination_country
       FROM tour_package_destinations tpd
       LEFT JOIN destinations d ON d.id = tpd.destination_id
       WHERE tpd.tour_package_id = $1
       ORDER BY tpd.day_number ASC NULLS LAST`,
      [id]
    );
    const pricingResult = await db.query('SELECT * FROM tour_seasonal_pricing WHERE tour_package_id = $1 ORDER BY start_date ASC', [id]);

    const data = {
      ...tour,
      primary_destination: tour.primary_destination_ref_id
        ? {
            id: tour.primary_destination_ref_id,
            name: tour.primary_destination_name,
            country: tour.primary_destination_country,
            description: tour.primary_destination_description,
          }
        : null,
      images: imagesResult.rows,
      itineraries: itinerariesResult.rows,
      destinations: destinationsResult.rows.map((row: any) => ({
        ...row,
        destination: row.destination_ref_id
          ? {
              id: row.destination_ref_id,
              name: row.destination_name,
              country: row.destination_country,
            }
          : null,
      })),
      seasonal_pricing: pricingResult.rows,
    };

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/tours/[id] - Update tour package
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const body = await request.json();

    const existingResult = await db.query('SELECT id, company_id FROM tour_packages WHERE id = $1 LIMIT 1', [id]);
    const existing = existingResult.rows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Tour package not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const fields = Object.keys(body);
    if (!fields.length) {
      return NextResponse.json({ data: existing }, { status: 200 });
    }

    const setSql = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    const values = fields.map((f) => body[f]);

    const updatedResult = await db.query(
      `UPDATE tour_packages
       SET ${setSql}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, ...values]
    );

    const updated = updatedResult.rows[0];

    const joined = await db.query(
      `SELECT tp.*,
              d.id AS primary_destination_ref_id,
              d.name AS primary_destination_name,
              d.country AS primary_destination_country
       FROM tour_packages tp
       LEFT JOIN destinations d ON d.id = tp.primary_destination_id
       WHERE tp.id = $1
       LIMIT 1`,
      [updated.id]
    );

    const row = joined.rows[0];
    const data = {
      ...row,
      primary_destination: row.primary_destination_ref_id
        ? {
            id: row.primary_destination_ref_id,
            name: row.primary_destination_name,
            country: row.primary_destination_country,
          }
        : null,
    };

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/tours/[id] - Delete tour package
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const existingResult = await db.query('SELECT id, company_id FROM tour_packages WHERE id = $1 LIMIT 1', [id]);
    const existing = existingResult.rows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Tour package not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const bookingsResult = await db.query('SELECT id FROM bookings WHERE tour_package_id = $1 LIMIT 1', [id]);
    if (bookingsResult.rowCount) {
      return NextResponse.json(
        { error: 'Cannot delete tour package that is used in bookings. Please deactivate it instead.' },
        { status: 400 }
      );
    }

    await db.query('DELETE FROM tour_packages WHERE id = $1', [id]);

    return NextResponse.json({ message: 'Tour package deleted successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
