import { evaluateTwoDWinnings } from './twoDLotteryUtils';
import { evaluateWinnings, getPermutations } from './lotteryUtils';
import { TwoDVoucher, TwoDDrawRound, Voucher, DrawRound, FootballSlip, ForwardSlip } from '../types';

export interface StatementRecord {
  id: string;
  date: string;
  mode: '3d' | '2d' | 'football';
  modeLabel: string;
  name: string;
  session?: 'morning' | 'evening' | 'special';
  winningResult: string;
  turnover: number;          // စုစုပေါင်း ထိုးကြေး (Gross Turnover)
  agentCommission: number;   // အောက်လက်/ဝယ်သူ ကော်မရှင် ပေးရငွေ (Agent Discount Out)
  netSales: number;          // အမှန်ရောင်းရငွေ (Turnover - Agent Commission)
  payout: number;            // ဒိုင်ပေးလျော်ငွေ (Retained local payout)
  totalForwarded: number;    // ဒိုင်ကြီးဆီ လွှဲတင်ငွေ (Total amount sent to master bookie)
  forwardCommission: number; // ဒိုင်ကြီးဆီ လွှဲတင်ကော်မရှင် ရငွေ (Commission earned from bookie)
  netPaid: number;           // ဒိုင်ကြီးဆီ အမှန်ပေးငွေ (Total Forwarded - Forward Commission)
  netProfit: number;         // ဒိုင် အသားတင် အမြတ်/အရှုံး (Net Sales - Net Paid - Payout)
  isProfit: boolean;
  winnersCount: number;
  vouchersCount: number;
  status: 'settled' | 'open' | 'closed';
  rawRoundId?: string;
}

export interface StatementGrandTotals {
  totalTurnover: number;
  totalAgentCommission: number;
  netSales: number;
  totalPayout: number;
  totalForwarded: number;
  totalForwardCommission: number;
  totalNetPaid: number;
  totalNetProfit: number;
  isProfit: boolean;
  totalWinners: number;
  totalVouchers: number;
}

export type StatementPeriodPreset = 'all' | 'today' | 'three_days' | 'five_days' | 'week' | 'month' | 'custom';

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
      currency?: string;
    };
  };
  football: {
    slips: FootballSlip[];
    forwardSlips: any[];
  };
}

/**
 * Universal Single Source of Truth for generating Financial Statement Records across 2D, 3D and Football.
 */
export function generateStatementRecords(
  data: StatementDataSources,
  mode: 'all' | '3d' | '2d' | 'football',
  startDate: string,
  endDate: string
): StatementRecord[] {
  const list: StatementRecord[] = [];
  const todayStr = getLocalDateStr();

  // ====================================================
  // 1. Process 2D (ဇီးကွက်)
  // ====================================================
  if (mode === 'all' || mode === '2d') {
    const processedRoundIds = new Set<string>();

    const allRoundIds2D = new Set(data.lottery2D.rounds.map((r) => r.id));

    data.lottery2D.rounds.forEach((round) => {
      const roundDate = (round.drawDate || '').slice(0, 10);
      if (roundDate >= startDate && roundDate <= endDate) {
        processedRoundIds.add(round.id);

        const roundVouchers = data.lottery2D.vouchers.filter(
          (v) => (v.roundId === round.id || (!v.roundId && (v.createdAt || '').slice(0, 10) === roundDate)) &&
                 v.status !== 'cancelled'
        );

        const roundForwards = data.lottery2D.forwardSlips.filter(
          (f) => f.roundId === round.id || (f.createdAt || '').slice(0, 10) === roundDate
        );

        let totalTurnover = 0;
        let totalAgentCommission = 0;
        let netSales = 0;

        roundVouchers.forEach((v) => {
          const voucherSubtotal = v.subtotal ?? v.items.reduce((s, it) => s + (it.amount || 0), 0);
          
          let voucherDiscount = 0;
          if (typeof v.discountAmount === 'number') {
            voucherDiscount = v.discountAmount;
          } else if (round.commissionRate && round.commissionRate > 0) {
            voucherDiscount = Math.round(voucherSubtotal * (round.commissionRate / 100));
          } else if (data.lottery2D.settings.defaultCommissionRate && data.lottery2D.settings.defaultCommissionRate > 0) {
            voucherDiscount = Math.round(voucherSubtotal * (data.lottery2D.settings.defaultCommissionRate / 100));
          }

          const voucherNet = v.netPayable ?? (voucherSubtotal - voucherDiscount);

          totalTurnover += voucherSubtotal;
          totalAgentCommission += voucherDiscount;
          netSales += voucherNet;
        });

        // Forward slips to master bookie
        let totalForwarded = 0;
        let forwardCommission = 0;
        roundForwards.forEach((f) => {
          totalForwarded += f.totalAmount || 0;
          forwardCommission += f.commissionAmount || 0;
        });
        const netPaid = totalForwarded - forwardCommission;

        // Payout & Winners calculation
        let totalPayout = 0;
        let winnersCount = 0;
        const winningNum = round.winningNumber ? round.winningNumber.padStart(2, '0') : undefined;
        const mult = round.multiplier || data.lottery2D.settings.defaultMultiplier || 0;

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
          const retainedAmount = Math.max(0, totalSoldForWinNum - totalForwardedForWinNum);
          totalPayout = mult > 0 ? retainedAmount * mult : 0;
        } else {
          roundVouchers.forEach((v) => {
            v.items.forEach((it) => {
              if (it.isWon) {
                totalPayout += (it.wonAmount || (it.amount * mult));
                winnersCount += 1;
              }
            });
          });
        }

        const netProfit = netSales - netPaid - totalPayout;

        list.push({
          id: `2d-${round.id}`,
          date: roundDate,
          mode: '2d',
          modeLabel: 'ဇီးကွက်',
          name: round.name || `${roundDate} ${round.session === 'morning' ? 'မနက် (12:01)' : 'ညနေ (04:30)'}`,
          session: round.session,
          winningResult: winningNum || (round.status === 'settled' ? 'ပေါက်မဲမရှိ' : 'မထွက်သေး'),
          turnover: totalTurnover,
          agentCommission: totalAgentCommission,
          netSales,
          payout: totalPayout,
          totalForwarded,
          forwardCommission,
          netPaid,
          netProfit,
          isProfit: netProfit >= 0,
          winnersCount,
          vouchersCount: roundVouchers.length,
          status: round.status,
          rawRoundId: round.id
        });
      }
    });

    // Catch any orphaned vouchers without round assigned
    const orphanedVouchers = data.lottery2D.vouchers.filter(v => {
      const vDate = (v.createdAt || '').slice(0, 10);
      return vDate >= startDate && vDate <= endDate && v.status !== 'cancelled' && (!v.roundId || !allRoundIds2D.has(v.roundId));
    });

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
        let netSales = 0;
        let payout = 0;
        let winnersCount = 0;

        vList.forEach(v => {
          const sub = v.subtotal ?? v.items.reduce((s, it) => s + (it.amount || 0), 0);
          let disc = 0;
          if (typeof v.discountAmount === 'number') {
            disc = v.discountAmount;
          } else if (data.lottery2D.settings.defaultCommissionRate) {
            disc = Math.round(sub * (data.lottery2D.settings.defaultCommissionRate / 100));
          }

          turnover += sub;
          agentCommission += disc;
          netSales += (v.netPayable ?? (sub - disc));
          v.items.forEach(it => {
            if (it.isWon) {
              payout += (it.wonAmount || (it.amount * (data.lottery2D.settings.defaultMultiplier || 0)));
              winnersCount += 1;
            }
          });
        });

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
          agentCommission,
          netSales,
          payout,
          totalForwarded: 0,
          forwardCommission: 0,
          netPaid: 0,
          netProfit,
          isProfit: netProfit >= 0,
          winnersCount,
          vouchersCount: vList.length,
          status: payout > 0 ? 'settled' : 'open'
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
      if (roundDate >= startDate && roundDate <= endDate) {
        processed3DRoundIds.add(round.id);

        const roundVouchers = data.lottery3D.vouchers.filter(
          (v) => (v.roundId === round.id || (!v.roundId && (v.createdAt || '').slice(0, 10) === roundDate)) &&
                 v.status !== 'cancelled'
        );

        const roundForwards = data.lottery3D.forwardSlips.filter(
          (f) => f.roundId === round.id || (f.createdAt || '').slice(0, 10) === roundDate
        );

        let totalTurnover = 0;
        let totalAgentCommission = 0;
        let netSales = 0;

        roundVouchers.forEach((v) => {
          const sub = v.subtotal ?? v.items.reduce((s, it) => s + (it.amount || 0), 0);
          let disc = 0;
          if (typeof v.discountAmount === 'number') {
            disc = v.discountAmount;
          } else if (round.commissionRate && round.commissionRate > 0) {
            disc = Math.round(sub * (round.commissionRate / 100));
          } else if (data.lottery3D.settings.defaultCommissionRate && data.lottery3D.settings.defaultCommissionRate > 0) {
            disc = Math.round(sub * (data.lottery3D.settings.defaultCommissionRate / 100));
          }

          totalTurnover += sub;
          totalAgentCommission += disc;
          netSales += (v.netPayable ?? (sub - disc));
        });

        // 3D Forward slips to master bookie
        let totalForwarded = 0;
        let forwardCommission = 0;
        roundForwards.forEach((f) => {
          totalForwarded += f.totalAmount || 0;
          forwardCommission += f.commissionAmount || 0;
        });
        const netPaid = totalForwarded - forwardCommission;

        let totalPayout = 0;
        let winnersCount = 0;
        const winningNum = round.winningNumber ? round.winningNumber.padStart(3, '0') : undefined;
        const straightMult = round.multiplier || data.lottery3D.settings.defaultMultiplier || 0;
        const toddMult = round.toddMultiplier || data.lottery3D.settings.defaultToddMultiplier || 0;

        if (winningNum) {
          const evalResult = evaluateWinnings(roundVouchers, winningNum, straightMult, toddMult);
          winnersCount = evalResult.winningBetsCount + evalResult.toddWinningBetsCount;

          // Deduct forwarded bets for 3D winning calculation
          const toddPerms = new Set(getPermutations(winningNum).filter(p => p !== winningNum));

          let straightSold = 0;
          let toddSold = 0;
          roundVouchers.forEach((v) => {
            v.items.forEach((it) => {
              if (it.number === winningNum) {
                straightSold += it.amount;
              } else if (it.betType === 'rumble' && toddPerms.has(it.number)) {
                toddSold += it.amount;
              }
            });
          });

          let straightForwarded = 0;
          let toddForwarded = 0;
          roundForwards.forEach((f) => {
            f.items.forEach((it) => {
              if (it.number === winningNum) {
                straightForwarded += it.amount;
              } else if (toddPerms.has(it.number)) {
                toddForwarded += it.amount;
              }
            });
          });

          const retainedStraight = Math.max(0, straightSold - straightForwarded);
          const retainedTodd = Math.max(0, toddSold - toddForwarded);

          totalPayout = (retainedStraight * straightMult) + (retainedTodd * toddMult);
        } else {
          roundVouchers.forEach((v) => {
            v.items.forEach((it) => {
              if (it.isWon) {
                totalPayout += (it.wonAmount || (it.amount * straightMult));
                winnersCount += 1;
              }
            });
          });
        }

        const netProfit = netSales - netPaid - totalPayout;

        list.push({
          id: `3d-${round.id}`,
          date: roundDate,
          mode: '3d',
          modeLabel: 'အိုးစည်လေး',
          name: round.name || `${roundDate} ထီဖွင့်ပွဲ`,
          winningResult: winningNum || (round.status === 'settled' ? 'ပေါက်မဲမရှိ' : 'မထွက်သေး'),
          turnover: totalTurnover,
          agentCommission: totalAgentCommission,
          netSales,
          payout: totalPayout,
          totalForwarded,
          forwardCommission,
          netPaid,
          netProfit,
          isProfit: netProfit >= 0,
          winnersCount,
          vouchersCount: roundVouchers.length,
          status: round.status,
          rawRoundId: round.id
        });
      }
    });

    // Catch any orphaned 3D vouchers without round
    const orphaned3DVouchers = data.lottery3D.vouchers.filter(v => {
      const vDate = (v.createdAt || '').slice(0, 10);
      return vDate >= startDate && vDate <= endDate && v.status !== 'cancelled' && (!v.roundId || !allRoundIds3D.has(v.roundId));
    });

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
        let netSales = 0;
        let payout = 0;
        let winnersCount = 0;

        vList.forEach(v => {
          const sub = v.subtotal ?? v.items.reduce((s, it) => s + (it.amount || 0), 0);
          let disc = 0;
          if (typeof v.discountAmount === 'number') {
            disc = v.discountAmount;
          } else if (data.lottery3D.settings.defaultCommissionRate) {
            disc = Math.round(sub * (data.lottery3D.settings.defaultCommissionRate / 100));
          }

          turnover += sub;
          agentCommission += disc;
          netSales += (v.netPayable ?? (sub - disc));
          v.items.forEach(it => {
            if (it.isWon) {
              payout += (it.wonAmount || (it.amount * (data.lottery3D.settings.defaultMultiplier || 0)));
              winnersCount += 1;
            }
          });
        });

        const netProfit = netSales - payout;

        list.push({
          id: `3d-orphaned-${d}`,
          date: d,
          mode: '3d',
          modeLabel: 'အိုးစည်လေး',
          name: `${d} 3D အရောင်းမှတ်တမ်းများ`,
          winningResult: payout > 0 ? `${winnersCount} ဦးပေါက်` : 'မထွက်သေး',
          turnover,
          agentCommission,
          netSales,
          payout,
          totalForwarded: 0,
          forwardCommission: 0,
          netPaid: 0,
          netProfit,
          isProfit: netProfit >= 0,
          winnersCount,
          vouchersCount: vList.length,
          status: payout > 0 ? 'settled' : 'open'
        });
      });
    }
  }

  // ====================================================
  // 3. Process Football (ပစ်တိုင်းထောင်)
  // ====================================================
  if (mode === 'all' || mode === 'football') {
    const slips = data.football.slips.filter((s) => {
      const slipDate = (s.createdAt || s.roundDate || '').slice(0, 10);
      return slipDate >= startDate && slipDate <= endDate && s.status !== 'cancelled';
    });

    if (slips.length > 0) {
      const slipsByDate: { [date: string]: FootballSlip[] } = {};
      slips.forEach((s) => {
        const d = (s.createdAt || s.roundDate || '').slice(0, 10) || todayStr;
        if (!slipsByDate[d]) slipsByDate[d] = [];
        slipsByDate[d].push(s);
      });

      Object.keys(slipsByDate).forEach((d) => {
        const daySlips = slipsByDate[d];
        let turnover = 0;
        let agentCommission = 0;
        let netSales = 0;
        let payout = 0;
        let winnersCount = 0;

        daySlips.forEach((s) => {
          const stake = s.stakeAmount || s.netPayable || 0;
          const disc = s.discountAmount || 0;
          turnover += stake;
          agentCommission += disc;
          netSales += (s.netPayable || (stake - disc));

          if (s.status === 'settled' || s.outcome === 'won' || s.outcome === 'half_won') {
            payout += (s.actualPayout || s.potentialPayout || 0);
            winnersCount += 1;
          }
        });

        const dayForwards = data.football.forwardSlips.filter((f) => (f.createdAt || f.roundDate || '').slice(0, 10) === d);
        let totalForwarded = 0;
        let forwardCommission = 0;
        dayForwards.forEach((f) => {
          totalForwarded += f.totalAmount || 0;
          forwardCommission += f.commissionAmount || 0;
        });
        const netPaid = totalForwarded - forwardCommission;

        const netProfit = netSales - netPaid - payout;

        list.push({
          id: `football-${d}`,
          date: d,
          mode: 'football',
          modeLabel: 'ပစ်တိုင်းထောင်',
          name: `${d} ပစ်တိုင်းထောင် မောင်း/ဘော်ဒီ ရှင်းတမ်း`,
          winningResult: winnersCount > 0 ? `${winnersCount} စလစ် ပေါက်` : 'စလစ်အားလုံး ရှင်းပြီး',
          turnover,
          agentCommission,
          netSales,
          payout,
          totalForwarded,
          forwardCommission,
          netPaid,
          netProfit,
          isProfit: netProfit >= 0,
          winnersCount,
          vouchersCount: daySlips.length,
          status: 'settled'
        });
      });
    }
  }

  // Sort newest first
  return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function computeStatementGrandTotals(records: StatementRecord[]): StatementGrandTotals {
  let totalTurnover = 0;
  let totalAgentCommission = 0;
  let netSales = 0;
  let totalPayout = 0;
  let totalForwarded = 0;
  let totalForwardCommission = 0;
  let totalNetPaid = 0;
  let totalNetProfit = 0;
  let totalWinners = 0;
  let totalVouchers = 0;

  records.forEach((r) => {
    totalTurnover += r.turnover;
    totalAgentCommission += r.agentCommission;
    netSales += r.netSales;
    totalPayout += r.payout;
    totalForwarded += r.totalForwarded;
    totalForwardCommission += r.forwardCommission;
    totalNetPaid += r.netPaid;
    totalNetProfit += r.netProfit;
    totalWinners += r.winnersCount;
    totalVouchers += r.vouchersCount;
  });

  return {
    totalTurnover,
    totalAgentCommission,
    netSales,
    totalPayout,
    totalForwarded,
    totalForwardCommission,
    totalNetPaid,
    totalNetProfit,
    isProfit: totalNetProfit >= 0,
    totalWinners,
    totalVouchers
  };
}
