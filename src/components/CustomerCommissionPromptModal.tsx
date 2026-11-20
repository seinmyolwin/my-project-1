import React, { useState, useMemo, useEffect } from 'react';
import { Percent, Users, Building2, CheckCircle2, X, Calculator } from 'lucide-react';
import { formatAmount } from '../utils/lotteryUtils';
import { getVoucherGrossTurnover } from '../utils/statementUtils';
import {
  CommissionBusinessMode,
  ModeCommissionBulkEntry,
  inferModeFromRoundKey,
  getCustomerCommissionRatesByMode,
  getAllRoundCustomerCommissions,
  setBulkRoundAndGlobalCustomerCommissionsByMode,
  getUplineCommissionRatesByMode,
  getAllRoundUplineCommissions,
  setBulkRoundAndGlobalUplineCommissionsByMode
} from '../utils/commissionUtils';

export interface CommissionPromptRecordInput {
  id: string;
  mode?: CommissionBusinessMode;
  name?: string;
  date?: string;
  vouchersList?: any[];
  forwardList?: any[];
}

interface CustomerCommissionPromptModalProps {
  isOpen: boolean;
  records: CommissionPromptRecordInput[];
  currency: string;
  defaultFallbackRate: number;
  defaultUplineFallbackRate?: number;
  defaultFallbackRatesByMode?: Partial<Record<CommissionBusinessMode, number>>;
  defaultUplineFallbackRatesByMode?: Partial<Record<CommissionBusinessMode, number>>;
  title?: string;
  subtitle?: string;
  onConfirm: () => void;
  onClose?: () => void;
}

interface CustomerAggregate {
  key: string; // `${mode}::${name}`
  mode: CommissionBusinessMode;
  name: string;
  vouchersCount: number;
  turnover: number;
  roundKeys: string[];
  voucherRateHint?: number;
}

interface UplineAgentAggregate {
  key: string; // `${mode}::${name}`
  mode: CommissionBusinessMode;
  name: string;
  slipsCount: number;
  forwardedAmount: number;
  slipRate?: number;
  roundKeys: string[];
}

const getBusinessBadge = (mode: CommissionBusinessMode): { label: string; cls: string } => {
  if (mode === '2d') {
    return { label: 'ဇီးကွက် (2D)', cls: 'bg-teal-100 text-teal-900 border-teal-200' };
  }
  if (mode === '3d') {
    return { label: 'အိုးစည်လေး (3D)', cls: 'bg-slate-200 text-slate-900 border-slate-300' };
  }
  return { label: 'ပစ်တိုင်းထောင်', cls: 'bg-emerald-100 text-emerald-900 border-emerald-200' };
};

export const CustomerCommissionPromptModal: React.FC<CustomerCommissionPromptModalProps> = ({
  isOpen,
  records,
  currency,
  defaultFallbackRate,
  defaultUplineFallbackRate = 0,
  defaultFallbackRatesByMode,
  defaultUplineFallbackRatesByMode,
  title,
  subtitle,
  onConfirm,
  onClose
}) => {
  const [sectionTab, setSectionTab] = useState<'both' | 'downline' | 'upline'>('both');

  const getDownlineFallbackForMode = (mode: CommissionBusinessMode): number => {
    const byModeVal = defaultFallbackRatesByMode?.[mode];
    return typeof byModeVal === 'number' ? byModeVal : (defaultFallbackRate ?? 0);
  };

  const getUplineFallbackForMode = (mode: CommissionBusinessMode): number => {
    const byModeVal = defaultUplineFallbackRatesByMode?.[mode];
    return typeof byModeVal === 'number' ? byModeVal : (defaultUplineFallbackRate ?? 0);
  };

  const customers: CustomerAggregate[] = useMemo(() => {
    const map = new Map<string, CustomerAggregate>();
    records.forEach((rec) => {
      const recMode = rec.mode ?? inferModeFromRoundKey(rec.id);
      (rec.vouchersList || []).forEach((v: any) => {
        if (!v || v.status === 'cancelled' || v.deletedAt) return;
        const custName = (v.customerName || 'အထွေထွေ').trim();
        const key = `${recMode}::${custName}`;
        const amt = Array.isArray(v.items) || v.subtotal !== undefined
          ? getVoucherGrossTurnover(v)
          : (Number(v.stakeAmount) || Number(v.netPayable) || 0);
        const voucherHint =
          recMode !== '3d' && typeof v.discountPercent === 'number' && v.discountPercent > 0
            ? v.discountPercent
            : undefined;
        const existing = map.get(key);
        if (existing) {
          existing.vouchersCount += 1;
          existing.turnover += amt;
          if (rec.id && !existing.roundKeys.includes(rec.id)) {
            existing.roundKeys.push(rec.id);
          }
          if (existing.voucherRateHint === undefined && voucherHint !== undefined) {
            existing.voucherRateHint = voucherHint;
          }
        } else {
          map.set(key, {
            key,
            mode: recMode,
            name: custName,
            vouchersCount: 1,
            turnover: amt,
            roundKeys: rec.id ? [rec.id] : [],
            voucherRateHint: voucherHint
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.turnover - a.turnover);
  }, [records]);

  const uplineAgents: UplineAgentAggregate[] = useMemo(() => {
    const map = new Map<string, UplineAgentAggregate>();
    records.forEach((rec) => {
      const recMode = rec.mode ?? inferModeFromRoundKey(rec.id);
      (rec.forwardList || []).forEach((f: any) => {
        if (!f || f.deletedAt) return;
        const agentName = (f.masterAgentName || 'ဒိုင်ချုပ်ကြီး').trim();
        const key = `${recMode}::${agentName}`;
        const amt = Number(f.totalAmount ?? f.stakeAmount ?? 0) || 0;
        const slipRate = typeof f.commissionRate === 'number' && f.commissionRate >= 0 ? f.commissionRate : undefined;
        const existing = map.get(key);
        if (existing) {
          existing.slipsCount += 1;
          existing.forwardedAmount += amt;
          if (rec.id && !existing.roundKeys.includes(rec.id)) {
            existing.roundKeys.push(rec.id);
          }
          if (existing.slipRate === undefined && slipRate !== undefined) {
            existing.slipRate = slipRate;
          }
        } else {
          map.set(key, {
            key,
            mode: recMode,
            name: agentName,
            slipsCount: 1,
            forwardedAmount: amt,
            slipRate,
            roundKeys: rec.id ? [rec.id] : []
          });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.forwardedAmount - a.forwardedAmount);
  }, [records]);

  const [draftRates, setDraftRates] = useState<Record<string, string>>({});
  const [draftUplineRates, setDraftUplineRates] = useState<Record<string, string>>({});

  const stableScopeKey = useMemo(
    () =>
      `${records.map((r) => r.id).join('|')}::${customers.map((c) => c.key).join('|')}::${uplineAgents.map((a) => a.key).join('|')}`,
    [records, customers, uplineAgents]
  );

  useEffect(() => {
    if (!isOpen) return;
    setSectionTab('both');

    const globalRatesByMode = getCustomerCommissionRatesByMode();
    const allRoundRates = getAllRoundCustomerCommissions();
    const initialCustomer: Record<string, string> = {};

    customers.forEach((c) => {
      let resolved: number | undefined;
      for (const rk of c.roundKeys) {
        const rRate = allRoundRates[rk]?.[c.name];
        if (rRate !== undefined) {
          resolved = rRate;
          break;
        }
      }
      if (resolved === undefined && globalRatesByMode[c.mode]?.[c.name] !== undefined) {
        resolved = globalRatesByMode[c.mode][c.name];
      }
      if (resolved === undefined && c.voucherRateHint !== undefined && c.voucherRateHint > 0) {
        resolved = c.voucherRateHint;
      }
      initialCustomer[c.key] = String(
        resolved !== undefined ? resolved : getDownlineFallbackForMode(c.mode)
      );
    });
    setDraftRates(initialCustomer);

    const globalUplineByMode = getUplineCommissionRatesByMode();
    const allRoundUpline = getAllRoundUplineCommissions();
    const initialUpline: Record<string, string> = {};

    uplineAgents.forEach((a) => {
      let resolved: number | undefined;
      for (const rk of a.roundKeys) {
        const rRate = allRoundUpline[rk]?.[a.name];
        if (rRate !== undefined) {
          resolved = rRate;
          break;
        }
      }
      if (resolved === undefined && globalUplineByMode[a.mode]?.[a.name] !== undefined) {
        resolved = globalUplineByMode[a.mode][a.name];
      }
      if (resolved === undefined && a.slipRate !== undefined && a.slipRate > 0) {
        resolved = a.slipRate;
      }
      initialUpline[a.key] = String(
        resolved !== undefined ? resolved : getUplineFallbackForMode(a.mode)
      );
    });
    setDraftUplineRates(initialUpline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, stableScopeKey]);

  const parseRate = (map: Record<string, string>, key: string): number => {
    const raw = map[key];
    if (raw === undefined || raw === '') return 0;
    const num = parseFloat(raw);
    if (isNaN(num) || num < 0) return 0;
    return Math.min(100, num);
  };

  const totals = useMemo(() => {
    let totalTurnover = 0;
    let totalCommission = 0;
    customers.forEach((c) => {
      const rate = parseRate(draftRates, c.key);
      const comm = rate > 0 ? Math.round((c.turnover * rate) / 100) : 0;
      totalTurnover += c.turnover;
      totalCommission += comm;
    });

    let totalForwarded = 0;
    let totalUplineCommission = 0;
    uplineAgents.forEach((a) => {
      const rate = parseRate(draftUplineRates, a.key);
      const comm = rate > 0 ? Math.round((a.forwardedAmount * rate) / 100) : 0;
      totalForwarded += a.forwardedAmount;
      totalUplineCommission += comm;
    });

    return { totalTurnover, totalCommission, totalForwarded, totalUplineCommission };
  }, [customers, draftRates, uplineAgents, draftUplineRates]);

  const handleSetAllCustomers = (rate: number) => {
    const next: Record<string, string> = {};
    customers.forEach((c) => {
      next[c.key] = String(rate);
    });
    setDraftRates(next);
  };

  const handleSetAllCustomersToSettings = () => {
    const next: Record<string, string> = {};
    customers.forEach((c) => {
      next[c.key] = String(getDownlineFallbackForMode(c.mode));
    });
    setDraftRates(next);
  };

  const handleSetAllUplines = (rate: number) => {
    const next: Record<string, string> = {};
    uplineAgents.forEach((a) => {
      next[a.key] = String(rate);
    });
    setDraftUplineRates(next);
  };

  const handleSetAllUplinesToSettings = () => {
    const next: Record<string, string> = {};
    uplineAgents.forEach((a) => {
      next[a.key] = String(getUplineFallbackForMode(a.mode));
    });
    setDraftUplineRates(next);
  };

  const handleConfirm = () => {
    if (customers.length > 0) {
      const entriesByRoundAndMode = new Map<string, ModeCommissionBulkEntry>();
      const globalOnlyByMode = new Map<CommissionBusinessMode, Record<string, number>>();

      customers.forEach((c) => {
        const rateVal = parseRate(draftRates, c.key);
        globalOnlyByMode.set(c.mode, {
          ...(globalOnlyByMode.get(c.mode) || {}),
          [c.name]: rateVal
        });
        c.roundKeys.forEach((rk) => {
          const entryId = `${c.mode}::${rk}`;
          const existing = entriesByRoundAndMode.get(entryId);
          if (existing) {
            existing.rates[c.name] = rateVal;
          } else {
            entriesByRoundAndMode.set(entryId, {
              roundKey: rk,
              mode: c.mode,
              rates: { [c.name]: rateVal }
            });
          }
        });
      });

      const entries: ModeCommissionBulkEntry[] = Array.from(entriesByRoundAndMode.values());
      // Ensure global mode rates are saved even if any customer lacked a roundKey
      globalOnlyByMode.forEach((ratesMap, mode) => {
        if (!entries.some((e) => e.mode === mode)) {
          entries.push({ mode, rates: ratesMap });
        }
      });

      setBulkRoundAndGlobalCustomerCommissionsByMode(entries);
    }

    if (uplineAgents.length > 0) {
      const entriesByRoundAndMode = new Map<string, ModeCommissionBulkEntry>();
      const globalOnlyByMode = new Map<CommissionBusinessMode, Record<string, number>>();

      uplineAgents.forEach((a) => {
        const rateVal = parseRate(draftUplineRates, a.key);
        globalOnlyByMode.set(a.mode, {
          ...(globalOnlyByMode.get(a.mode) || {}),
          [a.name]: rateVal
        });
        a.roundKeys.forEach((rk) => {
          const entryId = `${a.mode}::${rk}`;
          const existing = entriesByRoundAndMode.get(entryId);
          if (existing) {
            existing.rates[a.name] = rateVal;
          } else {
            entriesByRoundAndMode.set(entryId, {
              roundKey: rk,
              mode: a.mode,
              rates: { [a.name]: rateVal }
            });
          }
        });
      });

      const entries: ModeCommissionBulkEntry[] = Array.from(entriesByRoundAndMode.values());
      globalOnlyByMode.forEach((ratesMap, mode) => {
        if (!entries.some((e) => e.mode === mode)) {
          entries.push({ mode, rates: ratesMap });
        }
      });

      setBulkRoundAndGlobalUplineCommissionsByMode(entries);
    }

    onConfirm();
  };

  if (!isOpen) return null;

  const customerPresets = [0, 10, 15, 20];
  const hasAnyDownlineSettingsFallback =
    defaultFallbackRate > 0 ||
    Object.values(defaultFallbackRatesByMode || {}).some((v) => typeof v === 'number' && v > 0);
  const distinctCustomerModes = new Set(customers.map((c) => c.mode));

  const uplinePresets = [0, 10, 12, 13, 15];
  const hasAnyUplineSettingsFallback =
    defaultUplineFallbackRate > 0 ||
    Object.values(defaultUplineFallbackRatesByMode || {}).some((v) => typeof v === 'number' && v > 0);
  const distinctUplineModes = new Set(uplineAgents.map((a) => a.mode));

  const showDownline = sectionTab === 'both' || sectionTab === 'downline';
  const showUpline = (sectionTab === 'both' || sectionTab === 'upline') && uplineAgents.length > 0;

  return (
    <div className="fixed inset-0 z-[75] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-5 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <Percent className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white leading-tight truncate">
                {title || 'ထိုးသားကော် / အထက်ဒိုင်ကော် သတ်မှတ်ရန်'}
              </h3>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {subtitle ||
                  `ထိုးသား ${customers.length} စာရင်း${uplineAgents.length > 0 ? ` • အထက်ဒိုင် ${uplineAgents.length} စာရင်း` : ''} ၏ ကော်မရှင် (%) ကို လုပ်ငန်းအလိုက် အတည်ပြုပြီးမှ ရှင်းတမ်းတွက်မည်`}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Compact Section Switcher (only when upline agents exist) */}
        {uplineAgents.length > 0 && (
          <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0">
            <button
              type="button"
              onClick={() => setSectionTab('both')}
              className={`px-3 py-1 rounded-lg text-[11px] font-black transition-all cursor-pointer shrink-0 ${
                sectionTab === 'both'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              အားလုံး ({customers.length + uplineAgents.length})
            </button>
            <button
              type="button"
              onClick={() => setSectionTab('downline')}
              className={`px-3 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                sectionTab === 'downline'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white text-amber-900 border border-amber-200 hover:bg-amber-50'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>ထိုးသားကော် ({customers.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSectionTab('upline')}
              className={`px-3 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer shrink-0 ${
                sectionTab === 'upline'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-50'
              }`}
            >
              <Building2 className="w-3 h-3" />
              <span>အထက်ဒိုင်ကော် ({uplineAgents.length})</span>
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-4 flex-1 bg-slate-50/50">
          {/* Downline Customers Section */}
          {showDownline && (
            <div className="space-y-2.5">
              <div className="bg-amber-50/90 border border-amber-200 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-black text-amber-950 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-700" />
                  <span>ထိုးသားကော် (အောက်လက်) — {customers.length} ခု</span>
                </span>
                {customers.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleSetAllCustomers(0)}
                      className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded-lg text-[10px] cursor-pointer"
                    >
                      အားလုံး 0%
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllCustomers(15)}
                      className="px-2 py-0.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold rounded-lg text-[10px] cursor-pointer"
                    >
                      15%
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSetAllCustomers(20)}
                      className="px-2 py-0.5 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold rounded-lg text-[10px] cursor-pointer"
                    >
                      20%
                    </button>
                    {hasAnyDownlineSettingsFallback && (
                      <button
                        type="button"
                        onClick={handleSetAllCustomersToSettings}
                        className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-800 font-bold rounded-lg text-[10px] cursor-pointer"
                      >
                        {distinctCustomerModes.size <= 1
                          ? `Settings (${getDownlineFallbackForMode(customers[0]?.mode || '3d')}%)`
                          : 'Settings နှုန်း'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {customers.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs font-bold bg-white rounded-2xl border border-slate-200">
                  ဤကာလ/ပွဲစဉ်အတွင်း ထိုးသားစာရင်း မရှိသေးပါ
                </div>
              ) : (
                customers.map((c, idx) => {
                  const rate = parseRate(draftRates, c.key);
                  const commAmt = rate > 0 ? Math.round((c.turnover * rate) / 100) : 0;
                  const badge = getBusinessBadge(c.mode);
                  return (
                    <div
                      key={c.key}
                      className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-black text-sm text-slate-900 truncate">{c.name}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${badge.cls}`}>
                            {badge.label}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">
                            {c.vouchersCount} စောင်
                          </span>
                        </div>
                        <div className="mt-1 pl-7 flex items-center gap-3 text-xs font-mono">
                          <span className="text-slate-600">
                            ထိုးကြေး: <b className="text-slate-900">{formatAmount(c.turnover, currency)}</b>
                          </span>
                          <span className={commAmt > 0 ? 'text-amber-700 font-bold' : 'text-slate-400 font-bold'}>
                            {commAmt > 0
                              ? `ကော်: -${formatAmount(commAmt, currency)}`
                              : 'ကော်: 0 (မပေး)'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pl-7 sm:pl-0 shrink-0 flex-wrap">
                        {customerPresets.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setDraftRates((prev) => ({ ...prev, [c.key]: String(p) }))}
                            className={`px-2 py-1 rounded-lg text-[11px] font-mono font-black border transition-all cursor-pointer ${
                              rate === p
                                ? p === 0
                                  ? 'bg-slate-800 text-white border-slate-800'
                                  : 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {p}%
                          </button>
                        ))}
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={draftRates[c.key] ?? '0'}
                            onChange={(e) =>
                              setDraftRates((prev) => ({ ...prev, [c.key]: e.target.value }))
                            }
                            className="w-16 bg-slate-50 border border-slate-300 focus:border-amber-500 focus:bg-white rounded-lg px-2 py-1 pr-5 text-xs font-mono font-black text-right text-slate-900 outline-none"
                          />
                          <span className="absolute right-1.5 text-[10px] font-bold text-slate-400 pointer-events-none">
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Upline Master Dealers Section */}
          {showUpline && (
            <div className="space-y-2.5">
              <div className="bg-indigo-50/90 border border-indigo-200 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-black text-indigo-950 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-700" />
                  <span>အထက်ဒိုင်ကော် (လွှဲတင်ဒိုင်) — {uplineAgents.length} ခု</span>
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSetAllUplines(0)}
                    className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded-lg text-[10px] cursor-pointer"
                  >
                    0%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllUplines(12)}
                    className="px-2 py-0.5 bg-white hover:bg-indigo-100 border border-indigo-300 text-indigo-900 font-bold rounded-lg text-[10px] cursor-pointer"
                  >
                    12%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllUplines(13)}
                    className="px-2 py-0.5 bg-white hover:bg-indigo-100 border border-indigo-300 text-indigo-900 font-bold rounded-lg text-[10px] cursor-pointer"
                  >
                    13%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAllUplines(15)}
                    className="px-2 py-0.5 bg-white hover:bg-indigo-100 border border-indigo-300 text-indigo-900 font-bold rounded-lg text-[10px] cursor-pointer"
                  >
                    15%
                  </button>
                  {hasAnyUplineSettingsFallback && (
                    <button
                      type="button"
                      onClick={handleSetAllUplinesToSettings}
                      className="px-2 py-0.5 bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 text-indigo-900 font-bold rounded-lg text-[10px] cursor-pointer"
                    >
                      {distinctUplineModes.size <= 1
                        ? `Settings (${getUplineFallbackForMode(uplineAgents[0]?.mode || '3d')}%)`
                        : 'Settings နှုန်း'}
                    </button>
                  )}
                </div>
              </div>

              {uplineAgents.map((a, idx) => {
                const rate = parseRate(draftUplineRates, a.key);
                const commAmt = rate > 0 ? Math.round((a.forwardedAmount * rate) / 100) : 0;
                const badge = getBusinessBadge(a.mode);
                return (
                  <div
                    key={a.key}
                    className="bg-white border border-indigo-200/80 rounded-2xl p-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-800 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-black text-sm text-indigo-950 truncate">{a.name}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-bold">
                          လွှဲစလစ် {a.slipsCount} စောင်
                        </span>
                      </div>
                      <div className="mt-1 pl-7 flex items-center gap-3 text-xs font-mono">
                        <span className="text-slate-600">
                          တင်ကြေး: <b className="text-indigo-950">{formatAmount(a.forwardedAmount, currency)}</b>
                        </span>
                        <span className={commAmt > 0 ? 'text-emerald-700 font-bold' : 'text-slate-400 font-bold'}>
                          {commAmt > 0
                            ? `ရမည့်ကော်: +${formatAmount(commAmt, currency)}`
                            : 'ကော်: 0'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pl-7 sm:pl-0 shrink-0 flex-wrap">
                      {uplinePresets.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setDraftUplineRates((prev) => ({ ...prev, [a.key]: String(p) }))}
                          className={`px-2 py-1 rounded-lg text-[11px] font-mono font-black border transition-all cursor-pointer ${
                            rate === p
                              ? p === 0
                                ? 'bg-slate-800 text-white border-slate-800'
                                : 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {p}%
                        </button>
                      ))}
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={draftUplineRates[a.key] ?? '0'}
                          onChange={(e) =>
                            setDraftUplineRates((prev) => ({ ...prev, [a.key]: e.target.value }))
                          }
                          className="w-16 bg-slate-50 border border-indigo-300 focus:border-indigo-500 focus:bg-white rounded-lg px-2 py-1 pr-5 text-xs font-mono font-black text-right text-slate-900 outline-none"
                        />
                        <span className="absolute right-1.5 text-[10px] font-bold text-slate-400 pointer-events-none">
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sectionTab === 'upline' && uplineAgents.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-xs font-bold bg-white rounded-2xl border border-slate-200">
              ဤကာလ/ပွဲစဉ်အတွင်း အထက်ဒိုင် လွှဲစလစ် မရှိသေးပါ
            </div>
          )}
        </div>

        {/* Footer Totals + Confirm */}
        <div className="bg-slate-900 text-white px-4 sm:px-5 py-3.5 border-t border-slate-800 shrink-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-slate-400">အောက်လက်ကော်: </span>
              <span className="font-mono font-black text-amber-400">
                -{formatAmount(totals.totalCommission, currency)}
              </span>
              <span className="text-[10px] text-slate-400 ml-1">
                ({formatAmount(totals.totalTurnover, currency)})
              </span>
            </div>
            {uplineAgents.length > 0 && (
              <div>
                <span className="text-slate-400">အထက်ဒိုင်ကော်: </span>
                <span className="font-mono font-black text-emerald-400">
                  +{formatAmount(totals.totalUplineCommission, currency)}
                </span>
                <span className="text-[10px] text-slate-400 ml-1">
                  ({formatAmount(totals.totalForwarded, currency)})
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                ပိတ်မည်
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black rounded-xl flex items-center gap-2 cursor-pointer shadow-md transition-colors"
            >
              <Calculator className="w-4 h-4" />
              <span>အတည်ပြုပြီး စာရင်းရှင်းတမ်း တွက်ချက်မည်</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
