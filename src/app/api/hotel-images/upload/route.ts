import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { uploadToImageKit } from '@/lib/imagekit';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const hotelId = formData.get('hotel_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!hotelId) {
      return NextResponse.json({ error: 'hotel_id is required' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image uploads are allowed' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB' }, { status: 400 });
    }

    const hotelResult = await db.query('SELECT id, company_id FROM hotels WHERE id = $1 LIMIT 1', [hotelId]);
    const hotel = hotelResult.rows[0];
    if (!hotel) {
      return NextResponse.json({ error: 'Hotel not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, hotel.company_id);
    if (accessError) return accessError;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');

    const result = await uploadToImageKit(buffer, sanitizedName, `hotel-images/${hotelId}`, file.type);

    return NextResponse.json({ url: result.url, path: result.filePath });
  } catch (error: any) {
    console.error('[hotel-images/upload] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
