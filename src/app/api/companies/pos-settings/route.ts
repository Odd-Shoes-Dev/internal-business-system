import { NextRequest, NextResponse } from 'next/server';
import {
  getCompanyIdFromRequest,
  requireCompanyAccess,
  requireCompanyAdmin,
  requireSessionUser,
} from '@/lib/provider/route-guards';
import { parsePosSettings } from '@/lib/pos/settings';
import { getPosSettingsWithDb, savePosSettingsWithDb } from '@/lib/pos/settings-db';

// GET /api/companies/pos-settings?company_id= — receipt text and loyalty rules for the till
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });

    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;

    return NextResponse.json({ data: await getPosSettingsWithDb(db, companyId) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/companies/pos-settings — admins only
export async function PUT(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();
    const companyId = getCompanyIdFromRequest(request, body);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });

    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;
    const adminError = await requireCompanyAdmin(user.id, user.role, companyId, 'Only a company owner or admin can change POS settings');
    if (adminError) return adminError;

    const settings = parsePosSettings(body.settings);
    await savePosSettingsWithDb(db, companyId, settings);
    return NextResponse.json({ data: settings });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
