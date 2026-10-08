import { NextRequest, NextResponse } from 'next/server';
import { nextSkuWithDb } from '@/lib/inventory/sku';
import { receiveOpeningStockWithDb } from '@/lib/inventory/stock';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/products - List products
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

    const search = searchParams.get('search');
    const active = searchParams.get('active');
    const barcode = searchParams.get('barcode');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Barcode lookup — returns single product immediately
    if (barcode) {
      const result = await db.query(
        `SELECT * FROM products WHERE company_id = $1 AND barcode = $2 AND is_active = true LIMIT 1`,
        [companyId, barcode]
      );
      if (result.rows[0]) {
        return NextResponse.json({ data: result.rows[0] });
      }
      // Check if the barcode exists on an inactive product so the UI can warn instead of silently offering to create a duplicate
      const inactiveResult = await db.query(
        `SELECT * FROM products WHERE company_id = $1 AND barcode = $2 AND is_active = false LIMIT 1`,
        [companyId, barcode]
      );
      return NextResponse.json({ data: null, inactiveProduct: inactiveResult.rows[0] || null });
    }

    const where: string[] = ['company_id = $1'];
    const params: any[] = [companyId];

    if (active === 'true' || active === 'false') {
      params.push(active === 'true');
      where.push(`is_active = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`(name ILIKE $${params.length} OR sku ILIKE $${params.length} OR barcode ILIKE $${params.length})`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countResult = await db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM products
       ${whereSql}`,
      params
    );

    const listParams = [...params, limit, offset];
    const dataResult = await db.query(
      `SELECT *
       FROM products
       ${whereSql}
       ORDER BY name ASC
       LIMIT $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    const total = Number(countResult.rows[0]?.total || 0);

    return NextResponse.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil((total || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/products - Create a new product
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();
    const {
      company_id,
      name,
      sku,
      barcode,
      description,
      product_type = 'service',
      unit_price = 0,
      cost_price = 0,
      currency = 'USD',
      unit_of_measure = 'each',
      is_taxable = false,
      tax_rate = 0,
      track_inventory = false,
      quantity_on_hand = 0,
      reorder_point,
      revenue_account_id,
      category_id,
    } = body;

    if (!company_id) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const companyAccessError = await requireCompanyAccess(user.id, company_id);
    if (companyAccessError) return companyAccessError;

    // A blank SKU is generated (PRD-000001 / SRV-000001); retry if another product took it
    const requestedSku = String(sku || '').trim();
    let result: { rows: any[] } | null = null;
    for (let attempt = 0; attempt < 5 && !result; attempt++) {
      const finalSku = requestedSku || (await nextSkuWithDb(db, company_id, product_type));
      try {
        result = await db.query(
          `INSERT INTO products (
             company_id, name, sku, barcode, description, product_type,
             unit_price, cost_price, currency, unit_of_measure,
             is_taxable, tax_rate, track_inventory, quantity_on_hand,
             reorder_point, revenue_account_id, category_id, is_active
           ) VALUES (
             $1, $2, $3, $4, $5, $6,
             $7, $8, $9, $10,
             $11, $12, $13, 0,
             $14, $15, $16, true
           ) RETURNING *`,
          [
            company_id, name, finalSku, barcode || null, description || null, product_type,
            unit_price, cost_price, currency, unit_of_measure,
            is_taxable, tax_rate, track_inventory,
            reorder_point || null, revenue_account_id || null, category_id || null,
          ]
        );
      } catch (error: any) {
        if (!requestedSku && error?.code === '23505' && /sku/.test(error?.message || '')) continue;
        throw error;
      }
    }
    if (!result) return NextResponse.json({ error: 'Could not generate a unique SKU, please try again' }, { status: 409 });

    // Starting stock gets a batch and a ledger entry, like any other stock coming in
    if (track_inventory && Number(quantity_on_hand) > 0) {
      await receiveOpeningStockWithDb(db, {
        companyId: company_id, productId: result.rows[0].id, quantity: Number(quantity_on_hand),
        unitCost: Number(cost_price || 0), userId: user.id,
      });
      result.rows[0] = (await db.query('SELECT * FROM products WHERE id = $1', [result.rows[0].id])).rows[0];
    }

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
