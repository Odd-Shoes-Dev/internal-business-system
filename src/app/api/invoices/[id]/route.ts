import { NextRequest, NextResponse } from 'next/server';
import {
  createInvoiceJournalEntryWithDb,
  reduceInventoryForInvoiceWithDb,
  releaseReservedInventoryWithDb,
  restoreInventoryForInvoiceWithDb,
} from '@/lib/accounting/provider-accounting';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/invoices/[id] - Get single invoice with lines
export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  const resolvedParams = await params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const invoiceResult = await db.query<any>(
      `SELECT i.*, c.id AS customer_ref_id, c.name AS customer_name, c.email AS customer_email,
              c.phone AS customer_phone, c.address_line1 AS customer_address_line1,
              c.address_line2 AS customer_address_line2, c.city AS customer_city,
              c.state AS customer_state, c.zip_code AS customer_zip_code
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.id = $1
       LIMIT 1`,
      [resolvedParams.id]
    );

    const invoice = invoiceResult.rows[0];
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, invoice.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const linesResult = await db.query<any>(
      `SELECT il.*, p.id AS product_ref_id, p.name AS product_name, p.sku AS product_sku
       FROM invoice_lines il
       LEFT JOIN products p ON p.id = il.product_id
       WHERE il.invoice_id = $1
       ORDER BY il.line_number ASC`,
      [resolvedParams.id]
    );

    const paymentsResult = await db.query<any>(
      `SELECT pa.amount_applied,
              pr.id AS payment_id,
              pr.payment_date,
              pr.amount,
              pr.payment_method,
              pr.reference_number,
              pr.notes
       FROM payment_applications pa
       LEFT JOIN payments_received pr ON pr.id = pa.payment_id
       WHERE pa.invoice_id = $1
       ORDER BY pr.payment_date DESC`,
      [resolvedParams.id]
    );

    return NextResponse.json({
      data: {
        ...invoice,
        customers: invoice.customer_ref_id
          ? {
              id: invoice.customer_ref_id,
              name: invoice.customer_name,
              email: invoice.customer_email,
              phone: invoice.customer_phone,
              address_line1: invoice.customer_address_line1,
              address_line2: invoice.customer_address_line2,
              city: invoice.customer_city,
              state: invoice.customer_state,
              zip_code: invoice.customer_zip_code,
            }
          : null,
        invoice_lines: linesResult.rows.map((line) => ({
          ...line,
          products: line.product_ref_id
            ? {
                id: line.product_ref_id,
                name: line.product_name,
                sku: line.product_sku,
              }
            : null,
        })),
        payments: paymentsResult.rows.map((payment) => ({
          amount_applied: payment.amount_applied,
          payments_received: payment.payment_id
            ? {
                id: payment.payment_id,
                payment_date: payment.payment_date,
                amount: payment.amount,
                payment_method: payment.payment_method,
                reference_number: payment.reference_number,
                notes: payment.notes,
              }
            : null,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH /api/invoices/[id] - Update invoice
export async function PATCH(request: NextRequest, context: any) {
  const { params } = context || {};
  const resolvedParams = await params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    const existingResult = await db.query<any>('SELECT * FROM invoices WHERE id = $1 LIMIT 1', [
      resolvedParams.id,
    ]);
    const existing = existingResult.rows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const existingLinesResult = await db.query<any>(
      'SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY line_number ASC',
      [resolvedParams.id]
    );
    const existingLines = existingLinesResult.rows;

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Prevent editing paid/void invoices
    if (['paid', 'void'].includes(existing.status)) {
      return NextResponse.json(
        { error: 'Cannot edit paid or voided invoices' },
        { status: 400 }
      );
    }

    // Handle status change inventory implications
    const oldStatus = existing.status;
    const newStatus = body.status || existing.status;
    const documentType = existing.document_type || 'invoice';
    const invoice = await db.transaction(async (tx) => {
      const updateData: any = {};
      const allowedFields = [
        'customer_id',
        'invoice_date',
        'due_date',
        'payment_terms',
        'po_number',
        'notes',
        'status',
        'booking_id',
      ];

      allowedFields.forEach((field) => {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      });

      let currentInvoice = existing;
      const fields = Object.keys(updateData);
      if (fields.length > 0) {
        const setSql = fields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');
        const values = fields.map((field) => updateData[field]);

        const invoiceUpdate = await tx.query<any>(
          `UPDATE invoices
           SET ${setSql}, updated_at = NOW()
           WHERE id = $${values.length + 1}
           RETURNING *`,
          [...values, resolvedParams.id]
        );

        currentInvoice = invoiceUpdate.rows[0];
      }

      if (
        (documentType === 'quotation' || documentType === 'proforma') &&
        newStatus === 'posted' &&
        oldStatus === 'draft'
      ) {
        const releaseResult = await releaseReservedInventoryWithDb(tx, existingLines);
        if (!releaseResult.success) {
          throw new Error(releaseResult.error || 'Failed to release reserved inventory');
        }

        const inventoryResult = await reduceInventoryForInvoiceWithDb(
          tx,
          resolvedParams.id,
          existingLines,
          user.id
        );

        if (!inventoryResult.success) {
          throw new Error(inventoryResult.error || 'Insufficient inventory');
        }
      } else if (
        documentType === 'invoice' &&
        (newStatus === 'sent' || newStatus === 'posted') &&
        oldStatus === 'draft'
      ) {
        const inventoryResult = await reduceInventoryForInvoiceWithDb(
          tx,
          resolvedParams.id,
          existingLines,
          user.id
        );

        if (!inventoryResult.success) {
          throw new Error(inventoryResult.error || 'Insufficient inventory');
        }
      }

      if (
        (newStatus === 'paid' || newStatus === 'partial') &&
        oldStatus !== 'paid' &&
        oldStatus !== 'partial' &&
        !currentInvoice.journal_entry_id &&
        documentType === 'invoice'
      ) {
        const journalResult = await createInvoiceJournalEntryWithDb(
          tx,
          {
            id: currentInvoice.id,
            invoice_number: currentInvoice.invoice_number,
            invoice_date: currentInvoice.invoice_date,
            total: Number(currentInvoice.total),
          },
          user.id
        );

        if (!journalResult.success) {
          throw new Error(journalResult.error || 'Failed to create journal entry');
        }

        if (journalResult.journalEntryId) {
          const invoiceWithJournal = await tx.query<any>(
            'UPDATE invoices SET journal_entry_id = $2 WHERE id = $1 RETURNING *',
            [resolvedParams.id, journalResult.journalEntryId]
          );
          currentInvoice = invoiceWithJournal.rows[0];
        }
      }

      if (body.lines) {
        await tx.query('DELETE FROM invoice_lines WHERE invoice_id = $1', [resolvedParams.id]);

        let subtotal = 0;
        let taxAmount = 0;
        let discountAmount = 0;

        const invoiceLines = body.lines.map((line: any, index: number) => {
        const lineSubtotal = line.quantity * line.unit_price;
        const lineDiscount = lineSubtotal * ((line.discount_percent || 0) / 100);
        const lineNet = lineSubtotal - lineDiscount;
        const lineTax = lineNet * (line.tax_rate || 0);

        subtotal += lineNet;
        taxAmount += lineTax;
        discountAmount += lineDiscount;

          return {
            invoice_id: resolvedParams.id,
            line_number: index + 1,
            product_id: line.product_id || null,
            description: line.description,
            quantity: line.quantity,
            unit_price: line.unit_price,
            discount_percent: line.discount_percent || 0,
            discount_amount: lineDiscount,
            tax_rate: line.tax_rate || 0,
            tax_amount: lineTax,
            line_total: lineNet + lineTax,
          };
        });

        for (const line of invoiceLines) {
          await tx.query(
            `INSERT INTO invoice_lines (
               invoice_id, line_number, product_id, description, quantity,
               unit_price, discount_percent, discount_amount, tax_rate, tax_amount, line_total
             ) VALUES (
               $1, $2, $3, $4, $5,
               $6, $7, $8, $9, $10, $11
             )`,
            [
              line.invoice_id,
              line.line_number,
              line.product_id,
              line.description,
              line.quantity,
              line.unit_price,
              line.discount_percent,
              line.discount_amount,
              line.tax_rate,
              line.tax_amount,
              line.line_total,
            ]
          );
        }

        const total = subtotal + taxAmount;
        const totalsUpdate = await tx.query<any>(
          `UPDATE invoices
           SET subtotal = $2,
               tax_amount = $3,
               discount_amount = $4,
               total = $5,
               updated_at = NOW()
           WHERE id = $1
           RETURNING *`,
          [resolvedParams.id, subtotal, taxAmount, discountAmount, total]
        );

        currentInvoice = totalsUpdate.rows[0];
      }

      return currentInvoice;
    });

    if (
      (newStatus === 'paid' || newStatus === 'partial') &&
      oldStatus !== 'paid' &&
      oldStatus !== 'partial' &&
      invoice.booking_id
    ) {
      const updatedInvoice =
        newStatus === 'paid'
          ? (
              await db.query<any>(
                'UPDATE invoices SET amount_paid = total, updated_at = NOW() WHERE id = $1 RETURNING *',
                [resolvedParams.id]
              )
            ).rows[0]
          : invoice;

      const newAmountPaid = Number(newStatus === 'paid' ? updatedInvoice.total : updatedInvoice.amount_paid || 0);

      const allBookingInvoices = await db.query<any>(
        'SELECT id, total, amount_paid, currency FROM invoices WHERE booking_id = $1',
        [invoice.booking_id]
      );

      const bookingResult = await db.query<any>(
        'SELECT total, status, currency FROM bookings WHERE id = $1 LIMIT 1',
        [invoice.booking_id]
      );
      const booking = bookingResult.rows[0];

      if (booking) {
        let totalPaidAcrossInvoices = 0;

        for (const inv of allBookingInvoices.rows) {
          const invAmountPaid =
            inv.id === updatedInvoice.id ? newAmountPaid : Number(inv.amount_paid || 0);

          if (inv.currency === booking.currency) {
            totalPaidAcrossInvoices += invAmountPaid;
          } else {
            const convertedAmount = await db.query<{ converted: number | null }>(
              'SELECT convert_currency($1, $2, $3, $4::date) AS converted',
              [invAmountPaid, inv.currency, booking.currency, new Date().toISOString().split('T')[0]]
            );

            totalPaidAcrossInvoices += convertedAmount.rows[0]?.converted ?? invAmountPaid;
          }
        }

        let newBookingStatus = booking.status;
        const bookingTotal = Number(booking.total || 0);

        if (totalPaidAcrossInvoices >= bookingTotal) {
          newBookingStatus = 'fully_paid';
        } else if (totalPaidAcrossInvoices > 0) {
          if (!['fully_paid', 'completed'].includes(booking.status)) {
            newBookingStatus = 'deposit_paid';
          }
        }

        await db.query(
          'UPDATE bookings SET amount_paid = $2, status = $3 WHERE id = $1',
          [invoice.booking_id, totalPaidAcrossInvoices, newBookingStatus]
        );
      }
    }

    return NextResponse.json({ data: invoice });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/invoices/[id] - Delete or void invoice
export async function DELETE(request: NextRequest, context: any) {
  const { params } = context || {};
  const resolvedParams = await params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'void';

    const existingResult = await db.query<any>('SELECT * FROM invoices WHERE id = $1 LIMIT 1', [
      resolvedParams.id,
    ]);
    const existing = existingResult.rows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const existingLinesResult = await db.query<any>(
      'SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY line_number ASC',
      [resolvedParams.id]
    );
    const existingLines = existingLinesResult.rows;

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (existing.status === 'void') {
      return NextResponse.json({ error: 'Invoice is already voided' }, { status: 400 });
    }

    if (action === 'delete') {
      // Only allow delete for drafts with no payments
      if (existing.status !== 'draft' || existing.amount_paid > 0) {
        return NextResponse.json(
          { error: 'Can only delete draft invoices with no payments' },
          { status: 400 }
        );
      }

      if (existing.document_type === 'quotation' || existing.document_type === 'proforma') {
        await releaseReservedInventoryWithDb(db, existingLines);
      }

      await db.transaction(async (tx) => {
        await tx.query('DELETE FROM invoice_lines WHERE invoice_id = $1', [resolvedParams.id]);
        await tx.query('DELETE FROM invoices WHERE id = $1', [resolvedParams.id]);
      });

      return NextResponse.json({ message: 'Invoice deleted' });
    } else {
      if (existing.status === 'posted' || existing.status === 'sent') {
        if (existing.document_type === 'invoice') {
          await restoreInventoryForInvoiceWithDb(db, resolvedParams.id, existingLines, user.id);
        }
      }

      const dataResult = await db.query<any>(
        'UPDATE invoices SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
        [resolvedParams.id, 'void']
      );

      return NextResponse.json({ data: dataResult.rows[0], message: 'Invoice voided' });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
