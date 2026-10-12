import { NextRequest, NextResponse } from 'next/server';
import {
  getCompanyIdFromRequest,
  requireCompanyAccess,
  requireCompanyAdmin,
  requireSessionUser,
} from '@/lib/provider/route-guards';
import { adjustmentApprovalRequiredWithDb } from '@/lib/inventory/adjustments';

// GET /api/companies/inventory-settings?company_id=
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;
    return NextResponse.json({ data: { require_adjustment_approval: await adjustmentApprovalRequiredWithDb(db, companyId) } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/companies/inventory-settings — { company_id, require_adjustment_approval } (admins)
export async function PUT(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;
    const body = await request.json();
    const companyId = getCompanyIdFromRequest(request, body);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;
    const adminError = await requireCompanyAdmin(user.id, user.role, companyId, 'Only a company owner or admin can change this');
    if (adminError) return adminError;

    await db.query(
      `UPDATE companies
       SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{inventory}',
                                COALESCE(settings -> 'inventory', '{}'::jsonb) || jsonb_build_object('require_adjustment_approval', $2::boolean), true),
           updated_at = NOW()
       WHERE id = $1`,
      [companyId, body.require_adjustment_approval !== false]
    );
    return NextResponse.json({ data: { require_adjustment_approval: body.require_adjustment_approval !== false } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
