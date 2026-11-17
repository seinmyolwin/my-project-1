import React, { useState, useMemo, useEffect } from 'react';
import { Percent, Users, CheckCircle2, X, Calculator } from 'lucide-react';
import { formatAmount } from '../utils/lotteryUtils';
import { getVoucherGrossTurnover } from '../utils/statementUtils';
import {
  getCustomerCommissionRates,
  getAllRoundCustomerCommissions,
  setBulkRoundAndGlobalCustomerCommissions
} from '../utils/commissionUtils';

export interface CommissionPromptRecordInput {
  id: string;
  name?: string;
  date?: string;
  vouchersList?: any[];
}

interface CustomerCommissionPromptModalProps {
  isOpen: boolean;
  records: CommissionPromptRecordInput[];
  currency: string;
  defaultFallbackRate: number;
  title?: string;
  subtitle?: string;
  onConfirm: () => void;
  onClose?: () => void;
}

interface CustomerAggregate {
  name: string;
  vouchersCount: number;
  turnover: number;
}

export const CustomerCommissionPromptModal: React.FC<CustomerCommissionPromptModalProps> = ({
  isOpen,
  records,
  currency,
  defaultFallbackRate,
  title,
  subtitle,
  onConfirm,
  onClose
}) => {
  const customers: CustomerAggregate[] = useMemo(() => {
    const map = new Map<string, CustomerAggregate>();
    records.forEach((rec) => {
      (rec.vouchersList || []).forEach((v: any) => {
        if (!v || v.status === 'cancelled' || v.deletedAt) return;
        const custName = (v.customerName || 'အထွေထွေ').trim();
        const amt = Array.isArray(v.items) || v.subtotal !== undefined
          ? getVoucherGrossTurnover(v)
          : (Number(v.stakeAmount) || Number(v.netPayable) || 0);
        const existing = map.get(custName);
        if (existing) {
          existing.vouchersCount += 1;
          existing.turnover += amt;
        } else {
          map.set(custName, { name: custName, vouchersCount: 1, turnover: amt });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.turnover - a.turnover);
  }, [records]);

  const [draftRates, setDraftRates] = useState<Record<string, string>>({});

  const stableScopeKey = useMemo(
    () => `${records.map((r) => r.id).join('|')}::${customers.map((c) => c.name).join('|')}`,
    [records, customers]
  );

  useEffect(() => {
    if (!isOpen) return;
    const globalRates = getCustomerCommissionRates();
    const allRoundRates = getAllRoundCustomerCommissions();
    const initial: Record<string, string> = {};

    customers.forEach((c) => {
      let resolved: number | undefined;
      for (const rec of records) {
        const rRate = allRoundRates[rec.id]?.[c.name];
        if (rRate !== undefined) {
          resolved = rRate;
          break;
        }
      }
      if (resolved === undefined && globalRates[c.name] !== undefined) {
        resolved = globalRates[c.name];
      }
      initial[c.name] = String(resolved !== undefined ? resolved : 0);
    });

    setDraftRates(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, stableScopeKey]);

  const parseRate = (name: string): number => {
    const raw = draftRates[name];
    if (raw === undefined || raw === '') return 0;
    const num = parseFloat(raw);
    if (isNaN(num) || num < 0) return 0;
    return Math.min(100, num);
  };

  const totals = useMemo(() => {
    let totalTurnover = 0;
    let totalCommission = 0;
    customers.forEach((c) => {
      const rate = parseRate(c.name);
      const comm = rate > 0 ? Math.round((c.turnover * rate) / 100) : 0;
      totalTurnover += c.turnover;
      totalCommission += comm;
    });
    return { totalTurnover, totalCommission };
  }, [customers, draftRates]);

  const handleSetAll = (rate: number) => {
    const next: Record<string, string> = {};
    customers.forEach((c) => {
      next[c.name] = String(rate);
    });
    setDraftRates(next);
  };

  const handleConfirm = () => {
    const numericRates: Record<string, number> = {};
    customers.forEach((c) => {
      numericRates[c.name] = parseRate(c.name);
    });
    const roundKeys = records.map((r) => r.id).filter(Boolean);
    setBulkRoundAndGlobalCustomerCommissions(roundKeys, numericRates);
    onConfirm();
  };

  if (!isOpen) return null;

  const quickPresets = [0, 10, 15, 20];
  const extraFallback =
    defaultFallbackRate > 0 && !quickPresets.includes(defaultFallbackRate)
      ? defaultFallbackRate
      : null;

  return (
    <div className="fixed inset-0 z-[75] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-5 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white leading-tight">
                {title || 'ထိုးသား / အောက်လက်ဒိုင် ကော်မရှင် သတ်မှတ်ရန်'}
              </h3>
              <p className="text-[11px] text-slate-300 mt-0.5">
                {subtitle ||
                  `ထိုးထားသူ ${customers.length} ဦး၏ ကော်မရှင် (%) ကို အတည်ပြုပြီးမှ စာရင်းရှင်းတမ်း တွက်ချက်ပါမည်`}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Bulk Action Bar */}
        <div className="bg-amber-50/80 border-b border-amber-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <span className="font-bold text-amber-950 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-700" />
            <span>အမြန်သတ်မှတ်ရန်:</span>
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => handleSetAll(0)}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold rounded-lg text-[11px] cursor-pointer transition-colors"
            >
              အားလုံး 0%
            </button>
            <button
              type="button"
              onClick={() => handleSetAll(15)}
              className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold rounded-lg text-[11px] cursor-pointer transition-colors"
            >
              အားလုံး 15%
            </button>
            <button
              type="button"
              onClick={() => handleSetAll(20)}
              className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold rounded-lg text-[11px] cursor-pointer transition-colors"
            >
              အားလုံး 20%
            </button>
            {extraFallback !== null && (
              <button
                type="button"
                onClick={() => handleSetAll(extraFallback)}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 text-indigo-800 font-bold rounded-lg text-[11px] cursor-pointer transition-colors"
              >
                Settings ({extraFallback}%)
              </button>
            )}
          </div>
        </div>

        {/* Customer List */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 bg-slate-50/50">
          {customers.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-bold">
              ဤကာလ/ပွဲစဉ်အတွင်း ထိုးသားစာရင်း မရှိသေးပါ
            </div>
          ) : (
            customers.map((c, idx) => {
              const rate = parseRate(c.name);
              const commAmt = rate > 0 ? Math.round((c.turnover * rate) / 100) : 0;
              return (
                <div
                  key={c.name}
                  className="bg-white border border-slate-200 rounded-2xl p-3 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-black text-sm text-slate-900 truncate">{c.name}</span>
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
                    {quickPresets.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setDraftRates((prev) => ({ ...prev, [c.name]: String(p) }))}
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
                        value={draftRates[c.name] ?? '0'}
                        onChange={(e) =>
                          setDraftRates((prev) => ({ ...prev, [c.name]: e.target.value }))
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

        {/* Footer Totals + Confirm */}
        <div className="bg-slate-900 text-white px-4 sm:px-5 py-3.5 border-t border-slate-800 shrink-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-slate-400">စုစုပေါင်း ထိုးကြေး: </span>
              <span className="font-mono font-black text-white">
                {formatAmount(totals.totalTurnover, currency)}
              </span>
            </div>
            <div>
              <span className="text-slate-400">တွက်ချက်ရမည့် အောက်လက်ကော်: </span>
              <span className="font-mono font-black text-amber-400 text-sm">
                -{formatAmount(totals.totalCommission, currency)}
              </span>
            </div>
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
