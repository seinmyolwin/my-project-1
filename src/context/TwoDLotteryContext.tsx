import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  TwoDDrawRound,
  TwoDVoucher,
  TwoDVoucherItem,
  TwoDForwardSlip,
  TwoDAppSettings,
  NumberLimit,
  BlockedNumbers,
  TwoDNumberAggregate,
  TwoDRoundSummary,
  LowStockAlert
} from '../types';
import {
  DEFAULT_2D_SETTINGS,
  INITIAL_2D_ROUNDS,
  INITIAL_2D_LIMITS,
  INITIAL_2D_BLOCKED,
  INITIAL_2D_VOUCHERS,
  INITIAL_2D_FORWARD_SLIPS,
  STORAGE_KEYS,
  loadStoredData,
  saveStoredData
} from '../utils/storage';
import { evaluateTwoDWinnings, exportTwoDLotteryToExcel, is2DRoundClosed } from '../utils/twoDLotteryUtils';
import { generateUpToDate2DRounds } from '../utils/thaiLotteryApi';
import { generateSubmissionFingerprint, isDuplicateSubmission } from '../utils/transactionUtils';
import { getLocalDateString, safeRound } from '../utils/moneyUtils';

interface TwoDLotteryContextType {
  settings: TwoDAppSettings;
  updateSettings: (newSettings: Partial<TwoDAppSettings>) => void;
  rounds: TwoDDrawRound[];
  activeRoundId: string;
  activeRound: TwoDDrawRound | undefined;
  setActiveRoundId: (id: string) => void;
  createRound: (round: Omit<TwoDDrawRound, 'id'>) => TwoDDrawRound;
  updateRound: (roundId: string, data: Partial<TwoDDrawRound>) => void;
  deleteRound: (roundId: string) => void;
  syncLiveRounds: () => Promise<void>;

  vouchers: TwoDVoucher[];
  activeRoundVouchers: TwoDVoucher[];
  addVoucher: (voucher: Omit<TwoDVoucher, 'id' | 'voucherNo' | 'createdAt'>) => TwoDVoucher;
  createVoucher: (
    items: TwoDVoucherItem[],
    customerName?: string,
    customerPhone?: string,
    discountPercent?: number,
    notes?: string
  ) => TwoDVoucher;
  updateVoucher: (id: string, data: Partial<TwoDVoucher>) => void;
  deleteVoucher: (id: string) => void;

  forwardSlips: TwoDForwardSlip[];
  activeRoundForwardSlips: TwoDForwardSlip[];
  addForwardSlip: (slip: Omit<TwoDForwardSlip, 'id' | 'slipNo' | 'createdAt'>) => TwoDForwardSlip;
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

  aggregates: { [num: string]: TwoDNumberAggregate };
  hotNumbers: TwoDNumberAggregate[];
  lowStockAlerts: LowStockAlert[];
  roundSummary: TwoDRoundSummary;

  settleWinningNumber: (winningNumber: string, multiplier?: number) => void;
  clearWinningSettlement: () => void;
  exportToExcel: (overrideRound?: TwoDDrawRound | any, overrideVouchers?: TwoDVoucher[], overrideSummary?: TwoDRoundSummary) => void;
  resetToSampleData: () => void;
  clearAllData: () => void;
  exportJSONBackup: () => string;
  importJSONBackup: (jsonString: string) => boolean;
}

const TwoDLotteryContext = createContext<TwoDLotteryContextType | undefined>(undefined);

export const TwoDLotteryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Core State with LocalStorage Persistence (Strictly 2D Keys)
  const [settings, setSettingsState] = useState<TwoDAppSettings>(() => {
    const loaded = loadStoredData(STORAGE_KEYS.SETTINGS_2D, DEFAULT_2D_SETTINGS);
    let mult = loaded.defaultMultiplier;
    // Auto-correct if mistakenly saved as 8000 or >= 500
    if (mult === 8000 || (mult >= 500 && mult <= 10000)) {
      mult = Math.round(mult / 100);
    } else if (!mult || mult <= 0) {
      mult = 80;
    }
    return {
      ...loaded,
      defaultMultiplier: mult
    };
  });

  const [deletedRoundIds, setDeletedRoundIds] = useState<string[]>(() => {
    return loadStoredData<string[]>('2d_ledger_deleted_rounds_v1', []);
  });

  const [rounds, setRounds] = useState<TwoDDrawRound[]>(() => {
    const stored = loadStoredData<TwoDDrawRound[]>(STORAGE_KEYS.ROUNDS_2D, []);
    const upToDate = generateUpToDate2DRounds(settings.defaultMultiplier, settings.defaultCommissionRate);
    const deleted = loadStoredData<string[]>('2d_ledger_deleted_rounds_v1', []);
    const deletedSet = new Set(deleted);
    const todayStr = getLocalDateString();

    const storedMap = new Map<string, TwoDDrawRound>();
    stored.forEach(r => {
      if (!deletedSet.has(r.id)) {
        let mult = r.multiplier;
        if (mult === 8000 || (mult >= 500 && mult <= 10000)) {
          mult = Math.round(mult / 100);
        } else if (!mult || mult <= 0) {
          mult = settings.defaultMultiplier || 80;
        }
        storedMap.set(r.id, { ...r, multiplier: mult });
      }
    });

    upToDate.forEach(r => {
      if (!storedMap.has(r.id) && !deletedSet.has(r.id)) {
        storedMap.set(r.id, r);
      }
    });

    return Array.from(storedMap.values());
  });

  // Keep today's rounds available without force-closing past open rounds
  useEffect(() => {
    let lastDateStr = getLocalDateString();

    const checkAndSyncRounds = () => {
      const todayStr = getLocalDateString();
      setRounds(prev => {
        const upToDate = generateUpToDate2DRounds(settings.defaultMultiplier, settings.defaultCommissionRate);
        const map = new Map<string, TwoDDrawRound>();
        let changed = false;

        const deleted = loadStoredData<string[]>('2d_ledger_deleted_rounds_v1', []);
        const deletedSet = new Set(deleted);

        prev.forEach(r => {
          if (!deletedSet.has(r.id)) {
            if (r.drawDate < todayStr && r.status === 'open' && r.drawDate >= '2026-10-05') {
              map.set(r.id, { ...r, status: 'closed' });
              changed = true;
            } else {
              map.set(r.id, r);
            }
          } else {
            changed = true;
          }
        });

        upToDate.forEach(r => {
          if (!map.has(r.id) && !deletedSet.has(r.id)) {
            if (r.drawDate < todayStr && r.status === 'open' && r.drawDate >= '2026-10-05') {
              map.set(r.id, { ...r, status: 'closed' });
            } else {
              map.set(r.id, r);
            }
            changed = true;
          }
        });

        return changed ? Array.from(map.values()) : prev;
      });
      lastDateStr = todayStr;
    };

    // Run on mount
    checkAndSyncRounds();

    // Run every minute (60,000 ms)
    const intervalId = setInterval(() => {
      const currentToday = getLocalDateString();
      if (currentToday !== lastDateStr) {
        checkAndSyncRounds();
      }
    }, 60000);

    // Run on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentToday = getLocalDateString();
        if (currentToday !== lastDateStr) {
          checkAndSyncRounds();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [settings.defaultMultiplier, settings.defaultCommissionRate]);

  const [activeRoundId, setActiveRoundIdState] = useState<string>(() => {
    const saved = loadStoredData<string>(STORAGE_KEYS.ACTIVE_ROUND_ID_2D, '');
    const todayStr = getLocalDateString();

    // Priority: ယနေ့ရက်ရဲ့ open round ကိုသာ ဦးစားပေးပါ
    const todayOpen = rounds.find(
      (r) => r.drawDate === todayStr && r.status === 'open'
    );
    if (todayOpen) return todayOpen.id;

    // If saved is today's round, keep it
    if (saved) {
      const savedRound = rounds.find((r) => r.id === saved);
      if (savedRound && savedRound.drawDate === todayStr) {
        return saved;
      }
    }

    // Today's round even if closed
    const todayAny = rounds.find((r) => r.drawDate === todayStr);
    if (todayAny) return todayAny.id;

    // Any open round
    const anyOpen = rounds.find((r) => r.status === 'open');
    if (anyOpen) return anyOpen.id;

    return rounds[0]?.id || 'round-2d-default';
  });

  const [vouchers, setVouchers] = useState<TwoDVoucher[]>(() => {
    const loaded = loadStoredData(STORAGE_KEYS.VOUCHERS_2D, INITIAL_2D_VOUCHERS);
    // Sanitize any vouchers that were previously calculated with 8000x multiplier
    return loaded.map(v => ({
      ...v,
      items: v.items.map(item => {
        if (item.isWon && item.wonAmount && item.amount > 0 && item.wonAmount >= item.amount * 500) {
          return {
            ...item,
            wonAmount: Math.round(item.wonAmount / 100)
          };
        }
        return item;
      })
    }));
  });

  const [forwardSlips, setForwardSlips] = useState<TwoDForwardSlip[]>(() =>
    loadStoredData(STORAGE_KEYS.FORWARD_SLIPS_2D, INITIAL_2D_FORWARD_SLIPS)
  );

  const [limits, setLimits] = useState<NumberLimit>(() =>
    loadStoredData(STORAGE_KEYS.LIMITS_2D, INITIAL_2D_LIMITS)
  );

  const [blockedNumbers, setBlockedNumbers] = useState<BlockedNumbers>(() =>
    loadStoredData(STORAGE_KEYS.BLOCKED_2D, INITIAL_2D_BLOCKED)
  );

  // Sync to localStorage
  useEffect(() => {
    saveStoredData(STORAGE_KEYS.SETTINGS_2D, settings);
  }, [settings]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.ROUNDS_2D, rounds);
  }, [rounds]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.ACTIVE_ROUND_ID_2D, activeRoundId);
  }, [activeRoundId]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.VOUCHERS_2D, vouchers);
  }, [vouchers]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.FORWARD_SLIPS_2D, forwardSlips);
  }, [forwardSlips]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.LIMITS_2D, limits);
  }, [limits]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.BLOCKED_2D, blockedNumbers);
  }, [blockedNumbers]);

  const visibleRounds = useMemo(() => {
    return rounds.filter(r => r.drawDate >= '2026-10-05');
  }, [rounds]);

  const activeRound = useMemo(() => {
    return visibleRounds.find(r => r.id === activeRoundId) || visibleRounds[0];
  }, [visibleRounds, activeRoundId]);

  const activeRoundVouchers = useMemo(() => {
    return vouchers.filter(v => v.roundId === activeRoundId && v.status !== 'cancelled');
  }, [vouchers, activeRoundId]);

  const activeRoundForwardSlips = useMemo(() => {
    return forwardSlips.filter(f => f.roundId === activeRoundId);
  }, [forwardSlips, activeRoundId]);

  const updateSettings = useCallback((newSettings: Partial<TwoDAppSettings>) => {
    setSettingsState(prev => ({ ...prev, ...newSettings }));
  }, []);

  const setActiveRoundId = useCallback((id: string) => {
    setActiveRoundIdState(id);
  }, []);

  const createRound = useCallback((roundData: Omit<TwoDDrawRound, 'id'>) => {
    const newRound: TwoDDrawRound = {
      ...roundData,
      multiplier: roundData.multiplier ?? settings.defaultMultiplier,
      commissionRate: roundData.commissionRate ?? settings.defaultCommissionRate,
      id: `round-2d-${Date.now()}`
    };
    setRounds(prev => [newRound, ...prev]);
    setActiveRoundIdState(newRound.id);
    return newRound;
  }, [settings.defaultMultiplier, settings.defaultCommissionRate]);

  const updateRound = useCallback((roundId: string, data: Partial<TwoDDrawRound>) => {
    setRounds(prev =>
      prev.map(r => (r.id === roundId ? { ...r, ...data } : r))
    );
  }, []);

  const deleteRound = useCallback((roundId: string) => {
    setRounds(prev => prev.filter(r => r.id !== roundId));
    setDeletedRoundIds(prev => {
      const next = [...prev.filter(id => id !== roundId), roundId];
      saveStoredData('2d_ledger_deleted_rounds_v1', next);
      return next;
    });

    if (activeRoundId === roundId) {
      const remaining = visibleRounds.filter(r => r.id !== roundId);
      if (remaining.length > 0) {
        setActiveRoundIdState(remaining[0].id);
      }
    }

    setVouchers(prev => prev.filter(v => v.roundId !== roundId));
    setForwardSlips(prev => prev.filter(f => f.roundId !== roundId));
  }, [activeRoundId, visibleRounds]);

  const syncLiveRounds = useCallback(async () => {
    // 2D rounds and winning numbers are managed manually by the operator
  }, []);

  const addVoucher = useCallback((voucherData: Omit<TwoDVoucher, 'id' | 'voucherNo' | 'createdAt'>) => {
    // 1. Check active round status
    const targetRound = rounds.find(r => r.id === voucherData.roundId);
    if (!targetRound || targetRound.status !== 'open' || is2DRoundClosed(targetRound)) {
      throw new Error('ထီပွဲစဉ် ပိတ်သွားပြီဖြစ်သဖြင့် စာရင်း ထည့်သွင်း၍ မရတော့ပါ');
    }

    // 2. Check settings multiplier & commission
    if (!targetRound.multiplier || targetRound.multiplier <= 0 || targetRound.commissionRate === undefined) {
      throw new Error('ပေါက်ကြေး သို့မဟုတ် ကော်မရှင် သတ်မှတ်ထားခြင်း မရှိသေးပါ (Settings တွင် ပြင်ဆင်ပါ)');
    }

    // Duplicate Protection: Prevent same voucher submit twice within 4 seconds
    const fp = generateSubmissionFingerprint('2D_VOUCHER_SAVE', {
      roundId: voucherData.roundId,
      customerName: voucherData.customerName,
      subtotal: voucherData.subtotal,
      netPayable: voucherData.netPayable,
      items: voucherData.items
    });
    if (isDuplicateSubmission(fp, 4000)) {
      console.warn('Duplicate 2D voucher submission detected and blocked!');
      const existing = vouchers.find(v =>
        v.roundId === voucherData.roundId &&
        v.customerName === voucherData.customerName &&
        v.netPayable === voucherData.netPayable &&
        JSON.stringify(v.items) === JSON.stringify(voucherData.items)
      );
      if (existing) {
        return { ...existing, isDuplicate: true } as any;
      }
    }

    const existingSeq = vouchers.map(v => {
      const match = v.voucherNo?.match(/\d+$/);
      return match ? parseInt(match[0], 10) : 0;
    });
    const maxSeq = existingSeq.length > 0 ? Math.max(...existingSeq) : 0;
    const nextSeq = Math.max(maxSeq + 1, vouchers.length + 1);
    const pad = String(nextSeq).padStart(4, '0');
    const newVoucher: TwoDVoucher = {
      ...voucherData,
      id: `vouch-2d-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      voucherNo: `V-2D-${pad}`,
      createdAt: new Date().toISOString()
    };
    setVouchers(prev => [newVoucher, ...prev]);
    return newVoucher;
  }, [vouchers, rounds]);

  const createVoucher = useCallback((
    items: TwoDVoucherItem[],
    customerName?: string,
    customerPhone?: string,
    discountPercent: number = 0,
    notes?: string
  ): TwoDVoucher => {
    if (!activeRound || activeRound.status !== 'open' || is2DRoundClosed(activeRound)) {
      throw new Error('ထီပွဲစဉ် ပိတ်သွားပြီဖြစ်သဖြင့် စာရင်း ထည့်သွင်း၍ မရတော့ပါ');
    }
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const discountAmount = safeRound((subtotal * discountPercent) / 100);
    const netPayable = safeRound(subtotal - discountAmount);
    return addVoucher({
      roundId: activeRound.id,
      customerName: customerName || (settings.language === 'my' ? 'အထွေထွေ' : 'Walk-in'),
      customerPhone,
      items,
      subtotal,
      discountPercent,
      discountAmount,
      netPayable,
      notes,
      isPaid: true,
      status: 'active'
    });
  }, [activeRound, addVoucher, settings.language]);

  const updateVoucher = useCallback((id: string, data: Partial<TwoDVoucher>) => {
    setVouchers(prev =>
      prev.map(v => (v.id === id ? { ...v, ...data } : v))
    );
  }, []);

  const deleteVoucher = useCallback((id: string) => {
    setVouchers(prev => prev.filter(v => v.id !== id));
  }, []);

  const addForwardSlip = useCallback((slipData: Omit<TwoDForwardSlip, 'id' | 'slipNo' | 'createdAt'>): TwoDForwardSlip => {
    const todayStr = getLocalDateString().replace(/-/g, '').slice(2);
    const commRate = slipData.commissionRate ?? settings.defaultCommissionRate;
    const commAmt = safeRound((slipData.totalAmount * commRate) / 100);
    const netPaid = safeRound(slipData.totalAmount - commAmt);

    const todayCount = forwardSlips.filter(f => (f.createdAt || '').slice(0, 10) === getLocalDateString()).length + 1;
    const seqPad = String(todayCount).padStart(3, '0');
    const newSlip: TwoDForwardSlip = {
      ...slipData,
      commissionRate: commRate,
      commissionAmount: commAmt,
      netPaid,
      id: `fwd-2d-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      slipNo: `FWD2D-${todayStr}-${seqPad}`,
      createdAt: new Date().toISOString()
    };
    setForwardSlips(prev => [newSlip, ...prev]);
    return newSlip;
  }, [forwardSlips, settings.defaultCommissionRate]);

  const deleteForwardSlip = useCallback((id: string) => {
    setForwardSlips(prev => prev.filter(f => f.id !== id));
  }, []);

  // Limit & Block methods
  const setNumberLimit = useCallback((num: string, limit: number) => {
    const formatted = num.padStart(2, '0');
    setLimits(prev => ({ ...prev, [formatted]: limit }));
  }, []);

  const setBatchLimits = useCallback((numbers: string[], limit: number) => {
    setLimits(prev => {
      const next = { ...prev };
      numbers.forEach(num => {
        next[num.padStart(2, '0')] = limit;
      });
      return next;
    });
  }, []);

  const removeNumberLimit = useCallback((num: string) => {
    const formatted = num.padStart(2, '0');
    setLimits(prev => {
      const next = { ...prev };
      delete next[formatted];
      return next;
    });
  }, []);

  const toggleBlockNumber = useCallback((num: string) => {
    const formatted = num.padStart(2, '0');
    setBlockedNumbers(prev => ({
      ...prev,
      [formatted]: !prev[formatted]
    }));
  }, []);

  const setBlockNumber = useCallback((num: string, blocked: boolean) => {
    const formatted = num.padStart(2, '0');
    setBlockedNumbers(prev => ({
      ...prev,
      [formatted]: blocked
    }));
  }, []);

  const setBatchBlocked = useCallback((numbers: string[], blocked: boolean) => {
    setBlockedNumbers(prev => {
      const next = { ...prev };
      numbers.forEach(num => {
        next[num.padStart(2, '0')] = blocked;
      });
      return next;
    });
  }, []);

  const isNumberBlocked = useCallback((num: string) => {
    const formatted = num.padStart(2, '0');
    if (blockedNumbers[formatted]) return true;
    if (limits[formatted] === 0) return true;
    if (limits[formatted] === undefined && settings.globalStockLimit === 0) return true;
    return false;
  }, [blockedNumbers, limits, settings.globalStockLimit]);

  const getNumberLimit = useCallback((num: string) => {
    const formatted = num.padStart(2, '0');
    return limits[formatted] ?? settings.globalStockLimit;
  }, [limits, settings.globalStockLimit]);

  // 2D Aggregates calculation (00 - 99: exactly 100 combinations)
  const aggregates = useMemo(() => {
    let mult = activeRound?.multiplier || settings.defaultMultiplier || 80;
    if (mult >= 500 && mult <= 10000) mult = Math.round(mult / 100);
    const agg: { [num: string]: TwoDNumberAggregate } = {};

    // Initialize all 100 numbers (00 to 99)
    for (let i = 0; i <= 99; i++) {
      const numStr = i.toString().padStart(2, '0');
      const lmt = limits[numStr] ?? settings.globalStockLimit;
      const isBlk = !!blockedNumbers[numStr] || lmt === 0;

      agg[numStr] = {
        number: numStr,
        totalSold: 0,
        forwardedAmount: 0,
        retainedAmount: 0,
        limit: lmt,
        isBlocked: isBlk,
        betCount: 0,
        estimatedPayout: 0,
        netRisk: 0,
        riskLevel: 'safe'
      };
    }

    // Accumulate customer sales
    activeRoundVouchers.forEach(v => {
      v.items.forEach(item => {
        const n = item.number.padStart(2, '0');
        if (agg[n]) {
          agg[n].totalSold += item.amount;
          agg[n].betCount += 1;
        }
      });
    });

    // Accumulate forwarded amounts to dealer
    activeRoundForwardSlips.forEach(f => {
      f.items.forEach(item => {
        const n = item.number.padStart(2, '0');
        if (agg[n]) {
          agg[n].forwardedAmount += item.amount;
        }
      });
    });

    // Calculate retained, payouts, and risk levels
    Object.keys(agg).forEach(k => {
      const item = agg[k];
      item.retainedAmount = safeRound(item.totalSold - item.forwardedAmount);
      item.estimatedPayout = mult > 0 ? safeRound(item.retainedAmount * mult) : 0;

      const usageRatio = item.limit > 0 ? item.totalSold / item.limit : 0;
      if (item.isBlocked || usageRatio >= 1.0) {
        item.riskLevel = 'danger';
      } else if (usageRatio >= (settings.lowStockAlertPercentage / 100)) {
        item.riskLevel = 'warning';
      } else {
        item.riskLevel = 'safe';
      }
    });

    return agg;
  }, [
    activeRound,
    settings.defaultMultiplier,
    settings.globalStockLimit,
    settings.lowStockAlertPercentage,
    limits,
    blockedNumbers,
    activeRoundVouchers,
    activeRoundForwardSlips
  ]);

  // Hot numbers (sorted by totalSold descending)
  const hotNumbers = useMemo(() => {
    return (Object.values(aggregates) as TwoDNumberAggregate[])
      .filter(a => a.totalSold > 0)
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 20);
  }, [aggregates]);

  // Low stock / high risk alerts
  const lowStockAlerts = useMemo(() => {
    const alerts: LowStockAlert[] = [];
    const thresholdPct = settings.lowStockAlertPercentage;
    if (!thresholdPct || thresholdPct <= 0) return alerts;

    (Object.values(aggregates) as TwoDNumberAggregate[]).forEach(agg => {
      if (agg.limit <= 0) return;
      const pct = Math.round((agg.totalSold / agg.limit) * 100);

      if (agg.isBlocked) {
        alerts.push({
          id: `alert-2d-${agg.number}-blk`,
          number: agg.number,
          soldAmount: agg.totalSold,
          limit: agg.limit,
          percentage: pct,
          timestamp: new Date().toISOString(),
          type: 'blocked'
        });
      } else if (pct >= 100) {
        alerts.push({
          id: `alert-2d-${agg.number}-full`,
          number: agg.number,
          soldAmount: agg.totalSold,
          limit: agg.limit,
          percentage: pct,
          timestamp: new Date().toISOString(),
          type: 'limit_reached'
        });
      } else if (pct >= thresholdPct) {
        alerts.push({
          id: `alert-2d-${agg.number}-near`,
          number: agg.number,
          soldAmount: agg.totalSold,
          limit: agg.limit,
          percentage: pct,
          timestamp: new Date().toISOString(),
          type: 'near_limit'
        });
      }
    });

    return alerts.sort((a, b) => b.percentage - a.percentage);
  }, [aggregates, settings.lowStockAlertPercentage]);

  // Round summary
  const roundSummary = useMemo<TwoDRoundSummary>(() => {
    let totalSales = 0;
    let totalDiscount = 0;
    let netRevenue = 0;

    activeRoundVouchers.forEach(v => {
      totalSales += v.subtotal;
      totalDiscount += v.discountAmount;
      netRevenue += v.netPayable;
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
      let mult = activeRound.multiplier || settings.defaultMultiplier || 80;
      if (mult >= 500 && mult <= 10000) mult = Math.round(mult / 100);
      const formattedNum = activeRound.winningNumber.padStart(2, '0');
      const evalResult = evaluateTwoDWinnings(activeRoundVouchers, formattedNum, mult);
      totalWinnersCount = evalResult.totalWinnersCount;
      totalPayout = evalResult.totalPayout;

      // ဒိုင်လွှဲ စနစ်: ဒိုင်ကြီးက ဒိုင်လွှဲထားသော ဂဏန်းရဲ့ ပေါက်ငွေ ဆုံးရှုံးမှုကို ယူသည်။
      // ဒိုင်ကိုယ်တိုင် ထိန်းထားသော ဂဏန်းပေါ် ပေါက်ငွေသာ ပေးရသည်။
      const winningAgg = aggregates[formattedNum];
      const retainedAmount = winningAgg ? Math.max(0, winningAgg.retainedAmount) : 0;
      retainedPayout = mult > 0 ? retainedAmount * mult : 0;
    }

    const netPaid = safeRound(totalForwarded - forwardedCommission);
    const netProfit = safeRound(netRevenue - netPaid - retainedPayout);

    return {
      totalSales,
      totalVouchers: activeRoundVouchers.length,
      totalDiscount,
      netRevenue,
      totalForwarded,
      forwardedCommission,
      totalPayout,
      retainedPayout,
      winningNumber: activeRound?.winningNumber,
      totalWinnersCount,
      netProfit,
      isProfit: netProfit >= 0
    };
  }, [activeRound, activeRoundVouchers, activeRoundForwardSlips, settings.defaultMultiplier, aggregates]);

  // Settle winning number
  const settleWinningNumber = useCallback((winningNum: string, multiplier?: number) => {
    if (!activeRound) return;

    // Duplicate Protection: Prevent duplicate settlement calls
    const fp = generateSubmissionFingerprint('2D_SETTLE_ROUND', { activeRoundId: activeRound.id, winningNum, multiplier });
    if (isDuplicateSubmission(fp, 5000)) {
      console.warn('Duplicate 2D settlement attempt blocked!');
      return;
    }

    let mult = multiplier || activeRound.multiplier || settings.defaultMultiplier || 80;
    if (mult >= 500 && mult <= 10000) {
      mult = Math.round(mult / 100);
    }
    if (mult <= 0) {
      alert(settings.language === 'my' ? 'Settings တွင် ပေါက်ကြေးအဆ (Multiplier) ဦးစွာ သတ်မှတ်ပါ' : 'Please configure multiplier in settings');
      return;
    }
    const formattedNum = winningNum.padStart(2, '0');

    const evalResult = evaluateTwoDWinnings(activeRoundVouchers, formattedNum, mult);

    // Update vouchers
    setVouchers(prev =>
      prev.map(v => {
        const found = evalResult.settledVouchers.find(sv => sv.id === v.id);
        return found || v;
      })
    );

    // Update round status
    setRounds(prev =>
      prev.map(r =>
        r.id === activeRound.id
          ? {
              ...r,
              status: 'settled',
              winningNumber: formattedNum,
              multiplier: mult,
              settledAt: new Date().toISOString()
            }
          : r
      )
    );

    if (evalResult.totalWinnersCount > 0) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (e) {
        // Safe fail
      }
    }
  }, [activeRound, activeRoundVouchers, settings.defaultMultiplier, settings.language]);

  const clearWinningSettlement = useCallback(() => {
    if (!activeRound) return;

    setVouchers(prev =>
      prev.map(v => {
        if (v.roundId === activeRound.id) {
          const newStatus = v.status === 'cancelled' ? 'cancelled' : 'active';
          return {
            ...v,
            status: newStatus,
            items: v.items.map(i => ({ ...i, isWon: false, wonAmount: 0 }))
          };
        }
        return v;
      })
    );

    setRounds(prev =>
      prev.map(r =>
        r.id === activeRound.id
          ? {
              ...r,
              status: 'open',
              winningNumber: undefined,
              settledAt: undefined
            }
          : r
      )
    );
  }, [activeRound]);

  const exportToExcel = useCallback((overrideRound?: TwoDDrawRound | any, overrideVouchers?: TwoDVoucher[], overrideSummary?: TwoDRoundSummary) => {
    const validRound = (overrideRound && typeof overrideRound === 'object' && 'id' in overrideRound && 'drawDate' in overrideRound) ? (overrideRound as TwoDDrawRound) : undefined;
    const targetRound = validRound || activeRound;
    if (!targetRound) return;
    const targetVouchers = validRound ? (overrideVouchers || activeRoundVouchers) : activeRoundVouchers;
    const targetSummary = validRound ? (overrideSummary || roundSummary) : roundSummary;
    exportTwoDLotteryToExcel(
      targetRound,
      aggregates,
      targetVouchers,
      activeRoundForwardSlips,
      targetSummary,
      settings.shopName
    );
  }, [activeRound, aggregates, activeRoundVouchers, activeRoundForwardSlips, roundSummary, settings.shopName]);

  const resetToSampleData = useCallback(() => {
    setSettingsState(DEFAULT_2D_SETTINGS);
    const freshRounds = generateUpToDate2DRounds(DEFAULT_2D_SETTINGS.defaultMultiplier, DEFAULT_2D_SETTINGS.defaultCommissionRate);
    setRounds(freshRounds);
    if (freshRounds.length > 0) setActiveRoundIdState(freshRounds[0].id);
    setVouchers(INITIAL_2D_VOUCHERS);
    setForwardSlips(INITIAL_2D_FORWARD_SLIPS);
    setLimits(INITIAL_2D_LIMITS);
    setBlockedNumbers(INITIAL_2D_BLOCKED);
  }, []);

  const clearAllData = useCallback(() => {
    setVouchers([]);
    setForwardSlips([]);
    setLimits({});
    setBlockedNumbers({});
  }, []);

  // Dedicated 2D JSON Backup Export
  const exportJSONBackup = useCallback(() => {
    const backupObj = {
      app: '2D Ledger Pro',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      storageType: '2D_LOTTERY_ISOLATED',
      data: {
        settings,
        rounds,
        activeRoundId,
        vouchers,
        forwardSlips,
        limits,
        blockedNumbers
      }
    };
    return JSON.stringify(backupObj, null, 2);
  }, [settings, rounds, activeRoundId, vouchers, forwardSlips, limits, blockedNumbers]);

  // Dedicated 2D JSON Backup Import
  const importJSONBackup = useCallback((jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      const data = parsed.data || parsed;

      if (data.settings && typeof data.settings === 'object') {
        setSettingsState({ ...DEFAULT_2D_SETTINGS, ...data.settings });
      }
      
      if (Array.isArray(data.rounds)) {
        setRounds(prev => {
          const map = new Map<string, TwoDDrawRound>();
          prev.forEach(r => map.set(r.id, r));

          data.rounds.forEach((r: TwoDDrawRound) => {
            const existing = map.get(r.id);
            let mergedRound = { ...r };

            // Determine if the imported round's date is old
            const todayStr = getLocalDateString();
            const isPastDate = r.drawDate < todayStr;

            // If the imported round is 'open', but it's a past date, change its status to 'closed'
            if (mergedRound.status === 'open' && isPastDate) {
              mergedRound.status = 'closed';
            }

            if (existing) {
              // Rule: id တူရင် ရှိပြီးသား status (closed/settled) ကို မပြောင်းစေပါနဲ့ (Do not change existing status if it is closed or settled)
              if (existing.status === 'closed' || existing.status === 'settled') {
                mergedRound.status = existing.status;
                mergedRound.winningNumber = existing.winningNumber || mergedRound.winningNumber;
                mergedRound.settledAt = existing.settledAt || mergedRound.settledAt;
              }
            }

            map.set(r.id, mergedRound);
          });
          return Array.from(map.values());
        });
      }

      if (data.activeRoundId) setActiveRoundIdState(data.activeRoundId);
      if (Array.isArray(data.vouchers)) setVouchers(data.vouchers);
      if (Array.isArray(data.forwardSlips)) setForwardSlips(data.forwardSlips);
      if (data.limits && typeof data.limits === 'object') setLimits(data.limits);
      if (data.blockedNumbers && typeof data.blockedNumbers === 'object') setBlockedNumbers(data.blockedNumbers);

      return true;
    } catch (err) {
      console.error('Failed to import 2D backup:', err);
      return false;
    }
  }, []);

  return (
    <TwoDLotteryContext.Provider
      value={{
        settings,
        updateSettings,
        rounds: visibleRounds,
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
        createVoucher,
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
    </TwoDLotteryContext.Provider>
  );
};

export const useTwoDLottery = () => {
  const context = useContext(TwoDLotteryContext);
  if (!context) {
    throw new Error('useTwoDLottery must be used within a TwoDLotteryProvider');
  }
  return context;
};
