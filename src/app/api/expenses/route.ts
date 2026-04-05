import { NextRequest, NextResponse } from 'next/server';
import {
  asQueryExecutor,
  createExpenseJournalEntryWithDb,
  validatePeriodLockWithDb,
} from '@/lib/accounting/provider-accounting';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/expenses - List expenses
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

    const status = searchParams.get('status');
    const vendorId = searchParams.get('vendor_id');
    const accountId = searchParams.get('account_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    const where: string[] = ['e.company_id = $1'];
    const params: any[] = [companyId];

    if (status && status !== 'all') {
      params.push(status);
      where.push(`e.status = $${params.length}`);
    }
    if (vendorId) {
      params.push(vendorId);
      where.push(`e.vendor_id = $${params.length}`);
    }
    if (accountId) {
      params.push(accountId);
      where.push(`e.expense_account_id = $${params.length}`);
    }
    if (startDate) {
      params.push(startDate);
      where.push(`e.expense_date >= $${params.length}::date`);
    }
    if (endDate) {
      params.push(endDate);
      where.push(`e.expense_date <= $${params.length}::date`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM expenses e
       ${whereSql}`,
      params
    );

    const listParams = [...params, limit, offset];
    const dataResult = await db.query(
      `SELECT e.*,
              v.id AS vendor_ref_id,
              v.name AS vendor_name,
              a.id AS account_ref_id,
              a.name AS account_name,
              a.code AS account_code,
              ba.id AS bank_account_ref_id,
              ba.name AS bank_account_name
       FROM expenses e
       LEFT JOIN vendors v ON v.id = e.vendor_id
       LEFT JOIN accounts a ON a.id = e.expense_account_id
       LEFT JOIN bank_accounts ba ON ba.id = e.bank_account_id
       ${whereSql}
       ORDER BY e.expense_date DESC
       LIMIT $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    const data = dataResult.rows.map((row: any) => ({
      ...row,
      vendors: row.vendor_ref_id ? { id: row.vendor_ref_id, name: row.vendor_name } : null,
      accounts: row.account_ref_id
        ? { id: row.account_ref_id, name: row.account_name, code: row.account_code }
        : null,
      bank_accounts: row.bank_account_ref_id
        ? { id: row.bank_account_ref_id, name: row.bank_account_name }
        : null,
    }));

    const total = Number(countResult.rows[0]?.total || 0);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/expenses - Create expense
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();
    const { company_id, ...expenseData } = body;

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    if (!expenseData.expense_date || !expenseData.amount || !expenseData.expense_account_id) {
      return NextResponse.json(
        { error: 'Missing required fields: expense_date, amount, expense_account_id' },
        { status: 400 }
      );
    }

    const companyAccessError = await requireCompanyAccess(user.id, company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const periodError = await validatePeriodLockWithDb(asQueryExecutor(db), expenseData.expense_date, company_id);
    if (periodError) {
      return NextResponse.json({ error: periodError }, { status: 403 });
    }

    const date = new Date();
    const ref = `EXP-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const insertResult = await db.query(
      `INSERT INTO expenses (
         company_id, expense_number, reference, expense_date, vendor_id,
         expense_account_id, payment_account_id, amount, tax_amount, total,
         currency, description, category, department, payment_method,
         bank_account_id, receipt_url, is_billable, customer_id, status, created_by
       ) VALUES (
         $1, $2, $3, $4::date, $5,
         $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15,
         $16, $17, $18, $19, $20, $21
       )
       RETURNING *`,
      [
        company_id,
        expenseData.reference || ref,
        expenseData.reference || ref,
        expenseData.expense_date,
        expenseData.vendor_id || null,
        expenseData.expense_account_id,
        expenseData.bank_account_id || expenseData.expense_account_id,
        expenseData.amount,
        expenseData.tax_amount || 0,
        Number(expenseData.amount || 0) + Number(expenseData.tax_amount || 0),
        expenseData.currency || 'USD',
        expenseData.description || null,
        expenseData.category || null,
        expenseData.department || null,
        expenseData.payment_method || 'cash',
        expenseData.bank_account_id || null,
        expenseData.receipt_url || null,
        expenseData.is_billable || false,
        expenseData.customer_id || null,
        expenseData.status || 'pending',
        user.id,
      ]
    );

    const expense = insertResult.rows[0];

    if (body.status === 'paid') {
      const accountResult = await db.query('SELECT code FROM accounts WHERE id = $1 LIMIT 1', [body.expense_account_id]);
      const accountCode = accountResult.rows[0]?.code;

      if (accountCode) {
        const journalResult = await createExpenseJournalEntryWithDb(
          db,
          {
            id: expense.id,
            expense_number: expense.expense_number,
            expense_date: expense.expense_date,
            amount: expense.total,
            account_code: accountCode,
            description: expense.description || 'Expense',
            bank_account_id: body.bank_account_id,
          },
          user.id
        );

        if (journalResult.journalEntryId) {
          await db.query('UPDATE expenses SET journal_entry_id = $2 WHERE id = $1', [expense.id, journalResult.journalEntryId]);
        } else if (!journalResult.success) {
          console.error('Failed to create journal entry for expense:', journalResult.error);
        }
      }
    }

    return NextResponse.json({ data: expense }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
