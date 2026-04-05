import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/inventory/[id]/adjust - Adjust inventory quantity
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    if (!body.adjustment_type || body.quantity === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: adjustment_type, quantity' },
        { status: 400 }
      );
    }

    const itemResult = await db.query('SELECT * FROM products WHERE id = $1 LIMIT 1', [id]);
    const item = itemResult.rows[0];

    if (!item) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, item.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Calculate new quantity
    let newQuantity = Number(item.quantity_on_hand || 0);
    let movementQuantity = Number(body.quantity || 0);

    switch (body.adjustment_type) {
      case 'add':
      case 'receive':
      case 'return':
        newQuantity += Number(body.quantity || 0);
        break;
      case 'remove':
      case 'sell':
      case 'damage':
      case 'shrinkage':
        if (Number(body.quantity || 0) > Number(item.quantity_on_hand || 0)) {
          return NextResponse.json(
            { error: 'Insufficient quantity on hand' },
            { status: 400 }
          );
        }
        newQuantity -= Number(body.quantity || 0);
        movementQuantity = -Number(body.quantity || 0);
        break;
      case 'adjustment':
        newQuantity = Number(body.quantity || 0);
        movementQuantity = Number(body.quantity || 0) - Number(item.quantity_on_hand || 0);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid adjustment type' },
          { status: 400 }
        );
    }

    const movementAndItem = await db.transaction(async (tx) => {
      const movementResult = await tx.query(
        `INSERT INTO inventory_movements (
           product_id, movement_type, quantity, unit_cost, notes, created_by
         ) VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          id,
          body.adjustment_type,
          movementQuantity,
          Number(body.unit_cost ?? item.cost_price ?? 0),
          body.notes || null,
          user.id,
        ]
      );

      const updatedItemResult = await tx.query(
        `UPDATE products
         SET quantity_on_hand = $2,
             cost_price = $3,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          id,
          newQuantity,
          body.update_cost ? Number(body.unit_cost ?? item.cost_price ?? 0) : Number(item.cost_price ?? 0),
        ]
      );

      return {
        movement: movementResult.rows[0],
        item: updatedItemResult.rows[0],
      };
    });

    return NextResponse.json({
      data: {
        item: movementAndItem.item,
        movement: movementAndItem.movement,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/inventory/[id]/movements - Get movement history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    const productResult = await db.query('SELECT id, company_id FROM products WHERE id = $1 LIMIT 1', [id]);
    const product = productResult.rows[0];
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, product.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const countResult = await db.query('SELECT COUNT(*)::int AS total FROM inventory_movements WHERE product_id = $1', [id]);

    const rowsResult = await db.query(
      `SELECT *
       FROM inventory_movements
       WHERE product_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    const total = Number(countResult.rows[0]?.total || 0);

    return NextResponse.json({
      data: rowsResult.rows,
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
