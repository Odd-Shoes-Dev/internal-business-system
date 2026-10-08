import { NextRequest, NextResponse } from 'next/server';
import {
  getCompanyIdFromRequest,
  requireCompanyAccess,
  requireCompanyAdmin,
  requireSessionUser,
} from '@/lib/provider/route-guards';
import { getWhatsAppSettingsWithDb, normalizeWhatsAppNumber, sendWhatsAppTemplate } from '@/lib/whatsapp';

// POST /api/companies/whatsapp/test — send the order template to a number with sample values
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();
    const companyId = getCompanyIdFromRequest(request, body);
    if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });

    const accessError = await requireCompanyAccess(user.id, companyId);
    if (accessError) return accessError;
    const adminError = await requireCompanyAdmin(user.id, user.role, companyId, 'Only a company owner or admin can manage WhatsApp');
    if (adminError) return adminError;

    const settings = await getWhatsAppSettingsWithDb(db, companyId);
    if (!settings) return NextResponse.json({ error: 'Save your WhatsApp settings first' }, { status: 400 });

    const to = normalizeWhatsAppNumber(String(body.to || ''), settings.default_country_code);
    if (!to) return NextResponse.json({ error: 'Enter a phone number to send the test to' }, { status: 400 });

    const result = await sendWhatsAppTemplate(settings, to, ['Test Customer', '10,000', 'Test item x1']);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
    return NextResponse.json({ message: `Test message sent to +${to}` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
