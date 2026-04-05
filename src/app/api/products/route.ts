import { NextRequest, NextResponse } from 'next/server';
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const where: string[] = ['company_id = $1'];
    const params: any[] = [companyId];

    if (active === 'true' || active === 'false') {
      params.push(active === 'true');
      where.push(`is_active = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      where.push(`(name ILIKE $${params.length} OR sku ILIKE $${params.length})`);
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
