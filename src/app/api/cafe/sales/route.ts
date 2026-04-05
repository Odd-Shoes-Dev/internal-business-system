import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';
import { asQueryExecutor, validatePeriodLockWithDb } from '@/lib/accounting/provider-accounting';

// POST /api/cafe/sales - Record cafe sales
export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const body = await request.json();

    // Validate required fields
    if (!body.sale_date || !body.total || body.total <= 0) {
      return NextResponse.json(
        { error: 'Missing required fields: sale_date and total amount' },
        { status: 400 }
      );
    }

    if (!body.company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    // Verify user has access to this company
    const companyAccessError = await requireCompanyAccess(user.id, body.company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    // Check if period is closed
    const periodError = await validatePeriodLockWithDb(asQueryExecutor(db), body.sale_date, body.company_id);
    if (periodError) {
      return NextResponse.json({ error: periodError }, { status: 403 });
    }

    // Get cafe revenue accounts
    const accountsResult = await db.query(
      `SELECT id, code, name
       FROM accounts
       WHERE code = ANY($1::text[])
         AND (company_id = $2 OR company_id IS NULL)
         AND is_active = true
       ORDER BY code ASC`,
      [['4210', '4220', '4230', '1010'], body.company_id]
    );
    const accounts = accountsResult.rows as Array<{ id: string; code: string; name: string }>;

    if (!accounts || accounts.length < 4) {
      return NextResponse.json(
        { error: 'Cafe accounts not found. Please run migration 035.' },
        { status: 400 }
      );
    }

    const foodAccount = accounts.find(a => a.code === '4210');
    const beverageAccount = accounts.find(a => a.code === '4220');
    const cateringAccount = accounts.find(a => a.code === '4230');
    const cashAccount = accounts.find(a => a.code === '1010');

    if (!foodAccount || !beverageAccount || !cateringAccount || !cashAccount) {
      return NextResponse.json(
        { error: 'Required cafe accounts missing' },
        { status: 400 }
      );
    }

    // Create journal entry
    const entryDate = new Date(body.sale_date);
    const ref = `CAFE-${entryDate.getFullYear()}${(entryDate.getMonth() + 1).toString().padStart(2, '0')}${entryDate.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const periodLabel = body.period === 'daily' ? 'Daily' : body.period === 'weekly' ? 'Weekly' : 'Monthly';
    const response = await db.transaction(async (tx) => {
      const entryResult = await tx.query(
        `INSERT INTO journal_entries (
           company_id,
           entry_number,
           entry_date,
           description,
           memo,
           created_by,
           posted_by,
           posted_at,
           status,
           source_module
         ) VALUES (
           $1, $2, $3::date, $4, $5, $6, $6, NOW(), 'posted', 'cafe'
         )
         RETURNING *`,
        [
          body.company_id,
          ref,
          body.sale_date,
          `${periodLabel} Cafe Sales - ${new Date(body.sale_date).toLocaleDateString()}`,
          body.notes || null,
          user.id,
        ]
      );
      const journalEntry = entryResult.rows[0] as any;

      // Create journal lines
      const lines: Array<{ account_id: string; debit: number; credit: number; description: string }> = [];
      let lineNumber = 1;

      // Debit: Cash account (asset increase)
      lines.push({
        account_id: cashAccount.id,
        debit: Number(body.total),
        credit: 0,
        description: `${periodLabel} sales receipt`,
      });

      // Credits: Revenue accounts
      if (Number(body.food_sales || 0) > 0) {
        lines.push({
          account_id: foodAccount.id,
          debit: 0,
          credit: Number(body.food_sales),
          description: 'Food sales',
        });
      }

      if (Number(body.beverage_sales || 0) > 0) {
        lines.push({
          account_id: beverageAccount.id,
          debit: 0,
          credit: Number(body.beverage_sales),
          description: 'Beverage sales',
        });
      }

      if (Number(body.catering_sales || 0) > 0) {
        lines.push({
          account_id: cateringAccount.id,
          debit: 0,
          credit: Number(body.catering_sales),
          description: 'Catering sales',
        });
      }

      for (const line of lines) {
        await tx.query(
          `INSERT INTO journal_lines (
             company_id,
             journal_entry_id,
             line_number,
             account_id,
             debit,
             credit,
             base_debit,
             base_credit,
             description
           ) VALUES ($1, $2, $3, $4, $5, $6, $5, $6, $7)`,
          [
            body.company_id,
            journalEntry.id,
            lineNumber,
            line.account_id,
            line.debit,
            line.credit,
            line.description,
          ]
        );
        lineNumber += 1;
      }

      return journalEntry;
    });

    return NextResponse.json({ 
      data: response,
      message: 'Sales recorded successfully'
    }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
