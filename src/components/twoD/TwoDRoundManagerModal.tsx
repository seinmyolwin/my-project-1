import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  CheckCircle2,
  Lock,
  Unlock,
  AlertCircle,
  X,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useTwoDLottery } from '../../context/TwoDLotteryContext';
import { getLocalDateString } from '../../utils/moneyUtils';

interface TwoDRoundManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TwoDRoundManagerModal: React.FC<TwoDRoundManagerModalProps> = ({ isOpen, onClose }) => {
  const {
    rounds,
    activeRoundId,
    setActiveRoundId,
    createRound,
    updateRound,
    deleteRound,
    settings
  } = useTwoDLottery();

  const isMyanmar = settings.language === 'my';

  const [dateStr, setDateStr] = useState(getLocalDateString());
  const [session, setSession] = useState<'morning' | 'evening'>('morning');
  const getCleanMultiplier = (val?: number) => {
    let m = val || settings.defaultMultiplier || 80;
    return m;
  };
  const [multiplier, setMultiplier] = useState(String(getCleanMultiplier(settings.defaultMultiplier)));

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

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings.defaultMultiplier || settings.defaultMultiplier <= 0 || settings.defaultCommissionRate === undefined || settings.defaultCommissionRate < 0) {
      alert(isMyanmar 
        ? 'Settings တွင် ပေါက်ကြေးအဆ (Multiplier) နှင့် ကော်မရှင် (Commission) ကို ဦးစွာသတ်မှတ်ပေးရန် လိုအပ်ပါသည်။' 
        : 'Please configure default multiplier and commission in settings first');
      return;
    }

    if (dateStr < '2026-10-05') {
      alert(isMyanmar
        ? '၂၀၂၆-၁၀-၀၅ မတိုင်မီ ရက်စွဲများအတွက် ပွဲစဉ်အသစ် ဖန်တီး၍ မရပါတည်း။'
        : 'Cannot create draw rounds before 2026-10-05');
      return;
    }

    const sessionName = session === 'morning' ? 'မနက် (12:01 PM)' : 'ညနေ (04:30 PM)';
    const name = `${dateStr} ${sessionName}`;

    let parsedMult = parseFloat(multiplier) || settings.defaultMultiplier || 80;

    createRound({
      name,
      drawDate: dateStr,
      session,
      closingTime: session === 'morning' ? '12:00' : '16:25',
      multiplier: parsedMult,
      status: 'open',
      commissionRate: settings.defaultCommissionRate
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-5 border border-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold border border-teal-200 shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {isMyanmar ? 'ဇီးကွက် ပွဲစဉ်များ စီမံခန့်ခွဲခြင်း' : 'Manage 2D Draw Rounds'}
              </h3>
              <p className="text-xs text-slate-500">
                {isMyanmar ? 'လက်ရှိဖွင့်ထားသော ပွဲစဉ်ကြည့်ရှုခြင်း၊ ပွဲစဉ်ဖွင့်/ပိတ်ခြင်းနှင့် အသစ်စတင်ခြင်း' : 'View active round, toggle open/close status and create new rounds'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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
                  <span>ပေါက်ဆ: {activeRound.multiplier}x</span>
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

        {/* SECTION 2: Create New Round Form */}
        <form onSubmit={handleCreate} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3.5">
          <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 uppercase tracking-wider">
            <Plus className="w-4 h-4 text-teal-600" />
            <span>{isMyanmar ? 'နောက်ပွဲစဉ်အသစ် ဖွင့်လှစ်ရန်' : 'Open New Round'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isMyanmar ? 'ရက်စွဲ' : 'Date'}
              </label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 outline-none focus:border-teal-500 shadow-2xs"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                {isMyanmar ? 'အချိန်ပိုင်း' : 'Session'}
              </label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value as any)}
                className="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 outline-none focus:border-teal-500 shadow-2xs cursor-pointer"
              >
                <option value="morning">မနက် (12:01 PM)</option>
                <option value="evening">ညနေ (04:30 PM)</option>
              </select>
            </div>
          </div>

          <div className="text-xs">
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-700">
                {isMyanmar ? 'အလျော်ဆ' : 'Multiplier'}
              </label>
            </div>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={multiplier}
              onChange={(e) => {
                setMultiplier(e.target.value);
              }}
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
              placeholder="80"
              className="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white font-mono font-bold text-slate-800 outline-none focus:border-teal-500 shadow-2xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isMyanmar ? 'နောက်ပွဲစဉ်အသစ် ဖွင့်မည်' : 'Open Round'}</span>
            </button>
          </div>
        </form>

        {/* SECTION 3: Existing Rounds List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">
              {isMyanmar ? 'ရှိပြီးသား ပွဲစဉ်မှတ်တမ်းများ:' : 'All Draw Rounds:'}
            </span>
            <span className="text-[11px] text-slate-400">
              ({rounds.length} Rounds)
            </span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {rounds.map(r => {
              const isCurrent = r.id === activeRoundId;
              return (
                <div
                  key={r.id}
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                    isCurrent
                      ? 'bg-teal-50/70 border-teal-300 ring-1 ring-teal-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900">{r.name}</span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 bg-teal-600 text-white font-black text-[10px] rounded-md">
                          လက်ရှိ (Active)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500">
                        {r.status === 'settled' ? (
                          <span className="font-bold text-amber-700">
                            ပေါက်မဲ [{r.winningNumber}] ထွက်ပြီး (ပိတ်ပြီး)
                          </span>
                        ) : r.status === 'closed' ? (
                          <span className="font-bold text-rose-600">
                            ပိတ်ထားသည်
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-600">
                            ဖွင့်လှစ်ဆဲ
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        ({r.multiplier}x)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Toggle open/closed if not settled */}
                    {r.status === 'open' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`[${r.name}] ပွဲစဉ်ကို ပိတ်သိမ်းရန် သေချာပါသလား?`)) {
                            updateRound(r.id, { status: 'closed' });
                          }
                        }}
                        className="px-2 py-1 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 text-[11px] font-bold rounded-lg border border-slate-200 cursor-pointer"
                        title="ပွဲစဉ်ပိတ်မည်"
                      >
                        ပိတ်မည်
                      </button>
                    )}
                    {r.status === 'closed' && (
                      <button
                        type="button"
                        onClick={() => updateRound(r.id, { status: 'open' })}
                        className="px-2 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 text-[11px] font-bold rounded-lg border border-slate-200 cursor-pointer"
                        title="ပွဲစဉ်ပြန်ဖွင့်မည်"
                      >
                        ပြန်ဖွင့်မည်
                      </button>
                    )}

                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRoundId(r.id);
                          onClose();
                        }}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold rounded-lg border border-slate-200 flex items-center gap-1 cursor-pointer"
                      >
                        <span>ပြောင်းမည်</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}

                    {rounds.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('ပွဲစဉ်ကို ဖျက်ရန် သေချာပါသလား?')) {
                            deleteRound(r.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer transition-colors"
                        title="ဖျက်မည်"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
  );
};
