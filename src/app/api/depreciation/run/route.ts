import { NextRequest, NextResponse } from 'next/server';
import { requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { calculateMonthlyDepreciation } from '@/lib/accounting/assets';

export async function POST(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const { period_end_date, company_id } = await request.json();

    if (!period_end_date) {
      return NextResponse.json(
        { error: 'period_end_date is required' },
        { status: 400 }
      );
    }

    if (!company_id) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, company_id);
    if (companyAccessError) {
      return companyAccessError;
    }

    const periodDate = new Date(period_end_date);
    const periodDateOnly = periodDate.toISOString().split('T')[0];

    // Get all active assets
    const assetsResult = await db.query(
      `SELECT *
       FROM fixed_assets
       WHERE company_id = $1
         AND status = 'active'
         AND depreciation_method IS NOT NULL
         AND depreciation_start_date <= $2::date`,
      [company_id, periodDateOnly]
    );
    const assets = assetsResult.rows as any[];

    if (!assets || assets.length === 0) {
      return NextResponse.json({ message: 'No assets to depreciate', entries: [] });
    }

    const depExpenseAccountResult = await db.query(
      `SELECT id
       FROM accounts
       WHERE code = '6300'
         AND (company_id = $1 OR company_id IS NULL)
       ORDER BY CASE WHEN company_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [company_id]
    );
    const accumDepAccountResult = await db.query(
      `SELECT id
       FROM accounts
       WHERE code = '1500'
         AND (company_id = $1 OR company_id IS NULL)
       ORDER BY CASE WHEN company_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [company_id]
    );

    const depreciationExpenseAccount = depExpenseAccountResult.rows[0];
    const accumulatedDepreciationAccount = accumDepAccountResult.rows[0];

    if (!depreciationExpenseAccount || !accumulatedDepreciationAccount) {
      return NextResponse.json(
        { error: 'Depreciation accounts not found. Please configure accounts 6300 and 1500.' },
        { status: 400 }
      );
    }

    const depreciationEntries = [];
    const journalEntries = [];

    for (const asset of assets) {
      // Skip if already fully depreciated
      if (asset.accumulated_depreciation >= (asset.purchase_price - (asset.residual_value || 0))) {
        continue;
      }

      // Check if depreciation already posted for this period
      const existingScheduleResult = await db.query(
        `SELECT id
         FROM depreciation_schedules
         WHERE asset_id = $1
           AND period_date = $2::date
         LIMIT 1`,
        [asset.id, periodDateOnly]
      );
      const existingSchedule = existingScheduleResult.rows[0];

      if (existingSchedule) {
        continue; // Already posted
      }

      // Calculate depreciation based on method
      const monthlyDepreciation = calculateMonthlyDepreciation(asset).toNumber();
      const depreciableAmount = asset.purchase_price - (asset.residual_value || 0);

      // Don't exceed remaining depreciable amount
      const remainingDepreciable = depreciableAmount - asset.accumulated_depreciation;
      const actualDepreciation = Math.min(monthlyDepreciation, remainingDepreciable);

      if (actualDepreciation <= 0) {
        continue;
      }

      const posted = await db.transaction(async (tx) => {
        const scheduleResult = await tx.query(
          `INSERT INTO depreciation_schedules (
             asset_id,
             period_date,
             depreciation_amount,
             accumulated_depreciation,
             book_value,
             is_posted,
             posted_at
           ) VALUES (
             $1, $2::date, $3, $4, $5, true, NOW()
           )
           RETURNING *`,
          [
            asset.id,
            periodDateOnly,
            actualDepreciation,
            asset.accumulated_depreciation + actualDepreciation,
            asset.purchase_price - (asset.accumulated_depreciation + actualDepreciation),
          ]
        );
        const schedule = scheduleResult.rows[0];

        await tx.query(
          `UPDATE fixed_assets
           SET accumulated_depreciation = $1,
               book_value = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [
            asset.accumulated_depreciation + actualDepreciation,
            asset.purchase_price - (asset.accumulated_depreciation + actualDepreciation),
            asset.id,
          ]
        );

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
             $1, $2, $3::date, $4, 'depreciation', $5, 'posted', 'assets', $6, $6, NOW()
           )
           RETURNING id`,
          [
            company_id,
            entryNumber,
            periodDateOnly,
            `Depreciation for ${asset.name} - ${periodDate.getMonth() + 1}/${periodDate.getFullYear()}`,
            schedule.id,
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
            company_id,
            journalEntryId,
            depreciationExpenseAccount.id,
            actualDepreciation,
            `Depreciation - ${asset.name}`,
            accumulatedDepreciationAccount.id,
            `Accumulated Depreciation - ${asset.name}`,
          ]
        );

        await tx.query(
          'UPDATE depreciation_schedules SET journal_entry_id = $1 WHERE id = $2',
          [journalEntryId, schedule.id]
        );

        return { schedule, journalEntryId };
      });

      depreciationEntries.push(posted.schedule);
      journalEntries.push(posted.journalEntryId);
    }

    return NextResponse.json({
      message: `Depreciation posted for ${depreciationEntries.length} assets`,
      entries: depreciationEntries,
      journal_entries: journalEntries.length,
    });
  } catch (error: any) {
    console.error('Error running depreciation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
