import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/proformas/[id]/convert - Convert proforma to invoice
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    // Get the proforma
    const proformaResult = await db.query(
      `SELECT *
       FROM invoices
       WHERE id = $1
         AND document_type = 'proforma'
       LIMIT 1`,
      [params.id]
    );
    const proforma = proformaResult.rows[0];

    if (!proforma) {
      return NextResponse.json({ error: 'Proforma invoice not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, proforma.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Check if already converted
    if (proforma.status === 'converted' || proforma.status === 'posted') {
      return NextResponse.json({ error: 'Proforma already converted' }, { status: 400 });
    }

    // Generate new invoice number
    const invoiceNumberResult = await db.query('SELECT generate_invoice_number() AS invoice_number');
    const invoiceNumber = invoiceNumberResult.rows[0]?.invoice_number;

    // Update the proforma to invoice
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

    // Mark original proforma as converted
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
      message: 'Proforma invoice converted successfully',
    });
  } catch (error: any) {
    console.error('Convert proforma error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
