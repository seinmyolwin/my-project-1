import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  DollarSign,
  Printer,
  FileSpreadsheet,
  Users,
  Shield,
  Percent,
  CheckCircle2,
  Clock,
  ArrowRight,
  Wallet,
  Copy,
  Check,
  Star
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { formatAmount, evaluateWinnings, calculate3DForwardMasterPayout, getToddWinningNumbers } from '../utils/lotteryUtils';
import {
  getLocalDateStr,
  getDaysAgoStr,
  generateStatementRecords,
  getResolvedVoucherCommission,
  getResolvedForwardCommission
} from '../utils/statementUtils';
import {
  CommissionBusinessMode,
  ScopedCommissionRates,
  COMMISSION_BUSINESS_MODES,
  inferModeFromRoundKey,
  getCustomerCommissionRatesByMode,
  setBulkRoundAndGlobalCustomerCommissions,
  getUplineCommissionRatesByMode,
  setBulkRoundAndGlobalUplineCommissions,
  getAllRoundUplineCommissions,
  getAllRoundCustomerCommissions,
  COMMISSION_UPDATED_EVENT
} from '../utils/commissionUtils';
import { printStatementReport } from '../utils/printUtils';

interface PeriodSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  modeFilter?: 'all' | '3d' | '2d' | 'football';
}

const getMyanmarShortDay = (dateStr: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((dateStr || '').trim());
  if (!m) return '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const days = ['နွေ', 'လာ', 'ဂါ', 'ဟူး', 'တေး', 'ကြာ', 'နေ'];
  return days[d.getDay()] || '';
};

const replaceZeegwetWithWeekday = (dateStr: string, label: string): string => {
  const dayShort = getMyanmarShortDay(dateStr);
  if (!dayShort) return label;
  return label.includes('ဇီးကွက်') ? label.replace('ဇီးကွက်', dayShort) : label;
};

export const PeriodSettlementModal: React.FC<PeriodSettlementModalProps> = ({ isOpen, onClose, modeFilter = 'all' }) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  const currency =
    modeFilter === '2d'
      ? lottery2D.settings.currency || 'Ks'
      : modeFilter === 'football'
      ? football.settings.currency || 'Ks'
      : lottery3D.settings.currency || lottery2D.settings.currency || 'Ks';
  const defaultCommission =
    modeFilter === '2d'
      ? (lottery2D.settings.defaultCustomerDiscount ?? 0)
      : modeFilter === 'football'
      ? (football.settings.defaultCustomerDiscount ?? 0)
      : (lottery3D.settings.defaultCustomerDiscount ?? 0);

  const defaultUplineCommission =
    modeFilter === '2d'
      ? (lottery2D.settings.defaultCommissionRate ?? 0)
      : modeFilter === 'football'
      ? (football.settings.defaultCommissionRate ?? 0)
      : (lottery3D.settings.defaultCommissionRate ?? 0);

  const getDefaultDownlineForMode = (mode: CommissionBusinessMode): number => {
    if (mode === '2d') return lottery2D.settings.defaultCustomerDiscount ?? 0;
    if (mode === 'football') return football.settings?.defaultCustomerDiscount ?? 0;
    return lottery3D.settings.defaultCustomerDiscount ?? 0;
  };

  const getDefaultUplineForMode = (mode: CommissionBusinessMode): number => {
    if (mode === '2d') return lottery2D.settings.defaultCommissionRate ?? 0;
    if (mode === 'football') return football.settings?.defaultCommissionRate ?? 0;
    return lottery3D.settings.defaultCommissionRate ?? 0;
  };

  const getModeShortLabel = (mode: CommissionBusinessMode): string => {
    if (mode === '2d') return 'ဇီးကွက် (2D)';
    if (mode === '3d') return 'အိုးစည်လေး (3D)';
    return 'ပစ်တိုင်းထောင်';
  };

  // Mode: downline (အောက်လက်ဒိုင်ငယ်/ဖောက်သည်) or upline (အထက်ဒိုင်/မာစတာဒိုင်)
  const [settlementType, setSettlementType] = useState<'downline' | 'upline'>('downline');

  // Date boundaries
  const todayStr = getLocalDateStr();
  const fiveDaysAgoStr = getDaysAgoStr(4);
  const [startDate, setStartDate] = useState(fiveDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [perModeRates, setPerModeRates] = useState<Record<CommissionBusinessMode, number>>({
    '2d': getDefaultDownlineForMode('2d'),
    '3d': getDefaultDownlineForMode('3d'),
    'football': getDefaultDownlineForMode('football')
  });
  const [dirtyModes, setDirtyModes] = useState<Partial<Record<CommissionBusinessMode, boolean>>>({});
  const [copiedStatementText, setCopiedStatementText] = useState(false);

  const [commissionRevision, setCommissionRevision] = useState(0);

  React.useEffect(() => {
    const onCommUpdated = () => setCommissionRevision((r) => r + 1);
    window.addEventListener(COMMISSION_UPDATED_EVENT, onCommUpdated);
    return () => window.removeEventListener(COMMISSION_UPDATED_EVENT, onCommUpdated);
  }, []);

  // Load/save customer & upline custom commission rates strictly scoped by business mode
  const customerCommissionsByMode = useMemo<ScopedCommissionRates>(() => {
    return getCustomerCommissionRatesByMode();
  }, [commissionRevision, isOpen]);

  const uplineCommissionsByMode = useMemo<ScopedCommissionRates>(() => {
    return getUplineCommissionRatesByMode();
  }, [commissionRevision, isOpen]);

  // When selected target or settlementType changes, load its saved per-business custom rates
  React.useEffect(() => {
    if (!selectedTarget) return;
    if (settlementType === 'downline') {
      setPerModeRates({
        '2d': customerCommissionsByMode['2d'][selectedTarget] ?? getDefaultDownlineForMode('2d'),
        '3d': customerCommissionsByMode['3d'][selectedTarget] ?? getDefaultDownlineForMode('3d'),
        'football': customerCommissionsByMode['football'][selectedTarget] ?? getDefaultDownlineForMode('football')
      });
    } else {
      setPerModeRates({
        '2d': uplineCommissionsByMode['2d'][selectedTarget] ?? getDefaultUplineForMode('2d'),
        '3d': uplineCommissionsByMode['3d'][selectedTarget] ?? getDefaultUplineForMode('3d'),
        'football': uplineCommissionsByMode['football'][selectedTarget] ?? getDefaultUplineForMode('football')
      });
    }
    setDirtyModes({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTarget, settlementType, customerCommissionsByMode, uplineCommissionsByMode, lottery2D.settings.defaultCustomerDiscount, lottery2D.settings.defaultCommissionRate, lottery3D.settings.defaultCustomerDiscount, lottery3D.settings.defaultCommissionRate, football.settings.defaultCustomerDiscount, football.settings.defaultCommissionRate]);

  const getRoundKeysInRangeForMode = (mode: CommissionBusinessMode): string[] => {
    const keys: string[] = [];
    if (mode === '2d') {
      lottery2D.rounds.forEach((r) => {
        const d = (r.drawDate || '').slice(0, 10);
        if (d >= startDate && d <= endDate) keys.push(`2d-${r.id}`);
      });
      lottery2D.vouchers.forEach((v: any) => {
        const d = (v.createdAt || '').slice(0, 10);
        if (d >= startDate && d <= endDate && !v.roundId) {
          const k = `2d-orphaned-${d}`;
          if (!keys.includes(k)) keys.push(k);
        }
      });
    } else if (mode === '3d') {
      lottery3D.rounds.forEach((r) => {
        const d = (r.drawDate || '').slice(0, 10);
        if (d >= startDate && d <= endDate) keys.push(`3d-${r.id}`);
      });
      lottery3D.vouchers.forEach((v: any) => {
        const d = (v.createdAt || '').slice(0, 10);
        if (d >= startDate && d <= endDate && !v.roundId) {
          const k = `3d-orphaned-${d}`;
          if (!keys.includes(k)) keys.push(k);
        }
      });
    } else {
      football.slips.forEach((s: any) => {
        const d = s.roundDate || (s.createdAt || '').slice(0, 10);
        if (d >= startDate && d <= endDate) {
          const k = `football-${d}`;
          if (!keys.includes(k)) keys.push(k);
        }
      });
    }
    return keys;
  };

  const handleSaveTargetCommission = (name: string, modeToSave: CommissionBusinessMode, rate: number) => {
    try {
      const clamped = isNaN(rate) || rate < 0 ? 0 : Math.min(100, rate);
      const roundKeys = getRoundKeysInRangeForMode(modeToSave);
      if (settlementType === 'downline') {
        setBulkRoundAndGlobalCustomerCommissions(roundKeys, { [name]: clamped }, modeToSave);
      } else {
        setBulkRoundAndGlobalUplineCommissions(roundKeys, { [name]: clamped }, modeToSave);
      }
      setPerModeRates((prev) => ({ ...prev, [modeToSave]: clamped }));
      setDirtyModes((prev) => ({ ...prev, [modeToSave]: false }));
      setCommissionRevision((r) => r + 1);
      alert(`"${name}" (${getModeShortLabel(modeToSave)}) အတွက် ကော်မရှင်နှုန်း ${clamped}% အား အောင်မြင်စွာ မှတ်သားပြီးပါပြီ ✓`);
    } catch {}
  };

  // 1. Gather all unique Downline Customer Names (scoped by modeFilter)
  const downlineNames = useMemo(() => {
    const set = new Set<string>();
    if (modeFilter === 'all' || modeFilter === '3d') {
      lottery3D.vouchers.forEach((v) => {
        if (!v.deletedAt && v.status !== 'cancelled' && v.customerName && v.customerName.trim()) set.add(v.customerName.trim());
      });
    }
    if (modeFilter === 'all' || modeFilter === '2d') {
      lottery2D.vouchers.forEach((v) => {
        if (!v.deletedAt && v.status !== 'cancelled' && v.customerName && v.customerName.trim()) set.add(v.customerName.trim());
      });
    }
    if (modeFilter === 'all' || modeFilter === 'football') {
      football.slips.forEach((s) => {
        if (!s.deletedAt && s.status !== 'cancelled' && s.customerName && s.customerName.trim()) set.add(s.customerName.trim());
      });
    }
    return Array.from(set).sort();
  }, [modeFilter, lottery3D.vouchers, lottery2D.vouchers, football.slips]);

  // 2. Gather all unique Upline Master Agent Names (scoped by modeFilter)
  const uplineNames = useMemo(() => {
    const set = new Set<string>();
    if (modeFilter === 'all' || modeFilter === '3d') {
      lottery3D.forwardSlips.forEach((f) => {
        if (f.masterAgentName && f.masterAgentName.trim()) set.add(f.masterAgentName.trim());
      });
    }
    if (modeFilter === 'all' || modeFilter === '2d') {
      lottery2D.forwardSlips.forEach((f) => {
        if (f.masterAgentName && f.masterAgentName.trim()) set.add(f.masterAgentName.trim());
      });
    }
    if (modeFilter === 'all' || modeFilter === 'football') {
      football.forwardSlips.forEach((f) => {
        if (f.masterAgentName && f.masterAgentName.trim()) set.add(f.masterAgentName.trim());
      });
    }
    if (modeFilter === 'all') {
      try {
        const savedAgents = localStorage.getItem('shwe_master_agents_list');
        if (savedAgents) {
          const parsed = JSON.parse(savedAgents);
          if (Array.isArray(parsed)) {
            parsed.forEach((a: any) => {
              if (a.name) set.add(a.name.trim());
            });
          }
        }
      } catch {}
    }
    return Array.from(set).sort();
  }, [modeFilter, lottery3D.forwardSlips, lottery2D.forwardSlips, football.forwardSlips]);

  // Keep selectedTarget valid when settlementType or modeFilter changes
  React.useEffect(() => {
    const activeList = settlementType === 'downline' ? downlineNames : uplineNames;
    if (activeList.length === 0) {
      if (selectedTarget) setSelectedTarget('');
    } else if (!selectedTarget || !activeList.includes(selectedTarget)) {
      setSelectedTarget(activeList[0]);
    }
  }, [settlementType, downlineNames, uplineNames, selectedTarget, modeFilter]);

  // Quick preset handlers
  const applyPreset = (days: number) => {
    const end = getLocalDateStr();
    const start = getDaysAgoStr(days - 1);
    setStartDate(start);
    setEndDate(end);
  };

  // ---------------------------------------------------------------------------
  // SETTLEMENT COMPUTATION FOR DOWNLINE (VOUCHERS) — SCOPED PER BUSINESS MODE
  // ---------------------------------------------------------------------------
  const downlineSettlementData = useMemo(() => {
    if (!selectedTarget) {
      return {
        totalSales: 0,
        totalCommission: 0,
        totalPayout: 0,
        netBalance: 0,
        items: [],
        activeModes: [] as CommissionBusinessMode[]
      };
    }

    const roundRatesAll = getAllRoundCustomerCommissions();
    const effectiveGlobalByMode: ScopedCommissionRates = {
      '2d': { ...customerCommissionsByMode['2d'], [selectedTarget]: perModeRates['2d'] },
      '3d': { ...customerCommissionsByMode['3d'], [selectedTarget]: perModeRates['3d'] },
      'football': { ...customerCommissionsByMode['football'], [selectedTarget]: perModeRates['football'] }
    };
    const effectiveRoundRates: Record<string, Record<string, number>> = {};
    for (const [rk, map] of Object.entries(roundRatesAll)) {
      const m = inferModeFromRoundKey(rk);
      if (dirtyModes[m]) {
        const cloned = { ...map };
        delete cloned[selectedTarget];
        effectiveRoundRates[rk] = cloned;
      } else {
        effectiveRoundRates[rk] = map;
      }
    }

    let totalSales = 0;
    let totalCommission = 0;
    let totalPayout = 0;
    const activeModesSet = new Set<CommissionBusinessMode>();
    const dayGroupMap: Record<string, {
      date: string;
      mode: string;
      amount: number;
      commission: number;
      payout: number;
      itemsCount: number;
      summaries: string[];
      winningNumbers: string[];
      winningBets: Array<{ num: string; amt: number; wonAmt: number }>;
    }> = {};

    const addRecord = (
      date: string,
      mode: string,
      amount: number,
      commission: number,
      payout: number,
      summary: string,
      winningNumber?: string,
      wonBets?: Array<{ num: string; amt: number; wonAmt: number }>
    ) => {
      const key = `${date}|${mode}`;
      if (!dayGroupMap[key]) {
        dayGroupMap[key] = {
          date,
          mode,
          amount: 0,
          commission: 0,
          payout: 0,
          itemsCount: 0,
          summaries: [],
          winningNumbers: [],
          winningBets: []
        };
      }
      dayGroupMap[key].amount += amount;
      dayGroupMap[key].commission += commission;
      dayGroupMap[key].payout += payout;
      dayGroupMap[key].itemsCount += 1;
      if (summary && summary !== '-') {
        dayGroupMap[key].summaries.push(summary);
      }
      if (winningNumber && !dayGroupMap[key].winningNumbers.includes(winningNumber)) {
        dayGroupMap[key].winningNumbers.push(winningNumber);
      }
      if (wonBets && wonBets.length > 0) {
        wonBets.forEach(wb => {
          const existing = dayGroupMap[key].winningBets.find(x => x.num === wb.num);
          if (existing) {
            existing.amt += wb.amt;
            existing.wonAmt += wb.wonAmt;
          } else {
            dayGroupMap[key].winningBets.push({ ...wb });
          }
        });
      }
    };

    // 3D Vouchers
    const straightMult3D = typeof lottery3D.settings.defaultMultiplier === 'number' ? lottery3D.settings.defaultMultiplier : 0;
    const toddMult3D = typeof lottery3D.settings.defaultToddMultiplier === 'number' ? lottery3D.settings.defaultToddMultiplier : 0;
    const defaultDownline3D = typeof lottery3D.settings.defaultCustomerDiscount === 'number' ? lottery3D.settings.defaultCustomerDiscount : 0;
    if (modeFilter === 'all' || modeFilter === '3d') {
      lottery3D.vouchers.forEach((v: any) => {
        if (v.status === 'cancelled' || v.deletedAt) return;
        const round = lottery3D.rounds.find(r => r.id === v.roundId);
        const vDate = round?.drawDate || (v.createdAt || '').slice(0, 10);
        if (vDate >= startDate && vDate <= endDate && v.customerName?.trim() === selectedTarget) {
          activeModesSet.add('3d');
          const roundKey3D = round ? `3d-${round.id}` : `3d-orphaned-${vDate}`;
          const resolvedVouch = getResolvedVoucherCommission({
            voucher: v,
            mode: '3d',
            roundKey: roundKey3D,
            defaultDownlineRate: defaultDownline3D,
            globalRatesByMode: effectiveGlobalByMode,
            roundRates: effectiveRoundRates
          });
          const amt = resolvedVouch.gross;
          const comm = resolvedVouch.amount;
          const winningNum = round?.winningNumber ? round.winningNumber.padStart(3, '0') : undefined;

          let payout = 0;
          const wonBets: Array<{ num: string; amt: number; wonAmt: number }> = [];

          if (winningNum && winningNum.length === 3) {
            const evalRes = evaluateWinnings([v], winningNum, straightMult3D, toddMult3D);
            evalRes.winners.forEach((w) => {
              payout += w.wonPayout;
              wonBets.push({ num: w.betNumber, amt: w.betAmount, wonAmt: w.wonPayout });
            });
          } else if (v.items && Array.isArray(v.items)) {
            v.items.forEach((it: any) => {
              if (it.isWon) {
                const itemMult = it.betType === 'rumble' ? toddMult3D : straightMult3D;
                const won = it.wonAmount || (it.amount * itemMult);
                payout += won;
                wonBets.push({ num: it.number, amt: it.amount, wonAmt: won });
              }
            });
          }

          totalSales += amt;
          totalCommission += comm;
          totalPayout += payout;
          const sumText = v.items ? v.items.map((i: any) => `${i.number}(${i.amount})`).join(', ') : '-';
          addRecord(vDate, 'အိုးစည်လေး', amt, comm, payout, sumText, winningNum, wonBets);
        }
      });
    }

    // 2D Vouchers
    const defaultDownline2D = typeof lottery2D.settings.defaultCustomerDiscount === 'number' ? lottery2D.settings.defaultCustomerDiscount : 0;
    if (modeFilter === 'all' || modeFilter === '2d') {
      lottery2D.vouchers.forEach((v: any) => {
        if (v.status === 'cancelled' || v.deletedAt) return;
        const round = lottery2D.rounds.find(r => r.id === v.roundId);
        const vDate = round?.drawDate || (v.createdAt || '').slice(0, 10);
        if (vDate >= startDate && vDate <= endDate && v.customerName?.trim() === selectedTarget) {
          activeModesSet.add('2d');
          const sessionLabel = round?.session === 'morning' ? 'မနက်' : round?.session === 'evening' ? 'ညနေ' : '၂ လုံး';
          const roundKey2D = round ? `2d-${round.id}` : `2d-orphaned-${vDate}`;
          const resolvedVouch = getResolvedVoucherCommission({
            voucher: v,
            mode: '2d',
            roundKey: roundKey2D,
            defaultDownlineRate: defaultDownline2D,
            globalRatesByMode: effectiveGlobalByMode,
            roundRates: effectiveRoundRates
          });
          const amt = resolvedVouch.gross;
          const comm = resolvedVouch.amount;
          const winningNum = round?.winningNumber;
          const mult = round?.multiplier || lottery2D.settings.defaultMultiplier || 80;

          let payout = 0;
          const wonBets: Array<{ num: string; amt: number; wonAmt: number }> = [];

          if (v.items && Array.isArray(v.items)) {
            v.items.forEach((it: any) => {
              const isHit = it.isWon || (winningNum && it.number === winningNum);
              if (isHit) {
                const won = it.wonAmount || (it.amount * mult);
                payout += won;
                wonBets.push({ num: it.number, amt: it.amount, wonAmt: won });
              }
            });
          }
          if (payout === 0 && v.winningPayout) {
            payout = v.winningPayout;
          }

          totalSales += amt;
          totalCommission += comm;
          totalPayout += payout;
          const sumText = v.items ? v.items.map((i: any) => `${i.number}(${i.amount})`).join(', ') : '-';
          const dayShort = getMyanmarShortDay(vDate);
          const twoDModeLabel = dayShort ? `${dayShort} (${sessionLabel})` : sessionLabel;
          addRecord(vDate, twoDModeLabel, amt, comm, payout, sumText, winningNum, wonBets);
        }
      });
    }

    // Football Slips
    const defaultDownlineFB = typeof football.settings?.defaultCustomerDiscount === 'number' ? football.settings.defaultCustomerDiscount : 0;
    if (modeFilter === 'all' || modeFilter === 'football') {
      football.slips.forEach((s: any) => {
        if (s.status === 'cancelled' || s.deletedAt) return;
        const sDate = s.roundDate || (s.createdAt || '').slice(0, 10);
        if (sDate >= startDate && sDate <= endDate && s.customerName?.trim() === selectedTarget) {
          activeModesSet.add('football');
          const roundKeyFB = `football-${sDate}`;
          const resolvedSlip = getResolvedVoucherCommission({
            voucher: s,
            mode: 'football',
            roundKey: roundKeyFB,
            defaultDownlineRate: defaultDownlineFB,
            globalRatesByMode: effectiveGlobalByMode,
            roundRates: effectiveRoundRates
          });
          const amt = resolvedSlip.gross;
          const comm = resolvedSlip.amount;
          const isSettledOrEvaluated =
            s.status === 'settled' ||
            s.outcome === 'won' ||
            s.outcome === 'half_won' ||
            s.outcome === 'draw' ||
            s.outcome === 'half_lost' ||
            s.outcome === 'lost';
          const payout = !isSettledOrEvaluated
            ? 0
            : typeof s.actualPayout === 'number'
            ? s.actualPayout
            : (s.outcome === 'won' || s.outcome === 'half_won')
            ? (s.potentialPayout || 0)
            : (s.winningPayout || 0);

          totalSales += amt;
          totalCommission += comm;
          totalPayout += payout;
          const sumText = s.selections ? s.selections.map((sel: any) => sel.matchSummary).join(', ') : '-';
          addRecord(sDate, 'ပစ်တိုင်းထောင်', amt, comm, payout, sumText);
        }
      });
    }

    const items = Object.values(dayGroupMap).map(g => ({
      date: g.date,
      mode: g.mode,
      refNo: `${g.itemsCount} ဘောင်ချာ`,
      amount: g.amount,
      commission: g.commission,
      payout: g.payout,
      winningNumbers: g.winningNumbers,
      winningBets: g.winningBets,
      summary: g.summaries.join(' | ') || '-'
    }));

    const netBalance = (totalSales - totalCommission) - totalPayout;
    const activeModes: CommissionBusinessMode[] =
      modeFilter !== 'all'
        ? [modeFilter]
        : COMMISSION_BUSINESS_MODES.filter((m) => activeModesSet.has(m));

    return {
      totalSales,
      totalCommission,
      totalPayout,
      netBalance,
      items: items.sort((a, b) => b.date.localeCompare(a.date)),
      activeModes
    };
  }, [modeFilter, selectedTarget, startDate, endDate, perModeRates, dirtyModes, customerCommissionsByMode, commissionRevision, lottery3D.vouchers, lottery3D.rounds, lottery3D.settings, lottery2D.vouchers, lottery2D.rounds, lottery2D.settings, football.slips, football.settings]);

  // ---------------------------------------------------------------------------
  // SETTLEMENT COMPUTATION FOR UPLINE (FORWARD SLIPS via generateStatementRecords)
  // ---------------------------------------------------------------------------
  const uplineSettlementData = useMemo(() => {
    if (!selectedTarget) {
      return {
        totalForwarded: 0,
        totalCommission: 0,
        totalPayout: 0,
        netBalance: 0,
        items: [],
        activeModes: [] as CommissionBusinessMode[]
      };
    }

    const dataSources = {
      lottery2D: {
        rounds: lottery2D.rounds,
        vouchers: lottery2D.vouchers,
        forwardSlips: lottery2D.forwardSlips,
        settings: lottery2D.settings
      },
      lottery3D: {
        rounds: lottery3D.rounds,
        vouchers: lottery3D.vouchers,
        forwardSlips: lottery3D.forwardSlips,
        settings: lottery3D.settings
      },
      football: {
        slips: football.slips,
        forwardSlips: football.forwardSlips,
        settings: football.settings
      }
    };

    const effectiveUplineByMode: ScopedCommissionRates = {
      '2d': { ...uplineCommissionsByMode['2d'], [selectedTarget]: perModeRates['2d'] },
      '3d': { ...uplineCommissionsByMode['3d'], [selectedTarget]: perModeRates['3d'] },
      'football': { ...uplineCommissionsByMode['football'], [selectedTarget]: perModeRates['football'] }
    };
    const rawUplineRoundRates = getAllRoundUplineCommissions();
    const effectiveUplineRoundRates: Record<string, Record<string, number>> = {};
    for (const [rk, map] of Object.entries(rawUplineRoundRates)) {
      const m = inferModeFromRoundKey(rk);
      if (dirtyModes[m]) {
        const cloned = { ...map };
        delete cloned[selectedTarget];
        effectiveUplineRoundRates[rk] = cloned;
      } else {
        effectiveUplineRoundRates[rk] = map;
      }
    }

    const records = generateStatementRecords(dataSources, modeFilter, startDate, endDate, {
      globalRatesByMode: customerCommissionsByMode,
      roundRates: getAllRoundCustomerCommissions(),
      uplineGlobalRatesByMode: effectiveUplineByMode,
      uplineRoundRates: effectiveUplineRoundRates
    });

    let totalForwarded = 0;
    let totalCommission = 0;
    let totalPayout = 0;
    const activeModesSet = new Set<CommissionBusinessMode>();
    const items: Array<{
      date: string;
      mode: string;
      refNo: string;
      amount: number;
      commission: number;
      payout: number;
      winningNumbers: string[];
      winningBets: Array<{ num: string; amt: number; wonAmt: number }>;
      summary: string;
    }> = [];

    const straightMult3D = typeof lottery3D.settings.defaultMultiplier === 'number' ? lottery3D.settings.defaultMultiplier : 0;
    const toddMult3D = typeof lottery3D.settings.defaultToddMultiplier === 'number' ? lottery3D.settings.defaultToddMultiplier : 0;
    const uplineRate3D = typeof lottery3D.settings.defaultCommissionRate === 'number' ? lottery3D.settings.defaultCommissionRate : 0;
    const uplineRate2D = typeof lottery2D.settings.defaultCommissionRate === 'number' ? lottery2D.settings.defaultCommissionRate : 0;
    const uplineRateFB = typeof football.settings.defaultCommissionRate === 'number' ? football.settings.defaultCommissionRate : 0;

    records.forEach((rec) => {
      const forwards = rec.forwardList || [];
      const targetForwards = forwards.filter((f: any) => !(f as any).deletedAt && f.masterAgentName?.trim() === selectedTarget);
      const defaultRecUplineRate =
        rec.mode === '3d' ? uplineRate3D : rec.mode === '2d' ? uplineRate2D : uplineRateFB;

      if (targetForwards.length > 0) {
        activeModesSet.add(rec.mode);
        let recAgentForwarded = 0;
        let recAgentCommission = 0;
        targetForwards.forEach((f: any) => {
          const amt = f.totalAmount || 0;
          recAgentForwarded += amt;
          const resolvedFwd = getResolvedForwardCommission({
            forwardSlip: f,
            mode: rec.mode,
            roundKey: rec.id,
            defaultUplineRate: defaultRecUplineRate,
            uplineGlobalRatesByMode: effectiveUplineByMode,
            uplineRoundRates: effectiveUplineRoundRates
          });
          recAgentCommission += resolvedFwd.amount;
        });

        let recAgentPayout = 0;
        const winningNumbers: string[] = [];
        const winningBets: Array<{ num: string; amt: number; wonAmt: number }> = [];

        if (rec.mode === '3d') {
          if (rec.winningResult && /^\d{3}$/.test(rec.winningResult.trim())) {
            const win3D = rec.winningResult.trim().padStart(3, '0');
            winningNumbers.push(win3D);
            recAgentPayout = calculate3DForwardMasterPayout(targetForwards, win3D, straightMult3D, toddMult3D);

            const toddSet = new Set(getToddWinningNumbers(win3D));
            targetForwards.forEach((f: any) => {
              (f.items || []).forEach((it: any) => {
                const num = String(it.number || '').trim().padStart(3, '0');
                const amt = Number(it.amount) || 0;
                if (amt <= 0) return;
                let won = 0;
                if (num === win3D) {
                  won = straightMult3D > 0 ? amt * straightMult3D : 0;
                } else if (toddSet.has(num)) {
                  won = toddMult3D > 0 ? amt * toddMult3D : 0;
                }
                if (won > 0 || num === win3D || toddSet.has(num)) {
                  const existing = winningBets.find(x => x.num === num);
                  if (existing) {
                    existing.amt += amt;
                    existing.wonAmt += won;
                  } else {
                    winningBets.push({ num, amt, wonAmt: won });
                  }
                }
              });
            });
          }
        } else if (rec.mode === '2d') {
          if (rec.winningResult && /^\d{2}$/.test(rec.winningResult.trim())) {
            const win2D = rec.winningResult.trim().padStart(2, '0');
            winningNumbers.push(win2D);
            const round2D = lottery2D.rounds.find(r => r.id === rec.rawRoundId);
            const mult2D = round2D?.multiplier || lottery2D.settings.defaultMultiplier || 80;

            let exact2DPayout = 0;
            let hasItemList = false;
            targetForwards.forEach((f: any) => {
              if (Array.isArray(f.items) && f.items.length > 0) {
                hasItemList = true;
                f.items.forEach((it: any) => {
                  const num = String(it.number || '').trim().padStart(2, '0');
                  const amt = Number(it.amount) || 0;
                  if (amt > 0 && num === win2D) {
                    const won = mult2D > 0 ? amt * mult2D : 0;
                    exact2DPayout += won;
                    const existing = winningBets.find(x => x.num === num);
                    if (existing) {
                      existing.amt += amt;
                      existing.wonAmt += won;
                    } else {
                      winningBets.push({ num, amt, wonAmt: won });
                    }
                  }
                });
              }
            });

            if (hasItemList) {
              recAgentPayout = Math.round(exact2DPayout);
            } else if (rec.totalForwarded > 0 && rec.masterPayout > 0) {
              recAgentPayout = Math.round((recAgentForwarded / rec.totalForwarded) * rec.masterPayout);
            }
          } else if (rec.totalForwarded > 0 && rec.masterPayout > 0) {
            recAgentPayout = Math.round((recAgentForwarded / rec.totalForwarded) * rec.masterPayout);
          }
        } else if (rec.totalForwarded > 0 && rec.masterPayout > 0) {
          recAgentPayout = Math.round((recAgentForwarded / rec.totalForwarded) * rec.masterPayout);
        }

        totalForwarded += recAgentForwarded;
        totalCommission += recAgentCommission;
        totalPayout += recAgentPayout;

        const dayShort = getMyanmarShortDay(rec.date);
        const sessionLabel = rec.session === 'morning' ? 'မနက်' : rec.session === 'evening' ? 'ညနေ' : '';
        const uplineModeLabel = rec.mode === '2d'
          ? (dayShort ? (sessionLabel ? `${dayShort} (${sessionLabel})` : dayShort) : (sessionLabel || '၂ လုံး'))
          : replaceZeegwetWithWeekday(rec.date, rec.modeLabel);

        items.push({
          date: rec.date,
          mode: uplineModeLabel,
          refNo: rec.name,
          amount: recAgentForwarded,
          commission: recAgentCommission,
          payout: recAgentPayout,
          winningNumbers,
          winningBets,
          summary: `ရလဒ်: ${rec.winningResult} (တင်ကြေး: ${recAgentForwarded}, ပေါက်ကြေးရရန်: ${recAgentPayout})`
        });
      }
    });

    const netBalance = (totalForwarded - totalCommission) - totalPayout;
    const activeModes: CommissionBusinessMode[] =
      modeFilter !== 'all'
        ? [modeFilter]
        : COMMISSION_BUSINESS_MODES.filter((m) => activeModesSet.has(m));

    return {
      totalForwarded,
      totalCommission,
      totalPayout,
      netBalance,
      items: items.sort((a, b) => b.date.localeCompare(a.date)),
      activeModes
    };
  }, [modeFilter, selectedTarget, startDate, endDate, perModeRates, dirtyModes, customerCommissionsByMode, uplineCommissionsByMode, commissionRevision, lottery2D.rounds, lottery2D.vouchers, lottery2D.forwardSlips, lottery2D.settings, lottery3D.rounds, lottery3D.vouchers, lottery3D.forwardSlips, lottery3D.settings, football.slips, football.forwardSlips, football.settings]);

  const activeModesForControls: CommissionBusinessMode[] = useMemo(() => {
    if (modeFilter !== 'all') return [modeFilter];
    const fromData =
      settlementType === 'downline'
        ? downlineSettlementData.activeModes
        : uplineSettlementData.activeModes;
    return fromData.length > 0 ? fromData : ['2d', '3d'];
  }, [modeFilter, settlementType, downlineSettlementData.activeModes, uplineSettlementData.activeModes]);

  const rateSummaryLabel = useMemo(() => {
    if (activeModesForControls.length === 1) {
      return `${perModeRates[activeModesForControls[0]]}%`;
    }
    return activeModesForControls
      .map((m) => `${m.toUpperCase()} ${perModeRates[m]}%`)
      .join(' / ');
  }, [activeModesForControls, perModeRates]);

  // Export to Excel
  const handleExportExcel = () => {
    if (settlementType === 'downline') {
      const data = downlineSettlementData.items.map((item, idx) => ({
        'စဉ်': idx + 1,
        'ရက်စွဲ': item.date,
        'လုပ်ငန်းလိုင်း': item.mode,
        'ဘောက်ချာနံပါတ်': item.refNo,
        'ထိုးငွေ (ကျပ်)': item.amount,
        'ပေါက်ကြေး (ကျပ်)': item.payout,
        'အသေးစိတ်': item.summary
      }));

      data.push({
        'စဉ်': 0 as any,
        'ရက်စွဲ': 'စုစုပေါင်း ချုပ်',
        'လုပ်ငန်းလိုင်း': '-',
        'ဘောက်ချာနံပါတ်': `ဒိုင်ငယ်: ${selectedTarget}`,
        'ထိုးငွေ (ကျပ်)': downlineSettlementData.totalSales,
        'ပေါက်ကြေး (ကျပ်)': downlineSettlementData.totalPayout,
        'အသေးစိတ်': `ကော်မရှင် (${rateSummaryLabel}): ${downlineSettlementData.totalCommission}`
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Downline_Settlement');
      XLSX.writeFile(wb, `အောက်လက်ရှင်းတမ်း_${selectedTarget}_${startDate}_မှ_${endDate}.xlsx`);
    } else {
      const data = uplineSettlementData.items.map((item, idx) => ({
        'စဉ်': idx + 1,
        'ရက်စွဲ': item.date,
        'လုပ်ငန်းလိုင်း': item.mode,
        'လွှဲစာရင်းနံပါတ်': item.refNo,
        'တင်ကြေး (ကျပ်)': item.amount,
        'ကော်မရှင် (ကျပ်)': item.commission,
        'ပေါက်ကြေး (ကျပ်)': item.payout,
        'အသေးစိတ်': item.summary
      }));

      data.push({
        'စဉ်': 0 as any,
        'ရက်စွဲ': 'စုစုပေါင်း ချုပ်',
        'လုပ်ငန်းလိုင်း': '-',
        'လွှဲစာရင်းနံပါတ်': `အထက်ဒိုင်: ${selectedTarget}`,
        'တင်ကြေး (ကျပ်)': uplineSettlementData.totalForwarded,
        'ကော်မရှင် (ကျပ်)': uplineSettlementData.totalCommission,
        'ပေါက်ကြေး (ကျပ်)': uplineSettlementData.totalPayout,
        'အသေးစိတ်': `အသားတင်ရှင်းရန်: ${uplineSettlementData.netBalance}`
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Upline_Settlement');
      XLSX.writeFile(wb, `အထက်ဒိုင်ရှင်းတမ်း_${selectedTarget}_${startDate}_မှ_${endDate}.xlsx`);
    }
  };

  const handlePrint = () => {
    printStatementReport('printable-period-settlement', 'ကာလအလိုက် စာရင်းရှင်းတမ်း အစီရင်ခံစာ');
  };

  const handleCopyText = () => {
    const isDownline = settlementType === 'downline';
    const targetName = selectedTarget || '-';
    const totalSalesOrForward = isDownline ? downlineSettlementData.totalSales : uplineSettlementData.totalForwarded;
    const totalComm = isDownline ? downlineSettlementData.totalCommission : uplineSettlementData.totalCommission;
    const netSales = isDownline ? (downlineSettlementData.totalSales - downlineSettlementData.totalCommission) : (uplineSettlementData.totalForwarded - uplineSettlementData.totalCommission);
    const totalPayout = isDownline ? downlineSettlementData.totalPayout : uplineSettlementData.totalPayout;
    const netBal = isDownline ? downlineSettlementData.netBalance : uplineSettlementData.netBalance;

    let text = '';
    text += `အမည်: ${targetName}\n`;
    text += `ကာလ: ${startDate} မှ ${endDate} အထိ\n`;
    text += `------------------------------------\n`;

    const items = isDownline ? downlineSettlementData.items : uplineSettlementData.items;
    items.forEach((item: any) => {
      const modePart = item.mode && item.mode !== 'အိုးစည်လေး' ? ` (${item.mode})` : '';
      text += `${item.date}${modePart} - ထိုး/တင်: ${formatAmount(Number(item.amount), '')}`;
      if (item.winningNumbers && item.winningNumbers.length > 0) {
        text += ` [ထွက်ဂဏန်း: ${item.winningNumbers.join(', ')}]`;
      }
      if (item.commission) text += `, ကော်: ${formatAmount(Number(item.commission), '')}`;
      if (item.payout > 0) {
        text += `, ပေါက်ကြေး: ${formatAmount(Number(item.payout), '')} Ks`;
        if (item.winningBets && item.winningBets.length > 0) {
          const wDetail = item.winningBets.map((wb: any) => `${wb.num} ${formatAmount(wb.amt, '')}P`).join(', ');
          text += ` [${wDetail}]`;
        }
      }
      text += `\n`;
    });

    text += `------------------------------------\n`;
    text += `စုစုပေါင်း ${isDownline ? 'ထိုးကြေး' : 'တင်ကြေး'}: ${formatAmount(totalSalesOrForward, currency)}\n`;
    text += `နုတ် - ကော်မရှင်: - ${formatAmount(totalComm, currency)}\n`;
    text += `အမှန်ရောင်းငွေ / ကျန်ငွေ: ${formatAmount(netSales, currency)}\n`;
    text += `နုတ် - ပေါက်ကြေး: - ${formatAmount(totalPayout, currency)}\n`;
    text += `နောက်ဆုံး ${isDownline ? (netBal >= 0 ? 'ရရန်ငွေ' : 'ပေးရန်ငွေ') : (netBal >= 0 ? 'အထက်ဒိုင်သို့ ပေးရန်' : 'အထက်ဒိုင်မှ ရရန်')}: ${formatAmount(Math.abs(netBal), currency)}\n`;

    navigator.clipboard.writeText(text);
    setCopiedStatementText(true);
    setTimeout(() => setCopiedStatementText(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col justify-between overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold border border-teal-500/30">
              <Wallet className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide">
                {modeFilter === '3d'
                  ? 'အိုးစည်လေး (3D) ကာလအလိုက် စာရင်းရှင်းတမ်း'
                  : modeFilter === '2d'
                  ? 'ဇီးကွက် (2D) ကာလအလိုက် စာရင်းရှင်းတမ်း'
                  : modeFilter === 'football'
                  ? 'ပစ်တိုင်းထောင် ကာလအလိုက် စာရင်းရှင်းတမ်း'
                  : 'ကာလအလိုက် အကြွေးစာရင်းရှင်းတမ်း (လုပ်ငန်း ၃ ခုစုံ)'}
              </h2>
              <span className="text-xs font-bold text-slate-400">
                {modeFilter === 'all'
                  ? '၅ ရက်စာ (တနင်္လာမှ သောကြာ) အထက်ဒိုင်နှင့် အောက်လက်ဒိုင်ငယ်များ ရှင်းတမ်း'
                  : 'သက်ဆိုင်ရာ လုပ်ငန်းတစ်ခုချင်းစီအလိုက် အထက်ဒိုင်နှင့် အောက်လက်ဒိုင်ငယ်များ ရှင်းတမ်း'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
          
          {/* Top Switcher: Downline vs Upline */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setSettlementType('downline');
                setSelectedTarget(downlineNames[0] || '');
              }}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                settlementType === 'downline'
                  ? 'bg-teal-700 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>အောက်လက် (ဒိုင်ငယ်/ထိုးသား) ရှင်းတမ်း</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSettlementType('upline');
                setSelectedTarget(uplineNames[0] || '');
              }}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                settlementType === 'upline'
                  ? 'bg-indigo-700 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>အထက်ဒိုင် (Master Agent) ရှင်းတမ်း</span>
            </button>
          </div>

          {/* Filter Bar: Target Selection & Date Range */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
            
            {/* Target Select */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {settlementType === 'downline' ? 'ဒိုင်ငယ် / ဖောက်သည် အမည်' : 'အထက်ဒိုင် အမည်'}
              </label>
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/30 outline-none"
              >
                {settlementType === 'downline' ? (
                  downlineNames.length === 0 ? (
                    <option value="">ထိုးသား အမည် မရှိသေးပါ</option>
                  ) : (
                    downlineNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))
                  )
                ) : (
                  uplineNames.length === 0 ? (
                    <option value="">အထက်ဒိုင် အမည် မရှိသေးပါ</option>
                  ) : (
                    uplineNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))
                  )
                )}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">စတင်မည့်ရက် (Start Date)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/30 outline-none"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ပြီးဆုံးမည့်ရက် (End Date)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/30 outline-none"
              />
            </div>
          </div>

          {/* Quick Presets & Commission Override Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-500 mr-1">ကာလရွေးရန်:</span>
              <button
                type="button"
                onClick={() => applyPreset(5)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                ၅ ရက်စာ (Default)
              </button>
              <button
                type="button"
                onClick={() => applyPreset(7)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                ၇ ရက်စာ (၁ ပတ်)
              </button>
              <button
                type="button"
                onClick={() => applyPreset(30)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                ၃၀ ရက်စာ (၁ လ)
              </button>
            </div>

            {selectedTarget && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Percent className={`w-3.5 h-3.5 ${settlementType === 'downline' ? 'text-teal-600' : 'text-indigo-600'}`} />
                  {settlementType === 'downline' ? 'ထိုးသားကော် %:' : 'အထက်ဒိုင်ကော် %:'}
                </span>
                {activeModesForControls.map((m) => (
                  <div
                    key={m}
                    className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1"
                  >
                    {activeModesForControls.length > 1 && (
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                        m === '2d'
                          ? 'bg-teal-100 text-teal-900'
                          : m === '3d'
                          ? 'bg-slate-200 text-slate-900'
                          : 'bg-emerald-100 text-emerald-900'
                      }`}>
                        {m === '2d' ? '2D' : m === '3d' ? '3D' : 'FB'}
                      </span>
                    )}
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={perModeRates[m]}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setPerModeRates((prev) => ({ ...prev, [m]: isNaN(val) ? 0 : val }));
                        setDirtyModes((prev) => ({ ...prev, [m]: true }));
                      }}
                      className="w-14 bg-white border border-slate-300 rounded-lg px-1.5 py-0.5 text-xs font-mono font-bold text-center text-slate-800 focus:ring-2 focus:ring-teal-500/30 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveTargetCommission(selectedTarget, m, perModeRates[m])}
                      className={`px-2 py-0.5 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                        settlementType === 'downline'
                          ? 'bg-teal-600 hover:bg-teal-700'
                          : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                      title={`${getModeShortLabel(m)} အတွက် ကော်မရှင်နှုန်းအား အမြဲမှတ်သားရန်`}
                    >
                      မှတ်သား
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary Cards */}
          {settlementType === 'downline' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-teal-950 text-white rounded-2xl p-3.5 border border-teal-800/60 shadow-xs">
                <span className="text-[11px] font-bold text-teal-300 block mb-1">စုစုပေါင်း ထိုးငွေ (Sales)</span>
                <span className="text-base sm:text-lg font-mono font-black text-amber-400">
                  {formatAmount(downlineSettlementData.totalSales)} {currency}
                </span>
              </div>
              <div className="bg-sky-950 text-white rounded-2xl p-3.5 border border-sky-800/60 shadow-xs">
                <span className="text-[11px] font-bold text-sky-300 block mb-1">ကော်မရှင် ({rateSummaryLabel})</span>
                <span className="text-base sm:text-lg font-mono font-black text-sky-300">
                  {formatAmount(downlineSettlementData.totalCommission)} {currency}
                </span>
              </div>
              <div className="bg-amber-950 text-white rounded-2xl p-3.5 border border-amber-800/60 shadow-xs">
                <span className="text-[11px] font-bold text-amber-300 block mb-1">ပေါက်ကြေး / လျော်ငွေ</span>
                <span className="text-base sm:text-lg font-mono font-black text-amber-300">
                  {formatAmount(downlineSettlementData.totalPayout)} {currency}
                </span>
              </div>
              <div className={`rounded-2xl p-3.5 border shadow-xs text-white ${downlineSettlementData.netBalance >= 0 ? 'bg-emerald-900 border-emerald-700' : 'bg-rose-950 border-rose-800'}`}>
                <span className="text-[11px] font-bold text-emerald-200 block mb-1">
                  {downlineSettlementData.netBalance >= 0 ? 'ရှင်းရန် (ရရန်ငွေ)' : 'ရှင်းရန် (ပေးရန်ငွေ)'}
                </span>
                <span className="text-base sm:text-lg font-mono font-black text-white">
                  {formatAmount(Math.abs(downlineSettlementData.netBalance))} {currency}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-indigo-950 text-white rounded-2xl p-3.5 border border-indigo-800/60 shadow-xs">
                <span className="text-[11px] font-bold text-indigo-300 block mb-1">စုစုပေါင်း တတင်ကြေး</span>
                <span className="text-base sm:text-lg font-mono font-black text-amber-400">
                  {formatAmount(uplineSettlementData.totalForwarded)} {currency}
                </span>
              </div>
              <div className="bg-sky-950 text-white rounded-2xl p-3.5 border border-sky-800/60 shadow-xs">
                <span className="text-[11px] font-bold text-sky-300 block mb-1">ကော်မရှင်ပြန်ရငွေ ({rateSummaryLabel})</span>
                <span className="text-base sm:text-lg font-mono font-black text-sky-300">
                  {formatAmount(uplineSettlementData.totalCommission)} {currency}
                </span>
              </div>
              <div className="bg-amber-950 text-white rounded-2xl p-3.5 border border-amber-800/60 shadow-xs">
                <span className="text-[11px] font-bold text-amber-300 block mb-1">အထက်ပေါက်ကြေး ပြန်ရငွေ</span>
                <span className="text-base sm:text-lg font-mono font-black text-amber-300">
                  {formatAmount(uplineSettlementData.totalPayout)} {currency}
                </span>
              </div>
              <div className={`rounded-2xl p-3.5 border shadow-xs text-white ${uplineSettlementData.netBalance >= 0 ? 'bg-emerald-900 border-emerald-700' : 'bg-rose-950 border-rose-800'}`}>
                <span className="text-[11px] font-bold text-emerald-200 block mb-1">
                  {uplineSettlementData.netBalance >= 0 ? 'အထက်ဒိုင်သို့ ပေးရန်' : 'အထက်ဒိုင်မှ ရရန်'}
                </span>
                <span className="text-base sm:text-lg font-mono font-black text-white">
                  {formatAmount(Math.abs(uplineSettlementData.netBalance))} {currency}
                </span>
              </div>
            </div>
          )}

          {/* Traditional Paper Slip Ledger Preview Card (Matching EM_25284f9f.jpg & image_0b84c059.png) */}
          <div id="printable-period-settlement" className="bg-amber-50/90 border-2 border-amber-900/30 rounded-2xl p-5 shadow-sm max-w-xl mx-auto space-y-4 font-mono text-slate-900">
            <div className="text-center border-b-2 border-dashed border-amber-900/30 pb-3 space-y-0.5">
              <div className="text-xs font-bold text-slate-700">
                အမည်: <span className="text-indigo-700 underline">{selectedTarget || '-'}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-sans">
                ({startDate} မှ {endDate} အထိ)
              </div>
            </div>

            {/* Day-by-Day / Session-by-Session Breakdown Items (တနေ့စာချင်း အသေးစိတ်) */}
            <div className="border-b border-dashed border-slate-300 pb-3 space-y-2">
              <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                ရက်အလိုက် / ပွဲစဉ်အလိုက် အသေးစိတ်
              </div>
              {settlementType === 'downline' ? (
                downlineSettlementData.items.length === 0 ? (
                  <div className="text-xs text-slate-400 py-1">စာရင်းများ မရှိသေးပါ</div>
                ) : (
                  downlineSettlementData.items.map((item, i) => (
                    <div key={i} className="py-2 border-b border-slate-200/80 last:border-0 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {(item.payout > 0 || (item.winningBets && item.winningBets.length > 0)) && (
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 inline shrink-0" />
                          )}
                          <span className="font-bold text-slate-900">{item.date}</span>
                          {item.mode && item.mode !== 'အိုးစည်လေး' && (
                            <span className="text-slate-600 font-bold text-[11px]">({item.mode})</span>
                          )}
                          {item.winningNumbers && item.winningNumbers.length > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-300">
                              ထွက်ဂဏန်း: {item.winningNumbers.join(', ')}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-800">ထိုးကြေး: {formatAmount(item.amount, '')}</span>
                        </div>
                      </div>

                      {/* Winning details: numbers and bet P like paper ledger */}
                      {item.payout > 0 && (
                        <div className="flex items-center justify-between text-xs bg-rose-50/70 border border-rose-200 rounded-lg px-2.5 py-1.5">
                          <div className="text-[12px] text-rose-800 flex items-center gap-2 flex-wrap">
                            {item.winningBets && item.winningBets.length > 0 ? (
                              item.winningBets.map((wb, wIdx) => (
                                <span key={wIdx} className="font-mono font-bold inline-flex items-center gap-1.5">
                                  <span className="inline-block px-2 py-0.5 bg-white border border-rose-400 text-rose-700 rounded-full font-black text-xs shadow-2xs">
                                    {wb.num}
                                  </span>
                                  <span className="font-black text-rose-700">{formatAmount(wb.amt, '')} P</span>
                                </span>
                              ))
                            ) : (
                              item.winningNumbers && item.winningNumbers.map((wn, wnIdx) => (
                                <span key={wnIdx} className="inline-block px-2 py-0.5 bg-white border border-rose-400 text-rose-700 rounded-full font-black text-xs shadow-2xs">
                                  {wn}
                                </span>
                              ))
                            )}
                          </div>
                          <div className="text-rose-700 font-black text-right shrink-0">
                            ပေါက်ကြေး: {formatAmount(item.payout, '')} Ks
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )
              ) : (
                uplineSettlementData.items.length === 0 ? (
                  <div className="text-xs text-slate-400 py-1">လွှဲစာရင်းများ မရှိသေးပါ</div>
                ) : (
                  uplineSettlementData.items.map((item, i) => (
                    <div key={i} className="py-2 border-b border-slate-200/80 last:border-0 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {item.payout > 0 && (
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 inline shrink-0" />
                          )}
                          <span className="font-bold text-slate-900">{item.date}</span>
                          {item.mode && item.mode !== 'အိုးစည်လေး' && (
                            <span className="text-slate-600 font-bold text-[11px]">({item.mode})</span>
                          )}
                          {item.winningNumbers && item.winningNumbers.length > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-300">
                              ထွက်ဂဏန်း: {item.winningNumbers.join(', ')}
                            </span>
                          )}
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <span className="font-bold text-slate-800">တင်ကြေး: {formatAmount(item.amount, '')}</span>
                          <span className="text-sky-700 font-bold text-[11px]">ကော်: {formatAmount(item.commission, '')}</span>
                        </div>
                      </div>

                      {item.payout > 0 && (
                        <div className="flex items-center justify-between text-xs bg-rose-50/70 border border-rose-200 rounded-lg px-2.5 py-1.5">
                          <div className="text-[12px] text-rose-800 flex items-center gap-2 flex-wrap">
                            {item.winningBets && item.winningBets.length > 0 ? (
                              item.winningBets.map((wb, wIdx) => (
                                <span key={wIdx} className="font-mono font-bold inline-flex items-center gap-1.5">
                                  <span className="inline-block px-2 py-0.5 bg-white border border-rose-400 text-rose-700 rounded-full font-black text-xs shadow-2xs">
                                    {wb.num}
                                  </span>
                                  <span className="font-black text-rose-700">{formatAmount(wb.amt, '')} P</span>
                                </span>
                              ))
                            ) : item.winningNumbers && item.winningNumbers.length > 0 ? (
                              item.winningNumbers.map((wn, wnIdx) => (
                                <span key={wnIdx} className="inline-block px-2 py-0.5 bg-white border border-rose-400 text-rose-700 rounded-full font-black text-xs shadow-2xs">
                                  {wn}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-rose-800 font-bold">အထက်ပေါက်ကြေး ပြန်ရငွေ</span>
                            )}
                          </div>
                          <div className="text-rose-700 font-black text-right shrink-0">
                            ပေါက်ကြေး: {formatAmount(item.payout, '')} Ks
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )
              )}
            </div>

            {/* Grand Totals Summary (Matching image_0b84c059.png) */}
            <div className="space-y-2 text-xs pt-1">
              <div className="flex items-center justify-between font-bold">
                <span>{settlementType === 'downline' ? 'စုစုပေါင်းထိုးကြေး:' : 'စုစုပေါင်းတင်ကြေး:'}</span>
                <span>{formatAmount(settlementType === 'downline' ? downlineSettlementData.totalSales : uplineSettlementData.totalForwarded, currency)}</span>
              </div>

              <div className="flex items-center justify-between text-rose-700 font-bold border-b border-dashed border-slate-300 pb-2">
                <span>နုတ် - ကော်မရှင်:</span>
                <span>- {formatAmount(settlementType === 'downline' ? downlineSettlementData.totalCommission : uplineSettlementData.totalCommission, currency)}</span>
              </div>

              <div className="flex items-center justify-between font-black text-slate-900 pt-0.5">
                <span>အမှန်ရောင်းငွေ / ကျန်ငွေ:</span>
                <span>{formatAmount(settlementType === 'downline' ? (downlineSettlementData.totalSales - downlineSettlementData.totalCommission) : (uplineSettlementData.totalForwarded - uplineSettlementData.totalCommission), currency)}</span>
              </div>

              <div className="flex items-center justify-between text-rose-700 font-bold border-b border-dashed border-slate-300 pb-2">
                <span>နုတ် - ပေါက်ကြေး:</span>
                <span>- {formatAmount(settlementType === 'downline' ? downlineSettlementData.totalPayout : uplineSettlementData.totalPayout, currency)}</span>
              </div>

              {/* Final Net Balance */}
              <div className={`p-3.5 rounded-xl border-2 flex items-center justify-between text-sm font-black ${
                (settlementType === 'downline' ? downlineSettlementData.netBalance : uplineSettlementData.netBalance) >= 0
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                  : 'bg-rose-50 border-rose-500 text-rose-900'
              }`}>
                <span>
                  {settlementType === 'downline'
                    ? ((downlineSettlementData.netBalance >= 0) ? 'နောက်ဆုံး ရရန်ငွေ:' : 'နောက်ဆုံး ပေးရန်ငွေ:')
                    : ((uplineSettlementData.netBalance >= 0) ? 'နောက်ဆုံး အထက်ဒိုင်သို့ ပေးရန်:' : 'နောက်ဆုံး အထက်ဒိုင်မှ ရရန်:')}
                </span>
                <span className="font-mono text-base font-black">
                  {formatAmount(Math.abs(settlementType === 'downline' ? downlineSettlementData.netBalance : uplineSettlementData.netBalance), currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 text-xs font-black text-slate-700 flex items-center justify-between">
              <span>ကာလအတွင်း ဝင်ငွေ/ထွက်ငွေ စာရင်းအသေးစိတ်</span>
              <span className="text-slate-500 font-mono text-[11px]">
                ({startDate} မှ {endDate} အထိ)
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                    <th className="p-2.5">ရက်စွဲ</th>
                    <th className="p-2.5">လိုင်း</th>
                    <th className="p-2.5">ပွဲစဉ် / Ref</th>
                    <th className="p-2.5 text-right">{settlementType === 'downline' ? 'ထိုးငွေ' : 'တင်ကြေး'}</th>
                    {settlementType === 'upline' && <th className="p-2.5 text-right">ကော်မရှင်</th>}
                    <th className="p-2.5 text-right">ပေါက်ငွေ</th>
                    <th className="p-2.5">အကျဉ်းချုပ်</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                  {settlementType === 'downline' ? (
                    downlineSettlementData.items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400 font-sans text-xs">
                          သတ်မှတ်ထားသော ရက်စွဲအတွင်း ဤဖောက်သည်၏ စာရင်းမရှိပါ။
                        </td>
                      </tr>
                    ) : (
                      downlineSettlementData.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 text-slate-500">{item.date}</td>
                          <td className="p-2.5 font-sans font-bold text-slate-800">{item.mode}</td>
                          <td className="p-2.5 text-teal-700 font-bold">
                            <span className="inline-flex items-center gap-1">
                              {(item.payout > 0 || (item.winningBets && item.winningBets.length > 0)) && (
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 inline shrink-0" />
                              )}
                              <span>{item.refNo}</span>
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-900">{formatAmount(item.amount)}</td>
                          <td className="p-2.5 text-right font-bold text-amber-600">{formatAmount(item.payout)}</td>
                          <td className="p-2.5 font-sans text-slate-600 truncate max-w-xs">{item.summary}</td>
                        </tr>
                      ))
                    )
                  ) : (
                    uplineSettlementData.items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400 font-sans text-xs">
                          သတ်မှတ်ထားသော ရက်စွဲအတွင်း ဤအထက်ဒိုင်၏ လွှဲစာရင်းမရှိပါ။
                        </td>
                      </tr>
                    ) : (
                      uplineSettlementData.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 text-slate-500">{item.date}</td>
                          <td className="p-2.5 font-sans font-bold text-slate-800">{item.mode}</td>
                          <td className="p-2.5 text-indigo-700 font-bold">
                            <span className="inline-flex items-center gap-1">
                              {item.payout > 0 && (
                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 inline shrink-0" />
                              )}
                              <span>{item.refNo}</span>
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-bold text-slate-900">{formatAmount(item.amount)}</td>
                          <td className="p-2.5 text-right font-bold text-sky-600">{formatAmount(item.commission)}</td>
                          <td className="p-2.5 text-right font-bold text-amber-600">{formatAmount(item.payout)}</td>
                          <td className="p-2.5 font-sans text-slate-600 truncate max-w-xs">{item.summary}</td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-4 sm:px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-bold">
            ဒိုင်စုစုပေါင်း: <span className="text-slate-800 font-mono font-black">{selectedTarget || '-'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 sm:px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel ထုတ်ရန်</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>ပရင့်ထုတ်ရန်</span>
            </button>
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 sm:px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              {copiedStatementText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedStatementText ? 'ကူးယူပြီး ✓' : 'စာသားကူးရန်'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              ပိတ်မည်
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
