import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  TwoDDrawRound,
  TwoDVoucher,
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
import { evaluateTwoDWinnings, exportTwoDLotteryToExcel } from '../utils/twoDLotteryUtils';
import { fetchLiveOfficialFeed, generateUpToDate2DRounds } from '../utils/thaiLotteryApi';

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
  exportToExcel: () => void;
  resetToSampleData: () => void;
  clearAllData: () => void;
  exportJSONBackup: () => string;
  importJSONBackup: (jsonString: string) => boolean;
}

const TwoDLotteryContext = createContext<TwoDLotteryContextType | undefined>(undefined);

export const TwoDLotteryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Core State with LocalStorage Persistence (Strictly 2D Keys)
  const [settings, setSettingsState] = useState<TwoDAppSettings>(() =>
    loadStoredData(STORAGE_KEYS.SETTINGS_2D, DEFAULT_2D_SETTINGS)
  );

  const [rounds, setRounds] = useState<TwoDDrawRound[]>(() =>
    loadStoredData(STORAGE_KEYS.ROUNDS_2D, INITIAL_2D_ROUNDS)
  );

  const [activeRoundId, setActiveRoundIdState] = useState<string>(() => {
    const saved = loadStoredData<string>(STORAGE_KEYS.ACTIVE_ROUND_ID_2D, '');
    if (saved && rounds.some(r => r.id === saved)) return saved;
    return rounds[0]?.id || 'round-2d-default';
  });

  const [vouchers, setVouchers] = useState<TwoDVoucher[]>(() =>
    loadStoredData(STORAGE_KEYS.VOUCHERS_2D, INITIAL_2D_VOUCHERS)
  );

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

  const activeRound = useMemo(() => {
    return rounds.find(r => r.id === activeRoundId) || rounds[0];
  }, [rounds, activeRoundId]);

  const activeRoundVouchers = useMemo(() => {
    return vouchers.filter(v => v.roundId === activeRoundId && v.status !== 'cancelled');
  }, [vouchers, activeRoundId]);

  const activeRoundForwardSlips = useMemo(() => {
    return forwardSlips.filter(f => f.roundId === activeRoundId);
  }, [forwardSlips, activeRoundId]);

  const syncLiveRounds = useCallback(async () => {
    try {
      const liveFeed = await fetchLiveOfficialFeed();
      const freshRounds = generateUpToDate2DRounds(liveFeed);
      setRounds(prev => {
        const merged = freshRounds.map(fresh => {
          const existing = prev.find(p => p.id === fresh.id);
          if (existing) {
            return {
              ...fresh,
              ...existing,
              winningNumber: existing.winningNumber || fresh.winningNumber,
              status: existing.status || fresh.status
            };
          }
          return fresh;
        });
        return merged;
      });
    } catch {
      // Fallback
    }
  }, []);

  // Auto-sync outdated records on first load
  useEffect(() => {
    const todayPrefix = new Date().toISOString().slice(0, 7);
    const hasCurrentMonth = rounds.some(r => r.drawDate && r.drawDate.startsWith(todayPrefix));
    if (!hasCurrentMonth) {
      syncLiveRounds();
    }
  }, [syncLiveRounds, rounds]);

  const updateSettings = useCallback((newSettings: Partial<TwoDAppSettings>) => {
    setSettingsState(prev => ({ ...prev, ...newSettings }));
    if (newSettings.defaultMultiplier !== undefined && !isNaN(newSettings.defaultMultiplier)) {
      const newMult = Number(newSettings.defaultMultiplier);
      setRounds(prev =>
        prev.map(r => (r.status === 'open' ? { ...r, multiplier: newMult } : r))
      );
    }
  }, []);

  const setActiveRoundId = useCallback((id: string) => {
    setActiveRoundIdState(id);
  }, []);

  const createRound = useCallback((roundData: Omit<TwoDDrawRound, 'id'>) => {
    const newRound: TwoDDrawRound = {
      ...roundData,
      id: `round-2d-${Date.now()}`
    };
    setRounds(prev => [newRound, ...prev]);
    setActiveRoundIdState(newRound.id);
    return newRound;
  }, []);

  const updateRound = useCallback((roundId: string, data: Partial<TwoDDrawRound>) => {
    setRounds(prev =>
      prev.map(r => (r.id === roundId ? { ...r, ...data } : r))
    );
  }, []);

  const deleteRound = useCallback((roundId: string) => {
    setRounds(prev => {
      const filtered = prev.filter(r => r.id !== roundId);
      if (activeRoundId === roundId && filtered.length > 0) {
        setActiveRoundIdState(filtered[0].id);
      }
      return filtered;
    });
  }, [activeRoundId]);

  const addVoucher = useCallback((voucherData: Omit<TwoDVoucher, 'id' | 'voucherNo' | 'createdAt'>) => {
    const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randSeq = Math.floor(1000 + Math.random() * 9000);
    const newVoucher: TwoDVoucher = {
      ...voucherData,
      id: `vouch-2d-${Date.now()}`,
      voucherNo: `V2D-${todayStr}-${randSeq}`,
      createdAt: new Date().toISOString()
    };
    setVouchers(prev => [newVoucher, ...prev]);
    return newVoucher;
  }, []);

  const updateVoucher = useCallback((id: string, data: Partial<TwoDVoucher>) => {
    setVouchers(prev =>
      prev.map(v => (v.id === id ? { ...v, ...data } : v))
    );
  }, []);

  const deleteVoucher = useCallback((id: string) => {
    setVouchers(prev => prev.filter(v => v.id !== id));
  }, []);

  const addForwardSlip = useCallback((slipData: Omit<TwoDForwardSlip, 'id' | 'slipNo' | 'createdAt'>) => {
    const todayStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randSeq = Math.floor(100 + Math.random() * 900);
    const newSlip: TwoDForwardSlip = {
      ...slipData,
      id: `fwd-2d-${Date.now()}`,
      slipNo: `FWD2D-${todayStr}-${randSeq}`,
      createdAt: new Date().toISOString()
    };
    setForwardSlips(prev => [newSlip, ...prev]);
    return newSlip;
  }, []);

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
    return !!blockedNumbers[num.padStart(2, '0')];
  }, [blockedNumbers]);

  const getNumberLimit = useCallback((num: string) => {
    const formatted = num.padStart(2, '0');
    return limits[formatted] ?? settings.globalStockLimit;
  }, [limits, settings.globalStockLimit]);

  // 2D Aggregates calculation (00 - 99: exactly 100 combinations)
  const aggregates = useMemo(() => {
    const mult = activeRound?.multiplier || settings.defaultMultiplier || 85;
    const agg: { [num: string]: TwoDNumberAggregate } = {};

    // Initialize all 100 numbers (00 to 99)
    for (let i = 0; i <= 99; i++) {
      const numStr = i.toString().padStart(2, '0');
      const lmt = limits[numStr] ?? settings.globalStockLimit;
      const isBlk = !!blockedNumbers[numStr];

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
      item.retainedAmount = Math.max(0, item.totalSold - item.forwardedAmount);
      item.estimatedPayout = item.retainedAmount * mult;

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
    const thresholdPct = settings.lowStockAlertPercentage || 80;

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
    let totalWinnersCount = 0;

    if (activeRound?.winningNumber) {
      activeRoundVouchers.forEach(v => {
        v.items.forEach(item => {
          if (item.isWon) {
            totalPayout += item.wonAmount || 0;
            totalWinnersCount++;
          }
        });
      });
    }

    // Dealer profit = (net revenue - payouts) + commission from bookmaker
    const netProfit = (netRevenue - totalPayout) + forwardedCommission;

    return {
      totalSales,
      totalVouchers: activeRoundVouchers.length,
      totalDiscount,
      netRevenue,
      totalForwarded,
      forwardedCommission,
      totalPayout,
      winningNumber: activeRound?.winningNumber,
      totalWinnersCount,
      netProfit,
      isProfit: netProfit >= 0
    };
  }, [activeRound, activeRoundVouchers, activeRoundForwardSlips]);

  // Settle winning number
  const settleWinningNumber = useCallback((winningNum: string, multiplier?: number) => {
    if (!activeRound) return;
    const mult = multiplier || activeRound.multiplier || settings.defaultMultiplier || 80;
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
  }, [activeRound, activeRoundVouchers]);

  const clearWinningSettlement = useCallback(() => {
    if (!activeRound) return;

    setVouchers(prev =>
      prev.map(v => {
        if (v.roundId === activeRound.id) {
          return {
            ...v,
            status: 'active',
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

  const exportToExcel = useCallback(() => {
    if (!activeRound) return;
    exportTwoDLotteryToExcel(
      activeRound,
      aggregates,
      activeRoundVouchers,
      activeRoundForwardSlips,
      roundSummary,
      settings.shopName
    );
  }, [activeRound, aggregates, activeRoundVouchers, activeRoundForwardSlips, roundSummary, settings.shopName]);

  const resetToSampleData = useCallback(() => {
    setSettingsState(DEFAULT_2D_SETTINGS);
    setRounds(INITIAL_2D_ROUNDS);
    setActiveRoundIdState(INITIAL_2D_ROUNDS[0].id);
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

      if (data.settings) setSettingsState(data.settings);
      if (Array.isArray(data.rounds)) setRounds(data.rounds);
      if (data.activeRoundId) setActiveRoundIdState(data.activeRoundId);
      if (Array.isArray(data.vouchers)) setVouchers(data.vouchers);
      if (Array.isArray(data.forwardSlips)) setForwardSlips(data.forwardSlips);
      if (data.limits) setLimits(data.limits);
      if (data.blockedNumbers) setBlockedNumbers(data.blockedNumbers);

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
