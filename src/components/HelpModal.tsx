import React, { useState } from 'react';
import {
  X,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Layers,
  Calendar,
  PlusCircle,
  TrendingUp,
  Sparkles,
  Receipt,
  Camera,
  Printer,
  Trophy,
  ShieldAlert,
  ArrowRight,
  Info,
  Search,
  FileText,
  Sliders,
  DollarSign,
  Clock,
  RotateCcw
} from 'lucide-react';

const img3D = new URL('../assets/images/3d_manual_screenshot_1791710120960.jpg', import.meta.url).href;
const img2D = new URL('../assets/images/2d_manual_screenshot_1791710099057.jpg', import.meta.url).href;
const imgFB = new URL('../assets/images/football_manual_screenshot_1791710146156.jpg', import.meta.url).href;

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  // Exactly THREE manual tabs as strictly commanded
  const [activeTab, setActiveTab] = useState<'3d' | '2d' | 'football'>('3d');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Bar */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/40 text-amber-300 flex items-center justify-center font-black shadow-inner">
              <BookOpen className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>ရွှေမင်္ဂလာ စာရင်းစနစ် — အသုံးပြုသူ လမ်းညွှန်</span>
                <span className="text-[11px] bg-amber-400/20 text-amber-300 border border-amber-400/40 px-2 py-0.5 rounded-full font-bold">
                  Burmese User Manual
                </span>
              </h2>
              <p className="text-xs text-slate-300 font-medium">
                ၃ မျိုးသော စာရင်းကဏ္ဍများအတွက် ပြည့်စုံလက္ခဏာရပ်များနှင့် လက်တွေ့လုပ်ဆောင်ပုံ အဆင့်ဆင့်
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="ပိတ်မည်"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection Bar — EXACTLY THREE TABS */}
        <div className="flex border-b border-slate-200 bg-slate-100/80 px-2 sm:px-6 pt-2 shrink-0 gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('3d')}
            className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-black rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-t border-x ${
              activeTab === '3d'
                ? 'bg-white text-indigo-700 border-slate-200 border-b-white -mb-px shadow-xs'
                : 'bg-transparent text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
            <span>3D — အိုးစည်လေး</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('2d')}
            className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-black rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-t border-x ${
              activeTab === '2d'
                ? 'bg-white text-teal-700 border-slate-200 border-b-white -mb-px shadow-xs'
                : 'bg-transparent text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-teal-600"></span>
            <span>2D — ဇီးကွက်</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('football')}
            className={`px-4 sm:px-6 py-3 text-xs sm:text-sm font-black rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-t border-x ${
              activeTab === 'football'
                ? 'bg-white text-emerald-700 border-slate-200 border-b-white -mb-px shadow-xs'
                : 'bg-transparent text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-200/60'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            <span>Football — ပစ်တိုင်းထောင်</span>
          </button>
        </div>

        {/* Scrollable Manual Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-8 bg-white">
          {activeTab === '3d' && <ThreeDManualView />}
          {activeTab === '2d' && <TwoDManualView />}
          {activeTab === 'football' && <FootballManualView />}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
            လက်ရှိဖွင့်ထားသော လမ်းညွှန် -{' '}
            <span className="font-bold text-slate-800">
              {activeTab === '3d'
                ? '3D — အိုးစည်လေး (ထိုင်း ၃ လုံး)'
                : activeTab === '2d'
                ? '2D — ဇီးကွက် (ထိုင်း ၂ လုံး မနက်/ညနေ)'
                : 'Football — ပစ်တိုင်းထောင် (ဘောလုံး ဘော်ဒီ/မောင်း)'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm ml-auto"
          >
            ပိတ်မည် (Close)
          </button>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// TAB 1: 3D — အိုးစည်လေး အသုံးပြုသူ လမ်းညွှန်
// =========================================================================
const ThreeDManualView: React.FC = () => {
  return (
    <div className="space-y-8 text-slate-800 leading-relaxed text-xs sm:text-sm">
      {/* Module Title Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-5 rounded-2xl shadow-sm border border-indigo-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-200 text-xs font-black mb-2 border border-indigo-400/30">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>အိုးစည်လေး (Thai 3D Lottery Management)</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white">
            ၃ လုံး (3D) စာရင်းစီမံခန့်ခွဲမှုစနစ် ပြည့်စုံလက်စွဲ
          </h3>
          <p className="text-xs text-indigo-200 mt-1 max-w-2xl font-medium">
            ထိုင်း ၃ လုံး (000 မှ 999) ထိုးကြေးများ လက်ခံခြင်း၊ အကန့်အသတ် (Limits) သတ်မှတ်ခြင်း၊ အထက်ဒိုင်သို့ လက်လွှဲခြင်း (Forwarding)၊ ပေါက်ဂဏန်းထွက်ပါက တွက်ချက်ခြင်းနှင့် စာရင်းရှင်းတမ်း ထုတ်ယူခြင်းတို့ကို အသေးစိတ် ဖော်ပြထားပါသည်။
          </p>
        </div>
      </div>

      {/* A. လုပ်ငန်းမိတ်ဆက် */}
      <section className="space-y-3 border-l-4 border-indigo-600 pl-4 py-1">
        <h4 className="text-base font-black text-indigo-950 flex items-center gap-2">
          <span>A. လုပ်ငန်းမိတ်ဆက်</span>
        </h4>
        <div className="space-y-2 text-slate-700">
          <p>
            <b>အိုးစည်လေး (3D)</b> သည် ထိုင်းထီပေါက်ဂဏန်း (လဆန်း ၁ ရက် နှင့် ၁၆ ရက်) အခြေခံ ၃ လုံးထီ စာရင်းများအတွက် တည်ဆောက်ထားသော ဘိုကင်နှင့် ဒိုင်စာရင်း စီမံခန့်ခွဲမှုစနစ် ဖြစ်သည်။
          </p>
          <p><b>အသုံးပြုသူ လုပ်ဆောင်နိုင်သည့် အဓိကလုပ်ငန်းများ:</b></p>
          <ul className="list-disc list-inside space-y-1 ml-2 text-slate-700">
            <li><b>အမြန်စာရင်းသွင်းခြင်း:</b> ဝယ်သူအမည်၊ ဂဏန်း (၃ လုံး)၊ ငွေပမာဏ၊ R (ပတ်လည် ၆ ခွေ သို့မဟုတ် ၃ ခွေ) တွဲစပ်သွင်းယူခြင်း။</li>
            <li><b>စာသားကူးယူသွင်းခြင်း (Batch Paste):</b> Viber သို့မဟုတ် Telegram မှ ရောက်လာသော "123=1000, 456-500, 789 R 1000" ကဲ့သို့ စာသားများကို ကူးယူထည့်ရုံဖြင့် အလိုအလျောက် ပိုင်းခြားသွင်းယူနိုင်ခြင်း။</li>
            <li><b>ကင်မရာ/ပုံဖတ် စနစ် (OCR Scanner):</b> ပြေစာစလစ်ဓာတ်ပုံ (သို့) Chat Screenshot များကို စကင်ဖတ်၍ ဂဏန်းနှင့် ပမာဏများကို အလိုအလျောက် ထုတ်ယူနိုင်ခြင်း။</li>
            <li><b>အကန့်အသတ် ထိန်းချုပ်ခြင်း (Limits & Risk Control):</b> ဂဏန်းတစ်လုံးချင်းအလိုက် (သို့) စုစုပေါင်း အများဆုံးရောင်းချမည့် ဘရိတ်သတ်မှတ်ခြင်းနှင့် ပိတ်ဂဏန်းများ သတ်မှတ်နိုင်ခြင်း။</li>
            <li><b>အထက်ဒိုင်သို့ လက်လွှဲခြင်း (Forwarding):</b> သတ်မှတ် limit ကျော်လွန်သော ဂဏန်းများကို မဟာဒိုင်/အထက်ဒိုင်သို့ ကော်မရှင်နှုန်းထားဖြင့် တင်သွင်းလွှဲပြောင်းနိုင်ခြင်း။</li>
            <li><b>ပေါက်ဂဏန်းတွက်ချက်ခြင်း:</b> ဒဲ့ပေါက်ကြေး (ဥပမာ 600x) နှင့် တွဒ်/ပတ်လည်ပေါက်ကြေး (ဥပမာ 100x) များကို စနစ်တကျ ချက်ချင်းတွက်ချက်၍ အမြတ်/အရှုံး ရှင်းတမ်းထုတ်ယူနိုင်ခြင်း။</li>
          </ul>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 mt-2">
            <p className="font-bold flex items-center gap-1.5 text-amber-950">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>သတိပြုရန် စည်းမျဉ်းများ (Code-Verified):</span>
            </p>
            <p className="mt-1">
              - ၃ လုံးဂဏန်းများသည် <b>000 မှ 999</b> အထိ အတိအကျ ၃ လုံး ဖြစ်ရပါမည် (၂ လုံးရိုက်ထည့်ပါက စနစ်မှ ငြင်းပယ်ပါသည်)။
              <br />
              - ပေါက်ဂဏန်းရှင်းတမ်း ပြန်လည်ပြင်ဆင်/ဖျက်သိမ်းလိုပါက လုံခြုံရေးအရ ပိုင်ရှင်၏ <b>Owner Password / PIN</b> အား ရိုက်ထည့်အတည်ပြုရန် လိုအပ်ပါသည်။
            </p>
          </div>
        </div>
      </section>

      {/* B. Screen တစ်ခုချင်းစီ၏ အသုံးပြုပုံ */}
      <section className="space-y-4 border-l-4 border-indigo-600 pl-4 py-1">
        <h4 className="text-base font-black text-indigo-950 flex items-center gap-2">
          <span>B. Screen တစ်ခုချင်းစီ၏ အသုံးပြုပုံ</span>
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Screen 1 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <span className="font-bold text-indigo-900 text-xs px-2 py-0.5 bg-indigo-100 rounded-md">Screen 1</span>
            <h5 className="font-black text-slate-900 text-sm">အမြန်စာရင်းသွင်းရန် (Quick Sale Entry)</h5>
            <p className="text-slate-600 text-xs">
              <b>ရည်ရွယ်ချက်:</b> ဝယ်သူထံမှ ထိုးကြေးများအား ဘောက်ချာတစ်ခုချင်းအလိုက် တိကျစွာ လက်ခံမှတ်တမ်းတင်ရန်။
            </p>
            <div className="text-xs space-y-1 text-slate-700">
              <p><b>အရေးကြီး အကွက်များနှင့် ခလုတ်များ:</b></p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li><b>ဝယ်သူအမည်:</b> မဖြစ်မနေလိုအပ် (မူလအခြေအနေတွင် "အထွေထွေ (General)" ဖြစ်သည်)။</li>
                <li><b>ဖုန်းနံပါတ်:</b> လိုအပ်ပါက ထည့်သွင်းနိုင် (Optional)။</li>
                <li><b>ကော်မရှင် လျော့ငွေ %:</b> ဝယ်သူအား ပေးမည့် Discount ရာခိုင်နှုန်း (ဥပမာ 0% သို့ 10%)။</li>
                <li><b>ဂဏန်း (Number Input):</b> ၃ လုံးဂဏန်း (ဥပမာ 789)။</li>
                <li><b>ငွေပမာဏ (Amount):</b> ထိုးငွေ (ဥပမာ 1000)။</li>
                <li><b>R (Rumble / ပတ်လည်):</b> ဖွင့်ထားပါက ထိုဂဏန်း၏ လှည့်တွဲအားလုံးကို အလိုအလျောက် ခွဲထုတ်သွင်းပေးသည်။</li>
                <li><b>"စာရင်းထဲထည့်မည် (+)" ခလုတ်:</b> ရိုက်ထည့်ထားသော ကွက်များကို လက်ရှိဘောက်ချာထဲသို့ ယာယီထည့်သွင်းသည်။</li>
                <li><b>"စာသားဖြင့် အများအပြားသွင်းရန် (Batch)" ခလုတ်:</b> Text စာကြောင်းများ ကူးယူထည့်သွင်းရန်။</li>
                <li><b>"ကင်မရာ/ပုံဖတ် စကင်နာ" ခလုတ်:</b> စလစ်ဓာတ်ပုံဖတ်ရန်။</li>
                <li><b>"ဘောင်ချာ သိမ်းဆည်းမည်" ခလုတ်:</b> စာရင်းအား အပြီးသတ်သိမ်းဆည်းပြီး ပြေစာအမှတ် (ဥပမာ V-3D-1001) ထုတ်ပေးသည်။</li>
              </ul>
            </div>
          </div>

          {/* Screen 2 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <span className="font-bold text-indigo-900 text-xs px-2 py-0.5 bg-indigo-100 rounded-md">Screen 2</span>
            <h5 className="font-black text-slate-900 text-sm">စာရင်းချုပ် (Master Ledger - ၀၀၀ မှ ၉၉၉)</h5>
            <p className="text-slate-600 text-xs">
              <b>ရည်ရွယ်ချက်:</b> ၃ လုံးဂဏန်း ၁၀၀၀ ကွက်လုံး၏ စုစုပေါင်း ရောင်းရငွေ၊ ကိုင်ထားငွေ၊ အထက်ဒိုင်လွှဲငွေနှင့် အန္တရာယ်အခြေအနေ (Risk Level) ကို စောင့်ကြည့်ရန်။
            </p>
            <div className="text-xs space-y-1 text-slate-700">
              <p><b>အရေးကြီး အကွက်များနှင့် ခလုတ်များ:</b></p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li><b>Search Input:</b> မိမိရှာဖွေလိုသော ၃ လုံးဂဏန်း (ဥပမာ 123) ကို ရိုက်ရှာနိုင်။</li>
                <li><b>Filter Buttons:</b> အားလုံး၊ ရောင်းအားရှိသော (Hot)၊ အန္တရာယ်ရှိ (Danger)၊ သတိပေး (Warning)၊ ပိတ်ထားသော (Blocked)၊ အလွတ် (Empty)။</li>
                <li><b>အကွက်တစ်ခုချင်း၏ အချက်အလက်:</b> ရောင်းရငွေ (Total Sold)၊ Limit၊ လက်ကျန်၊ လျော်ရနိုင်ခြေ (Estimated Payout)။</li>
                <li><b>Excel ထုတ်ယူရန် ခလုတ်:</b> လက်ရှိစာရင်းချုပ်တစ်ခုလုံးကို Excel ဖိုင် (.xlsx) ဖြင့် ကွန်ပျူတာ/ဖုန်းထဲသို့ Download ဆွဲနိုင်။</li>
              </ul>
            </div>
          </div>

          {/* Screen 3 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <span className="font-bold text-indigo-900 text-xs px-2 py-0.5 bg-indigo-100 rounded-md">Screen 3</span>
            <h5 className="font-black text-slate-900 text-sm">ရလဒ်စစ်ဆေး & ရှင်းတမ်း (Verification & Settlement)</h5>
            <p className="text-slate-600 text-xs">
              <b>ရည်ရွယ်ချက်:</b> ထိုင်းထီပေါက်ဂဏန်း ထွက်ပေါ်လာချိန်တွင် ပေါက်ဂဏန်းထည့်သွင်း၍ ပေါက်သူများနှင့် လျော်ကြေးငွေများ အလိုအလျောက် ရှင်းတမ်းထုတ်ရန်။
            </p>
            <div className="text-xs space-y-1 text-slate-700">
              <p><b>အရေးကြီး အကွက်များနှင့် ခလုတ်များ:</b></p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li><b>ပေါက်ဂဏန်း အကွက်:</b> တရားဝင်ထွက်ရှိသော ၃ လုံး (ဥပမာ 789)။</li>
                <li><b>ဒဲ့အဆ (Multiplier):</b> ဒဲ့ပေါက်ကြေးဆ (ပုံမှန် 600 ဆ)။</li>
                <li><b>တွဒ်/ပတ်လည်အဆ (Todd Multiplier):</b> တွဒ်ပေါက်ကြေးဆ (ပုံမှန် 100 ဆ)။</li>
                <li><b>"ပေါက်ဂဏန်း အတည်ပြုပြီး ရှင်းတမ်းထုတ်မည်" ခလုတ်:</b> နှိပ်လိုက်ပါက စနစ်မှ ဘောက်ချာအားလုံးကို စစ်ဆေးပေးသည်။</li>
                <li><b>အသားတင် အမြတ်/အရှုံး ဖော်ပြချက်:</b> စုစုပေါင်းရောင်းရငွေနှင့် လျော်ကြေးငွေ နှိုင်းယှဉ်ချက်အား စိမ်း/နီ ဖြင့် ရှင်းလင်းစွာ ပြသသည်။</li>
                <li><b>"ပွဲစဉ်အသစ် စတင်မည်" ခလုတ်:</b> ယခင်စာရင်းအား သိမ်းဆည်းပြီး နောက်ထပ် ၁၅ ရက်အကြာ ပွဲစဉ်အသစ် ဖွင့်လှစ်ပေးသည်။</li>
              </ul>
            </div>
          </div>

          {/* Screen 4 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <span className="font-bold text-indigo-900 text-xs px-2 py-0.5 bg-indigo-100 rounded-md">Screen 4</span>
            <h5 className="font-black text-slate-900 text-sm">ပြေစာမှတ်တမ်းများ (Vouchers / Invoices)</h5>
            <p className="text-slate-600 text-xs">
              <b>ရည်ရွယ်ချက်:</b> ထုတ်ပေးထားပြီးသော ဘောက်ချာစလစ်များအားလုံးကို ပြန်လည်ရှာဖွေခြင်း၊ ပုံနှိပ်ခြင်း (Print) နှင့် ပယ်ဖျက်ခြင်း ပြုလုပ်ရန်။
            </p>
            <div className="text-xs space-y-1 text-slate-700">
              <p><b>အရေးကြီး အကွက်များနှင့် ခလုတ်များ:</b></p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li><b>Search Input:</b> ဘောက်ချာနံပါတ် သို့မဟုတ် ဝယ်သူအမည်ဖြင့် ရှာဖွေနိုင်။</li>
                <li><b>Print ခလုတ်:</b> Bluetooth Thermal Printer (58mm / 80mm) သို့မဟုတ် A4 ဖြင့် စလစ်ထုတ်ပေးခြင်း။</li>
                <li><b>Cancel / Delete ခလုတ်:</b> အမှားပါသော ဘောက်ချာအား ပြန်လည်ဖျက်သိမ်းခြင်း။</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* C. အဆင့်လိုက် လက်တွေ့လုပ်ဆောင်နည်း */}
      <section className="space-y-4 border-l-4 border-indigo-600 pl-4 py-1">
        <h4 className="text-base font-black text-indigo-950 flex items-center gap-2">
          <span>C. အဆင့်လိုက် လက်တွေ့လုပ်ဆောင်နည်း</span>
        </h4>

        {/* Workflow 1 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
          <h5 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 text-indigo-900">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">၁</span>
            <span>၃ လုံး ထိုးကြေး တစ်ကွက်ချင်း သွင်းခြင်းနှင့် ဘောက်ချာသိမ်းဆည်းနည်း</span>
          </h5>
          <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 ml-2">
            <li><b>ဘယ် Screen ကို ဖွင့်ရမလဲ:</b> Header ရှိ "အိုးစည်လေး" ကို ရွေးပြီး <b>"အမြန်စာရင်းသွင်းရန် (Quick Entry)"</b> Tab ကို နှိပ်ပါ။</li>
            <li><b>ဘယ်အကွက်မှာ ဘာဖြည့်ရမလဲ:</b> ဝယ်သူအမည် (ဥပမာ "ကိုအောင်")၊ လျော့ငွေ % (ဥပမာ "10") ကို ထည့်ပါ။</li>
            <li><b>ဂဏန်းနှင့် ငွေပမာဏ ဖြည့်သွင်းခြင်း:</b> "ဂဏန်း" အကွက်တွင် "789"၊ "ငွေပမာဏ" အကွက်တွင် "1000" ဟု ရိုက်ထည့်ပါ။</li>
            <li><b>ဘာကို ရွေးချယ်ရမလဲ:</b> တည့်သာထိုးမည်ဆိုပါက R ကို ပိတ်ထားပါ၊ ပတ်လည်ထိုးမည်ဆိုပါက <b>"R (ပတ်လည်)"</b> ကို အမှန်ခြစ်ပါ။</li>
            <li><b>ဘယ်ခလုတ်ကို နှိပ်ရမလဲ:</b> <b>"စာရင်းထဲထည့်မည် (+)"</b> ခလုတ်ကို နှိပ်ပါ။ စာရင်းဇယားတွင် အဝါရောင် draft အဖြစ် ပေါ်လာပါမည်။</li>
            <li><b>ဘယ်ခလုတ်နဲ့ သိမ်းဆည်းရမလဲ:</b> အောက်ခြေရှိ <b>"ဘောင်ချာ သိမ်းဆည်းမည် (Save Voucher)"</b> ခလုတ်ကို နှိပ်ပါ။</li>
            <li><b>သိမ်းဆည်းပြီးနောက် ဘယ်နေရာမှာ ပြန်စစ်ရမလဲ:</b> <b>"ပြေစာမှတ်တမ်းများ (Vouchers)"</b> Tab သို့ သွားရောက်၍ ဘောက်ချာအမှတ် V-3D-xxx ကို စစ်ဆေးပါ။</li>
            <li><b>အောင်မြင်ကြောင်း ဘယ်လိုအတည်ပြုရမလဲ:</b> "ဘောင်ချာ သိမ်းဆည်းပြီးပါပြီ" Toast အချက်ပြသံ မြည်လာပြီး Print Preview ပေါ်လာပါက အောင်မြင်ပါသည်။</li>
          </ol>
        </div>

        {/* Workflow 2 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
          <h5 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 text-indigo-900">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">၂</span>
            <span>Viber/Telegram မှ စာသားကူးယူပြီး အများအပြား တစ်ပြိုင်နက်သွင်းနည်း (Batch Mode)</span>
          </h5>
          <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 ml-2">
            <li><b>ဘယ် Screen ကို ဖွင့်ရမလဲ:</b> <b>"အမြန်စာရင်းသွင်းရန်"</b> Tab ပေါ်ရှိ <b>"စာသားဖြင့် အများအပြားသွင်းရန် (FileText icon)"</b> ခလုတ်ကို နှိပ်ပါ။</li>
            <li><b>ဘယ်အကွက်မှာ ဘာဖြည့်ရမလဲ:</b> ပေါ်လာသော Box တွင် Chat မှ ကူးယူလာသော စာသားများ (ဥပမာ "123=1000, 456-500, 789 R 1000") ကို Paste လုပ်ထည့်ပါ။</li>
            <li><b>ဘာကို ရွေးချယ်ရမလဲ:</b> စနစ်မှ မြန်မာဂဏန်း (၁၂၃) များကို အင်္ဂလိပ်ဂဏန်း (123) သို့ အလိုအလျောက် ပြောင်းလဲစိစစ်ပေးပါသည်။</li>
            <li><b>ဘယ်ခလုတ်ကို နှိပ်ရမလဲ:</b> <b>"စစ်ဆေးပြီး စာရင်းထဲထည့်မည်"</b> ခလုတ်ကို နှိပ်ပါ။</li>
            <li><b>အောင်မြင်ကြောင်း ဘယ်လိုအတည်ပြုရမလဲ:</b> အမှားရှိပါက အနီရောင်စာတန်းဖြင့် အသိပေးမည်ဖြစ်ပြီး၊ မှန်ကန်ပါက ကွက်အရေအတွက်အားလုံး ဇယားထဲသို့ ချက်ချင်းဝင်ရောက်သွားပါမည်။</li>
          </ol>
        </div>

        {/* Workflow 3 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
          <h5 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 text-indigo-900">
            <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs">၃</span>
            <span>ထိုင်းထီပေါက်ဂဏန်းထွက်ပါက ရှင်းတမ်းထုတ်ယူနည်း (Settlement)</span>
          </h5>
          <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 ml-2">
            <li><b>ဘယ် Screen ကို ဖွင့်ရမလဲ:</b> <b>"ရလဒ်စစ်ဆေး & ရှင်းတမ်း"</b> Tab ကို ဖွင့်ပါ။</li>
            <li><b>ဘယ်အကွက်မှာ ဘာဖြည့်ရမလဲ:</b> "ပေါက်ဂဏန်း" အကွက်တွင် ထွက်ဂဏန်း ၃ လုံး (ဥပမာ "789") ကို ထည့်ပါ။</li>
            <li><b>ပေါက်ကြေးနှုန်းထား စစ်ဆေးခြင်း:</b> ဒဲ့ပေါက်ကြေးဆ (600) နှင့် တွဒ်ပေါက်ကြေးဆ (100) မှန်ကန်မှု ရှိ/မရှိ စစ်ပါ။</li>
            <li><b>ဘယ်ခလုတ်ကို နှိပ်ရမလဲ:</b> <b>"ပေါက်ဂဏန်း အတည်ပြုပြီး ရှင်းတမ်းထုတ်မည်"</b> ခလုတ်ကို နှိပ်ပါ။</li>
            <li><b>သိမ်းဆည်းပြီးနောက် ဘယ်နေရာမှာ ပြန်စစ်ရမလဲ:</b> အောက်ခြေရှိ "ပေါက်သူများ စာရင်း" တွင် မည်သည့်ဝယ်သူ မည်မျှပေါက်သည်ကို စစ်ဆေးပါ။</li>
            <li><b>အောင်မြင်ကြောင်း ဘယ်လိုအတည်ပြုရမလဲ:</b> စုစုပေါင်း ပေးလျော်ငွေနှင့် ဒိုင်အမြတ်/ရှုံး ကိန်းဂဏန်းများ အစိမ်း/အနီဖြင့် တွက်ချက်ပြသလာပါမည်။</li>
          </ol>
        </div>
      </section>

      {/* D. နမူနာဖြင့် ရှင်းပြခြင်း */}
      <section className="space-y-3 border-l-4 border-indigo-600 pl-4 py-1">
        <h4 className="text-base font-black text-indigo-950 flex items-center gap-2">
          <span>D. နမူနာဖြင့် ရှင်းပြခြင်း (Safe Practical Calculation)</span>
        </h4>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
          <p className="font-bold text-slate-900">လက်တွေ့ နမူနာ စာရင်းသွင်းမှုနှင့် ပေါက်ကြေးတွက်ချက်ပုံ:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
              <span className="font-bold text-indigo-700 block">အဝင်ဒေတာ (Input Sample):</span>
              <p>ဝယ်သူအမည်: <b>ကိုမင်း</b></p>
              <p>ထိုးကွက် ၁: <b>789</b> ဒဲ့ (တည့်) = <b>1,000 Ks</b></p>
              <p>ထိုးကွက် ၂: <b>123</b> R (ပတ်လည် ၆ ခွေ) = <b>500 Ks စီ</b> (123, 132, 213, 231, 312, 321 x 500 = 3,000 Ks)</p>
              <p>စုစုပေါင်း ထိုးကြေး (Subtotal): <b>4,000 Ks</b></p>
              <p>ဝယ်သူ လျော့ငွေ (Discount 10%): <b>-400 Ks</b></p>
              <p className="font-bold text-emerald-700">ဝယ်သူ အမှန်ပေးရငွေ (Net Payable): <b>3,600 Ks</b></p>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
              <span className="font-bold text-indigo-700 block">ပေါက်ဂဏန်းထွက်ပေါ်မှုနှင့် လျော်ကြေး (Payout Result):</span>
              <p>ထွက်ဂဏန်း: <b>789</b></p>
              <p>ဒဲ့ပေါက်ကြေးဆ: <b>600 ဆ</b> | တွဒ်ပေါက်ကြေးဆ: <b>100 ဆ</b></p>
              <p>• ကွက် ၁ (789 ဒဲ့): 1,000 x 600 = <b>600,000 Ks ပေါက်သည်</b></p>
              <p>• ကွက် ၂ (123 R): ပေါက်ဂဏန်းနှင့် မတူသဖြင့် <b>မပေါက်ပါ</b></p>
              <p className="font-bold text-rose-700">ဒိုင်မှ ပေးလျော်ရမည့်ငွေ: <b>600,000 Ks</b></p>
              <p className="text-slate-500 text-[11px] mt-1">
                * အကယ်၍ ထွက်ဂဏန်းသည် "132" ဖြစ်ခဲ့ပါက 123 R ထိုးထားသူသည် 500 x 600 = 300,000 Ks (ဒဲ့) အဖြစ် အလိုအလျောက် ပေါက်မည်ဖြစ်ပါသည်။
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* E. Screenshot ဖြင့် လမ်းညွှန်ခြင်း */}
      <section className="space-y-4 border-l-4 border-indigo-600 pl-4 py-1">
        <h4 className="text-base font-black text-indigo-950 flex items-center gap-2">
          <span>E. Screenshot ဖြင့် လမ်းညွှန်ခြင်း</span>
        </h4>
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-black text-xs text-indigo-900 bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-lg">
                ပုံ (၁) — အိုးစည်လေး (3D) ပင်မမျက်နှာပြင်နှင့် အမြန်စာရင်းသွင်းလွှာ
              </span>
              <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                ✓ တကယ့် App Screenshot (Verified Application Screen)
              </span>
            </div>
            
            <div className="rounded-xl overflow-hidden border border-slate-300 shadow-xs max-h-[360px] flex items-center justify-center bg-slate-950">
              <img
                src={img3D}
                alt="3D Module Main Application Interface"
                className="w-full h-auto max-h-[360px] object-contain"
              />
            </div>

            <div className="text-xs space-y-1 text-slate-700 bg-white p-3 rounded-xl border border-slate-200">
              <p><b>ပုံတွင် ပြသထားသောအရာ:</b> 3D ပင်မစနစ်၏ အပေါ်ဘား၊ အမြန်စာရင်းသွင်းအကွက်များ၊ စာရင်းချုပ် Tab များနှင့် ဘောက်ချာ ထိန်းချုပ်နေရာများ။</p>
              <p><b>အသုံးပြုသူ အဓိက အာရုံစိုက်ရမည့်နေရာ:</b> အလယ်ဗဟိုရှိ "ဂဏန်း (Number)" နှင့် "ငွေပမာဏ (Amount)" အကွက်များ၊ ညာဘက်ရှိ "စာရင်းထဲထည့်မည်" ခလုတ်။</p>
              <p><b>ဆက်လက် လုပ်ဆောင်ရမည့်အဆင့်:</b> ဂဏန်းရိုက်ထည့်ပြီးပါက အောက်ခြေရှိ "ဘောင်ချာ သိမ်းဆည်းမည်" ခလုတ်ကို နှိပ်၍ အတည်ပြုရန်။</p>
            </div>
          </div>

          {/* Illustrative Mockup Diagram for Limits/Forwarding */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-black text-xs text-slate-800 bg-slate-200 px-2.5 py-1 rounded-lg">
                ပုံ (၁.၂) — ဘရိတ်ကျော်လွန်မှု စီမံခန့်ခွဲမှုနှင့် အထက်ဒိုင်လက်လွှဲစနစ် (Over-Limit Flow)
              </span>
              <span className="text-[11px] text-amber-800 font-bold bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                နမူနာပုံ — တကယ့် App Screenshot မဟုတ်ပါ (UI Architecture Reference)
              </span>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 font-mono text-xs">
              <div className="text-slate-600 font-sans">
                ဂဏန်းတစ်ခုရောင်းချမှုသည် သတ်မှတ် Limit ထက် ကျော်လွန်သွားသောအခါ ပေါ်လာသော ဆုံးဖြတ်ချက် Box:
              </div>
              <div className="border border-indigo-200 bg-indigo-50/50 p-2.5 rounded-lg text-slate-800 space-y-1">
                <p className="font-bold text-indigo-900">Over-Limit Decision Modal:</p>
                <p>• [ပိုငွေကို အထက်ဒိုင်တင်မည် (Forward Excess)] ➔ ကျော်လွန်ငွေကို မဟာဒိုင်စာရင်းသို့ တင်ပို့သည်။</p>
                <p>• [အားလုံး အထက်ဒိုင်တင်မည် (Forward All)] ➔ ဤဂဏန်းရောင်းရငွေအားလုံးကို လွှဲသည်။</p>
                <p>• [ဒိုင်ကိုယ်တိုင် အကုန်ကိုင်မည် (Accept Locally)] ➔ Limit မကြည့်ဘဲ ဆက်လက်လက်ခံသည်။</p>
                <p>• [Limit အပြည့်သာဖြတ်မည် (Cap at Limit)] ➔ ကျန်ရှိသော quota အထိသာ ဖြတ်ယူသည်။</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* F. အမှားများနှင့် ဖြေရှင်းနည်း */}
      <section className="space-y-3 border-l-4 border-indigo-600 pl-4 py-1">
        <h4 className="text-base font-black text-indigo-950 flex items-center gap-2">
          <span>F. အမှားများနှင့် ဖြေရှင်းနည်း</span>
        </h4>
        <div className="space-y-3">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs space-y-1 text-rose-950">
            <p className="font-bold">ပြဿနာ ၁: "ဂဏန်း ၃ လုံး မပြည့်ပါ" ဟူသော အနီရောင် သတိပေးချက် ပေါ်လာခြင်း</p>
            <p><b>၁။ အသုံးပြုသူ ဘာကိုမြင်ရသလဲ:</b> Input အကွက်အောက်တွင် သို့မဟုတ် Toast တွင် "ဂဏန်း ၃ လုံး မပြည့်ပါ" ဟု ပေါ်လာသည်။</p>
            <p><b>၂။ ဘာကြောင့်ဖြစ်နိုင်သလဲ:</b> အသုံးပြုသူမှ ၂ လုံးသာ ရိုက်ထည့်ခြင်း သို့မဟုတ် ဂဏန်းမဟုတ်သော စာလုံးများ ပါဝင်နေခြင်း။</p>
            <p><b>၃။ ဘယ်လိုစစ်ဆေးရမလဲ:</b> "ဂဏန်း" အကွက်တွင် ရိုက်ထားသော တန်ဖိုးအား ပြန်လည်ကြည့်ရှုပါ။</p>
            <p><b>၄။ ဘယ်လိုဖြေရှင်းရမလဲ:</b> 000 မှ 999 အထိ ၃ လုံး ပြည့်အောင် (ဥပမာ "024" သို့ "789") ပြင်ဆင်ရိုက်ထည့်ပါ။</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1 text-amber-950">
            <p className="font-bold">ပြဿနာ ၂: Limit သတ်မှတ်ချက် ကျော်လွန်နေ၍ အော်ဒါမဝင်ခြင်း</p>
            <p><b>၁။ အသုံးပြုသူ ဘာကိုမြင်ရသလဲ:</b> အော်ဒါသွင်းချိန်တွင် Over-Limit Modal သတိပေးချက် တက်လာခြင်း။</p>
            <p><b>၂။ ဘာကြောင့်ဖြစ်နိုင်သလဲ:</b> ထိုဂဏန်း၏ ရောင်းအားသည် သတ်မှတ်ထားသော Limit ဘရိတ်သို့ ရောက်ရှိသွားခြင်း။</p>
            <p><b>၃။ ဘယ်လိုစစ်ဆေးရမလဲ:</b> "စာရင်းချုပ်" တွင် ထိုဂဏန်း၏ Limit နှင့် လက်ကျန်ကို စစ်ဆေးပါ။</p>
            <p><b>၄။ ဘယ်လိုဖြေရှင်းရမလဲ:</b> ပိုငွေကို အထက်ဒိုင်သို့ Forward လုပ်ပါ (သို့မဟုတ်) ဆက်တင်တွင် Limit ဘရိတ်တိုးမြှင့်ပေးပါ။</p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1 text-slate-800">
            <p className="font-bold">ပြဿနာ ၃: ပေါက်ဂဏန်း ပြန်လည်ဖျက်သိမ်း၍ မရခြင်း (PIN တောင်းဆိုခြင်း)</p>
            <p><b>၁။ အသုံးပြုသူ ဘာကိုမြင်ရသလဲ:</b> ရှင်းတမ်းအား Reset ပြန်လုပ်ရာတွင် "Enter Owner Password / PIN" Prompt ပေါ်လာခြင်း။</p>
            <p><b>၂။ ဘာကြောင့်ဖြစ်နိုင်သလဲ:</b> စာရင်းအချက်အလက်များ မတော်တဆ ပျက်စီးမှု မဖြစ်စေရန် လုံခြုံရေး PIN ဖြင့် ကာကွယ်ထားခြင်း။</p>
            <p><b>၃။ ဘယ်လိုစစ်ဆေးရမလဲ:</b> မိမိ ပထမဆုံးစတင်ချိန်တွင် သတ်မှတ်ခဲ့သော ၄ လုံး သို့မဟုတ် ၆ လုံး PIN နံပါတ်ကို မှတ်မိမှု ရှိ/မရှိ စစ်ဆေးပါ။</p>
            <p><b>၄။ ဘယ်လိုဖြေရှင်းရမလဲ:</b> မှန်ကန်သော Owner PIN နံပါတ်အား ရိုက်ထည့်၍ အတည်ပြုပါ။</p>
          </div>
        </div>
      </section>

      {/* G. လုပ်ငန်းပြီးဆုံးကြောင်း စစ်ဆေးနည်း */}
      <section className="space-y-3 border-l-4 border-indigo-600 pl-4 py-1">
        <h4 className="text-base font-black text-indigo-950 flex items-center gap-2">
          <span>G. လုပ်ငန်းပြီးဆုံးကြောင်း စစ်ဆေးနည်း</span>
        </h4>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2 text-slate-700">
          <p>
            ၃ လုံး (3D) လုပ်ငန်းစဉ်တစ်ခု အောင်မြင်စွာ ပြီးဆုံးကြောင်း အောက်ပါအဆင့်များဖြင့် စိစစ်အတည်ပြုနိုင်ပါသည်:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li><b>အရောင်းဘောက်ချာ စစ်ဆေးခြင်း:</b> "ပြေစာမှတ်တမ်းများ" တွင် ဘောက်ချာနံပါတ် အသစ်ပေါ်နေပြီး ပမာဏနှင့် ကွက်ရေ တိကျမှန်ကန်မှု ရှိရမည်။</li>
            <li><b>စာရင်းချုပ် စစ်ဆေးခြင်း:</b> "စာရင်းချုပ်" Tab ရှိ Header တွင် စုစုပေါင်းရောင်းရငွေ (Revenue) သည် ထည့်သွင်းလိုက်သော ဘောက်ချာပမာဏအတိုင်း ချက်ချင်းတိုးလာရမည်။</li>
            <li><b>ပေါက်ဂဏန်း ရှင်းတမ်း စစ်ဆေးခြင်း:</b> ပေါက်ဂဏန်းထည့်ပြီးချိန်တွင် "အမြတ်/အရှုံး" အဖြေထွက်ပေါ်လာပြီး ပေါက်သူစာရင်း၌ အမည်နှင့် လျော်ကြေးငွေ တိကျစွာ ပြသနေရမည်။</li>
          </ul>
        </div>
      </section>
    </div>
  );
};

// =========================================================================
// TAB 2: 2D — ဇီးကွက် အသုံးပြုသူ လမ်းညွှန်
// =========================================================================
const TwoDManualView: React.FC = () => {
  return (
    <div className="space-y-8 text-slate-800 leading-relaxed text-xs sm:text-sm">
      {/* Module Title Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white p-5 rounded-2xl shadow-sm border border-teal-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500/20 text-teal-200 text-xs font-black mb-2 border border-teal-400/30">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>ဇီးကွက် (Thai 2D Stock Lottery Management)</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white">
            ၂ လုံး (2D) စာရင်းစီမံခန့်ခွဲမှုစနစ် ပြည့်စုံလက်စွဲ
          </h3>
          <p className="text-xs text-teal-200 mt-1 max-w-2xl font-medium">
            ထိုင်း ၂ လုံး (၀၀ မှ ၉၉) မနက်ပိုင်း (၁၂:၀၁) နှင့် ညနေပိုင်း (၀၄:၃၀) ပွဲစဉ်များအတွက် မြန်မာ့ရိုးရာထိုးကွက်များ (ဘရိတ်၊ အပါ၊ ထိပ်၊ ပိတ်၊ အပူး၊ ပါဝါ၊ နက္ခတ်၊ ညီကို၊ ခွေ) အပါအဝင် ပြည့်စုံစွာ စာရင်းကိုင်တွယ်ပုံ။
          </p>
        </div>
      </div>

      {/* A. လုပ်ငန်းမိတ်ဆက် */}
      <section className="space-y-3 border-l-4 border-teal-600 pl-4 py-1">
        <h4 className="text-base font-black text-teal-950 flex items-center gap-2">
          <span>A. လုပ်ငန်းမိတ်ဆက်</span>
        </h4>
        <div className="space-y-2 text-slate-700">
          <p>
            <b>ဇီးကွက် (2D)</b> သည် ထိုင်းစတော့အိတ်ချိန်း (SET Index) ၏ နေ့စဉ်ဖွင့်လှစ်သော မနက်ပိုင်း (၁၂:၀၁ PM) နှင့် ညနေပိုင်း (၀၄:၃၀ PM) ၂ လုံးထီ စာရင်းများအား တိကျစွာ လက်ခံစီမံနိုင်ရန် ရေးဆွဲထားခြင်း ဖြစ်သည်။
          </p>
          <p><b>အသုံးပြုသူ လုပ်ဆောင်နိုင်သည့် အဓိကလုပ်ငန်းများ:</b></p>
          <ul className="list-disc list-inside space-y-1 ml-2 text-slate-700">
            <li><b>မနက်/ညနေ Session စီမံခြင်း:</b> နေ့စဉ် မနက်ပိုင်းနှင့် ညနေပိုင်း ပွဲစဉ်များအား သီးခြားစီ စာရင်းကိုင်တွယ်နိုင်ပြီး၊ ပွဲစဉ်တစ်ခုပြီးပါက နောက် Session သို့ ခလုတ်တစ်ချက်ဖြင့် အလွယ်တကူ ကူးပြောင်းနိုင်ခြင်း။</li>
            <li><b>မြန်မာ့ရိုးရာ ၂ လုံး ထိုးကွက် အမြန်စနစ်များ:</b> ဘရိတ် (၁၀ ကွက်)၊ အပါ (၁၉ ကွက်)၊ ထိပ် (၁၀ ကွက်)၊ ပိတ် (၁၀ ကွက်)၊ အပူး (၁၀ ကွက်)၊ ပါဝါ (၁၀ ကွက်)၊ နက္ခတ် (၁၀ ကွက်)၊ ညီကို (၂၀ ကွက်)၊ ခွေ၊ ခွေပူး စသည့် Shortcut ခလုတ်များဖြင့် တစ်ချက်နှိပ်ရုံဖြင့် အများအပြား ချက်ချင်းသွင်းနိုင်ခြင်း။</li>
            <li><b>ဂဏန်း ၁၀၀ စာရင်းချုပ် (Master Ledger 00-99):</b> 00 မှ 99 အထိ ဂဏန်းတစ်ခုချင်းစီ၏ ရောင်းအားကို အရောင်အလိုက် (စိမ်း/ဝါ/နီ) အချိန်နှင့်တစ်ပြေးညီ စောင့်ကြည့်နိုင်ခြင်း။</li>
            <li><b>ကင်မရာ/ပုံဖတ် စနစ် (OCR):</b> စာရွက်စလစ် (သို့) Viber/Telegram စကားပြော Screenshot ပုံများမှ ၂ လုံးထိုးကြေးများကို အလိုအလျောက် ဖတ်ရှုထုတ်ယူခြင်း။</li>
            <li><b>ပေါက်ဂဏန်းရှင်းတမ်း:</b> မနက်/ညနေ ပေါက်ဂဏန်း (ဥပမာ 85 ဆ) အလိုက် လျော်ကြေးနှင့် အသားတင်အမြတ်ငွေ အလိုအလျောက် တွက်ချက်ခြင်း။</li>
          </ul>
        </div>
      </section>

      {/* B. Screen တစ်ခုချင်းစီ၏ အသုံးပြုပုံ */}
      <section className="space-y-4 border-l-4 border-teal-600 pl-4 py-1">
        <h4 className="text-base font-black text-teal-950 flex items-center gap-2">
          <span>B. Screen တစ်ခုချင်းစီ၏ အသုံးပြုပုံ</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 2D Screen 1 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <span className="font-bold text-teal-900 text-xs px-2 py-0.5 bg-teal-100 rounded-md">Screen 1</span>
            <h5 className="font-black text-slate-900 text-sm">အမြန်စာရင်းသွင်းရန် (2D Quick Sale Entry)</h5>
            <p className="text-slate-600 text-xs">
              <b>ရည်ရွယ်ချက်:</b> ၂ လုံး ထိုးကွက်များအား တစ်ကွက်ချင်းသော်လည်းကောင်း၊ Shortcut ခလုတ်များဖြင့်သော်လည်းကောင်း ဘောက်ချာသွင်းရန်။
            </p>
            <div className="text-xs space-y-1 text-slate-700">
              <p><b>အရေးကြီး အကွက်များနှင့် ခလုတ်များ:</b></p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li><b>ဝယ်သူအမည် & ဖုန်း:</b> စလစ်ပိုင်ရှင် အချက်အလက်။</li>
                <li><b>ဂဏန်း အကွက်:</b> ၂ လုံးဂဏန်း (00 မှ 99)။</li>
                <li><b>ငွေပမာဏ:</b> ထိုးကြေးငွေ (ဥပမာ 500 သို့ 1000)။</li>
                <li><b>R (အာ / ပတ်လည်):</b> ဖွင့်ထားပါက 24 ထိုးပါက 42 ကိုပါ အလိုအလျောက် သွင်းပေးသည်။</li>
                <li><b>မြန်မာ့ထိုးကွက် Shortcut Bar:</b> ဘရိတ် (Breaks)၊ အပါ (Includes)၊ ထိပ် (Heads)၊ ပိတ် (Tails)၊ အပူး၊ ပါဝါ၊ နက္ခတ်၊ ညီကို၊ ခွေ စသည့် ခလုတ်များ။</li>
                <li><b>"ဘောင်ချာ သိမ်းဆည်းမည်" ခလုတ်:</b> ဘောက်ချာ အပြီးသတ်သိမ်းဆည်းပြီး စလစ်ထုတ်ပေးသည်။</li>
              </ul>
            </div>
          </div>

          {/* 2D Screen 2 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <span className="font-bold text-teal-900 text-xs px-2 py-0.5 bg-teal-100 rounded-md">Screen 2</span>
            <h5 className="font-black text-slate-900 text-sm">စာရင်းချုပ် (Master Ledger - ၀၀ မှ ၉၉)</h5>
            <p className="text-slate-600 text-xs">
              <b>ရည်ရွယ်ချက်:</b> ၂ လုံး ဂဏန်း ၁၀၀ ကွက်လုံး၏ စုစုပေါင်းရောင်းရငွေနှင့် Risk Level ကို Heat-map စနစ်ဖြင့် စောင့်ကြည့်ရန်။
            </p>
            <div className="text-xs space-y-1 text-slate-700">
              <p><b>အရေးကြီး အကွက်များနှင့် ခလုတ်များ:</b></p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li><b>00-99 Grid:</b> ဂဏန်းတစ်ခုချင်းစီ၏ ရောင်းရငွေ၊ Limit နှင့် အန္တရာယ်အဆင့်ကို အရောင်ဖြင့် ပြသထားသည်။</li>
                <li><b>ပိတ်ခလုတ် (Block Toggle):</b> ရောင်းအားများလွန်းသော ဂဏန်းအား ချက်ချင်းပိတ်နိုင်။</li>
                <li><b>လက်လွှဲခလုတ် (Forward):</b> Limit ကျော်လွန်ငွေအား မဟာဒိုင်သို့ တင်သွင်းရန်။</li>
              </ul>
            </div>
          </div>

          {/* 2D Screen 3 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <span className="font-bold text-teal-900 text-xs px-2 py-0.5 bg-teal-100 rounded-md">Screen 3</span>
            <h5 className="font-black text-slate-900 text-sm">ရလဒ်စစ်ဆေး & ရှင်းတမ်း (Verification & Settlement)</h5>
            <p className="text-slate-600 text-xs">
              <b>ရည်ရွယ်ချက်:</b> မနက်/ညနေ ၂ လုံး ထွက်ဂဏန်းထည့်သွင်း၍ ရှင်းတမ်းထုတ်ခြင်းနှင့် နောက် Session သို့ ကူးပြောင်းခြင်း။
            </p>
            <div className="text-xs space-y-1 text-slate-700">
              <p><b>အရေးကြီး အကွက်များနှင့် ခလုတ်များ:</b></p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li><b>ပေါက်ဂဏန်း အကွက်:</b> ၂ လုံး (ဥပမာ "24")။</li>
                <li><b>ပေါက်ကြေးဆ:</b> ပုံမှန် 85 ဆ သို့မဟုတ် 80 ဆ။</li>
                <li><b>"အတည်ပြုပြီး ရှင်းတမ်းထုတ်မည်" ခလုတ်:</b> ပေါက်သူများနှင့် လျော်ကြေးတွက်ချက်ပေးသည်။</li>
                <li><b>"နောက် Session သို့ ကူးပြောင်းမည်" ခလုတ်:</b> မနက်ပိုင်းပြီးပါက ညနေပိုင်းသို့ စာရင်းအသစ် ချက်ချင်းဖွင့်လှစ်ပေးသည်။</li>
              </ul>
            </div>
          </div>

          {/* 2D Screen 4 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <span className="font-bold text-teal-900 text-xs px-2 py-0.5 bg-teal-100 rounded-md">Screen 4</span>
            <h5 className="font-black text-slate-900 text-sm">ပြေစာမှတ်တမ်းများ (Vouchers)</h5>
            <p className="text-slate-600 text-xs">
              <b>ရည်ရွယ်ချက်:</b> ရောင်းချပြီးသော ၂ လုံး ဘောက်ချာများအား စစ်ဆေးခြင်း၊ ပြန်လည် Print ထုတ်ခြင်းနှင့် ပယ်ဖျက်ခြင်း။
            </p>
            <div className="text-xs space-y-1 text-slate-700">
              <p><b>အရေးကြီး အကွက်များနှင့် ခလုတ်များ:</b></p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li><b>Filter များ:</b> အားလုံး၊ ပေါက်သောစလစ်၊ မပေါက်သောစလစ်။</li>
                <li><b>Print:</b> 58mm / 80mm စလစ်ထုတ်ပေးခြင်း။</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* C. အဆင့်လိုက် လက်တွေ့လုပ်ဆောင်နည်း */}
      <section className="space-y-4 border-l-4 border-teal-600 pl-4 py-1">
        <h4 className="text-base font-black text-teal-950 flex items-center gap-2">
          <span>C. အဆင့်လိုက် လက်တွေ့လုပ်ဆောင်နည်း</span>
        </h4>

        {/* Workflow 2D - 1 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
          <h5 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 text-teal-900">
            <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs">၁</span>
            <span>မြန်မာ့ရိုးရာ ထိုးကွက်ဖြတ်လမ်းများ (ဘရိတ်၊ အပါ၊ ထိပ်၊ ပိတ်) အသုံးပြု၍ စာရင်းသွင်းနည်း</span>
          </h5>
          <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 ml-2">
            <li><b>ဘယ် Screen ကို ဖွင့်ရမလဲ:</b> Header ရှိ "ဇီးကွက်" ကို ရွေးပြီး <b>"အမြန်စာရင်းသွင်းရန်"</b> Tab ကို ဖွင့်ပါ။</li>
            <li><b>ဘယ်အကွက်မှာ ဘာဖြည့်ရမလဲ:</b> ဝယ်သူအမည် ရိုက်ထည့်ပါ။</li>
            <li><b>Shortcut ခလုတ် ရွေးချယ်ခြင်း:</b>
              <br />
              - <b>"၅ ဘရိတ်"</b> ထိုးလိုပါက ➔ "ဘရိတ်" ခလုတ်ကို နှိပ်ပြီး "5" ကို ရွေးပါ (ဂဏန်းပေါင်းလဒ် ၅ ဖြစ်သော ၀၅၊ ၁၄၊ ၂၃၊ ၃၂၊ ၄၁၊ ၅၀၊ ၆၉၊ ၇၈၊ ၈၇၊ ၉၆ စုစုပေါင်း ၁၀ ကွက် အလိုအလျောက် ဝင်လာမည်)။
              <br />
              - <b>"၈ ထိပ်"</b> ထိုးလိုပါက ➔ "ထိပ်" ခလုတ်ကို နှိပ်ပြီး "8" ကို ရွေးပါ (၈၀ မှ ၈၉ အထိ ၁၀ ကွက် ဝင်လာမည်)။
              <br />
              - <b>"၃ အပါ"</b> ထိုးလိုပါက ➔ "အပါ" ခလုတ်ကို နှိပ်ပြီး "3" ကို ရွေးပါ (၃ ပါသော ဂဏန်း ၁၉ ကွက် အလိုအလျောက် ဝင်လာမည်)။
            </li>
            <li><b>ငွေပမာဏ သတ်မှတ်ခြင်း:</b> အကွက်တစ်ခုချင်းစီအတွက် ထိုးမည့်ငွေ (ဥပမာ 500 Ks စီ) ကို သတ်မှတ်ပါ။</li>
            <li><b>ဘယ်ခလုတ်နဲ့ သိမ်းဆည်းရမလဲ:</b> အောက်ခြေရှိ <b>"ဘောင်ချာ သိမ်းဆည်းမည်"</b> ခလုတ်ကို နှိပ်ပါ။</li>
            <li><b>အောင်မြင်ကြောင်း ဘယ်လိုအတည်ပြုရမလဲ:</b> ဘောက်ချာနံပါတ် (V-2D-xxx) ကျလာပြီး စလစ်ပုံစံ ပေါ်လာပါက အောင်မြင်ပါသည်။</li>
          </ol>
        </div>

        {/* Workflow 2D - 2 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
          <h5 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 text-teal-900">
            <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs">၂</span>
            <span>မနက်ပိုင်း ပေါက်ဂဏန်းထွက်ပြီးနောက် ညနေပိုင်းသို့ ကူးပြောင်းနည်း</span>
          </h5>
          <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 ml-2">
            <li><b>ဘယ် Screen ကို ဖွင့်ရမလဲ:</b> <b>"ရလဒ်စစ်ဆေး & ရှင်းတမ်း"</b> Tab သို့ သွားပါ။</li>
            <li><b>ပေါက်ဂဏန်းထည့်သွင်းခြင်း:</b> မနက် ၁၂:၀၁ ထွက်ဂဏန်း (ဥပမာ "24") ကို ရိုက်ထည့်ပြီး <b>"အတည်ပြုပြီး ရှင်းတမ်းထုတ်မည်"</b> ကို နှိပ်ပါ။</li>
            <li><b>ရှင်းတမ်းစစ်ဆေးခြင်း:</b> မနက်ပိုင်း ပေါက်သူများနှင့် ဒိုင်အမြတ်/ရှုံးကို အတည်ပြုပါ။</li>
            <li><b>Session ကူးပြောင်းခြင်း:</b> အပေါ်ဘက်ရှိ <b>"နောက် Session သို့ ကူးပြောင်းမည် (ညနေပိုင်း ၀၄:၃၀)"</b> ခလုတ်ကို နှိပ်ပါ။</li>
            <li><b>အောင်မြင်ကြောင်း အတည်ပြုခြင်း:</b> မနက်ပိုင်းစာရင်းများ မှတ်တမ်းထဲ သိမ်းသွားပြီး Header ရှိ Round အမည်သည် ညနေပိုင်းအဖြစ် အလိုအလျောက် အသစ်ပြောင်းလဲသွားပါမည်။</li>
          </ol>
        </div>
      </section>

      {/* D. နမူနာဖြင့် ရှင်းပြခြင်း */}
      <section className="space-y-3 border-l-4 border-teal-600 pl-4 py-1">
        <h4 className="text-base font-black text-teal-950 flex items-center gap-2">
          <span>D. နမူနာဖြင့် ရှင်းပြခြင်း (Safe Practical Calculation)</span>
        </h4>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
          <p className="font-bold text-slate-900">၂ လုံး ထိုးကွက်နှင့် ပေါက်ကြေးတွက်ချက်မှု လက်တွေ့နမူနာ:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
              <span className="font-bold text-teal-700 block">အဝင်ဒေတာ (Input Sample):</span>
              <p>ဝယ်သူအမည်: <b>မအေး</b></p>
              <p>ထိုးကွက် ၁: <b>24 အာ (R)</b> = <b>1,000 Ks စီ</b> (24 = 1,000 Ks, 42 = 1,000 Ks)</p>
              <p>ထိုးကွက် ၂: <b>5 ဘရိတ်</b> = <b>500 Ks စီ</b> (၁၀ ကွက် x 500 = 5,000 Ks)</p>
              <p>စုစုပေါင်း ထိုးကြေး: <b>7,000 Ks</b></p>
              <p>လျော့ငွေ Discount: <b>0 Ks</b></p>
              <p className="font-bold text-emerald-700">ဝယ်သူ ပေးရငွေ: <b>7,000 Ks</b></p>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
              <span className="font-bold text-teal-700 block">ပေါက်ဂဏန်းထွက်ပေါ်မှုနှင့် လျော်ကြေး (Payout Result):</span>
              <p>ထွက်ဂဏန်း: <b>24</b></p>
              <p>ပေါက်ကြေးဆ: <b>85 ဆ</b></p>
              <p>• ကွက် ၁ (24 အာ): 24 ပေါက်သည် ➔ 1,000 x 85 = <b>85,000 Ks</b></p>
              <p>• ကွက် ၂ (5 ဘရိတ် မပေါက်ပါ - 2+4=6 ဖြစ်၍ 6 ဘရိတ်သာဖြစ်သည်) ➔ <b>0 Ks</b></p>
              <p className="font-bold text-rose-700">ဒိုင်မှ လျော်ရမည့်ငွေ စုစုပေါင်း: <b>85,000 Ks</b></p>
            </div>
          </div>
        </div>
      </section>

      {/* E. Screenshot ဖြင့် လမ်းညွှန်ခြင်း */}
      <section className="space-y-4 border-l-4 border-teal-600 pl-4 py-1">
        <h4 className="text-base font-black text-teal-950 flex items-center gap-2">
          <span>E. Screenshot ဖြင့် လမ်းညွှန်ခြင်း</span>
        </h4>
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-black text-xs text-teal-900 bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg">
                ပုံ (၂) — ဇီးကွက် (2D) ပင်မမျက်နှာပြင်နှင့် ၂ လုံး ဂဏန်းကွက်စနစ်
              </span>
              <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                ✓ တကယ့် App Screenshot (Verified Application Screen)
              </span>
            </div>
            
            <div className="rounded-xl overflow-hidden border border-slate-300 shadow-xs max-h-[360px] flex items-center justify-center bg-slate-950">
              <img
                src={img2D}
                alt="2D Module Main Application Interface"
                className="w-full h-auto max-h-[360px] object-contain"
              />
            </div>

            <div className="text-xs space-y-1 text-slate-700 bg-white p-3 rounded-xl border border-slate-200">
              <p><b>ပုံတွင် ပြသထားသောအရာ:</b> 2D စနစ်၏ အမြန်စာရင်းသွင်းလွှာ၊ မြန်မာ့ထိုးကွက် Shortcut Bar၊ မနက်/ညနေ Session ခလုတ်များနှင့် ဂဏန်းကွက်ဇယား။</p>
              <p><b>အသုံးပြုသူ အဓိက အာရုံစိုက်ရမည့်နေရာ:</b> အလယ်ရှိ ၂ လုံးဂဏန်း ရိုက်ထည့်ကွက်နှင့် အပေါ်ဘက်ရှိ မြန်မာ့ထိုးကွက် ခလုတ်များ (ဘရိတ်၊ အပါ၊ ထိပ်၊ ပိတ်)။</p>
              <p><b>ဆက်လက် လုပ်ဆောင်ရမည့်အဆင့်:</b> လိုအပ်သော ထိုးကွက်များ ထည့်သွင်းပြီးနောက် "ဘောင်ချာ သိမ်းဆည်းမည်" ကို နှိပ်ရန်။</p>
            </div>
          </div>
        </div>
      </section>

      {/* F. အမှားများနှင့် ဖြေရှင်းနည်း */}
      <section className="space-y-3 border-l-4 border-teal-600 pl-4 py-1">
        <h4 className="text-base font-black text-teal-950 flex items-center gap-2">
          <span>F. အမှားများနှင့် ဖြေရှင်းနည်း</span>
        </h4>
        <div className="space-y-3">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs space-y-1 text-rose-950">
            <p className="font-bold">ပြဿနာ ၁: "ပွဲစဉ် ပိတ်ထားပါသည် (Round is Closed)" ဟု ပေါ်လာခြင်း</p>
            <p><b>၁။ အသုံးပြုသူ ဘာကိုမြင်ရသလဲ:</b> စာရင်းသွင်း၍ မရဘဲ ပွဲစဉ်ပိတ်ထားကြောင်း သတိပေးစာတန်း ပေါ်လာခြင်း။</p>
            <p><b>၂။ ဘာကြောင့်ဖြစ်နိုင်သလဲ:</b> ထိုပွဲစဉ်အား ရှင်းတမ်းထုတ်ပြီး ပိတ်သိမ်းထားခြင်း (Settled/Closed ဖြစ်နေခြင်း)။</p>
            <p><b>၃။ ဘယ်လိုစစ်ဆေးရမလဲ:</b> Header ရှိ Round အမည်ဘေးတွင် ✓ အမှန်ခြစ် ရှိ/မရှိ ကြည့်ပါ။</p>
            <p><b>၄။ ဘယ်လိုဖြေရှင်းရမလဲ:</b> "ပွဲစဉ်" ခလုတ်မှတစ်ဆင့် ပွဲစဉ်အသစ် ဖွင့်ပါ (သို့မဟုတ်) "နောက် Session သို့ ကူးပြောင်းမည်" ကို နှိပ်ပါ။</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1 text-amber-950">
            <p className="font-bold">ပြဿနာ ၂: မနက်ပိုင်းစာရင်းနှင့် ညနေပိုင်းစာရင်း ရောထွေးသွားခြင်း</p>
            <p><b>၁။ အသုံးပြုသူ ဘာကိုမြင်ရသလဲ:</b> ညနေပိုင်း ရောင်းရငွေထဲတွင် မနက်ပိုင်းစာရင်းများ ပါဝင်နေခြင်း။</p>
            <p><b>၂။ ဘာကြောင့်ဖြစ်နိုင်သလဲ:</b> မနက်ပိုင်း ပေါက်ဂဏန်းထွက်ပြီးနောက် "နောက် Session သို့ ကူးပြောင်းမည်" ခလုတ်ကို မနှိပ်ဘဲ ဆက်လက်ရောင်းချခဲ့ခြင်း။</p>
            <p><b>၃။ ဘယ်လိုစစ်ဆေးရမလဲ:</b> Header ရှိ လက်ရှိဖွင့်ထားသော Round အမည် (မနက်ပိုင်းလား/ညနေပိုင်းလား) ကို စစ်ပါ။</p>
            <p><b>၄။ ဘယ်လိုဖြေရှင်းရမလဲ:</b> ပွဲစဉ်မန်နေဂျာ (Round Manager) တွင် ပွဲစဉ်အသစ် ခွဲခြားဖွင့်လှစ်၍ အသုံးပြုပါ။</p>
          </div>
        </div>
      </section>

      {/* G. လုပ်ငန်းပြီးဆုံးကြောင်း စစ်ဆေးနည်း */}
      <section className="space-y-3 border-l-4 border-teal-600 pl-4 py-1">
        <h4 className="text-base font-black text-teal-950 flex items-center gap-2">
          <span>G. လုပ်ငန်းပြီးဆုံးကြောင်း စစ်ဆေးနည်း</span>
        </h4>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2 text-slate-700">
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li><b>ဘောက်ချာမှတ်တမ်း:</b> "ပြေစာမှတ်တမ်းများ" တွင် ဘောက်ချာနံပါတ် V-2D-xxx အသစ် ဝင်ရောက်လာခြင်း။</li>
            <li><b>ဂဏန်း ၁၀၀ စာရင်းချုပ်:</b> Master Ledger ရှိ သက်ဆိုင်ရာ ၂ လုံးကွက်တွင် ရောင်းအားပမာဏ တိုးလာခြင်း။</li>
            <li><b>Session ရှင်းတမ်း:</b> ပေါက်ဂဏန်းထည့်ပြီးချိန်တွင် ပေါက်သူဦးရေနှင့် လျော်ကြေးငွေ တိကျစွာ ထွက်ပေါ်လာခြင်း။</li>
          </ul>
        </div>
      </section>
    </div>
  );
};

// =========================================================================
// TAB 3: Football — ပစ်တိုင်းထောင် အသုံးပြုသူ လမ်းညွှန်
// =========================================================================
const FootballManualView: React.FC = () => {
  return (
    <div className="space-y-8 text-slate-800 leading-relaxed text-xs sm:text-sm">
      {/* Module Title Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-emerald-850 to-slate-900 text-white p-5 rounded-2xl shadow-sm border border-emerald-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-200 text-xs font-black mb-2 border border-emerald-400/30">
            <Trophy className="w-3.5 h-3.5 text-amber-300" />
            <span>ပစ်တိုင်းထောင် (Myanmar Asian Handicap Football System)</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white">
            ဘောလုံး (Football) စာရင်းစီမံခန့်ခွဲမှုစနစ် ပြည့်စုံလက်စွဲ
          </h3>
          <p className="text-xs text-emerald-200 mt-1 max-w-2xl font-medium">
            မြန်မာ့ဘောလုံးအကြောကြေးများ (ဝက်၊ သရေ ၅၀ ရှုံး၊ တစ်လုံး ၅၀ စား၊ ၁ ပြား ၇၀ စသည်)၊ ဂိုးပေါင်း (အပေါ်/အောက်)၊ ဘော်ဒီသီးသန့် (Single) နှင့် မောင်း (Parlay ၂ သင်းမှ ၁၁ သင်း) စာရင်းသွင်းခြင်းနှင့် အလိုအလျောက် အဖြေတွက်ချက်နည်း။
          </p>
        </div>
      </div>

      {/* A. လုပ်ငန်းမိတ်ဆက် */}
      <section className="space-y-3 border-l-4 border-emerald-600 pl-4 py-1">
        <h4 className="text-base font-black text-emerald-950 flex items-center gap-2">
          <span>A. လုပ်ငန်းမိတ်ဆက်</span>
        </h4>
        <div className="space-y-2 text-slate-700">
          <p>
            <b>ပစ်တိုင်းထောင် (Football)</b> သည် ကမ္ဘာ့ထိပ်တန်း ဘောလုံးလိဂ်ကြီးများအတွက် မြန်မာ့ရိုးရာ အာရှဟန်းဒီးကပ် (Asian Handicap) စနစ်အတိုင်း ဘော်ဒီနှင့် ဂိုးပေါင်း အမှာစာများကို လွယ်ကူလျင်မြန်စွာ စာရင်းသွင်းနိုင်ရန် တည်ဆောက်ထားသော စနစ်ဖြစ်ပါသည်။
          </p>
          <p><b>အသုံးပြုသူ လုပ်ဆောင်နိုင်သည့် အဓိကလုပ်ငန်းများ:</b></p>
          <ul className="list-disc list-inside space-y-1 ml-2 text-slate-700">
            <li><b>ပွဲစဉ်ဇယား ထည့်သွင်းစီမံခြင်း:</b> အိမ်ကွင်း/အဝေးကွင်း အသင်းများ၊ ပွဲကစားမည့်နေ့နှင့် အချိန်၊ အကြောပေးအသင်းနှင့် အကြောကြေး၊ ဂိုးပေါင်းလိုင်းနှင့် ရေကြေး (Odds) များကို စိတ်ကြိုက်ထည့်သွင်းခြင်း။</li>
            <li><b>စလစ်အမှာစာ သွင်းယူခြင်း:</b>
              <br />
              • <b>ဘော်ဒီ သီးသန့် (Single):</b> ၁ သင်းတည်း ထိုးကြေး။
              <br />
              • <b>မောင်း (Mix Parlay):</b> ၂ သင်း မှ ၁၁ သင်း အထိ မောင်းတွဲများ ရွေးချယ်၍ အမြှောက်ဆ (Combined Odds) အလိုအလျောက် တွက်ချက်ခြင်း။
            </li>
            <li><b>အလိုအလျောက် အဖြေတွက်စနစ် (Asian Settlement Algorithm):</b>
              <br />
              ပွဲပြီးရလဒ် (ဥပမာ 2 - 1) ထည့်သွင်းလိုက်သည်နှင့် <b>နိုင် (Win)၊ ထက်နိုင် (Half Win)၊ သရေ (Draw)၊ ထက်ရှုံး (Half Loss)၊ ရှုံး (Loss)</b> တို့ကို စနစ်မှ အတိအကျ တွက်ချက်ပေးခြင်း။
            </li>
            <li><b>ဘောလုံးစလစ် ထုတ်ပေးခြင်း:</b> Thermal Printer (58mm/80mm) ဖြင့် ဘားကုဒ်၊ ရွေးချယ်ထားသော အသင်းများ၊ ရေကြေးနှင့် ပေါက်ငွေများကို ပြေစာစလစ် ထုတ်ပေးနိုင်ခြင်း။</li>
          </ul>
        </div>
      </section>

      {/* B. Screen တစ်ခုချင်းစီ၏ အသုံးပြုပုံ */}
      <section className="space-y-4 border-l-4 border-emerald-600 pl-4 py-1">
        <h4 className="text-base font-black text-emerald-950 flex items-center gap-2">
          <span>B. Screen တစ်ခုချင်းစီ၏ အသုံးပြုပုံ</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* FB Screen 1 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <span className="font-bold text-emerald-900 text-xs px-2 py-0.5 bg-emerald-100 rounded-md">Screen 1</span>
            <h5 className="font-black text-slate-900 text-sm">ပွဲစဉ်ဇယားနှင့် ရလဒ် (Fixtures & Scores)</h5>
            <p className="text-slate-600 text-xs">
              <b>ရည်ရွယ်ချက်:</b> နေ့အလိုက် ကစားမည့် ဘောလုံးပွဲများ စာရင်းသွင်းရန်နှင့် ပွဲပြီးပါက ဂိုးရလဒ် ထည့်သွင်းရန်။
            </p>
            <div className="text-xs space-y-1 text-slate-700">
              <p><b>အရေးကြီး အကွက်များနှင့် ခလုတ်များ:</b></p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li><b>"ပွဲစဉ်အသစ် ထည့်မည်" ခလုတ်:</b> လိဂ်၊ အိမ်ကွင်း၊ အဝေးကွင်း၊ ပွဲချိန်၊ အကြောကြေး ရွေးချယ်ထည့်သွင်းရန်။</li>
                <li><b>"ရလဒ်ထည့်မည်" ခလုတ်:</b> ပွဲပြီးပါက အိမ်ကွင်းဂိုးနှင့် အဝေးကွင်းဂိုး (ဥပမာ 2 - 0) ထည့်သွင်းရန်။</li>
                <li><b>"အဖြေတွက်ပြီး ရှင်းတမ်းထုတ်မည်" ခလုတ်:</b> ဂိုးရလဒ်များအတိုင်း စလစ်အားလုံးကို အလိုအလျောက် တွက်ချက်ပေးရန်။</li>
              </ul>
            </div>
          </div>

          {/* FB Screen 2 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <span className="font-bold text-emerald-900 text-xs px-2 py-0.5 bg-emerald-100 rounded-md">Screen 2</span>
            <h5 className="font-black text-slate-900 text-sm">အမှာစာ / စာရင်းသွင်း (Ticket Entry)</h5>
            <p className="text-slate-600 text-xs">
              <b>ရည်ရွယ်ချက်:</b> ဝယ်သူရွေးချယ်သော ဘော်ဒီနှင့် ဂိုးပေါင်း အသင်းများအား လက်ခံ၍ စလစ်လက်မှတ် ထုတ်ပေးရန်။
            </p>
            <div className="text-xs space-y-1 text-slate-700">
              <p><b>အရေးကြီး အကွက်များနှင့် ခလုတ်များ:</b></p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li><b>ဝယ်သူအမည် & ဖုန်း:</b> အမှာစာရှင် အချက်အလက်။</li>
                <li><b>ထိုးကြေးငွေ (Stake):</b> ငွေပမာဏ (ဥပမာ 5000 Ks)။</li>
                <li><b>ပွဲစဉ်ရွေးချယ်မှု ကတ်များ:</b> Home (Body)၊ Away (Body)၊ Over (အပေါ်)၊ Under (အောက်) တို့အား နှိပ်၍ ရွေးချယ်ခြင်း။</li>
                <li><b>အမြှောက်ဆ (Combined Odds):</b> ရွေးထားသော အသင်းများ၏ အမြှောက်ဆနှင့် ပေါက်ပါက ရရှိမည့်ငွေ (Potential Payout) ကို အချိန်နှင့်တစ်ပြေးညီ ပြသခြင်း။</li>
                <li><b>"စလစ် အတည်ပြု သိမ်းဆည်းမည်" ခလုတ်:</b> စလစ်အမှတ် FB-xxxx ထုတ်ပေး၍ သိမ်းဆည်းခြင်း။</li>
              </ul>
            </div>
          </div>

          {/* FB Screen 3 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
            <span className="font-bold text-emerald-900 text-xs px-2 py-0.5 bg-emerald-100 rounded-md">Screen 3</span>
            <h5 className="font-black text-slate-900 text-sm">ပြေစာမှတ်တမ်းများနှင့် ရှင်းတမ်း (Tickets & Settlement)</h5>
            <p className="text-slate-600 text-xs">
              <b>ရည်ရွယ်ချက်:</b> တင်ထားသော စလစ်များအားလုံး၏ နိုင်/ရှုံး အခြေအနေနှင့် ဘဏ္ဍာရေး အမြတ်/ရှုံး စာရင်းချုပ် ကြည့်ရှုရန်။
            </p>
            <div className="text-xs space-y-1 text-slate-700">
              <p><b>အရေးကြီး အကွက်များနှင့် ခလုတ်များ:</b></p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li><b>Summary Cards:</b> စုစုပေါင်း ထိုးကြေးငွေ၊ ဘော်ဒီထိုးကြေး၊ မောင်းထိုးကြေး၊ စုစုပေါင်း ပေးလျော်ငွေ၊ ဒိုင်အမြတ်/ရှုံး။</li>
                <li><b>စလစ်အသေးစိတ် ကြည့်ရှုခြင်း:</b> မည်သည့်ပွဲ နိုင်သည်/ရှုံးသည်ကို စိမ်း/နီ Badge များဖြင့် စစ်ဆေးနိုင်ခြင်း။</li>
                <li><b>Print & Excel ခလုတ်များ:</b> စလစ်ပြန်ထုတ်ခြင်းနှင့် Excel ထုတ်ယူခြင်း။</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* C. အဆင့်လိုက် လက်တွေ့လုပ်ဆောင်နည်း */}
      <section className="space-y-4 border-l-4 border-emerald-600 pl-4 py-1">
        <h4 className="text-base font-black text-emerald-950 flex items-center gap-2">
          <span>C. အဆင့်လိုက် လက်တွေ့လုပ်ဆောင်နည်း</span>
        </h4>

        {/* Workflow FB - 1 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
          <h5 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 text-emerald-900">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">၁</span>
            <span>မောင်းလက်မှတ် (Mix Parlay Slip) ထိုးကြေးလက်ခံ၍ ထုတ်ပေးနည်း</span>
          </h5>
          <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 ml-2">
            <li><b>ဘယ် Screen ကို ဖွင့်ရမလဲ:</b> Header ရှိ "ပစ်တိုင်းထောင်" ကို ရွေးပြီး <b>"အမှာစာ / စာရင်းသွင်း (Ticket Entry)"</b> Tab ကို နှိပ်ပါ။</li>
            <li><b>ဘယ်အကွက်မှာ ဘာဖြည့်ရမလဲ:</b> ဝယ်သူအမည် (ဥပမာ "ကိုမိုး")၊ ထိုးကြေးငွေ (ဥပမာ "5000") ဟု ရိုက်ထည့်ပါ။</li>
            <li><b>ပွဲစဉ်များနှင့် အသင်းများ ရွေးချယ်ခြင်း:</b>
              <br />
              - ပွဲ ၁ မှ အာဆင်နယ် ကို နှိပ်ပါ (Body)။
              <br />
              - ပွဲ ၂ မှ ချယ်လ်ဆီး vs လီဗာပူး တွင် "ဂိုးပေါင်း အပေါ် (Over 2.5)" ကို နှိပ်ပါ။
              <br />
              - ပွဲ ၃ မှ ရီးရဲလ်မက်ဒရစ် ကို နှိပ်ပါ (Body)။
            </li>
            <li><b>အမြှောက်ဆ စစ်ဆေးခြင်း:</b> ညာဘက်ဘေးရှိ Slip Preview တွင် ၃ သင်းမောင်း ဖြစ်သွားပြီး Odds များ မြှောက်ထားသော စုစုပေါင်း အဆ (ဥပမာ 6.85 ဆ) နှင့် ပေါက်ငွေ (ဥပမာ 34,250 Ks) ကို စစ်ပါ။</li>
            <li><b>ဘယ်ခလုတ်နဲ့ သိမ်းဆည်းရမလဲ:</b> <b>"စလစ် အတည်ပြု သိမ်းဆည်းမည်"</b> ခလုတ်ကို နှိပ်ပါ။</li>
            <li><b>အောင်မြင်ကြောင်း ဘယ်လိုအတည်ပြုရမလဲ:</b> စလစ်နံပါတ် FB-xxxx ဖြင့် Print Preview တက်လာပြီး "ပြေစာမှတ်တမ်းများ" တွင် စာရင်းဝင်သွားပါက အောင်မြင်ပါသည်။</li>
          </ol>
        </div>

        {/* Workflow FB - 2 */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
          <h5 className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5 text-emerald-900">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">၂</span>
            <span>ပွဲပြီးချိန်တွင် ဂိုးရလဒ်ထည့်သွင်း၍ နိုင်/ရှုံး ရှင်းတမ်းထုတ်နည်း</span>
          </h5>
          <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 ml-2">
            <li><b>ဘယ် Screen ကို ဖွင့်ရမလဲ:</b> <b>"ပွဲစဉ်ဇယားနှင့် ရလဒ် (Fixtures & Scores)"</b> Tab ကို ဖွင့်ပါ။</li>
            <li><b>ရလဒ်ထည့်သွင်းခြင်း:</b> ပွဲပြီးသွားသော ကတ်ပေါ်ရှိ <b>"ရလဒ်ထည့်မည်"</b> ခလုတ်ကို နှိပ်ပါ။</li>
            <li><b>ဂိုးရလဒ် ရိုက်ထည့်ခြင်း:</b> Home Score (ဥပမာ 2) နှင့် Away Score (ဥပမာ 0) ထည့်ပြီး "သိမ်းဆည်းမည်" နှိပ်ပါ။ ပွဲအခြေအနေ Finished ဖြစ်သွားပါမည်။</li>
            <li><b>အဖြေတွက်ချက်ခြင်း:</b> အပေါ်ဘက်ရှိ <b>"အဖြေတွက်ပြီး ရှင်းတမ်းထုတ်မည် (Settle Matches)"</b> ခလုတ်ကို နှိပ်ပါ။</li>
            <li><b>စလစ်များ စစ်ဆေးခြင်း:</b> <b>"ပြေစာမှတ်တမ်းများနှင့် ရှင်းတမ်း"</b> Tab သို့ သွား၍ မည်သည့်စလစ် ပေါက်သည်/ရှုံးသည်ကို စစ်ဆေးပါ။</li>
          </ol>
        </div>
      </section>

      {/* D. နမူနာဖြင့် ရှင်းပြခြင်း */}
      <section className="space-y-3 border-l-4 border-emerald-600 pl-4 py-1">
        <h4 className="text-base font-black text-emerald-950 flex items-center gap-2">
          <span>D. နမူနာဖြင့် ရှင်းပြခြင်း (Asian Handicap & Parlay Calculation)</span>
        </h4>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
          <p className="font-bold text-slate-900">မောင်း ၃ သင်း ထိုးကြေးနှင့် အဖြေထွက်ပေါ်ပုံ လက်တွေ့နမူနာ:</p>
          <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
            <p>ထိုးကြေး: <b>5,000 Ks</b> | မောင်း ၃ သင်း (Legs):</p>
            <div className="space-y-1 pl-2 border-l-2 border-slate-300">
              <p>၁။ <b>Arsenal (-0.5 ဝက်)</b> [Odds 1.90] ➔ ဂိုးရလဒ် 2 - 0 ဖြင့် ပွဲပြီးသည်။ ➔ <b>နိုင် (Win) ➔ x1.90</b></p>
              <p>၂။ <b>Chelsea vs Liverpool Over 2.5</b> [Odds 1.90] ➔ ဂိုးရလဒ် 2 - 1 (ဂိုးပေါင်း ၃ ဂိုး) ➔ <b>နိုင် (Win) ➔ x1.90</b></p>
              <p>၃။ <b>Real Madrid (-1.0 တစ်လုံး)</b> [Odds 1.90] ➔ ဂိုးရလဒ် 1 - 0 (၁ လုံးကွာသဖြင့် အကြောနှင့် သရေကျ) ➔ <b>သရေ (Draw) ➔ x1.0</b></p>
            </div>
            <p className="font-bold text-indigo-700 mt-2">
              စုစုပေါင်း အမြှောက်ဆ: 1.90 x 1.90 x 1.0 = <b>3.61 ဆ</b>
            </p>
            <p className="font-bold text-emerald-700">
              ဝယ်သူ ရရှိမည့် ပေါက်ငွေ: 5,000 Ks x 3.61 = <b>18,050 Ks</b>
            </p>
            <p className="text-[11px] text-slate-500">
              * အကယ်၍ တစ်သင်းသင်း အပြတ်ရှုံး (Loss) ခဲ့ပါက မောင်းလက်မှတ်တစ်ခုလုံး ရှုံး (Payout = 0 Ks) ဖြစ်သွားပါမည်။
              <br />
              * ထက်ရှုံး (Half Loss) ဖြစ်ပါက ထိုအသင်းအတွက် x0.5 ဖြင့် မြှောက်၍ ကျန်အသင်းများနှင့် ဆက်လက်တွက်ချက်ပေးပါသည်။
            </p>
          </div>
        </div>
      </section>

      {/* E. Screenshot ဖြင့် လမ်းညွှန်ခြင်း */}
      <section className="space-y-4 border-l-4 border-emerald-600 pl-4 py-1">
        <h4 className="text-base font-black text-emerald-950 flex items-center gap-2">
          <span>E. Screenshot ဖြင့် လမ်းညွှန်ခြင်း</span>
        </h4>
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-black text-xs text-emerald-900 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg">
                ပုံ (၃) — ပစ်တိုင်းထောင် (Football) ပွဲစဉ်ဇယားနှင့် အမှာစာလက်ခံစနစ်
              </span>
              <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                ✓ တကယ့် App Screenshot (Verified Application Screen)
              </span>
            </div>
            
            <div className="rounded-xl overflow-hidden border border-slate-300 shadow-xs max-h-[360px] flex items-center justify-center bg-slate-950">
              <img
                src={imgFB}
                alt="Football Module Main Application Interface"
                className="w-full h-auto max-h-[360px] object-contain"
              />
            </div>

            <div className="text-xs space-y-1 text-slate-700 bg-white p-3 rounded-xl border border-slate-200">
              <p><b>ပုံတွင် ပြသထားသောအရာ:</b> ပစ်တိုင်းထောင် ဘောလုံးပွဲစဉ်ကတ်များ၊ အကြောကြေး/ဂိုးပေါင်းလိုင်းများ၊ မောင်းလက်မှတ် ရွေးချယ်မှု ဘောင်များ။</p>
              <p><b>အသုံးပြုသူ အဓိက အာရုံစိုက်ရမည့်နေရာ:</b> ပွဲစဉ်တစ်ခုချင်းစီ၏ Body နှင့် Over/Under ခလုတ်များ၊ အောက်ခြေရှိ စုစုပေါင်းထိုးကြေးငွေနှင့် ပေါက်ငွေ ခန့်မှန်းချက်။</p>
              <p><b>ဆက်လက် လုပ်ဆောင်ရမည့်အဆင့်:</b> အသင်းများ ရွေးချယ်ပြီးပါက "စလစ် အတည်ပြု သိမ်းဆည်းမည်" ကို နှိပ်၍ လက်မှတ်ထုတ်ပေးရန်။</p>
            </div>
          </div>
        </div>
      </section>

      {/* F. အမှားများနှင့် ဖြေရှင်းနည်း */}
      <section className="space-y-3 border-l-4 border-emerald-600 pl-4 py-1">
        <h4 className="text-base font-black text-emerald-950 flex items-center gap-2">
          <span>F. အမှားများနှင့် ဖြေရှင်းနည်း</span>
        </h4>
        <div className="space-y-3">
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs space-y-1 text-rose-950">
            <p className="font-bold">ပြဿနာ ၁: "ပွဲချိန်စတင်ပြီး သို့မဟုတ် ပြီးဆုံးသွားသော ပွဲဖြစ်၍ ရွေးချယ်၍မရပါ" ဟု ပေါ်လာခြင်း</p>
            <p><b>၁။ အသုံးပြုသူ ဘာကိုမြင်ရသလဲ:</b> အသင်းအား နှိပ်ရာတွင် ရွေးချယ်၍မရဘဲ Alert ပေါ်လာခြင်း။</p>
            <p><b>၂။ ဘာကြောင့်ဖြစ်နိုင်သလဲ:</b> ထိုပွဲစဉ်၏ ကစားချိန် Kickoff Time ကျော်လွန်သွားခြင်း သို့မဟုတ် ပွဲပြီးဆုံးသွားခြင်း။</p>
            <p><b>၃။ ဘယ်လိုစစ်ဆေးရမလဲ:</b> ပွဲစဉ်၏ ကစားမည့်ရက်နှင့် အချိန်ကို စစ်ဆေးပါ။</p>
            <p><b>၄။ ဘယ်လိုဖြေရှင်းရမလဲ:</b> မကစားရသေးသော ရှေ့ပွဲစဉ်များကိုသာ ရွေးချယ်ထိုးသား လက်ခံပါ။</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-1 text-amber-950">
            <p className="font-bold">ပြဿနာ ၂: အဖြေတွက်ပြီးသော်လည်း စလစ်များ Pending ဖြစ်နေဆဲ ဖြစ်ခြင်း</p>
            <p><b>၁။ အသုံးပြုသူ ဘာကိုမြင်ရသလဲ:</b> စလစ်ဇယားတွင် နိုင်/ရှုံး မပေါ်ဘဲ Pending (စောင့်ဆိုင်းဆဲ) အဖြစ် ကျန်ရှိနေခြင်း။</p>
            <p><b>၂။ ဘာကြောင့်ဖြစ်နိုင်သလဲ:</b> ထိုမောင်းလက်မှတ်တွင် ပါဝင်သော အသင်းများအနက် အချို့ပွဲများ ဂိုးရလဒ် မထည့်ရသေးခြင်း။</p>
            <p><b>၃။ ဘယ်လိုစစ်ဆေးရမလဲ:</b> "ပွဲစဉ်ဇယား" တွင် ထိုမောင်းထဲပါသည့် ပွဲအားလုံး ရလဒ်ထည့်ပြီးပြီလား စစ်ပါ။</p>
            <p><b>၄။ ဘယ်လိုဖြေရှင်းရမလဲ:</b> ကျန်ရှိသော ပွဲများ၏ ဂိုးရလဒ်များကို ဖြည့်သွင်းပြီး "အဖြေတွက်ပြီး ရှင်းတမ်းထုတ်မည်" ကို ထပ်မံနှိပ်ပါ။</p>
          </div>
        </div>
      </section>

      {/* G. လုပ်ငန်းပြီးဆုံးကြောင်း စစ်ဆေးနည်း */}
      <section className="space-y-3 border-l-4 border-emerald-600 pl-4 py-1">
        <h4 className="text-base font-black text-emerald-950 flex items-center gap-2">
          <span>G. လုပ်ငန်းပြီးဆုံးကြောင်း စစ်ဆေးနည်း</span>
        </h4>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2 text-slate-700">
          <ul className="list-disc list-inside space-y-1 ml-1">
            <li><b>လက်မှတ်ထုတ်ပေးမှု:</b> "ပြေစာမှတ်တမ်းများနှင့် ရှင်းတမ်း" တွင် FB-xxxx စလစ်အမှတ်ဖြင့် အသင်းများ တိကျစွာ ပေါ်နေရမည်။</li>
            <li><b>အဖြေရှင်းတမ်း:</b> ပွဲစဉ်များ ပြီးဆုံး၍ အဖြေတွက်ပြီးပါက စလစ်ပေါ်တွင် "Won (နိုင်)" သို့မဟုတ် "Lost (ရှုံး)" အခြေအနေ အတိအကျ ပြောင်းလဲသွားပြီး ဒိုင်အသားတင် အမြတ်/ရှုံး တွက်ချက်မှု မှန်ကန်နေရမည်။</li>
          </ul>
        </div>
      </section>
    </div>
  );
};
