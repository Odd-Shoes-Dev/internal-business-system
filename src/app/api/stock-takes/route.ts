import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const stockTakeId = searchParams.get('stock_take_id');
    const companyId = getCompanyIdFromRequest(request);

    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const params: any[] = [companyId];
    const where = ['st.company_id = $1'];

    if (status) {
      params.push(status);
      where.push(`st.status = $${params.length}`);
    }

    if (stockTakeId) {
      params.push(stockTakeId);
      where.push(`st.id = $${params.length}`);
    }

    const result = await db.query(
      `SELECT st.*,
              il.id AS location_ref_id,
              il.name AS location_name,
              il.type AS location_type,
              up.full_name AS counted_by_full_name
       FROM stock_takes st
       LEFT JOIN inventory_locations il ON il.id = st.location_id
       LEFT JOIN user_profiles up ON up.id = st.counted_by
       WHERE ${where.join(' AND ')}
       ORDER BY st.stock_take_date DESC`,
      params
    );

    const data = result.rows.map((row: any) => ({
      ...row,
      inventory_locations: row.location_ref_id
        ? {
            id: row.location_ref_id,
            name: row.location_name,
            type: row.location_type,
          }
        : null,
      user_profiles: row.counted_by_full_name
        ? {
            full_name: row.counted_by_full_name,
          }
        : null,
    }));

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error fetching stock takes:', error);
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
    const { reference_number, stock_take_date, location_id, type, notes, lines } = body;

    if (!reference_number || !stock_take_date || !location_id || !type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const companyId = body.company_id || getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const locationResult = await db.query(
      'SELECT id FROM inventory_locations WHERE id = $1 AND company_id = $2 LIMIT 1',
      [location_id, companyId]
    );
    if (!locationResult.rowCount) {
      return NextResponse.json({ error: 'Location not found for company' }, { status: 404 });
    }

    const response = await db.transaction(async (tx) => {
      const stockTakeResult = await tx.query(
        `INSERT INTO stock_takes (
           company_id, reference_number, stock_take_date, location_id,
           type, status, counted_by, notes
         ) VALUES ($1, $2, $3::date, $4, $5, 'draft', $6, $7)
         RETURNING *`,
        [companyId, reference_number, stock_take_date, location_id, type, user.id, notes || null]
      );

      const stockTake = stockTakeResult.rows[0];

      if (lines && lines.length > 0) {
        for (const line of lines) {
          await tx.query(
            `INSERT INTO stock_take_lines (
               stock_take_id, product_id, expected_quantity, counted_quantity, notes
             ) VALUES ($1, $2, $3, $4, $5)`,
            [
              stockTake.id,
              line.product_id,
              Number(line.expected_quantity || 0),
              Number(line.counted_quantity || 0),
              line.notes || null,
            ]
          );
        }
      }

      return stockTake;
    });

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error('Error creating stock take:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
