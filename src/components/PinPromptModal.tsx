import React, { useState } from 'react';
import { Lock, KeyRound, Check, X, ShieldAlert, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { verifyOwnerPassword, isUsingDefaultPassword } from '../utils/securityUtils';

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
  title = 'ဆက်တင် လုံခြုံရေး Password စစ်ဆေးခြင်း',
  description = 'ပေါက်ဆ၊ ကော်မရှင်နှင့် စာရင်းစည်းမျဉ်းများ ပြင်ဆင်ရန် သီးသန့် Password ရိုက်ထည့်ပါ'
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const isDefault = isUsingDefaultPassword();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (verifyOwnerPassword(passwordInput)) {
      setPasswordInput('');
      onSuccess();
    } else {
      setErrorMsg('Password မှားယွင်းနေပါသည်! ပိုင်ရှင် သီးသန့် Password ကို ပြန်လည်စစ်ဆေးပါ');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white leading-tight">{title}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{description}</p>
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
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl p-3 flex items-center gap-2 shadow-2xs">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                ပိုင်ရှင် သီးသန့် Password / PIN:
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                {showPassword ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>ဝှက်မည်</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>ဖော်မည်</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
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
                placeholder="Password / PIN ရိုက်ထည့်ပါ"
                autoFocus
                autoComplete="current-password"
                className="w-full bg-slate-50 focus:bg-white border-2 border-slate-300 focus:border-indigo-600 rounded-2xl px-4 py-3 text-xl font-black font-mono tracking-widest text-center text-slate-900 outline-none transition-all shadow-2xs"
              />
            </div>

            <p className="text-[11px] text-slate-500 mt-2 leading-tight">
              * ပေါက်ဆ၊ အလျော်အစား၊ ကော်မရှင်နှင့် ဘရိတ် Limit များအား အခြားသူများ ဝင်ရောက်မပြင်ဆင်နိုင်စေရန် Password ဖြင့် ကာကွယ်ထားပါသည်။
            </p>

            {isDefault && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 font-semibold flex items-center gap-1.5">
                <span className="font-bold">သတိပေးချက်:</span>
                <span>မူလသတ်မှတ်ထားသော Password မှာ <b>123456</b> ဖြစ်ပါသည်။ ဆက်တင်ထဲတွင် မိမိစိတ်ကြိုက် အသစ်ပြောင်းလဲနိုင်ပါသည်။</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              မလုပ်တော့ပါ
            </button>
            <button
              type="submit"
              disabled={passwordInput.trim().length === 0}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <KeyRound className="w-4 h-4" />
              <span>အတည်ပြု ဝင်ရောက်မည်</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
