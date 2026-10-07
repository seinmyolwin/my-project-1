/**
 * Safe Financial & Monetary Calculation Utility
 * Handles floating-point inaccuracies, rounding, negative values, zero, and large amounts.
 */

/**
 * Safely rounds a numeric value to the nearest integer, avoiding IEEE 754 float precision glitches.
 * E.g., 0.1 + 0.2 -> 0.30000000000000004 -> 0
 */
export function safeRound(num: number): number {
  if (num === null || num === undefined || isNaN(num) || !isFinite(num)) {
    return 0;
  }
  return Math.round(num + Number.EPSILON);
}

/**
 * Safely formats any amount into standard localized currency text.
 * Tested against: 0, 1000, 10000, 100000, 999999, 1000000, 10000000, negatives, large amounts.
 */
export function formatAmount(amount: number, currency: string = 'Ks'): string {
  if (amount === null || amount === undefined || isNaN(amount) || !isFinite(amount)) {
    return `0 ${currency}`;
  }

  const rounded = safeRound(amount);
  const isNeg = rounded < 0;
  const absVal = Math.abs(rounded);
  const formattedAbs = absVal.toLocaleString('en-US');

  return isNeg ? `-${formattedAbs} ${currency}` : `${formattedAbs} ${currency}`;
}

/**
 * Calculate net payable amount after applying percentage discount.
 * Uses integer arithmetic to prevent floating point drift.
 */
export function calculateNetPayable(subtotal: number, discountPercent: number): {
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  netPayable: number;
} {
  const safeSubtotal = Math.max(0, safeRound(subtotal));
  const safeDiscountPct = Math.min(100, Math.max(0, safeRound(discountPercent)));

  const discountAmount = safeRound((safeSubtotal * safeDiscountPct) / 100);
  const netPayable = Math.max(0, safeSubtotal - discountAmount);

  return {
    subtotal: safeSubtotal,
    discountPercent: safeDiscountPct,
    discountAmount,
    netPayable
  };
}

/**
 * Calculate commission earned on forwarded bets.
 */
export function calculateCommission(totalAmount: number, commissionRate: number): {
  totalAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netPaid: number;
} {
  const safeTotal = Math.max(0, safeRound(totalAmount));
  const safeRate = Math.min(100, Math.max(0, safeRound(commissionRate)));

  const commissionAmount = safeRound((safeTotal * safeRate) / 100);
  const netPaid = Math.max(0, safeTotal - commissionAmount);

  return {
    totalAmount: safeTotal,
    commissionRate: safeRate,
    commissionAmount,
    netPaid
  };
}

/**
 * Calculate winning payout for a given bet amount and odds/multiplier.
 */
export function calculatePayout(betAmount: number, multiplier: number): number {
  const safeBet = Math.max(0, safeRound(betAmount));
  const safeMult = Math.max(0, Number(multiplier) || 0);

  return safeRound(safeBet * safeMult);
}

/**
 * Self-verification test cases for monetary calculation integrity
 */
export function verifyMoneyCalculations(): boolean {
  const testAmounts = [
    0,
    1000,
    10000,
    100000,
    999999,
    1000000,
    10000000,
    -5000,
    150000000 // Large practical amount (150 Million Ks)
  ];

  for (const amt of testAmounts) {
    const formatted = formatAmount(amt);
    if (!formatted.includes('Ks')) return false;

    const netRes = calculateNetPayable(amt, 10);
    if (isNaN(netRes.netPayable) || netRes.netPayable < 0 && amt >= 0) return false;

    const payout = calculatePayout(amt, 600);
    if (isNaN(payout)) return false;
  }

  return true;
}
