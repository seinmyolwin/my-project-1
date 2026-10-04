import React, { useState } from 'react';
import { ShieldCheck, Lock, CheckCircle2, Layers, ArrowRight, KeyRound, Sparkles } from 'lucide-react';
import { saveOwnerPin, saveEnabledModes, EnabledModes } from '../utils/securityUtils';
import { AppLogo } from './AppLogo';

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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[94vh] flex flex-col justify-between">
        
        {/* Header - Compact */}
        <div className="bg-slate-900 text-white p-3.5 sm:p-4 border-b border-slate-800 text-center relative shrink-0">
          <div className="flex justify-center mb-1.5">
            <AppLogo size="sm" />
          </div>
          <h2 className="text-base font-black tracking-tight text-white">
            ရွှေမင်္ဂလာ စာရင်းစီမံခန့်ခွဲမှုစနစ်
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            ပိုင်ရှင် လုံခြုံရေး PIN (၆ လုံး) နှင့် စီမံမည့် လိုင်းများကို သတ်မှတ်ပါ
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveSetup} className="p-3.5 sm:p-4 space-y-3 overflow-y-auto">
          
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl p-2.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping shrink-0"></span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Business Modes Selection - Compact Grid */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-800 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>၁။ ဆောင်ရွက်မည့် စာရင်းလိုင်းများ ရွေးချယ်ရန်:</span>
            </label>

            <div className="grid grid-cols-1 gap-1.5">
              {/* Mode 3D */}
              <button
                type="button"
                onClick={() => handleToggleMode('3d')}
                className={`p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                  modes['3d']
                    ? 'border-indigo-600 bg-indigo-50/60 text-indigo-950 font-bold shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-400 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center ${
                    modes['3d'] ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    L-1
                  </span>
                  <div className="text-left leading-tight">
                    <span className="text-xs font-black block">အိုးစည်လေး (3D)</span>
                    <span className="text-[10px] text-slate-500">၃ လုံး စာရင်းသွင်းခြင်းနှင့် နေ့စဉ်ချုပ်</span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                  modes['3d'] ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {modes['3d'] && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
              </button>

              {/* Mode 2D */}
              <button
                type="button"
                onClick={() => handleToggleMode('2d')}
                className={`p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                  modes['2d']
                    ? 'border-teal-600 bg-teal-50/60 text-teal-950 font-bold shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-400 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center ${
                    modes['2d'] ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    L-2
                  </span>
                  <div className="text-left leading-tight">
                    <span className="text-xs font-black block">ဇီးကွက် (2D)</span>
                    <span className="text-[10px] text-slate-500">၂ လုံး မနက်/ညနေ စာရင်းသွင်းခြင်း</span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                  modes['2d'] ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {modes['2d'] && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
              </button>

              {/* Mode Football */}
              <button
                type="button"
                onClick={() => handleToggleMode('football')}
                className={`p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                  modes['football']
                    ? 'border-emerald-600 bg-emerald-50/60 text-emerald-950 font-bold shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-400 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center ${
                    modes['football'] ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}>
                    L-3
                  </span>
                  <div className="text-left leading-tight">
                    <span className="text-xs font-black block">ပစ်တိုင်းထောင် (အားကစား)</span>
                    <span className="text-[10px] text-slate-500">ပွဲစဉ်များနှင့် စာရင်းမှတ်တမ်း</span>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                  modes['football'] ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {modes['football'] && <CheckCircle2 className="w-3.5 h-3.5" />}
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: Owner PIN */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-black text-slate-800 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
              <span>၂။ ပိုင်ရှင် လုံခြုံရေး PIN (ဂဏန်း ၆ လုံး) သတ်မှတ်ရန်:</span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  PIN နံပါတ်:
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onFocus={(e) => e.target.select()}
                  placeholder="123456"
                  className="w-full bg-slate-50 focus:bg-white border-2 border-slate-300 focus:border-indigo-600 rounded-xl px-2.5 py-1.5 text-lg font-black font-mono tracking-widest text-center text-slate-900 outline-none transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  အတည်ပြုပါ:
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onFocus={(e) => e.target.select()}
                  placeholder="123456"
                  className="w-full bg-slate-50 focus:bg-white border-2 border-slate-300 focus:border-indigo-600 rounded-xl px-2.5 py-1.5 text-lg font-black font-mono tracking-widest text-center text-slate-900 outline-none transition-all"
                  required
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              * Account Name မလိုပါ၊ ဆက်တင်နှင့် လုံခြုံရေးနေရာများ ဝင်ရောက်ရန် ဤ PIN Code အား လျှို့ဝှက် မှတ်သားထားပါ။
            </p>
          </div>

          {/* Submit */}
          <div className="pt-1">
            <button
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>စနစ် စတင်အသုံးပြုမည်</span>
              <ArrowRight className="w-3.5 h-3.5 text-indigo-400" />
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
