import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { acceptGoodsReceiptWithDb, normalizeReceiptLine, type ReceiptLineInput } from '@/lib/inventory/receiving';
import { StockError } from '@/lib/inventory/stock';

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
       LEFT JOIN vendors v ON v.id = COALESCE(gr.vendor_id, po.vendor_id)
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

// POST /api/goods-receipts - Receive stock
//
// From a purchase order: { purchase_order_id, receipt_date, lines: [{ purchase_order_line_id, ... }] }
// Without one ("receive stock"): { company_id, vendor_id?, receipt_date, lines: [{ product_id, ... }] }
// Lines take quantity_received / unit_cost in stock units, or purchase_quantity / purchase_unit_cost
// with units_per_purchase_unit, plus lot_number, expiry_date and manufacture_date.
// accept_now: true accepts the receipt straight away (stock in, ledger posted).
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const receiptDate = body.receipt_date || body.received_date;
    if (!receiptDate || !Array.isArray(body.lines) || body.lines.length === 0) {
      return NextResponse.json({ error: 'Missing required fields: receipt_date, lines' }, { status: 400 });
    }

    let companyId: string | null = null;
    let vendorId: string | null = body.vendor_id || null;
    let po: any = null;

    if (body.purchase_order_id) {
      const poResult = await db.query(
        'SELECT id, company_id, vendor_id, po_number, status FROM purchase_orders WHERE id = $1 LIMIT 1',
        [body.purchase_order_id]
      );
      po = poResult.rows[0];
      if (!po) {
        return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
      }
      if (!['approved', 'partially_received'].includes(po.status)) {
        return NextResponse.json({ error: 'Can only receive goods from approved purchase orders' }, { status: 400 });
      }
      companyId = po.company_id;
      vendorId = po.vendor_id;
    } else {
      companyId = getCompanyIdFromRequest(request, body);
      if (!companyId) {
        return NextResponse.json({ error: 'company_id is required when receiving without a purchase order' }, { status: 400 });
      }
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId!);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (vendorId && !po) {
      const vendor = await db.query('SELECT 1 FROM vendors WHERE id = $1 AND company_id = $2', [vendorId, companyId]);
      if (!vendor.rowCount) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    const response = await db.transaction(async (tx) => {
      // Highest number so far + 1, with a per-company lock so simultaneous receipts don't collide
      await tx.query("SELECT pg_advisory_xact_lock(hashtext('goods_receipt_number:' || $1))", [companyId]);
      const lastResult = await tx.query<{ last: number }>(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM '^GR-(\\d+)$') AS INT)), 0) AS last
         FROM goods_receipts WHERE company_id = $1`,
        [companyId]
      );
      const nextNumber = Number(lastResult.rows[0]?.last || 0) + 1;

      const receiptNumber = `GR-${String(nextNumber).padStart(6, '0')}`;

      const receiptResult = await tx.query(
        `INSERT INTO goods_receipts (
           company_id, receipt_number, purchase_order_id, vendor_id, received_date, status, notes, created_by
         ) VALUES ($1, $2, $3, $4, $5::date, 'received', $6, $7)
         RETURNING *`,
        [companyId, receiptNumber, po?.id || null, vendorId, receiptDate, body.notes || null, user.id]
      );
      const receipt = receiptResult.rows[0];

      const poLines = po
        ? (await tx.query('SELECT id, quantity, product_id, unit_price, description FROM purchase_order_lines WHERE purchase_order_id = $1', [po.id])).rows
        : [];
      const poLineMap = new Map(poLines.map((l: any) => [l.id, l]));

      // Products on a receipt without a PO must belong to this company
      const productIds = [...new Set(body.lines.map((l: ReceiptLineInput) => l.product_id).filter(Boolean))] as string[];
      const products = productIds.length
        ? (await tx.query('SELECT id, name FROM products WHERE id = ANY($1::uuid[]) AND company_id = $2', [productIds, companyId])).rows
        : [];
      const productNames = new Map(products.map((p: any) => [p.id, p.name]));

      for (const line of body.lines as ReceiptLineInput[]) {
        const poLine: any = line.purchase_order_line_id ? poLineMap.get(line.purchase_order_line_id) : null;
        if (po && !poLine) throw new ReceiptError('A received line is not on this purchase order');
        const productId = poLine?.product_id ?? line.product_id ?? null;
        if (!po && productId && !productNames.has(productId)) throw new ReceiptError('Product not found');

        const normalized = normalizeReceiptLine({
          ...line,
          unit_cost: line.unit_cost ?? (line.purchase_unit_cost == null ? poLine?.unit_price : undefined),
        });
        if (!(normalized.quantity > 0)) continue;

        await tx.query(
          `INSERT INTO goods_receipt_lines (
             goods_receipt_id, po_line_id, product_id, description, quantity_received, unit_cost,
             purchase_quantity, purchase_unit, units_per_purchase_unit, lot_number, expiry_date, manufacture_date
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date, $12::date)`,
          [
            receipt.id,
            poLine?.id || null,
            productId,
            line.description || poLine?.description || (productId ? productNames.get(productId) : null) || null,
            normalized.quantity,
            normalized.unitCost,
            normalized.purchaseQuantity,
            line.purchase_unit || null,
            normalized.factor,
            line.lot_number || null,
            line.expiry_date || null,
            line.manufacture_date || null,
          ]
        );
      }

      if (body.accept_now) {
        await acceptGoodsReceiptWithDb(tx, receipt.id, user.id);
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
       LEFT JOIN vendors v ON v.id = COALESCE(gr.vendor_id, po.vendor_id)
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
    if (error instanceof ReceiptError || error instanceof StockError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

class ReceiptError extends Error {}
