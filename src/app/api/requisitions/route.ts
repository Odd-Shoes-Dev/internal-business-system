import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/requisitions - List stock requisitions
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
    const search = searchParams.get('search');

    const where: string[] = ['r.company_id = $1'];
    const params: any[] = [companyId];

    if (status) {
      params.push(status);
      where.push(`r.status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`(r.requisition_number ILIKE $${params.length} OR r.client_name ILIKE $${params.length})`);
    }

    const result = await db.query(
      `SELECT r.*,
              COALESCE(SUM(l.quantity_requested), 0) AS total_requested,
              COALESCE(SUM(l.quantity_delivered), 0) AS total_delivered,
              COUNT(DISTINCT l.id) AS line_count,
              COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'active') AS delivery_count
       FROM stock_requisitions r
       LEFT JOIN stock_requisition_lines l ON l.requisition_id = r.id
       LEFT JOIN stock_delivery_forms d ON d.requisition_id = r.id
       WHERE ${where.join(' AND ')}
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      params
    );

    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    console.error('Error fetching requisitions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/requisitions - Create a requisition (with line items)
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const companyId = getCompanyIdFromRequest(request, body);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const { client_name, delivery_location, notes, lines, request_date } = body;

    if (!client_name) {
      return NextResponse.json({ error: 'client_name is required' }, { status: 400 });
    }
    if (!Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }
    for (const line of lines) {
      if (!line.product_id || !(Number(line.quantity_requested) > 0)) {
        return NextResponse.json(
          { error: 'Each item needs a product and a quantity requested greater than 0' },
          { status: 400 }
        );
      }
    }

    const requisition = await db.transaction(async (tx) => {
      const numberResult = await tx.query<{ value: string }>(
        'SELECT generate_requisition_number($1) AS value',
        [companyId]
      );
      const requisitionNumber = numberResult.rows[0].value;

      const reqResult = await tx.query(
        `INSERT INTO stock_requisitions (
           company_id, requisition_number, client_name, delivery_location, notes, created_by, request_date
         ) VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE))
         RETURNING *`,
        [companyId, requisitionNumber, client_name, delivery_location || null, notes || null, user.id, request_date || null]
      );
      const req = reqResult.rows[0];

      for (const line of lines) {
        await tx.query(
          `INSERT INTO stock_requisition_lines (requisition_id, product_id, quantity_requested, remarks)
           VALUES ($1, $2, $3, $4)`,
          [req.id, line.product_id, Number(line.quantity_requested), line.remarks || null]
        );
      }

      return req;
    });

    return NextResponse.json({ data: requisition }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating requisition:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
