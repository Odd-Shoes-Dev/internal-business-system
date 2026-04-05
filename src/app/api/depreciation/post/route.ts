import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';
import { NextRequest, NextResponse } from 'next/server';
import { calculateMonthlyDepreciation } from '@/lib/accounting/assets';

// GET /api/depreciation/preview - Preview next depreciation posting
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
    
    // Get period from query params or default to current month
    const periodEnd = searchParams.get('period_end') || new Date().toISOString().split('T')[0];
    const periodEndDate = new Date(periodEnd);
    const periodStart = searchParams.get('period_start') || 
      new Date(periodEndDate.getFullYear(), periodEndDate.getMonth(), 1).toISOString().split('T')[0];

    // Check if depreciation already posted for this period
    const existingPostingResult = await db.query(
      `SELECT dp.id, dp.posting_date, dp.total_depreciation
       FROM depreciation_postings dp
       INNER JOIN journal_entries je ON je.id = dp.journal_entry_id
       WHERE dp.period_start = $1::date
         AND dp.period_end = $2::date
         AND dp.status = 'posted'
         AND je.company_id = $3
       LIMIT 1`,
      [periodStart, periodEnd, companyId]
    );
    const existingPosting = existingPostingResult.rows[0];

    if (existingPosting) {
      return NextResponse.json({
        error: 'Depreciation already posted for this period',
        existing_posting: existingPosting,
      }, { status: 400 });
    }

    // Get all active assets
    const assetsResult = await db.query(
      `SELECT *
       FROM fixed_assets
       WHERE company_id = $1
         AND status = 'active'
         AND depreciation_start_date <= $2::date`,
      [companyId, periodEnd]
    );
    const assets = assetsResult.rows as any[];

    if (!assets || assets.length === 0) {
      return NextResponse.json({
        message: 'No active assets to depreciate',
        preview: {
          period_start: periodStart,
          period_end: periodEnd,
          assets: [],
          total_depreciation: 0,
          assets_count: 0,
        },
      });
    }

    // Calculate depreciation for each asset
    const assetDetails: any[] = [];
    let totalDepreciation = 0;

    for (const asset of assets) {
      // Check if asset is fully depreciated
      if (asset.accumulated_depreciation >= (asset.purchase_price - (asset.residual_value || 0))) {
        continue;
      }

      const monthlyDepreciation = calculateMonthlyDepreciation(asset);
      const monthlyDepreciationNum = monthlyDepreciation.toNumber();
      
      if (monthlyDepreciationNum > 0) {
        const accumulatedBefore = asset.accumulated_depreciation || 0;
        const accumulatedAfter = Math.min(
          accumulatedBefore + monthlyDepreciationNum,
          asset.purchase_price - (asset.residual_value || 0)
        );
        const actualDepreciation = accumulatedAfter - accumulatedBefore;

        assetDetails.push({
          asset_id: asset.id,
          asset_name: asset.name,
          asset_code: asset.asset_number,
          depreciation_method: asset.depreciation_method,
          depreciation_amount: actualDepreciation,
          accumulated_before: accumulatedBefore,
          accumulated_after: accumulatedAfter,
          book_value_before: asset.book_value || (asset.purchase_price - accumulatedBefore),
          book_value_after: asset.purchase_price - accumulatedAfter,
          purchase_price: asset.purchase_price,
          salvage_value: asset.residual_value,
        });

        totalDepreciation += actualDepreciation;
      }
    }

    return NextResponse.json({
      data: {
        period_start: periodStart,
        period_end: periodEnd,
        posting_date: periodEnd,
        assets: assetDetails,
        total_depreciation: totalDepreciation,
        assets_count: assetDetails.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/depreciation/post - Post monthly depreciation
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
    if (!body.period_start || !body.period_end) {
      return NextResponse.json(
        { error: 'Missing required fields: period_start, period_end' },
        { status: 400 }
      );
    }

    const periodStart = body.period_start;
    const periodEnd = body.period_end;
    const postingDate = body.posting_date || periodEnd;

    // Check if already posted
    const existingPostingResult = await db.query(
      `SELECT dp.id
       FROM depreciation_postings dp
       INNER JOIN journal_entries je ON je.id = dp.journal_entry_id
       WHERE dp.period_start = $1::date
         AND dp.period_end = $2::date
         AND dp.status = 'posted'
         AND je.company_id = $3
       LIMIT 1`,
      [periodStart, periodEnd, body.company_id]
    );
    const existingPosting = existingPostingResult.rows[0];

    if (existingPosting) {
      return NextResponse.json(
        { error: 'Depreciation already posted for this period' },
        { status: 400 }
      );
    }

    // Get active assets
    const assetsResult = await db.query(
      `SELECT *
       FROM fixed_assets
       WHERE company_id = $1
         AND status = 'active'
         AND depreciation_start_date <= $2::date`,
      [body.company_id, periodEnd]
    );
    const assets = assetsResult.rows as any[];

    if (!assets || assets.length === 0) {
      return NextResponse.json(
        { error: 'No active assets to depreciate' },
        { status: 400 }
      );
    }

    // Calculate depreciation
    const assetDetails: any[] = [];
    let totalDepreciation = 0;

    for (const asset of assets) {
      if (asset.accumulated_depreciation >= (asset.purchase_price - (asset.residual_value || 0))) {
        continue;
      }

      const monthlyDepreciation = calculateMonthlyDepreciation(asset);
      const monthlyDepreciationNum = monthlyDepreciation.toNumber();
      
      if (monthlyDepreciationNum > 0) {
        const accumulatedBefore = asset.accumulated_depreciation || 0;
        const accumulatedAfter = Math.min(
          accumulatedBefore + monthlyDepreciationNum,
          asset.purchase_price - (asset.residual_value || 0)
        );
        const actualDepreciation = accumulatedAfter - accumulatedBefore;

        assetDetails.push({
          asset_id: asset.id,
          depreciation_amount: actualDepreciation,
          accumulated_before: accumulatedBefore,
          accumulated_after: accumulatedAfter,
          book_value_before: asset.book_value || (asset.purchase_price - accumulatedBefore),
          book_value_after: asset.purchase_price - accumulatedAfter,
        });

        totalDepreciation += actualDepreciation;
      }
    }

    if (assetDetails.length === 0) {
      return NextResponse.json(
        { error: 'No assets require depreciation for this period' },
        { status: 400 }
      );
    }

    // Create journal entry
    // Get depreciation expense and accumulated depreciation accounts
    const depExpenseAcctResult = await db.query(
      `SELECT id
       FROM accounts
       WHERE code = '6300'
         AND (company_id = $1 OR company_id IS NULL)
       ORDER BY CASE WHEN company_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [body.company_id]
    );
    const accumDepAcctResult = await db.query(
      `SELECT id
       FROM accounts
       WHERE code = '1500'
         AND (company_id = $1 OR company_id IS NULL)
       ORDER BY CASE WHEN company_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [body.company_id]
    );

    const depExpenseAcct = depExpenseAcctResult.rows[0];
    const accumDepAcct = accumDepAcctResult.rows[0];

    if (!depExpenseAcct || !accumDepAcct) {
      return NextResponse.json(
        { error: 'Depreciation accounts not found. Please create accounts with codes 6300 (Depreciation Expense) and 1500 (Accumulated Depreciation)' },
        { status: 400 }
      );
    }

    const posting = await db.transaction(async (tx) => {
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
           source_module,
           status,
           created_by,
           posted_by,
           posted_at
         ) VALUES (
           $1, $2, $3::date, $4, 'assets', 'posted', $5, $5, NOW()
         )
         RETURNING id`,
        [
          body.company_id,
          entryNumber,
          postingDate,
          `Depreciation for period ${periodStart} to ${periodEnd}`,
          user.id,
        ]
      );
      const journalEntry = journalEntryResult.rows[0];

      await tx.query(
        `INSERT INTO journal_lines (
           company_id,
           journal_entry_id,
           line_number,
           account_id,
           description,
           debit,
           credit,
           base_debit,
           base_credit
         ) VALUES
           ($1, $2, 1, $3, 'Depreciation Expense', $4, 0, $4, 0),
           ($1, $2, 2, $5, 'Accumulated Depreciation', 0, $4, 0, $4)`,
        [
          body.company_id,
          journalEntry.id,
          depExpenseAcct.id,
          totalDepreciation,
          accumDepAcct.id,
        ]
      );

      const postingResult = await tx.query(
        `INSERT INTO depreciation_postings (
           posting_date,
           period_start,
           period_end,
           total_depreciation,
           assets_count,
           journal_entry_id,
           notes,
           posted_by
         ) VALUES (
           $1::date, $2::date, $3::date, $4, $5, $6, $7, $8
         )
         RETURNING *`,
        [
          postingDate,
          periodStart,
          periodEnd,
          totalDepreciation,
          assetDetails.length,
          journalEntry.id,
          body.notes || null,
          user.id,
        ]
      );
      const createdPosting = postingResult.rows[0];

      for (const detail of assetDetails) {
        await tx.query(
          `INSERT INTO depreciation_posting_details (
             posting_id,
             asset_id,
             depreciation_amount,
             accumulated_before,
             accumulated_after,
             book_value_before,
             book_value_after
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            createdPosting.id,
            detail.asset_id,
            detail.depreciation_amount,
            detail.accumulated_before,
            detail.accumulated_after,
            detail.book_value_before,
            detail.book_value_after,
          ]
        );
      }

      return createdPosting;
    });

    return NextResponse.json({
      data: posting,
      message: `Depreciation posted successfully for ${assetDetails.length} assets. Total: ${totalDepreciation}`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error posting depreciation:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
