import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

async function getImageWithCompany(db: any, id: string) {
  const result = await db.query(
    `SELECT hi.*, h.company_id
     FROM hotel_images hi
     INNER JOIN hotels h ON h.id = hi.hotel_id
     WHERE hi.id = $1
     LIMIT 1`,
    [id]
  );

  return result.rows[0] || null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const existing = await getImageWithCompany(db, id);

    if (!existing) {
      return NextResponse.json({ error: 'Hotel image not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const body = await request.json();
    const { image_url, is_primary, display_order, caption } = body;

    if (is_primary === true) {
      await db.query('UPDATE hotel_images SET is_primary = false WHERE hotel_id = $1', [existing.hotel_id]);
    }

    const updateResult = await db.query(
      `UPDATE hotel_images
       SET image_url = COALESCE($2, image_url),
           is_primary = COALESCE($3, is_primary),
           display_order = COALESCE($4, display_order),
           caption = COALESCE($5, caption)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        image_url || null,
        typeof is_primary === 'boolean' ? is_primary : null,
        typeof display_order === 'number' ? display_order : null,
        caption || null,
      ]
    );

    return NextResponse.json({ data: updateResult.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const existing = await getImageWithCompany(db, id);

    if (!existing) {
      return NextResponse.json({ error: 'Hotel image not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    await db.query('DELETE FROM hotel_images WHERE id = $1', [id]);
    return NextResponse.json({ message: 'Hotel image deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
