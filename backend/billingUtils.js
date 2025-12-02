/**
 * Billing utility functions
 * 
 * Pricing Model:
 * - Free tier: 5 GB
 * - Cost: $0.40/GB/month above free tier
 * - Using self-hosted IPFS node (no external pinning service costs)
 */

// Current billing cycle duration (monthly)
export const BILLING_CYCLE_DAYS = 30;
const DEFAULT_MIN_CHARGE_INR = 1; // Minimum charge to ensure test payments have a non-zero amount

// Free tier: 5 GB (can be overridden via env for testing)
const DEFAULT_FREE_TIER_GB = 5;

export function getFreeTierGB() {
  const parsed = Number(process.env.FREE_TIER_GB);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FREE_TIER_GB;
}

// Legacy function for backward compatibility
export function getFreeTierLimitUSD() {
  // Convert GB to USD equivalent for display purposes
  return getFreeTierGB() * getCostPerGB();
}

// Cost per GB per month: $0.40/GB
const DEFAULT_COST_PER_GB = 0.40;

export function getCostPerGB() {
  const parsed = Number(process.env.COST_PER_GB_USD);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_COST_PER_GB;
}

// Convert USD to INR (approximate, should use real-time rates in production)
const USD_TO_INR = 83;

/**
 * Calculate storage in GB from bytes
 */
export function bytesToGB(bytes) {
  return bytes / (1024 * 1024 * 1024);
}

/**
 * Calculate monthly cost in USD based on actual GB usage
 * Free tier: 5 GB
 * Cost: $0.40/GB/month above free tier
 */
export function calculateMonthlyPinCost(pinnedSizeBytes) {
  const sizeGB = bytesToGB(pinnedSizeBytes);
  const freeTierGB = getFreeTierGB();
  const costPerGB = getCostPerGB();
  
  if (sizeGB <= freeTierGB) {
    return 0;
  }
  
  const billableGB = sizeGB - freeTierGB;
  return billableGB * costPerGB;
}

/**
 * Calculate estimated pin cost in USD (legacy function for backward compatibility)
 */
export function calculateEstimatedPinCost(pinnedSizeBytes, durationDays = BILLING_CYCLE_DAYS) {
  const monthlyCost = calculateMonthlyPinCost(pinnedSizeBytes);
  const months = durationDays / 30;
  return monthlyCost * months;
}

/**
 * Check if user exceeds free tier limit
 */
export function exceedsFreeTierLimit(pinnedSizeBytes) {
  const sizeGB = bytesToGB(pinnedSizeBytes);
  return sizeGB > getFreeTierGB();
}

/**
 * Calculate amount to charge in INR (only amount over free tier)
 */
export function calculateChargeAmount(pinnedSizeBytes) {
  const monthlyCostUSD = calculateMonthlyPinCost(pinnedSizeBytes);
  
  if (monthlyCostUSD <= 0) {
    return 0;
  }
  
  // Convert to INR and round to 2 decimal places
  const rawINR = Math.round(monthlyCostUSD * USD_TO_INR * 100) / 100;
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

