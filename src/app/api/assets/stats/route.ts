import { NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';

export async function GET() {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const userCompany = await db.query<{ company_id: string }>(
      `SELECT company_id
       FROM user_companies
       WHERE user_id = $1
       ORDER BY is_primary DESC, joined_at ASC
       LIMIT 1`,
      [user.id]
    );

    if (!userCompany.rowCount) {
      return NextResponse.json({
        totalAssets: 0,
        totalCost: 0,
        totalBookValue: 0,
        totalDepreciation: 0,
      });
    }

    const companyId = userCompany.rows[0].company_id;
    const data = await db.query<{
      purchase_price: number;
      accumulated_depreciation: number;
      book_value: number;
    }>(
      `SELECT purchase_price, accumulated_depreciation, book_value
       FROM fixed_assets
       WHERE company_id = $1
         AND status = 'active'`,
      [companyId]
    );

    if (!data.rows || data.rows.length === 0) {
      return NextResponse.json({
        totalAssets: 0,
        totalCost: 0,
        totalBookValue: 0,
        totalDepreciation: 0,
      });
    }

    const totalAssets = data.rows.length;
    const totalCost = data.rows.reduce((sum, asset) => sum + Number(asset.purchase_price || 0), 0);
    const totalDepreciation = data.rows.reduce((sum, asset) => sum + Number(asset.accumulated_depreciation || 0), 0);
    const totalBookValue = data.rows.reduce((sum, asset) => sum + Number(asset.book_value || 0), 0);

    return NextResponse.json({
      totalAssets,
      totalCost,
      totalBookValue,
      totalDepreciation,
    });
  } catch (error) {
    console.error('Error calculating assets stats:', error);
    return NextResponse.json({ error: 'Failed to calculate assets stats' }, { status: 500 });
  }
}
