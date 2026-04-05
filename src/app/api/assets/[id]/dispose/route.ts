import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

// POST /api/assets/[id]/dispose - Dispose/sell fixed asset
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { id } = await context.params;
    const body = await request.json();

    if (!body.disposal_date || !body.disposal_method) {
      return NextResponse.json(
        { error: 'Missing required fields: disposal_date, disposal_method' },
        { status: 400 }
      );
    }

    const assetResult = await db.query<any>(
      `SELECT id, company_id, name, status, purchase_price, accumulated_depreciation, asset_account_id
       FROM fixed_assets
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    const asset = assetResult.rows[0];
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, asset.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    if (asset.status === 'disposed') {
      return NextResponse.json({ error: 'Asset already disposed' }, { status: 400 });
    }

    const bookValue = Number(asset.purchase_price || 0) - Number(asset.accumulated_depreciation || 0);
    const disposalAmount = Number(body.disposal_amount || 0);
    const gainLoss = disposalAmount - bookValue;

    const accountsResult = await db.query<any>(
      `SELECT id, code
       FROM accounts
       WHERE code = ANY($1::text[])`,
      [['1800', '1900', '4500', '5500']]
    );

    const cashAccount = accountsResult.rows.find((a: any) => a.code === '1800');
    const accumDeprAccount = accountsResult.rows.find((a: any) => a.code === '1900');
    const gainAccount = accountsResult.rows.find((a: any) => a.code === '4500');
    const lossAccount = accountsResult.rows.find((a: any) => a.code === '5500');

    if (!accumDeprAccount || !asset.asset_account_id) {
      return NextResponse.json(
        { error: 'Required accounts not found for disposal' },
        { status: 400 }
      );
    }

    const response = await db.transaction(async (tx) => {
      const entryNumberResult = await tx.query<{ entry_number: string }>(
        'SELECT generate_journal_entry_number() AS entry_number'
      );
      const entryNumber = entryNumberResult.rows[0]?.entry_number;
      if (!entryNumber) {
        throw new Error('Failed to generate journal entry number');
      }

      const description = `Asset disposal - ${asset.name} (${body.disposal_method})`;
      const journalEntryResult = await tx.query<{ id: string }>(
        `INSERT INTO journal_entries (
           entry_number, entry_date, description, source_module, source_document_id, status, created_by
         ) VALUES ($1, $2::date, $3, 'asset_disposal', $4, 'posted', $5)
         RETURNING id`,
        [entryNumber, body.disposal_date, description, id, user.id]
      );

      const journalEntryId = journalEntryResult.rows[0]?.id;
      if (!journalEntryId) {
        throw new Error('Failed to create journal entry');
      }

      const lines: Array<{ account_id: string; debit: number; credit: number; description: string }> = [];

      if (disposalAmount > 0 && cashAccount) {
        lines.push({
          account_id: cashAccount.id,
          debit: disposalAmount,
          credit: 0,
          description: 'Cash received from disposal',
        });
      }

      if (Number(asset.accumulated_depreciation || 0) > 0) {
        lines.push({
          account_id: accumDeprAccount.id,
          debit: Number(asset.accumulated_depreciation),
          credit: 0,
          description: 'Remove accumulated depreciation',
        });
      }

      if (gainLoss < 0 && lossAccount) {
        lines.push({
          account_id: lossAccount.id,
          debit: Math.abs(gainLoss),
          credit: 0,
          description: 'Loss on asset disposal',
        });
      } else if (gainLoss > 0 && gainAccount) {
        lines.push({
          account_id: gainAccount.id,
          debit: 0,
          credit: gainLoss,
          description: 'Gain on asset disposal',
        });
      }

      lines.push({
        account_id: asset.asset_account_id,
        debit: 0,
        credit: Number(asset.purchase_price || 0),
        description: 'Remove asset from books',
      });

      let lineNumber = 1;
      for (const line of lines) {
        await tx.query(
          `INSERT INTO journal_lines (
             journal_entry_id, line_number, account_id, debit, credit, description
           ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [journalEntryId, lineNumber, line.account_id, line.debit, line.credit, line.description]
        );
        lineNumber += 1;
      }

      const updatedAssetResult = await tx.query<any>(
        `UPDATE fixed_assets
         SET status = 'disposed',
             disposal_date = $2::date,
             disposal_method = $3,
             disposal_amount = $4,
             disposal_journal_entry_id = $5,
             disposal_notes = $6,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          id,
          body.disposal_date,
          body.disposal_method,
          disposalAmount,
          journalEntryId,
          body.disposal_notes || null,
        ]
      );

      return {
        asset: updatedAssetResult.rows[0],
        disposal_summary: {
          original_cost: Number(asset.purchase_price || 0),
          accumulated_depreciation: Number(asset.accumulated_depreciation || 0),
          book_value: bookValue,
          disposal_amount: disposalAmount,
          gain_loss: gainLoss,
          journal_entry_id: journalEntryId,
        },
      };
    });

    return NextResponse.json(response);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
