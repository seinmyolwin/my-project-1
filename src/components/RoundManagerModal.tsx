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
  ArrowRight,
  Lock,
  Unlock,
  AlertCircle
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
    updateRound,
    deleteRound,
    settings
  } = useLottery();

  const isMyanmar = settings.language === 'my';

  // New Round Form
  const [name, setName] = useState('');
  const [drawDate, setDrawDate] = useState(new Date().toISOString().slice(0, 10));
  const [closingTime, setClosingTime] = useState('15:00');
  const [multiplier, setMultiplier] = useState(String(settings.defaultMultiplier || ''));
  const [toddMultiplier, setToddMultiplier] = useState(String(settings.defaultToddMultiplier || ''));

  if (!isOpen) return null;

  const activeRound = rounds.find(r => r.id === activeRoundId) || rounds[0];

  const handleToggleActiveRoundStatus = () => {
    if (!activeRound) return;
    if (activeRound.status === 'settled') {
      alert(isMyanmar
        ? 'ပေါက်ဂဏန်း အတည်ပြုပြီးဖြစ်သော ပွဲစဉ်အား တိုက်ရိုက်ပြန်ဖွင့်၍ မရပါ။ စာရင်းအသစ်အတွက် ပွဲစဉ်အသစ် ဖွင့်လှစ်ပေးပါခင်ဗျာ။'
        : 'Settled rounds cannot be reopened directly. Please open a new round.');
      return;
    }

    if (activeRound.status === 'open') {
      if (window.confirm(isMyanmar
        ? `[${activeRound.name}] ပွဲစဉ်ကို ပိတ်သိမ်းရန် သေချာပါသလား?\n\n(ပွဲစဉ်ပိတ်ထားစဉ်အတွင်း ဂဏန်းများနှင့် ထိုးကြေးများ ရိုက်ထည့်နိုင်သော်လည်း အရောင်းဘောင်ချာ မှတ်တမ်းမယူပါ/စာရင်းမသွင်းပါ)`
        : 'Are you sure you want to close this round?')) {
        updateRound(activeRound.id, { status: 'closed' });
      }
    } else {
      updateRound(activeRound.id, { status: 'open' });
    }
  };

  const handleCreateRound = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createRound({
      name: name.trim(),
      drawDate,
      closingTime,
      status: 'open',
      multiplier: parseInt(multiplier, 10) || settings.defaultMultiplier || 0,
      toddMultiplier: parseInt(toddMultiplier, 10) || settings.defaultToddMultiplier || 0,
      commissionRate: settings.defaultCommissionRate || 0
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border border-indigo-200 shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {isMyanmar ? 'အိုးစည်လေး ပွဲစဉ်များ စီမံခန့်ခွဲမှု (Draw Rounds)' : 'Manage Lottery Rounds'}
              </h3>
              <p className="text-xs text-slate-500">
                {isMyanmar ? 'လက်ရှိဖွင့်ထားသော ပွဲစဉ်ကြည့်ရှုခြင်း၊ ပွဲစဉ်ဖွင့်/ပိတ်ခြင်းနှင့် အသစ်စတင်ခြင်း' : 'View active round, toggle open/close status and create new rounds'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* SECTION 1: Active Round Status Card */}
          {activeRound && (
            <div className={`p-4 rounded-2xl border-2 shadow-xs transition-all ${
              activeRound.status === 'open'
                ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-200/50'
                : activeRound.status === 'settled'
                ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-200/50'
                : 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-200/50'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    {isMyanmar ? 'လက်ရှိ ရွေးချယ်ထားသော ပွဲစဉ်:' : 'Active Selected Round:'}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-base font-black text-slate-900">
                      {activeRound.name}
                    </h4>
                    {activeRound.status === 'open' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-emerald-600 text-white shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        {isMyanmar ? 'ဖွင့်လှစ်ဆဲ (စာရင်းလက်ခံဆဲ)' : 'Open'}
                      </span>
                    )}
                    {activeRound.status === 'closed' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white shadow-2xs">
                        <Lock className="w-3 h-3" />
                        {isMyanmar ? 'ပွဲစဉ်ပိတ်ထားသည် (အရောင်းမယူပါ)' : 'Closed'}
                      </span>
                    )}
                    {activeRound.status === 'settled' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-600 text-white shadow-2xs">
                        <CheckCircle2 className="w-3 h-3" />
                        {isMyanmar ? `ပေါက်မဲ [${activeRound.winningNumber}] အတည်ပြုပြီး (ပိတ်ပြီး)` : `Settled [${activeRound.winningNumber}]`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-600 pt-0.5">
                    <span>ရက်စွဲ: {activeRound.drawDate}</span>
                    <span>ပိတ်ချိန်: {activeRound.closingTime}</span>
                    <span>ပေါက်ဆ: {activeRound.multiplier}x / {activeRound.toddMultiplier}x</span>
                  </div>
                </div>

                {/* Status Action Buttons for Active Round */}
                <div className="shrink-0 flex items-center gap-2">
                  {activeRound.status === 'open' && (
                    <button
                      type="button"
                      onClick={handleToggleActiveRoundStatus}
                      className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      title="လက်ရှိပွဲစဉ်အား ပိတ်သိမ်းရန်"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{isMyanmar ? 'ပွဲစဉ်ပိတ်မည်' : 'Close Round'}</span>
                    </button>
                  )}
                  {activeRound.status === 'closed' && (
                    <button
                      type="button"
                      onClick={handleToggleActiveRoundStatus}
                      className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                      title="ဤပွဲစဉ်အား ပြန်လည်ဖွင့်လှစ်ရန်"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>{isMyanmar ? 'ပွဲစဉ်ပြန်ဖွင့်မည်' : 'Re-open Round'}</span>
                    </button>
                  )}
                  {activeRound.status === 'settled' && (
                    <div className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-3 py-1.5 rounded-xl border border-amber-300">
                      {isMyanmar ? '⚠️ ပွဲစဉ်ပိတ်ပြီးဖြစ်ပါသည် (နောက်ပွဲစဉ်အသစ် ဖွင့်ပါ)' : 'Round settled. Please open a new round below.'}
                    </div>
                  )}
                </div>
              </div>

              {/* Note banner when round is not open */}
              {activeRound.status !== 'open' && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-start gap-2 text-xs text-slate-700">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    {isMyanmar
                      ? 'လက်ရှိပွဲစဉ် ပိတ်ထားသောကြောင့် အရောင်းဘောက်စ်တွင် စမ်းသပ်ရိုက်နှိပ်နိုင်သော်လည်း နောက်ပွဲစဉ်အသစ် မဖွင့်မချင်း အရောင်းဘောင်ချာ/စာရင်းများ လုံးဝမှတ်တမ်းမယူပါခင်ဗျာ။'
                      : 'This round is closed or settled. New sales entries will not be recorded until a new round is opened.'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: New Round Creation Card */}
          <form onSubmit={handleCreateRound} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3.5 shadow-2xs">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>{isMyanmar ? 'နောက်ပွဲစဉ်အသစ် ဖွင့်လှစ်ရန်' : 'Open New Round'}</span>
            </h4>

            {/* Quick Name Buttons */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500 font-bold">{isMyanmar ? 'အမြန်ရွေးရန်:' : 'Presets:'}</span>
              <button
                type="button"
                onClick={() => setQuickThaiRound(1)}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-indigo-700 font-bold shadow-2xs cursor-pointer"
              >
                ၁ ရက်နေ့ ပွဲစဉ်
              </button>
              <button
                type="button"
                onClick={() => setQuickThaiRound(16)}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-indigo-700 font-bold shadow-2xs cursor-pointer"
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

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isMyanmar ? 'နောက်ပွဲစဉ်အသစ် ဖွင့်မည်' : 'Open Round'}</span>
              </button>
            </div>
          </form>

          {/* SECTION 3: Existing Rounds List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-600">
                {isMyanmar ? 'ရှိပြီးသား ပွဲစဉ်မှတ်တမ်းများ အားလုံး' : 'All Draw Rounds'}
              </h4>
              <span className="text-[11px] text-slate-400">
                ({rounds.length} Rounds)
              </span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{round.name}</span>
                        {isActive && (
                          <span className="bg-indigo-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full shadow-2xs">
                            လက်ရှိ (Active)
                          </span>
                        )}
                        {round.status === 'settled' && (
                          <span className="bg-amber-50 text-amber-800 border border-amber-300 text-[10px] px-2 py-0.5 rounded-md font-bold">
                            ပေါက်မဲ: {round.winningNumber} (ပိတ်ပြီး)
                          </span>
                        )}
                        {round.status === 'closed' && (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] px-2 py-0.5 rounded-md font-bold">
                            ပိတ်ထားသည်
                          </span>
                        )}
                        {round.status === 'open' && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-md font-bold">
                            ဖွင့်လှစ်ဆဲ
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
                      {/* Toggle close/reopen */}
                      {round.status === 'open' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`[${round.name}] ပွဲစဉ်ကို ပိတ်သိမ်းရန် သေချာပါသလား?`)) {
                              updateRound(round.id, { status: 'closed' });
                            }
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-[11px] font-bold rounded-lg border border-slate-200 cursor-pointer"
                          title="ပွဲစဉ်ပိတ်မည်"
                        >
                          ပိတ်မည်
                        </button>
                      )}
                      {round.status === 'closed' && (
                        <button
                          type="button"
                          onClick={() => updateRound(round.id, { status: 'open' })}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 text-[11px] font-bold rounded-lg border border-slate-200 cursor-pointer"
                          title="ပွဲစဉ်ပြန်ဖွင့်မည်"
                        >
                          ပြန်ဖွင့်မည်
                        </button>
                      )}

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
                          onClick={() => {
                            if (window.confirm('ပွဲစဉ်ကို ဖျက်ရန် သေချာပါသလား?')) {
                              deleteRound(round.id);
                            }
                          }}
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
