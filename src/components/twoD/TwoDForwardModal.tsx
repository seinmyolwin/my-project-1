import React, { useState, useEffect } from 'react';
import {
  Send,
  Trash2,
  Plus,
  CheckCircle2,
  Percent,
  X,
  Phone,
  User,
  ShieldAlert
} from 'lucide-react';
import { useTwoDLottery } from '../../context/TwoDLotteryContext';
import { formatAmount, convertMyanmarToEnglishDigits } from '../../utils/lotteryUtils';

interface TwoDForwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialNumber?: string;
  initialAmount?: number;
}

export const TwoDForwardModal: React.FC<TwoDForwardModalProps> = ({
  isOpen,
  onClose,
  initialNumber,
  initialAmount
}) => {
  const { settings, activeRound, addForwardSlip } = useTwoDLottery();
  const isMyanmar = settings.language === 'my';

  const [masterAgentName, setMasterAgentName] = useState(settings.defaultMasterAgentName || 'ကိုစိုးနိုင် (ဒိုင်ချုပ်ကြီး)');
  const [masterAgentPhone, setMasterAgentPhone] = useState(settings.defaultMasterAgentPhone || '09-970001111');
  const [commissionRate, setCommissionRate] = useState<number>(settings.defaultForwardCommission || 14);
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<{ number: string; amount: number }[]>([]);
  const [itemNum, setItemNum] = useState('');
  const [itemAmt, setItemAmt] = useState('10000');

  useEffect(() => {
    if (initialNumber && initialAmount) {
      setItems([{ number: initialNumber, amount: initialAmount }]);
    }
  }, [initialNumber, initialAmount]);

  if (!isOpen) return null;

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = itemNum.trim().padStart(2, '0');
    const amt = parseFloat(itemAmt);
    if (clean.length === 2 && !isNaN(amt) && amt > 0) {
      setItems(prev => [...prev, { number: clean, amount: amt }]);
      setItemNum('');
    }
  };

  const totalAmount = items.reduce((acc, i) => acc + i.amount, 0);
  const commissionAmount = Math.round((totalAmount * commissionRate) / 100);
  const netPaid = totalAmount - commissionAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('လွှဲတင်မည့် ဂဏန်းစာရင်း ထည့်ပါ');
      return;
    }

    addForwardSlip({
      roundId: activeRound?.id || 'default',
      masterAgentName,
      masterAgentPhone,
      items,
      totalAmount,
      commissionRate,
      commissionAmount,
      netPaid,
      notes: notes.trim() || undefined
    });

    onClose();
    setItems([]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
            <h3 className="text-base font-black text-slate-900">
              {isMyanmar ? 'ဒိုင်ကြီးထံ ဇီးကွက် လွှဲတင်စာရင်း (Forward Slip)' : 'Forward Slip to Master Dealer'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master Agent Info */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-bold text-slate-700 mb-1">ဒိုင်ချုပ်အမည်</label>
            <input
              type="text"
              value={masterAgentName}
              onChange={(e) => setMasterAgentName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">ဖုန်းနံပါတ်</label>
            <input
              type="text"
              value={masterAgentPhone}
              onChange={(e) => setMasterAgentPhone(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300"
            />
          </div>
        </div>

        {/* Add Number Form */}
        <form onSubmit={handleAddItem} className="grid grid-cols-12 gap-2 text-xs">
          <div className="col-span-4">
            <input
              type="text"
              maxLength={2}
              placeholder="ဂဏန်း (24)"
              value={itemNum}
              onChange={(e) => setItemNum(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 2))}
              onFocus={(e) => e.target.select()}
              className="w-full h-10 px-2 text-center font-mono font-bold rounded-xl border border-slate-300"
            />
          </div>
          <div className="col-span-5">
            <input
              type="text"
              placeholder="ငွေပမာဏ"
              value={itemAmt}
              onChange={(e) => setItemAmt(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, ''))}
              onFocus={(e) => e.target.select()}
              className="w-full h-10 px-2 text-right font-mono font-bold rounded-xl border border-slate-300"
            />
          </div>
          <div className="col-span-3">
            <button
              type="submit"
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs cursor-pointer"
            >
              + ထည့်
            </button>
          </div>
        </form>

        {/* Items List */}
        <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 text-xs font-mono">
          {items.map((item, idx) => (
            <div key={idx} className="py-2 flex items-center justify-between">
              <span className="font-bold text-sm text-slate-900">{item.number}</span>
              <div className="flex items-center gap-3">
                <span>{formatAmount(item.amount, settings.currency)}</span>
                <button
                  type="button"
                  onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
                  className="text-slate-400 hover:text-rose-600 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Financial Calculation */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5 font-mono">
          <div className="flex justify-between">
            <span className="font-sans">လွှဲတင်ငွေ စုစုပေါင်း:</span>
            <span className="font-bold">{formatAmount(totalAmount, settings.currency)}</span>
          </div>
          <div className="flex justify-between text-emerald-700">
            <span className="font-sans">ရရှိမည့် ကော်မရှင် ({commissionRate}%):</span>
            <span className="font-bold">+{formatAmount(commissionAmount, settings.currency)}</span>
          </div>
          <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1 text-sm">
            <span className="font-sans">ဒိုင်ကြီးသို့ အမှန်ပေးငွေ:</span>
            <span className="text-indigo-700">{formatAmount(netPaid, settings.currency)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
          >
            မလုပ်တော့ပါ
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={items.length === 0}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
          >
            လွှဲတင်စာရင်း အတည်ပြုမည်
          </button>
        </div>
      </div>
    </div>
  );
};
