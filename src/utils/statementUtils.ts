import { evaluateTwoDWinnings, normalizeTwoDMultiplier } from './twoDLotteryUtils';
import { evaluateWinnings, calculate3DForwardMasterPayout } from './lotteryUtils';
import { TwoDVoucher, TwoDDrawRound, Voucher, DrawRound, FootballSlip, ForwardSlip } from '../types';
import {
  CommissionBusinessMode,
  ScopedCommissionRates,
  getCustomerCommissionRates,
  getCustomerCommissionRatesByMode,
  getAllRoundCustomerCommissions,
  resolveCustomerCommissionRate,
  getUplineCommissionRates,
  getUplineCommissionRatesByMode,
  getAllRoundUplineCommissions,
  resolveUplineCommissionRate
} from './commissionUtils';


export interface StatementRecord {
  id: string;
  date: string;
  mode: '3d' | '2d' | 'football';
  modeLabel: string;
  name: string;
  session?: 'morning' | 'evening' | 'special';
  winningResult: string;
  turnover: number;          // ၁။ မူလထိုးကြေး စုစုပေါင်း (Gross Turnover - ဘာမှမနုတ်ထား)
  totalForwarded: number;    // ၂။ အထက်တင်ကြေး (Total Forwarded to Master Bookie)
  agentCommission: number;   // ၃။ အောက်လက်ကော်မရှင်ခ (Agent Discount Out - ကိုယ်က ပေးရငွေ)
  netSales: number;          // ၄။ အမှန်ရောင်းငွေ (Net Sales Retained = Turnover - Forwarded - AgentCommission)
  masterPayout: number;      // ၅။ အထက်ပေါက်ကြေး (Master Payout In - ဒိုင်ကြီးဆီမှ ပြန်ရငွေ)
  forwardCommission: number; // ၆။ အထက်ကော်မရှင်ခ (Master Commission In - ကိုယ်ရငွေ)
  totalPayout: number;       // ၇။ ပေးလျှော်ငွေ (Gross Payout to all customers)
  payout: number;            // ဒိုင်ပေးလျော်ငွေ (Retained Payout = Total Payout - Master Payout)
  netPaid: number;           // ဒိုင်ကြီးဆီ အမှန်ပေးငွေ (Total Forwarded - Forward Commission)
  netProfit: number;         // ၈။ ဒိုင် အသားတင် အမြတ်/အရှုံး (အမှန်ရောင်းငွေ + အထက်ပေါက်ကြေး + အထက်ကော်မရှင်ခ - ပေးလျှော်ငွေ)
  isProfit: boolean;
  winnersCount: number;
  vouchersCount: number;
  status: 'settled' | 'open' | 'closed';
  rawRoundId?: string;
  vouchersList?: any[];      // ဘောင်ချာများ တစောင်ချင်း စစ်ဆေးနိုင်ရန်
  forwardList?: any[];       // လွှဲစာရင်းများ
}

export interface StatementGrandTotals {
  totalTurnover: number;
  totalForwarded: number;
  totalAgentCommission: number;
  netSales: number;
  totalMasterPayout: number;
  totalForwardCommission: number;
  totalPayout: number;
  retainedPayout: number;
  totalNetPaid: number;
  totalNetProfit: number;
  isProfit: boolean;
  totalWinners: number;
  totalVouchers: number;
}

export type StatementPeriodPreset = 'all' | 'today' | 'two_days' | 'three_days' | 'five_days' | 'week' | 'month' | 'custom';

/**
 * Safely calculates the true gross turnover (မူလထိုးကြေး စုစုပေါင်း) for a 2D or 3D voucher.
 * Prioritizes summing the individual items array (which contains whole integer bet amounts)
 * to avoid fractional kyat values or 1-kyat offsets from discount rounding.
 */
export function getVoucherGrossTurnover(v: any): number {
  if (!v) return 0;

  // 1. If v.items exists and has valid items, sum items directly without mutating valid amounts
  if (v.items && Array.isArray(v.items) && v.items.length > 0) {
    const itemsSum = v.items.reduce((sum: number, it: any) => sum + (Number(it?.amount) || 0), 0);
    if (itemsSum > 0) {
      return Math.round(itemsSum);
    }
  }

  // 2. Check raw subtotal, stakeAmount, or netPayable
  let rawAmt = Number(v.subtotal);
  if (isNaN(rawAmt) || rawAmt <= 0) rawAmt = Number(v.stakeAmount);
  if (isNaN(rawAmt) || rawAmt <= 0) rawAmt = Number(v.netPayable);
  if (isNaN(rawAmt) || rawAmt <= 0) return 0;

  const roundedAmt = Math.round(rawAmt);

  // If items are absent and subtotal clearly matches an already-saved gross or zero-discount ticket, keep it exact
  if (roundedAmt % 50 === 0 || !v.discountPercent || v.discountAmount > 0 || v.subtotal !== v.netPayable) {
    return roundedAmt;
  }

  // 3. Only when items are absent AND subtotal appears stored as a discounted net amount (e.g. 33,181 with discountAmount=0):
  const discPercent = Number(v.discountPercent);
  if (discPercent > 0 && discPercent < 100) {
    const recovered = roundedAmt / (1 - discPercent / 100);
    const cleanGross = Math.round(recovered / 50) * 50;
    return cleanGross > 0 ? cleanGross : roundedAmt;
  }

  return roundedAmt;
}

// Local date string helper (YYYY-MM-DD) based on user's timezone
export function getLocalDateStr(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDaysAgoStr(days: number, baseDate: Date = new Date()): string {
  const d = new Date(baseDate);
  d.setDate(d.getDate() - days);
  return getLocalDateStr(d);
}

export function getStatementDateRange(
  preset: StatementPeriodPreset,
  customStart?: string,
  customEnd?: string,
  today: Date = new Date()
): { startDate: string; endDate: string } {
  const todayStr = getLocalDateStr(today);
  switch (preset) {
    case 'all':
      return { startDate: '2020-01-01', endDate: '2099-12-31' };
    case 'today':
      return { startDate: todayStr, endDate: todayStr };
    case 'two_days':
      return { startDate: getDaysAgoStr(1, today), endDate: todayStr }; // Today + Yesterday (2 days)
    case 'three_days':
      return { startDate: getDaysAgoStr(2, today), endDate: todayStr }; // Today, Yesterday, 2 days ago (3 days)
    case 'five_days':
      return { startDate: getDaysAgoStr(4, today), endDate: todayStr }; // 5 days
    case 'week':
      return { startDate: getDaysAgoStr(6, today), endDate: todayStr }; // 7 days (1 week)
    case 'month':
      return { startDate: getDaysAgoStr(29, today), endDate: todayStr }; // 30 days (1 month)
    case 'custom':
    default:
      return {
        startDate: customStart || getDaysAgoStr(4, today),
        endDate: customEnd || todayStr
      };
  }
}

export function getStatementPeriodLabel(preset: StatementPeriodPreset): string {
  switch (preset) {
    case 'all': return 'ကာလအားလုံး စာရင်းရှင်းတမ်း';
    case 'today': return 'ဒီနေ့ စာရင်းရှင်းတမ်း (၁ ရက်စာ)';
    case 'two_days': return '၂ ရက်စာ စာရင်းရှင်းတမ်း';
    case 'three_days': return '၃ ရက်စာ စာရင်းရှင်းတမ်း';
    case 'five_days': return '၅ ရက်တဖြတ် စာရင်းရှင်းတမ်း';
    case 'week': return '၁ ပတ်စာ စာရင်းရှင်းတမ်း';
    case 'month': return '၁ လစာ စာရင်းရှင်းတမ်း';
    case 'custom': return 'ရက်ရွေး စာရင်းရှင်းတမ်း (စိတ်ကြိုက်)';
    default: return 'စာရင်းရှင်းတမ်း';
  }
}

export interface StatementDataSources {
  lottery2D: {
    rounds: TwoDDrawRound[];
    vouchers: TwoDVoucher[];
    forwardSlips: any[];
    settings: {
      defaultMultiplier?: number;
      defaultCommissionRate?: number;
      defaultCustomerDiscount?: number;
      currency?: string;
    };
  };
  lottery3D: {
    rounds: DrawRound[];
    vouchers: Voucher[];
    forwardSlips: ForwardSlip[];
    settings: {
      defaultMultiplier?: number;
      defaultToddMultiplier?: number;
      defaultCommissionRate?: number;
      defaultCustomerDiscount?: number;
      currency?: string;
    };
  };
  football: {
    slips: FootballSlip[];
    forwardSlips: any[];
    settings?: {
      defaultCommissionRate?: number;
      defaultCustomerDiscount?: number;
      currency?: string;
    };
  };
}

export function getResolvedVoucherCommission(params: {
  voucher: any;
  mode: CommissionBusinessMode;
  roundKey?: string;
  defaultDownlineRate: number;
  globalRates?: Record<string, number>;
  globalRatesByMode?: ScopedCommissionRates;
  roundRates?: Record<string, Record<string, number>>;
}): { rate: number; amount: number; isExplicit: boolean; gross: number } {
  const v = params.voucher || {};
  const gross =
    params.mode === 'football' && !Array.isArray(v.items) && v.subtotal === undefined
      ? (Number(v.stakeAmount) || Number(v.netPayable) || 0)
      : getVoucherGrossTurnover(v);

  const resolved = resolveCustomerCommissionRate({
    mode: params.mode,
    roundKey: params.roundKey,
    customerName: v.customerName,
    defaultRate: params.defaultDownlineRate,
    globalRates: params.globalRates,
    globalRatesByMode: params.globalRatesByMode,
    roundRates: params.roundRates
  });

  if (resolved.isExplicit) {
    return {
      rate: resolved.rate,
      amount: resolved.rate > 0 ? Math.round((gross * resolved.rate) / 100) : 0,
      isExplicit: true,
      gross
    };
  }

  if (params.mode === '3d') {
    const fallbackRate = params.defaultDownlineRate || 0;
    return {
      rate: fallbackRate,
      amount: fallbackRate > 0 ? Math.round((gross * fallbackRate) / 100) : 0,
      isExplicit: false,
      gross
    };
  }

  // 2D & Football fallback when no explicit per-round or per-customer-per-business rate exists
  if (typeof v.discountAmount === 'number' && v.discountAmount > 0) {
    const pct =
      typeof v.discountPercent === 'number' && v.discountPercent > 0
        ? v.discountPercent
        : params.defaultDownlineRate;
    return { rate: pct, amount: v.discountAmount, isExplicit: false, gross };
  }
  if (typeof v.discountPercent === 'number' && v.discountPercent > 0) {
    return {
      rate: v.discountPercent,
      amount: Math.round((gross * v.discountPercent) / 100),
      isExplicit: false,
      gross
    };
  }
  const fallbackRate = params.defaultDownlineRate || 0;
  return {
    rate: fallbackRate,
    amount: fallbackRate > 0 ? Math.round((gross * fallbackRate) / 100) : 0,
    isExplicit: false,
    gross
  };
}

export function getResolvedForwardCommission(params: {
  forwardSlip: any;
  mode: CommissionBusinessMode;
  roundKey?: string;
  defaultUplineRate: number;
  uplineGlobalRates?: Record<string, number>;
  uplineGlobalRatesByMode?: ScopedCommissionRates;
  uplineRoundRates?: Record<string, Record<string, number>>;
}): { rate: number; amount: number; isExplicit: boolean } {
  const f = params.forwardSlip || {};
  const amt = Number(f.totalAmount ?? f.stakeAmount ?? 0) || 0;
  const resolved = resolveUplineCommissionRate({
    mode: params.mode,
    roundKey: params.roundKey,
    masterAgentName: f.masterAgentName,
    defaultRate: params.defaultUplineRate,
    uplineGlobalRates: params.uplineGlobalRates,
    uplineGlobalRatesByMode: params.uplineGlobalRatesByMode,
    uplineRoundRates: params.uplineRoundRates
  });

  if (resolved.isExplicit) {
    return {
      rate: resolved.rate,
      amount: resolved.rate > 0 ? Math.round((amt * resolved.rate) / 100) : 0,
      isExplicit: true
    };
  }

  if (params.mode === '3d') {
    if (typeof f.commissionRate === 'number' && f.commissionRate > 0) {
      const amount =
        typeof f.commissionAmount === 'number' && f.commissionAmount > 0
          ? f.commissionAmount
          : Math.round((amt * f.commissionRate) / 100);
      return { rate: f.commissionRate, amount, isExplicit: false };
    }
    const fallbackRate = params.defaultUplineRate || 0;
    return {
      rate: fallbackRate,
      amount: fallbackRate > 0 ? Math.round((amt * fallbackRate) / 100) : 0,
      isExplicit: false
    };
  }

  // 2D or Football fallback when no explicit per-dealer rate is set
  if (typeof f.commissionAmount === 'number' && f.commissionAmount > 0) {
    const rate = typeof f.commissionRate === 'number' ? f.commissionRate : params.defaultUplineRate;
    return { rate, amount: f.commissionAmount, isExplicit: false };
  }
  if (typeof f.commissionRate === 'number' && f.commissionRate > 0) {
    return {
      rate: f.commissionRate,
      amount: Math.round((amt * f.commissionRate) / 100),
      isExplicit: false
    };
  }
  if (typeof f.commissionRate !== 'number' && params.defaultUplineRate > 0) {
    return {
      rate: params.defaultUplineRate,
      amount: Math.round((amt * params.defaultUplineRate) / 100),
      isExplicit: false
    };
  }
  return { rate: 0, amount: f.commissionAmount || 0, isExplicit: false };
}

/**
 * Universal Single Source of Truth for generating Financial Statement Records across 2D, 3D and Football.
 */
export function generateStatementRecords(
  data: StatementDataSources,
  mode: 'all' | '3d' | '2d' | 'football',
  startDate: string,
  endDate: string,
  commissionOverrides?: {
    globalRates?: Record<string, number>;
    globalRatesByMode?: ScopedCommissionRates;
    roundRates?: Record<string, Record<string, number>>;
    uplineGlobalRates?: Record<string, number>;
    uplineGlobalRatesByMode?: ScopedCommissionRates;
    uplineRoundRates?: Record<string, Record<string, number>>;
  }
): StatementRecord[] {
  const list: StatementRecord[] = [];
  const todayStr = getLocalDateStr();
  const baseCustomerByMode = commissionOverrides?.globalRatesByMode ?? getCustomerCommissionRatesByMode();
  const globalRatesByMode: ScopedCommissionRates = {
    '2d': mode === '2d' && commissionOverrides?.globalRates ? commissionOverrides.globalRates : baseCustomerByMode['2d'],
    '3d': mode === '3d' && commissionOverrides?.globalRates ? commissionOverrides.globalRates : baseCustomerByMode['3d'],
    'football': mode === 'football' && commissionOverrides?.globalRates ? commissionOverrides.globalRates : baseCustomerByMode['football']
  };
  const roundRates = commissionOverrides?.roundRates ?? getAllRoundCustomerCommissions();

  const baseUplineByMode = commissionOverrides?.uplineGlobalRatesByMode ?? getUplineCommissionRatesByMode();
  const uplineGlobalRatesByMode: ScopedCommissionRates = {
    '2d': mode === '2d' && commissionOverrides?.uplineGlobalRates ? commissionOverrides.uplineGlobalRates : baseUplineByMode['2d'],
    '3d': mode === '3d' && commissionOverrides?.uplineGlobalRates ? commissionOverrides.uplineGlobalRates : baseUplineByMode['3d'],
    'football': mode === 'football' && commissionOverrides?.uplineGlobalRates ? commissionOverrides.uplineGlobalRates : baseUplineByMode['football']
  };
  const uplineRoundRates = commissionOverrides?.uplineRoundRates ?? getAllRoundUplineCommissions();

  // ====================================================
  // 1. Process 2D (ဇီးကွက်)
  // ====================================================
  if (mode === 'all' || mode === '2d') {
    const processedRoundIds = new Set<string>();
    const allRoundIds2D = new Set(data.lottery2D.rounds.map((r) => r.id));

    data.lottery2D.rounds.forEach((round) => {
      const roundDate = (round.drawDate || '').slice(0, 10);
      // ONLY include rounds where winning number has been entered and confirmed/saved!
      if (roundDate >= startDate && roundDate <= endDate && round.winningNumber && round.winningNumber.trim() !== '') {
        processedRoundIds.add(round.id);

        const rawRoundVouchers = data.lottery2D.vouchers.filter(
          (v) => (v.roundId ? v.roundId === round.id : (!v.roundId && (v.createdAt || '').slice(0, 10) === roundDate)) &&
                 v.status !== 'cancelled'
        );
        const roundVouchers = rawRoundVouchers.filter(v => !v.deletedAt);

        // Forward slips must strictly belong to this specific round only (no cross-round leakage)
        const roundForwards = data.lottery2D.forwardSlips.filter(
          (f) => f.roundId === round.id && !(f as any).deletedAt
        );

        let totalTurnover = 0;
        let totalAgentCommission = 0;

        const roundKey2D = `2d-${round.id}`;
        const fallback2D = typeof data.lottery2D.settings?.defaultCustomerDiscount === 'number'
          ? data.lottery2D.settings.defaultCustomerDiscount
          : 0;
        roundVouchers.forEach((v) => {
          const resolvedVouch = getResolvedVoucherCommission({
            voucher: v,
            mode: '2d',
            roundKey: roundKey2D,
            defaultDownlineRate: fallback2D,
            globalRatesByMode,
            roundRates
          });

          totalTurnover += resolvedVouch.gross;
          totalAgentCommission += resolvedVouch.amount;
        });

        // Forward slips to master bookie
        let totalForwarded = 0;
        let forwardCommission = 0;
        const defaultUpline2D = data.lottery2D.settings.defaultCommissionRate ?? 0;
        roundForwards.forEach((f) => {
          totalForwarded += f.totalAmount || 0;
          const resolvedFwd = getResolvedForwardCommission({
            forwardSlip: f,
            mode: '2d',
            roundKey: roundKey2D,
            defaultUplineRate: defaultUpline2D,
            uplineGlobalRatesByMode,
            uplineRoundRates
          });
          forwardCommission += resolvedFwd.amount;
        });
        const netPaid = totalForwarded - forwardCommission;

        // Payout & Master Payout calculation
        let totalPayout = 0;
        let masterPayout = 0;
        let retainedPayout = 0;
        let winnersCount = 0;
        const winningNum = round.winningNumber ? round.winningNumber.padStart(2, '0') : undefined;
        let mult = round.multiplier || data.lottery2D.settings.defaultMultiplier;

        if (winningNum) {
          const evalResult = evaluateTwoDWinnings(roundVouchers, winningNum, mult);
          winnersCount = evalResult.totalWinnersCount;

          let totalSoldForWinNum = 0;
          roundVouchers.forEach((v) => {
            v.items.forEach((it) => {
              if (it.number === winningNum) totalSoldForWinNum += it.amount;
            });
          });
          let totalForwardedForWinNum = 0;
          roundForwards.forEach((f) => {
            f.items.forEach((it) => {
              if (it.number === winningNum) totalForwardedForWinNum += it.amount;
            });
          });

          totalPayout = mult > 0 ? totalSoldForWinNum * mult : 0;
          masterPayout = mult > 0 ? totalForwardedForWinNum * mult : 0;
          const retainedAmount = Math.max(0, totalSoldForWinNum - totalForwardedForWinNum);
          retainedPayout = mult > 0 ? retainedAmount * mult : 0;
        } else {
          roundVouchers.forEach((v) => {
            v.items.forEach((it) => {
              if (it.isWon) {
                const amt = (it.wonAmount || (it.amount * mult));
                totalPayout += amt;
                retainedPayout += amt;
                winnersCount += 1;
              }
            });
          });
        }

        // Exact Formula requested by user:
        // ၁။ အမှန်ရောင်းငွေ = စုစုပေါင်းထိုးကြေး (မူလအတိုင်း) - အထက်တင်ကြေး - အောက်လက်ကော်မရှင်ခ
        const netSales = totalTurnover - totalForwarded - totalAgentCommission;

        // ၂။ ဒိုင်အသားတင် အမြတ်/အရှုံး = အမှန်ရောင်းငွေ + အထက်ပေါက်ကြေး + အထက်ကော်မရှင်ခ - ပေးလျှော်ငွေ
        const netProfit = netSales + masterPayout + forwardCommission - totalPayout;

        list.push({
          id: `2d-${round.id}`,
          date: roundDate,
          mode: '2d',
          modeLabel: 'ဇီးကွက်',
          name: round.name || `${roundDate} ${round.session === 'morning' ? 'မနက် (12:01)' : 'ညနေ (04:30)'}`,
          session: round.session,
          winningResult: winningNum || (round.status === 'settled' ? 'ပေါက်မဲမရှိ' : 'မထွက်သေး'),
          turnover: totalTurnover,
          totalForwarded,
          agentCommission: totalAgentCommission,
          netSales,
          masterPayout,
          forwardCommission,
          totalPayout,
          payout: retainedPayout,
          netPaid,
          netProfit,
          isProfit: netProfit >= 0,
          winnersCount,
          vouchersCount: roundVouchers.length,
          status: round.status,
          rawRoundId: round.id,
          vouchersList: roundVouchers,
          forwardList: roundForwards
        });
      }
    });

    // Catch any orphaned vouchers without round assigned
    const rawOrphanedVouchers = data.lottery2D.vouchers.filter(v => {
      const vDate = (v.createdAt || '').slice(0, 10);
      return vDate >= startDate && vDate <= endDate && v.status !== 'cancelled' && (!v.roundId || !allRoundIds2D.has(v.roundId));
    });
    const orphanedVouchers = rawOrphanedVouchers.filter(v => !v.deletedAt);

    if (orphanedVouchers.length > 0) {
      const groupedByDate: { [d: string]: typeof orphanedVouchers } = {};
      orphanedVouchers.forEach(v => {
        const d = (v.createdAt || '').slice(0, 10) || todayStr;
        if (!groupedByDate[d]) groupedByDate[d] = [];
        groupedByDate[d].push(v);
      });

      Object.keys(groupedByDate).forEach(d => {
        const vList = groupedByDate[d];
        let turnover = 0;
        let agentCommission = 0;
        let payout = 0;
        let winnersCount = 0;

        const orphanKey2D = `2d-orphaned-${d}`;
        const fallback2D = typeof data.lottery2D.settings?.defaultCustomerDiscount === 'number'
          ? data.lottery2D.settings.defaultCustomerDiscount
          : 0;
        vList.forEach(v => {
          const resolvedVouch = getResolvedVoucherCommission({
            voucher: v,
            mode: '2d',
            roundKey: orphanKey2D,
            defaultDownlineRate: fallback2D,
            globalRatesByMode,
            roundRates
          });

          turnover += resolvedVouch.gross;
          agentCommission += resolvedVouch.amount;
          v.items.forEach(it => {
            if (it.isWon) {
              payout += (it.wonAmount || (it.amount * (data.lottery2D.settings.defaultMultiplier || 0)));
              winnersCount += 1;
            }
          });
        });

        const netSales = turnover - agentCommission;
        const netProfit = netSales - payout;

        list.push({
          id: `2d-orphaned-${d}`,
          date: d,
          mode: '2d',
          modeLabel: 'ဇီးကွက်',
          name: `${d} ဇီးကွက် အရောင်းမှတ်တမ်းများ`,
          session: 'morning',
          winningResult: payout > 0 ? `${winnersCount} ဦးပေါက်` : 'မထွက်သေး',
          turnover,
          totalForwarded: 0,
          agentCommission,
          netSales,
          masterPayout: 0,
          forwardCommission: 0,
          totalPayout: payout,
          payout,
          netPaid: 0,
          netProfit,
          isProfit: netProfit >= 0,
          winnersCount,
          vouchersCount: vList.length,
          status: payout > 0 ? 'settled' : 'open',
          vouchersList: vList,
          forwardList: []
        });
      });
    }
  }

  // ====================================================
  // 2. Process 3D (အိုးစည်လေး)
  // ====================================================
  if (mode === 'all' || mode === '3d') {
    const processed3DRoundIds = new Set<string>();
    const allRoundIds3D = new Set(data.lottery3D.rounds.map((r) => r.id));

    data.lottery3D.rounds.forEach((round) => {
      const roundDate = (round.drawDate || '').slice(0, 10);
      // ONLY include rounds where winning number has been entered and confirmed/saved!
      if (roundDate >= startDate && roundDate <= endDate && round.winningNumber && round.winningNumber.trim() !== '') {
        processed3DRoundIds.add(round.id);

        const raw3DRoundVouchers = data.lottery3D.vouchers.filter(
          (v) => (v.roundId ? v.roundId === round.id : (!v.roundId && (v.createdAt || '').slice(0, 10) === roundDate)) &&
                 v.status !== 'cancelled'
        );
        const roundVouchers = raw3DRoundVouchers.filter(v => !v.deletedAt);

        // 3D Forward slips must strictly belong to this specific round only (no cross-round leakage)
        const roundForwards = data.lottery3D.forwardSlips.filter(
          (f) => f.roundId === round.id && !(f as any).deletedAt
        );

        // Per-round / per-customer commission rate with Settings defaultCustomerDiscount as fallback
        const downlineRate = typeof data.lottery3D.settings?.defaultCustomerDiscount === 'number'
          ? data.lottery3D.settings.defaultCustomerDiscount
          : 0;
        const uplineRate = typeof data.lottery3D.settings?.defaultCommissionRate === 'number'
          ? data.lottery3D.settings.defaultCommissionRate
          : 0;
        const isRoundFrozen = round.status === 'settled' || round.status === 'closed' || !!round.winningNumber;
        const straightMult = isRoundFrozen && typeof round.multiplier === 'number' && round.multiplier > 0
          ? round.multiplier
          : (typeof data.lottery3D.settings?.defaultMultiplier === 'number'
            ? data.lottery3D.settings.defaultMultiplier
            : (typeof round.multiplier === 'number' ? round.multiplier : 0));
        const toddMult = isRoundFrozen && typeof round.toddMultiplier === 'number' && round.toddMultiplier >= 0
          ? round.toddMultiplier
          : (typeof data.lottery3D.settings?.defaultToddMultiplier === 'number'
            ? data.lottery3D.settings.defaultToddMultiplier
            : (typeof round.toddMultiplier === 'number' ? round.toddMultiplier : 0));

        let totalTurnover = 0;
        let totalAgentCommission = 0;
        const roundKey3D = `3d-${round.id}`;

        roundVouchers.forEach((v) => {
          const resolvedVouch = getResolvedVoucherCommission({
            voucher: v,
            mode: '3d',
            roundKey: roundKey3D,
            defaultDownlineRate: downlineRate,
            globalRatesByMode,
            roundRates
          });

          totalTurnover += resolvedVouch.gross;
          totalAgentCommission += resolvedVouch.amount;
        });

        // 3D Forward slips to master bookie
        let totalForwarded = 0;
        let forwardCommission = 0;
        roundForwards.forEach((f) => {
          const amt = f.totalAmount || 0;
          totalForwarded += amt;
          const resolvedFwd = getResolvedForwardCommission({
            forwardSlip: f,
            mode: '3d',
            roundKey: roundKey3D,
            defaultUplineRate: uplineRate,
            uplineGlobalRatesByMode,
            uplineRoundRates
          });
          forwardCommission += resolvedFwd.amount;
        });
        const netPaid = totalForwarded - forwardCommission;

        let totalPayout = 0;
        let masterPayout = 0;
        let retainedPayout = 0;
        let winnersCount = 0;
        const winningNum = round.winningNumber ? round.winningNumber.padStart(3, '0') : undefined;

        if (winningNum) {
          const evalResult = evaluateWinnings(roundVouchers, winningNum, straightMult, toddMult);
          winnersCount = evalResult.winningBetsCount + evalResult.toddWinningBetsCount;

          totalPayout = evalResult.totalPayout;
          masterPayout = calculate3DForwardMasterPayout(roundForwards, winningNum, straightMult, toddMult);
          retainedPayout = Math.max(0, totalPayout - masterPayout);
        } else {
          roundVouchers.forEach((v) => {
            v.items.forEach((it) => {
              if (it.isWon) {
                const amt = (it.wonAmount || (it.amount * straightMult));
                totalPayout += amt;
                retainedPayout += amt;
                winnersCount += 1;
              }
            });
          });
        }

        const netSales = totalTurnover - totalForwarded - totalAgentCommission;
        const netProfit = netSales + masterPayout + forwardCommission - totalPayout;

        list.push({
          id: `3d-${round.id}`,
          date: roundDate,
          mode: '3d',
          modeLabel: 'အိုးစည်လေး',
          name: round.name || `${roundDate} ထီဖွင့်ပွဲ`,
          winningResult: winningNum || (round.status === 'settled' ? 'ပေါက်မဲမရှိ' : 'မထွက်သေး'),
          turnover: totalTurnover,
          totalForwarded,
          agentCommission: totalAgentCommission,
          netSales,
          masterPayout,
          forwardCommission,
          totalPayout,
          payout: retainedPayout,
          netPaid,
          netProfit,
          isProfit: netProfit >= 0,
          winnersCount,
          vouchersCount: roundVouchers.length,
          status: round.status,
          rawRoundId: round.id,
          vouchersList: roundVouchers,
          forwardList: roundForwards
        });
      }
    });

    // Catch any orphaned 3D vouchers without round
    const raw3DOrphaned = data.lottery3D.vouchers.filter(v => {
      const vDate = (v.createdAt || '').slice(0, 10);
      return vDate >= startDate && vDate <= endDate && v.status !== 'cancelled' && (!v.roundId || !allRoundIds3D.has(v.roundId));
    });
    const orphaned3DVouchers = raw3DOrphaned.filter(v => !v.deletedAt);

    if (orphaned3DVouchers.length > 0) {
      const grouped3DByDate: { [d: string]: typeof orphaned3DVouchers } = {};
      orphaned3DVouchers.forEach(v => {
        const d = (v.createdAt || '').slice(0, 10) || todayStr;
        if (!grouped3DByDate[d]) grouped3DByDate[d] = [];
        grouped3DByDate[d].push(v);
      });

      Object.keys(grouped3DByDate).forEach(d => {
        const vList = grouped3DByDate[d];
        let turnover = 0;
        let agentCommission = 0;
        let payout = 0;
        let winnersCount = 0;

        const downlineRate = typeof data.lottery3D.settings?.defaultCustomerDiscount === 'number'
          ? data.lottery3D.settings.defaultCustomerDiscount
          : 0;
        const straightMult = typeof data.lottery3D.settings?.defaultMultiplier === 'number'
          ? data.lottery3D.settings.defaultMultiplier
          : 0;

        const orphanKey3D = `3d-orphaned-${d}`;
        vList.forEach(v => {
          const resolvedVouch = getResolvedVoucherCommission({
            voucher: v,
            mode: '3d',
            roundKey: orphanKey3D,
            defaultDownlineRate: downlineRate,
            globalRatesByMode,
            roundRates
          });

          turnover += resolvedVouch.gross;
          agentCommission += resolvedVouch.amount;
          v.items.forEach(it => {
            if (it.isWon) {
              payout += (it.wonAmount || (it.amount * straightMult));
              winnersCount += 1;
            }
          });
        });

        const netSales = turnover - agentCommission;
        const netProfit = netSales - payout;

        list.push({
          id: `3d-orphaned-${d}`,
          date: d,
          mode: '3d',
          modeLabel: 'အိုးစည်လေး',
          name: `${d} 3D အရောင်းမှတ်တမ်းများ`,
          winningResult: payout > 0 ? `${winnersCount} ဦးပေါက်` : 'မထွက်သေး',
          turnover,
          totalForwarded: 0,
          agentCommission,
          netSales,
          masterPayout: 0,
          forwardCommission: 0,
          totalPayout: payout,
          payout,
          netPaid: 0,
          netProfit,
          isProfit: netProfit >= 0,
          winnersCount,
          vouchersCount: vList.length,
          status: payout > 0 ? 'settled' : 'open',
          vouchersList: vList,
          forwardList: []
        });
      });
    }
  }

  // ====================================================
  // 3. Process Football (ပစ်တိုင်းထောင်)
  // ====================================================
  if (mode === 'all' || mode === 'football') {
    const rawSlips = data.football.slips.filter((s) => {
      const slipDate = s.roundDate || (s.createdAt || '').slice(0, 10);
      return slipDate >= startDate && slipDate <= endDate && s.status !== 'cancelled';
    });
    const slips = rawSlips.filter(s => !s.deletedAt);

    if (slips.length > 0) {
      const slipsByDate: { [date: string]: FootballSlip[] } = {};
      slips.forEach((s) => {
        const d = s.roundDate || (s.createdAt || '').slice(0, 10) || todayStr;
        if (!slipsByDate[d]) slipsByDate[d] = [];
        slipsByDate[d].push(s);
      });

      Object.keys(slipsByDate).forEach((d) => {
        const daySlips = slipsByDate[d];
        const dayForwards = data.football.forwardSlips.filter((f) => {
          if ((f as any).deletedAt) return false;
          const fDate = f.roundDate || (f.createdAt || '').slice(0, 10);
          return fDate === d;
        });

        let turnover = 0;
        let agentCommission = 0;
        let totalPayout = 0;
        let masterPayout = 0;
        let retainedPayout = 0;
        let winnersCount = 0;

        const roundKeyFB = `football-${d}`;
        const fallbackFB = typeof data.football.settings?.defaultCustomerDiscount === 'number'
          ? data.football.settings.defaultCustomerDiscount
          : 0;
        daySlips.forEach((s) => {
          const resolvedSlip = getResolvedVoucherCommission({
            voucher: s,
            mode: 'football',
            roundKey: roundKeyFB,
            defaultDownlineRate: fallbackFB,
            globalRatesByMode,
            roundRates
          });
          const stake = resolvedSlip.gross;

          turnover += stake;
          agentCommission += resolvedSlip.amount;

          // Forward ratio for this slip
          const forwardedStakeForSlip = dayForwards
            .filter((f) => f.slipId === s.id || (f.slipNo && f.slipNo === s.slipNo))
            .reduce((sum, f) => sum + (f.stakeAmount || f.totalAmount || 0), 0);
          const forwardRatio = stake > 0 ? Math.min(1, forwardedStakeForSlip / stake) : 0;

          const isSettledOrEvaluated =
            s.status === 'settled' ||
            s.outcome === 'won' ||
            s.outcome === 'half_won' ||
            s.outcome === 'draw' ||
            s.outcome === 'half_lost' ||
            s.outcome === 'lost';
          const actPayout = !isSettledOrEvaluated
            ? 0
            : typeof s.actualPayout === 'number'
            ? s.actualPayout
            : (s.outcome === 'won' || s.outcome === 'half_won')
            ? (s.potentialPayout || 0)
            : 0;

          totalPayout += actPayout;
          const slipMasterPayout = actPayout * forwardRatio;
          masterPayout += slipMasterPayout;
          retainedPayout += (actPayout - slipMasterPayout);

          if (s.outcome === 'won' || s.outcome === 'half_won') {
            winnersCount += 1;
          }
        });

        let totalForwarded = 0;
        let forwardCommission = 0;
        const defaultUplineFB = data.football.settings?.defaultCommissionRate ?? 0;
        dayForwards.forEach((f) => {
          const fwdAmt = f.stakeAmount || f.totalAmount || 0;
          totalForwarded += fwdAmt;
          const resolvedFwd = getResolvedForwardCommission({
            forwardSlip: f,
            mode: 'football',
            roundKey: roundKeyFB,
            defaultUplineRate: defaultUplineFB,
            uplineGlobalRatesByMode,
            uplineRoundRates
          });
          forwardCommission += resolvedFwd.amount;
        });
        const netPaid = totalForwarded - forwardCommission;

        const netSales = turnover - totalForwarded - agentCommission;
        const netProfit = netSales + masterPayout + forwardCommission - totalPayout;
        const allSettled = daySlips.every((s) => s.status === 'settled');

        list.push({
          id: `football-${d}`,
          date: d,
          mode: 'football',
          modeLabel: 'ပစ်တိုင်းထောင်',
          name: `${d} ပစ်တိုင်းထောင် မောင်း/ဘော်ဒီ ရှင်းတမ်း`,
          winningResult: winnersCount > 0 ? `${winnersCount} စလစ် ပေါက်` : allSettled ? 'စလစ်အားလုံး ရှင်းပြီး' : 'ပွဲစဉ် ဖွင့်လှစ်ဆဲ',
          turnover,
          totalForwarded,
          agentCommission,
          netSales,
          masterPayout,
          forwardCommission,
          totalPayout,
          payout: retainedPayout,
          netPaid,
          netProfit,
          isProfit: netProfit >= 0,
          winnersCount,
          vouchersCount: daySlips.length,
          status: allSettled ? 'settled' : 'open',
          vouchersList: daySlips,
          forwardList: dayForwards
        });
      });
    }
  }

  // Sort newest first
  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function computeStatementGrandTotals(records: StatementRecord[]): StatementGrandTotals {
  let totalTurnover = 0;
  let totalForwarded = 0;
  let totalAgentCommission = 0;
  let netSales = 0;
  let totalMasterPayout = 0;
  let totalForwardCommission = 0;
  let totalPayout = 0;
  let retainedPayout = 0;
  let totalNetPaid = 0;
  let totalNetProfit = 0;
  let totalWinners = 0;
  let totalVouchers = 0;

  records.forEach((r) => {
    totalTurnover += r.turnover;
    totalForwarded += r.totalForwarded;
    totalAgentCommission += r.agentCommission;
    netSales += r.netSales;
    totalMasterPayout += (r.masterPayout || 0);
    totalForwardCommission += r.forwardCommission;
    totalPayout += (r.totalPayout || r.payout);
    retainedPayout += r.payout;
    totalNetPaid += r.netPaid;
    totalNetProfit += r.netProfit;
    totalWinners += r.winnersCount;
    totalVouchers += r.vouchersCount;
  });

  return {
    totalTurnover,
    totalForwarded,
    totalAgentCommission,
    netSales,
    totalMasterPayout,
    totalForwardCommission,
    totalPayout,
    retainedPayout,
    totalNetPaid,
    totalNetProfit,
    isProfit: totalNetProfit >= 0,
    totalWinners,
    totalVouchers
  };
}

// ====================================================
// SINGLE-ROUND ISOLATED FINANCIAL BREAKDOWN (2D & 3D)
// ဤပွဲစဉ်အတွက်သာ သီးသန့် ရှင်းတမ်း တွက်ချက်မှု (Header Tab စံနှုန်းအတိုင်း)
// ====================================================

export interface SingleRoundFinancialBreakdown {
  turnover: number;          // ၁။ မူလထိုးကြေး စုစုပေါင်း
  totalForwarded: number;    // ၂။ အထက်တင်ကြေး (ဒိုင်ကြီးဆီ လွှဲငွေ)
  agentCommission: number;   // ၃။ အောက်လက်ကော် (ကိုယ်က ပေးရငွေ)
  netSales: number;          // ၄။ အမှန်ရောင်းငွေ (ဒိုင်လက်ကျန်ရောင်းငွေ) = turnover - totalForwarded - agentCommission
  masterPayout: number;      // ၅။ အထက်ပေါက်ကြေး (ဒိုင်ကြီး ပြန်လျော်ငွေ)
  forwardCommission: number; // ၆။ အထက်ကော်မရှင် (ကိုယ်ရငွေ)
  totalPayout: number;       // ၇။ ပေးလျှော်ငွေ (အောက်လက်ပေါက်ကြေး အားလုံးပေါင်း)
  retainedPayout: number;    // ဒိုင်တာဝန် ပေးလျော်ငွေ (totalPayout - masterPayout)
  netPaid: number;           // ဒိုင်ကြီးဆီ အမှန်ပေးငွေ (totalForwarded - forwardCommission)
  netProfit: number;         // ၈။ ဒိုင်အသားတင် အမြတ်/အရှုံး = netSales + masterPayout + forwardCommission - totalPayout
  isProfit: boolean;
  profitMargin: number;      // %
  winnersCount: number;
  vouchersCount: number;
}

export interface TwoDSingleRoundStatementParams {
  round: TwoDDrawRound | null;
  vouchers: TwoDVoucher[];
  forwardSlips: ForwardSlip[];
  winningNumber?: string;
  multiplier?: number;
  settings: any;
  globalRates?: Record<string, number>;
  roundRates?: Record<string, Record<string, number>>;
  uplineGlobalRates?: Record<string, number>;
  uplineRoundRates?: Record<string, Record<string, number>>;
}

export function calculateTwoDSingleRoundStatement(
  params: TwoDSingleRoundStatementParams
): SingleRoundFinancialBreakdown {
  const { round, vouchers, forwardSlips, winningNumber, multiplier, settings } = params;
  const globalRates = params.globalRates ?? getCustomerCommissionRates('2d');
  const roundRates = params.roundRates ?? getAllRoundCustomerCommissions();
  const uplineGlobalRates = params.uplineGlobalRates ?? getUplineCommissionRates('2d');
  const uplineRoundRates = params.uplineRoundRates ?? getAllRoundUplineCommissions();
  const roundKey2D = round ? `2d-${round.id}` : undefined;

  // 1. Turnover & Agent Commission (Vouchers for this round only, active/not cancelled)
  let totalTurnover = 0;
  let totalAgentCommission = 0;

  const validVouchers = vouchers.filter((v) => v.status !== 'cancelled' && !v.deletedAt);
  const fallback2D = typeof settings?.defaultCustomerDiscount === 'number'
    ? settings.defaultCustomerDiscount
    : 0;

  validVouchers.forEach((v) => {
    const resolvedVouch = getResolvedVoucherCommission({
      voucher: v,
      mode: '2d',
      roundKey: roundKey2D,
      defaultDownlineRate: fallback2D,
      globalRates,
      roundRates
    });

    totalTurnover += resolvedVouch.gross;
    totalAgentCommission += resolvedVouch.amount;
  });

  // 2. Forwarded slips to master bookie for this round
  let totalForwarded = 0;
  let forwardCommission = 0;
  const defaultUpline2D = settings?.defaultCommissionRate ?? 0;
  const activeForwards = forwardSlips.filter((f) => !(f as any).deletedAt);
  activeForwards.forEach((f) => {
    totalForwarded += f.totalAmount || 0;
    const resolvedFwd = getResolvedForwardCommission({
      forwardSlip: f,
      mode: '2d',
      roundKey: roundKey2D,
      defaultUplineRate: defaultUpline2D,
      uplineGlobalRates,
      uplineRoundRates
    });
    forwardCommission += resolvedFwd.amount;
  });
  const netPaid = totalForwarded - forwardCommission;

  // 3. Multiplier & Winning number evaluation
  const mult = normalizeTwoDMultiplier(multiplier || round?.multiplier || settings?.defaultMultiplier);
  const winNum = winningNumber ? winningNumber.trim().padStart(2, '0') : (round?.winningNumber ? round.winningNumber.trim().padStart(2, '0') : undefined);

  let totalPayout = 0;
  let masterPayout = 0;
  let retainedPayout = 0;
  let winnersCount = 0;

  if (winNum && winNum.length === 2) {
    const evalResult = evaluateTwoDWinnings(validVouchers, winNum, mult);
    winnersCount = evalResult.totalWinnersCount;

    let totalSoldForWinNum = 0;
    validVouchers.forEach((v) => {
      v.items.forEach((it) => {
        if (it.number === winNum) totalSoldForWinNum += it.amount;
      });
    });

    let totalForwardedForWinNum = 0;
    activeForwards.forEach((f) => {
      f.items.forEach((it) => {
        if (it.number === winNum) totalForwardedForWinNum += it.amount;
      });
    });

    totalPayout = mult > 0 ? totalSoldForWinNum * mult : 0;
    masterPayout = mult > 0 ? totalForwardedForWinNum * mult : 0;
    const retainedAmount = Math.max(0, totalSoldForWinNum - totalForwardedForWinNum);
    retainedPayout = mult > 0 ? retainedAmount * mult : 0;
  } else {
    validVouchers.forEach((v) => {
      v.items.forEach((it) => {
        if (it.isWon) {
          const amt = (it.wonAmount || (it.amount * mult));
          totalPayout += amt;
          retainedPayout += amt;
          winnersCount += 1;
        }
      });
    });
  }

  // Exact formulas requested:
  // ၁။ အမှန်ရောင်းငွေ = စုစုပေါင်းထိုးကြေး - အထက်တင်ကြေး - အောက်လက်ကော်
  const netSales = totalTurnover - totalForwarded - totalAgentCommission;

  // ၂။ ဒိုင်အသားတင် အမြတ်/အရှုံး = အမှန်ရောင်းငွေ + အထက်ပေါက်ကြေး + အထက်ကော်မရှင် - ပေးလျှော်ငွေ
  const netProfit = netSales + masterPayout + forwardCommission - totalPayout;
  const isProfit = netProfit >= 0;
  const profitMargin = totalTurnover > 0 ? Math.round((Math.abs(netProfit) / totalTurnover) * 100) : 0;

  return {
    turnover: totalTurnover,
    totalForwarded,
    agentCommission: totalAgentCommission,
    netSales,
    masterPayout,
    forwardCommission,
    totalPayout,
    retainedPayout,
    netPaid,
    netProfit,
    isProfit,
    profitMargin,
    winnersCount,
    vouchersCount: validVouchers.length
  };
}

export interface ThreeDSingleRoundStatementParams {
  round: DrawRound | null;
  vouchers: Voucher[];
  forwardSlips: ForwardSlip[];
  winningNumber?: string;
  multiplier?: number;
  toddMultiplier?: number;
  settings: any;
  globalRates?: Record<string, number>;
  roundRates?: Record<string, Record<string, number>>;
  uplineGlobalRates?: Record<string, number>;
  uplineRoundRates?: Record<string, Record<string, number>>;
}

export function calculateThreeDSingleRoundStatement(
  params: ThreeDSingleRoundStatementParams
): SingleRoundFinancialBreakdown {
  const { round, vouchers, forwardSlips, winningNumber, multiplier, toddMultiplier, settings } = params;
  const globalRates = params.globalRates ?? getCustomerCommissionRates('3d');
  const roundRates = params.roundRates ?? getAllRoundCustomerCommissions();
  const uplineGlobalRates = params.uplineGlobalRates ?? getUplineCommissionRates('3d');
  const uplineRoundRates = params.uplineRoundRates ?? getAllRoundUplineCommissions();
  const roundKey3D = round ? `3d-${round.id}` : undefined;

  const downlineRate = typeof settings?.defaultCustomerDiscount === 'number'
    ? settings.defaultCustomerDiscount
    : 0;
  const uplineRate = typeof settings?.defaultCommissionRate === 'number'
    ? settings.defaultCommissionRate
    : 0;
  const isRoundFrozen = !!round && (round.status === 'settled' || round.status === 'closed' || !!round.winningNumber);
  const straightMult = isRoundFrozen && typeof round?.multiplier === 'number' && round.multiplier > 0
    ? round.multiplier
    : (typeof multiplier === 'number' && multiplier > 0
      ? multiplier
      : (typeof settings?.defaultMultiplier === 'number' ? settings.defaultMultiplier : 0));
  const toddMult = isRoundFrozen && typeof round?.toddMultiplier === 'number' && round.toddMultiplier >= 0
    ? round.toddMultiplier
    : (typeof toddMultiplier === 'number' && toddMultiplier >= 0
      ? toddMultiplier
      : (typeof settings?.defaultToddMultiplier === 'number' ? settings.defaultToddMultiplier : 0));

  let totalTurnover = 0;
  let totalAgentCommission = 0;

  const validVouchers = vouchers.filter((v) => v.status !== 'cancelled' && !v.deletedAt);

  validVouchers.forEach((v) => {
    const resolvedVouch = getResolvedVoucherCommission({
      voucher: v,
      mode: '3d',
      roundKey: roundKey3D,
      defaultDownlineRate: downlineRate,
      globalRates,
      roundRates
    });

    totalTurnover += resolvedVouch.gross;
    totalAgentCommission += resolvedVouch.amount;
  });

  const activeForwards = forwardSlips.filter((f) => !(f as any).deletedAt);
  let totalForwarded = 0;
  let forwardCommission = 0;
  activeForwards.forEach((f) => {
    const amt = f.totalAmount || 0;
    totalForwarded += amt;
    const resolvedFwd = getResolvedForwardCommission({
      forwardSlip: f,
      mode: '3d',
      roundKey: roundKey3D,
      defaultUplineRate: uplineRate,
      uplineGlobalRates,
      uplineRoundRates
    });
    forwardCommission += resolvedFwd.amount;
  });
  const netPaid = totalForwarded - forwardCommission;

  const winNum = winningNumber ? winningNumber.trim().padStart(3, '0') : (round?.winningNumber ? round.winningNumber.trim().padStart(3, '0') : undefined);

  let totalPayout = 0;
  let masterPayout = 0;
  let retainedPayout = 0;
  let winnersCount = 0;

  if (winNum && winNum.length === 3) {
    const evalResult = evaluateWinnings(validVouchers, winNum, straightMult, toddMult);
    winnersCount = evalResult.winningBetsCount + evalResult.toddWinningBetsCount;

    totalPayout = evalResult.totalPayout;
    masterPayout = calculate3DForwardMasterPayout(activeForwards, winNum, straightMult, toddMult);
    retainedPayout = Math.max(0, totalPayout - masterPayout);
  } else {
    validVouchers.forEach((v) => {
      v.items.forEach((it) => {
        if (it.isWon) {
          const amt = (it.wonAmount || (it.amount * straightMult));
          totalPayout += amt;
          retainedPayout += amt;
          winnersCount += 1;
        }
      });
    });
  }

  const netSales = totalTurnover - totalForwarded - totalAgentCommission;
  const netProfit = netSales + masterPayout + forwardCommission - totalPayout;
  const isProfit = netProfit >= 0;
  const profitMargin = totalTurnover > 0 ? Math.round((Math.abs(netProfit) / totalTurnover) * 100) : 0;

  return {
    turnover: totalTurnover,
    totalForwarded,
    agentCommission: totalAgentCommission,
    netSales,
    masterPayout,
    forwardCommission,
    totalPayout,
    retainedPayout,
    netPaid,
    netProfit,
    isProfit,
    profitMargin,
    winnersCount,
    vouchersCount: validVouchers.length
  };
}
