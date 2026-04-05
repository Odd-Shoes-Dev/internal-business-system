import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/tours - List all tour packages with optional filters
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

    const searchQuery = searchParams.get('search');
    const destinationId = searchParams.get('destination_id');
    const minPrice = searchParams.get('min_price');
    const maxPrice = searchParams.get('max_price');
    const isFeatured = searchParams.get('is_featured');
    const isActive = searchParams.get('is_active');

    const where: string[] = ['tp.company_id = $1'];
    const params: any[] = [companyId];

    if (searchQuery) {
      params.push(`%${searchQuery}%`);
      const i = params.length;
      where.push(`(tp.name ILIKE $${i} OR tp.description ILIKE $${i})`);
    }

    if (destinationId && destinationId !== 'all') {
      params.push(destinationId);
      where.push(`tp.primary_destination_id = $${params.length}`);
    }

    if (minPrice) {
      params.push(parseFloat(minPrice));
      where.push(`tp.price_per_person >= $${params.length}`);
    }

    if (maxPrice) {
      params.push(parseFloat(maxPrice));
      where.push(`tp.price_per_person <= $${params.length}`);
    }

    if (isFeatured !== null && isFeatured !== undefined) {
      params.push(isFeatured === 'true');
      where.push(`tp.is_featured = $${params.length}`);
    }

    if (isActive !== null && isActive !== undefined) {
      params.push(isActive === 'true');
      where.push(`tp.is_active = $${params.length}`);
    }

    const result = await db.query(
      `SELECT tp.*,
              d.id AS primary_destination_ref_id,
              d.name AS primary_destination_name,
              d.country AS primary_destination_country
       FROM tour_packages tp
       LEFT JOIN destinations d ON d.id = tp.primary_destination_id
       WHERE ${where.join(' AND ')}
       ORDER BY tp.name ASC`,
      params
    );

    const data = result.rows.map((row: any) => ({
      ...row,
      primary_destination: row.primary_destination_ref_id
        ? {
            id: row.primary_destination_ref_id,
            name: row.primary_destination_name,
            country: row.primary_destination_country,
          }
        : null,
    }));

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/tours - Create a new tour package
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const { company_id, ...tourData } = body;

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    if (!tourData.name || !tourData.primary_destination_id || !tourData.duration_days || !tourData.price_per_person) {
      return NextResponse.json(
        { error: 'Missing required fields: name, primary_destination_id, duration_days, price_per_person' },
        { status: 400 }
      );
    }

    const companyAccessError = await requireCompanyAccess(user.id, company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const insertResult = await db.query(
      `INSERT INTO tour_packages (
         company_id, name, primary_destination_id, duration_days, price_per_person,
         package_code, description, currency, is_featured, is_active, created_by
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6, $7, $8, $9, $10, $11
       )
       RETURNING *`,
      [
        company_id,
        tourData.name,
        tourData.primary_destination_id,
        tourData.duration_days,
        tourData.price_per_person,
        tourData.package_code || null,
        tourData.description || null,
        tourData.currency || 'USD',
        tourData.is_featured || false,
        tourData.is_active ?? true,
        user.id,
      ]
    );

    const created = insertResult.rows[0];

    const joined = await db.query(
      `SELECT tp.*,
              d.id AS primary_destination_ref_id,
              d.name AS primary_destination_name,
              d.country AS primary_destination_country
       FROM tour_packages tp
       LEFT JOIN destinations d ON d.id = tp.primary_destination_id
       WHERE tp.id = $1
       LIMIT 1`,
      [created.id]
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

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
