import React, { useState } from 'react';
import {
  X,
  ShieldAlert,
  ArrowUpRight,
  Plus,
  Trash2,
  Percent,
  CheckCircle2,
  FileSpreadsheet,
  User,
  Phone
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { ForwardSlip, ForwardSlipItem } from '../types';
import { formatAmount, convertMyanmarToEnglishDigits } from '../utils/lotteryUtils';

interface ForwardSlipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialNumber?: string;
  initialAmount?: number;
}

export const ForwardSlipsModal: React.FC<ForwardSlipsModalProps> = ({
  isOpen,
  onClose,
  initialNumber,
  initialAmount
}) => {
  const {
    activeRound,
    settings,
    forwardSlips,
    activeRoundForwardSlips,
    addForwardSlip,
    deleteForwardSlip
  } = useLottery();

  const isMyanmar = settings.language === 'my';

  // Form State
  const [masterAgentName, setMasterAgentName] = useState('ကိုစိုးနိုင် (ဒိုင်ချုပ်ကြီး)');
  const [masterAgentPhone, setMasterAgentPhone] = useState('09-970001111');
  const [commissionRate, setCommissionRate] = useState<number>(settings.defaultCommissionRate || 10);
  const [notes, setNotes] = useState('');

  // Staged items
  const [numberInput, setNumberInput] = useState(initialNumber || '');
  const [amountInput, setAmountInput] = useState(String(initialAmount || 10000));
  const [stagedItems, setStagedItems] = useState<ForwardSlipItem[]>(() => {
    if (initialNumber && initialAmount && initialAmount > 0) {
      return [{ number: initialNumber, amount: initialAmount }];
    }
    return [];
  });

  if (!isOpen) return null;

  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!numberInput || numberInput.length !== 3) return;
    const amount = parseInt(amountInput, 10);
    if (isNaN(amount) || amount <= 0) return;

    setStagedItems(prev => [...prev, { number: numberInput, amount }]);
    setNumberInput('');
  };

  const handleRemoveItem = (index: number) => {
    setStagedItems(prev => prev.filter((_, i) => i !== index));
  };

  const totalAmount = stagedItems.reduce((acc, item) => acc + item.amount, 0);
  const commissionAmount = Math.round((totalAmount * commissionRate) / 100);
  const netPaid = totalAmount - commissionAmount;

  const handleSaveForwardSlip = () => {
    if (stagedItems.length === 0) return;

    addForwardSlip({
      roundId: activeRound?.id || 'default',
      masterAgentName: masterAgentName.trim() || 'ဒိုင်ချုပ်ကြီး',
      masterAgentPhone: masterAgentPhone.trim(),
      items: stagedItems,
      totalAmount,
      commissionRate,
      commissionAmount,
      netPaid,
      notes: notes.trim()
    });

    setStagedItems([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border border-indigo-100">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isMyanmar ? 'အထက်တင် / ပွဲစား အပို့စာရင်း (Hedging & Forwarding)' : 'Forward & Offload Ledger'}
              </h3>
              <p className="text-xs text-slate-500">
                {isMyanmar ? 'အန္တရာယ်ရှိသော ဂဏန်းများကို အဓိကဒိုင်ကြီးထံသို့ လွှဲတင်ပြီး ကော်မရှင်ရယူခြင်း' : 'Offload excess liability to master bookmaker and lock in commission'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* New Forward Slip Entry Card */}
          <div className="bg-slate-50 border border-indigo-100 rounded-xl p-4 space-y-4 shadow-2xs">
            <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4" />
              <span>{isMyanmar ? 'အထက်သို့ လွှဲတင်မည့် စလစ်အသစ် ရေးသွင်းရန်' : 'New Forward Slip Entry'}</span>
            </h4>

            {/* Master Agent Details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {isMyanmar ? 'ဒိုင်ချုပ်ကြီး အမည်' : 'Master Agent Name'}
                </label>
                <input
                  type="text"
                  value={masterAgentName}
                  onChange={(e) => setMasterAgentName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {isMyanmar ? 'ဖုန်းနံပါတ်' : 'Phone'}
                </label>
                <input
                  type="text"
                  value={masterAgentPhone}
                  onChange={(e) => setMasterAgentPhone(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {isMyanmar ? 'ရရှိမည့် ကော်မရှင် (%)' : 'Commission Rate (%)'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(Math.max(0, parseInt(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, ''), 10) || 0))}
                  onFocus={(e) => e.target.select()}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Item Input Row */}
            <form onSubmit={handleAddItem} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-2 border-t border-slate-200">
              <div className="sm:col-span-4 space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {isMyanmar ? 'လွှဲတင်မည့် ဂဏန်း' : 'Number (3-Digit)'}
                </label>
                <input
                  type="text"
                  maxLength={3}
                  value={numberInput}
                  onChange={(e) => setNumberInput(convertMyanmarToEnglishDigits(e.target.value).replace(/[^0-9]/g, '').slice(0, 3))}
                  onFocus={(e) => e.target.select()}
                  placeholder="000 - 999"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-base font-black font-mono text-indigo-900 text-center outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div className="sm:col-span-5 space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {isMyanmar ? 'လွှဲတင်ငွေ' : 'Amount'} ({settings.currency})
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amountInput}
                  onChange={(e) => setAmountInput(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, ''))}
                  onFocus={(e) => e.target.select()}
                  placeholder="10000"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-base font-bold font-mono text-slate-900 text-center outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isMyanmar ? 'စာရင်းထည့်' : 'Add Item'}</span>
                </button>
              </div>
            </form>

            {/* Staged Items List */}
            {stagedItems.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex flex-wrap gap-2">
                  {stagedItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-indigo-200 px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs font-mono shadow-2xs"
                    >
                      <span className="font-bold text-indigo-900 text-sm">{item.number}</span>
                      <span className="text-slate-800">={formatAmount(item.amount, settings.currency)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-400 hover:text-rose-600 ml-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Totals & Submit */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="space-y-0.5">
                    <span className="text-slate-600 block">
                      စုစုပေါင်း: <b className="text-slate-900 font-mono">{formatAmount(totalAmount, settings.currency)}</b> | ရရှိမည့် ကော်မရှင်: <b className="text-indigo-700 font-mono">+{formatAmount(commissionAmount, settings.currency)}</b>
                    </span>
                    <span className="text-emerald-700 font-bold block">
                      ဒိုင်ချုပ်သို့ ပေးချေငွေ: {formatAmount(netPaid, settings.currency)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveForwardSlip}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-2xs transition-all cursor-pointer"
                  >
                    {isMyanmar ? 'အပေါ်လွှဲစလစ် အတည်ပြုသိမ်းမည်' : 'Save Forward Slip'}
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Existing Forwarded Slips History */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isMyanmar ? 'လက်ရှိပွဲစဉ် အပေါ်လွှဲတင်ထားသော စလစ်များ' : 'Active Round Forwarded Slips History'}
            </h4>

            {activeRoundForwardSlips.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-slate-200">
                {isMyanmar ? 'အထက်သို့ လွှဲတင်ထားသော စာရင်းမရှိသေးပါ' : 'No forward slips created for this round yet'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeRoundForwardSlips.map((slip) => (
                  <div
                    key={slip.id}
                    className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-700">{slip.slipNo}</span>
                        <span className="text-slate-900 font-semibold">{slip.masterAgentName}</span>
                        {slip.masterAgentPhone && (
                          <span className="text-slate-500 font-mono">({slip.masterAgentPhone})</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1 text-slate-600 font-mono">
                        {slip.items.map((it, i) => (
                          <span key={i} className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                            {it.number}={formatAmount(it.amount, settings.currency)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 font-mono border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0">
                      <div className="text-right">
                        <span className="text-indigo-700 font-bold block">
                          ကော်မရှင်: +{formatAmount(slip.commissionAmount, settings.currency)}
                        </span>
                        <span className="text-slate-500 text-[11px] block">
                          ပေးငွေ: {formatAmount(slip.netPaid, settings.currency)}
                        </span>
                      </div>

                      <button
                        onClick={() => deleteForwardSlip(slip.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="စလစ်ဖျက်မည်"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
