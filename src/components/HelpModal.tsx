import React from 'react';
import {
  X,
  HelpCircle,
  Zap,
  RotateCcw,
  Sparkles,
  TrendingUp,
  FileSpreadsheet,
  ShieldAlert,
  Sliders,
  CheckCircle2
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border border-indigo-100">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                အိုးစည်လေး (3D)၊ ဇီးကွက် (2D)၊ ပစ်တိုင်းထောင် (Football) စာရင်းစနစ် အသုံးပြုနည်း လမ်းညွှန်
              </h3>
              <p className="text-xs text-slate-500">
                IT Expert မှ ထည့်သွင်းပေးထားသော အဓိက Feature များနှင့် အသုံးပြုပုံ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-slate-700 leading-relaxed">
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
            <h4 className="font-bold text-indigo-700 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-600" />
              ၁။ အမြန် အရောင်းစာရင်းသွင်းခြင်း (Quick Entry & Batch Paste)
            </h4>
            <p>
              - <b>ဂဏန်း ၃ လုံး နှင့် ထိုးကြေးငွေ</b> ရိုက်ထည့်ပြီး Enter နှိပ်ရုံဖြင့် လျင်မြန်စွာ စာရင်းသွင်းနိုင်ပါသည်။
            </p>
            <p>
              - <b>ပတ်လည် (R / Permutations):</b> ဥပမာ <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-indigo-700 font-bold font-mono">123 R</code> ရွေးလိုက်ပါက 123, 132, 213, 231, 312, 321 (၆ ခွေ) ကို အလိုအလျောက် ခွဲထုတ်ပေးပါသည်။
            </p>
            <p>
              - <b>Viber/SMS စာသား ကူးထည့်ခြင်း (Batch Paste):</b> Viber သို့မဟုတ် Messenger မှ ပို့ထားသော စာသားများ (ဥပမာ <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-mono">123=1000, 456-500, 789R=1000</code>) ကို ကူးယူထည့်သွင်းနိုင်ပါသည်။
            </p>
            <p>
              - <b>အထူးဂဏန်းအတွဲများ:</b> အပူး (000-999)၊ ပါဝါအတွဲများ၊ နက္ခတ်အတွဲများ၊ ညီကိုအတွဲများကို တစ်ချက်နှိပ်ရုံဖြင့် အမြန်ထည့်နိုင်ပါသည်။
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
            <h4 className="font-bold text-indigo-700 text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" />
              ၂။ ပေါက်ဂဏန်းနှင့် လျော်ကြေး ချက်ချင်းတွက်ချက်ခြင်း (Instant Settlement)
            </h4>
            <p>
              - <b>ပေါက်ဂဏန်း ထည့်သွင်းခြင်း:</b> ထိုင်း 3D ပေါက်ဂဏန်း ၃ လုံး (ဥပမာ <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-indigo-700 font-bold font-mono">853</code>) နှင့် ပေါက်ကြေးအဆ (ဥပမာ <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 text-indigo-700 font-bold font-mono">600 ဆ</code>) ထည့်ပေးလိုက်သည်နှင့် တစ်ပြိုင်နက် -
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600">
              <li>မည်သူတွေ ပေါက်သွားသလဲ (တည့်ပေါက်နှင့် ပတ်လည်ပေါက်)</li>
              <li>ဘယ်သူ့ကို ဘယ်လောက် လျော်ပေးရမလဲ (စုစုပေါင်း လျော်ကြေးငွေ)</li>
              <li>ဒိုင်၏ စုစုပေါင်း ရောင်းရငွေ၊ အသားတင် <b>အမြတ် သို့မဟုတ် အရှုံး</b> ကို တခါတည်း အလိုအလျောက် ရှင်းလင်းစွာ တွက်ချက်ပေးပါသည်။</li>
              <li>ပေါက်သူထံသို့ Viber/SMS ဖြင့် ပို့နိုင်သော ဂုဏ်ပြုစာသားကို တစ်ချက်နှိပ် ကူးယူနိုင်ပါသည်။</li>
            </ul>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
            <h4 className="font-bold text-indigo-700 text-sm flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              ၃။ Excel ဖိုင် ထုတ်ယူခြင်း (Full Excel Export)
            </h4>
            <p>
              - အပေါ်ဘက်ရှိ <b>"Excel ထုတ်ရန်"</b> ခလုတ်ကို နှိပ်လိုက်ပါက ရုံးသုံးအတွက် လိုအပ်သော အရောင်းစာရင်းချုပ်၊ ပေါက်ဂဏန်းနှင့် လျော်ကြေးစာရင်း၊ ဘောင်ချာများ၊ အထက်တင်စာရင်းများအားလုံးကို Excel (.xlsx) အနေဖြင့် ပြီးပြည့်စုံစွာ ထုတ်ပေးပါသည်။
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 shadow-2xs">
            <h4 className="font-bold text-indigo-700 text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
              ၄။ အန္တရာယ်ထိန်းချုပ်ခြင်း၊ ဘရိတ်သတ်မှတ်ခြင်းနှင့် အထက်တင်ခြင်း (Hedging)
            </h4>
            <p>
              - <b>ဘရိတ် (Limits) သတ်မှတ်ခြင်း:</b> ဂဏန်းတစ်ခုချင်းအလိုက် အများဆုံးရောင်းမည့်ငွေ သတ်မှတ်ထားနိုင်ပြီး သတ်မှတ်ငွေနီးပါက Notification ဖြင့် သတိပေးပါသည်။
            </p>
            <p>
              - <b>အထက်တင်/ဖြတ်တင် (Forwarding):</b> အထွက်များပြီး လျော်ကြေးအန္တရာယ်ရှိသော ဂဏန်းများကို အဓိကဒိုင်ချုပ်ကြီးထံသို့ လွှဲတင်ပြီး ကော်မရှင် (Commission %) ရယူနိုင်ပါသည်။
            </p>
            <p>
              - <b>What-If Risk Simulator:</b> ပေါက်ဂဏန်းမထွက်မီ မည်သည့်ဂဏန်းထွက်ပါက အမြတ်/အရှုံး မည်မျှရှိမည်ကို ကြိုတင်စမ်းသပ်တွက်ချက်နိုင်ပါသည်။
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer"
          >
            နားလည်ပါပြီ
          </button>
        </div>

      </div>
    </div>
  );
};
