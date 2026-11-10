/**
 * 2D Optimal Safe Cap Limit & Smart Exposure Cap Calculation Engine
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
  globalLimit?: number;     // e.g. 200,000 Ks or shop default cap
}

export interface NumberCapBreakdown {
  number: string;
  stake: number;
  retained: number;
  forwarded: number;
}

export interface OptimalCapResult {
  totalSales: number;
  optimalCap: number;         // Smart Exposure Cap / Recommended Cap
  zeroRiskCap: number;        // Mathematical Zero-Risk Cap (Inflow / Multiplier)
  totalRetained: number;
  totalForwarded: number;
  netCashOnHand: number;
  worstCasePayout: number;
  worstCaseNet: number;       // > 0 is guaranteed profit, < 0 is potential risk
  isGuaranteedProfit: boolean;
  maxSingleStake: number;
  coveredNumbersCount: number;// Number of 2D numbers with bets (out of 100)
  emptyNumbersCount: number;  // Number of 2D numbers without bets (100 - covered)
  emptyWinProbability: number;// Probability of drawing an empty number (%)
  expectedNetValue: number;   // Average net profit across all 100 numbers (+EV)
  breakdown: NumberCapBreakdown[];
  downlineCommPercent: number;
  uplineCommPercent: number;
}

export function calculateOptimalSafeCap(input: CapCalculationInput): OptimalCapResult {
  const {
    betsList = [],
    multiplier = 80,
    maxRiskBudget = 0,
    globalLimit
  } = input;

  const downlineComm = input.downlineCommRate > 1 ? input.downlineCommRate / 100 : (input.downlineCommRate || 0);
  const uplineComm = input.uplineCommRate > 1 ? input.uplineCommRate / 100 : (input.uplineCommRate || 0);

  const totalSales = betsList.reduce((sum, item) => sum + (item.stake || 0), 0);
  const maxSingleStake = Math.max(...betsList.map(b => b.stake || 0), 0);

  // Inflow cash collected after downline commission
  const inflowCash = totalSales * (1 - downlineComm);

  // 1. Calculate Zero-Risk Cap (Pure mathematical cap where no loss is possible regardless of outcome)
  const zeroRiskCap = Math.max(0, Math.floor(inflowCash / Math.max(1, multiplier)));

  // Distribution statistics
  // Group bets by 2D number (00 to 99)
  const betsByNumber: Record<string, number> = {};
  betsList.forEach(item => {
    if (item.number) {
      betsByNumber[item.number] = (betsByNumber[item.number] || 0) + (item.stake || 0);
    }
  });

  const coveredNumbers = Object.keys(betsByNumber).filter(n => betsByNumber[n] > 0);
  const coveredNumbersCount = coveredNumbers.length;
  const emptyNumbersCount = Math.max(0, 100 - coveredNumbersCount);
  const emptyWinProbability = emptyNumbersCount; // since 100 numbers total (1% each)

  if (totalSales <= 0 || betsList.length === 0) {
    const defaultBaseline = (typeof globalLimit === 'number' && globalLimit > 0) ? Math.min(globalLimit, 50000) : 2000;
    return {
      totalSales: 0,
      optimalCap: defaultBaseline,
      zeroRiskCap: defaultBaseline,
      totalRetained: 0,
      totalForwarded: 0,
      netCashOnHand: 0,
      worstCasePayout: 0,
      worstCaseNet: 0,
      isGuaranteedProfit: true,
      maxSingleStake: 0,
      coveredNumbersCount: 0,
      emptyNumbersCount: 100,
      emptyWinProbability: 100,
      expectedNetValue: 0,
      breakdown: [],
      downlineCommPercent: Math.round(downlineComm * 100),
      uplineCommPercent: Math.round(uplineComm * 100)
    };
  }

  // 2. Candidate Evaluation for Option (C) - Smart Exposure Cap based on Distribution
  interface CandidateEvaluation {
    cap: number;
    retained: number;
    forwarded: number;
    netCash: number;
    worstPayout: number;
    worstCaseNet: number;
    expectedNetValue: number;
  }

  // Generate candidate cap values to test
  const candidateCapsSet = new Set<number>();
  candidateCapsSet.add(0);
  candidateCapsSet.add(zeroRiskCap);
  if (zeroRiskCap > 0) {
    candidateCapsSet.add(Math.ceil(zeroRiskCap / 50) * 50);
    candidateCapsSet.add(Math.ceil(zeroRiskCap / 100) * 100);
  }

  let step = 50;
  if (maxSingleStake > 500000) step = 5000;
  else if (maxSingleStake > 100000) step = 1000;
  else if (maxSingleStake > 20000) step = 500;
  else if (maxSingleStake > 5000) step = 100;
  else if (maxSingleStake > 1000) step = 50;
  else step = 10;

  for (let c = 0; c <= maxSingleStake; c += step) {
    candidateCapsSet.add(c);
  }
  candidateCapsSet.add(maxSingleStake);
  if (globalLimit && globalLimit > 0 && globalLimit <= maxSingleStake) {
    candidateCapsSet.add(globalLimit);
  }

  const sortedCandidates = Array.from(candidateCapsSet).sort((a, b) => a - b);

  const evaluations: CandidateEvaluation[] = sortedCandidates.map(c => {
    let retainedTotal = 0;
    for (const b of betsList) {
      retainedTotal += Math.min(b.stake, c);
    }
    const forwardedTotal = Math.max(0, totalSales - retainedTotal);
    const outflowCash = forwardedTotal * (1 - uplineComm);
    const netCash = inflowCash - outflowCash;

    // Calculate outcomes across all 100 numbers (00..99)
    let totalOutcomesNetSum = 0;
    let worstPayout = 0;
    let worstCaseNet = Infinity;

    for (let numIdx = 0; numIdx < 100; numIdx++) {
      const numStr = numIdx.toString().padStart(2, '0');
      const stakeOnNum = betsByNumber[numStr] || 0;
      const retainedOnNum = Math.min(stakeOnNum, c);
      const payoutOnNum = retainedOnNum * multiplier;
      const netOutcomeOnNum = netCash - payoutOnNum;

      totalOutcomesNetSum += netOutcomeOnNum;
      if (payoutOnNum > worstPayout) worstPayout = payoutOnNum;
      if (netOutcomeOnNum < worstCaseNet) worstCaseNet = netOutcomeOnNum;
    }

    const expectedNetValue = totalOutcomesNetSum / 100;

    return {
      cap: c,
      retained: retainedTotal,
      forwarded: forwardedTotal,
      netCash,
      worstPayout,
      worstCaseNet,
      expectedNetValue
    };
  });

  // Decision Logic for Option (C) Smart Exposure Cap:
  const allowedBudget = -Math.abs(maxRiskBudget);

  // Tier 1: Guaranteed Zero-Risk candidates (worstCaseNet >= allowedBudget)
  const zeroRiskCandidates = evaluations.filter(e => e.worstCaseNet >= allowedBudget && e.cap > 0);

  let best: CandidateEvaluation;

  if (zeroRiskCandidates.length > 0) {
    // Pick highest cap that guarantees no loss
    best = zeroRiskCandidates.reduce((max, e) => e.cap > max.cap ? e : max, zeroRiskCandidates[0]);
  } else {
    // Tier 2: Positive Expected Value (+EV) Smart Exposure candidates (expectedNetValue >= 0)
    const positiveEVCandidates = evaluations.filter(e => e.expectedNetValue >= 0 && e.cap > 0);

    if (positiveEVCandidates.length > 0) {
      // Pick candidate that gives a healthy balance of retention and positive expected value
      const reasonableEV = positiveEVCandidates.filter(e => e.worstPayout <= Math.max(e.netCash * 15, 20000));
      const pool = reasonableEV.length > 0 ? reasonableEV : positiveEVCandidates;
      
      best = pool.reduce((chosen, e) => {
        if (e.expectedNetValue > chosen.expectedNetValue) return e;
        if (Math.abs(e.expectedNetValue - chosen.expectedNetValue) < 10 && e.cap > chosen.cap) return e;
        return chosen;
      }, pool[0]);
    } else {
      // Tier 3: Fallback - pick candidate that maximizes expectedNetValue
      best = evaluations.reduce((chosen, e) => e.expectedNetValue > chosen.expectedNetValue ? e : chosen, evaluations[0]);
    }
  }

  if (!best) {
    best = evaluations[0];
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
    zeroRiskCap,
    totalRetained: best.retained,
    totalForwarded: best.forwarded,
    netCashOnHand: Math.round(best.netCash),
    worstCasePayout: Math.round(best.worstPayout),
    worstCaseNet: Math.round(best.worstCaseNet),
    isGuaranteedProfit: best.worstCaseNet >= 0,
    maxSingleStake,
    coveredNumbersCount,
    emptyNumbersCount,
    emptyWinProbability,
    expectedNetValue: Math.round(best.expectedNetValue),
    breakdown,
    downlineCommPercent: Math.round(downlineComm * 100),
    uplineCommPercent: Math.round(uplineComm * 100)
  };
}

export function evaluateCustomCap(customCap: number, input: CapCalculationInput): OptimalCapResult {
  const {
    betsList = [],
    multiplier = 80,
  } = input;

  const downlineComm = input.downlineCommRate > 1 ? input.downlineCommRate / 100 : (input.downlineCommRate || 0);
  const uplineComm = input.uplineCommRate > 1 ? input.uplineCommRate / 100 : (input.uplineCommRate || 0);

  const totalSales = betsList.reduce((sum, item) => sum + (item.stake || 0), 0);
  const maxSingleStake = Math.max(...betsList.map(b => b.stake || 0), 0);

  const inflowCash = totalSales * (1 - downlineComm);
  const zeroRiskCap = Math.max(0, Math.floor(inflowCash / Math.max(1, multiplier)));

  const betsByNumber: Record<string, number> = {};
  betsList.forEach(item => {
    if (item.number) {
      betsByNumber[item.number] = (betsByNumber[item.number] || 0) + (item.stake || 0);
    }
  });

  const coveredNumbers = Object.keys(betsByNumber).filter(n => betsByNumber[n] > 0);
  const coveredNumbersCount = coveredNumbers.length;
  const emptyNumbersCount = Math.max(0, 100 - coveredNumbersCount);
  const emptyWinProbability = emptyNumbersCount;

  const cap = Math.max(0, customCap);
  const retainedTotal = betsList.reduce((sum, b) => sum + Math.min(b.stake, cap), 0);
  const forwardedTotal = Math.max(0, totalSales - retainedTotal);

  const outflowCash = forwardedTotal * (1 - uplineComm);
  const netCash = inflowCash - outflowCash;

  let totalOutcomesNetSum = 0;
  let worstPayout = 0;
  let worstCaseNet = Infinity;

  for (let numIdx = 0; numIdx < 100; numIdx++) {
    const numStr = numIdx.toString().padStart(2, '0');
    const stakeOnNum = betsByNumber[numStr] || 0;
    const retainedOnNum = Math.min(stakeOnNum, cap);
    const payoutOnNum = retainedOnNum * multiplier;
    const netOutcomeOnNum = netCash - payoutOnNum;

    totalOutcomesNetSum += netOutcomeOnNum;
    if (payoutOnNum > worstPayout) worstPayout = payoutOnNum;
    if (netOutcomeOnNum < worstCaseNet) worstCaseNet = netOutcomeOnNum;
  }

  const expectedNetValue = totalOutcomesNetSum / 100;

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
    zeroRiskCap,
    totalRetained: retainedTotal,
    totalForwarded: forwardedTotal,
    netCashOnHand: Math.round(netCash),
    worstCasePayout: Math.round(worstPayout),
    worstCaseNet: Math.round(worstCaseNet),
    isGuaranteedProfit: worstCaseNet >= 0,
    maxSingleStake,
    coveredNumbersCount,
    emptyNumbersCount,
    emptyWinProbability,
    expectedNetValue: Math.round(expectedNetValue),
    breakdown,
    downlineCommPercent: Math.round(downlineComm * 100),
    uplineCommPercent: Math.round(uplineComm * 100)
  };
}
