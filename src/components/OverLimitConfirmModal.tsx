import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  ArrowUpRight,
  Shield,
  Scissors,
  Ban,
  Check,
  Building2,
  Percent,
  Phone,
  HelpCircle
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { OverLimitItemInfo, OverLimitAction } from '../types';
import { formatAmount } from '../utils/lotteryUtils';

export type { OverLimitItemInfo, OverLimitAction } from '../types';

interface OverLimitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  items?: OverLimitItemInfo[];
  overLimitItems?: OverLimitItemInfo[];
  customerName?: string;
  onConfirm: (
    decisions: OverLimitItemInfo[],
    masterAgentName: string,
    masterAgentPhone: string,
    commissionRate: number
  ) => void;
}

export const OverLimitConfirmModal: React.FC<OverLimitConfirmModalProps> = ({
  isOpen,
  onClose,
  items,
  overLimitItems,
  customerName = 'အထွေထွေ',
  onConfirm
}) => {
  const effectiveItems = overLimitItems || items || [];
  const { settings } = useLottery();
  const isMyanmar = settings.language === 'my';

  const [decisions, setDecisions] = useState<OverLimitItemInfo[]>([]);
  const [masterName, setMasterName] = useState<string>(
    settings.defaultMasterAgentName || 'ကိုစိုးနိုင် (ဒိုင်ချုပ်ကြီး)'
  );
  const [masterPhone, setMasterPhone] = useState<string>(
    settings.defaultMasterAgentPhone || '09-970001111'
  );
  const [commissionRate, setCommissionRate] = useState<number>(
    settings.defaultCommissionRate || 10
  );

  useEffect(() => {
    if (effectiveItems && effectiveItems.length > 0) {
      // Default action is 'forward_excess' (safest dealer hedging)
      setDecisions(
        effectiveItems.map(item => ({
          ...item,
          action: item.action || 'forward_excess'
        }))
      );
    }
  }, [effectiveItems]);

  if (!isOpen || effectiveItems.length === 0) return null;

  const handleSetAction = (id: string, action: OverLimitAction) => {
    setDecisions(prev =>
      prev.map(d => (d.id === id ? { ...d, action } : d))
    );
  };

  const handleApplyAll = (action: OverLimitAction) => {
    setDecisions(prev => prev.map(d => ({ ...d, action })));
  };

  // Calculations for summary
  let totalRetainedLocally = 0;
  let totalForwardedToMaster = 0;
  let totalRejected = 0;

  decisions.forEach(d => {
    if (d.action === 'forward_excess') {
      totalRetainedLocally += d.remainingQuota;
      totalForwardedToMaster += d.excessAmount;
    } else if (d.action === 'forward_all') {
      totalForwardedToMaster += d.originalAmount;
    } else if (d.action === 'accept_locally') {
      totalRetainedLocally += d.originalAmount;
    } else if (d.action === 'cap_at_limit') {
      totalRetainedLocally += d.remainingQuota;
      totalRejected += d.excessAmount;
    } else if (d.action === 'reject') {
      totalRejected += d.originalAmount;
    }
  });

  const estimatedCommission = Math.round((totalForwardedToMaster * commissionRate) / 100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(decisions, masterName.trim(), masterPhone.trim(), commissionRate);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-amber-50 px-5 py-4 border-b border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>{isMyanmar ? 'သတ်မှတ်ထိုးကြေး (ဘရိတ်) ကျော်လွန်မှု အတည်ပြုချက်' : 'Over-Limit Bet Confirmation'}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                  {decisions.length} {isMyanmar ? 'ဂဏန်း' : 'items'}
                </span>
              </h3>
              <p className="text-xs text-amber-900/80">
                {isMyanmar
                  ? 'သတ်မှတ်ထိုးကြေးထက် ပိုလာသောငွေအား ဒိုင်ကြီးဆီသို့ ဆက်တင်မည် သို့မဟုတ် ကိုယ်တိုင်လက်ခံမည်ကို အတည်ပြုပေးပါ'
                  : 'Bet exceeds individual limit. Choose to forward excess to master agent or absorb locally.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-amber-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Global Quick Action Buttons */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-bold text-slate-700">
              {isMyanmar ? 'အားလုံးအတွက် တစ်ပြိုင်နက် ရွေးချယ်ရန်:' : 'Batch Apply to All:'}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleApplyAll('forward_excess')}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{isMyanmar ? 'အားလုံး ပိုလျှံငွေ ဒိုင်ကြီးဆီတင်မည်' : 'Forward All Excess'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyAll('accept_locally')}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{isMyanmar ? 'အားလုံး ကိုယ်တိုင်လက်ခံမည်' : 'Accept All Locally'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyAll('cap_at_limit')}
                className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>{isMyanmar ? 'အားလုံး ဘရိတ်အထိသာ ဖြတ်မည်' : 'Cap All at Limit'}</span>
              </button>
            </div>
          </div>

          {/* Master Dealer Info Box (if any items to forward) */}
          {totalForwardedToMaster > 0 && (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                <Building2 className="w-4 h-4 text-indigo-700" />
                <span>{isMyanmar ? 'ဒိုင်ကြီး (ဒိုင်ချုပ်) သို့ ဆက်တင်မည့် အချက်အလက်များ' : 'Master Dealer Forwarding Details'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {isMyanmar ? 'ဒိုင်ကြီး အမည်' : 'Master Agent Name'}
                  </label>
                  <input
                    type="text"
                    value={masterName}
                    onChange={(e) => setMasterName(e.target.value)}
                    className="w-full bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-medium outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {isMyanmar ? 'ဖုန်းနံပါတ်' : 'Phone'}
                  </label>
                  <input
                    type="text"
                    value={masterPhone}
                    onChange={(e) => setMasterPhone(e.target.value)}
                    className="w-full bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-medium outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    {isMyanmar ? 'ရရှိမည့် ကော်မရှင် (%)' : 'Commission Rate (%)'}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="0"
                    max="30"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    onFocus={(e) => {
                      const target = e.currentTarget;
                      target.select();
                      setTimeout(() => target.select(), 20);
                    }}
                    onClick={(e) => {
                      const target = e.currentTarget;
                      target.select();
                      setTimeout(() => target.select(), 20);
                    }}
                    className="w-full bg-white border border-indigo-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-bold font-mono outline-none focus:border-indigo-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* List of Over-Limit Items */}
          <div className="space-y-3">
            {decisions.map((item, idx) => {
              const hasQuota = item.remainingQuota > 0;

              return (
                <div
                  key={item.id || idx}
                  className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3 shadow-2xs transition-all hover:border-slate-300"
                >
                  {/* Top Bar: Number and Financial Details */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-slate-400 text-xs w-4">
                        {idx + 1}.
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-950 font-mono font-black text-base border border-indigo-200 tracking-wider">
                        {item.number}
                      </span>
                      {item.isRumble && (
                        <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-bold">
                          Rumble (R)
                        </span>
                      )}
                    </div>

                    {/* Numeric breakdown */}
                    <div className="flex items-center gap-3 sm:gap-4 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isMyanmar ? 'သတ်မှတ်ဘရိတ်' : 'Limit'}</span>
                        <span className="font-mono font-bold text-slate-700">
                          {formatAmount(item.limit, settings.currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isMyanmar ? 'ရောင်းပြီး / လက်ကျန်' : 'Sold / Quota'}</span>
                        <span className="font-mono font-bold text-slate-700">
                          {formatAmount(item.existingSold, settings.currency)}
                          {' / '}
                          <span className={item.remainingQuota > 0 ? 'text-emerald-600' : 'text-slate-400'}>
                            {formatAmount(item.remainingQuota, settings.currency)}
                          </span>
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isMyanmar ? 'အသစ်ထိုးငွေ' : 'New Bet'}</span>
                        <span className="font-mono font-bold text-slate-900">
                          {formatAmount(item.originalAmount, settings.currency)}
                        </span>
                      </div>
                      <div className="bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg text-right">
                        <span className="text-[10px] text-rose-600 font-bold block">{isMyanmar ? 'ပိုလျှံငွေ' : 'Excess'}</span>
                        <span className="font-mono font-black text-rose-700 text-xs">
                          +{formatAmount(item.excessAmount, settings.currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Decision Options Buttons for this number */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                    {/* Option 1: Forward Excess to Master Bookie */}
                    <button
                      type="button"
                      onClick={() => handleSetAction(item.id, 'forward_excess')}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        item.action === 'forward_excess'
                          ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 text-indigo-950 font-bold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-indigo-700">
                        <ArrowUpRight className="w-4 h-4" />
                        <span className="font-bold">{isMyanmar ? 'ဒိုင်ကြီးဆီ ဆက်တင်' : 'Forward Excess'}</span>
                      </div>
                      <p className="text-[10px] font-normal leading-tight opacity-80">
                        {hasQuota
                          ? `${formatAmount(item.remainingQuota, settings.currency)} ကိုယ်တိုင်ရောင်းပြီး ပိုငွေ ${formatAmount(item.excessAmount, settings.currency)} ဒိုင်ကြီးဆီတင်မည်`
                          : `ဘရိတ်ပြည့်ပြီးဖြစ်၍ ${formatAmount(item.originalAmount, settings.currency)} အားလုံး ဒိုင်ကြီးဆီတင်မည်`}
                      </p>
                    </button>

                    {/* Option 2: Accept Locally / Absorb Risk */}
                    <button
                      type="button"
                      onClick={() => handleSetAction(item.id, 'accept_locally')}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        item.action === 'accept_locally'
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 text-emerald-950 font-bold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-emerald-700">
                        <Shield className="w-4 h-4" />
                        <span className="font-bold">{isMyanmar ? 'ကိုယ်တိုင် အပိုလက်ခံ' : 'Accept Locally'}</span>
                      </div>
                      <p className="text-[10px] font-normal leading-tight opacity-80">
                        {isMyanmar
                          ? `ဘရိတ်ကျော်သော်လည်း ${formatAmount(item.originalAmount, settings.currency)} အားလုံး ကိုယ်တိုင်တာဝန်ယူရောင်းမည်`
                          : `Absorb risk: accept full amount locally`}
                      </p>
                    </button>

                    {/* Option 3: Cap at Limit */}
                    <button
                      type="button"
                      onClick={() => handleSetAction(item.id, 'cap_at_limit')}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        item.action === 'cap_at_limit'
                          ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200 text-amber-950 font-bold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-amber-700">
                        <Scissors className="w-4 h-4" />
                        <span className="font-bold">{isMyanmar ? 'ဘရိတ်အထိသာ ရောင်း' : 'Cap at Limit'}</span>
                      </div>
                      <p className="text-[10px] font-normal leading-tight opacity-80">
                        {hasQuota
                          ? `လက်ကျန် ${formatAmount(item.remainingQuota, settings.currency)} သာလက်ခံပြီး ပိုငွေကို ဖျက်မည်`
                          : `လက်ကျန်မရှိတော့သဖြင့် ပယ်ဖျက်မည်`}
                      </p>
                    </button>

                    {/* Option 4: Reject / Cancel bet on this number */}
                    <button
                      type="button"
                      onClick={() => handleSetAction(item.id, 'reject')}
                      className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
                        item.action === 'reject'
                          ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-200 text-rose-950 font-bold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-rose-600">
                        <Ban className="w-4 h-4" />
                        <span className="font-bold">{isMyanmar ? 'လုံးဝ မလက်ခံပါ' : 'Reject Bet'}</span>
                      </div>
                      <p className="text-[10px] font-normal leading-tight opacity-80">
                        {isMyanmar ? 'ဤဂဏန်းအား ဘောင်ချာမှ လုံးဝ ပယ်ဖျက်မည်' : 'Remove this item completely'}
                      </p>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Outcome Summary Breakdown */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
            <div className="font-bold text-slate-800 flex items-center justify-between">
              <span>{isMyanmar ? 'ရလဒ် အနှစ်ချုပ် တွက်ချက်မှု:' : 'Action Summary Breakdown:'}</span>
              <span className="text-slate-500 text-[11px]">
                {customerName ? `(ဖောက်သည်: ${customerName})` : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-200">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 text-[11px] block">{isMyanmar ? 'ဆိုင်မှ ကိုယ်တိုင်ရောင်းငွေ' : 'Retained Locally'}</span>
                <span className="font-mono font-bold text-emerald-700 text-sm">
                  {formatAmount(totalRetainedLocally, settings.currency)}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-indigo-200">
                <span className="text-indigo-600 text-[11px] font-semibold block">{isMyanmar ? 'ဒိုင်ကြီးဆီ ဆက်တင်ငွေ' : 'Forward to Master'}</span>
                <span className="font-mono font-bold text-indigo-700 text-sm">
                  {formatAmount(totalForwardedToMaster, settings.currency)}
                </span>
                {totalForwardedToMaster > 0 && (
                  <span className="text-[10px] text-indigo-500 block font-mono">
                    (ကော်မရှင် +{formatAmount(estimatedCommission, settings.currency)})
                  </span>
                )}
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-500 text-[11px] block">{isMyanmar ? 'ပယ်ဖျက် / လက်မခံငွေ' : 'Rejected / Dropped'}</span>
                <span className="font-mono font-bold text-rose-600 text-sm">
                  {formatAmount(totalRejected, settings.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              {isMyanmar ? 'မလုပ်တော့ပါ (Cancel)' : 'Cancel'}
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isMyanmar ? 'အတည်ပြုပြီး ဘောင်ချာသိမ်းမည်' : 'Confirm & Save Voucher'}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
