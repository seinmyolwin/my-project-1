import React, { useState } from 'react';
import { ShieldCheck, Lock, CheckCircle2, Layers, ArrowRight, KeyRound, Sparkles } from 'lucide-react';
import { saveOwnerPin, saveEnabledModes, EnabledModes } from '../utils/securityUtils';

interface FirstTimePinSetupModalProps {
  isOpen: boolean;
  onCompleted: (modes: EnabledModes) => void;
}

export const FirstTimePinSetupModal: React.FC<FirstTimePinSetupModalProps> = ({
  isOpen,
  onCompleted
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Selected Modes Setup
  const [modes, setModes] = useState<EnabledModes>({
    '3d': true,
    '2d': true,
    'football': true
  });

  if (!isOpen) return null;

  const handleToggleMode = (key: keyof EnabledModes) => {
    setModes(prev => {
      const next = { ...prev, [key]: !prev[key] };
      // Ensure at least 1 mode is active
      if (!next['3d'] && !next['2d'] && !next['football']) {
        return prev;
      }
      return next;
    });
  };

  const handleSaveSetup = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setErrorMsg('PIN နံပါတ်သည် ဂဏန်း ၆ လုံး တိတိကျကျ ဖြစ်ရပါမည်');
      return;
    }

    if (pin !== confirmPin) {
      setErrorMsg('PIN နံပါတ်နှစ်ခု တူညီမှု မရှိပါ! ပြန်လည်စစ်ဆေးပါ');
      return;
    }

    const pinSaved = saveOwnerPin(pin);
    if (!pinSaved) {
      setErrorMsg('PIN နံပါတ် သိမ်းဆည်းရာတွင် အမှားအယွင်း ရှိနေပါသည်');
      return;
    }

    saveEnabledModes(modes);
    onCompleted(modes);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-300">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 border-b border-slate-800 text-center relative">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-400 flex items-center justify-center mx-auto mb-3 shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-white">
            ရွှေမင်္ဂလာ စနစ်စတင်အသုံးပြုခြင်း
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            ပိုင်ရှင် လုံခြုံရေး PIN (ဂဏန်း ၆ လုံး) နှင့် ဆောင်ရွက်မည့် လုပ်ငန်းအမျိုးအစားများကို သတ်မှတ်ပါ
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSaveSetup} className="p-6 space-y-6">
          
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl p-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping shrink-0"></span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Business Modes Selection */}
          <div className="space-y-3">
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>၁။ ဆောင်ရွက်မည့် လုပ်ငန်းအမျိုးအစားများ ရွေးချယ်ရန်:</span>
            </label>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Mode 3D */}
              <button
                type="button"
                onClick={() => handleToggleMode('3d')}
                className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                  modes['3d']
                    ? 'border-indigo-600 bg-indigo-50/60 text-indigo-950 shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-400 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center ${
                    modes['3d'] ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    3D
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-black block">အိုးစည်လေး (3D ချဲဒိုင်)</span>
                    <span className="text-[11px] text-slate-500">သုံးလုံး ချဲ အရောင်း/အဝယ် နှင့် ဒိုင်လယ်ဂျာ</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${
                  modes['3d'] ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {modes['3d'] && <CheckCircle2 className="w-4 h-4" />}
                </div>
              </button>

              {/* Mode 2D */}
              <button
                type="button"
                onClick={() => handleToggleMode('2d')}
                className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                  modes['2d']
                    ? 'border-teal-600 bg-teal-50/60 text-teal-950 shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-400 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center ${
                    modes['2d'] ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    2D
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-black block">ဇီးကွက် (2D ထီဒိုင်)</span>
                    <span className="text-[11px] text-slate-500">နှစ်လုံး ထီ မနက်/ညနေ အရောင်းနှင့် လယ်ဂျာ</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${
                  modes['2d'] ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {modes['2d'] && <CheckCircle2 className="w-4 h-4" />}
                </div>
              </button>

              {/* Mode Football */}
              <button
                type="button"
                onClick={() => handleToggleMode('football')}
                className={`p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                  modes['football']
                    ? 'border-emerald-600 bg-emerald-50/60 text-emerald-950 shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-400 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center ${
                    modes['football'] ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    FB
                  </div>
                  <div className="text-left">
                    <span className="text-sm font-black block">ပစ်တိုင်းထောင် (Football ဘောလုံးဒိုင်)</span>
                    <span className="text-[11px] text-slate-500">ဘော်ဒီ၊ ဂိုးပေါင်း နှင့် မောင်းစာရင်းစနစ်</span>
                  </div>
                </div>
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center border ${
                  modes['football'] ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {modes['football'] && <CheckCircle2 className="w-4 h-4" />}
                </div>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              * မလုပ်ကိုင်သော လုပ်ငန်းများကို ပိတ်ထားပါက အက်ပ်မီနူးတွင် လုံးဝ ပေါ်လာတော့မည် မဟုတ်ပါ။
            </p>
          </div>

          {/* Section 2: Owner 6-Digit PIN Code */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <label className="block text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-600" />
              <span>၂။ ပိုင်ရှင် လုံခြုံရေး PIN ဂဏန်း ၆ လုံး သတ်မှတ်ရန်:</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  PIN နံပါတ် (ဂဏန်း ၆ လုံး):
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onFocus={(e) => e.target.select()}
                  placeholder="123456"
                  className="w-full bg-slate-50 focus:bg-white border-2 border-slate-300 focus:border-indigo-600 rounded-xl px-3.5 py-2.5 text-xl font-black font-mono tracking-widest text-center text-slate-900 outline-none transition-all shadow-2xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  PIN အား အတည်ပြုပါ:
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onFocus={(e) => e.target.select()}
                  placeholder="123456"
                  className="w-full bg-slate-50 focus:bg-white border-2 border-slate-300 focus:border-indigo-600 rounded-xl px-3.5 py-2.5 text-xl font-black font-mono tracking-widest text-center text-slate-900 outline-none transition-all shadow-2xs"
                  required
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500">
              * Account Name တောင်းဆိုမည် မဟုတ်ပါ၊ ဆက်တင်နှင့် လုံခြုံရေးနေရာများ ဝင်ရောက်ရန် ဤ PIN Code အား လျှို့ဝှက် မှတ်သားထားပါ။
            </p>
          </div>

          {/* Submit */}
          <div className="pt-3">
            <button
              type="submit"
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer"
            >
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <span>စနစ်စတင် အသုံးပြုမည် (Start Operating System)</span>
              <ArrowRight className="w-4 h-4 text-indigo-400" />
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
