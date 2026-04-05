import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { from_location_id, to_location_id, transfer_date, notes, lines } = await request.json();

    if (!from_location_id || !to_location_id || !lines || lines.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Ensure all products belong to one company and user can access it.
    const productIds = Array.from(new Set(lines.map((line: any) => line.product_id).filter(Boolean)));
    const productsResult = await db.query(
      `SELECT id, company_id
       FROM products
       WHERE id = ANY($1::uuid[])`,
      [productIds]
    );

    if (productsResult.rows.length !== productIds.length) {
      return NextResponse.json({ error: 'One or more products were not found' }, { status: 404 });
    }

    const companyIds = Array.from(new Set(productsResult.rows.map((row: any) => row.company_id).filter(Boolean)));
    if (companyIds.length !== 1) {
      return NextResponse.json(
        { error: 'Transfer lines must belong to products from a single company' },
        { status: 400 }
      );
    }

    const companyId = companyIds[0] as string;
    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Generate transfer number
    const lastTransferResult = await db.query(
      `SELECT transfer_number
       FROM inventory_transfers
       WHERE transfer_number LIKE 'TR-%'
       ORDER BY created_at DESC
       LIMIT 1`
    );
    const lastTransfer = lastTransferResult.rows[0] as any;

    let nextNumber = 1;
    if (lastTransfer?.transfer_number) {
      const match = lastTransfer.transfer_number.match(/TR-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    // Current schema stores one product per transfer record.
    const createdTransfers = await db.transaction(async (tx) => {
      const results: any[] = [];
      let seq = nextNumber;

      for (const line of lines) {
        if (!line.product_id || Number(line.quantity) <= 0) {
          throw new Error('Each line must include product_id and quantity > 0');
        }

        const transferNumber = `TR-${seq.toString().padStart(4, '0')}`;
        const insertResult = await tx.query(
          `INSERT INTO inventory_transfers (
             transfer_number,
             product_id,
             from_location_id,
             to_location_id,
             quantity,
             transfer_date,
             status,
             requested_by,
             notes,
             created_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6::date, 'pending', $7, $8, NOW()
           )
           RETURNING *`,
          [
            transferNumber,
            line.product_id,
            from_location_id,
            to_location_id,
            Number(line.quantity),
            transfer_date,
            user.id,
            notes || null,
          ]
        );
        results.push(insertResult.rows[0]);
        seq += 1;
      }

      return results;
    });

    return NextResponse.json({
      created: createdTransfers.length,
      transfers: createdTransfers,
    });
  } catch (error: any) {
    console.error('Error creating transfer:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
