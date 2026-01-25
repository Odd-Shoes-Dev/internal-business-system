-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view company logos (public bucket)
CREATE POLICY "Public Access for Company Logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-logos');

-- Policy: Authenticated users can upload logos for their company
CREATE POLICY "Company Members Can Upload Logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos' AND
  -- Extract company_id from path (format: company-id-timestamp.ext)
  (storage.foldername(name))[1] IN (
    SELECT company_id::text 
    FROM user_companies 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Company members can update their logos
CREATE POLICY "Company Members Can Update Logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text 
    FROM user_companies 
    WHERE user_id = auth.uid()
  )
);

-- Policy: Company members can delete their logos
CREATE POLICY "Company Members Can Delete Logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text 
    FROM user_companies 
    WHERE user_id = auth.uid()
  )
);
