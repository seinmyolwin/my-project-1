import React, { useState, useEffect } from 'react';
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
import { usePeriod } from '../context/PeriodContext';
import { DrawRound } from '../types';
import { getLocalDateString } from '../utils/moneyUtils';
import { verifyOwnerPassword } from '../utils/securityUtils';

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
    clearWinningSettlement,
    deleteRound,
    vouchers,
    forwardSlips,
    settings
  } = useLottery();
  const { isPeriodClosed: checkPeriodClosed } = usePeriod();

  const isMyanmar = settings.language === 'my';

  // New Round Form
  const [name, setName] = useState('');
  const [drawDate, setDrawDate] = useState(getLocalDateString());
  const [closingTime, setClosingTime] = useState('15:00');
  const [multiplier, setMultiplier] = useState(
    String(typeof settings.defaultMultiplier === 'number' ? settings.defaultMultiplier : 0)
  );
  const [toddMultiplier, setToddMultiplier] = useState(
    String(typeof settings.defaultToddMultiplier === 'number' ? settings.defaultToddMultiplier : 0)
  );

  useEffect(() => {
    setMultiplier(String(typeof settings.defaultMultiplier === 'number' ? settings.defaultMultiplier : 0));
    setToddMultiplier(String(typeof settings.defaultToddMultiplier === 'number' ? settings.defaultToddMultiplier : 0));
  }, [isOpen, settings.defaultMultiplier, settings.defaultToddMultiplier]);

  const [reopenTargetRound, setReopenTargetRound] = useState<DrawRound | null>(null);
  const [reopenPassword, setReopenPassword] = useState('');
  const [reopenError, setReopenError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setReopenTargetRound(null);
      setReopenPassword('');
      setReopenError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const activeRound = rounds.find(r => r.id === activeRoundId) || rounds[0];

  const handleRequestReopenSettled = (round: DrawRound) => {
    const closedPeriod = checkPeriodClosed('3D', round.drawDate);
    if (closedPeriod) return;
    setReopenTargetRound(round);
    setReopenPassword('');
    setReopenError(null);
  };

  const handleConfirmReopenWithPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenTargetRound) return;
    if (!verifyOwnerPassword(reopenPassword)) {
      setReopenError('လျှို့ဝှက်နံပါတ် (Password) မှားယွင်းနေပါသည်!');
      return;
    }
    try {
      clearWinningSettlement(reopenTargetRound.id);
      setReopenTargetRound(null);
      setReopenPassword('');
      setReopenError(null);
    } catch (err: any) {
      setReopenError(err?.message || 'ပွဲစဉ်ပြန်ဖွင့်၍ မရပါ');
    }
  };

  const handleToggleActiveRoundStatus = () => {
    if (!activeRound) return;
    if (activeRound.status === 'settled') {
      handleRequestReopenSettled(activeRound);
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
      multiplier: typeof settings.defaultMultiplier === 'number' ? settings.defaultMultiplier : 0,
      toddMultiplier: typeof settings.defaultToddMultiplier === 'number' ? settings.defaultToddMultiplier : 0,
      commissionRate: typeof settings.defaultCommissionRate === 'number' ? settings.defaultCommissionRate : 0
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
                        {isMyanmar ? 'ဖွင့်လှစ်ဆဲ' : 'Open'}
                      </span>
                    )}
                    {activeRound.status === 'closed' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white shadow-2xs">
                        <Lock className="w-3 h-3" />
                        {isMyanmar ? 'ပိတ်ပြီး' : 'Closed'}
                      </span>
                    )}
                    {activeRound.status === 'settled' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-600 text-white shadow-2xs">
                        <CheckCircle2 className="w-3 h-3" />
                        {isMyanmar ? `ပိတ်ပြီး — ပေါက်ဂဏန်း [${activeRound.winningNumber}]` : `Settled [${activeRound.winningNumber}]`}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-600 pt-0.5">
                    <span>ရက်စွဲ: {activeRound.drawDate}</span>
                    <span>ပိတ်ချိန်: {activeRound.closingTime}</span>
                    <span>ပေါက်ဆ: {typeof settings.defaultMultiplier === 'number' ? settings.defaultMultiplier : 0}x / {typeof settings.defaultToddMultiplier === 'number' ? settings.defaultToddMultiplier : 0}x</span>
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
                  {activeRound.status === 'settled' && (() => {
                    const closedPeriod = checkPeriodClosed('3D', activeRound.drawDate);
                    if (!closedPeriod) {
                      return (
                        <button
                          type="button"
                          onClick={() => handleRequestReopenSettled(activeRound)}
                          className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                          title="ကာလမပိတ်သေးသမျှ ပိုင်ရှင် Password ဖြင့် ပြန်ဖွင့်ပြင်ဆင်ရန်"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>{isMyanmar ? 'ပြန်ဖွင့်ပြင်မည်' : 'Reopen / Edit'}</span>
                        </button>
                      );
                    }
                    return (
                      <div className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-3 py-1.5 rounded-xl border border-amber-300 flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5" />
                        <span>ကာလပိတ်ပြီး (ပြင်၍မရပါ)</span>
                      </div>
                    );
                  })()}
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

          {/* Inline Owner Password Prompt for Reopening a Settled Round */}
          {reopenTargetRound && (
            <form onSubmit={handleConfirmReopenWithPassword} className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  [{reopenTargetRound.name}] (ပေါက်ဂဏန်း: {reopenTargetRound.winningNumber}) အား ပြန်လည်ဖွင့်လှစ်ပြင်ဆင်ရန် ပိုင်ရှင် လျှို့ဝှက်နံပါတ် (Owner Password) ထည့်ပါ
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  placeholder="လျှို့ဝှက်နံပါတ် (Default: 123456)"
                  value={reopenPassword}
                  onChange={(e) => {
                    setReopenPassword(e.target.value);
                    setReopenError(null);
                  }}
                  autoFocus
                  className="flex-1 bg-white border border-slate-300 focus:border-amber-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 font-mono outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  ပြန်ဖွင့်မည်
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReopenTargetRound(null);
                    setReopenPassword('');
                    setReopenError(null);
                  }}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  ပိတ်မည်
                </button>
              </div>
              {reopenError && (
                <p className="text-xs text-rose-600 font-bold">⚠️ {reopenError}</p>
              )}
            </form>
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
                  {isMyanmar ? 'တည့်ပေါက် ပေါက်ကြေး (ဆက်တင်မှ)' : 'Straight Multiplier (Settings)'}
                </label>
                <input
                  type="number"
                  value={multiplier}
                  readOnly
                  title={isMyanmar ? 'ဆက်တင်ထဲမှ သတ်မှတ်ထားသော တည့်ပေါက်ဆအတိုင်း တွက်ချက်ပါသည်' : 'Calculated from Settings'}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-600 outline-none cursor-not-allowed shadow-2xs"
                />
              </div>

              <div className="sm:col-span-6 space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  {isMyanmar ? 'ပတ်လည်ပေါက် ပေါက်ကြေး (ဆက်တင်မှ)' : 'Todd Multiplier (Settings)'}
                </label>
                <input
                  type="number"
                  value={toddMultiplier}
                  readOnly
                  title={isMyanmar ? 'ဆက်တင်ထဲမှ သတ်မှတ်ထားသော ပတ်လည်ပေါက်ဆအတိုင်း တွက်ချက်ပါသည်' : 'Calculated from Settings'}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-600 outline-none cursor-not-allowed shadow-2xs"
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
                            {isMyanmar ? `ပိတ်ပြီး — ပေါက်ဂဏန်း [${round.winningNumber}]` : `Settled [${round.winningNumber}]`}
                          </span>
                        )}
                        {round.status === 'closed' && (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] px-2 py-0.5 rounded-md font-bold">
                            {isMyanmar ? 'ပိတ်ပြီး' : 'Closed'}
                          </span>
                        )}
                        {round.status === 'open' && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2 py-0.5 rounded-md font-bold">
                            {isMyanmar ? 'ဖွင့်လှစ်ဆဲ' : 'Open'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-slate-500 font-mono text-[11px]">
                        <span>ရက်စွဲ: {round.drawDate}</span>
                        <span>ပိတ်ချိန်: {round.closingTime}</span>
                        <span>ပေါက်ကြေး: {typeof settings.defaultMultiplier === 'number' ? settings.defaultMultiplier : 0}x / {typeof settings.defaultToddMultiplier === 'number' ? settings.defaultToddMultiplier : 0}x</span>
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
                      {round.status === 'settled' && (() => {
                        const closedPeriod = checkPeriodClosed('3D', round.drawDate);
                        if (!closedPeriod) {
                          return (
                            <button
                              type="button"
                              onClick={() => handleRequestReopenSettled(round)}
                              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-300 cursor-pointer"
                              title="ကာလမပိတ်သေးသမျှ Password ဖြင့် ပြန်ဖွင့်ပြင်ဆင်မည်"
                            >
                              ပြန်ဖွင့်ပြင်မည်
                            </button>
                          );
                        }
                        return (
                          <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-lg border border-slate-200 inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" />
                            <span>ကာလပိတ်ပြီး</span>
                          </span>
                        );
                      })()}

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
                            const vCount = vouchers.filter(v => v.roundId === round.id).length;
                            const fCount = forwardSlips.filter(f => f.roundId === round.id).length;
                            let rCount = 0;
                            try {
                              const rawStored = localStorage.getItem('shwe_mingalar_copied_raw_texts');
                              if (rawStored) {
                                const parsed = JSON.parse(rawStored);
                                if (Array.isArray(parsed)) {
                                  rCount = parsed.filter((c: any) => c.roundId === round.id).length;
                                }
                              }
                            } catch {
                              // ignore
                            }
                            const confirmMsg = isMyanmar
                              ? `[${round.name}] ပွဲစဉ်ကို ဖျက်ရန် သေချာပါသလား?\n(ဘောင်ချာ ${vCount} ခု၊ ဒိုင်လွှဲ ${fCount} ခု၊ မူရင်းစာသား ${rCount} ခု ပါ ဖျက်မည်)`
                              : `Are you sure you want to delete [${round.name}]?\n(Will delete ${vCount} vouchers, ${fCount} forward slips, ${rCount} raw texts)`;
                            if (window.confirm(confirmMsg)) {
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
