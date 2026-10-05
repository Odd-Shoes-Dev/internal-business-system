import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

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

    if (!body.name || !body.sku) {
      return NextResponse.json(
        { error: 'Missing required fields: name, sku' },
        { status: 400 }
      );
    }

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const existingResult = await db.query('SELECT id FROM products WHERE sku = $1 AND company_id = $2 LIMIT 1', [
      body.sku,
      companyId,
    ]);
    const existing = existingResult.rows[0];

    if (existing) {
      return NextResponse.json(
        { error: 'An item with this SKU already exists' },
        { status: 400 }
      );
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

    const dataResult = await db.query(
      `INSERT INTO products (
         company_id, sku, name, description, category_id, product_type, unit_of_measure,
         cost_price, unit_price, currency, quantity_on_hand, quantity_reserved,
         reorder_point, reorder_quantity, inventory_account_id, cogs_account_id,
         revenue_account_id, is_active, track_inventory, is_taxable, tax_rate
       ) VALUES (
         $1, $2, $3, $4, $5, $19, $6,
         $7, $8, $9, $10, 0,
         $11, $12, $13, $14,
         $20, $15, $16, $17, $18
       )
       RETURNING *`,
      [
        companyId,
        body.sku,
        body.name,
        body.description || null,
        body.category_id || null,
        body.unit_of_measure || 'each',
        Number(body.unit_cost || 0),
        Number(body.unit_price || 0),
        body.currency || 'USD',
        isService ? 0 : Number(body.quantity_on_hand || 0),
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
      ]
    );

    return NextResponse.json({ data: dataResult.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
