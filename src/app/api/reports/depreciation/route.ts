import { NextRequest, NextResponse } from 'next/server';
import { convertCurrency, SupportedCurrency } from '@/lib/currency';
import { getCompanyIdFromRequest, requireCompanyAccess, requireSessionUser } from '@/lib/provider/route-guards';

interface AssetDepreciation {
  assetId: string;
  assetNumber: string;
  assetName: string;
  category: string;
  purchaseDate: string;
  purchasePrice: number;
  depreciationMethod: string;
  usefulLifeMonths: number;
  residualValue: number;
  currentBookValue: number;
  accumulatedDepreciation: number;
  annualDepreciation: number;
  monthlyDepreciation: number;
  remainingLifeMonths: number;
  status: string;
  location: string;
  depreciationSchedule?: Array<{
    year: number;
    beginningValue: number;
    depreciation: number;
    accumulatedDepreciation: number;
    endingValue: number;
  }>;
}

interface DepreciationScheduleData {
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalAssets: number;
    totalOriginalCost: number;
    totalCurrentValue: number;
    totalAccumulatedDepreciation: number;
    annualDepreciationExpense: number;
    monthlyDepreciationExpense: number;
    activeAssets: number;
    fullyDepreciated: number;
  };
  assets: AssetDepreciation[];
  byCategory: Record<string, {
    count: number;
    cost: number;
    accumulated: number;
    bookValue: number;
  }>;
  byMethod: Record<string, {
    count: number;
    cost: number;
  }>;
}

// Helper to calculate depreciation
const calculateDepreciation = (
  purchaseDate: string,
  purchasePrice: number,
  residualValue: number,
  usefulLifeMonths: number,
  method: string,
  accumulatedDep: number
) => {
  const purchase = new Date(purchaseDate);
  const now = new Date();
  const monthsElapsed = (now.getFullYear() - purchase.getFullYear()) * 12 + 
                       (now.getMonth() - purchase.getMonth());
  
  const depreciableAmount = purchasePrice - residualValue;
  const monthlyDepreciation = usefulLifeMonths > 0 ? depreciableAmount / usefulLifeMonths : 0;
  const annualDepreciation = monthlyDepreciation * 12;
  
  const calculatedAccumulated = Math.min(
    monthlyDepreciation * monthsElapsed,
    depreciableAmount
  );
  
  const accumulated = accumulatedDep || calculatedAccumulated;
  const bookValue = purchasePrice - accumulated;
  const remainingMonths = Math.max(0, usefulLifeMonths - monthsElapsed);
  
  return {
    annualDepreciation,
    monthlyDepreciation,
    accumulatedDepreciation: accumulated,
    bookValue,
    remainingMonths
  };
};

// Helper to generate depreciation schedule
const generateDepreciationSchedule = (
  purchasePrice: number,
  residualValue: number,
  usefulLifeMonths: number,
  annualDepreciation: number
) => {
  const usefulLifeYears = Math.ceil(usefulLifeMonths / 12);
  const schedule = [];
  let beginningValue = purchasePrice;
  let totalAccumulated = 0;

  for (let year = 1; year <= usefulLifeYears; year++) {
    const depreciation = Math.min(annualDepreciation, beginningValue - residualValue);
    totalAccumulated += depreciation;
    const endingValue = Math.max(purchasePrice - totalAccumulated, residualValue);

    schedule.push({
      year,
      beginningValue,
      depreciation,
      accumulatedDepreciation: totalAccumulated,
      endingValue
    });

    beginningValue = endingValue;
    
    // Stop if fully depreciated
    if (endingValue <= residualValue) break;
  }

  return schedule;
};

export async function GET(request: NextRequest) {
  try {
    const { db, user, errorResponse } = await requireSessionUser();
    if (errorResponse || !user) {
      return errorResponse!;
    }

    const searchParams = request.nextUrl.searchParams;
    const companyId = getCompanyIdFromRequest(request);
    if (!companyId) {
      return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
    }

    const companyAccessError = await requireCompanyAccess(user.id, companyId);
    if (companyAccessError) {
      return companyAccessError;
    }

    const startDate = searchParams.get('startDate') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
    const category = searchParams.get('category') || 'all';
    const status = searchParams.get('status') || 'all';
    const sortBy = searchParams.get('sortBy') || 'assetNumber';

    const params: any[] = [companyId];
    let statusClause = '';
    if (status !== 'all') {
      params.push(status);
      statusClause = ` AND fa.status = $${params.length}`;
    }

    const assetsResult = await db.query(
      `SELECT fa.id,
              fa.asset_number,
              fa.name,
              fa.purchase_date,
              fa.purchase_price,
              fa.depreciation_method,
              fa.useful_life_months,
              fa.residual_value,
              fa.accumulated_depreciation,
              fa.book_value,
              fa.status,
              fa.location,
              fa.currency,
              ac.name AS category_name
       FROM fixed_assets fa
       LEFT JOIN asset_categories ac ON ac.id = fa.category_id
       WHERE fa.company_id = $1
       ${statusClause}
       ORDER BY fa.asset_number ASC`,
      params
    );
    const assets = assetsResult.rows;

    const currencyRpc = {
      rpc: async (fn: string, args: any) => {
        if (fn !== 'convert_currency') {
          return { data: null, error: new Error('Unsupported RPC function') };
        }
        const result = await db.query<{ value: number }>(
          `SELECT convert_currency($1::numeric, $2::text, $3::text, $4::date) AS value`,
          [args.p_amount, args.p_from_currency, args.p_to_currency, args.p_date]
        );
        return { data: result.rows[0]?.value ?? null, error: null };
      },
    };

    // Transform and calculate depreciation for each asset
    const assetDepreciationsPromises = (assets || []).map(async (asset: any) => {
      const depCalc = calculateDepreciation(
        asset.purchase_date,
        parseFloat(asset.purchase_price) || 0,
        parseFloat(asset.residual_value) || 0,
        parseInt(asset.useful_life_months) || 0,
        asset.depreciation_method || 'straight_line',
        parseFloat(asset.accumulated_depreciation) || 0
      );

      const schedule = generateDepreciationSchedule(
        parseFloat(asset.purchase_price) || 0,
        parseFloat(asset.residual_value) || 0,
        parseInt(asset.useful_life_months) || 0,
        depCalc.annualDepreciation
      );

      return {
        assetId: asset.id,
        assetNumber: asset.asset_number || '',
        assetName: asset.name || '',
        category: asset.category_name || 'Uncategorized',
        purchaseDate: asset.purchase_date,
        purchasePrice: parseFloat(asset.purchase_price) || 0,
        depreciationMethod: asset.depreciation_method || 'straight_line',
        usefulLifeMonths: parseInt(asset.useful_life_months) || 0,
        residualValue: parseFloat(asset.residual_value) || 0,
        currentBookValue: depCalc.bookValue,
        accumulatedDepreciation: depCalc.accumulatedDepreciation,
        annualDepreciation: depCalc.annualDepreciation,
        monthlyDepreciation: depCalc.monthlyDepreciation,
        remainingLifeMonths: depCalc.remainingMonths,
        status: asset.status || 'active',
        location: asset.location || '',
        depreciationSchedule: schedule
      };
    });

    let assetDepreciations: AssetDepreciation[] = await Promise.all(assetDepreciationsPromises);

    // Filter by category
    if (category !== 'all') {
      assetDepreciations = assetDepreciations.filter(
        a => a.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Sort assets
    assetDepreciations.sort((a, b) => {
      switch (sortBy) {
        case 'assetName':
          return a.assetName.localeCompare(b.assetName);
        case 'purchaseDate':
          return new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime();
        case 'bookValue':
          return b.currentBookValue - a.currentBookValue;
        case 'category':
          return a.category.localeCompare(b.category);
        default:
          return a.assetNumber.localeCompare(b.assetNumber);
      }
    });

    // Calculate summary statistics with currency conversion to USD
    let totalCost = 0;
    let totalAccumulatedDepreciation = 0;
    let totalBookValue = 0;
    let annualDepreciation = 0;
    let monthlyDepreciation = 0;

    for (const asset of assetDepreciations) {
      const assetData = assets?.find((a: any) => a.id === asset.assetId);
      const assetCurrency = (assetData?.currency || 'USD') as SupportedCurrency;

      // Convert purchase price to USD
      const costUSD = await convertCurrency(
        currencyRpc,
        asset.purchasePrice,
        assetCurrency,
        'USD' as SupportedCurrency
      ) || asset.purchasePrice;

      // Convert accumulated depreciation to USD
      const accumulatedUSD = await convertCurrency(
        currencyRpc,
        asset.accumulatedDepreciation,
        assetCurrency,
        'USD' as SupportedCurrency
      ) || asset.accumulatedDepreciation;

      // Convert book value to USD
      const bookValueUSD = await convertCurrency(
        currencyRpc,
        asset.currentBookValue,
        assetCurrency,
        'USD' as SupportedCurrency
      ) || asset.currentBookValue;

      // Convert annual depreciation to USD
      const annualDepUSD = await convertCurrency(
        currencyRpc,
        asset.annualDepreciation,
        assetCurrency,
        'USD' as SupportedCurrency
      ) || asset.annualDepreciation;

      // Convert monthly depreciation to USD
      const monthlyDepUSD = await convertCurrency(
        currencyRpc,
        asset.monthlyDepreciation,
        assetCurrency,
        'USD' as SupportedCurrency
      ) || asset.monthlyDepreciation;

      totalCost += costUSD;
      totalAccumulatedDepreciation += accumulatedUSD;
      totalBookValue += bookValueUSD;
      annualDepreciation += annualDepUSD;
      monthlyDepreciation += monthlyDepUSD;
    }
    const activeAssets = assetDepreciations.filter(a => a.status === 'active').length;
    const fullyDepreciated = assetDepreciations.filter(a => a.status === 'fully_depreciated').length;

    // Category breakdown with currency conversion
    const byCategory: Record<string, any> = {};
    for (const asset of assetDepreciations) {
      const assetData = assets?.find((a: any) => a.id === asset.assetId);
      const assetCurrency = (assetData?.currency || 'USD') as SupportedCurrency;
      
      const cat = asset.category || 'Uncategorized';
      if (!byCategory[cat]) {
        byCategory[cat] = { count: 0, cost: 0, accumulated: 0, bookValue: 0 };
      }
      
      const costUSD = await convertCurrency(currencyRpc, asset.purchasePrice, assetCurrency, 'USD' as SupportedCurrency) || asset.purchasePrice;
      const accUSD = await convertCurrency(currencyRpc, asset.accumulatedDepreciation, assetCurrency, 'USD' as SupportedCurrency) || asset.accumulatedDepreciation;
      const bookUSD = await convertCurrency(currencyRpc, asset.currentBookValue, assetCurrency, 'USD' as SupportedCurrency) || asset.currentBookValue;
      
      byCategory[cat].count += 1;
      byCategory[cat].cost += costUSD;
      byCategory[cat].accumulated += accUSD;
      byCategory[cat].bookValue += bookUSD;
    }

    // Method breakdown with currency conversion
    const byMethod: Record<string, any> = {};
    for (const asset of assetDepreciations) {
      const assetData = assets?.find((a: any) => a.id === asset.assetId);
      const assetCurrency = (assetData?.currency || 'USD') as SupportedCurrency;
      
      const method = asset.depreciationMethod || 'straight_line';
      if (!byMethod[method]) {
        byMethod[method] = { count: 0, cost: 0 };
      }
      
      const costUSD = await convertCurrency(currencyRpc, asset.purchasePrice, assetCurrency, 'USD' as SupportedCurrency) || asset.purchasePrice;
      
      byMethod[method].count += 1;
      byMethod[method].cost += costUSD;
    }

    const response: DepreciationScheduleData = {
      reportPeriod: {
        startDate,
        endDate
      },
      summary: {
        totalAssets: assetDepreciations.length,
        totalOriginalCost: totalCost,
        totalCurrentValue: totalBookValue,
        totalAccumulatedDepreciation,
        annualDepreciationExpense: annualDepreciation,
        monthlyDepreciationExpense: monthlyDepreciation,
        activeAssets,
        fullyDepreciated
      },
      assets: assetDepreciations,
      byCategory,
      byMethod
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Depreciation schedule report error:', error);
    return NextResponse.json(
      { error: 'Failed to generate depreciation schedule report' },
      { status: 500 }
    );
  }
}

