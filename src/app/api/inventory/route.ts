import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';
import { receiveOpeningStockWithDb } from '@/lib/inventory/stock';
import { nextSkuWithDb } from '@/lib/inventory/sku';

// GET /api/inventory - List inventory items
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

    const search = searchParams.get('search');
    const lowStock = searchParams.get('low_stock');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    const where: string[] = ['company_id = $1'];
    const params: any[] = [companyId];

    if (search) {
      params.push(`%${search}%`);
      where.push(`(name ILIKE $${params.length} OR sku ILIKE $${params.length} OR description ILIKE $${params.length})`);
    }

    if (category) {
      params.push(category);
      where.push(`category_id = $${params.length}`);
    }

    const parentId = searchParams.get('parent_id');
    if (parentId) {
      params.push(parentId);
      where.push(`parent_product_id = $${params.length}`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const allResult = await db.query(
      `SELECT *
       FROM products
       ${whereSql}
       ORDER BY name ASC`,
      params
    );

    const allData = allResult.rows;

    if (lowStock === 'true') {
      // Only stock-tracked products can run low; services never do
      const filtered = allData.filter(
        (item: any) => item.track_inventory && Number(item.quantity_on_hand || 0) <= Number(item.reorder_point || 0)
      );
      const paged = filtered.slice(offset, offset + limit);

      return NextResponse.json({
        data: paged,
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit),
        },
      });
    }

    const paged = allData.slice(offset, offset + limit);

    return NextResponse.json({
      data: paged,
      pagination: {
        page,
        limit,
        total: allData.length,
        totalPages: Math.ceil(allData.length / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/inventory - Create inventory item
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 });
    }
    // A blank SKU is generated (PRD-000001 / SRV-000001, numbered per company)
    const requestedSku = String(body.sku || '').trim();

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const existingResult = requestedSku
      ? await db.query('SELECT id FROM products WHERE sku = $1 AND company_id = $2 LIMIT 1', [requestedSku, companyId])
      : { rows: [] as any[] };
    const existing = existingResult.rows[0];

    if (existing) {
      return NextResponse.json(
        { error: 'An item with this SKU already exists' },
        { status: 400 }
      );
    }

    // A variant is a product whose parent_product_id points at the product it varies
    const parentId = body.parent_product_id || null;
    if (parentId) {
      const parent = await db.query('SELECT parent_product_id FROM products WHERE id = $1 AND company_id = $2', [parentId, companyId]);
      if (!parent.rowCount) return NextResponse.json({ error: 'Parent product not found' }, { status: 404 });
      if (parent.rows[0].parent_product_id) {
        return NextResponse.json({ error: 'A variant cannot have its own variants' }, { status: 400 });
      }
    }

    // 'inventory' = physical product with tracked stock; 'service' = no stock
    const productType = body.product_type === 'service' ? 'service' : 'inventory';
    const isService = productType === 'service';

    // Products: 1200 Inventory / 5000 Cost of Goods Sold. Services: 4100 Service Revenue /
    // 5100 Cost of Services, and no inventory account.
    const accountId = async (code: string) =>
      (await db.query('SELECT id FROM accounts WHERE code = $1 AND company_id = $2 LIMIT 1', [code, companyId])).rows[0]?.id || null;
    const inventoryAccountId = isService ? null : await accountId('1200');
    const cogsAccountId = await accountId(isService ? '5100' : '5000');
    const revenueAccountId = isService ? await accountId('4100') : null;

    // Generated SKUs retry with the next number if another product took it at the same moment
    let dataResult: { rows: any[] } | null = null;
    for (let attempt = 0; attempt < 5 && !dataResult; attempt++) {
      const sku = requestedSku || (await nextSkuWithDb(db, companyId, productType));
      try {
        dataResult = await db.query(
          `INSERT INTO products (
             company_id, sku, name, description, category_id, product_type, unit_of_measure,
             cost_price, unit_price, currency, quantity_on_hand, quantity_reserved,
             reorder_point, reorder_quantity, inventory_account_id, cogs_account_id,
             revenue_account_id, is_active, track_inventory, is_taxable, tax_rate,
             barcode, shelf_location, purchase_unit, units_per_purchase_unit, parent_product_id, variant_attributes
           ) VALUES (
             $1, $2, $3, $4, $5, $19, $6,
             $7, $8, $9, $10, 0,
             $11, $12, $13, $14,
             $20, $15, $16, $17, $18,
             $21, $22, $23, $24, $25, $26
           )
           RETURNING *`,
          [
            companyId,
            sku,
            body.name,
            body.description || null,
            body.category_id || null,
            body.unit_of_measure || 'each',
            Number(body.unit_cost || 0),
            Number(body.unit_price || 0),
            body.currency || 'USD',
            0, // opening stock is received below, so it gets a batch and a ledger entry
            isService ? 0 : Number(body.reorder_point || 0),
            isService ? 0 : Number(body.reorder_quantity || 0),
            inventoryAccountId,
            cogsAccountId,
            body.is_active !== false,
            isService ? false : body.track_inventory !== false,
            body.is_taxable !== false,
            body.tax_rate || null,
            productType,
            revenueAccountId,
            String(body.barcode || '').trim() || null,
            String(body.shelf_location || '').trim() || null,
            isService ? null : String(body.purchase_unit || '').trim() || null,
            isService ? 1 : Number(body.units_per_purchase_unit) > 0 ? Number(body.units_per_purchase_unit) : 1,
            parentId,
            body.variant_attributes && typeof body.variant_attributes === 'object' ? JSON.stringify(body.variant_attributes) : null,
          ]
        );
      } catch (error: any) {
        if (!requestedSku && error?.code === '23505' && /sku/.test(error?.message || '')) continue;
        throw error;
      }
    }
    if (!dataResult) {
      return NextResponse.json({ error: 'Could not generate a unique SKU, please try again' }, { status: 409 });
    }

    const openingQty = isService ? 0 : Number(body.quantity_on_hand || 0);
    if (openingQty > 0 && body.track_inventory !== false) {
      await receiveOpeningStockWithDb(db, {
        companyId, productId: dataResult.rows[0].id, quantity: openingQty,
        unitCost: Number(body.unit_cost || 0), userId: user.id,
      });
      dataResult.rows[0] = (await db.query('SELECT * FROM products WHERE id = $1', [dataResult.rows[0].id])).rows[0];
    }

    return NextResponse.json({ data: dataResult.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
