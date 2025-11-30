/**
 * Billing utility functions
 */

const DEFAULT_FREE_TIER_LIMIT_USD = 5;
// Current billing cycle duration (monthly)
export const BILLING_CYCLE_DAYS = 30;
const DEFAULT_MIN_CHARGE_INR = 1; // Minimum charge to ensure test payments have a non-zero amount

// Free tier limit: defaults to $5, can be overridden for testing via env
export function getFreeTierLimitUSD() {
  const parsed = Number(process.env.FREE_TIER_LIMIT_USD);
  return Number.isFinite(parsed) ? parsed : DEFAULT_FREE_TIER_LIMIT_USD;
}

// Convert USD to INR (approximate, should use real-time rates in production)
const USD_TO_INR = 83;

/**
 * Calculate estimated pin cost in USD
 * Based on: ~$0.15/GB/month for pinning services
 */
export function calculateEstimatedPinCost(pinnedSizeBytes, durationDays = BILLING_CYCLE_DAYS) {
  const sizeGB = pinnedSizeBytes / (1024 * 1024 * 1024);
  const monthlyGBCost = 0.15; // $0.15 per GB per month
  const months = durationDays / 30;
  const totalCostUSD = sizeGB * monthlyGBCost * months;
  return totalCostUSD;
}

/**
 * Calculate monthly pin cost in USD
 */
export function calculateMonthlyPinCost(pinnedSizeBytes) {
  return calculateEstimatedPinCost(pinnedSizeBytes, BILLING_CYCLE_DAYS);
}

/**
 * Check if user exceeds free tier limit
 */
export function exceedsFreeTierLimit(pinnedSizeBytes) {
  const monthlyCost = calculateMonthlyPinCost(pinnedSizeBytes);
  return monthlyCost > getFreeTierLimitUSD();
}

/**
 * Calculate amount to charge (only amount over $5)
 */
export function calculateChargeAmount(pinnedSizeBytes) {
  const monthlyCost = calculateMonthlyPinCost(pinnedSizeBytes);
  const freeTierLimit = getFreeTierLimitUSD();
  if (monthlyCost <= freeTierLimit) {
    return 0;
  }
  // Charge only the amount over $5
  const chargeAmountUSD = monthlyCost - freeTierLimit;
  // Convert to INR and round to 2 decimal places
  const rawINR = Math.round(chargeAmountUSD * USD_TO_INR * 100) / 100;
  const minCharge = Number.isFinite(Number(process.env.MIN_CHARGE_INR))
    ? Math.max(Number(process.env.MIN_CHARGE_INR), DEFAULT_MIN_CHARGE_INR)
    : DEFAULT_MIN_CHARGE_INR;
  const chargeAmountINR = Math.max(rawINR, minCharge);
  return chargeAmountINR;
}

/**
 * Get billing day from account creation date
 */
export function getBillingDay(createdAt) {
  const date = new Date(createdAt);
  return date.getDate(); // Day of month (1-31)
}

/**
 * Check if today is billing day
 */
export function isBillingDay(billingDay) {
  const today = new Date();
  return today.getDate() === billingDay;
}

/**
 * Get next billing date
 */
export function getNextBillingDate(billingDay) {
  const today = new Date();
  const currentDay = today.getDate();
  
  if (currentDay < billingDay) {
    // Billing day is later this month
    return new Date(today.getFullYear(), today.getMonth(), billingDay);
  } else {
    // Billing day is next month
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, billingDay);
    return nextMonth;
  }
}

/**
 * Get billing period dates
 */
export function getBillingPeriod(billingDay) {
  const today = new Date();
  const currentDay = today.getDate();
  
  let periodStart, periodEnd;
  
  if (currentDay >= billingDay) {
    // Current period started this month
    periodStart = new Date(today.getFullYear(), today.getMonth(), billingDay);
    periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, billingDay);
  } else {
    // Current period started last month
    periodStart = new Date(today.getFullYear(), today.getMonth() - 1, billingDay);
    periodEnd = new Date(today.getFullYear(), today.getMonth(), billingDay);
  }
  
  return {
    start: periodStart.toISOString(),
    end: periodEnd.toISOString()
  };
}

