import React, { useState } from 'react';
import { X, HelpCircle, BookOpen, ChevronRight } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'3d' | '2d' | 'football'>('3d');
  if (!isOpen) return null;

  const renderContent = () => {
    switch (activeTab) {
      case '3d':
        return (
          <div className="space-y-4 text-xs text-slate-700">
            <h3 className="text-sm font-bold text-indigo-900">အိုးစည်လေး (3D) အသုံးပြုနည်း</h3>
            <p className="text-slate-600">(မှတ်ချက် - လက်ရှိ App မှ တကယ့် Screenshot များ မရရှိနိုင်သေးသဖြင့် စာသားဖြင့်သာ အသေးစိတ် လမ်းညွှန်ပေးထားပါသည်။)</p>
            <div className="space-y-3">
              <p className="font-bold text-slate-800">၁။ လုပ်ငန်းမိတ်ဆက်:</p>
              <p>အိုးစည်လေး (3D) သည် အမြန်စာရင်းသွင်းခြင်း၊ လက်ကျန်စစ်ဆေးခြင်းနှင့် ပေါက်ဂဏန်းတွက်ချက်ခြင်းအတွက် ဖြစ်သည်။</p>
              <p className="font-bold text-slate-800">၂။ အဆင့်လိုက် အသုံးပြုနည်း:</p>
              <p>က) <b>Quick Entry Tab</b> တွင် ဂဏန်း နှင့် ပမာဏကို ရိုက်ထည့်၍ အော်ဒါသွင်းပါ။</p>
              <p>ခ) <b>Ledger Tab</b> တွင် ရောင်းအားစုစုပေါင်းကို စစ်ဆေးပါ။</p>
              <p>ဂ) ပွဲပြီးပါက <b>Winning Tab</b> တွင် ပေါက်ဂဏန်းထည့်၍ ရှင်းတမ်းထုတ်ပါ။</p>
              <p className="font-bold text-slate-800">၃။ အမှားများနှင့် ဖြေရှင်းနည်း:</p>
              <p>- Limit ကျော်လွန်ပါက <b>LimitManagerModal</b> တွင် ဘရိတ် (Limits) ကို ပြန်လည်စစ်ဆေးပါ။</p>
            </div>
          </div>
        );
      case '2d':
        return (
          <div className="space-y-4 text-xs text-slate-700">
            <h3 className="text-sm font-bold text-teal-900">ဇီးကွက် (2D) အသုံးပြုနည်း</h3>
            <p className="text-slate-600">(မှတ်ချက် - လက်ရှိ App မှ တကယ့် Screenshot များ မရရှိနိုင်သေးသဖြင့် စာသားဖြင့်သာ အသေးစိတ် လမ်းညွှန်ပေးထားပါသည်။)</p>
            <div className="space-y-3">
              <p className="font-bold text-slate-800">၁။ လုပ်ငန်းမိတ်ဆက်:</p>
              <p>ဇီးကွက် (2D) သည် ဂဏန်းကွက်များမှတစ်ဆင့် အမြန်စာရင်းသွင်းရန် ဖြစ်သည်။</p>
              <p className="font-bold text-slate-800">၂။ အဆင့်လိုက် အသုံးပြုနည်း:</p>
              <p>က) <b>Quick Entry Tab</b> ရှိ Grid တွင် လိုချင်သော ဂဏန်းများကို နှိပ်ပါ။</p>
              <p>ခ) အောက်တွင် ငွေပမာဏကို ရွေးချယ်ပါ။</p>
              <p>ဂ) <b>Confirm Bet</b> ခလုတ်ကို နှိပ်၍ အတည်ပြုပါ။</p>
              <p className="font-bold text-slate-800">၃။ အမှားများနှင့် ဖြေရှင်းနည်း:</p>
              <p>- အော်ဒါမဝင်ပါက အင်တာနက် အခြေအနေနှင့် ပွဲစဉ်ဖွင့်ထားခြင်း ရှိ/မရှိ စစ်ဆေးပါ။</p>
            </div>
          </div>
        );
      case 'football':
        return (
          <div className="space-y-4 text-xs text-slate-700">
            <h3 className="text-sm font-bold text-emerald-900">ပစ်တိုင်းထောင် (Football) အသုံးပြုနည်း</h3>
            <p className="text-slate-600">(မှတ်ချက် - လက်ရှိ App မှ တကယ့် Screenshot များ မရရှိနိုင်သေးသဖြင့် စာသားဖြင့်သာ အသေးစိတ် လမ်းညွှန်ပေးထားပါသည်။)</p>
            <div className="space-y-3">
              <p className="font-bold text-slate-800">၁။ လုပ်ငန်းမိတ်ဆက်:</p>
              <p>ပစ်တိုင်းထောင် (Football) စနစ်သည် ပွဲစဉ်ဇယားနှင့် အမှာစာစီမံရန် ဖြစ်သည်။</p>
              <p className="font-bold text-slate-800">၂။ အဆင့်လိုက် အသုံးပြုနည်း:</p>
              <p>က) <b>Fixtures Tab</b> တွင် ပွဲစဉ်များကို ကြည့်ရှုပါ။</p>
              <p>ခ) <b>Ticket Entry Tab</b> တွင် အော်ဒါသွင်းပါ။</p>
              <p>ဂ) <b>Slips List Tab</b> တွင် အော်ဒါများကို ပြန်လည်စစ်ဆေးပါ။</p>
              <p className="font-bold text-slate-800">၃။ အမှားများနှင့် ဖြေရှင်းနည်း:</p>
              <p>- အော်ဒါစာရင်း မပေါ်ပါက <b>Slips List Tab</b> တွင် Date filter ကို မှန်ကန်စွာ ရွေးချယ်ထားခြင်း ရှိ/မရှိ စစ်ဆေးပါ။</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border border-indigo-100">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">အသုံးပြုသူ လမ်းညွှန်</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex border-b border-slate-200">
          {(['3d', '2d', 'football'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500'}`}>
              {tab === '3d' ? 'အိုးစည်' : tab === '2d' ? 'ဇီးကွက်' : 'ပစ်တိုင်းထောင်'}
            </button>
          ))}
        </div>
        <div className="p-4 sm:p-6 max-h-[60vh] overflow-y-auto">{renderContent()}</div>
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer">ပိတ်မည်</button>
        </div>
      </div>
    </div>
  );
};
