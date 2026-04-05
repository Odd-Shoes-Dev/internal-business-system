import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/bank-transfers - Create a bank transfer
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    if (!body.from_account_id || !body.to_account_id || !body.amount || !body.transfer_date) {
      return NextResponse.json(
        { error: 'Missing required fields: from_account_id, to_account_id, amount, transfer_date' },
        { status: 400 }
      );
    }

    if (body.from_account_id === body.to_account_id) {
      return NextResponse.json({ error: 'Cannot transfer to the same account' }, { status: 400 });
    }

    if (Number(body.amount) <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
    }

    const fromAccountResult = await db.query(
      `SELECT id, name, gl_account_id, currency, company_id
       FROM bank_accounts
       WHERE id = $1
       LIMIT 1`,
      [body.from_account_id]
    );
    const toAccountResult = await db.query(
      `SELECT id, name, gl_account_id, currency, company_id
       FROM bank_accounts
       WHERE id = $1
       LIMIT 1`,
      [body.to_account_id]
    );

    const fromAccount = fromAccountResult.rows[0];
    const toAccount = toAccountResult.rows[0];

    if (!fromAccount || !toAccount) {
      return NextResponse.json({ error: 'One or both accounts not found' }, { status: 404 });
    }

    if (!fromAccount.company_id || fromAccount.company_id !== toAccount.company_id) {
      return NextResponse.json({ error: 'Both accounts must belong to the same company' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, fromAccount.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (!fromAccount.gl_account_id || !toAccount.gl_account_id) {
      return NextResponse.json(
        { error: 'Both bank accounts must be linked to GL accounts. Please update the bank account settings.' },
        { status: 400 }
      );
    }

    const referenceNumber = body.reference_number || `TRF-${Date.now().toString(36).toUpperCase()}`;
    const transferAmount = Math.abs(Number(body.amount));

    const response = await db.transaction(async (tx) => {
      const txResult = await tx.query(
        `INSERT INTO bank_transactions (
           company_id, bank_account_id, transaction_date, amount, description,
           reference_number, transaction_type, is_reconciled
         ) VALUES
           ($1, $2, $3::date, $4, $5, $6, 'transfer_out', false),
           ($1, $7, $3::date, $8, $9, $6, 'transfer_in', false)
         RETURNING *`,
        [
          fromAccount.company_id,
          body.from_account_id,
          body.transfer_date,
          -transferAmount,
          `Transfer to ${toAccount.name || 'account'}`,
          referenceNumber,
          body.to_account_id,
          transferAmount,
          `Transfer from ${fromAccount.name || 'account'}`,
        ]
      );

      const entryNumberResult = await tx.query('SELECT generate_journal_entry_number() AS entry_number');
      const entryNumber = entryNumberResult.rows[0]?.entry_number;
      if (!entryNumber) {
        throw new Error('Failed to generate journal entry number');
      }

      const journalEntryResult = await tx.query(
        `INSERT INTO journal_entries (
           entry_number, entry_date, description, reference, status,
           source_module, source_document_id, created_by, posted_by, posted_at
         ) VALUES ($1, $2::date, $3, $4, 'posted', 'bank', $5, $6, $6, NOW())
         RETURNING *`,
        [
          entryNumber,
          body.transfer_date,
          `Bank transfer: ${fromAccount.name} -> ${toAccount.name}`,
          referenceNumber,
          txResult.rows[0]?.id,
          user.id,
        ]
      );

      const journalEntry = journalEntryResult.rows[0];

      await tx.query(
        `INSERT INTO journal_lines (
           journal_entry_id, line_number, account_id, debit, credit, description
         ) VALUES
           ($1, 1, $2, $3, 0, $4),
           ($1, 2, $5, 0, $3, $6)`,
        [
          journalEntry.id,
          toAccount.gl_account_id,
          transferAmount,
          `Transfer from ${fromAccount.name}`,
          fromAccount.gl_account_id,
          `Transfer to ${toAccount.name}`,
        ]
      );

      return {
        data: txResult.rows,
        journal_entry: journalEntry,
      };
    });

    return NextResponse.json(
      {
        ...response,
        message: 'Transfer completed successfully',
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
