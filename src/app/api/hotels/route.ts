import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/hotels - List all hotels with optional filters
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const { searchParams } = new URL(request.url);

    const searchQuery = searchParams.get('search');
    const destinationId = searchParams.get('destination_id');
    const minRating = searchParams.get('min_rating');
    const isActive = searchParams.get('is_active');

    const where: string[] = ['h.company_id = $1'];
    const params: any[] = [companyId];

    if (searchQuery) {
      params.push(`%${searchQuery}%`);
      where.push(`(h.name ILIKE $${params.length} OR h.address ILIKE $${params.length})`);
    }

    if (destinationId && destinationId !== 'all') {
      params.push(destinationId);
      where.push(`h.destination_id = $${params.length}`);
    }

    if (minRating) {
      params.push(Number(minRating));
      where.push(`h.star_rating >= $${params.length}`);
    }

    if (isActive !== null && isActive !== undefined) {
      params.push(isActive === 'true');
      where.push(`h.is_active = $${params.length}`);
    }

    const result = await db.query(
      `SELECT h.*,
              d.id AS destination_ref_id,
              d.name AS destination_name,
              d.country AS destination_country
       FROM hotels h
       LEFT JOIN destinations d ON d.id = h.destination_id
       WHERE ${where.join(' AND ')}
       ORDER BY h.name ASC`,
      params
    );

    const data = result.rows.map((row: any) => ({
      ...row,
      destination: row.destination_ref_id
        ? {
            id: row.destination_ref_id,
            name: row.destination_name,
            country: row.destination_country,
          }
        : null,
    }));

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/hotels - Create a new hotel
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    if (!body.name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    let companyId = body.company_id || getCompanyIdFromRequest(request);
    let destination: any = null;

    if (body.destination_id) {
      const destinationResult = await db.query(
        'SELECT id, company_id, name, country FROM destinations WHERE id = $1 LIMIT 1',
        [body.destination_id]
      );
      destination = destinationResult.rows[0];
      if (!destination) {
        return NextResponse.json({ error: 'Destination not found' }, { status: 404 });
      }
      companyId = destination.company_id;
    }

    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const insertResult = await db.query(
      `INSERT INTO hotels (
         company_id, destination_id, name, address, contact_person,
         phone, email, website, star_rating, check_in_time,
         check_out_time, amenities, notes, is_active, created_by,
         hotel_type, standard_rate_usd, deluxe_rate_usd, suite_rate_usd,
         contact_phone, commission_rate, is_partner
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15,
         $16, $17, $18, $19,
         $20, $21, $22
       )
       RETURNING *`,
      [
        companyId,
        body.destination_id || null,
        body.name,
        body.address || null,
        body.contact_person || null,
        body.phone || null,
        body.email || null,
        body.website || null,
        body.star_rating ?? null,
        body.check_in_time || null,
        body.check_out_time || null,
        body.amenities || null,
        body.notes || null,
        body.is_active !== false,
        user.id,
        body.hotel_type || null,
        body.standard_rate_usd || null,
        body.deluxe_rate_usd || null,
        body.suite_rate_usd || null,
        body.contact_phone || null,
        body.commission_rate || null,
        body.is_partner !== false,
      ]
    );

    const hotel = insertResult.rows[0];
    const data = {
      ...hotel,
      destination: destination
        ? {
            id: destination.id,
            name: destination.name,
            country: destination.country,
          }
        : null,
    };

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
