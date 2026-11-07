import React, { useState } from 'react';
import { Download, Smartphone, Monitor, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running as an installed PWA in standalone mode
  if (isInstalled) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>App သွင်းပြီးပါပြီ</span>
      </span>
    );
  }

  // Chromium / Android / Desktop direct prompt flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer shrink-0"
        title="ဖုန်း သို့မဟုတ် ကွန်ပျူတာထဲသို့ ရွှေမင်္ဂလာ App ထည့်သွင်းမည်"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>App သွင်းမည်</span>
      </button>
    );
  }

  // Fallback Guide for Desktop Browser or iOS Safari
  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
        title="ရွှေမင်္ဂလာ App အဖြစ် သွင်းယူရန် လမ်းညွှန်"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>App သွင်းမည်</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                {isIOS ? <Smartphone className="w-4 h-4 text-indigo-600" /> : <Monitor className="w-4 h-4 text-indigo-600" />}
                <span>ရွှေမင်္ဂလာ App ထည့်သွင်းနည်း (PWA App Install)</span>
              </h3>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="text-xs text-slate-700 space-y-2.5 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <p>၁။ Safari ဘရောက်ဇာ အောက်ခြေရှိ <b>Share ခလုတ် (မျှဝေရန် သင်္ကေတ)</b> ကို နှိပ်ပါ။</p>
                <p>၂။ အောက်သို့ဆွဲချပြီး <b>"Add to Home Screen (ပင်မစာမျက်နှာသို့ ထည့်ရန်)"</b> ကို ရွေးပါ။</p>
                <p>၃။ အပေါ်ညာဘက်ရှိ <b>"Add"</b> ကို နှိပ်လိုက်ပါက သင့်ဖုန်း ပင်မမျက်နှာပြင်တွင် <b>ရွှေမင်္ဂလာ App</b> အဖြစ် သုံးနိုင်ပါပြီ။</p>
              </div>
            ) : (
              <div className="text-xs text-slate-700 space-y-2.5 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <p><b>ကွန်ပျူတာ (Chrome / Edge Browser) တွင် App သွင်းနည်း:</b></p>
                <p>၁။ Browser ၏ အပေါ်ဘက် <b>URL Bar (လိပ်စာရိုက်သည့်ဘား)</b> ၏ ညာဘက်ထောင့်တွင် ပေါ်နေသော 📲 <b>"Install App"</b> သင်္ကေတကို နှိပ်ပါ။</p>
                <p>၂။ သို့မဟုတ် Browser မီနူး <code>...</code> &gt; <b>"Save and Share"</b> &gt; <b>"Install page as app"</b> (သို့မဟုတ် Install ရွှေမင်္ဂလာ) ကို နှိပ်ပါ။</p>
                <p>၃။ သင့် ကွန်ပျူတာ Desktop ပေါ်တွင် သီးသန့် Desktop Application အဖြစ် အဆင်သင့် သုံးနိုင်ပါပြီခင်ဗျာ။</p>
              </div>
            )}

            <button
              onClick={() => setShowGuide(false)}
              className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-black text-white hover:bg-indigo-700 cursor-pointer transition-colors shadow-xs"
            >
              နားလည်ပါပြီ
            </button>
          </div>
        </div>
      )}
    </>
  );
};
