import React, { useState } from 'react';
import { Download, Smartphone, X, Check } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
        title="ဖုန်း သို့မဟုတ် ကွန်ပျူတာထဲသို့ ရွှေမင်္ဂလာ App ထည့်သွင်းမည်"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden md:inline">ရွှေမင်္ဂလာ App သွင်းမည်</span>
        <span className="md:hidden">App သွင်းမည်</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
          title="iPhone / iPad တွင် ရွှေမင်္ဂလာ App အဖြစ်သွင်းရန်"
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden md:inline">ရွှေမင်္ဂလာ App သွင်းရန်</span>
          <span className="md:hidden">App သွင်းမည်</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  ရွှေမင်္ဂလာ App ကို iPhone / iPad တွင် သွင်းနည်း
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-600 space-y-2 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p>၁။ Safari ဘရောက်ဇာ၏ အောက်ခြေရှိ <b>Share ခလုတ် (မျှဝေရန် သင်္ကေတ)</b> ကို နှိပ်ပါ။</p>
                <p>၂။ အောက်သို့ဆွဲချပြီး <b>"Add to Home Screen (ပင်မစာမျက်နှာသို့ ထည့်ရန်)"</b> ကို ရွေးပါ။</p>
                <p>၃။ အပေါ်ညာဘက်ရှိ <b>"Add"</b> ကို နှိပ်လိုက်ပါက သင့်ဖုန်း ပင်မမျက်နှာပြင်တွင် <b>ရွှေမင်္ဂလာ</b> လိုဂိုနှင့် အမည်ဖြင့် App အဖြစ် အဆင်သင့် သုံးနိုင်ပါပြီ။</p>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white hover:bg-indigo-700"
              >
                နားလည်ပါပြီ
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
