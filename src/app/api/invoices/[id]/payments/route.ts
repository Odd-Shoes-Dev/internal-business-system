import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/invoices/[id]/payments - Record payment
export async function POST(request: NextRequest, context: any) {
  const { params } = context || {};
  const resolvedParams = await params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    // Validate required fields
    if (!body.amount || !body.payment_date || !body.payment_method) {
      return NextResponse.json(
        { error: 'Missing required fields: amount, payment_date, payment_method' },
        { status: 400 }
      );
    }

    // Get invoice
    const invoiceResult = await db.query<{
      id: string;
      total: number;
      amount_paid: number;
      status: string;
      booking_id: string | null;
      company_id: string;
    }>(
      'SELECT id, total, amount_paid, status, booking_id, company_id FROM invoices WHERE id = $1 LIMIT 1',
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

    if (invoice.status === 'void') {
      return NextResponse.json({ error: 'Cannot record payment on voided invoice' }, { status: 400 });
    }

    const balance = invoice.total - invoice.amount_paid;
    if (body.amount > balance) {
      return NextResponse.json(
        { error: `Payment amount exceeds balance due ($${balance.toFixed(2)})` },
        { status: 400 }
      );
    }

    const outcome = await db.transaction(async (tx) => {
      const paymentInsert = await tx.query<any>(
        `INSERT INTO invoice_payments (
           invoice_id, payment_date, amount, payment_method, reference,
           notes, bank_account_id, created_by
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8
         )
         RETURNING *`,
        [
          resolvedParams.id,
          body.payment_date,
          body.amount,
          body.payment_method,
          body.reference || null,
          body.notes || null,
          body.bank_account_id || null,
          user.id,
        ]
      );

      const payment = paymentInsert.rows[0];
      const newAmountPaid = Number(invoice.amount_paid || 0) + Number(body.amount || 0);
      const newStatus = newAmountPaid >= Number(invoice.total || 0) ? 'paid' : 'partial';

      await tx.query(
        'UPDATE invoices SET amount_paid = $2, status = $3, updated_at = NOW() WHERE id = $1',
        [resolvedParams.id, newAmountPaid, newStatus]
      );

      const arAccount = await tx.query<{ id: string }>('SELECT id FROM accounts WHERE code = $1 LIMIT 1', [
        '1200',
      ]);
      const cashAccount = await tx.query<{ id: string }>('SELECT id FROM accounts WHERE code = $1 LIMIT 1', [
        '1000',
      ]);

      if (arAccount.rowCount && cashAccount.rowCount) {
        const entryNumber = await tx.query<{ entry_number: string }>(
          'SELECT generate_journal_entry_number() AS entry_number'
        );

        const journalEntry = await tx.query<{ id: string }>(
          `INSERT INTO journal_entries (
             entry_number, entry_date, description, source_module, source_document_id, status, created_by
           ) VALUES ($1, $2, $3, 'invoice_payment', $4, 'posted', $5)
           RETURNING id`,
          [
            entryNumber.rows[0]?.entry_number,
            body.payment_date,
            `Payment received - ${body.payment_method}`,
            payment.id,
            user.id,
          ]
        );

        const journalEntryId = journalEntry.rows[0]?.id;
        if (journalEntryId) {
          await tx.query(
            `INSERT INTO journal_lines (
               journal_entry_id, line_number, account_id, debit, credit, description
             ) VALUES ($1, 1, $2, $3, 0, $4)`,
            [journalEntryId, cashAccount.rows[0].id, body.amount, 'Payment received']
          );

          await tx.query(
            `INSERT INTO journal_lines (
               journal_entry_id, line_number, account_id, debit, credit, description
             ) VALUES ($1, 2, $2, 0, $3, $4)`,
            [journalEntryId, arAccount.rows[0].id, body.amount, 'AR reduction']
          );
        }
      }

      return { payment, newAmountPaid, newStatus };
    });

    // Sync payment to related booking if exists
    if (invoice.booking_id) {
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
          const invAmountPaid = Number(inv.amount_paid || 0);
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

        await db.query('UPDATE bookings SET amount_paid = $2, status = $3 WHERE id = $1', [
          invoice.booking_id,
          totalPaidAcrossInvoices,
          newBookingStatus,
        ]);
      }
    }

    return NextResponse.json({
      data: outcome.payment,
      invoice: {
        amount_paid: outcome.newAmountPaid,
        status: outcome.newStatus,
        balance: Number(invoice.total || 0) - outcome.newAmountPaid,
      },
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/invoices/[id]/payments - List payments
export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  const resolvedParams = await params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const invoiceResult = await db.query<{ company_id: string }>(
      'SELECT company_id FROM invoices WHERE id = $1 LIMIT 1',
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

    const payments = await db.query<any>(
      `SELECT ip.*, ba.name AS bank_account_name
       FROM invoice_payments ip
       LEFT JOIN bank_accounts ba ON ba.id = ip.bank_account_id
       WHERE ip.invoice_id = $1
       ORDER BY ip.payment_date DESC`,
      [resolvedParams.id]
    );

    const data = payments.rows.map((row) => ({
      ...row,
      bank_accounts: row.bank_account_name ? { name: row.bank_account_name } : null,
    }));

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
