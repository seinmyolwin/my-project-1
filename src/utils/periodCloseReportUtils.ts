import {
  BookieMode,
  GameType,
  PeriodCloseGrandTotals,
  PeriodClosePersonSummary,
  PeriodCloseReportSnapshot,
  PeriodCloseRoundLine
} from '../types';
import {
  StatementDataSources,
  getLocalDateStr,
  getDaysAgoStr,
  getResolvedVoucherCommission,
  getResolvedForwardCommission
} from './statementUtils';
import {
  evaluateWinnings,
  calculate3DForwardMasterPayout,
  formatAmount
} from './lotteryUtils';
import { normalizeTwoDMultiplier } from './twoDLotteryUtils';
import {
  getCustomerCommissionRatesByMode,
  getAllRoundCustomerCommissions,
  getUplineCommissionRatesByMode,
  getAllRoundUplineCommissions
} from './commissionUtils';

export function bookieModeToGameType(mode: BookieMode): GameType {
  if (mode === '2d') return '2D';
  if (mode === '3d') return '3D';
  return 'FB';
}

export function gameTypeToBookieMode(game: GameType): BookieMode {
  if (game === '2D') return '2d';
  if (game === '3D') return '3d';
  return 'football';
}

export function getBusinessLabel(mode: BookieMode): string {
  if (mode === '2d') return 'ဇီးကွက် (2D)';
  if (mode === '3d') return 'အိုးစည်လေး (3D)';
  return 'ပစ်တိုင်းထောင် (ဘောလုံး)';
}

const getMyanmarShortDay = (dateStr: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((dateStr || '').trim());
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const days = ['နွေ', 'လာ', 'ဂါ', 'ဟူး', 'တေး', 'ကြာ', 'နေ'];
  return days[d.getDay()] || '';
};

/**
 * Returns Mon-Fri of the most recent completed (or current Friday) 2D workweek.
 * Passing offsetWeeks=1 returns the previous week, -1 returns next week.
 */
export function get2DWorkWeekRange(offsetWeeks: number = 0, baseDate: Date = new Date()): { startDate: string; endDate: string } {
  const dow = baseDate.getDay(); // 0 Sun .. 6 Sat
  const back = (dow + 2) % 7; // days since most recent Friday
  const fri = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - back - offsetWeeks * 7);
  const mon = new Date(fri.getFullYear(), fri.getMonth(), fri.getDate() - 4);
  return {
    startDate: getLocalDateStr(mon),
    endDate: getLocalDateStr(fri)
  };
}

export function getDefaultPeriodRangeForMode(
  mode: BookieMode,
  fallbackStart?: string,
  fallbackEnd?: string
): { startDate: string; endDate: string } {
  if (mode === '2d') {
    return get2DWorkWeekRange(0);
  }
  const hasValidFallback =
    fallbackStart &&
    fallbackEnd &&
    fallbackStart !== '2020-01-01' &&
    fallbackEnd !== '2099-12-31' &&
    fallbackStart <= fallbackEnd;

  if (hasValidFallback) {
    return { startDate: fallbackStart!, endDate: fallbackEnd! };
  }
  if (mode === '3d') {
    // 3D draws happen twice a month (~15 days)
    return {
      startDate: getDaysAgoStr(14),
      endDate: getLocalDateStr()
    };
  }
  // Football: default 7 days
  return {
    startDate: getDaysAgoStr(6),
    endDate: getLocalDateStr()
  };
}

interface InternalRoundBucket {
  key: string;
  date: string;
  sortOrder: number;
  roundLabel: string;
  winningResult?: string;
  vouchers: any[];
  forwards: any[];
  roundKey: string;
  rawRound?: any;
}

/**
 * Builds a complete, reconciled Combined Period Close Settlement Report for ONE business mode.
 * Every downline customer & every upline master agent has concise day-by-day / round-by-round lines
 * (without individual bet numbers) and exact totals that reconcile to grandTotals.netProfit.
 */
export function buildPeriodCloseReport(
  data: StatementDataSources,
  mode: BookieMode,
  periodStart: string,
  periodEnd: string,
  currency: string = 'Ks'
): PeriodCloseReportSnapshot {
  const globalRatesByMode = getCustomerCommissionRatesByMode();
  const roundRates = getAllRoundCustomerCommissions();
  const uplineGlobalRatesByMode = getUplineCommissionRatesByMode();
  const uplineRoundRates = getAllRoundUplineCommissions();

  const buckets: InternalRoundBucket[] = [];
  let unsettledRoundsCount = 0;

  if (mode === '2d') {
    const allRoundIds = new Set(data.lottery2D.rounds.map((r) => r.id));
    data.lottery2D.rounds.forEach((round) => {
      const rDate = (round.drawDate || '').slice(0, 10);
      if (rDate < periodStart || rDate > periodEnd) return;

      const vouchers = data.lottery2D.vouchers.filter(
        (v) =>
          (v.roundId ? v.roundId === round.id : !v.roundId && (v.createdAt || '').slice(0, 10) === rDate) &&
          v.status !== 'cancelled' &&
          !v.deletedAt
      );
      const forwards = data.lottery2D.forwardSlips.filter(
        (f) => f.roundId === round.id && !(f as any).deletedAt
      );

      if (vouchers.length === 0 && forwards.length === 0) return;

      if (!round.winningNumber || round.winningNumber.trim() === '') {
        unsettledRoundsCount += 1;
      }

      const dayShort = getMyanmarShortDay(rDate);
      const sessLabel = round.session === 'morning' ? 'မနက်' : round.session === 'evening' ? 'ညနေ' : 'အထူး';
      const roundLabel = dayShort ? `${dayShort} (${sessLabel})` : sessLabel;

      buckets.push({
        key: `2d-${round.id}`,
        date: rDate,
        sortOrder: round.session === 'morning' ? 1 : round.session === 'evening' ? 2 : 3,
        roundLabel,
        winningResult: round.winningNumber ? round.winningNumber.trim().padStart(2, '0') : undefined,
        vouchers,
        forwards,
        roundKey: `2d-${round.id}`,
        rawRound: round
      });
    });

    // Orphaned 2D vouchers
    const orphaned = data.lottery2D.vouchers.filter((v) => {
      const d = (v.createdAt || '').slice(0, 10);
      return d >= periodStart && d <= periodEnd && v.status !== 'cancelled' && !v.deletedAt && (!v.roundId || !allRoundIds.has(v.roundId));
    });
    const orphanByDate: Record<string, any[]> = {};
    orphaned.forEach((v) => {
      const d = (v.createdAt || '').slice(0, 10);
      if (!orphanByDate[d]) orphanByDate[d] = [];
      orphanByDate[d].push(v);
    });
    Object.entries(orphanByDate).forEach(([d, vList]) => {
      const dayShort = getMyanmarShortDay(d);
      buckets.push({
        key: `2d-orphaned-${d}`,
        date: d,
        sortOrder: 9,
        roundLabel: dayShort ? `${dayShort} (အခြား)` : 'အခြား',
        vouchers: vList,
        forwards: [],
        roundKey: `2d-orphaned-${d}`
      });
    });
  } else if (mode === '3d') {
    const allRoundIds = new Set(data.lottery3D.rounds.map((r) => r.id));
    data.lottery3D.rounds.forEach((round) => {
      const rDate = (round.drawDate || '').slice(0, 10);
      if (rDate < periodStart || rDate > periodEnd) return;

      const vouchers = data.lottery3D.vouchers.filter(
        (v) =>
          (v.roundId ? v.roundId === round.id : !v.roundId && (v.createdAt || '').slice(0, 10) === rDate) &&
          v.status !== 'cancelled' &&
          !v.deletedAt
      );
      const forwards = data.lottery3D.forwardSlips.filter(
        (f) => f.roundId === round.id && !(f as any).deletedAt
      );

      if (vouchers.length === 0 && forwards.length === 0) return;

      if (!round.winningNumber || round.winningNumber.trim() === '') {
        unsettledRoundsCount += 1;
      }

      buckets.push({
        key: `3d-${round.id}`,
        date: rDate,
        sortOrder: 1,
        roundLabel: round.name || '3D ထီဖွင့်ပွဲ',
        winningResult: round.winningNumber ? round.winningNumber.trim().padStart(3, '0') : undefined,
        vouchers,
        forwards,
        roundKey: `3d-${round.id}`,
        rawRound: round
      });
    });

    const orphaned = data.lottery3D.vouchers.filter((v) => {
      const d = (v.createdAt || '').slice(0, 10);
      return d >= periodStart && d <= periodEnd && v.status !== 'cancelled' && !v.deletedAt && (!v.roundId || !allRoundIds.has(v.roundId));
    });
    const orphanByDate: Record<string, any[]> = {};
    orphaned.forEach((v) => {
      const d = (v.createdAt || '').slice(0, 10);
      if (!orphanByDate[d]) orphanByDate[d] = [];
      orphanByDate[d].push(v);
    });
    Object.entries(orphanByDate).forEach(([d, vList]) => {
      buckets.push({
        key: `3d-orphaned-${d}`,
        date: d,
        sortOrder: 9,
        roundLabel: '3D (အခြား)',
        vouchers: vList,
        forwards: [],
        roundKey: `3d-orphaned-${d}`
      });
    });
  } else {
    // Football grouped by roundDate
    const dateSet = new Set<string>();
    const slipsInRange = data.football.slips.filter((s) => {
      if (s.status === 'cancelled' || s.deletedAt) return false;
      const d = s.roundDate || (s.createdAt || '').slice(0, 10);
      if (d >= periodStart && d <= periodEnd) {
        dateSet.add(d);
        return true;
      }
      return false;
    });
    const fwdsInRange = data.football.forwardSlips.filter((f) => {
      if ((f as any).deletedAt) return false;
      const d = f.roundDate || (f.createdAt || '').slice(0, 10);
      if (d >= periodStart && d <= periodEnd) {
        dateSet.add(d);
        return true;
      }
      return false;
    });

    Array.from(dateSet)
      .sort()
      .forEach((d) => {
        const daySlips = slipsInRange.filter((s) => (s.roundDate || (s.createdAt || '').slice(0, 10)) === d);
        const dayFwds = fwdsInRange.filter((f) => (f.roundDate || (f.createdAt || '').slice(0, 10)) === d);
        if (daySlips.length === 0 && dayFwds.length === 0) return;

        const hasOpenSlips = daySlips.some((s) => s.status !== 'settled');
        if (hasOpenSlips) unsettledRoundsCount += 1;

        const dayShort = getMyanmarShortDay(d);
        buckets.push({
          key: `football-${d}`,
          date: d,
          sortOrder: 1,
          roundLabel: dayShort ? `${dayShort} (ဘောလုံး)` : 'ဘောလုံး',
          winningResult: hasOpenSlips ? 'ဖွင့်လှစ်ဆဲ' : 'ရှင်းပြီး',
          vouchers: daySlips,
          forwards: dayFwds,
          roundKey: `football-${d}`
        });
      });
  }

  // Sort buckets chronologically
  buckets.sort((a, b) => {
    const dc = a.date.localeCompare(b.date);
    if (dc !== 0) return dc;
    return a.sortOrder - b.sortOrder;
  });

  const customerMap = new Map<string, { roundsMap: Map<string, PeriodCloseRoundLine> }>();
  const uplineMap = new Map<string, { roundsMap: Map<string, PeriodCloseRoundLine> }>();

  const defaultDownlineRate =
    mode === '2d'
      ? (data.lottery2D.settings.defaultCustomerDiscount ?? 0)
      : mode === '3d'
      ? (data.lottery3D.settings.defaultCustomerDiscount ?? 0)
      : (data.football.settings?.defaultCustomerDiscount ?? 0);

  const defaultUplineRate =
    mode === '2d'
      ? (data.lottery2D.settings.defaultCommissionRate ?? 0)
      : mode === '3d'
      ? (data.lottery3D.settings.defaultCommissionRate ?? 0)
      : (data.football.settings?.defaultCommissionRate ?? 0);

  const straightMult3D = typeof data.lottery3D.settings?.defaultMultiplier === 'number' ? data.lottery3D.settings.defaultMultiplier : 0;
  const toddMult3D = typeof data.lottery3D.settings?.defaultToddMultiplier === 'number' ? data.lottery3D.settings.defaultToddMultiplier : 0;
  const defaultMult2D = normalizeTwoDMultiplier(data.lottery2D.settings?.defaultMultiplier);

  let totalSales = 0;
  let totalCustomerCommission = 0;
  let totalForwarded = 0;
  let totalForwardCommission = 0;
  let totalMasterPayout = 0;
  let totalPayout = 0;
  let vouchersCount = 0;

  buckets.forEach((b) => {
    // 1. Process Downline Vouchers for this bucket
    b.vouchers.forEach((v) => {
      vouchersCount += 1;
      const custName = (v.customerName || 'အထွေထွေ').trim() || 'အထွေထွေ';
      const resolvedVouch = getResolvedVoucherCommission({
        voucher: v,
        mode,
        roundKey: b.roundKey,
        defaultDownlineRate,
        globalRatesByMode,
        roundRates
      });
      const stake = resolvedVouch.gross;
      const comm = resolvedVouch.amount;

      let payout = 0;
      if (mode === '2d') {
        const win2D = b.rawRound?.winningNumber ? String(b.rawRound.winningNumber).trim().padStart(2, '0') : undefined;
        const mult = normalizeTwoDMultiplier(typeof b.rawRound?.multiplier === 'number' ? b.rawRound.multiplier : defaultMult2D);
        if (win2D && Array.isArray(v.items)) {
          v.items.forEach((it: any) => {
            if (String(it.number || '').trim().padStart(2, '0') === win2D) {
              payout += mult > 0 ? (Number(it.amount) || 0) * mult : 0;
            }
          });
        } else if (Array.isArray(v.items)) {
          v.items.forEach((it: any) => {
            if (it.isWon) {
              payout += it.wonAmount || ((Number(it.amount) || 0) * mult);
            }
          });
        }
      } else if (mode === '3d') {
        const win3D = b.rawRound?.winningNumber ? String(b.rawRound.winningNumber).trim().padStart(3, '0') : undefined;
        const isFrozen3D = !!b.rawRound && (b.rawRound.status === 'settled' || b.rawRound.status === 'closed' || !!b.rawRound.winningNumber);
        const rStraightMult3D = isFrozen3D && typeof b.rawRound?.multiplier === 'number' && b.rawRound.multiplier > 0
          ? b.rawRound.multiplier
          : straightMult3D;
        const rToddMult3D = isFrozen3D && typeof b.rawRound?.toddMultiplier === 'number' && b.rawRound.toddMultiplier >= 0
          ? b.rawRound.toddMultiplier
          : toddMult3D;
        if (win3D && win3D.length === 3) {
          const evalRes = evaluateWinnings([v], win3D, rStraightMult3D, rToddMult3D);
          payout = evalRes.totalPayout;
        } else if (Array.isArray(v.items)) {
          v.items.forEach((it: any) => {
            if (it.isWon) {
              const itemMult = it.betType === 'rumble' ? rToddMult3D : rStraightMult3D;
              payout += it.wonAmount || ((Number(it.amount) || 0) * itemMult);
            }
          });
        }
      } else {
        // Football slip
        const isSettledOrEvaluated =
          v.status === 'settled' ||
          v.outcome === 'won' ||
          v.outcome === 'half_won' ||
          v.outcome === 'draw' ||
          v.outcome === 'half_lost' ||
          v.outcome === 'lost';
        payout = !isSettledOrEvaluated
          ? 0
          : typeof v.actualPayout === 'number'
          ? v.actualPayout
          : v.outcome === 'won' || v.outcome === 'half_won'
          ? (v.potentialPayout || 0)
          : 0;
      }

      totalSales += stake;
      totalCustomerCommission += comm;
      totalPayout += payout;

      if (!customerMap.has(custName)) {
        customerMap.set(custName, { roundsMap: new Map() });
      }
      const cEntry = customerMap.get(custName)!;
      const existingLine = cEntry.roundsMap.get(b.key);
      if (existingLine) {
        existingLine.stake += stake;
        existingLine.commission += comm;
        existingLine.payout += payout;
        existingLine.netBalance = (existingLine.stake - existingLine.commission) - existingLine.payout;
      } else {
        cEntry.roundsMap.set(b.key, {
          key: b.key,
          date: b.date,
          roundLabel: b.roundLabel,
          winningResult: b.winningResult,
          stake,
          commission: comm,
          payout,
          netBalance: (stake - comm) - payout
        });
      }
    });

    // 2. Process Upline Forward Slips for this bucket
    if (b.forwards.length > 0) {
      // Group forwards in this bucket by masterAgentName
      const byAgent = new Map<string, any[]>();
      b.forwards.forEach((f) => {
        const agentName = (f.masterAgentName || 'အထက်ဒိုင်').trim() || 'အထက်ဒိုင်';
        if (!byAgent.has(agentName)) byAgent.set(agentName, []);
        byAgent.get(agentName)!.push(f);
      });

      // Compute bucket-level totals for Football forward ratio fallback
      let bucketTotalForwarded = 0;
      let bucketTotalMasterPayoutFB = 0;
      if (mode === 'football') {
        b.vouchers.forEach((s: any) => {
          const sStake = Number(s.stakeAmount) || Number(s.netPayable) || 0;
          const forwardedForSlip = b.forwards
            .filter((f) => f.slipId === s.id || (f.slipNo && f.slipNo === s.slipNo))
            .reduce((sum, f) => sum + (f.stakeAmount || f.totalAmount || 0), 0);
          const ratio = sStake > 0 ? Math.min(1, forwardedForSlip / sStake) : 0;
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
            : s.outcome === 'won' || s.outcome === 'half_won'
            ? (s.potentialPayout || 0)
            : 0;
          bucketTotalMasterPayoutFB += actPayout * ratio;
        });
        bucketTotalForwarded = b.forwards.reduce((sum, f) => sum + (Number(f.stakeAmount ?? f.totalAmount ?? 0) || 0), 0);
      }

      byAgent.forEach((agentForwards, agentName) => {
        let fwdAmt = 0;
        let fwdComm = 0;
        agentForwards.forEach((f) => {
          const amt = Number(f.stakeAmount ?? f.totalAmount ?? 0) || 0;
          fwdAmt += amt;
          const resolvedFwd = getResolvedForwardCommission({
            forwardSlip: f,
            mode,
            roundKey: b.roundKey,
            defaultUplineRate,
            uplineGlobalRatesByMode,
            uplineRoundRates
          });
          fwdComm += resolvedFwd.amount;
        });

        let masterPayout = 0;
        if (mode === '2d') {
          const win2D = b.rawRound?.winningNumber ? String(b.rawRound.winningNumber).trim().padStart(2, '0') : undefined;
          const mult2D = normalizeTwoDMultiplier(typeof b.rawRound?.multiplier === 'number' ? b.rawRound.multiplier : defaultMult2D);
          if (win2D && win2D.length === 2) {
            let exactPayout = 0;
            let hasItems = false;
            agentForwards.forEach((f) => {
              if (Array.isArray(f.items) && f.items.length > 0) {
                hasItems = true;
                f.items.forEach((it: any) => {
                  const num = String(it.number || '').trim().padStart(2, '0');
                  const amt = Number(it.amount) || 0;
                  if (amt > 0 && num === win2D) {
                    exactPayout += mult2D > 0 ? amt * mult2D : 0;
                  }
                });
              } else if (typeof f.actualPayout === 'number' && f.actualPayout > 0) {
                exactPayout += f.actualPayout;
              }
            });
            masterPayout = hasItems ? Math.round(exactPayout) : Math.round(exactPayout);
          }
        } else if (mode === '3d') {
          const win3D = b.rawRound?.winningNumber ? String(b.rawRound.winningNumber).trim().padStart(3, '0') : undefined;
          const isFrozen3D = !!b.rawRound && (b.rawRound.status === 'settled' || b.rawRound.status === 'closed' || !!b.rawRound.winningNumber);
          const rStraightMult3D = isFrozen3D && typeof b.rawRound?.multiplier === 'number' && b.rawRound.multiplier > 0
            ? b.rawRound.multiplier
            : straightMult3D;
          const rToddMult3D = isFrozen3D && typeof b.rawRound?.toddMultiplier === 'number' && b.rawRound.toddMultiplier >= 0
            ? b.rawRound.toddMultiplier
            : toddMult3D;
          if (win3D && win3D.length === 3) {
            masterPayout = calculate3DForwardMasterPayout(agentForwards, win3D, rStraightMult3D, rToddMult3D);
          }
        } else {
          // Football per-agent master payout: compute per forward slip against its parent slip (matching statementUtils)
          let exactTotal = 0;
          agentForwards.forEach((f) => {
            const parentSlip = b.vouchers.find((s: any) => s.id === f.slipId || (f.slipNo && s.slipNo === f.slipNo));
            if (parentSlip) {
              const sStake = Number(parentSlip.stakeAmount) || Number(parentSlip.netPayable) || 0;
              const isSettledOrEvaluated =
                parentSlip.status === 'settled' ||
                parentSlip.outcome === 'won' ||
                parentSlip.outcome === 'half_won' ||
                parentSlip.outcome === 'draw' ||
                parentSlip.outcome === 'half_lost' ||
                parentSlip.outcome === 'lost';
              const parentActPayout = !isSettledOrEvaluated
                ? 0
                : typeof parentSlip.actualPayout === 'number'
                ? parentSlip.actualPayout
                : parentSlip.outcome === 'won' || parentSlip.outcome === 'half_won'
                ? (parentSlip.potentialPayout || 0)
                : 0;
              const totalFwdOnParent = b.forwards
                .filter((fw) => fw.slipId === parentSlip.id || (fw.slipNo && fw.slipNo === parentSlip.slipNo))
                .reduce((sum, fw) => sum + (Number(fw.stakeAmount ?? fw.totalAmount ?? 0) || 0), 0);
              const cappedFactor = totalFwdOnParent > sStake && totalFwdOnParent > 0 ? sStake / totalFwdOnParent : 1;
              const fStake = Number(f.stakeAmount ?? f.totalAmount ?? 0) || 0;
              exactTotal += sStake > 0 ? parentActPayout * (fStake / sStake) * cappedFactor : 0;
            } else if (typeof f.actualPayout === 'number') {
              exactTotal += f.actualPayout;
            }
          });
          masterPayout = Math.round(exactTotal);
        }

        totalForwarded += fwdAmt;
        totalForwardCommission += fwdComm;
        totalMasterPayout += masterPayout;

        if (!uplineMap.has(agentName)) {
          uplineMap.set(agentName, { roundsMap: new Map() });
        }
        const uEntry = uplineMap.get(agentName)!;
        const netBal = (fwdAmt - fwdComm) - masterPayout;
        uEntry.roundsMap.set(b.key, {
          key: b.key,
          date: b.date,
          roundLabel: b.roundLabel,
          winningResult: b.winningResult,
          stake: fwdAmt,
          commission: fwdComm,
          payout: masterPayout,
          netBalance: netBal
        });
      });
    }
  });

  const customers: PeriodClosePersonSummary[] = Array.from(customerMap.entries())
    .map(([name, entry]) => {
      const rounds = Array.from(entry.roundsMap.values());
      const cStake = rounds.reduce((s, r) => s + r.stake, 0);
      const cComm = rounds.reduce((s, r) => s + r.commission, 0);
      const cPayout = rounds.reduce((s, r) => s + r.payout, 0);
      const cNet = (cStake - cComm) - cPayout;
      return {
        name,
        totalStake: cStake,
        totalCommission: cComm,
        totalPayout: cPayout,
        netBalance: cNet,
        rounds
      };
    })
    .sort((a, b) => b.totalStake - a.totalStake || a.name.localeCompare(b.name));

  const uplines: PeriodClosePersonSummary[] = Array.from(uplineMap.entries())
    .map(([name, entry]) => {
      const rounds = Array.from(entry.roundsMap.values());
      const uStake = rounds.reduce((s, r) => s + r.stake, 0);
      const uComm = rounds.reduce((s, r) => s + r.commission, 0);
      const uPayout = rounds.reduce((s, r) => s + r.payout, 0);
      const uNet = (uStake - uComm) - uPayout;
      return {
        name,
        totalStake: uStake,
        totalCommission: uComm,
        totalPayout: uPayout,
        netBalance: uNet,
        rounds
      };
    })
    .sort((a, b) => b.totalStake - a.totalStake || a.name.localeCompare(b.name));

  // Total Receivables (ရရန်စုစုပေါင်း) & Total Payables (ပေးရန်စုစုပေါင်း)
  let totalReceivable = 0;
  let totalPayable = 0;

  customers.forEach((c) => {
    if (c.netBalance >= 0) totalReceivable += c.netBalance;
    else totalPayable += Math.abs(c.netBalance);
  });

  uplines.forEach((u) => {
    // Upline netBalance = (fwd - comm) - masterPayout
    // >= 0 means we owe upline (ပေးရန်), < 0 means upline owes us (ရရန်)
    if (u.netBalance >= 0) totalPayable += u.netBalance;
    else totalReceivable += Math.abs(u.netBalance);
  });

  const netProfit = totalReceivable - totalPayable;

  const grandTotals: PeriodCloseGrandTotals = {
    totalReceivable,
    totalPayable,
    totalSales,
    totalCustomerCommission,
    totalForwarded,
    totalForwardCommission,
    totalMasterPayout,
    totalPayout,
    netProfit,
    vouchersCount,
    roundsCount: buckets.length
  };

  return {
    businessMode: mode,
    game: bookieModeToGameType(mode),
    businessLabel: getBusinessLabel(mode),
    periodStart,
    periodEnd,
    currency,
    unsettledRoundsCount,
    customers,
    uplines,
    grandTotals
  };
}

/**
 * Formats a concise plain-text Burmese report for copying to clipboard / Viber / Telegram.
 */
export function formatPeriodCloseReportText(report: PeriodCloseReportSnapshot, closedAt?: string): string {
  const cur = report.currency || 'Ks';
  const lines: string[] = [];
  lines.push(`📋 ${report.businessLabel} — ကာလပိတ် စာရင်းချုပ်`);
  lines.push(`ကာလ: ${report.periodStart} မှ ${report.periodEnd} အထိ`);
  if (closedAt) {
    lines.push(`ပိတ်သိမ်းချိန်: ${new Date(closedAt).toLocaleString('en-GB')}`);
  }
  lines.push('====================================');

  if (report.customers.length > 0) {
    lines.push('👥 ထိုးသား / ဒိုင်ငယ် တစ်ဦးချင်းစာရင်း');
    lines.push('------------------------------------');
    report.customers.forEach((c, idx) => {
      const balLabel = c.netBalance >= 0 ? 'ရရန်' : 'ပေးရန်';
      lines.push(`${idx + 1}. ${c.name} => ${balLabel}: ${formatAmount(Math.abs(c.netBalance), cur)}`);
      c.rounds.forEach((r) => {
        const winPart = r.winningResult ? ` [${r.winningResult}]` : '';
        const rBal = r.netBalance >= 0 ? `ရရန် ${formatAmount(r.netBalance, '')}` : `ပေးရန် ${formatAmount(Math.abs(r.netBalance), '')}`;
        lines.push(
          `   • ${r.date} ${r.roundLabel}${winPart} | ထိုး: ${formatAmount(r.stake, '')}, ကော်: ${formatAmount(r.commission, '')}, ပေါက်: ${formatAmount(r.payout, '')} => ${rBal}`
        );
      });
      lines.push(
        `   [စုစုပေါင်း] ထိုး: ${formatAmount(c.totalStake, '')} | ကော်: ${formatAmount(c.totalCommission, '')} | ပေါက်: ${formatAmount(c.totalPayout, '')} | ${balLabel}: ${formatAmount(Math.abs(c.netBalance), cur)}`
      );
      lines.push('');
    });
  }

  if (report.uplines.length > 0) {
    lines.push('🛡️ အထက်ဒိုင် တစ်ဦးချင်းစာရင်း');
    lines.push('------------------------------------');
    report.uplines.forEach((u, idx) => {
      const balLabel = u.netBalance >= 0 ? 'အထက်ဒိုင်သို့ ပေးရန်' : 'အထက်ဒိုင်မှ ရရန်';
      lines.push(`${idx + 1}. ${u.name} => ${balLabel}: ${formatAmount(Math.abs(u.netBalance), cur)}`);
      u.rounds.forEach((r) => {
        const winPart = r.winningResult ? ` [${r.winningResult}]` : '';
        const rBal = r.netBalance >= 0 ? `ပေးရန် ${formatAmount(r.netBalance, '')}` : `ရရန် ${formatAmount(Math.abs(r.netBalance), '')}`;
        lines.push(
          `   • ${r.date} ${r.roundLabel}${winPart} | တင်: ${formatAmount(r.stake, '')}, ကော်: ${formatAmount(r.commission, '')}, ပေါက်: ${formatAmount(r.payout, '')} => ${rBal}`
        );
      });
      lines.push(
        `   [စုစုပေါင်း] တင်: ${formatAmount(u.totalStake, '')} | ကော်: ${formatAmount(u.totalCommission, '')} | ပေါက်: ${formatAmount(u.totalPayout, '')} | ${balLabel}: ${formatAmount(Math.abs(u.netBalance), cur)}`
      );
      lines.push('');
    });
  }

  const g = report.grandTotals;
  lines.push('====================================');
  lines.push('📊 စာရင်းချုပ် စုစုပေါင်း');
  lines.push(`ရရန်စုစုပေါင်း: ${formatAmount(g.totalReceivable, cur)}`);
  lines.push(`ပေးရန်စုစုပေါင်း: ${formatAmount(g.totalPayable, cur)}`);
  lines.push(`ထိုးကြေးစုစုပေါင်း: ${formatAmount(g.totalSales, cur)}`);
  lines.push(`ပေါက်ကြေးစုစုပေါင်း: ${formatAmount(g.totalPayout, cur)}`);
  if (g.totalForwarded > 0 || g.totalMasterPayout > 0) {
    lines.push(`(အထက်တင်: ${formatAmount(g.totalForwarded, cur)} | အထက်ကော်: ${formatAmount(g.totalForwardCommission, cur)} | အထက်ပေါက်: ${formatAmount(g.totalMasterPayout, cur)})`);
  }
  lines.push(
    `အမြတ်/အရှုံး စုစုပေါင်း: ${g.netProfit >= 0 ? '+' : '-'}${formatAmount(Math.abs(g.netProfit), cur)} (${g.netProfit >= 0 ? 'အမြတ်' : 'အရှုံး'})`
  );
  lines.push('====================================');

  return lines.join('\n');
}
