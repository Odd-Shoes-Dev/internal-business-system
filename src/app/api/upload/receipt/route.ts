import { NextRequest, NextResponse } from 'next/server';
import { requireSessionUser } from '@/lib/provider/route-guards';
import { getStorageServiceClient } from '@/lib/provider/get-storage-service-client';

const BUCKET = 'receipts';

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

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: PDF, PNG, JPEG, WEBP' }, { status: 400 });
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB' }, { status: 400 });
    }

    const supabase = await getStorageServiceClient();

    // Ensure bucket exists
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b: any) => b.name === BUCKET);
    if (!bucketExists) {
      await supabase.storage.createBucket(BUCKET, { public: true });
    }

    // Build path: receipts/company-id/timestamp-filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const path = `${companyId}/${timestamp}-${sanitizedName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[upload/receipt] Storage error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return NextResponse.json({ url: urlData.publicUrl, path });
  } catch (error: any) {
    console.error('[upload/receipt] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
