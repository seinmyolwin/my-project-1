import React, { useState, useEffect, useMemo } from 'react';
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
  Phone,
  Copy,
  Printer,
  CheckSquare,
  Square,
  Send
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { ForwardSlip, ForwardSlipItem, NumberAggregate } from '../types';
import { formatAmount, convertMyanmarToEnglishDigits } from '../utils/lotteryUtils';

interface ForwardSlipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialNumber?: string;
  initialAmount?: number;
}

interface DraftForwardItem {
  id: string;
  number: string;
  totalSold: number;
  limit: number;
  excessAmount: number;
  forwardAmount: number;
  selected: boolean;
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
    aggregates,
    forwardSlips,
    activeRoundForwardSlips,
    addForwardSlip,
    deleteForwardSlip
  } = useLottery();

  const isMyanmar = settings.language === 'my';

  // Form State
  const [masterAgentName, setMasterAgentName] = useState(settings.defaultMasterAgentName || 'ကိုစိုးနိုင် (ဒိုင်ချုပ်ကြီး)');
  const [masterAgentPhone, setMasterAgentPhone] = useState(settings.defaultMasterAgentPhone || '09-970001111');
  const [commissionRate, setCommissionRate] = useState<number>(settings.defaultCommissionRate || 0);
  const [notes, setNotes] = useState('');

  // Draft items
  const [draftItems, setDraftItems] = useState<DraftForwardItem[]>([]);
  const [manualNum, setManualNum] = useState('');
  const [manualAmt, setManualAmt] = useState('10000');

  // Completed Slip for receipt / copy / print
  const [createdSlip, setCreatedSlip] = useState<ForwardSlip | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Compute all excess 3D numbers from active round aggregates
  const excessList: DraftForwardItem[] = useMemo(() => {
    const list: DraftForwardItem[] = [];
    const allAggs = Object.values(aggregates) as NumberAggregate[];

    allAggs.forEach((agg) => {
      const netSold = Math.max(0, agg.totalSold - (agg.forwardedAmount || 0));
      if (agg.limit > 0 && netSold > agg.limit) {
        const excess = netSold - agg.limit;
        list.push({
          id: `excess-3d-${agg.number}`,
          number: agg.number,
          totalSold: agg.totalSold,
          limit: agg.limit,
          excessAmount: excess,
          forwardAmount: excess,
          selected: true
        });
      }
    });

    return list.sort((a, b) => b.excessAmount - a.excessAmount);
  }, [aggregates]);

  useEffect(() => {
    if (!isOpen) {
      setCreatedSlip(null);
      setCopySuccess(false);
      return;
    }

    if (initialNumber && initialAmount && initialAmount > 0) {
      const clean = initialNumber.padStart(3, '0');
      const agg = aggregates[clean];
      setDraftItems([
        {
          id: `init-3d-${clean}`,
          number: clean,
          totalSold: agg?.totalSold || initialAmount,
          limit: agg?.limit || 0,
          excessAmount: initialAmount,
          forwardAmount: initialAmount,
          selected: true
        }
      ]);
    } else {
      setDraftItems(excessList);
    }
  }, [isOpen, initialNumber, initialAmount, excessList, aggregates]);

  if (!isOpen) return null;

  // Toggle selection
  const toggleSelect = (id: string) => {
    setDraftItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, selected: !i.selected } : i))
    );
  };

  const handleToggleSelectAll = () => {
    const allSelected = draftItems.length > 0 && draftItems.every((i) => i.selected);
    setDraftItems((prev) => prev.map((i) => ({ ...i, selected: !allSelected })));
  };

  const handleAmountChange = (id: string, newAmtStr: string) => {
    const cleaned = convertMyanmarToEnglishDigits(newAmtStr).replace(/\D/g, '');
    const val = parseInt(cleaned, 10) || 0;
    setDraftItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, forwardAmount: val } : i))
    );
  };

  const handleRemoveDraft = (id: string) => {
    setDraftItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleAddManual = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualNum.trim().padStart(3, '0');
    const amt = parseFloat(manualAmt);
    if (clean.length === 3 && !isNaN(amt) && amt > 0) {
      const existing = draftItems.find((i) => i.number === clean);
      if (existing) {
        setDraftItems((prev) =>
          prev.map((i) =>
            i.number === clean ? { ...i, forwardAmount: i.forwardAmount + amt, selected: true } : i
          )
        );
      } else {
        const agg = aggregates[clean];
        setDraftItems((prev) => [
          ...prev,
          {
            id: `manual-3d-${clean}-${Date.now()}`,
            number: clean,
            totalSold: agg?.totalSold || amt,
            limit: agg?.limit || 0,
            excessAmount: amt,
            forwardAmount: amt,
            selected: true
          }
        ]);
      }
      setManualNum('');
    }
  };

  const activeSelected = draftItems.filter((i) => i.selected && i.forwardAmount > 0);
  const totalAmount = activeSelected.reduce((acc, i) => acc + i.forwardAmount, 0);
  const commissionAmount = Math.round((totalAmount * commissionRate) / 100);
  const netPaid = totalAmount - commissionAmount;

  const handleSaveForwardSlip = () => {
    if (activeSelected.length === 0) {
      alert(isMyanmar ? 'လွှဲတင်မည့် ဂဏန်းစာရင်း ရွေးချယ်ပါ' : 'Select at least one number');
      return;
    }

    const payload = {
      roundId: activeRound?.id || 'default',
      masterAgentName: masterAgentName.trim() || 'ဒိုင်ချုပ်ကြီး',
      masterAgentPhone: masterAgentPhone.trim(),
      items: activeSelected.map((i) => ({ number: i.number, amount: i.forwardAmount })),
      totalAmount,
      commissionRate,
      commissionAmount,
      netPaid,
      notes: notes.trim() || undefined
    };

    const newSlip = addForwardSlip(payload);
    setCreatedSlip(newSlip);
  };

  const handleCopyViber = () => {
    if (!createdSlip) return;
    const lines = createdSlip.items.map((it) => `${it.number}=${it.amount}`);
    const text = `【3D ဒိုင်လွှဲစလစ်: ${createdSlip.slipNo}】\nပွဲစဉ်: ${activeRound?.name}\nဒိုင်ချုပ်: ${createdSlip.masterAgentName}\n----------------\n${lines.join('\n')}\n----------------\nစုစုပေါင်း: ${formatAmount(createdSlip.totalAmount, settings.currency)}\nကော်မရှင် (${createdSlip.commissionRate}%): +${formatAmount(createdSlip.commissionAmount, settings.currency)}\nဒိုင်သို့ အမှန်ပေးငွေ: ${formatAmount(createdSlip.netPaid, settings.currency)}`;

    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-3.5 flex items-center justify-between border-b border-indigo-900 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold">
              <ShieldAlert className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-white leading-tight">
                {isMyanmar ? 'အိုးစည်လေး ဒိုင်ကြီးဆီ ပြန်တင်စာရင်း (3D Batch Forward Hub)' : '3D Master Agent Forwarding Hub'}
              </h3>
              <p className="text-[11px] text-indigo-200/80">
                {isMyanmar ? 'သတ်မှတ်ချက်ကျော် ပိုနေသော 3D ဂဏန်းများကို စုစည်းလွှဲတင်ခြင်း' : 'Batch offload 3D excess liability'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {createdSlip ? (
          <div className="p-6 space-y-5 overflow-y-auto">
            <div className="text-center space-y-2 py-2">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-black text-slate-900">
                {isMyanmar ? '3D ဒိုင်ကြီးဆီ လွှဲတင်စာရင်း အောင်မြင်စွာ မှတ်တမ်းတင်ပြီးပါပြီ' : '3D Forward Slip Created Successfully'}
              </h4>
              <p className="text-xs text-slate-500 font-mono">
                {createdSlip.slipNo} • {createdSlip.masterAgentName}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-xs space-y-3">
              <div className="flex justify-between text-slate-600 border-b border-slate-200 pb-2">
                <span>ပွဲစဉ်: {activeRound?.name}</span>
                <span>ဂဏန်း {createdSlip.items.length} တွဲ</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-slate-100">
                {createdSlip.items.map((it, idx) => (
                  <div key={idx} className="pt-1.5 flex justify-between items-center text-slate-800">
                    <span className="font-bold text-sm bg-indigo-50 border border-indigo-200 text-indigo-900 px-2 py-0.5 rounded">
                      {it.number}
                    </span>
                    <span className="font-bold">{formatAmount(it.amount, settings.currency)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-2 space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>လွှဲတင်ငွေ စုစုပေါင်း:</span>
                  <span className="font-bold">{formatAmount(createdSlip.totalAmount, settings.currency)}</span>
                </div>
                <div className="flex justify-between text-emerald-600">
                  <span>ရရှိမည့် ကော်မရှင် ({createdSlip.commissionRate}%):</span>
                  <span className="font-bold">+{formatAmount(createdSlip.commissionAmount, settings.currency)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold text-sm pt-1 border-t border-slate-200">
                  <span>ဒိုင်ကြီးသို့ ပေးရန်:</span>
                  <span className="text-indigo-700">{formatAmount(createdSlip.netPaid, settings.currency)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleCopyViber}
                className="py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>{copySuccess ? 'Copied ✓' : 'Viber စာသား ကူးယူမည်'}</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>ဘောင်ချာ ပရင့်ထုတ်မည်</span>
              </button>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
              >
                ပိတ်မည် (Done)
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
            {/* Master Agent Info */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">ဒိုင်ချုပ် အမည်</label>
                <input
                  type="text"
                  value={masterAgentName}
                  onChange={(e) => setMasterAgentName(e.target.value)}
                  className="w-full h-9 px-3 bg-white rounded-xl border border-slate-300 font-bold text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">ဖုန်းနံပါတ်</label>
                <input
                  type="text"
                  value={masterAgentPhone}
                  onChange={(e) => setMasterAgentPhone(e.target.value)}
                  className="w-full h-9 px-3 bg-white rounded-xl border border-slate-300 font-mono text-slate-900 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">ကော်မရှင် (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
                    className="w-full h-9 px-3 pr-7 bg-white rounded-xl border border-slate-300 font-mono font-bold text-slate-900 outline-none focus:border-indigo-500"
                  />
                  <Percent className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Quick Add Custom 3D Number */}
            <form onSubmit={handleAddManual} className="flex items-center gap-2 text-xs">
              <input
                type="text"
                maxLength={3}
                placeholder="ဂဏန်း (123)"
                value={manualNum}
                onChange={(e) =>
                  setManualNum(
                    convertMyanmarToEnglishDigits(e.target.value)
                      .replace(/\D/g, '')
                      .slice(0, 3)
                  )
                }
                className="w-24 h-9 px-2 text-center font-mono font-bold rounded-xl border border-slate-300 bg-white"
              />
              <input
                type="text"
                placeholder="ငွေပမာဏ"
                value={manualAmt}
                onChange={(e) => setManualAmt(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, ''))}
                className="flex-1 h-9 px-3 text-right font-mono font-bold rounded-xl border border-slate-300 bg-white"
              />
              <button
                type="submit"
                className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs cursor-pointer shrink-0"
              >
                + ထပ်ထည့်
              </button>
            </form>

            {/* Draft Items Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
                  >
                    {draftItems.length > 0 && draftItems.every((i) => i.selected) ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    <span>
                      {draftItems.length > 0 && draftItems.every((i) => i.selected)
                        ? 'အားလုံး ရွေးထားသည်'
                        : 'အားလုံး ရွေးမည်'}
                    </span>
                  </button>
                  <span className="text-[11px] text-slate-500 font-medium">
                    ({activeSelected.length} / {draftItems.length} လုံး ရွေးချယ်ထား)
                  </span>
                </div>

                {excessList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraftItems(excessList)}
                    className="text-[11px] font-bold text-indigo-700 hover:underline cursor-pointer"
                  >
                    ပိုနေသောဂဏန်းများ အကုန်ပြန်ယူမည်
                  </button>
                )}
              </div>

              {draftItems.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    {isMyanmar ? 'လက်ရှိတွင် သတ်မှတ်ကန့်သတ်ငွေ ကျော်လွန်နေသော 3D ဂဏန်း မရှိပါ' : 'No over-limit 3D numbers currently'}
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {draftItems.map((item) => (
                    <div
                      key={item.id}
                      className={`p-2.5 flex items-center justify-between gap-2 transition-colors ${
                        item.selected ? 'bg-indigo-50/40' : 'bg-slate-50/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggleSelect(item.id)}
                          className="cursor-pointer text-indigo-600"
                        >
                          {item.selected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        <span className="font-mono text-base font-black px-2 py-0.5 bg-white border border-slate-300 text-slate-900 rounded-lg shadow-2xs">
                          {item.number}
                        </span>
                        <div className="hidden sm:block text-[11px] text-slate-500">
                          <span>ရောင်းရ: {formatAmount(item.totalSold, settings.currency)}</span>
                          {item.limit > 0 && (
                            <span className="ml-1.5 text-slate-400">(ကန့်သတ်: {formatAmount(item.limit, settings.currency)})</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.forwardAmount}
                          onChange={(e) => handleAmountChange(item.id, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          disabled={!item.selected}
                          className="w-28 sm:w-32 h-8 px-2 text-right font-mono font-bold text-xs bg-white rounded-lg border border-slate-300 focus:border-indigo-500 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveDraft(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl font-mono text-xs space-y-1.5 shadow-md">
              <div className="flex justify-between text-slate-300">
                <span className="font-sans">ရွေးချယ်ထားသော ဂဏန်း စုစုပေါင်း ({activeSelected.length} လုံး):</span>
                <span className="font-bold">{formatAmount(totalAmount, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span className="font-sans">ရရှိမည့် ကော်မရှင် ({commissionRate}%):</span>
                <span className="font-bold">+{formatAmount(commissionAmount, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-amber-400 font-bold border-t border-slate-800 pt-1.5 text-sm">
                <span className="font-sans">ဒိုင်ကြီးသို့ အမှန်ပေးချေရမည့်ငွေ:</span>
                <span>{formatAmount(netPaid, settings.currency)}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                မလုပ်တော့ပါ
              </button>
              <button
                type="button"
                onClick={handleSaveForwardSlip}
                disabled={activeSelected.length === 0}
                className={`px-5 py-2.5 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer ${
                  activeSelected.length > 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 active:scale-95'
                    : 'bg-slate-300 cursor-not-allowed text-slate-500'
                }`}
              >
                <Send className="w-4 h-4" />
                <span>
                  {isMyanmar
                    ? `ရွေးချယ်ထားသော (${activeSelected.length} လုံး) စာရင်း ဘောင်ချာထုတ်ပြီး ပြန်တင်မည်`
                    : 'Confirm & Forward Selected'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

