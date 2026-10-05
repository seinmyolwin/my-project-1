import React, { useState } from 'react';
import {
  X,
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Award,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { DrawRound } from '../types';

interface RoundManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RoundManagerModal: React.FC<RoundManagerModalProps> = ({ isOpen, onClose }) => {
  const {
    rounds,
    activeRoundId,
    setActiveRoundId,
    createRound,
    deleteRound,
    settings
  } = useLottery();

  const isMyanmar = settings.language === 'my';

  // New Round Form
  const [name, setName] = useState('');
  const [drawDate, setDrawDate] = useState(new Date().toISOString().slice(0, 10));
  const [closingTime, setClosingTime] = useState('15:00');
  const [multiplier, setMultiplier] = useState(String(settings.defaultMultiplier || 600));
  const [toddMultiplier, setToddMultiplier] = useState(String(settings.defaultToddMultiplier || 100));

  if (!isOpen) return null;

  const handleCreateRound = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createRound({
      name: name.trim(),
      drawDate,
      closingTime,
      status: 'open',
      multiplier: parseInt(multiplier, 10) || 600,
      toddMultiplier: parseInt(toddMultiplier, 10) || 100,
      commissionRate: settings.defaultCommissionRate || 10
    });

    setName('');
    onClose();
  };

  // Quick preset round name generators (e.g. 1st or 16th of this/next month)
  const setQuickThaiRound = (day: 1 | 16) => {
    const d = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const padDay = String(day).padStart(2, '0');
    const month = monthNames[d.getMonth()];
    const year = d.getFullYear();
    setName(`${padDay}-${month}-${year} (ထိုင်း 3D)`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border border-indigo-100">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isMyanmar ? 'ပွဲစဉ်များ စီမံခန့်ခွဲမှု (Draw Rounds)' : 'Manage Lottery Rounds'}
              </h3>
              <p className="text-xs text-slate-500">
                {isMyanmar ? 'အိုးစည်လေး ပွဲစဉ်အသစ်များ ဖွင့်လှစ်ခြင်းနှင့် ယခင်မှတ်တမ်းများ' : 'Create new draw rounds and switch active ledger'}
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
          
          {/* New Round Creation Card */}
          <form onSubmit={handleCreateRound} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>{isMyanmar ? 'ပွဲစဉ်အသစ် ဖွင့်လှစ်ရန်' : 'Open New Round'}</span>
            </h4>

            {/* Quick Name Buttons */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">{isMyanmar ? 'အမြန်ရွေးရန်:' : 'Presets:'}</span>
              <button
                type="button"
                onClick={() => setQuickThaiRound(1)}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-indigo-700 font-semibold shadow-2xs cursor-pointer"
              >
                ၁ ရက်နေ့ ပွဲစဉ်
              </button>
              <button
                type="button"
                onClick={() => setQuickThaiRound(16)}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-indigo-700 font-semibold shadow-2xs cursor-pointer"
              >
                ၁၆ ရက်နေ့ ပွဲစဉ်
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6 space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {isMyanmar ? 'ပွဲစဉ်အမည်' : 'Round Name'}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="01-Oct-2026 (ထိုင်း 3D)"
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {isMyanmar ? 'ထွက်မည့်ရက်' : 'Draw Date'}
                </label>
                <input
                  type="date"
                  value={drawDate}
                  onChange={(e) => setDrawDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {isMyanmar ? 'ပိတ်ချိန်' : 'Closing Time'}
                </label>
                <input
                  type="time"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div className="sm:col-span-6 space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {isMyanmar ? 'တည့်ပေါက် ပေါက်ကြေး (ဆ)' : 'Straight Multiplier'}
                </label>
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
                  placeholder="600"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>

              <div className="sm:col-span-6 space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {isMyanmar ? 'ပတ်လည်ပေါက် ပေါက်ကြေး (ဆ)' : 'Todd Multiplier'}
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={toddMultiplier}
                  onChange={(e) => setToddMultiplier(e.target.value)}
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
                  placeholder="100"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer"
              >
                {isMyanmar ? 'ပွဲစဉ်အသစ် ဖွင့်မည်' : 'Open Round'}
              </button>
            </div>
          </form>

          {/* Existing Rounds List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {isMyanmar ? 'ယခင်နှင့် လက်ရှိ ပွဲစဉ်များ' : 'Existing Draw Rounds'}
            </h4>

            <div className="space-y-2">
              {rounds.map((round) => {
                const isActive = round.id === activeRoundId;

                return (
                  <div
                    key={round.id}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all shadow-2xs ${
                      isActive
                        ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{round.name}</span>
                        {isActive && (
                          <span className="bg-indigo-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-2xs">
                            လက်ရှိပွဲစဉ် (Active)
                          </span>
                        )}
                        {round.status === 'settled' && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-md font-bold">
                            ပေါက်ဂဏန်း: {round.winningNumber}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
                        <span>ရက်စွဲ: {round.drawDate}</span>
                        <span>ပိတ်ချိန်: {round.closingTime}</span>
                        <span>ပေါက်ကြေး: {round.multiplier}x / {round.toddMultiplier}x</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0">
                      {!isActive && (
                        <button
                          onClick={() => {
                            setActiveRoundId(round.id);
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 border border-slate-200 cursor-pointer"
                        >
                          <span>ဤပွဲသို့ ပြောင်းမည်</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {rounds.length > 1 && (
                        <button
                          onClick={() => deleteRound(round.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="ပွဲစဉ်ဖျက်မည်"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
