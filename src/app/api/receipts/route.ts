import { NextRequest, NextResponse } from 'next/server';
import { createReceiptJournalEntryWithDb } from '@/lib/accounting/provider-accounting';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/receipts - List customer payments
export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { searchParams } = new URL(request.url);

    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const customerId = searchParams.get('customer_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const where: string[] = ['pr.company_id = $1'];
    const params: any[] = [companyId];

    if (customerId) {
      params.push(customerId);
      where.push(`pr.customer_id = $${params.length}`);
    }

    if (startDate) {
      params.push(startDate);
      where.push(`pr.payment_date >= $${params.length}::date`);
    }

    if (endDate) {
      params.push(endDate);
      where.push(`pr.payment_date <= $${params.length}::date`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countResult = await db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM payments_received pr
       ${whereSql}`,
      params
    );

    const listParams = [...params, limit, offset];
    const paymentsResult = await db.query(
      `SELECT pr.*, c.id AS customer_ref_id, c.name AS customer_name, c.email AS customer_email,
              a.id AS deposit_account_id, a.name AS deposit_account_name, a.code AS deposit_account_code
       FROM payments_received pr
       LEFT JOIN customers c ON c.id = pr.customer_id
       LEFT JOIN accounts a ON a.id = pr.deposit_to_account_id
       ${whereSql}
       ORDER BY pr.payment_date DESC
       LIMIT $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    const paymentIds = paymentsResult.rows.map((row) => row.id);
    let applicationsByPayment = new Map<string, any[]>();
    if (paymentIds.length > 0) {
      const applicationsResult = await db.query(
        `SELECT pa.id,
                pa.payment_id,
                pa.amount_applied,
                i.id AS invoice_ref_id,
                i.invoice_number,
                i.total AS invoice_total
         FROM payment_applications pa
         LEFT JOIN invoices i ON i.id = pa.invoice_id
         WHERE pa.payment_id = ANY($1::uuid[])
         ORDER BY pa.created_at DESC`,
        [paymentIds]
      );

      for (const app of applicationsResult.rows) {
        const current = applicationsByPayment.get(app.payment_id) || [];
        current.push({
          id: app.id,
          amount_applied: app.amount_applied,
          invoice: app.invoice_ref_id
            ? {
                id: app.invoice_ref_id,
                invoice_number: app.invoice_number,
                total: app.invoice_total,
              }
            : null,
        });
        applicationsByPayment.set(app.payment_id, current);
      }
    }

    const data = paymentsResult.rows.map((row) => ({
      ...row,
      customer: row.customer_ref_id
        ? {
            id: row.customer_ref_id,
            name: row.customer_name,
            email: row.customer_email,
          }
        : null,
      deposit_account: row.deposit_account_id
        ? {
            id: row.deposit_account_id,
            name: row.deposit_account_name,
            code: row.deposit_account_code,
          }
        : null,
      payment_applications: applicationsByPayment.get(row.id) || [],
    }));

    const count = Number(countResult.rows[0]?.total || 0);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/receipts - Record customer payment
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    // Multi-tenant: Validate and verify company_id
    if (!body.company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, body.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Validate required fields
    if (!body.customer_id || !body.payment_date || !body.amount || !body.payment_method) {
      return NextResponse.json(
        { error: 'Missing required fields: customer_id, payment_date, amount, payment_method' },
        { status: 400 }
      );
    }

    if (!body.deposit_to_account_id) {
      return NextResponse.json(
        { error: 'Missing deposit_to_account_id - specify which bank/cash account to deposit to' },
        { status: 400 }
      );
    }

    // Generate payment number
    const year = new Date(body.payment_date).getFullYear();
    const lastPayment = await db.query<{ payment_number: string }>(
      `SELECT payment_number
       FROM payments_received
       WHERE company_id = $1
         AND payment_number LIKE $2
       ORDER BY payment_number DESC
       LIMIT 1`,
      [body.company_id, `PMT-${year}-%`]
    );

    let nextNumber = 1;
    const lastPaymentNumber = lastPayment.rows[0]?.payment_number;
    if (lastPaymentNumber) {
      const match = lastPaymentNumber.match(/PMT-\d{4}-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const paymentNumber = `PMT-${year}-${nextNumber.toString().padStart(5, '0')}`;

    // Validate invoice applications if provided
    const applications = body.invoice_applications || [];
    let totalApplied = 0;
    
    if (applications.length > 0) {
      // Verify invoices exist and belong to customer
      const invoiceIds = applications.map((app: any) => app.invoice_id);
      const invoicesResult = await db.query<{
        id: string;
        customer_id: string;
        total: number;
        amount_paid: number;
      }>(
        `SELECT id, customer_id, total, amount_paid
         FROM invoices
         WHERE company_id = $1
           AND id = ANY($2::uuid[])`,
        [body.company_id, invoiceIds]
      );

      const invoices = invoicesResult.rows;
      if (!invoices || invoices.length !== invoiceIds.length) {
        return NextResponse.json(
          { error: 'One or more invoices not found' },
          { status: 404 }
        );
      }

      // Verify all invoices belong to the customer
      const invalidInvoices = invoices.filter(inv => inv.customer_id !== body.customer_id);
      if (invalidInvoices.length > 0) {
        return NextResponse.json(
          { error: 'One or more invoices do not belong to the specified customer' },
          { status: 400 }
        );
      }

      // Calculate total applied
      totalApplied = applications.reduce((sum: number, app: any) => sum + app.amount_applied, 0);

      // Validate amount applied doesn't exceed payment amount
      if (totalApplied > body.amount) {
        return NextResponse.json(
          { error: `Total applied (${totalApplied}) exceeds payment amount (${body.amount})` },
          { status: 400 }
        );
      }

      // Validate each application doesn't exceed invoice balance
      for (const app of applications) {
        const invoice = invoices.find(inv => inv.id === app.invoice_id);
        if (invoice) {
          const balance = invoice.total - invoice.amount_paid;
          if (app.amount_applied > balance) {
            return NextResponse.json(
              { error: `Amount applied to invoice exceeds outstanding balance` },
              { status: 400 }
            );
          }
        }
      }
    }

    const completePayment = await db.transaction(async (tx) => {
      const payment = await tx.query<any>(
        `INSERT INTO payments_received (
           company_id, payment_number, customer_id, payment_date, amount,
           currency, exchange_rate, payment_method, reference_number,
           deposit_to_account_id, notes, created_by
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12
         )
         RETURNING *`,
        [
          body.company_id,
          paymentNumber,
          body.customer_id,
          body.payment_date,
          body.amount,
          body.currency || 'USD',
          body.exchange_rate || 1.0,
          body.payment_method,
          body.reference_number || null,
          body.deposit_to_account_id,
          body.notes || null,
          user.id,
        ]
      );

      const paymentRow = payment.rows[0];

      if (applications.length > 0) {
        for (const app of applications) {
          await tx.query(
            'INSERT INTO payment_applications (payment_id, invoice_id, amount_applied) VALUES ($1, $2, $3)',
            [paymentRow.id, app.invoice_id, app.amount_applied]
          );

          const invoice = await tx.query<{ total: number; amount_paid: number }>(
            'SELECT total, amount_paid FROM invoices WHERE id = $1 LIMIT 1',
            [app.invoice_id]
          );
          const invoiceRow = invoice.rows[0];

          if (invoiceRow) {
            const newAmountPaid = Number(invoiceRow.amount_paid || 0) + Number(app.amount_applied || 0);
            const newStatus = newAmountPaid >= Number(invoiceRow.total || 0) ? 'paid' : 'partial';

            await tx.query(
              'UPDATE invoices SET amount_paid = $2, status = $3, updated_at = NOW() WHERE id = $1',
              [app.invoice_id, newAmountPaid, newStatus]
            );
          }
        }
      }

      const journalResult = await createReceiptJournalEntryWithDb(
        tx,
        {
          id: paymentRow.id,
          receipt_number: paymentRow.payment_number,
          receipt_date: paymentRow.payment_date,
          total: Number(paymentRow.amount),
          payment_method: paymentRow.payment_method,
        },
        user.id
      );

      if (journalResult.success && journalResult.journalEntryId) {
        await tx.query('UPDATE payments_received SET journal_entry_id = $2 WHERE id = $1', [
          paymentRow.id,
          journalResult.journalEntryId,
        ]);
      }

      const paymentDetails = await tx.query<any>(
        `SELECT pr.*, c.id AS customer_ref_id, c.name AS customer_name, c.email AS customer_email,
                a.id AS deposit_account_id, a.name AS deposit_account_name, a.code AS deposit_account_code
         FROM payments_received pr
         LEFT JOIN customers c ON c.id = pr.customer_id
         LEFT JOIN accounts a ON a.id = pr.deposit_to_account_id
         WHERE pr.id = $1
         LIMIT 1`,
        [paymentRow.id]
      );

      const appDetails = await tx.query<any>(
        `SELECT pa.id,
                pa.amount_applied,
                i.id AS invoice_ref_id,
                i.invoice_number,
                i.total AS invoice_total
         FROM payment_applications pa
         LEFT JOIN invoices i ON i.id = pa.invoice_id
         WHERE pa.payment_id = $1
         ORDER BY pa.created_at DESC`,
        [paymentRow.id]
      );

      const row = paymentDetails.rows[0];
      return {
        ...row,
        customer: row.customer_ref_id
          ? {
              id: row.customer_ref_id,
              name: row.customer_name,
              email: row.customer_email,
            }
          : null,
        deposit_account: row.deposit_account_id
          ? {
              id: row.deposit_account_id,
              name: row.deposit_account_name,
              code: row.deposit_account_code,
            }
          : null,
        payment_applications: appDetails.rows.map((app) => ({
          id: app.id,
          amount_applied: app.amount_applied,
          invoice: app.invoice_ref_id
            ? {
                id: app.invoice_ref_id,
                invoice_number: app.invoice_number,
                total: app.invoice_total,
              }
            : null,
        })),
      };
    });

    return NextResponse.json({ data: completePayment }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

