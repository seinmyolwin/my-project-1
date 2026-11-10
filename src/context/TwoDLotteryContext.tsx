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
  saveStoredData,
  saveMultipleAtomic
} from '../utils/storage';
import { evaluateTwoDWinnings, exportTwoDLotteryToExcel, is2DRoundClosed, normalizeTwoDMultiplier } from '../utils/twoDLotteryUtils';
import { generateUpToDate2DRounds } from '../utils/thaiLotteryApi';
import { generateSubmissionFingerprint, isDuplicateSubmission } from '../utils/transactionUtils';
import { getLocalDateString, safeRound } from '../utils/moneyUtils';
import { TELEGRAM_STORAGE_KEYS } from '../utils/backupUtils';
import { merge2DVouchersNoDuplicates } from '../utils/deduplicationUtils';
import { triggerRibbonsCelebration } from '../utils/audioUtils';
import { generateUUID } from '../utils/restorePoints';
import { getDeviceShortCode } from '../utils/deviceId';
import { createTombstone } from '../utils/tombstoneUtils';
import { assertDateOpen, dateOfRound } from '../utils/periodGuard';
import { getVoucherGrossTurnover } from '../utils/statementUtils';

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
  importRoundWithVouchers: (round: Omit<TwoDDrawRound, 'id'>, vouchers: TwoDVoucher[]) => void;
}

const TwoDLotteryContext = createContext<TwoDLotteryContextType | undefined>(undefined);

export const TwoDLotteryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Core State with LocalStorage Persistence (Strictly 2D Keys)
  const [settings, setSettingsState] = useState<TwoDAppSettings>(() => {
    const loaded = loadStoredData(STORAGE_KEYS.SETTINGS_2D, DEFAULT_2D_SETTINGS);
    let mult = normalizeTwoDMultiplier(loaded.defaultMultiplier);
    return {
      ...loaded,
      defaultMultiplier: mult
    };
  });

  const [deletedRoundIds, setDeletedRoundIds] = useState<string[]>(() => {
    return loadStoredData<string[]>('2d_ledger_deleted_rounds_v1', []);
  });

  const [rawRounds, setRounds] = useState<TwoDDrawRound[]>(() => {
    const stored = loadStoredData<TwoDDrawRound[]>(STORAGE_KEYS.ROUNDS_2D, []);
    const upToDate = generateUpToDate2DRounds(settings.defaultMultiplier, settings.defaultCommissionRate);
    const deleted = loadStoredData<string[]>('2d_ledger_deleted_rounds_v1', []);
    const deletedSet = new Set(deleted);
    const todayStr = getLocalDateString();

    const storedMap = new Map<string, TwoDDrawRound>();
    stored.forEach(r => {
      if (!deletedSet.has(r.id)) {
        let mult = normalizeTwoDMultiplier(r.multiplier || settings.defaultMultiplier);
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
  // Consumers never see tombstoned rounds; storage keeps them.
  const rounds = useMemo(() => rawRounds.filter(r => !(r as any).deletedAt), [rawRounds]);

  // Keep today's rounds available without force-closing past open rounds
  useEffect(() => {
    let lastDateStr = getLocalDateString();

    const checkAndSyncRounds = () => {
      const todayStr = getLocalDateString();
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;

      setRounds(prev => {
        const upToDate = generateUpToDate2DRounds(settings.defaultMultiplier, settings.defaultCommissionRate);
        const map = new Map<string, TwoDDrawRound>();
        let changed = false;

        const deleted = loadStoredData<string[]>('2d_ledger_deleted_rounds_v1', []);
        const deletedSet = new Set(deleted);

        prev.forEach(r => {
          if (!deletedSet.has(r.id)) {
            if (r.status === 'settled') {
              map.set(r.id, r);
            } else if (r.drawDate < todayStr && r.status === 'open') {
              map.set(r.id, { ...r, status: 'closed' });
              changed = true;
            } else if (r.drawDate === todayStr && r.status === 'open' && r.closingTime && currentTimeStr >= r.closingTime) {
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
            if (r.drawDate < todayStr && r.status === 'open') {
              map.set(r.id, { ...r, status: 'closed' });
            } else if (r.drawDate === todayStr && r.status === 'open' && r.closingTime && currentTimeStr >= r.closingTime) {
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
    const intervalId = setInterval(checkAndSyncRounds, 60000);

    // Run on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAndSyncRounds();
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

  const [rawVouchers, setVouchers] = useState<TwoDVoucher[]>(() => {
    const loaded = loadStoredData<TwoDVoucher[]>(STORAGE_KEYS.VOUCHERS_2D, []);
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
  const vouchers = useMemo(() => rawVouchers.filter(v => !(v as any).deletedAt), [rawVouchers]);

  const [rawForwardSlips, setForwardSlips] = useState<TwoDForwardSlip[]>(() => {
    const loaded = loadStoredData<TwoDForwardSlip[]>(STORAGE_KEYS.FORWARD_SLIPS_2D, []);
    return loaded || [];
  });
  const forwardSlips = useMemo(() => rawForwardSlips.filter(f => !(f as any).deletedAt), [rawForwardSlips]);

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
    saveStoredData(STORAGE_KEYS.ROUNDS_2D, rawRounds);
  }, [rounds]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.ACTIVE_ROUND_ID_2D, activeRoundId);
  }, [activeRoundId]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.VOUCHERS_2D, rawVouchers);
  }, [vouchers]);

  useEffect(() => {
    saveStoredData(STORAGE_KEYS.FORWARD_SLIPS_2D, rawForwardSlips);
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

  // Keep activeRoundId state in sync with activeRound?.id
  useEffect(() => {
    if (activeRound?.id && activeRound.id !== activeRoundId) {
      setActiveRoundIdState(activeRound.id);
    }
  }, [activeRound?.id, activeRoundId]);

  const activeRoundVouchers = useMemo(() => {
    const curRoundId = activeRound?.id || activeRoundId;
    return vouchers.filter(v =>
      (v.roundId === curRoundId || (v.roundId === activeRoundId && activeRoundId)) &&
      v.status !== 'cancelled' &&
      !v.deletedAt
    );
  }, [vouchers, activeRound?.id, activeRoundId]);

  const activeRoundForwardSlips = useMemo(() => {
    const curRoundId = activeRound?.id || activeRoundId;
    return forwardSlips.filter(f =>
      f.roundId === curRoundId || (f.roundId === activeRoundId && activeRoundId)
    );
  }, [forwardSlips, activeRound?.id, activeRoundId]);

  const updateSettings = useCallback((newSettings: Partial<TwoDAppSettings>) => {
    setSettingsState(prev => ({ ...prev, ...newSettings }));
    // Synchronize multiplier and commission into open rounds so calculations immediately reflect Settings
    setRounds(prev => prev.map(r => {
      if (r.status === 'open') {
        return {
          ...r,
          multiplier: typeof newSettings.defaultMultiplier === 'number' && newSettings.defaultMultiplier > 0
            ? newSettings.defaultMultiplier
            : r.multiplier,
          commissionRate: typeof newSettings.defaultCommissionRate === 'number'
            ? newSettings.defaultCommissionRate
            : r.commissionRate
        };
      }
      return r;
    }));
  }, []);

  const setActiveRoundId = useCallback((id: string) => {
    setActiveRoundIdState(id);
  }, []);

  const createRound = useCallback((roundData: Omit<TwoDDrawRound, 'id'>) => {
    const newRound: TwoDDrawRound = {
      ...roundData,
      multiplier: roundData.multiplier ?? settings.defaultMultiplier,
      commissionRate: roundData.commissionRate ?? settings.defaultCommissionRate,
      id: generateUUID()
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

  const deleteRound = useCallback((roundId: string, reason: string = 'round-deleted') => {
    const nowIso = new Date().toISOString();
    const todayStr = getLocalDateString();
    const updatedRoundsRaw = rawRounds.map(r => r.id === roundId ? ({ ...r, deletedAt: nowIso, deletedReason: reason } as any) : r);
    const remainingRounds = updatedRoundsRaw.filter(r => !(r as any).deletedAt);
    const updatedDeletedRoundIds = [...deletedRoundIds.filter(id => id !== roundId), roundId];

    let nextActiveId = activeRoundId;
    if (activeRoundId === roundId) {
      const todayOpen = remainingRounds.find(r => r.drawDate === todayStr && r.status === 'open' && !is2DRoundClosed(r));
      nextActiveId = todayOpen ? todayOpen.id : (remainingRounds[0]?.id || '');
    }

    const deletedVoucherIds = new Set(rawVouchers.filter(v => v.roundId === roundId).map(v => v.id));

    // Tombstone vouchers for this round
    const updatedVouchers = rawVouchers.map(v =>
      v.roundId === roundId ? ({ ...v, deletedAt: nowIso, deletedReason: reason } as any) : v
    );

    // Tombstone forward slips for this round
    const updatedForwardSlips = rawForwardSlips.map(f =>
      f.roundId === roundId ? ({ ...f, deletedAt: nowIso, deletedReason: reason } as any) : f
    );

    let remainingRawClips: any[] = [];
    try {
      const rawStored = localStorage.getItem('shwe_mingalar_copied_raw_texts');
      if (rawStored) {
        const parsed = JSON.parse(rawStored);
        if (Array.isArray(parsed)) {
          remainingRawClips = parsed.map((c: any) => (c.roundId === roundId && !c.deletedAt) ? ({ ...c, deletedAt: nowIso, deletedReason: reason }) : c);
        }
      }
    } catch {
      // ignore
    }

    let updatedTelegramOrders: any[] = [];
    try {
      const tgStored = localStorage.getItem(TELEGRAM_STORAGE_KEYS.ORDERS);
      if (tgStored) {
        const parsed = JSON.parse(tgStored);
        if (Array.isArray(parsed)) {
          updatedTelegramOrders = parsed.map((o: any) => {
            if (o.voucherId && deletedVoucherIds.has(o.voucherId)) {
              return { ...o, status: 'pending_review', voucherId: undefined };
            }
            return o;
          });
        }
      }
    } catch {
      // ignore
    }

    saveMultipleAtomic({
      [STORAGE_KEYS.ROUNDS_2D]: updatedRoundsRaw,
      '2d_ledger_deleted_rounds_v1': updatedDeletedRoundIds,
      [STORAGE_KEYS.ACTIVE_ROUND_ID_2D]: nextActiveId,
      [STORAGE_KEYS.VOUCHERS_2D]: updatedVouchers,
      [STORAGE_KEYS.FORWARD_SLIPS_2D]: updatedForwardSlips,
      'shwe_mingalar_copied_raw_texts': remainingRawClips,
      [TELEGRAM_STORAGE_KEYS.ORDERS]: updatedTelegramOrders
    });

    setRounds(updatedRoundsRaw);
    setDeletedRoundIds(updatedDeletedRoundIds);
    setActiveRoundIdState(nextActiveId);
    setVouchers(updatedVouchers);
    setForwardSlips(updatedForwardSlips);
  }, [activeRoundId, rawRounds, rawVouchers, rawForwardSlips, deletedRoundIds]);

  const syncLiveRounds = useCallback(async () => {
    // 2D rounds and winning numbers are managed manually by the operator
  }, []);

  const addVoucher = useCallback((voucherData: Omit<TwoDVoucher, 'id' | 'voucherNo' | 'createdAt'>) => {
    assertDateOpen('2D', dateOfRound('2D', voucherData.roundId), 'ဘောင်ချာထည့်ခြင်း');
    if (!(Number(activeRound?.multiplier) > 0)) {
      throw new Error('ပေါက်ကြေးအဆ သတ်မှတ်ထားခြင်း မရှိပါ — Settings တွင် သတ်မှတ်ပါ');
    }
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

    const shortCode = getDeviceShortCode();
    let counter = 1;
    try {
      const storedCount = localStorage.getItem('voucher_counter_2d_v1') || localStorage.getItem('voucher_counter_v1');
      if (storedCount) counter = parseInt(storedCount, 10) + 1;
    } catch {
      // ignore
    }
    const maxExisting = vouchers.reduce((max, v) => {
      const match = v.voucherNo?.match(/\d+$/);
      return match ? Math.max(max, parseInt(match[0], 10)) : max;
    }, 0);
    counter = Math.max(counter, maxExisting + 1);
    localStorage.setItem('voucher_counter_2d_v1', String(counter));
    const pad = String(counter).padStart(6, '0');

    // Never save customerPhone
    const { customerPhone: _discardPhone, ...cleanVoucherData } = voucherData as any;

    const newVoucher: TwoDVoucher = {
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
  }, [vouchers, rounds, settings]);

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

  const updateVoucher = useCallback((id: string, data: Partial<TwoDVoucher>) => {
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
    { const v = vouchers.find(x => x.id === id); if (v) assertDateOpen('2D', dateOfRound('2D', v.roundId), 'ဘောင်ချာဖျက်ခြင်း'); }
    const target = vouchers.find(v => v.id === id);
    if (!target) return;

    const nowIso = new Date().toISOString();

    let updatedVouchers: TwoDVoucher[];
    if (target.isPaid || target.status === 'settled') {
      updatedVouchers = rawVouchers.map(v => v.id === id ? { ...v, status: 'cancelled', deletedReason: reason } : v);
    } else {
      updatedVouchers = rawVouchers.map(v => v.id === id ? { ...v, deletedAt: nowIso, deletedReason: reason } as any : v);
    }

    let remainingRawClips: any[] = [];
    try {
      const rawStored = localStorage.getItem('shwe_mingalar_copied_raw_texts');
      if (rawStored) {
        const parsed = JSON.parse(rawStored);
        if (Array.isArray(parsed)) {
          remainingRawClips = parsed.map((c: any) =>
            ((c.voucherNumber === target.voucherNo || c.voucherNumber === target.id || c.voucherNumber === id) && !c.deletedAt)
              ? ({ ...c, deletedAt: nowIso, deletedReason: reason })
              : c
          );
        }
      }
    } catch {
      // ignore
    }

    let updatedTelegramOrders: any[] = [];
    try {
      const tgStored = localStorage.getItem(TELEGRAM_STORAGE_KEYS.ORDERS);
      if (tgStored) {
        const parsed = JSON.parse(tgStored);
        if (Array.isArray(parsed)) {
          updatedTelegramOrders = parsed.map((o: any) => {
            if (o.voucherId === id || (o.notes && o.notes.includes(target.voucherNo))) {
              return { ...o, status: 'pending_review', voucherId: undefined };
            }
            return o;
          });
        }
      }
    } catch {
      // ignore
    }

    saveMultipleAtomic({
      [STORAGE_KEYS.VOUCHERS_2D]: updatedVouchers,
      'shwe_mingalar_copied_raw_texts': remainingRawClips,
      [TELEGRAM_STORAGE_KEYS.ORDERS]: updatedTelegramOrders
    });
    window.dispatchEvent(new CustomEvent('shwe_raw_clips_updated'));

    setVouchers(updatedVouchers);
  }, [vouchers, rawVouchers]);

  const addForwardSlip = useCallback((slipData: Omit<TwoDForwardSlip, 'id' | 'slipNo' | 'createdAt'>): TwoDForwardSlip => {
    assertDateOpen('2D', dateOfRound('2D', slipData.roundId), 'ဒိုင်လွှဲထည့်ခြင်း');
    const resolvedRoundId = (slipData.roundId && slipData.roundId !== 'default') ? slipData.roundId : activeRoundId;
    const targetRound = rounds.find(r => r.id === resolvedRoundId);
    if (!targetRound || targetRound.status !== 'open' || is2DRoundClosed(targetRound)) {
      throw new Error('ထီပွဲစဉ် ပိတ်သွားပြီဖြစ်သဖြင့် အထက်ဒိုင်ဆီ လွှဲတင်၍ မရတော့ပါ');
    }

    const shortCode = getDeviceShortCode();
    let counter = 1;
    try {
      const storedCount = localStorage.getItem('forward_counter_2d_v1') || localStorage.getItem('forward_counter_v1');
      if (storedCount) counter = parseInt(storedCount, 10) + 1;
    } catch {
      // ignore
    }
    localStorage.setItem('forward_counter_2d_v1', String(counter));
    const pad = String(counter).padStart(6, '0');

    const commRate = slipData.commissionRate ?? settings.defaultCommissionRate;
    if (!Number.isFinite(commRate)) throw new Error('ကော်မရှင်နှုန်း သတ်မှတ်ထားခြင်း မရှိပါ — Settings တွင် သတ်မှတ်ပါ');
    const commAmt = safeRound((slipData.totalAmount * commRate) / 100);
    const netPaid = safeRound(slipData.totalAmount - commAmt);

    const newSlip: TwoDForwardSlip = {
      ...slipData,
      roundId: resolvedRoundId,
      commissionRate: commRate,
      commissionAmount: commAmt,
      netPaid,
      id: generateUUID(),
      slipNo: `${shortCode}-FWD2D-${pad}`,
      createdAt: new Date().toISOString(),
      upperCommissionRate: commRate,
      snapshotSource: 'created'
    };
    setForwardSlips(prev => [newSlip, ...prev]);
    return newSlip;
  }, [forwardSlips, settings.defaultCommissionRate, activeRoundId, rounds]);

  const deleteForwardSlip = useCallback((id: string, reason: string = 'user-deleted') => {
    const nowIso = new Date().toISOString();
    const updated = rawForwardSlips.map(f => f.id === id ? { ...f, deletedAt: nowIso, deletedReason: reason } as any : f);
    saveMultipleAtomic({
      [STORAGE_KEYS.FORWARD_SLIPS_2D]: updated
    });
    setForwardSlips(updated);
  }, [rawForwardSlips]);

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
    const mult = normalizeTwoDMultiplier(activeRound?.multiplier || settings.defaultMultiplier);
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
    let masterPayout = 0;
    let retainedPayout = 0;
    let totalWinnersCount = 0;

    if (activeRound?.winningNumber) {
      let mult = activeRound.multiplier || settings.defaultMultiplier;
      const formattedNum = activeRound.winningNumber.padStart(2, '0');
      const evalResult = evaluateTwoDWinnings(activeRoundVouchers, formattedNum, mult);
      totalWinnersCount = evalResult.totalWinnersCount;
      totalPayout = evalResult.totalPayout;

      // ဒိုင်လွှဲ စနစ်: ဒိုင်ကြီးဆီ လွှဲထားသော ဂဏန်းပေါက်ပါက ဒိုင်ကြီးဆီမှ ပေါက်ကြေး ပြန်ရသည်။
      const winningAgg = aggregates[formattedNum];
      const forwardedWonAmount = winningAgg ? winningAgg.forwardedAmount : 0;
      masterPayout = mult > 0 ? forwardedWonAmount * mult : 0;
      const retainedAmount = winningAgg ? Math.max(0, winningAgg.retainedAmount) : 0;
      retainedPayout = mult > 0 ? retainedAmount * mult : 0;
    }

    const netPaid = safeRound(totalForwarded - forwardedCommission);
    // ဒိုင်အသားတင် အမြတ်/အရှုံး = Customer Net Revenue - Net Paid to Master Bookie - Total Payout + Master Payout
    const netProfit = safeRound(netRevenue - netPaid - totalPayout + masterPayout);

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
    assertDateOpen('2D', dateOfRound('2D', activeRoundId), 'ပေါက်ဂဏန်း သတ်မှတ်ခြင်း');
    if (!activeRound) return;
    if (!(Number(multiplier ?? activeRound.multiplier) > 0)) {
      throw new Error('ပေါက်ကြေးအဆ သတ်မှတ်ထားခြင်း မရှိပါ — Settings တွင် သတ်မှတ်ပါ');
    }

    // Duplicate Protection: Prevent duplicate settlement calls
    const fp = generateSubmissionFingerprint('2D_SETTLE_ROUND', { activeRoundId: activeRound.id, winningNum, multiplier });
    if (isDuplicateSubmission(fp, 5000)) {
      console.warn('Duplicate 2D settlement attempt blocked!');
      return;
    }

    let mult = multiplier || activeRound.multiplier || settings.defaultMultiplier;
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

    // Update forward slips with actualPayout (Master Agent Payout)
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

    try {
      triggerRibbonsCelebration();
    } catch {
      // Safe fail
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

    // Clear forward slips actualPayout
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
      if (Array.isArray(data.vouchers)) {
        setVouchers(data.vouchers);
      }
      if (Array.isArray(data.forwardSlips)) setForwardSlips(data.forwardSlips);
      if (data.limits && typeof data.limits === 'object') setLimits(data.limits);
      if (data.blockedNumbers && typeof data.blockedNumbers === 'object') setBlockedNumbers(data.blockedNumbers);

      return true;
    } catch (err) {
      console.error('Failed to import 2D backup:', err);
      return false;
    }
  }, []);

  const importRoundWithVouchers = useCallback((roundData: Omit<TwoDDrawRound, 'id'>, importedVouchers: TwoDVoucher[]) => {
    const existingRound = rounds.find(r => r.drawDate === roundData.drawDate && (!roundData.session || r.session === roundData.session));
    const targetRoundId = existingRound ? existingRound.id : `2d-round-imp-${Date.now()}`;

    if (!existingRound) {
      const newRound: TwoDDrawRound = {
        ...roundData,
        id: targetRoundId
      };
      setRounds(prev => [newRound, ...prev]);
    }
    setActiveRoundIdState(targetRoundId);

    const stampedVouchers = importedVouchers.map((v, idx) => ({
      ...v,
      id: v.id || `v-2d-imp-${targetRoundId}-${idx}-${Date.now()}`,
      roundId: targetRoundId
    }));

    setVouchers(prev => merge2DVouchersNoDuplicates(prev, stampedVouchers).merged);

    if (roundData.winningNumber && roundData.status === 'settled') {
      setTimeout(() => {
        settleWinningNumber(roundData.winningNumber!, roundData.multiplier);
      }, 100);
    }
  }, [rounds, settleWinningNumber]);

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
        importJSONBackup,
        importRoundWithVouchers
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
