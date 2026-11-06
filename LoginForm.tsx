import React, { useState, useEffect, useRef } from 'react';
import { Lock, KeyRound, Eye, EyeOff, ShieldCheck, ShieldAlert, ArrowRight, Delete, CheckCircle2, RotateCcw } from 'lucide-react';
import { AppLogo } from './AppLogo';
import {
  hasOwnerPassword,
  verifyOwnerPassword,
  saveOwnerPassword,
  isValidSixDigitPin
} from '../utils/securityUtils';

interface LoginFormProps {
  onLoginSuccess: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [hasPassword, setHasPassword] = useState<boolean>(() => hasOwnerPassword());

  // Login Mode State
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Initial Setup Mode State (if no password exists yet)
  const [newPin, setNewPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [setupStep, setSetupStep] = useState<'create' | 'confirm'>('create');

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, [hasPassword, setupStep]);

  // Handle PIN submission
  const handleLoginSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (pin.length !== 6) {
      setErrorMsg('ဂဏန်း ၆ လုံး ပြည့်အောင် ရိုက်ထည့်ပါ');
      triggerShake();
      return;
    }

    if (verifyOwnerPassword(pin)) {
      setErrorMsg('');
      onLoginSuccess();
    } else {
      setErrorMsg('Password မှားယွင်းနေပါသည်! ပြန်လည်စစ်ဆေးပါ');
      triggerShake();
      setPin('');
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  // Virtual Keypad click handler for tablets and phones
  const handleKeypadPress = (val: string) => {
    setErrorMsg('');
    if (hasPassword) {
      if (val === 'clear') {
        setPin('');
        return;
      }
      if (val === 'backspace') {
        setPin(prev => prev.slice(0, -1));
        return;
      }
      if (pin.length < 6) {
        const next = pin + val;
        setPin(next);
        if (next.length === 6) {
          // Auto verify when 6th digit entered
          setTimeout(() => {
            if (verifyOwnerPassword(next)) {
              onLoginSuccess();
            } else {
              setErrorMsg('Password မှားယွင်းနေပါသည်! ပြန်လည်စစ်ဆေးပါ');
              triggerShake();
              setPin('');
            }
          }, 150);
        }
      }
    } else {
      // Setup Mode Keypad
      if (setupStep === 'create') {
        if (val === 'clear') {
          setNewPin('');
          return;
        }
        if (val === 'backspace') {
          setNewPin(prev => prev.slice(0, -1));
          return;
        }
        if (newPin.length < 6) {
          const next = newPin + val;
          setNewPin(next);
          if (next.length === 6) {
            setTimeout(() => setSetupStep('confirm'), 200);
          }
        }
      } else {
        if (val === 'clear') {
          setConfirmPin('');
          return;
        }
        if (val === 'backspace') {
          setConfirmPin(prev => prev.slice(0, -1));
          return;
        }
        if (confirmPin.length < 6) {
          const next = confirmPin + val;
          setConfirmPin(next);
          if (next.length === 6) {
            setTimeout(() => {
              if (newPin === next) {
                const saved = saveOwnerPassword(next);
                if (saved) {
                  setHasPassword(true);
                  onLoginSuccess();
                } else {
                  setErrorMsg('Password သိမ်းဆည်းရာတွင် အမှားအယွင်း ရှိပါသည်');
                }
              } else {
                setErrorMsg('Password နှစ်ကြိမ် ရိုက်ထည့်မှု တူညီခြင်း မရှိပါ! ပြန်စပါ');
                triggerShake();
                setConfirmPin('');
                setSetupStep('create');
                setNewPin('');
              }
            }, 200);
          }
        }
      }
    }
  };

  // Setup handler for form submission
  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!isValidSixDigitPin(newPin)) {
      setErrorMsg('Password သည် ဂဏန်း ၆ လုံး (0-9) အတိအကျ ဖြစ်ရပါမည်');
      triggerShake();
      return;
    }

    if (newPin !== confirmPin) {
      setErrorMsg('Password အသစ် နှစ်ခု တူညီမှု မရှိပါ! ပြန်လည်စစ်ဆေးပါ');
      triggerShake();
      return;
    }

    const saved = saveOwnerPassword(newPin);
    if (saved) {
      setHasPassword(true);
      onLoginSuccess();
    } else {
      setErrorMsg('Password သိမ်းဆည်းရာတွင် အမှားအယွင်း ရှိပါသည်');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto selection:bg-indigo-500 selection:text-white">
      {/* Background glowing effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-sm sm:max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-7 text-white flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
        
        {/* App Logo & Title */}
        <div className="flex flex-col items-center text-center mb-5">
          <div className="p-2.5 bg-slate-800/90 rounded-2xl border border-slate-700/80 shadow-lg mb-3">
            <AppLogo size="lg" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            ရွှေမင်္ဂလာ
          </h1>
          <p className="text-xs text-indigo-300 font-bold mt-0.5">
            အိုးစည်လေး၊ ဇီးကွက် နှင့် ပစ်တိုင်းထောင် စာရင်းစနစ်
          </p>
        </div>

        {/* ============================================================ */}
        {/* SCENARIO A: NORMAL LOGIN (Owner Password Configured) */}
        {/* ============================================================ */}
        {hasPassword ? (
          <form onSubmit={handleLoginSubmit} className="w-full space-y-4">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>ပိုင်ရှင် လုံခြုံရေး Password ရိုက်ထည့်ပါ</span>
              </div>
              <p className="text-[11px] text-slate-400">
                ဂဏန်း ၆ လုံး သတ်မှတ်ထားသော Password ဖြင့် ဝင်ရောက်ပါ
              </p>
            </div>

            {/* Error Notification */}
            {errorMsg && (
              <div className="p-2.5 bg-rose-950/80 border border-rose-700/80 text-rose-200 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in shadow-sm">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* PIN Dots Display & Hidden Input */}
            <div className="flex flex-col items-center space-y-3">
              <div
                className={`flex items-center justify-center gap-3 py-2 cursor-pointer transition-transform ${
                  isShaking ? 'animate-bounce text-rose-400' : ''
                }`}
                onClick={() => inputRef.current?.focus()}
              >
                {[0, 1, 2, 3, 4, 5].map((index) => {
                  const digit = pin[index];
                  const isFilled = digit !== undefined;
                  return (
                    <div
                      key={index}
                      className={`w-10 h-12 rounded-xl flex items-center justify-center font-mono font-black text-xl transition-all border-2 ${
                        isFilled
                          ? 'border-indigo-500 bg-indigo-950/40 text-white shadow-sm ring-1 ring-indigo-400/40'
                          : 'border-slate-700 bg-slate-800/60 text-slate-500'
                      }`}
                    >
                      {isFilled ? (showPin ? digit : '•') : ''}
                    </div>
                  );
                })}
              </div>

              {/* Real hidden/accessible input for hardware keyboards */}
              <div className="relative w-full flex items-center justify-center">
                <input
                  ref={inputRef}
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setPin(clean);
                    setErrorMsg('');
                    if (clean.length === 6) {
                      setTimeout(() => {
                        if (verifyOwnerPassword(clean)) {
                          onLoginSuccess();
                        } else {
                          setErrorMsg('Password မှားယွင်းနေပါသည်! ပြန်လည်စစ်ဆေးပါ');
                          triggerShake();
                          setPin('');
                        }
                      }, 150);
                    }
                  }}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                  autoFocus
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPin ? 'ဂဏန်းများဝှက်မည်' : 'ဂဏန်းများဖော်မည်'}</span>
                </button>
              </div>
            </div>

            {/* Touch Keypad for Tablet & Phone Ease of Use */}
            <div className="grid grid-cols-3 gap-2 pt-1 max-w-[280px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeypadPress(num)}
                  className="h-12 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:bg-indigo-600 text-white font-mono font-black text-xl flex items-center justify-center border border-slate-700/80 transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleKeypadPress('clear')}
                className="h-12 rounded-2xl bg-slate-800/50 hover:bg-slate-700 active:bg-rose-900 text-slate-400 hover:text-white font-bold text-xs flex items-center justify-center border border-slate-700/60 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="h-12 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:bg-indigo-600 text-white font-mono font-black text-xl flex items-center justify-center border border-slate-700/80 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('backspace')}
                className="h-12 rounded-2xl bg-slate-800/50 hover:bg-slate-700 active:bg-slate-600 text-slate-300 font-bold flex items-center justify-center border border-slate-700/60 transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Login Action Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={pin.length !== 6}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <KeyRound className="w-4 h-4" />
                <span>ဝင်ရောက်မည် (Login)</span>
              </button>
            </div>
          </form>
        ) : (
          /* ============================================================ */
          /* SCENARIO B: INITIAL PASSWORD SETUP (Owner Custom 6 Digits) */
          /* ============================================================ */
          <form onSubmit={handleSetupSubmit} className="w-full space-y-4">
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/80 text-xs font-bold text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>ပိုင်ရှင်သီးသန့် Password အသစ် သတ်မှတ်ပါ</span>
              </div>
              <p className="text-[11px] text-slate-400">
                ဂဏန်း ၆ လုံး မိမိစိတ်ကြိုက် သတ်မှတ်ပါ (၁၂၃၄၅၆ ကို အသေမသုံးပါနှင့်)
              </p>
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-rose-950/80 border border-rose-700/80 text-rose-200 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in shadow-sm">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ၁။ Password အသစ် (ဂဏန်း ၆ လုံး):
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="ဂဏန်း ၆ လုံး ရိုက်ထည့်ပါ"
                  className="w-full bg-slate-800 border-2 border-slate-700 focus:border-indigo-500 rounded-2xl p-3 text-lg font-mono font-black text-center text-white outline-none tracking-widest shadow-inner"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ၂။ Password အား အတည်ပြုပါ:
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="အထက်ပါ ၆ လုံး အတည်ပြုပါ"
                  className="w-full bg-slate-800 border-2 border-slate-700 focus:border-indigo-500 rounded-2xl p-3 text-lg font-mono font-black text-center text-white outline-none tracking-widest shadow-inner"
                  required
                />
              </div>

              <p className="text-[10px] text-slate-400 leading-tight">
                * ဆက်တင်၊ ကန့်သတ်ချက် Limit များနှင့် စာရင်းဒေတာများအား လုံခြုံစေရန် ဤ Password ဖြင့် ကာကွယ်ထားပါမည်။
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={newPin.length !== 6 || confirmPin.length !== 6}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Password သတ်မှတ်ပြီး စတင်အသုံးပြုမည်</span>
              </button>
            </div>
          </form>
        )}

        <div className="mt-5 text-center text-[10px] text-slate-500">
          ရွှေမင်္ဂလာ စာရင်းစီမံခန့်ခွဲမှုစနစ် • အဆင့်မြင့် လုံခြုံရေးစနစ်
        </div>

      </div>
    </div>
  );
};
