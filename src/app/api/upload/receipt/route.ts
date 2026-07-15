import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';
import { uploadToImageKit } from '@/lib/imagekit';

export async function POST(request: NextRequest) {
  try {
    const { user, errorResponse } = await requireSessionUser();
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

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: PDF, PNG, JPEG, WEBP' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');

    const result = await uploadToImageKit(buffer, sanitizedName, `receipts/${companyId}`, file.type);

    return NextResponse.json({ url: result.url, path: result.filePath });
  } catch (error: any) {
    console.error('[upload/receipt] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
