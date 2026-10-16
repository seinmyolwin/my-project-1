/**
 * 2D Optimal Safe Cap Limit (အန္တရာယ်အကင်းဆုံး ဖြတ်စားရမည့် ဘရိတ်) Calculation Engine
 */

export interface NumberBetItem {
  number: string;
  stake: number;
}

export interface CapCalculationInput {
  betsList: NumberBetItem[];
  multiplier: number;       // default e.g. 80 or 85
  downlineCommRate: number; // e.g. 12 or 0.12 (အောက်လက် ကော်မရှင်)
  uplineCommRate: number;   // e.g. 10 or 0.10 (အထက်ဒိုင် ကော်မရှင်)
  maxRiskBudget?: number;   // default 0 (အများဆုံး အရှုံးခံနိုင်သည့် ပမာဏ)
}

export interface NumberCapBreakdown {
  number: string;
  stake: number;
  retained: number;
  forwarded: number;
}

export interface OptimalCapResult {
  totalSales: number;
  optimalCap: number;
  totalRetained: number;
  totalForwarded: number;
  netCashOnHand: number;
  worstCasePayout: number;
  worstCaseNet: number;     // > 0 is guaranteed profit, < 0 is potential risk
  isGuaranteedProfit: boolean;
  maxSingleStake: number;
  breakdown: NumberCapBreakdown[];
  downlineCommPercent: number;
  uplineCommPercent: number;
}

/**
 * Calculates the mathematically optimal safe cap that maximizes retention while minimizing worst-case risk
 */
export function calculateOptimalSafeCap(input: CapCalculationInput): OptimalCapResult {
  const {
    betsList = [],
    multiplier = 80,
    maxRiskBudget = 0
  } = input;

  // Normalize commission rates to decimals (0 to 1)
  const downlineComm = input.downlineCommRate > 1 ? input.downlineCommRate / 100 : (input.downlineCommRate || 0);
  const uplineComm = input.uplineCommRate > 1 ? input.uplineCommRate / 100 : (input.uplineCommRate || 0);

  const totalSales = betsList.reduce((sum, item) => sum + (item.stake || 0), 0);

  if (totalSales <= 0 || betsList.length === 0) {
    return {
      totalSales: 0,
      optimalCap: 0,
      totalRetained: 0,
      totalForwarded: 0,
      netCashOnHand: 0,
      worstCasePayout: 0,
      worstCaseNet: 0,
      isGuaranteedProfit: true,
      maxSingleStake: 0,
      breakdown: [],
      downlineCommPercent: Math.round(downlineComm * 100),
      uplineCommPercent: Math.round(uplineComm * 100)
    };
  }

  const maxSingleStake = Math.max(...betsList.map(b => b.stake || 0), 0);

  // Determine loop step size for optimal performance
  let step = 10;
  if (maxSingleStake > 500000) step = 500;
  else if (maxSingleStake > 100000) step = 200;
  else if (maxSingleStake > 20000) step = 50;
  else if (maxSingleStake > 5000) step = 20;

  // Inflow cash from downline (after deducting downline commission)
  const inflowCash = totalSales * (1 - downlineComm);

  interface CandidateEvaluation {
    cap: number;
    retained: number;
    forwarded: number;
    netCash: number;
    worstPayout: number;
    worstCaseNet: number;
  }

  const candidates: CandidateEvaluation[] = [];

  // Iterate from cap 0 up to maxSingleStake
  for (let c = 0; c <= maxSingleStake; c += step) {
    let retainedTotal = 0;
    for (let i = 0; i < betsList.length; i++) {
      retainedTotal += Math.min(betsList[i].stake, c);
    }
    const forwardedTotal = Math.max(0, totalSales - retainedTotal);
    const outflowCash = forwardedTotal * (1 - uplineComm);
    const netCash = inflowCash - outflowCash;

    // Worst-case payout happens if the number with highest retained stake hits
    const maxRetainedForSingleNumber = Math.min(maxSingleStake, c);
    const worstPayout = maxRetainedForSingleNumber * multiplier;
    const worstCaseNet = netCash - worstPayout;

    candidates.push({
      cap: c,
      retained: retainedTotal,
      forwarded: forwardedTotal,
      netCash,
      worstPayout,
      worstCaseNet
    });
  }

  // Also include exact maxSingleStake if loop stepped past it
  if (candidates.length > 0 && candidates[candidates.length - 1].cap < maxSingleStake) {
    let retainedTotal = 0;
    for (let i = 0; i < betsList.length; i++) {
      retainedTotal += Math.min(betsList[i].stake, maxSingleStake);
    }
    const forwardedTotal = Math.max(0, totalSales - retainedTotal);
    const outflowCash = forwardedTotal * (1 - uplineComm);
    const netCash = inflowCash - outflowCash;
    const worstPayout = maxSingleStake * multiplier;
    const worstCaseNet = netCash - worstPayout;

    candidates.push({
      cap: maxSingleStake,
      retained: retainedTotal,
      forwarded: forwardedTotal,
      netCash,
      worstPayout,
      worstCaseNet
    });
  }

  // Decision Logic:
  const allowedBudget = -Math.abs(maxRiskBudget);
  const safeCandidates = candidates.filter(cand => cand.worstCaseNet >= allowedBudget);

  let best: CandidateEvaluation;

  if (safeCandidates.length > 0) {
    const profitableCandidates = safeCandidates.filter(c => c.worstCaseNet >= 0);
    if (profitableCandidates.length > 0) {
      best = profitableCandidates[profitableCandidates.length - 1];
    } else {
      best = safeCandidates.reduce((max, c) => c.worstCaseNet > max.worstCaseNet ? c : max, safeCandidates[0]);
    }
  } else {
    best = candidates.reduce((max, c) => c.worstCaseNet > max.worstCaseNet ? c : max, candidates[0]);
  }

  const breakdown: NumberCapBreakdown[] = betsList.map(item => {
    const retained = Math.min(item.stake, best.cap);
    const forwarded = Math.max(0, item.stake - retained);
    return {
      number: item.number,
      stake: item.stake,
      retained,
      forwarded
    };
  }).sort((a, b) => b.stake - a.stake);

  return {
    totalSales,
    optimalCap: best.cap,
    totalRetained: best.retained,
    totalForwarded: best.forwarded,
    netCashOnHand: Math.round(best.netCash),
    worstCasePayout: Math.round(best.worstPayout),
    worstCaseNet: Math.round(best.worstCaseNet),
    isGuaranteedProfit: best.worstCaseNet >= 0,
    maxSingleStake,
    breakdown,
    downlineCommPercent: Math.round(downlineComm * 100),
    uplineCommPercent: Math.round(uplineComm * 100)
  };
}

/**
 * Evaluates any custom cap limit entered by the dealer for interactive testing/simulation
 */
export function evaluateCustomCap(customCap: number, input: CapCalculationInput): OptimalCapResult {
  const {
    betsList = [],
    multiplier = 80,
  } = input;

  const downlineComm = input.downlineCommRate > 1 ? input.downlineCommRate / 100 : (input.downlineCommRate || 0);
  const uplineComm = input.uplineCommRate > 1 ? input.uplineCommRate / 100 : (input.uplineCommRate || 0);

  const totalSales = betsList.reduce((sum, item) => sum + (item.stake || 0), 0);
  const maxSingleStake = Math.max(...betsList.map(b => b.stake || 0), 0);

  const cap = Math.max(0, customCap);
  const retainedTotal = betsList.reduce((sum, b) => sum + Math.min(b.stake, cap), 0);
  const forwardedTotal = Math.max(0, totalSales - retainedTotal);

  const inflowCash = totalSales * (1 - downlineComm);
  const outflowCash = forwardedTotal * (1 - uplineComm);
  const netCash = inflowCash - outflowCash;

  const maxRetainedSingle = Math.min(maxSingleStake, cap);
  const worstPayout = maxRetainedSingle * multiplier;
  const worstCaseNet = netCash - worstPayout;

  const breakdown: NumberCapBreakdown[] = betsList.map(item => {
    const retained = Math.min(item.stake, cap);
    const forwarded = Math.max(0, item.stake - retained);
    return {
      number: item.number,
      stake: item.stake,
      retained,
      forwarded
    };
  }).sort((a, b) => b.stake - a.stake);

  return {
    totalSales,
    optimalCap: cap,
    totalRetained: retainedTotal,
    totalForwarded: forwardedTotal,
    netCashOnHand: Math.round(netCash),
    worstCasePayout: Math.round(worstPayout),
    worstCaseNet: Math.round(worstCaseNet),
    isGuaranteedProfit: worstCaseNet >= 0,
    maxSingleStake,
    breakdown,
    downlineCommPercent: Math.round(downlineComm * 100),
    uplineCommPercent: Math.round(uplineComm * 100)
  };
}
