import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

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
    const isActive = searchParams.get('is_active');

    const params: any[] = [companyId];
    const where: string[] = ['company_id = $1'];

    if (isActive === 'true' || isActive === 'false') {
      params.push(isActive === 'true');
      where.push(`is_active = $${params.length}`);
    }

    const result = await db.query(
      `SELECT *
       FROM destinations
       WHERE ${where.join(' AND ')}
       ORDER BY name ASC`,
      params
    );

    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
