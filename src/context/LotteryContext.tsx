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
  saveStoredData,
  saveMultipleAtomic
} from '../utils/storage';
import { evaluateWinnings, exportLotteryDataToExcel, masterShareOf3D } from '../utils/lotteryUtils';
import { getLocalDateString, safeRound } from '../utils/moneyUtils';
import { generateUpToDate3DRounds } from '../utils/thaiLotteryApi';
import { generateSubmissionFingerprint, isDuplicateSubmission } from '../utils/transactionUtils';
import { TELEGRAM_STORAGE_KEYS } from '../utils/backupUtils';
import { triggerRibbonsCelebration } from '../utils/audioUtils';
import { runIdMigration } from '../utils/idMigration';
import { runPhonePurgeMigration } from '../utils/migrationUtils';
import { generateUUID } from '../utils/restorePoints';
import { getVoucherGrossTurnover } from '../utils/statementUtils';
import { getDeviceShortCode } from '../utils/deviceId';
import { assertDateOpen, dateOfRound } from '../utils/periodGuard';

interface LotteryContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  rounds: DrawRound[];
  activeRoundId: string;
  activeRound: DrawRound | undefined;
  setActiveRoundId: (id: string) => void;
  createRound: (round: Omit<DrawRound, 'id'>) => DrawRound;
  updateRound: (roundId: string, data: Partial<DrawRound>) => void;
  deleteRound: (roundId: string, reason?: string) => void;
  syncLiveRounds: () => Promise<void>;

  vouchers: Voucher[];
  activeRoundVouchers: Voucher[];
  addVoucher: (voucher: Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>) => Voucher;
  createVoucher: (
    items: VoucherItem[],
    customerName?: string,
    customerPhone?: string,
    discountPercent?: number,
    notes?: string
  ) => Voucher;
  updateVoucher: (id: string, data: Partial<Voucher>) => void;
  deleteVoucher: (id: string, reason?: string) => void;

  forwardSlips: ForwardSlip[];
  activeRoundForwardSlips: ForwardSlip[];
  addForwardSlip: (slip: Omit<ForwardSlip, 'id' | 'slipNo' | 'createdAt'>) => ForwardSlip;
  deleteForwardSlip: (id: string, reason?: string) => void;

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
  importRoundWithVouchers: (round: Omit<DrawRound, 'id'>, vouchers: Voucher[]) => void;
}

export const LotteryContext = createContext<LotteryContextType | undefined>(undefined);

export const useLottery = () => {
  const context = useContext(LotteryContext);
  if (!context) {
    throw new Error('useLottery must be used within a LotteryProvider');
  }
  return context;
};

export const LotteryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [migrationDone, setMigrationDone] = useState(false);

  useEffect(() => {
    runIdMigration()
      .then(() => runPhonePurgeMigration())
      .then(() => setMigrationDone(true));
  }, []);

  // 1. Core State
  const [settings, setSettingsState] = useState<AppSettings>(() =>
    loadStoredData(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS)
  );

  const [rawRounds, setRounds] = useState<DrawRound[]>(() =>
    loadStoredData(STORAGE_KEYS.ROUNDS, INITIAL_ROUNDS)
  );
  // Consumers never see tombstoned (deleted) rounds; storage keeps them.
  const rounds = useMemo(() => rawRounds.filter(r => !(r as any).deletedAt), [rawRounds]);

  // 3D Round Rollover and Auto-Closing Check (Rule 7A)
  useEffect(() => {
    const checkAndSync3DRounds = () => {
      const todayStr = getLocalDateString();
      const now = new Date();
      const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      setRounds(prev => {
        let changed = false;
        const updated = prev.map(r => {
          if (r.status === 'settled') return r;
          // Past date rounds (drawDate < today) with no result yet -> status = 'closed'
          if (r.drawDate < todayStr && r.status === 'open') {
            changed = true;
            return { ...r, status: 'closed' as const };
          }
          // Today round check against round.closingTime
          if (r.drawDate === todayStr && r.status === 'open') {
            if (r.closingTime && currentTimeStr >= r.closingTime) {
              changed = true;
              return { ...r, status: 'closed' as const };
            }
          }
          return r;
        });
        return changed ? updated : prev;
      });
    };

    checkAndSync3DRounds();
    const intervalId = setInterval(checkAndSync3DRounds, 60000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndSync3DRounds();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const [activeRoundId, setActiveRoundIdState] = useState<string>(() => {
    const saved = loadStoredData<string>(STORAGE_KEYS.ACTIVE_ROUND_ID, '');
    const todayStr = getLocalDateString();
    if (saved) {
      const savedRound = rounds.find(r => r.id === saved);
      if (savedRound && savedRound.drawDate === todayStr && savedRound.status === 'open') {
        return saved;
      }
    }
    const todayOpen = rounds.find(r => r.drawDate === todayStr && r.status === 'open');
    if (todayOpen) return todayOpen.id;
    const openRound = rounds.find(r => r.status === 'open');
    if (openRound) return openRound.id;
    if (saved && rounds.some(r => r.id === saved)) return saved;
    return rounds[0]?.id || 'round-default';
  });

  const [rawVouchers, setVouchers] = useState<Voucher[]>(() => {
    const loaded = loadStoredData<Voucher[]>(STORAGE_KEYS.VOUCHERS, []);
    if (!loaded || !Array.isArray(loaded)) return [];
    return loaded.map(v => {
      const gross = getVoucherGrossTurnover(v);
      if (gross > 0 && (v.subtotal !== gross || (v.subtotal % 50 !== 0))) {
        const disc = v.discountPercent ? Math.round((gross * v.discountPercent) / 100) : (v.discountAmount || 0);
        return {
          ...v,
          subtotal: gross,
          discountAmount: disc,
          netPayable: gross - disc
        };
      }
      return v;
    });
  });
  const vouchers = useMemo(() => rawVouchers.filter(v => !v.deletedAt && v.status !== 'cancelled'), [rawVouchers]);

  const [rawForwardSlips, setForwardSlips] = useState<ForwardSlip[]>(() =>
    loadStoredData<ForwardSlip[]>(STORAGE_KEYS.FORWARD_SLIPS, [])
  );
  const forwardSlips = useMemo(() => rawForwardSlips.filter(f => !(f as any).deletedAt), [rawForwardSlips]);

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
    saveStoredData(STORAGE_KEYS.ROUNDS, rawRounds);
  }, [rounds]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.ACTIVE_ROUND_ID, activeRoundId);
  }, [activeRoundId]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.VOUCHERS, rawVouchers);
  }, [vouchers]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.FORWARD_SLIPS, rawForwardSlips);
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
    return vouchers.filter(v => v.roundId === activeRoundId && !v.deletedAt && v.status !== 'cancelled');
  }, [vouchers, activeRoundId]);

  const activeRoundForwardSlips = useMemo(() => {
    return forwardSlips.filter(f => f.roundId === activeRoundId);
  }, [forwardSlips, activeRoundId]);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettingsState(prev => ({ ...prev, ...newSettings }));
  }, []);

  const setActiveRoundId = useCallback((id: string) => {
    setActiveRoundIdState(id);
  }, []);

  const createRound = useCallback((roundData: Omit<DrawRound, 'id'>) => {
    const newRound: DrawRound = {
      ...roundData,
      multiplier: roundData.multiplier || settings.defaultMultiplier,
      toddMultiplier: roundData.toddMultiplier || settings.defaultToddMultiplier,
      commissionRate: roundData.commissionRate ?? settings.defaultCommissionRate,
      id: generateUUID()
    };
    setRounds(prev => [newRound, ...prev]);
    setActiveRoundIdState(newRound.id);
    return newRound;
  }, [settings.defaultMultiplier, settings.defaultToddMultiplier, settings.defaultCommissionRate]);

  const updateRound = useCallback((roundId: string, data: Partial<DrawRound>) => {
    setRounds(prev =>
      prev.map(r => (r.id === roundId ? { ...r, ...data } : r))
    );
  }, []);

  // Cascade Round Deletion (Rule 6B)
  const deleteRound = useCallback((roundId: string, reason: string = 'user-deleted') => {
    const nowIso = new Date().toISOString();
    // Tombstones only: nothing is physically removed (audit + merge safety)
    const updatedRounds = rawRounds.map(r =>
      r.id === roundId ? ({ ...r, deletedAt: nowIso, deletedReason: reason } as any) : r);
    const updatedVouchers = rawVouchers.map(v =>
      v.roundId === roundId ? ({ ...v, deletedAt: nowIso, deletedReason: reason, deletedBy: 'user' } as any) : v);
    const updatedForwards = rawForwardSlips.map(f =>
      f.roundId === roundId ? ({ ...f, deletedAt: nowIso, deletedReason: reason, deletedBy: 'user' } as any) : f);

    // Linked telegram orders go back to pending (unchanged behaviour)
    const deletedVoucherIds = new Set(rawVouchers.filter(v => v.roundId === roundId).map(v => v.id));
    const toSave: Record<string, any> = {
      [STORAGE_KEYS.ROUNDS]: updatedRounds,
      [STORAGE_KEYS.VOUCHERS]: updatedVouchers,
      [STORAGE_KEYS.FORWARD_SLIPS]: updatedForwards,
    };
    try {
      const tgStored = localStorage.getItem(TELEGRAM_STORAGE_KEYS.ORDERS);
      if (tgStored) {
        const parsed = JSON.parse(tgStored);
        if (Array.isArray(parsed)) {
          toSave[TELEGRAM_STORAGE_KEYS.ORDERS] = parsed.map((o: any) =>
            o.voucherId && deletedVoucherIds.has(o.voucherId) ? { ...o, status: 'pending', voucherId: undefined } : o);
        }
      }
    } catch {
      // ignore malformed telegram storage
    }

    const remainingRounds = updatedRounds.filter(r => !(r as any).deletedAt);
    const todayStr = getLocalDateString();
    const todayOpen = remainingRounds.find(r => r.drawDate === todayStr && r.status === 'open');
    const nextActiveId = todayOpen ? todayOpen.id : (remainingRounds[0]?.id || '');
    toSave[STORAGE_KEYS.ACTIVE_ROUND_ID] = nextActiveId;

    saveMultipleAtomic(toSave);
    setRounds(updatedRounds);
    setActiveRoundIdState(nextActiveId);
    setVouchers(updatedVouchers);
    setForwardSlips(updatedForwards);
  }, [rawRounds, rawVouchers, rawForwardSlips]);

  const syncLiveRounds = useCallback(async () => {
    // Sync live 3D rounds if needed
  }, []);

  const addVoucher = useCallback((voucherData: Omit<Voucher, 'id' | 'voucherNo' | 'createdAt'>) => {
    assertDateOpen('3D', dateOfRound('3D', voucherData.roundId), 'ဘောင်ချာထည့်ခြင်း');
    const targetRound = rounds.find(r => r.id === voucherData.roundId);
    if (!targetRound || targetRound.status !== 'open') {
      throw new Error('ထီပွဲစဉ် ပိတ်သွားပြီဖြစ်သဖြင့် စာရင်း ထည့်သွင်း၍ မရတော့ပါ');
    }

    if (!settings.defaultMultiplier || settings.defaultMultiplier <= 0) {
      throw new Error('ပေါက်ကြေး သတ်မှတ်ထားခြင်း မရှိသေးပါ (Settings တွင် ပြင်ဆင်ပါ)');
    }

    const shortCode = getDeviceShortCode();
    let counter = 1;
    try {
      const storedCount = localStorage.getItem('voucher_counter_v1');
      if (storedCount) counter = parseInt(storedCount, 10) + 1;
    } catch {
      // ignore
    }
    localStorage.setItem('voucher_counter_v1', String(counter));
    const pad = String(counter).padStart(6, '0');

    // Strip customerPhone (Rule 5F)
    const { customerPhone: _discardPhone, ...cleanVoucherData } = voucherData as any;

    const newVoucher: Voucher = {
      ...cleanVoucherData,
      customerPhone: undefined,
      id: generateUUID(),
      voucherNo: `${shortCode}-V-${pad}`,
      createdAt: new Date().toISOString(),
      lowerCommissionRate: settings.defaultCommissionRate,
      payoutMultiplier: settings.defaultMultiplier,
      snapshotSource: 'created'
    };

    setVouchers(prev => [newVoucher, ...prev]);
    return newVoucher;
  }, [rounds, settings]);

  const createVoucher = useCallback((
    items: VoucherItem[],
    customerName?: string,
    customerPhone?: string,
    discountPercent: number = 0,
    notes?: string
  ): Voucher => {
    if (!activeRound || activeRound.status !== 'open') {
      throw new Error('ထီပွဲစဉ် ပိတ်သွားပြီဖြစ်သဖြင့် စာရင်း ထည့်သွင်း၍ မရတော့ပါ');
    }
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    // Discounts are not used by the owner: always 0 (input is ignored)
    const discountAmount = 0;
    const netPayable = safeRound(subtotal - discountAmount);

    return addVoucher({
      roundId: activeRound.id,
      customerName: customerName || 'အထွေထွေ',
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

  const updateVoucher = useCallback((id: string, data: Partial<Voucher>) => {
    setVouchers(prev => {
      const target = prev.find(v => v.id === id);
      if (target && data.customerName && data.customerName !== target.customerName) {
        try {
          const rawStored = localStorage.getItem('shwe_mingalar_copied_raw_texts');
          if (rawStored) {
            const parsed = JSON.parse(rawStored);
            if (Array.isArray(parsed)) {
              const updatedClips = parsed.map((c: any) =>
                (c.voucherNumber === target.voucherNo || c.voucherNumber === id)
                  ? { ...c, customerName: data.customerName }
                  : c
              );
              localStorage.setItem('shwe_mingalar_copied_raw_texts', JSON.stringify(updatedClips));
              window.dispatchEvent(new CustomEvent('shwe_raw_clips_updated'));
            }
          }
        } catch {
          // ignore
        }
      }
      return prev.map(v => (v.id === id ? { ...v, ...data } : v));
    });
  }, []);

  const deleteVoucher = useCallback((id: string, reason: string = 'user-deleted') => {
    { const v = vouchers.find(x => x.id === id); if (v) assertDateOpen('3D', dateOfRound('3D', v.roundId), 'ဘောင်ချာဖျက်ခြင်း'); }
    const target = vouchers.find(v => v.id === id);
    if (!target) return;

    const nowIso = new Date().toISOString();

    // Tombstone associated raw bet text clip from Raw Texts Archive
    try {
      const rawStored = localStorage.getItem('shwe_mingalar_copied_raw_texts');
      if (rawStored) {
        const parsed = JSON.parse(rawStored);
        if (Array.isArray(parsed)) {
          const updatedRawClips = parsed.map((c: any) =>
            ((c.voucherNumber === target.voucherNo || c.voucherNumber === id) && !c.deletedAt)
              ? { ...c, deletedAt: nowIso, deletedReason: reason }
              : c
          );
          localStorage.setItem('shwe_mingalar_copied_raw_texts', JSON.stringify(updatedRawClips));
          window.dispatchEvent(new CustomEvent('shwe_raw_clips_updated'));
        }
      }
    } catch {
      // ignore
    }

    setVouchers(prev =>
      prev.map(v => v.id === id ? { ...v, status: 'cancelled', deletedAt: nowIso, deletedReason: reason } : v)
    );
  }, [vouchers]);

  const addForwardSlip = useCallback((slipData: Omit<ForwardSlip, 'id' | 'slipNo' | 'createdAt'>): ForwardSlip => {
    assertDateOpen('3D', dateOfRound('3D', slipData.roundId), 'ဒိုင်လွှဲထည့်ခြင်း');
    const resolvedRoundId = slipData.roundId || activeRoundId;
    const targetRound = rounds.find(r => r.id === resolvedRoundId);
    if (!targetRound || targetRound.status !== 'open') {
      throw new Error('ထီပွဲစဉ် ပိတ်သွားပြီဖြစ်သဖြင့် အထက်ဒိုင်ဆီ လွှဲတင်၍ မရတော့ပါ');
    }

    const shortCode = getDeviceShortCode();
    let counter = 1;
    try {
      const storedCount = localStorage.getItem('forward_counter_v1');
      if (storedCount) counter = parseInt(storedCount, 10) + 1;
    } catch {
      // ignore
    }
    localStorage.setItem('forward_counter_v1', String(counter));
    const pad = String(counter).padStart(6, '0');

    const commRate = slipData.commissionRate ?? settings.defaultCommissionRate;
    if (!Number.isFinite(commRate)) throw new Error('ကော်မရှင်နှုန်း သတ်မှတ်ထားခြင်း မရှိပါ — Settings တွင် သတ်မှတ်ပါ');
    const commAmt = safeRound((slipData.totalAmount * commRate) / 100);
    const netPaid = safeRound(slipData.totalAmount - commAmt);

    const newSlip: ForwardSlip = {
      ...slipData,
      roundId: resolvedRoundId,
      commissionRate: commRate,
      commissionAmount: commAmt,
      netPaid,
      id: generateUUID(),
      slipNo: `${shortCode}-FWD3D-${pad}`,
      createdAt: new Date().toISOString(),
      upperCommissionRate: commRate,
      snapshotSource: 'created'
    };

    setForwardSlips(prev => [newSlip, ...prev]);
    return newSlip;
  }, [activeRoundId, rounds, settings.defaultCommissionRate]);

  const deleteForwardSlip = useCallback((id: string, reason: string = 'user-deleted') => {
    const nowIso = new Date().toISOString();
    setForwardSlips(prev =>
      prev.map(f => f.id === id ? { ...f, deletedAt: nowIso, deletedReason: reason } as any : f)
    );
  }, []);

  const setNumberLimit = useCallback((num: string, limit: number) => {
    const formatted = num.padStart(3, '0');
    setLimits(prev => ({ ...prev, [formatted]: limit }));
  }, []);

  const setBatchLimits = useCallback((numbers: string[], limit: number) => {
    setLimits(prev => {
      const next = { ...prev };
      numbers.forEach(num => {
        next[num.padStart(3, '0')] = limit;
      });
      return next;
    });
  }, []);

  const removeNumberLimit = useCallback((num: string) => {
    const formatted = num.padStart(3, '0');
    setLimits(prev => {
      const next = { ...prev };
      delete next[formatted];
      return next;
    });
  }, []);

  const toggleBlockNumber = useCallback((num: string) => {
    const formatted = num.padStart(3, '0');
    setBlockedNumbers(prev => ({
      ...prev,
      [formatted]: !prev[formatted]
    }));
  }, []);

  const setBlockNumber = useCallback((num: string, blocked: boolean) => {
    const formatted = num.padStart(3, '0');
    setBlockedNumbers(prev => ({
      ...prev,
      [formatted]: blocked
    }));
  }, []);

  const setBatchBlocked = useCallback((numbers: string[], blocked: boolean) => {
    setBlockedNumbers(prev => {
      const next = { ...prev };
      numbers.forEach(num => {
        next[num.padStart(3, '0')] = blocked;
      });
      return next;
    });
  }, []);

  const isNumberBlocked = useCallback((num: string) => {
    const formatted = num.padStart(3, '0');
    if (blockedNumbers[formatted]) return true;
    if (limits[formatted] === 0) return true;
    if (limits[formatted] === undefined && settings.globalStockLimit === 0) return true;
    return false;
  }, [blockedNumbers, limits, settings.globalStockLimit]);

  const getNumberLimit = useCallback((num: string) => {
    const formatted = num.padStart(3, '0');
    return limits[formatted] ?? settings.globalStockLimit;
  }, [limits, settings.globalStockLimit]);

  // Aggregates calculation
  const aggregates = useMemo(() => {
    const mult = activeRound?.multiplier || settings.defaultMultiplier;
    const agg: { [num: string]: NumberAggregate } = {};

    activeRoundVouchers.forEach(v => {
      v.items.forEach(item => {
        const n = item.number.padStart(3, '0');
        if (!agg[n]) {
          const lmt = limits[n] ?? settings.globalStockLimit;
          agg[n] = {
            number: n,
            totalSold: 0,
            forwardedAmount: 0,
            retainedAmount: 0,
            limit: lmt,
            isBlocked: !!blockedNumbers[n] || lmt === 0,
            betCount: 0,
            estimatedPayout: 0,
            netRisk: 0,
            riskLevel: 'safe'
          };
        }
        agg[n].totalSold += item.amount;
        agg[n].betCount += 1;
      });
    });

    activeRoundForwardSlips.forEach(f => {
      f.items.forEach(item => {
        const n = item.number.padStart(3, '0');
        if (!agg[n]) {
          const lmt = limits[n] ?? settings.globalStockLimit;
          agg[n] = {
            number: n,
            totalSold: 0,
            forwardedAmount: 0,
            retainedAmount: 0,
            limit: lmt,
            isBlocked: !!blockedNumbers[n] || lmt === 0,
            betCount: 0,
            estimatedPayout: 0,
            netRisk: 0,
            riskLevel: 'safe'
          };
        }
        agg[n].forwardedAmount += item.amount;
      });
    });

    Object.keys(agg).forEach(k => {
      const item = agg[k];
      item.retainedAmount = safeRound(item.totalSold - item.forwardedAmount);
      item.estimatedPayout = safeRound(item.retainedAmount * mult);

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
  }, [activeRound, settings.defaultMultiplier, settings.globalStockLimit, settings.lowStockAlertPercentage, limits, blockedNumbers, activeRoundVouchers, activeRoundForwardSlips]);

  const hotNumbers = useMemo(() => {
    return (Object.values(aggregates) as NumberAggregate[])
      .filter(a => a.totalSold > 0)
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 20);
  }, [aggregates]);

  const lowStockAlerts = useMemo(() => {
    const alerts: LowStockAlert[] = [];
    const thresholdPct = settings.lowStockAlertPercentage;
    if (!thresholdPct || thresholdPct <= 0) return alerts;

    (Object.values(aggregates) as NumberAggregate[]).forEach(agg => {
      if (agg.limit <= 0) return;
      const pct = Math.round((agg.totalSold / agg.limit) * 100);

      if (agg.isBlocked) {
        alerts.push({
          id: `alert-3d-${agg.number}-blk`,
          number: agg.number,
          soldAmount: agg.totalSold,
          limit: agg.limit,
          percentage: pct,
          timestamp: new Date().toISOString(),
          type: 'blocked'
        });
      } else if (pct >= 100) {
        alerts.push({
          id: `alert-3d-${agg.number}-full`,
          number: agg.number,
          soldAmount: agg.totalSold,
          limit: agg.limit,
          percentage: pct,
          timestamp: new Date().toISOString(),
          type: 'limit_reached'
        });
      } else if (pct >= thresholdPct) {
        alerts.push({
          id: `alert-3d-${agg.number}-near`,
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

  const roundSummary = useMemo<RoundSummary>(() => {
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
    let masterPayout = 0;
    let totalWinnersCount = 0;

    if (activeRound?.winningNumber) {
      const mult = activeRound.multiplier || settings.defaultMultiplier;
      const toddMult = activeRound.toddMultiplier || settings.defaultToddMultiplier;
      const formattedNum = activeRound.winningNumber.padStart(3, '0');
      const evalResult = evaluateWinnings(activeRoundVouchers, formattedNum, mult, toddMult);
      totalWinnersCount = evalResult.winningBetsCount + evalResult.toddWinningBetsCount;
      totalPayout = evalResult.totalPayout;

      masterPayout = masterShareOf3D(evalResult.winners, aggregates);
    }

    const netPaid = safeRound(totalForwarded - forwardedCommission);
    const netProfit = safeRound(netRevenue - netPaid - totalPayout + masterPayout);

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
  }, [activeRound, activeRoundVouchers, activeRoundForwardSlips, settings.defaultMultiplier, settings.defaultToddMultiplier, aggregates]);

  const settleWinningNumber = useCallback((winningNum: string, multiplier?: number, toddMultiplier?: number) => {
    assertDateOpen('3D', dateOfRound('3D', activeRoundId), 'ပေါက်ဂဏန်း သတ်မှတ်ခြင်း');
    if (!activeRound) return;
    const effTodd = toddMultiplier ?? activeRound.toddMultiplier ?? settings.defaultToddMultiplier;
    if (!(Number(effTodd) > 0)) {
      throw new Error('Todd ပေါက်ကြေးအဆ သတ်မှတ်ထားခြင်း မရှိပါ — Settings တွင် သတ်မှတ်ပါ');
    }

    const fp = generateSubmissionFingerprint('3D_SETTLE_ROUND', { activeRoundId: activeRound.id, winningNum, multiplier });
    if (isDuplicateSubmission(fp, 5000)) {
      return;
    }

    const mult = multiplier || activeRound.multiplier || settings.defaultMultiplier;
    const toddMult = toddMultiplier || activeRound.toddMultiplier || settings.defaultToddMultiplier;
    if (!mult || mult <= 0) {
      alert('Settings တွင် ပေါက်ကြေးအဆ (Multiplier) ဦးစွာ သတ်မှတ်ပါ');
      return;
    }
    const formattedNum = winningNum.padStart(3, '0');

    const evalResult = evaluateWinnings(activeRoundVouchers, formattedNum, mult, toddMult);

    setVouchers(prev =>
      prev.map(v => {
        const winningItems = evalResult.winners.filter(w => w.voucherId === v.id);
        if (winningItems.length > 0) {
          const updatedItems = v.items.map(item => {
            const match = winningItems.find(w => w.betNumber === item.number);
            if (match) {
              return { ...item, isWon: true, wonAmount: match.wonPayout };
            }
            return item;
          });
          return { ...v, status: 'settled', items: updatedItems };
        }
        return v;
      })
    );

    setForwardSlips(prev =>
      prev.map(f => {
        if (f.roundId === activeRound.id) {
          let payout = 0;
          f.items.forEach(it => {
            if (it.number === formattedNum) payout += it.amount * mult;
          });
          return { ...f, actualPayout: payout };
        }
        return f;
      })
    );

    setRounds(prev =>
      prev.map(r =>
        r.id === activeRound.id
          ? {
              ...r,
              status: 'settled',
              winningNumber: formattedNum,
              multiplier: mult,
              toddMultiplier: toddMult,
              settledAt: new Date().toISOString()
            }
          : r
      )
    );

    try {
      triggerRibbonsCelebration();
    } catch {
      // Safe fail
    }
  }, [activeRound, activeRoundVouchers, settings.defaultMultiplier, settings.defaultToddMultiplier]);

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

    setForwardSlips(prev =>
      prev.map(f => {
        if (f.roundId === activeRound.id) {
          return { ...f, actualPayout: undefined };
        }
        return f;
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
    exportLotteryDataToExcel(
      activeRound,
      activeRoundVouchers,
      activeRoundForwardSlips,
      aggregates as any,
      activeRound.winningNumber,
      activeRound.multiplier || settings.defaultMultiplier
    );
  }, [activeRound, aggregates, activeRoundVouchers, activeRoundForwardSlips, roundSummary, settings.shopName, settings.defaultMultiplier]);

  const resetToSampleData = useCallback(() => {
    setSettingsState(DEFAULT_SETTINGS);
    const freshRounds = generateUpToDate3DRounds();
    setRounds(freshRounds);
    if (freshRounds.length > 0) setActiveRoundIdState(freshRounds[0].id);
    setVouchers([]);
    setForwardSlips([]);
    setLimits(INITIAL_LIMITS);
    setBlockedNumbers(INITIAL_BLOCKED);
  }, []);

  const clearAllData = useCallback(() => {
    setVouchers([]);
    setForwardSlips([]);
    setLimits({});
    setBlockedNumbers({});
  }, []);

  const exportJSONBackup = useCallback(() => {
    const backupObj = {
      app: '3D Ledger Pro',
      version: '2.0',
      exportedAt: new Date().toISOString(),
      storageType: '3D_LOTTERY_ISOLATED',
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

  const importJSONBackup = useCallback((jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      const data = parsed.data || parsed;

      if (data.settings && typeof data.settings === 'object') {
        setSettingsState({ ...DEFAULT_SETTINGS, ...data.settings });
      }

      if (Array.isArray(data.rounds)) {
        setRounds(data.rounds);
      }

      if (data.activeRoundId) setActiveRoundIdState(data.activeRoundId);
      if (Array.isArray(data.vouchers)) setVouchers(data.vouchers);
      if (Array.isArray(data.forwardSlips)) setForwardSlips(data.forwardSlips);
      if (data.limits && typeof data.limits === 'object') setLimits(data.limits);
      if (data.blockedNumbers && typeof data.blockedNumbers === 'object') setBlockedNumbers(data.blockedNumbers);

      return true;
    } catch (err) {
      console.error('Failed to import 3D backup:', err);
      return false;
    }
  }, []);

  const importRoundWithVouchers = useCallback((roundData: Omit<DrawRound, 'id'>, importedVouchers: Voucher[]) => {
    const existingRound = rounds.find(r => r.drawDate === roundData.drawDate);
    const targetRoundId = existingRound ? existingRound.id : generateUUID();

    if (!existingRound) {
      const newRound: DrawRound = {
        ...roundData,
        id: targetRoundId
      };
      setRounds(prev => [newRound, ...prev]);
    }
    setActiveRoundIdState(targetRoundId);

    const stampedVouchers = importedVouchers.map((v, idx) => ({
      ...v,
      id: v.id || generateUUID(),
      roundId: targetRoundId
    }));

    setVouchers(prev => [...prev, ...stampedVouchers]);

    if (roundData.winningNumber && roundData.status === 'settled') {
      setTimeout(() => {
        settleWinningNumber(roundData.winningNumber!, roundData.multiplier, roundData.toddMultiplier);
      }, 100);
    }
  }, [rounds, settleWinningNumber]);

  if (!migrationDone) return null;

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
        importJSONBackup,
        importRoundWithVouchers
      }}
    >
      {children}
    </LotteryContext.Provider>
  );
};
