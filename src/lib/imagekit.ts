const UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

export interface ImageKitUploadResult {
  fileId: string;
  name: string;
  url: string;
  filePath: string;
  size: number;
  fileType: string;
}

/**
 * Upload a file to ImageKit using the server-side private key.
 * Files land under: /{IMAGEKIT_APP_FOLDER}/{folder}/{fileName}
 */
export async function uploadToImageKit(
  fileBuffer: Buffer,
  fileName: string,
  folder: string,
  contentType: string,
): Promise<ImageKitUploadResult> {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  const appFolder = process.env.IMAGEKIT_APP_FOLDER || 'internal-business-system';

  if (!privateKey) {
    throw new Error('IMAGEKIT_PRIVATE_KEY is not configured');
  }

  const fullFolder = `/${appFolder}/${folder}`;

  const form = new FormData();
  const blob = new Blob([fileBuffer], { type: contentType });
  form.append('file', blob, fileName);
  form.append('fileName', fileName);
  form.append('folder', fullFolder);
  form.append('useUniqueFileName', 'true');

  const credentials = Buffer.from(`${privateKey}:`).toString('base64');

  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ImageKit upload failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<ImageKitUploadResult>;
}
