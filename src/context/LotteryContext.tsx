import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  DrawRound,
  Voucher,
  ForwardSlip,
  AppSettings,
  NumberLimit,
  BlockedNumbers,
  NumberAggregate,
  RoundSummary,
  LowStockAlert,
  VoucherItem
} from '../types';
import {
  DEFAULT_SETTINGS,
  INITIAL_ROUNDS,
  INITIAL_LIMITS,
  INITIAL_BLOCKED,
  INITIAL_VOUCHERS,
  INITIAL_FORWARD_SLIPS,
  STORAGE_KEYS,
  loadStoredData,
  saveStoredData
} from '../utils/storage';
import { evaluateWinnings, exportLotteryDataToExcel, getPermutations } from '../utils/lotteryUtils';
import { calculatePayout } from '../utils/moneyUtils';
import { generateUpToDate3DRounds } from '../utils/thaiLotteryApi';
import { generateSubmissionFingerprint, isDuplicateSubmission } from '../utils/transactionUtils';

interface LotteryContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  rounds: DrawRound[];
  activeRoundId: string;
  activeRound: DrawRound | undefined;
  setActiveRoundId: (id: string) => void;
  createRound: (round: Omit<DrawRound, 'id'>) => DrawRound;
  updateRound: (roundId: string, data: Partial<DrawRound>) => void;
  deleteRound: (roundId: string) => void;
  syncLiveRounds: () => Promise<void>;

  vouchers: Voucher[];
  activeRoundVouchers: Voucher[];
  addVoucher: (voucher: Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>) => Voucher;
  updateVoucher: (id: string, data: Partial<Voucher>) => void;
  deleteVoucher: (id: string) => void;

  forwardSlips: ForwardSlip[];
  activeRoundForwardSlips: ForwardSlip[];
  addForwardSlip: (slip: Omit<ForwardSlip, 'id' | 'slipNo' | 'createdAt'>) => ForwardSlip;
  deleteForwardSlip: (id: string) => void;

  limits: NumberLimit;
  blockedNumbers: BlockedNumbers;
  setNumberLimit: (number: string, limit: number) => void;
  setBatchLimits: (numbers: string[], limit: number) => void;
  removeNumberLimit: (number: string) => void;
  toggleBlockNumber: (number: string) => void;
  setBlockNumber: (number: string, blocked: boolean) => void;
  setBatchBlocked: (numbers: string[], blocked: boolean) => void;
  isNumberBlocked: (number: string) => boolean;
  getNumberLimit: (number: string) => number;

  aggregates: { [num: string]: NumberAggregate };
  hotNumbers: NumberAggregate[];
  lowStockAlerts: LowStockAlert[];
  roundSummary: RoundSummary;

  settleWinningNumber: (winningNumber: string, multiplier?: number, toddMultiplier?: number) => void;
  clearWinningSettlement: () => void;
  exportToExcel: () => void;
  resetToSampleData: () => void;
  clearAllData: () => void;
  exportJSONBackup: () => string;
  importJSONBackup: (jsonString: string) => boolean;
}

const LotteryContext = createContext<LotteryContextType | undefined>(undefined);

export const LotteryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Core State with LocalStorage Persistence
  const [settings, setSettingsState] = useState<AppSettings>(() =>
    loadStoredData(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS)
  );

  const [rounds, setRounds] = useState<DrawRound[]>(() =>
    loadStoredData(STORAGE_KEYS.ROUNDS, INITIAL_ROUNDS)
  );

  const [activeRoundId, setActiveRoundIdState] = useState<string>(() => {
    const saved = loadStoredData<string>(STORAGE_KEYS.ACTIVE_ROUND_ID, '');
    if (saved && rounds.some(r => r.id === saved)) return saved;
    return rounds[0]?.id || 'round-default';
  });

  const [vouchers, setVouchers] = useState<Voucher[]>(() =>
    loadStoredData(STORAGE_KEYS.VOUCHERS, INITIAL_VOUCHERS)
  );

  const [forwardSlips, setForwardSlips] = useState<ForwardSlip[]>(() =>
    loadStoredData(STORAGE_KEYS.FORWARD_SLIPS, INITIAL_FORWARD_SLIPS)
  );

  const [limits, setLimits] = useState<NumberLimit>(() =>
    loadStoredData(STORAGE_KEYS.LIMITS, INITIAL_LIMITS)
  );

  const [blockedNumbers, setBlockedNumbers] = useState<BlockedNumbers>(() =>
    loadStoredData(STORAGE_KEYS.BLOCKED, INITIAL_BLOCKED)
  );

  // Sync to localStorage
  useEffect(() => {
    saveStoredData(STORAGE_KEYS.SETTINGS, settings);
  }, [settings]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.ROUNDS, rounds);
  }, [rounds]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.ACTIVE_ROUND_ID, activeRoundId);
  }, [activeRoundId]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.VOUCHERS, vouchers);
  }, [vouchers]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.FORWARD_SLIPS, forwardSlips);
  }, [forwardSlips]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.LIMITS, limits);
  }, [limits]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.BLOCKED, blockedNumbers);
  }, [blockedNumbers]);

  const activeRound = useMemo(() => {
    return rounds.find(r => r.id === activeRoundId) || rounds[0];
  }, [rounds, activeRoundId]);

  const activeRoundVouchers = useMemo(() => {
    return vouchers.filter(v => v.roundId === activeRoundId);
  }, [vouchers, activeRoundId]);

  const activeRoundForwardSlips = useMemo(() => {
    return forwardSlips.filter(f => f.roundId === activeRoundId);
  }, [forwardSlips, activeRoundId]);

  // Derived: Number Aggregates (000-999 calculations for the active round)
  const aggregates = useMemo(() => {
    const map: { [num: string]: NumberAggregate } = {};
    const multiplier = activeRound?.multiplier || settings.defaultMultiplier;

    // 1. Tally sales from vouchers
    activeRoundVouchers.forEach(v => {
      if (v.status === 'cancelled') return;
      v.items.forEach(item => {
        const num = item.number;
        if (!map[num]) {
          const numLimit = limits[num] !== undefined ? limits[num] : settings.globalStockLimit;
          const isBlocked = !!blockedNumbers[num];
          map[num] = {
            number: num,
            totalSold: 0,
            forwardedAmount: 0,
            retainedAmount: 0,
            limit: numLimit,
            isBlocked,
            betCount: 0,
            estimatedPayout: 0,
            netRisk: 0,
            riskLevel: 'safe'
          };
        }
        map[num].totalSold += item.amount;
        map[num].betCount += 1;
      });
    });

    // 2. Tally forwarded amounts
    activeRoundForwardSlips.forEach(f => {
      f.items.forEach(item => {
        const num = item.number;
        if (!map[num]) {
          const numLimit = limits[num] !== undefined ? limits[num] : settings.globalStockLimit;
          const isBlocked = !!blockedNumbers[num];
          map[num] = {
            number: num,
            totalSold: 0,
            forwardedAmount: 0,
            retainedAmount: 0,
            limit: numLimit,
            isBlocked,
            betCount: 0,
            estimatedPayout: 0,
            netRisk: 0,
            riskLevel: 'safe'
          };
        }
        map[num].forwardedAmount += item.amount;
      });
    });

    // 3. Compute retained amounts, payouts, risk levels
    const toddMult = activeRound?.toddMultiplier || settings.defaultToddMultiplier || 0;
    (Object.values(map) as NumberAggregate[]).forEach(agg => {
      agg.retainedAmount = Math.max(0, agg.totalSold - agg.forwardedAmount);
      agg.estimatedPayout = agg.retainedAmount * multiplier;

      const usageRatio = agg.limit > 0 ? (agg.retainedAmount / agg.limit) : 0;
      if (usageRatio >= 1 || agg.isBlocked) {
        agg.riskLevel = 'danger';
      } else if (usageRatio >= (settings.lowStockAlertPercentage / 100)) {
        agg.riskLevel = 'warning';
      } else {
        agg.riskLevel = 'safe';
      }
    });

    return map;
  }, [activeRoundVouchers, activeRoundForwardSlips, activeRound, limits, blockedNumbers, settings]);

  // Derived: Hot numbers (Top sold)
  const hotNumbers = useMemo(() => {
    return (Object.values(aggregates) as NumberAggregate[])
      .filter(a => a.totalSold > 0)
      .sort((a, b) => b.totalSold - a.totalSold);
  }, [aggregates]);

  // Derived: Low Stock & Limit Alerts
  const lowStockAlerts = useMemo(() => {
    const alerts: LowStockAlert[] = [];
    (Object.values(aggregates) as NumberAggregate[]).forEach(agg => {
      if (agg.isBlocked) {
        alerts.push({
          id: `alert-block-${agg.number}`,
          number: agg.number,
          soldAmount: agg.totalSold,
          limit: agg.limit,
          percentage: 100,
          timestamp: new Date().toISOString(),
          type: 'blocked'
        });
      } else if (agg.limit > 0) {
        const pct = Math.round((agg.totalSold / agg.limit) * 100);
        if (pct >= 100) {
          alerts.push({
            id: `alert-limit-${agg.number}`,
            number: agg.number,
            soldAmount: agg.totalSold,
            limit: agg.limit,
            percentage: pct,
            timestamp: new Date().toISOString(),
            type: 'limit_reached'
          });
        } else if (pct >= settings.lowStockAlertPercentage) {
          alerts.push({
            id: `alert-near-${agg.number}`,
            number: agg.number,
            soldAmount: agg.totalSold,
            limit: agg.limit,
            percentage: pct,
            timestamp: new Date().toISOString(),
            type: 'near_limit'
          });
        }
      }
    });
    return alerts.sort((a, b) => b.percentage - a.percentage);
  }, [aggregates, settings.lowStockAlertPercentage]);

  // Derived: Round Financial Summary
  const roundSummary = useMemo((): RoundSummary => {
    let totalSales = 0;
    let totalDiscount = 0;
    let netRevenue = 0;

    activeRoundVouchers.forEach(v => {
      if (v.status !== 'cancelled') {
        totalSales += v.subtotal;
        totalDiscount += v.discountAmount;
        netRevenue += v.netPayable;
      }
    });

    let totalForwarded = 0;
    let forwardedCommission = 0;
    activeRoundForwardSlips.forEach(f => {
      totalForwarded += f.totalAmount;
      forwardedCommission += f.commissionAmount;
    });

    let totalPayout = 0;
    let retainedPayout = 0;
    let totalWinnersCount = 0;

    if (activeRound?.winningNumber) {
      const winningNum = activeRound.winningNumber.padStart(3, '0');
      const straightMult = activeRound.multiplier || settings.defaultMultiplier || 0;
      const toddMult = activeRound.toddMultiplier || settings.defaultToddMultiplier || 0;

      const winEval = evaluateWinnings(
        activeRoundVouchers,
        winningNum,
        straightMult,
        toddMult
      );
      totalPayout = winEval.totalPayout;
      totalWinnersCount = winEval.winners.length;

      // Compute retained payouts after deducting forwarded bets
      const toddPerms = new Set(getPermutations(winningNum));
      let straightSold = 0;
      let toddSold = 0;
      winEval.winners.forEach(w => {
        if (w.winType === 'straight') {
          straightSold += w.betAmount;
        } else if (w.winType === 'todd') {
          toddSold += w.betAmount;
        }
      });

      let straightForwarded = 0;
      let toddForwarded = 0;
      activeRoundForwardSlips.forEach((f) => {
        f.items.forEach((it) => {
          if (it.number === winningNum) straightForwarded += it.amount;
          else if (toddPerms.has(it.number)) toddForwarded += it.amount;
        });
      });

      const retainedStraight = Math.max(0, straightSold - straightForwarded);
      const retainedTodd = Math.max(0, toddSold - toddForwarded);
      retainedPayout = (retainedStraight * straightMult) + (retainedTodd * toddMult);
    }

    const netPaid = totalForwarded - forwardedCommission;
    const netProfit = netRevenue - netPaid - retainedPayout;

    return {
      totalSales,
      totalVouchers: activeRoundVouchers.filter(v => v.status !== 'cancelled').length,
      totalDiscount,
      netRevenue,
      totalForwarded,
      forwardedCommission,
      netPaid,
      totalPayout,
      retainedPayout,
      winningNumber: activeRound?.winningNumber,
      totalWinnersCount,
      netProfit,
      isProfit: netProfit >= 0
    };
  }, [activeRoundVouchers, activeRoundForwardSlips, activeRound, settings]);

  // Actions
  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettingsState(prev => ({ ...prev, ...newSettings }));
    if (newSettings.defaultMultiplier !== undefined || newSettings.defaultToddMultiplier !== undefined) {
      setRounds(prev =>
        prev.map(r =>
          r.status === 'open'
            ? {
                ...r,
                multiplier: newSettings.defaultMultiplier !== undefined ? Number(newSettings.defaultMultiplier) : r.multiplier,
                toddMultiplier: newSettings.defaultToddMultiplier !== undefined ? Number(newSettings.defaultToddMultiplier) : r.toddMultiplier
              }
            : r
        )
      );
    }
  }, []);

  const setActiveRoundId = useCallback((id: string) => {
    setActiveRoundIdState(id);
  }, []);

  const createRound = useCallback((roundData: Omit<DrawRound, 'id'>) => {
    const newRound: DrawRound = {
      ...roundData,
      id: `round-${Date.now()}`
    };
    setRounds(prev => [newRound, ...prev]);
    setActiveRoundIdState(newRound.id);
    return newRound;
  }, []);

  const updateRound = useCallback((roundId: string, data: Partial<DrawRound>) => {
    setRounds(prev => prev.map(r => r.id === roundId ? { ...r, ...data } : r));
  }, []);

  const deleteRound = useCallback((roundId: string) => {
    setRounds(prev => {
      const filtered = prev.filter(r => r.id !== roundId);
      if (activeRoundId === roundId && filtered.length > 0) {
        setActiveRoundIdState(filtered[0].id);
      }
      return filtered;
    });
    setVouchers(prev => prev.filter(v => v.roundId !== roundId));
    setForwardSlips(prev => prev.filter(f => f.roundId !== roundId));
  }, [activeRoundId]);

  const syncLiveRounds = useCallback(async () => {
    // Manual sync preserves owner-confirmed numbers
  }, []);

  const addVoucher = useCallback((voucherData: Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>) => {
    // Duplicate Protection: Prevent same voucher submit twice within 4 seconds
    const fp = generateSubmissionFingerprint('3D_VOUCHER_SAVE', {
      roundId: voucherData.roundId,
      customerName: voucherData.customerName,
      subtotal: voucherData.subtotal,
      netPayable: voucherData.netPayable,
      items: voucherData.items
    });
    if (isDuplicateSubmission(fp, 4000)) {
      console.warn('Duplicate 3D voucher submission detected and blocked!');
      // Find and return existing duplicate if already in state
      const existing = vouchers.find(v =>
        v.roundId === voucherData.roundId &&
        v.customerName === voucherData.customerName &&
        v.netPayable === voucherData.netPayable &&
        JSON.stringify(v.items) === JSON.stringify(voucherData.items)
      );
      if (existing) return existing;
    }

    const existingSeq = vouchers.map(v => {
      const match = v.voucherNo?.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    });
    const maxSeq = existingSeq.length > 0 ? Math.max(...existingSeq) : 0;
    const nextSeq = Math.max(maxSeq + 1, vouchers.length + 1);
    const pad = String(nextSeq).padStart(4, '0');
    const newVoucher: Voucher = {
      ...voucherData,
      id: `vouch-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      voucherNo: `V-3D-${pad}`,
      createdAt: new Date().toISOString()
    };
    setVouchers(prev => [newVoucher, ...prev]);
    return newVoucher;
  }, [vouchers]);

  const updateVoucher = useCallback((id: string, data: Partial<Voucher>) => {
    setVouchers(prev => prev.map(v => v.id === id ? { ...v, ...data } : v));
  }, []);

  const deleteVoucher = useCallback((id: string) => {
    setVouchers(prev => prev.filter(v => v.id !== id));
  }, []);

  const addForwardSlip = useCallback((slipData: Omit<ForwardSlip, 'id' | 'slipNo' | 'createdAt'>) => {
    const count = forwardSlips.length + 1;
    const pad = String(count).padStart(3, '0');
    const newSlip: ForwardSlip = {
      ...slipData,
      id: `fwd-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      slipNo: `FWD-${pad}`,
      createdAt: new Date().toISOString()
    };
    setForwardSlips(prev => [newSlip, ...prev]);
    return newSlip;
  }, [forwardSlips.length]);

  const deleteForwardSlip = useCallback((id: string) => {
    setForwardSlips(prev => prev.filter(f => f.id !== id));
  }, []);

  const setNumberLimit = useCallback((number: string, limit: number) => {
    setLimits(prev => ({ ...prev, [number]: limit }));
  }, []);

  const setBatchLimits = useCallback((numbers: string[], limit: number) => {
    setLimits(prev => {
      const next = { ...prev };
      numbers.forEach(num => {
        if (num && num.length === 3) {
          next[num] = limit;
        }
      });
      return next;
    });
  }, []);

  const removeNumberLimit = useCallback((number: string) => {
    setLimits(prev => {
      const copy = { ...prev };
      delete copy[number];
      return copy;
    });
  }, []);

  const toggleBlockNumber = useCallback((number: string) => {
    setBlockedNumbers(prev => ({ ...prev, [number]: !prev[number] }));
  }, []);

  const setBlockNumber = useCallback((number: string, blocked: boolean) => {
    setBlockedNumbers(prev => ({ ...prev, [number]: blocked }));
  }, []);

  const setBatchBlocked = useCallback((numbers: string[], blocked: boolean) => {
    setBlockedNumbers(prev => {
      const next = { ...prev };
      numbers.forEach(num => {
        if (num && num.length === 3) {
          next[num] = blocked;
        }
      });
      return next;
    });
  }, []);

  const isNumberBlocked = useCallback((number: string): boolean => {
    return !!blockedNumbers[number];
  }, [blockedNumbers]);

  const getNumberLimit = useCallback((number: string): number => {
    if (limits[number] !== undefined) return limits[number];
    return settings.globalStockLimit;
  }, [limits, settings.globalStockLimit]);

  const settleWinningNumber = useCallback((winningNumber: string, multiplier?: number, toddMultiplier?: number) => {
    if (!activeRoundId) return;

    // Duplicate Protection: Avoid duplicate settlement or double confetti if already settled with same number
    const fp = generateSubmissionFingerprint('3D_SETTLE_ROUND', { activeRoundId, winningNumber, multiplier, toddMultiplier });
    if (isDuplicateSubmission(fp, 5000)) {
      console.warn('Duplicate settlement attempt blocked!');
      return;
    }

    const sMult = multiplier || activeRound?.multiplier || settings.defaultMultiplier || 0;
    const tMult = toddMultiplier || activeRound?.toddMultiplier || settings.defaultToddMultiplier || 0;
    const allPerms = new Set(getPermutations(winningNumber));

    // Update vouchers item isWon and wonAmount
    setVouchers(prev =>
      prev.map(v => {
        if (v.roundId === activeRoundId) {
          let voucherWon = false;
          const wonGroupIdsInVoucher = new Set<string>();

          // Pass 1: exact straight bets
          const straightChecked = v.items.map(item => {
            const isRumble = item.betType === 'rumble';
            if (item.number === winningNumber && !isRumble) {
              const winPayout = calculatePayout(item.amount, sMult);
              voucherWon = true;
              return { ...item, isWon: true, wonAmount: winPayout };
            }
            return item;
          });

          // Pass 2: rumble bets (only 1 win per group)
          const updatedItems = straightChecked.map(item => {
            const isRumble = item.betType === 'rumble';
            if (item.number === winningNumber && !isRumble) {
              return item;
            }

            if (isRumble && tMult > 0) {
              if (item.groupId) {
                if (wonGroupIdsInVoucher.has(item.groupId)) {
                  return { ...item, isWon: false, wonAmount: 0 };
                }

                const hasExactMatchInGroup = v.items.some(
                  i => i.groupId === item.groupId && i.number === winningNumber
                );

                const isWinningItem = hasExactMatchInGroup
                  ? item.number === winningNumber
                  : (item.permutations ? item.permutations.includes(winningNumber) : allPerms.has(item.number));

                if (isWinningItem) {
                  wonGroupIdsInVoucher.add(item.groupId);
                  const winPayout = calculatePayout(item.amount, tMult);
                  voucherWon = true;
                  return { ...item, isWon: true, wonAmount: winPayout };
                }
              } else {
                if (allPerms.has(item.number)) {
                  const winPayout = calculatePayout(item.amount, tMult);
                  voucherWon = true;
                  return { ...item, isWon: true, wonAmount: winPayout };
                }
              }
            }

            return { ...item, isWon: false, wonAmount: 0 };
          });

          return {
            ...v,
            status: voucherWon ? ('settled' as const) : v.status,
            items: updatedItems
          };
        }
        return v;
      })
    );

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // ignore
    }

    setRounds(prev => prev.map(r => {
      if (r.id === activeRoundId) {
        return {
          ...r,
          winningNumber,
          multiplier: sMult,
          toddMultiplier: tMult,
          status: 'settled',
          settledAt: new Date().toISOString()
        };
      }
      return r;
    }));
  }, [activeRoundId, activeRound, settings]);

  const clearWinningSettlement = useCallback(() => {
    if (!activeRoundId) return;

    setVouchers(prev =>
      prev.map(v => {
        if (v.roundId === activeRoundId) {
          return {
            ...v,
            status: 'active',
            items: v.items.map(i => ({ ...i, isWon: false, wonAmount: 0 }))
          };
        }
        return v;
      })
    );

    setRounds(prev => prev.map(r => {
      if (r.id === activeRoundId) {
        return {
          ...r,
          winningNumber: undefined,
          status: 'open',
          settledAt: undefined
        };
      }
      return r;
    }));
  }, [activeRoundId]);

  const exportToExcel = useCallback(() => {
    if (!activeRound) return;
    const aggMap: { [num: string]: { totalSold: number; forwarded: number; retained: number } } = {};
    (Object.values(aggregates) as NumberAggregate[]).forEach(a => {
      aggMap[a.number] = {
        totalSold: a.totalSold,
        forwarded: a.forwardedAmount,
        retained: a.retainedAmount
      };
    });

    exportLotteryDataToExcel(
      activeRound,
      activeRoundVouchers,
      activeRoundForwardSlips,
      aggMap,
      activeRound.winningNumber,
      activeRound.multiplier || settings.defaultMultiplier
    );
  }, [activeRound, activeRoundVouchers, activeRoundForwardSlips, aggregates, settings.defaultMultiplier]);

  const resetToSampleData = useCallback(() => {
    setSettingsState(DEFAULT_SETTINGS);
    setRounds(INITIAL_ROUNDS);
    setActiveRoundIdState(INITIAL_ROUNDS[0].id);
    setVouchers(INITIAL_VOUCHERS);
    setForwardSlips(INITIAL_FORWARD_SLIPS);
    setLimits(INITIAL_LIMITS);
    setBlockedNumbers(INITIAL_BLOCKED);
  }, []);

  const clearAllData = useCallback(() => {
    const emptyRound: DrawRound = {
      id: `round-${Date.now()}`,
      name: 'အသစ်စတင်သည့်ပွဲစဉ်',
      drawDate: new Date().toISOString().slice(0, 10),
      closingTime: '15:00',
      status: 'open',
      multiplier: 600,
      toddMultiplier: 100,
      commissionRate: 10
    };
    setRounds([emptyRound]);
    setActiveRoundIdState(emptyRound.id);
    setVouchers([]);
    setForwardSlips([]);
    setLimits({});
    setBlockedNumbers({});
  }, []);

  const exportJSONBackup = useCallback((): string => {
    const payload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings,
      rounds,
      activeRoundId,
      vouchers,
      forwardSlips,
      limits,
      blockedNumbers
    };
    return JSON.stringify(payload, null, 2);
  }, [settings, rounds, activeRoundId, vouchers, forwardSlips, limits, blockedNumbers]);

  const importJSONBackup = useCallback((jsonString: string): boolean => {
    try {
      const data = JSON.parse(jsonString);
      if (data.settings) setSettingsState(data.settings);
      if (Array.isArray(data.rounds)) setRounds(data.rounds);
      if (data.activeRoundId) setActiveRoundIdState(data.activeRoundId);
      if (Array.isArray(data.vouchers)) setVouchers(data.vouchers);
      if (Array.isArray(data.forwardSlips)) setForwardSlips(data.forwardSlips);
      if (data.limits) setLimits(data.limits);
      if (data.blockedNumbers) setBlockedNumbers(data.blockedNumbers);
      return true;
    } catch (e) {
      console.error('Failed to import backup:', e);
      return false;
    }
  }, []);

  return (
    <LotteryContext.Provider
      value={{
        settings,
        updateSettings,
        rounds,
        activeRoundId,
        activeRound,
        setActiveRoundId,
        createRound,
        updateRound,
        deleteRound,
        syncLiveRounds,
        vouchers,
        activeRoundVouchers,
        addVoucher,
        updateVoucher,
        deleteVoucher,
        forwardSlips,
        activeRoundForwardSlips,
        addForwardSlip,
        deleteForwardSlip,
        limits,
        blockedNumbers,
        setNumberLimit,
        setBatchLimits,
        removeNumberLimit,
        toggleBlockNumber,
        setBlockNumber,
        setBatchBlocked,
        isNumberBlocked,
        getNumberLimit,
        aggregates,
        hotNumbers,
        lowStockAlerts,
        roundSummary,
        settleWinningNumber,
        clearWinningSettlement,
        exportToExcel,
        resetToSampleData,
        clearAllData,
        exportJSONBackup,
        importJSONBackup
      }}
    >
      {children}
    </LotteryContext.Provider>
  );
};

export const useLottery = () => {
  const context = useContext(LotteryContext);
  if (!context) {
    throw new Error('useLottery must be used within a LotteryProvider');
  }
  return context;
};
