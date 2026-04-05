import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/goods-receipts - List goods receipts
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

    const purchaseOrderId = searchParams.get('purchase_order_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    const where: string[] = ['gr.company_id = $1'];
    const params: any[] = [companyId];

    if (purchaseOrderId) {
      params.push(purchaseOrderId);
      where.push(`gr.purchase_order_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`gr.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`gr.receipt_number ILIKE $${params.length}`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM goods_receipts gr
       ${whereSql}`,
      params
    );

    const listParams = [...params, limit, offset];
    const rowsResult = await db.query(
      `SELECT gr.*,
              po.id AS po_ref_id,
              po.po_number,
              v.id AS vendor_ref_id,
              v.name AS vendor_name
       FROM goods_receipts gr
       LEFT JOIN purchase_orders po ON po.id = gr.purchase_order_id
       LEFT JOIN vendors v ON v.id = po.vendor_id
       ${whereSql}
       ORDER BY gr.received_date DESC
       LIMIT $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    const data: any[] = [];

    for (const row of rowsResult.rows) {
      const linesResult = await db.query(
        `SELECT grl.*,
                pol.id AS po_line_ref_id,
                pol.description AS po_line_description,
                pol.quantity AS ordered_quantity,
                pol.unit_price AS po_line_unit_price
         FROM goods_receipt_lines grl
         LEFT JOIN purchase_order_lines pol ON pol.id = grl.po_line_id
         WHERE grl.goods_receipt_id = $1
         ORDER BY grl.created_at ASC`,
        [row.id]
      );

      data.push({
        ...row,
        gr_number: row.receipt_number,
        purchase_order: row.po_ref_id
          ? {
              id: row.po_ref_id,
              po_number: row.po_number,
              vendor: row.vendor_ref_id ? { id: row.vendor_ref_id, name: row.vendor_name } : null,
            }
          : null,
        goods_receipt_lines: linesResult.rows.map((line: any) => ({
          ...line,
          purchase_order_line: line.po_line_ref_id
            ? {
                id: line.po_line_ref_id,
                description: line.po_line_description,
                ordered_quantity: line.ordered_quantity,
                unit_price: line.po_line_unit_price,
              }
            : null,
        })),
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

// POST /api/goods-receipts - Create goods receipt from PO
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    if (!body.purchase_order_id || !body.receipt_date || !body.lines || body.lines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: purchase_order_id, receipt_date, lines' },
        { status: 400 }
      );
    }

    const poResult = await db.query(
      'SELECT id, company_id, po_number, status FROM purchase_orders WHERE id = $1 LIMIT 1',
      [body.purchase_order_id]
    );
    const po = poResult.rows[0];

    if (!po) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, po.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (po.status !== 'approved') {
      return NextResponse.json({ error: 'Can only receive goods from approved purchase orders' }, { status: 400 });
    }

    const response = await db.transaction(async (tx) => {
      const lastResult = await tx.query(
        `SELECT receipt_number
         FROM goods_receipts
         WHERE company_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [po.company_id]
      );

      let nextNumber = 1;
      const last = lastResult.rows[0]?.receipt_number;
      if (last) {
        const match = String(last).match(/GR-(\d+)/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      const receiptNumber = `GR-${String(nextNumber).padStart(6, '0')}`;

      const receiptResult = await tx.query(
        `INSERT INTO goods_receipts (
           company_id, receipt_number, purchase_order_id, received_date, status, notes, created_by
         ) VALUES ($1, $2, $3, $4::date, $5, $6, $7)
         RETURNING *`,
        [
          po.company_id,
          receiptNumber,
          body.purchase_order_id,
          body.receipt_date,
          body.status || 'received',
          body.notes || null,
          user.id,
        ]
      );

      const receipt = receiptResult.rows[0];

      const poLinesResult = await tx.query('SELECT id, quantity, product_id, unit_price FROM purchase_order_lines WHERE purchase_order_id = $1', [
        body.purchase_order_id,
      ]);
      const poLineMap = new Map(poLinesResult.rows.map((l: any) => [l.id, l]));

      for (const line of body.lines) {
        const poLine = poLineMap.get(line.purchase_order_line_id);
        await tx.query(
          `INSERT INTO goods_receipt_lines (
             goods_receipt_id, po_line_id, product_id, quantity_received, unit_cost
           ) VALUES ($1, $2, $3, $4, $5)`,
          [
            receipt.id,
            line.purchase_order_line_id,
            poLine?.product_id || null,
            Number(line.quantity_received || 0),
            Number(line.unit_cost ?? poLine?.unit_price ?? 0),
          ]
        );
      }

      const allLinesReceived = body.lines.every((line: any) => {
        const poLine = poLineMap.get(line.purchase_order_line_id);
        return poLine && Number(line.quantity_received || 0) >= Number(poLine.quantity || 0);
      });

      if (allLinesReceived) {
        await tx.query(
          `UPDATE purchase_orders
           SET status = 'received',
               received_date = $2::date,
               received_by = $3,
               updated_at = NOW()
           WHERE id = $1`,
          [body.purchase_order_id, body.receipt_date, user.id]
        );
      }

      return receipt.id;
    });

    const completeResult = await db.query(
      `SELECT gr.*,
              po.id AS po_ref_id,
              po.po_number,
              v.id AS vendor_ref_id,
              v.name AS vendor_name
       FROM goods_receipts gr
       LEFT JOIN purchase_orders po ON po.id = gr.purchase_order_id
       LEFT JOIN vendors v ON v.id = po.vendor_id
       WHERE gr.id = $1
       LIMIT 1`,
      [response]
    );

    const row = completeResult.rows[0];

    const linesResult = await db.query(
      `SELECT grl.*,
              pol.id AS po_line_ref_id,
              pol.description AS po_line_description,
              pol.quantity,
              pol.unit_price,
              pol.unit
       FROM goods_receipt_lines grl
       LEFT JOIN purchase_order_lines pol ON pol.id = grl.po_line_id
       WHERE grl.goods_receipt_id = $1
       ORDER BY grl.created_at ASC`,
      [response]
    );

    const completeReceipt = {
      ...row,
      gr_number: row.receipt_number,
      purchase_order: row.po_ref_id
        ? {
            id: row.po_ref_id,
            po_number: row.po_number,
            vendor: row.vendor_ref_id ? { id: row.vendor_ref_id, name: row.vendor_name } : null,
          }
        : null,
      goods_receipt_lines: linesResult.rows.map((line: any) => ({
        ...line,
        purchase_order_line: line.po_line_ref_id
          ? {
              id: line.po_line_ref_id,
              description: line.po_line_description,
              quantity: line.quantity,
              unit_price: line.unit_price,
              unit: line.unit,
            }
          : null,
      })),
    };

    return NextResponse.json(completeReceipt, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
