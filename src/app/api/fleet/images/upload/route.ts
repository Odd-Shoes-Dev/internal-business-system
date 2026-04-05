import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/get-service-client';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

export const runtime = 'nodejs';

function getExtension(fileName: string, contentType: string) {
  const extFromName = fileName.split('.').pop()?.toLowerCase();
  if (extFromName) return extFromName;

  if (contentType === 'image/jpeg') return 'jpg';
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  if (contentType === 'image/gif') return 'gif';
  return 'bin';
}

function parseBase64Data(dataBase64: string) {
  const payload = dataBase64.includes(',') ? dataBase64.split(',')[1] : dataBase64;
  return Buffer.from(payload, 'base64');
}

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) return errorResponse!;

    const body = await request.json();
    const vehicleId = body.vehicle_id as string | undefined;
    const fileName = (body.file_name as string | undefined) || 'image';
    const contentType = (body.content_type as string | undefined) || '';
    const dataBase64 = body.data_base64 as string | undefined;

    if (!vehicleId) {
      return NextResponse.json({ error: 'vehicle_id is required' }, { status: 400 });
    }

    if (!dataBase64) {
      return NextResponse.json({ error: 'data_base64 is required' }, { status: 400 });
    }

    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image uploads are allowed' }, { status: 400 });
    }

    const vehicleResult = await db.query('SELECT id, company_id FROM vehicles WHERE id = $1 LIMIT 1', [vehicleId]);
    const vehicle = vehicleResult.rows[0];
    if (!vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    const accessError = await requireCompanyAccess(user.id, vehicle.company_id);
    if (accessError) return accessError;

    const fileBuffer = parseBase64Data(dataBase64);
    const maxBytes = 5 * 1024 * 1024;
    if (fileBuffer.length > maxBytes) {
      return NextResponse.json({ error: 'File is too large (max 5MB)' }, { status: 400 });
    }

    const extension = getExtension(fileName, contentType);
    const objectPath = `vehicles/${vehicleId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

    const serviceClient = await getServiceClient();
    const { error: uploadError } = await serviceClient.storage
      .from('fleet-images')
      .upload(objectPath, fileBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = serviceClient.storage.from('fleet-images').getPublicUrl(objectPath);

    return NextResponse.json({ data: { path: objectPath, public_url: publicUrl } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
