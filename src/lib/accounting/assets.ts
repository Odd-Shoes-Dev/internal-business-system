import Decimal from 'decimal.js';

export interface DepreciableAssetInput {
  purchase_price: number;
  residual_value?: number;
  useful_life_months: number;
  depreciation_method: string;
  accumulated_depreciation?: number;
  depreciation_start_date?: string;
}

// Shared pure depreciation helper used by API routes.
export function calculateMonthlyDepreciation(asset: DepreciableAssetInput): Decimal {
  const cost = new Decimal(asset.purchase_price || 0);
  const residual = new Decimal(asset.residual_value || 0);
  const lifeMonths = Math.max(Number(asset.useful_life_months || 0), 1);
  const accumulated = new Decimal(asset.accumulated_depreciation || 0);
  const depreciableAmount = cost.minus(residual);
  const remainingValue = cost.minus(accumulated).minus(residual);

  if (remainingValue.lessThanOrEqualTo(0)) {
    return new Decimal(0);
  }

  switch (asset.depreciation_method) {
    case 'straight_line': {
      return depreciableAmount.div(lifeMonths);
    }
    case 'reducing_balance': {
      const annualRate = new Decimal(2).div(lifeMonths);
      const bookValue = cost.minus(accumulated);
      let monthly = bookValue.times(annualRate).div(12);

      if (bookValue.minus(monthly).lessThan(residual)) {
        monthly = bookValue.minus(residual);
      }
      return monthly.greaterThan(0) ? monthly : new Decimal(0);
    }
    default:
      return depreciableAmount.div(lifeMonths);
  }
}

export function generateDepreciationSchedule(asset: DepreciableAssetInput): Array<{
  month: string;
  depreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
}> {
  if (!asset.depreciation_start_date) {
    return [];
  }

  const schedule: Array<{
    month: string;
    depreciation: number;
    accumulatedDepreciation: number;
    bookValue: number;
  }> = [];

  let accumulated = new Decimal(asset.accumulated_depreciation || 0);
  const cost = new Decimal(asset.purchase_price || 0);
  const residual = new Decimal(asset.residual_value || 0);
  const startDate = new Date(asset.depreciation_start_date);
  const iterations = Math.max(Number(asset.useful_life_months || 0), 0);

  for (let i = 0; i < iterations; i++) {
    const currentDate = new Date(startDate);
    currentDate.setMonth(currentDate.getMonth() + i);

    const depreciation = calculateMonthlyDepreciation({
      ...asset,
      accumulated_depreciation: accumulated.toNumber(),
    });

    if (depreciation.lessThanOrEqualTo(0)) {
      break;
    }

    accumulated = accumulated.plus(depreciation);
    const bookValue = cost.minus(accumulated);

    schedule.push({
      month: currentDate.toISOString().substring(0, 7),
      depreciation: depreciation.toNumber(),
      accumulatedDepreciation: accumulated.toNumber(),
      bookValue: bookValue.toNumber(),
    });

    if (bookValue.lessThanOrEqualTo(residual)) {
      break;
    }
  }

  return schedule;
}
