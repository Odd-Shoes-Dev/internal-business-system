import { NextRequest, NextResponse } from 'next/server';
import {
  adjustmentApprovalRequiredWithDb,
  approveStockAdjustmentWithDb,
  canApproveAdjustmentsWithDb,
  createStockAdjustmentWithDb,
} from '@/lib/inventory/adjustments';
import { StockError } from '@/lib/inventory/stock';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const result = await db.query(
      `SELECT p.*, pc.name AS category_name
       FROM products p
       LEFT JOIN product_categories pc ON pc.id = p.category_id
       WHERE p.id = $1
       LIMIT 1`,
      [id]
    );

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, row.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const movementResult = await db.query(
      `SELECT *
       FROM inventory_movements
       WHERE product_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [id]
    );

    return NextResponse.json({
      data: {
        ...row,
        product_categories: row.category_name ? { name: row.category_name } : null,
      },
      movements: movementResult.rows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const body = await request.json();

    const currentResult = await db.query(
      'SELECT id, company_id, quantity_on_hand, track_inventory FROM products WHERE id = $1 LIMIT 1',
      [id]
    );
    const current = currentResult.rows[0];
    if (!current) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, current.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const fieldMap: Record<string, string> = {
      name: 'name',
      sku: 'sku',
      barcode: 'barcode',
      description: 'description',
      category_id: 'category_id',
      product_type: 'product_type',
      unit_of_measure: 'unit_of_measure',
      unit_price: 'unit_price',
      cost_price: 'cost_price',
      cost: 'cost_price',
      currency: 'currency',
      is_taxable: 'is_taxable',
      tax_rate: 'tax_rate',
      reorder_point: 'reorder_point',
      reorder_quantity: 'reorder_quantity',
      shelf_location: 'shelf_location',
      purchase_unit: 'purchase_unit',
      units_per_purchase_unit: 'units_per_purchase_unit',
      variant_attributes: 'variant_attributes',
      manufacturer: 'manufacturer',
      brand: 'brand',
      model_number: 'model_number',
      weight: 'weight',
      is_active: 'is_active',
      track_inventory: 'track_inventory',
    };

    const updates: string[] = [];
    const values: any[] = [id];

    // A blank SKU/barcode must be stored as NULL, not ''. The database allows many NULLs but
    // treats '' as a real value that has to be unique, so a second blank one would collide.
    const nullWhenBlank = new Set(['sku', 'barcode']);

    for (const [key, column] of Object.entries(fieldMap)) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        const raw = body[key];
        const value = nullWhenBlank.has(key) && typeof raw === 'string' && raw.trim() === '' ? null : raw;
        values.push(value);
        updates.push(`${column} = $${values.length}`);
      }
    }

    // Stock quantity is never written directly: a changed count becomes a stock adjustment
    // (applied now for approvers or when approval is off, otherwise waiting for approval)
    const requestedQty = body.quantity_on_hand ?? body.quantity_in_stock;
    const qtyChange = requestedQty === undefined || requestedQty === null || !current.track_inventory
      ? 0
      : Number(requestedQty) - Number(current.quantity_on_hand || 0);

    if (updates.length === 0 && !qtyChange) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      let product = current;
      if (updates.length) {
        const updatedResult = await tx.query(
          `UPDATE products
           SET ${updates.join(', ')}, updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          values
        );
        product = updatedResult.rows[0];
      }

      let adjustment: { adjustment_number: string; status: string } | null = null;
      if (Math.abs(qtyChange) > 1e-9) {
        const approved = !(await adjustmentApprovalRequiredWithDb(tx, current.company_id)) ||
          (await canApproveAdjustmentsWithDb(tx, user.id, current.company_id));
        const adj = await createStockAdjustmentWithDb(tx, {
          companyId: current.company_id, productId: id, quantityChange: qtyChange,
          reason: 'count_correction', notes: 'Quantity changed on the product page', userId: user.id,
        });
        if (approved) await approveStockAdjustmentWithDb(tx, adj.id, user.id);
        adjustment = { adjustment_number: adj.adjustment_number, status: approved ? 'approved' : 'pending' };
        product = (await tx.query('SELECT * FROM products WHERE id = $1', [id])).rows[0];
      }
      return { product, adjustment };
    });

    return NextResponse.json({ data: result.product, stock_adjustment: result.adjustment });
  } catch (error: any) {
    if (error instanceof StockError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (/barcode/.test(error?.message || '') && error?.code === '23505') {
      return NextResponse.json({ error: 'That barcode is already used by another product.' }, { status: 409 });
    }
    if (error?.code === '23505' || /products_sku_key|uq_products_company_sku/.test(error?.message || '')) {
      return NextResponse.json(
        { error: 'That SKU is already used by another product. Choose a different SKU.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    const currentResult = await db.query('SELECT id, company_id FROM products WHERE id = $1 LIMIT 1', [id]);
    const current = currentResult.rows[0];
    if (!current) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, current.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    await db.query('DELETE FROM products WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
