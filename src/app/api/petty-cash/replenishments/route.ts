import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/petty-cash/replenishments - List petty cash replenishments
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

    const cash_account_id = searchParams.get('cash_account_id');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const where: string[] = ['cashBa.company_id = $1'];
    const params: any[] = [companyId];

    if (cash_account_id) {
      params.push(cash_account_id);
      where.push(`pcr.cash_account_id = $${params.length}`);
    }

    const offset = (page - 1) * limit;
    params.push(limit);
    const limitParam = params.length;
    params.push(offset);
    const offsetParam = params.length;

    const listResult = await db.query(
      `SELECT pcr.*,
              json_build_object('id', cashBa.id, 'account_name', cashBa.name) AS cash_account,
              json_build_object('id', bankBa.id, 'account_name', bankBa.name) AS bank_account
       FROM petty_cash_replenishments pcr
       LEFT JOIN bank_accounts cashBa ON cashBa.id = pcr.cash_account_id
       LEFT JOIN bank_accounts bankBa ON bankBa.id = pcr.bank_account_id
       WHERE ${where.join(' AND ')}
       ORDER BY pcr.replenishment_date DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params
    );

    const countParams = params.slice(0, params.length - 2);
    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total
       FROM petty_cash_replenishments pcr
       LEFT JOIN bank_accounts cashBa ON cashBa.id = pcr.cash_account_id
       WHERE ${where.join(' AND ')}`,
      countParams
    );

    const total = countResult.rows[0]?.total || 0;

    return NextResponse.json({
      data: listResult.rows,
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

// POST /api/petty-cash/replenishments - Create petty cash replenishment
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    if (!body.company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, body.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Validate required fields
    if (!body.cash_account_id || !body.bank_account_id || !body.amount || !body.replenishment_date) {
      return NextResponse.json(
        { error: 'Missing required fields: cash_account_id, bank_account_id, amount, replenishment_date' },
        { status: 400 }
      );
    }

    const cashAccountResult = await db.query(
      `SELECT id, name, gl_account_id, company_id
       FROM bank_accounts
       WHERE id = $1
       LIMIT 1`,
      [body.cash_account_id]
    );
    const bankAccountResult = await db.query(
      `SELECT id, name, gl_account_id, company_id
       FROM bank_accounts
       WHERE id = $1
       LIMIT 1`,
      [body.bank_account_id]
    );
    const cashAccount = cashAccountResult.rows[0];
    const bankAccount = bankAccountResult.rows[0];

    if (!cashAccount || !bankAccount) {
      return NextResponse.json({ error: 'Cash account or bank account not found' }, { status: 404 });
    }

    if (cashAccount.company_id !== body.company_id || bankAccount.company_id !== body.company_id) {
      return NextResponse.json({ error: 'Accounts must belong to the selected company' }, { status: 400 });
    }

    if (!cashAccount.gl_account_id || !bankAccount.gl_account_id) {
      return NextResponse.json(
        { error: 'Both accounts must be linked to GL accounts' },
        { status: 400 }
      );
    }

    // Generate replenishment number
    const lastReplenishmentResult = await db.query(
      `SELECT replenishment_number
       FROM petty_cash_replenishments
       WHERE replenishment_number LIKE 'PCR-%'
       ORDER BY created_at DESC
       LIMIT 1`
    );
    const lastReplenishment = lastReplenishmentResult.rows[0];

    let nextNumber = 1;
    if (lastReplenishment?.replenishment_number) {
      const match = lastReplenishment.replenishment_number.match(/PCR-(\d+)/);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    const replenishment_number = `PCR-${String(nextNumber).padStart(6, '0')}`;

    const response = await db.transaction(async (tx) => {
      const entryNumberResult = await tx.query('SELECT generate_journal_entry_number() AS entry_number');
      const entryNumber = entryNumberResult.rows[0]?.entry_number;
      if (!entryNumber) {
        throw new Error('Failed to generate journal entry number');
      }

      const journalEntryResult = await tx.query(
        `INSERT INTO journal_entries (
           company_id,
           entry_number,
           entry_date,
           description,
           reference_type,
           status,
           source_module,
           created_by,
           posted_by,
           posted_at
         ) VALUES (
           $1, $2, $3::date, $4, 'petty_cash_replenishment', 'posted', 'petty_cash', $5, $5, NOW()
         )
         RETURNING id`,
        [
          body.company_id,
          entryNumber,
          body.replenishment_date,
          `Petty cash replenishment - ${body.amount}`,
          user.id,
        ]
      );
      const journalEntryId = journalEntryResult.rows[0]?.id;

      await tx.query(
        `INSERT INTO journal_lines (
           company_id,
           journal_entry_id,
           line_number,
           account_id,
           debit,
           credit,
           description
         ) VALUES
           ($1, $2, 1, $3, $4, 0, $5),
           ($1, $2, 2, $6, 0, $4, $7)`,
        [
          body.company_id,
          journalEntryId,
          cashAccount.gl_account_id,
          Number(body.amount),
          `Replenish petty cash (${cashAccount.name || body.cash_account_id})`,
          bankAccount.gl_account_id,
          `Funded from ${bankAccount.name || body.bank_account_id}`,
        ]
      );

      const replenishmentResult = await tx.query(
        `INSERT INTO petty_cash_replenishments (
           company_id,
           replenishment_number,
           cash_account_id,
           bank_account_id,
           replenishment_date,
           amount,
           reference,
           notes,
           journal_entry_id,
           created_by
         ) VALUES (
           $1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10
         )
         RETURNING *`,
        [
          body.company_id,
          replenishment_number,
          body.cash_account_id,
          body.bank_account_id,
          body.replenishment_date,
          Number(body.amount),
          body.reference || null,
          body.notes || null,
          journalEntryId,
          user.id,
        ]
      );
      const replenishment = replenishmentResult.rows[0];

      await tx.query(
        'UPDATE journal_entries SET reference_id = $1 WHERE id = $2',
        [replenishment.id, journalEntryId]
      );

      return {
        ...replenishment,
        cash_account: {
          id: cashAccount.id,
          account_name: cashAccount.name,
        },
        bank_account: {
          id: bankAccount.id,
          account_name: bankAccount.name,
        },
      };
    });

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
