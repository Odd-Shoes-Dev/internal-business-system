import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/depreciation/history - Get depreciation posting history
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

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const dataResult = await db.query(
      `SELECT dp.*,
              json_build_object('id', je.id, 'entry_number', je.entry_number) AS journal_entry,
              json_build_object('id', up.id, 'full_name', up.full_name, 'email', up.email) AS posted_by_user
       FROM depreciation_postings dp
       INNER JOIN journal_entries je ON je.id = dp.journal_entry_id
       LEFT JOIN user_profiles up ON up.id = dp.posted_by
       WHERE je.company_id = $1
       ORDER BY dp.posting_date DESC
       LIMIT $2 OFFSET $3`,
      [companyId, limit, offset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM depreciation_postings dp
       INNER JOIN journal_entries je ON je.id = dp.journal_entry_id
       WHERE je.company_id = $1`,
      [companyId]
    );

    const count = countResult.rows[0]?.total || 0;

    return NextResponse.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
