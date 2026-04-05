import { NextRequest, NextResponse } from 'next/server';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// GET /api/bank-transactions - List bank transactions
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

    const accountId = searchParams.get('account_id');
    const type = searchParams.get('type');
    const reconciled = searchParams.get('reconciled');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    const where: string[] = ['ba.company_id = $1'];
    const params: any[] = [companyId];

    if (accountId && accountId !== 'all') {
      params.push(accountId);
      where.push(`bt.bank_account_id = $${params.length}`);
    }

    if (type && type !== 'all') {
      params.push(type);
      where.push(`bt.transaction_type = $${params.length}`);
    }

    if (reconciled && reconciled !== 'all') {
      params.push(reconciled === 'reconciled');
      where.push(`bt.is_reconciled = $${params.length}`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const countResult = await db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM bank_transactions bt
       JOIN bank_accounts ba ON ba.id = bt.bank_account_id
       ${whereSql}`,
      params
    );

    const listParams = [...params, limit, offset];
    const rowsResult = await db.query<any>(
      `SELECT bt.*, ba.name AS bank_account_name, ba.bank_name AS bank_account_bank_name, ba.currency AS bank_account_currency
       FROM bank_transactions bt
       JOIN bank_accounts ba ON ba.id = bt.bank_account_id
       ${whereSql}
       ORDER BY bt.transaction_date DESC, bt.created_at DESC
       LIMIT $${listParams.length - 1}
       OFFSET $${listParams.length}`,
      listParams
    );

    const total = Number(countResult.rows[0]?.total || 0);
    const data = rowsResult.rows.map((row) => ({
      ...row,
      bank_accounts: {
        id: row.bank_account_id,
        name: row.bank_account_name,
        bank_name: row.bank_account_bank_name,
        currency: row.bank_account_currency,
      },
    }));

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil((total || 0) / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/bank-transactions - Create a bank transaction
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    // Validate required fields
    if (!body.bank_account_id || !body.transaction_date || !body.amount || !body.description) {
      return NextResponse.json(
        { error: 'Missing required fields: bank_account_id, transaction_date, amount, description' },
        { status: 400 }
      );
    }

    if (!body.company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, body.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Check if period is closed
    const periodLock = await db.query<{
      name: string;
      start_date: string;
      end_date: string;
      status: string;
      level: string;
    }>(
      `SELECT name, start_date, end_date, status, level
       FROM fiscal_periods
       WHERE company_id = $1
         AND start_date <= $2::date
         AND end_date >= $2::date
         AND status IN ('closed', 'locked')
       ORDER BY level DESC
       LIMIT 1`,
      [body.company_id, body.transaction_date]
    );

    if (periodLock.rows.length > 0) {
      const period = periodLock.rows[0];
      return NextResponse.json(
        {
          error: `Cannot modify transaction: The ${period.level} period "${period.name}" (${period.start_date} to ${period.end_date}) is ${period.status}.`,
        },
        { status: 403 }
      );
    }

    // Get the bank account to retrieve its GL account
    const bankAccountResult = await db.query<{
      gl_account_id: string | null;
      name: string;
      currency: string;
    }>(
      'SELECT gl_account_id, name, currency FROM bank_accounts WHERE id = $1 LIMIT 1',
      [body.bank_account_id]
    );
    const bankAccount = bankAccountResult.rows[0];

    if (!bankAccount) {
      return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    }

    if (!bankAccount.gl_account_id) {
      return NextResponse.json({ 
        error: 'Bank account is not linked to a GL account. Please update the bank account settings.' 
      }, { status: 400 });
    }

    // Create the bank transaction
    const transactionInsert = await db.query(
      `INSERT INTO bank_transactions (
         bank_account_id, transaction_date, amount, description,
         reference_number, transaction_type, is_reconciled
       ) VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING *`,
      [
        body.bank_account_id,
        body.transaction_date,
        body.amount,
        body.description,
        body.reference_number || null,
        body.transaction_type || 'other',
      ]
    );
    const data = transactionInsert.rows[0];

    // Create corresponding journal entry
    // For deposits: Debit Bank Account, Credit Revenue/Other Income or specified account
    // For withdrawals: Debit Expense or specified account, Credit Bank Account
    const isDeposit = body.amount > 0;
    const transactionAmount = Math.abs(body.amount);

    // Determine the contra account (the other side of the transaction)
    let contraAccountId = body.contra_account_id;
    
    if (!contraAccountId) {
      // Default accounts if not specified
      if (isDeposit) {
        // For deposits, default to Other Income account (4500)
        const incomeAccount = await db.query<{ id: string }>(
          'SELECT id FROM accounts WHERE code = $1 LIMIT 1',
          ['4500']
        );
        contraAccountId = incomeAccount.rows[0]?.id;
      } else {
        // For withdrawals, default to Bank Charges account (5300)
        const expenseAccount = await db.query<{ id: string }>(
          'SELECT id FROM accounts WHERE code = $1 LIMIT 1',
          ['5300']
        );
        contraAccountId = expenseAccount.rows[0]?.id;
      }
    }

    if (!contraAccountId) {
      // If we still don't have a contra account, skip journal entry but warn
      console.warn('No contra account found for bank transaction, journal entry not created');
      return NextResponse.json({ data }, { status: 201 });
    }

    // Generate journal entry number
    const year = new Date(body.transaction_date).getFullYear();
    const lastEntry = await db.query<{ entry_number: string }>(
      'SELECT entry_number FROM journal_entries WHERE entry_number LIKE $1 ORDER BY entry_number DESC LIMIT 1',
      [`JE-${year}-%`]
    );

    let entryNumber;
    if (lastEntry.rows[0]?.entry_number) {
      const lastNum = parseInt(lastEntry.rows[0].entry_number.split('-')[2]);
      entryNumber = `JE-${year}-${String(lastNum + 1).padStart(4, '0')}`;
    } else {
      entryNumber = `JE-${year}-0001`;
    }

    // Create journal entry
    let journalEntry: any;
    try {
      const journalEntryResult = await db.query(
        `INSERT INTO journal_entries (
           entry_number, entry_date, description, reference, status,
           source_module, source_document_id, created_by, posted_by, posted_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          entryNumber,
          body.transaction_date,
          `Bank ${isDeposit ? 'deposit' : 'withdrawal'}: ${body.description}`,
          body.reference_number || data.id,
          'posted',
          'bank',
          data.id,
          user.id,
          user.id,
          new Date().toISOString(),
        ]
      );
      journalEntry = journalEntryResult.rows[0];
    } catch (jeError: any) {
      console.error('Failed to create journal entry:', jeError);
      // Don't fail the transaction, just log the error
      return NextResponse.json({ 
        data,
        warning: 'Bank transaction created but journal entry failed' 
      }, { status: 201 });
    }

    // Create journal lines
    const journalLines = isDeposit
      ? [
          // Debit Bank Account
          {
            journal_entry_id: journalEntry.id,
            account_id: bankAccount.gl_account_id,
            debit: transactionAmount,
            credit: 0,
            description: `${body.description}`,
            created_by: user.id,
          },
          // Credit Income/Other Account
          {
            journal_entry_id: journalEntry.id,
            account_id: contraAccountId,
            debit: 0,
            credit: transactionAmount,
            description: `${body.description}`,
            created_by: user.id,
          },
        ]
      : [
          // Debit Expense/Other Account
          {
            journal_entry_id: journalEntry.id,
            account_id: contraAccountId,
            debit: transactionAmount,
            credit: 0,
            description: `${body.description}`,
            created_by: user.id,
          },
          // Credit Bank Account
          {
            journal_entry_id: journalEntry.id,
            account_id: bankAccount.gl_account_id,
            debit: 0,
            credit: transactionAmount,
            description: `${body.description}`,
            created_by: user.id,
          },
        ];

    try {
      for (const line of journalLines) {
        await db.query(
          `INSERT INTO journal_lines (
             journal_entry_id, account_id, debit, credit, description, created_by
           ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            line.journal_entry_id,
            line.account_id,
            line.debit,
            line.credit,
            line.description,
            line.created_by,
          ]
        );
      }
    } catch (jlError: any) {
      console.error('Failed to create journal lines:', jlError);
      return NextResponse.json({ 
        data,
        warning: 'Bank transaction created but journal lines failed' 
      }, { status: 201 });
    }

    return NextResponse.json({ 
      data,
      journal_entry: journalEntry 
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

