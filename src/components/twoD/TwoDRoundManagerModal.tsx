import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  X
} from 'lucide-react';
import { useTwoDLottery } from '../../context/TwoDLotteryContext';

interface TwoDRoundManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TwoDRoundManagerModal: React.FC<TwoDRoundManagerModalProps> = ({ isOpen, onClose }) => {
  const { rounds, activeRoundId, setActiveRoundId, createRound, deleteRound, settings } = useTwoDLottery();
  const isMyanmar = settings.language === 'my';

  const [dateStr, setDateStr] = useState(new Date().toISOString().slice(0, 10));
  const [session, setSession] = useState<'morning' | 'evening'>('morning');
  const [multiplier, setMultiplier] = useState(String(settings.defaultMultiplier || 80));

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const sessionName = session === 'morning' ? 'မနက် (12:01 PM)' : 'ညနေ (04:30 PM)';
    const name = `${dateStr} ${sessionName}`;

    createRound({
      name,
      drawDate: dateStr,
      session,
      closingTime: session === 'morning' ? '12:00' : '16:25',
      multiplier: parseFloat(multiplier) || settings.defaultMultiplier || 80,
      status: 'open',
      commissionRate: settings.defaultCommissionRate || 12
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-200">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-600" />
            <h3 className="text-base font-black text-slate-900">
              {isMyanmar ? 'ဇီးကွက် ပွဲစဉ်များ စီမံခန့်ခွဲခြင်း' : 'Manage Draw Rounds'}
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

        {/* Existing Rounds List */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          <span className="text-xs font-bold text-slate-600 block">
            {isMyanmar ? 'ရှိပြီးသား ပွဲစဉ်များ:' : 'Existing Rounds:'}
          </span>
          {rounds.map(r => (
            <div
              key={r.id}
              className={`p-3 rounded-2xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                r.id === activeRoundId
                  ? 'bg-teal-50 border-teal-300 ring-1 ring-teal-200'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
              }`}
              onClick={() => setActiveRoundId(r.id)}
            >
              <div>
                <span className="font-bold text-slate-900 block">{r.name}</span>
                <span className="text-[11px] text-slate-500">
                  {r.status === 'settled' ? `ပေါက်ဂဏန်း: [${r.winningNumber}]` : 'ဖွင့်လှစ်ဆဲ'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {r.id === activeRoundId && (
                  <span className="px-2 py-0.5 bg-teal-600 text-white font-bold text-[10px] rounded-md">
                    Active
                  </span>
                )}
                {rounds.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm('ပွဲစဉ်ကို ဖျက်ရန် သေချာပါသလား?')) {
                        deleteRound(r.id);
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Create New Round Form */}
        <form onSubmit={handleCreate} className="border-t border-slate-100 pt-4 space-y-3">
          <span className="text-xs font-black text-slate-900 block">
            {isMyanmar ? '+ ပွဲစဉ်အသစ် ဖွင့်လှစ်ရန်' : '+ Create New Round'}
          </span>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">ရက်စွဲ</label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full h-10 px-2 rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">အချိန်ပိုင်း</label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value as any)}
                className="w-full h-10 px-2 rounded-xl border border-slate-300 bg-white"
              >
                <option value="morning">မနက် (12:01 PM)</option>
                <option value="evening">ညနေ (04:30 PM)</option>
              </select>
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-bold text-slate-700 mb-1">အလျော်ဆ (Multiplier)</label>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
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
              className="w-full h-10 px-3 rounded-xl border border-slate-300 font-mono font-bold text-right"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
            >
              ပိတ်မည်
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
            >
              ပွဲစဉ်ဖွင့်မည်
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
