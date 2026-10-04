import React, { useState } from 'react';
import { Lock, KeyRound, Check, X, ShieldAlert } from 'lucide-react';
import { verifyOwnerPin } from '../utils/securityUtils';

interface PinPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export const PinPromptModal: React.FC<PinPromptModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = 'ပိုင်ရှင် လုံခြုံရေး PIN စစ်ဆေးခြင်း',
  description = 'အပြင်အဆင်နှင့် လျှို့ဝှက်ချက်များ ပြင်ဆင်ရန် ၆ လုံး PIN ရိုက်ထည့်ပါ'
}) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (verifyOwnerPin(pinInput)) {
      setPinInput('');
      onSuccess();
    } else {
      setErrorMsg('PIN နံပါတ် မှားယွင်းနေပါသည်! ပြန်လည်ရိုက်ထည့်ပါ');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">{title}</h3>
              <p className="text-[11px] text-slate-400">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl p-3 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 text-center">
              ပိုင်ရှင် PIN (ဂဏန်း ၆ လုံး):
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onFocus={(e) => e.target.select()}
              placeholder="••••••"
              autoFocus
              className="w-full bg-slate-50 focus:bg-white border-2 border-slate-300 focus:border-indigo-600 rounded-2xl px-4 py-3 text-2xl font-black font-mono tracking-widest text-center text-slate-900 outline-none transition-all shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              မလုပ်တော့ပါ
            </button>
            <button
              type="submit"
              disabled={pinInput.length !== 6}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>အတည်ပြုမည်</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
