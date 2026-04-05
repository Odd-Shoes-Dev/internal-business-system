import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/petty-cash/disbursements/[id]/approve - Approve disbursement
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;

    // Check current status
    const existingResult = await db.query(
      `SELECT pcd.id,
              pcd.status,
              pcd.amount,
              pcd.cash_account_id,
              pcd.company_id,
              ba.name AS cash_account_name,
              ba.gl_account_id AS cash_gl_account_id
       FROM petty_cash_disbursements pcd
       LEFT JOIN bank_accounts ba ON ba.id = pcd.cash_account_id
       WHERE pcd.id = $1
       LIMIT 1`,
      [id]
    );
    const existing = existingResult.rows[0];

    if (!existing) {
      return NextResponse.json({ error: 'Disbursement not found' }, { status: 404 });
    }

    if (!existing.company_id) {
      return NextResponse.json({ error: 'Disbursement is missing company context' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, existing.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (existing.status !== 'pending') {
      return NextResponse.json(
        { error: `Can only approve pending disbursements. Current status: ${existing.status}` },
        { status: 400 }
      );
    }

    // Get petty cash expense account
    const expenseAccountResult = await db.query(
      `SELECT id
       FROM accounts
       WHERE code = '5300'
         AND (company_id = $1 OR company_id IS NULL)
       ORDER BY CASE WHEN company_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [existing.company_id]
    );
    const expenseAccount = expenseAccountResult.rows[0];

    if (!expenseAccount) {
      return NextResponse.json(
        { error: 'Petty cash expense account (5300) not found' },
        { status: 400 }
      );
    }

    if (!existing.cash_gl_account_id) {
      return NextResponse.json(
        { error: 'Petty cash account is not linked to a GL account' },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
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
           reference_id,
           status,
           source_module,
           created_by,
           posted_by,
           posted_at
         ) VALUES (
           $1, $2, CURRENT_DATE, $3, 'petty_cash_disbursement', $4, 'posted', 'petty_cash', $5, $5, NOW()
         )
         RETURNING id`,
        [
          existing.company_id,
          entryNumber,
          `Petty cash disbursement - ${existing.amount}`,
          id,
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
          existing.company_id,
          journalEntryId,
          expenseAccount.id,
          Number(existing.amount),
          'Petty cash expense',
          existing.cash_gl_account_id,
          `Cash disbursed from ${existing.cash_account_name || 'petty cash account'}`,
        ]
      );

      const updateResult = await tx.query(
        `UPDATE petty_cash_disbursements
         SET status = 'approved',
             approved_by = $1,
             approved_at = NOW(),
             journal_entry_id = $2
         WHERE id = $3
         RETURNING *`,
        [user.id, journalEntryId, id]
      );

      return {
        ...updateResult.rows[0],
        cash_account: {
          id: existing.cash_account_id,
          account_name: existing.cash_account_name,
        },
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
