export type DepreciationMethod = "STRAIGHT_LINE" | "REDUCING_BALANCE" | "NONE";

export interface DepreciationResult {
  ageYears:   number;
  ageMonths:  number;
  ageTotalMonths: number;
  ageDisplay: string;

  acquisitionValue:     number;
  residualValue:        number;
  depreciableAmount:    number;
  depreciationPerMonth: number;
  depreciationPerYear:  number;
  accumulatedDepr:      number;
  netBookValue:         number;

  depreciationPct:  number;
  isFullyDepreciated: boolean;
  replacementDue:   Date;

  nextDepreciationDate: Date;
  lastDepreciationDate: Date | null;
}

export function calcDepreciation(
  purchaseDate:   Date | string | null | undefined,
  acquisitionVal: number | string | null | undefined,
  residualVal:    number | string | null | undefined,
  usefulLifeYrs:  number,
  method: DepreciationMethod = "STRAIGHT_LINE"
): DepreciationResult | null {
  if (!purchaseDate || !acquisitionVal) return null;

  const now         = new Date();
  const purchase    = new Date(purchaseDate);
  const acqVal      = Number(acquisitionVal);
  const resVal      = Number(residualVal ?? 0);
  const depreciable = Math.max(0, acqVal - resVal);

  if (acqVal <= 0 || usefulLifeYrs <= 0) return null;

  const totalMonths = Math.max(
    0,
    (now.getFullYear()  - purchase.getFullYear())  * 12 +
    (now.getMonth()     - purchase.getMonth())
  );
  const ageYears  = Math.floor(totalMonths / 12);
  const ageMonths = totalMonths % 12;
  const ageDisplay =
    ageYears > 0 && ageMonths > 0 ? `${ageYears} yr${ageYears > 1 ? "s" : ""} ${ageMonths} month${ageMonths > 1 ? "s" : ""}`
    : ageYears > 0                ? `${ageYears} year${ageYears > 1 ? "s" : ""}`
    : ageMonths > 0               ? `${ageMonths} month${ageMonths > 1 ? "s" : ""}`
    :                               "< 1 month";

  const totalLifeMonths    = usefulLifeYrs * 12;
  const depreciationPerMonth = method === "STRAIGHT_LINE"
    ? depreciable / totalLifeMonths
    : (depreciable / totalLifeMonths);

  const depreciationPerYear = depreciationPerMonth * 12;

  const rawAccumulated = depreciationPerMonth * totalMonths;
  const accumulatedDepr = Math.min(rawAccumulated, depreciable);

  const netBookValue = Math.max(resVal, acqVal - accumulatedDepr);

  const depreciationPct    = depreciable > 0 ? Math.min(100, (accumulatedDepr / depreciable) * 100) : 0;
  const isFullyDepreciated = accumulatedDepr >= depreciable;

  const replacementDue = new Date(purchase);
  replacementDue.setFullYear(replacementDue.getFullYear() + usefulLifeYrs);

  const today = new Date();
  let nextDeprDate = new Date(today.getFullYear(), today.getMonth(), 24);
  if (today.getDate() > 24) {
    nextDeprDate = new Date(today.getFullYear(), today.getMonth() + 1, 24);
  }

  let lastDepreciationDate: Date | null = null;
  if (totalMonths > 0) {
    lastDepreciationDate = new Date(today.getFullYear(), today.getMonth() - 1, 24);
    if (lastDepreciationDate < purchase) lastDepreciationDate = null;
  }

  return {
    ageYears, ageMonths, ageTotalMonths: totalMonths, ageDisplay,
    acquisitionValue: acqVal, residualValue: resVal,
    depreciableAmount: depreciable,
    depreciationPerMonth, depreciationPerYear,
    accumulatedDepr, netBookValue,
    depreciationPct, isFullyDepreciated,
    replacementDue, nextDepreciationDate: nextDeprDate, lastDepreciationDate,
  };
}

export function fmtNGNDepr(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    style:           "currency",
    currency:        "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function generateDepreciationSchedule(
  acquisitionVal:  number,
  residualVal:     number,
  usefulLifeYrs:   number,
  purchaseDate:    Date
): Array<{ year: number; opening: number; charge: number; closing: number; cumulative: number }> {
  const depreciable  = Math.max(0, acquisitionVal - residualVal);
  const annualCharge = depreciable / usefulLifeYrs;
  const schedule     = [];
  let opening        = acquisitionVal;
  let cumulative     = 0;

  for (let yr = 1; yr <= usefulLifeYrs; yr++) {
    const charge  = Math.min(annualCharge, opening - residualVal);
    const closing = Math.max(residualVal, opening - charge);
    cumulative   += charge;
    schedule.push({
      year:       purchaseDate.getFullYear() + yr - 1,
      opening:    Math.round(opening * 100) / 100,
      charge:     Math.round(charge  * 100) / 100,
      closing:    Math.round(closing * 100) / 100,
      cumulative: Math.round(cumulative * 100) / 100,
    });
    opening = closing;
  }

  return schedule;
}

