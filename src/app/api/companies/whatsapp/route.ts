import { NextRequest, NextResponse } from 'next/server';
import {
  getCompanyIdFromRequest,
  requireCompanyAccess,
  requireCompanyAdmin,
  requireSessionUser,
} from '@/lib/provider/route-guards';
import { encryptSecret, isEncryptionConfigured } from '@/lib/crypto/secret-box';
import { getWhatsAppSettingsWithDb } from '@/lib/whatsapp';

type Authorized =
  | { error: NextResponse }
  | { db: Awaited<ReturnType<typeof requireSessionUser>>['db']; user: { id: string }; companyId: string };

async function authorize(request: NextRequest, body?: Record<string, any>): Promise<Authorized> {
  const { db, user, errorResponse } = await requireSessionUser();
  if (errorResponse || !user) return { error: errorResponse ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const companyId = getCompanyIdFromRequest(request, body);
  if (!companyId) return { error: NextResponse.json({ error: 'company_id is required' }, { status: 400 }) };

  const accessError = await requireCompanyAccess(user.id, companyId);
  if (accessError) return { error: accessError };
  const adminError = await requireCompanyAdmin(user.id, user.role, companyId, 'Only a company owner or admin can manage WhatsApp');
  if (adminError) return { error: adminError };

  return { db, user, companyId };
}

// GET /api/companies/whatsapp?company_id= — settings without the token itself
export async function GET(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if ('error' in auth) return auth.error;

    const settings = await getWhatsAppSettingsWithDb(auth.db, auth.companyId);
    return NextResponse.json({
      data: {
        enabled: settings?.enabled ?? false,
        phone_number_id: settings?.phone_number_id ?? '',
        template_name: settings?.template_name ?? 'order_confirmation',
        template_language: settings?.template_language ?? 'en',
        default_country_code: settings?.default_country_code ?? '256',
        has_access_token: Boolean(settings?.access_token_encrypted),
        encryption_configured: isEncryptionConfigured(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT /api/companies/whatsapp — save settings; send access_token only when changing it
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const auth = await authorize(request, body);
    if ('error' in auth) return auth.error;

    const accessToken = typeof body.access_token === 'string' ? body.access_token.trim() : '';
    if (accessToken && !isEncryptionConfigured()) {
      return NextResponse.json(
        { error: 'The server has no APP_ENCRYPTION_KEY, so the token cannot be stored safely. Ask your administrator to set it.' },
        { status: 400 }
      );
    }

    const templateName = String(body.template_name || 'order_confirmation').trim().slice(0, 100);
    const templateLanguage = String(body.template_language || 'en').trim().slice(0, 10);
    const countryCode = String(body.default_country_code || '256').replace(/\D/g, '').slice(0, 5) || '256';
    const phoneNumberId = String(body.phone_number_id || '').replace(/\D/g, '').slice(0, 64) || null;

    await auth.db.query(
      `INSERT INTO company_whatsapp_settings (
         company_id, enabled, phone_number_id, access_token_encrypted, template_name,
         template_language, default_country_code, updated_by, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (company_id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         phone_number_id = EXCLUDED.phone_number_id,
         access_token_encrypted = COALESCE(EXCLUDED.access_token_encrypted, company_whatsapp_settings.access_token_encrypted),
         template_name = EXCLUDED.template_name,
         template_language = EXCLUDED.template_language,
         default_country_code = EXCLUDED.default_country_code,
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()`,
      [
        auth.companyId,
        body.enabled === true,
        phoneNumberId,
        accessToken ? encryptSecret(accessToken) : null,
        templateName,
        templateLanguage,
        countryCode,
        auth.user.id,
      ]
    );

    return NextResponse.json({ message: 'WhatsApp settings saved' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
