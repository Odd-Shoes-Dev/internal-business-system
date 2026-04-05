import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/quotations/[id]/convert - Convert quotation to invoice
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    // Get the quotation
    const quotationResult = await db.query(
      `SELECT *
       FROM invoices
       WHERE id = $1
         AND document_type = 'quotation'
       LIMIT 1`,
      [params.id]
    );
    const quotation = quotationResult.rows[0];

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, quotation.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const linesResult = await db.query(
      `SELECT id, product_id, quantity, description
       FROM invoice_lines
       WHERE invoice_id = $1`,
      [params.id]
    );
    const invoiceLines = linesResult.rows;

    // Check if already converted
    if (quotation.status === 'converted' || quotation.status === 'posted') {
      return NextResponse.json({ error: 'Quotation already converted' }, { status: 400 });
    }

    // Generate new invoice number
    const invoiceNumberResult = await db.query('SELECT generate_invoice_number() AS invoice_number');
    const invoiceNumber = invoiceNumberResult.rows[0]?.invoice_number;

    // Update the quotation to invoice
    const updatedResult = await db.query(
      `UPDATE invoices
       SET document_type = 'invoice',
           invoice_number = $2,
           status = 'draft',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [params.id, invoiceNumber]
    );
    const updatedInvoice = updatedResult.rows[0];

    // Release reserved inventory (quotations have reserved stock)
    for (const line of invoiceLines) {
      if (!line.product_id) {
        continue;
      }

      const productResult = await db.query('SELECT quantity_reserved FROM products WHERE id = $1 LIMIT 1', [line.product_id]);
      const product = productResult.rows[0];
      if (!product) {
        continue;
      }

      const updatedReserved = Math.max(0, Number(product.quantity_reserved || 0) - Number(line.quantity || 0));
      await db.query('UPDATE products SET quantity_reserved = $2, updated_at = NOW() WHERE id = $1', [line.product_id, updatedReserved]);
    }

    // Mark original quotation status
    await db.query(
      `UPDATE invoices
       SET status = 'converted',
           updated_at = NOW()
       WHERE id = $1`,
      [params.id]
    );

    return NextResponse.json({
      success: true,
      invoice: updatedInvoice,
      message: 'Quotation converted to invoice successfully',
    });
  } catch (error: any) {
    console.error('Convert quotation error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
