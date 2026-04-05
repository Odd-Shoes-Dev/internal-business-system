import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/purchase-orders - List purchase orders
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

    const vendorId = searchParams.get('vendor_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    const where: string[] = ['po.company_id = $1'];
    const params: any[] = [companyId];

    if (vendorId) {
      params.push(vendorId);
      where.push(`po.vendor_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      where.push(`po.status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`po.po_number ILIKE $${params.length}`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM purchase_orders po
       ${whereSql}`,
      params
    );

    const listParams = [...params, limit, offset];
    const rowsResult = await db.query(
      `SELECT po.*,
              v.id AS vendor_ref_id,
              v.name AS vendor_name,
              v.email AS vendor_email,
              v.phone AS vendor_phone
       FROM purchase_orders po
       LEFT JOIN vendors v ON v.id = po.vendor_id
       ${whereSql}
       ORDER BY COALESCE(po.po_date, po.order_date) DESC
       LIMIT $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    const data: any[] = [];
    for (const row of rowsResult.rows) {
      const linesResult = await db.query(
        `SELECT *
         FROM purchase_order_lines
         WHERE purchase_order_id = $1
         ORDER BY line_number ASC, created_at ASC`,
        [row.id]
      );

      data.push({
        ...row,
        vendor: row.vendor_ref_id
          ? {
              id: row.vendor_ref_id,
              name: row.vendor_name,
              email: row.vendor_email,
              phone: row.vendor_phone,
            }
          : null,
        purchase_order_lines: linesResult.rows,
      });
    }

    const total = Number(countResult.rows[0]?.total || 0);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/purchase-orders - Create purchase order
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    if (!body.vendor_id || !body.po_date || !body.lines || body.lines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: vendor_id, po_date, lines' },
        { status: 400 }
      );
    }

    const vendorResult = await db.query('SELECT id, company_id FROM vendors WHERE id = $1 LIMIT 1', [body.vendor_id]);
    const vendor = vendorResult.rows[0];
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, vendor.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const lines = body.lines.map((line: any) => ({
      ...line,
      quantity: Number(line.quantity ?? line.quantity_ordered ?? 0),
      unit_price: Number(line.unit_price ?? line.unit_cost ?? 0),
      line_total:
        Number(line.line_total ?? Number(line.quantity ?? line.quantity_ordered ?? 0) * Number(line.unit_price ?? line.unit_cost ?? 0)),
    }));

    const subtotal = lines.reduce((sum: number, line: any) => sum + line.line_total, 0);
    const taxAmount = subtotal * (body.tax_rate || 0);
    const total = subtotal + taxAmount;

    const poId = await db.transaction(async (tx) => {
      const latestPOResult = await tx.query(
        `SELECT po_number
         FROM purchase_orders
         WHERE company_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [vendor.company_id]
      );

      let nextNumber = 1;
      const latestNumber = latestPOResult.rows[0]?.po_number;
      if (latestNumber) {
        const match = String(latestNumber).match(/PO-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      const poNumber = `PO-${String(nextNumber).padStart(6, '0')}`;

      const poResult = await tx.query(
        `INSERT INTO purchase_orders (
           company_id, po_number, vendor_id, po_date, expected_delivery_date,
           currency, exchange_rate, subtotal, tax_rate, tax_amount, total,
           status, notes, created_by
         ) VALUES (
           $1, $2, $3, $4::date, $5::date,
           $6, $7, $8, $9, $10, $11,
           'draft', $12, $13
         )
         RETURNING id`,
        [
          vendor.company_id,
          poNumber,
          body.vendor_id,
          body.po_date,
          body.expected_delivery_date || null,
          body.currency || 'USD',
          body.exchange_rate || 1,
          subtotal,
          body.tax_rate || 0,
          taxAmount,
          total,
          body.notes || null,
          user.id,
        ]
      );

      const po = poResult.rows[0];

      let lineNumber = 1;
      for (const line of lines) {
        await tx.query(
          `INSERT INTO purchase_order_lines (
             purchase_order_id, line_number, product_id, description,
             quantity, unit_price, line_total
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            po.id,
            lineNumber,
            line.product_id || null,
            line.description || 'Item',
            line.quantity,
            line.unit_price,
            line.line_total,
          ]
        );
        lineNumber += 1;
      }

      return po.id;
    });

    const poResult = await db.query(
      `SELECT po.*,
              v.id AS vendor_ref_id,
              v.name AS vendor_name,
              v.email AS vendor_email,
              v.phone AS vendor_phone
       FROM purchase_orders po
       LEFT JOIN vendors v ON v.id = po.vendor_id
       WHERE po.id = $1
       LIMIT 1`,
      [poId]
    );
    const po = poResult.rows[0];

    const linesResult = await db.query(
      `SELECT *
       FROM purchase_order_lines
       WHERE purchase_order_id = $1
       ORDER BY line_number ASC, created_at ASC`,
      [poId]
    );

    const completePO = {
      ...po,
      vendor: po.vendor_ref_id
        ? {
            id: po.vendor_ref_id,
            name: po.vendor_name,
            email: po.vendor_email,
            phone: po.vendor_phone,
          }
        : null,
      purchase_order_lines: linesResult.rows,
    };

    return NextResponse.json(completePO, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
