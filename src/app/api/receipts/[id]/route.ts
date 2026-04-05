import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/receipts/[id] - Get payment details
export async function GET(request: NextRequest, context: any) {
  const { params } = context || {};
  const resolvedParams = await params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const payment = await db.query<any>(
      `SELECT pr.*, c.id AS customer_ref_id, c.name AS customer_name, c.email AS customer_email,
              c.phone AS customer_phone, c.address_line1 AS customer_address_line1,
              c.city AS customer_city, c.state AS customer_state, c.zip_code AS customer_zip_code,
              a.id AS account_ref_id, a.name AS account_name, a.code AS account_code, a.account_type AS account_type,
              je.id AS journal_ref_id, je.entry_number AS journal_entry_number, je.entry_date AS journal_entry_date
       FROM payments_received pr
       LEFT JOIN customers c ON c.id = pr.customer_id
       LEFT JOIN accounts a ON a.id = pr.deposit_to_account_id
       LEFT JOIN journal_entries je ON je.id = pr.journal_entry_id
       WHERE pr.id = $1
       LIMIT 1`,
      [resolvedParams.id]
    );

    const data = payment.rows[0];

    if (!data) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, data.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const applications = await db.query<any>(
      `SELECT pa.id,
              pa.amount_applied,
              i.id AS invoice_ref_id,
              i.invoice_number,
              i.invoice_date,
              i.total AS invoice_total,
              i.amount_paid AS invoice_amount_paid,
              i.status AS invoice_status
       FROM payment_applications pa
       LEFT JOIN invoices i ON i.id = pa.invoice_id
       WHERE pa.payment_id = $1
       ORDER BY pa.created_at DESC`,
      [resolvedParams.id]
    );

    return NextResponse.json({
      data: {
        ...data,
        customer: data.customer_ref_id
          ? {
              id: data.customer_ref_id,
              name: data.customer_name,
              email: data.customer_email,
              phone: data.customer_phone,
              address_line1: data.customer_address_line1,
              city: data.customer_city,
              state: data.customer_state,
              zip_code: data.customer_zip_code,
            }
          : null,
        deposit_account: data.account_ref_id
          ? {
              id: data.account_ref_id,
              name: data.account_name,
              code: data.account_code,
              account_type: data.account_type,
            }
          : null,
        journal_entry: data.journal_ref_id
          ? {
              id: data.journal_ref_id,
              entry_number: data.journal_entry_number,
              entry_date: data.journal_entry_date,
            }
          : null,
        payment_applications: applications.rows.map((app) => ({
          id: app.id,
          amount_applied: app.amount_applied,
          invoice: app.invoice_ref_id
            ? {
                id: app.invoice_ref_id,
                invoice_number: app.invoice_number,
                invoice_date: app.invoice_date,
                total: app.invoice_total,
                amount_paid: app.invoice_amount_paid,
                status: app.invoice_status,
              }
            : null,
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/receipts/[id] - Void payment
export async function DELETE(request: NextRequest, context: any) {
  const { params } = context || {};
  const resolvedParams = await params;
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const paymentResult = await db.query<any>(
      'SELECT * FROM payments_received WHERE id = $1 LIMIT 1',
      [resolvedParams.id]
    );
    const payment = paymentResult.rows[0];

    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, payment.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    await db.transaction(async (tx) => {
      const applications = await tx.query<any>(
        'SELECT id, invoice_id, amount_applied FROM payment_applications WHERE payment_id = $1',
        [resolvedParams.id]
      );

      for (const app of applications.rows) {
        const invoiceResult = await tx.query<{ amount_paid: number; total: number; status: string }>(
          'SELECT amount_paid, total, status FROM invoices WHERE id = $1 LIMIT 1',
          [app.invoice_id]
        );
        const invoice = invoiceResult.rows[0];

        if (invoice) {
          const newAmountPaid = Math.max(0, Number(invoice.amount_paid || 0) - Number(app.amount_applied || 0));
          let newStatus = invoice.status;

          if (newAmountPaid === 0) {
            newStatus = 'sent';
          } else if (newAmountPaid < Number(invoice.total || 0)) {
            newStatus = 'partial';
          }

          await tx.query(
            'UPDATE invoices SET amount_paid = $2, status = $3, updated_at = NOW() WHERE id = $1',
            [app.invoice_id, newAmountPaid, newStatus]
          );
        }
      }

      await tx.query('DELETE FROM payment_applications WHERE payment_id = $1', [resolvedParams.id]);

      // Create reversing journal entry
      if (payment.journal_entry_id) {
        const entryNumber = await tx.query<{ entry_number: string }>(
          'SELECT generate_journal_entry_number() AS entry_number'
        );
        const entryNumberValue = entryNumber.rows[0]?.entry_number;

        const originalLines = await tx.query<any>(
          'SELECT * FROM journal_lines WHERE journal_entry_id = $1 ORDER BY line_number ASC',
          [payment.journal_entry_id]
        );

        if (entryNumberValue && originalLines.rows.length > 0) {
          const reversingEntry = await tx.query<{ id: string }>(
            `INSERT INTO journal_entries (
               entry_number, entry_date, description, source_module, source_document_id,
               status, created_by, posted_by, posted_at
             ) VALUES (
               $1, $2, $3, 'receipts', $4,
               'posted', $5, $5, $6
             )
             RETURNING id`,
            [
              entryNumberValue,
              new Date().toISOString().split('T')[0],
              `VOID - Reverse payment ${payment.payment_number}`,
              payment.id,
              user.id,
              new Date().toISOString(),
            ]
          );

          const reversingEntryId = reversingEntry.rows[0]?.id;
          if (reversingEntryId) {
            for (const [index, line] of originalLines.rows.entries()) {
              await tx.query(
                `INSERT INTO journal_lines (
                   journal_entry_id, line_number, account_id, description,
                   debit, credit, base_debit, base_credit
                 ) VALUES (
                   $1, $2, $3, $4,
                   $5, $6, $7, $8
                 )`,
                [
                  reversingEntryId,
                  index + 1,
                  line.account_id,
                  `Reverse: ${line.description}`,
                  line.credit,
                  line.debit,
                  line.base_credit,
                  line.base_debit,
                ]
              );
            }
          }
        }
      }

      await tx.query('DELETE FROM payments_received WHERE id = $1', [resolvedParams.id]);
    });

    return NextResponse.json({ message: 'Payment voided successfully' });
  } catch (error: any) {
    console.error('Error voiding payment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
