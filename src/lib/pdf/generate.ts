/**
 * Server-side HTML → PDF conversion using Puppeteer.
 * Returns a Buffer containing the PDF bytes, or null if generation fails.
 */
export async function generatePDFFromHTML(html: string): Promise<Buffer | null> {
  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });

    await browser.close();
    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('PDF generation failed:', error);
    return null;
  }
}
