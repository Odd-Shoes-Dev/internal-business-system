import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';
import { uploadToImageKit } from '@/lib/imagekit';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const companyId = formData.get('company_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image size must be less than 2MB' }, { status: 400 });
    }

    // Verify the user belongs to this company
    const profileResult = await db.query(
      'SELECT company_id FROM user_profiles WHERE id = $1 LIMIT 1',
      [user.id]
    );
    if (profileResult.rows[0]?.company_id !== companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');

    const result = await uploadToImageKit(buffer, sanitizedName, `logos/${companyId}`, file.type);

    // Update the company record with the new logo URL
    await db.query(
      'UPDATE companies SET logo_url = $1, updated_at = NOW() WHERE id = $2',
      [result.url, companyId]
    );

    return NextResponse.json({ url: result.url });
  } catch (error: any) {
    console.error('[companies/logo] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
