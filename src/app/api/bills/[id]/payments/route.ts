import { NextRequest, NextResponse } from 'next/server';
import { getAccountIdByCode } from '@/lib/accounting/provider-accounting';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/bills/:id/payments - List payments for a bill
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await params;

    const billResult = await db.query<{ company_id: string }>(
      'SELECT company_id FROM bills WHERE id = $1 LIMIT 1',
      [id]
    );
    const bill = billResult.rows[0];

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, bill.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const data = await db.query<any>(
      `SELECT bpa.id,
              bpa.amount_applied,
              bp.payment_number,
              bp.payment_date,
              bp.payment_method,
              bp.reference_number,
              bp.notes,
              a.id AS account_id,
              a.name AS account_name,
              a.currency AS account_currency
       FROM bill_payment_applications bpa
       JOIN bill_payments bp ON bp.id = bpa.bill_payment_id
       LEFT JOIN accounts a ON a.id = bp.pay_from_account_id
       WHERE bpa.bill_id = $1
       ORDER BY bpa.created_at DESC`,
      [id]
    );

    // Flatten the structure for easier consumption
    const payments = data.rows.map((app) => ({
      id: app.id,
      payment_number: app.payment_number,
      payment_date: app.payment_date,
      amount_applied: app.amount_applied,
      payment_method: app.payment_method,
      reference_number: app.reference_number,
      notes: app.notes,
      account: app.account_id
        ? {
            id: app.account_id,
            name: app.account_name,
            currency: app.account_currency,
          }
        : null,
    }));

    return NextResponse.json({ data: payments });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/bills/:id/payments - Record a payment for a bill
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id: billId } = await params;
    const body = await request.json();

    if (!body.payment_date || !body.amount || !body.bank_account_id) {
      return NextResponse.json(
        { error: 'Missing required fields: payment_date, amount, bank_account_id' },
        { status: 400 }
      );
    }

    // Get bill details
    const billResult = await db.query<{
      id: string;
      bill_number: string;
      vendor_id: string;
      total: number;
      amount_paid: number;
      status: string;
      currency: string;
      company_id: string;
      vendor_name: string | null;
    }>(
      `SELECT b.id,
              b.bill_number,
              b.vendor_id,
              b.total,
              b.amount_paid,
              b.status,
              b.currency,
              b.company_id,
              v.name AS vendor_name
       FROM bills b
       LEFT JOIN vendors v ON v.id = b.vendor_id
       WHERE b.id = $1
       LIMIT 1`,
      [billId]
    );
    const bill = billResult.rows[0];

    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, bill.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Check if payment amount exceeds balance
    const billTotal = Number(bill.total || 0);
    const currentAmountPaid = Number(bill.amount_paid || 0);
    const balance = Math.round((billTotal - currentAmountPaid) * 100) / 100;
    const paymentAmount = Math.round(Number(body.amount || 0) * 100) / 100;
    
    if (paymentAmount > balance + 0.01) { // Add tolerance for floating-point precision
      return NextResponse.json(
        { error: `Payment amount cannot exceed bill balance of ${balance}` },
        { status: 400 }
      );
    }

    // Generate payment reference
    const date = new Date();
    const ref = `BP-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const outcome = await db.transaction(async (tx) => {
      const bankAccount = await tx.query<{ gl_account_id: string | null }>(
        'SELECT gl_account_id FROM bank_accounts WHERE id = $1 LIMIT 1',
        [body.bank_account_id]
      );

      const payFromAccountId = bankAccount.rows[0]?.gl_account_id || null;

      const payment = await tx.query<any>(
        `INSERT INTO bill_payments (
           vendor_id, payment_number, payment_date, amount, payment_method,
           pay_from_account_id, reference_number, notes, currency, exchange_rate, created_by
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10, $11
         )
         RETURNING *`,
        [
          bill.vendor_id,
          body.reference || ref,
          body.payment_date,
          paymentAmount,
          body.payment_method || 'bank_transfer',
          payFromAccountId,
          body.reference || ref,
          body.notes || null,
          body.currency || bill.currency || 'USD',
          body.exchange_rate || 1,
          user.id,
        ]
      );

      const paymentRow = payment.rows[0];

      await tx.query(
        `INSERT INTO bill_payment_applications (
           bill_payment_id, bill_id, amount_applied
         ) VALUES ($1, $2, $3)`,
        [paymentRow.id, billId, paymentAmount]
      );

      const newAmountPaid = currentAmountPaid + paymentAmount;
      const newStatus = newAmountPaid >= billTotal ? 'paid' : 'partial';

      await tx.query(
        `UPDATE bills
         SET amount_paid = $2,
             status = $3,
             updated_at = NOW()
         WHERE id = $1`,
        [billId, newAmountPaid, newStatus]
      );

      await tx.query('SELECT update_vendor_balance($1, $2)', [bill.vendor_id, -paymentAmount]);

      // Create journal entry for payment
      // Debit: AP (2000) and Credit: Cash/Bank account.
      const apAccountId = await getAccountIdByCode(tx, '2000');
      let cashAccountId = payFromAccountId;
      if (!cashAccountId) {
        cashAccountId = await getAccountIdByCode(tx, '1010');
      }

      if (apAccountId && cashAccountId) {
        const entryNumber = await tx.query<{ entry_number: string }>(
          'SELECT generate_journal_entry_number() AS entry_number'
        );
        const entryNumberValue = entryNumber.rows[0]?.entry_number;

        if (entryNumberValue) {
          const journalEntry = await tx.query<{ id: string }>(
            `INSERT INTO journal_entries (
               entry_number, entry_date, description, source_module, source_document_id, status, created_by
             ) VALUES ($1, $2, $3, 'bill_payment', $4, 'posted', $5)
             RETURNING id`,
            [
              entryNumberValue,
              body.payment_date,
              `Payment for Bill ${bill.bill_number} - ${bill.vendor_name || 'Vendor'}`,
              paymentRow.id,
              user.id,
            ]
          );

          const journalEntryId = journalEntry.rows[0]?.id;
          if (journalEntryId) {
            await tx.query(
              `INSERT INTO journal_lines (
                 journal_entry_id, line_number, account_id, debit, credit, description
               ) VALUES ($1, 1, $2, $3, 0, $4)`,
              [journalEntryId, apAccountId, paymentAmount, `AP payment - Bill ${bill.bill_number}`]
            );

            await tx.query(
              `INSERT INTO journal_lines (
                 journal_entry_id, line_number, account_id, debit, credit, description
               ) VALUES ($1, 2, $2, 0, $3, $4)`,
              [journalEntryId, cashAccountId, paymentAmount, `Payment - Bill ${bill.bill_number}`]
            );
          }
        }
      }

      return paymentRow;
    });

    return NextResponse.json({ data: outcome }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
