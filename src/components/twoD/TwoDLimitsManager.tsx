import React, { useState } from 'react';
import {
  Sliders,
  Ban,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Layers,
  Save,
  Trash2
} from 'lucide-react';
import { useTwoDLottery } from '../../context/TwoDLotteryContext';
import { formatAmount, convertMyanmarToEnglishDigits } from '../../utils/lotteryUtils';
import {
  TWO_D_DOUBLES,
  TWO_D_POWER,
  TWO_D_NATKHAT,
  TWO_D_BROTHERS,
  getTwoDBreakNumbers
} from '../../utils/twoDLotteryUtils';

export const TwoDLimitsManager: React.FC = () => {
  const {
    settings,
    updateSettings,
    limits,
    blockedNumbers,
    setNumberLimit,
    setBatchLimits,
    removeNumberLimit,
    toggleBlockNumber,
    setBatchBlocked,
    aggregates
  } = useTwoDLottery();

  const isMyanmar = settings.language === 'my';

  // Global default limit
  const [globalLimitInput, setGlobalLimitInput] = useState(String(settings.globalStockLimit || 50000));

  // Single number limit
  const [singleNum, setSingleNum] = useState('');
  const [singleLimitAmt, setSingleLimitAmt] = useState('30000');

  // Single block number
  const [blockNumInput, setBlockNumInput] = useState('');

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleUpdateGlobal = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(globalLimitInput);
    if (!isNaN(amt) && amt > 0) {
      updateSettings({ globalStockLimit: amt });
      showToast(isMyanmar ? 'အခြေခံ မူလသတ်မှတ်ဘရိတ်ကို သိမ်းဆည်းပြီးပါပြီ' : 'Global limit updated');
    }
  };

  const handleSetSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = singleNum.trim().padStart(2, '0');
    const amt = parseFloat(singleLimitAmt);
    if (clean.length === 2 && !isNaN(amt) && amt >= 0) {
      setNumberLimit(clean, amt);
      setSingleNum('');
      showToast(isMyanmar ? `ဂဏန်း [${clean}] အတွက် ဘရိတ် ${formatAmount(amt, settings.currency)} သတ်မှတ်ပြီးပါပြီ` : `Limit set for ${clean}`);
    }
  };

  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = blockNumInput.trim().padStart(2, '0');
    if (clean.length === 2) {
      toggleBlockNumber(clean);
      setBlockNumInput('');
      showToast(isMyanmar ? `ဂဏန်း [${clean}] အား ဒိုင်ကာအဖြစ် သတ်မှတ်/ပယ်ဖျက်ပြီးပါပြီ` : `Toggled block for ${clean}`);
    }
  };

  const blockedList = Object.keys(blockedNumbers).filter(k => blockedNumbers[k]).sort();
  const customLimitList = Object.keys(limits).sort();

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {toastMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 flex items-center gap-3 font-bold text-sm shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Top Configuration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Default Global Stock Limit */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {isMyanmar ? 'အခြေခံ မူလသတ်မှတ်ဘရိတ် (Global Stock Limit)' : 'Global Default Limit'}
              </h3>
              <p className="text-xs text-slate-500">
                {isMyanmar ? 'ဂဏန်းအားလုံးအတွက် ပုံမှန်ကန့်သတ်မည့် အမြင့်ဆုံး ထိုးကြေး' : 'Applies to all numbers unless overridden'}
              </p>
            </div>
          </div>

          <form onSubmit={handleUpdateGlobal} className="flex items-center gap-3">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={globalLimitInput}
              onChange={(e) => setGlobalLimitInput(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, ''))}
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
              className="flex-1 h-12 px-4 text-right font-mono text-lg font-bold rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 bg-slate-50"
            />
            <button
              type="submit"
              className="h-12 px-5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isMyanmar ? 'သိမ်းမည်' : 'Save'}
            </button>
          </form>
        </div>

        {/* Card 2: Individual Number Limit */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {isMyanmar ? 'ဂဏန်းတစ်ခုချင်း သီးသန့်ဘရိတ် သတ်မှတ်ရန်' : 'Set Specific Number Limit'}
              </h3>
              <p className="text-xs text-slate-500">
                {isMyanmar ? 'ဂဏန်းတစ်ခုချင်းကို သတ်မှတ်ထိုးကြေး သီးသန့် ကန့်သတ်ခြင်း' : 'Override default limit for a specific number'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSetSingle} className="grid grid-cols-12 gap-2.5">
            <div className="col-span-4">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                placeholder="24"
                value={singleNum}
                onChange={(e) => setSingleNum(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 2))}
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
                className="w-full h-12 px-3 text-center font-mono text-lg font-black rounded-xl border border-slate-300 focus:border-indigo-500 bg-slate-50"
              />
            </div>
            <div className="col-span-5">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="30000"
                value={singleLimitAmt}
                onChange={(e) => setSingleLimitAmt(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, ''))}
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
                className="w-full h-12 px-3 text-right font-mono text-sm font-bold rounded-xl border border-slate-300 focus:border-indigo-500 bg-slate-50"
              />
            </div>
            <div className="col-span-3">
              <button
                type="submit"
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {isMyanmar ? 'သတ်မှတ်' : 'Set'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Blocked Numbers (ဒိုင်ကာဂဏန်းများ) Section */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
              <Ban className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {isMyanmar ? 'ဒိုင်ကာဂဏန်းများ သတ်မှတ်ချက် (Blocked Numbers)' : 'Dealer Blocked Numbers'}
              </h3>
              <p className="text-xs text-rose-600 font-bold">
                {isMyanmar
                  ? 'ဤဂဏန်းများကို ထိုးကြေးတက်လာလျှင်လည်း လုံးဝလက်မခံဘဲ ပိတ်ပင်ထားပါမည်'
                  : 'These numbers will be strictly rejected even if bets increase'}
              </p>
            </div>
          </div>

          {/* Quick Single Add Input */}
          <form onSubmit={handleAddBlock} className="flex items-center gap-2">
            <input
              type="text"
              maxLength={2}
              placeholder="00"
              value={blockNumInput}
              onChange={(e) => setBlockNumInput(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 2))}
              onFocus={(e) => e.target.select()}
              className="w-16 h-10 text-center font-mono text-base font-black rounded-xl border border-slate-300 focus:border-rose-500 bg-slate-50"
            />
            <button
              type="submit"
              className="px-4 h-10 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isMyanmar ? 'ဒိုင်ကာ ပိတ်မည်' : 'Block'}
            </button>
          </form>
        </div>

        {/* Pattern Quick Block Buttons */}
        <div>
          <span className="text-xs font-bold text-slate-600 mb-2 block">
            {isMyanmar ? 'အုပ်စုလိုက် ဒိုင်ကာ အမြန်ပိတ်ရန် ခလုတ်များ:' : 'Batch Block Shortcuts:'}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setBatchBlocked(TWO_D_DOUBLES, true)}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              + {isMyanmar ? 'အပူး (၁၀ ကွက်) အားလုံးပိတ်' : 'Block Doubles (10)'}
            </button>
            <button
              type="button"
              onClick={() => setBatchBlocked(TWO_D_POWER, true)}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              + {isMyanmar ? 'ပါဝါ (၁၀ ကွက်) အားလုံးပိတ်' : 'Block Power (10)'}
            </button>
            <button
              type="button"
              onClick={() => setBatchBlocked(TWO_D_NATKHAT, true)}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              + {isMyanmar ? 'နက္ခတ် (၁၀ ကွက်) အားလုံးပိတ်' : 'Block Natkhat (10)'}
            </button>
            <button
              type="button"
              onClick={() => setBatchBlocked(TWO_D_BROTHERS, true)}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              + {isMyanmar ? 'ညီကို (၂၀ ကွက်) အားလုံးပိတ်' : 'Block Brothers (20)'}
            </button>
            {blockedList.length > 0 && (
              <button
                type="button"
                onClick={() => setBatchBlocked(blockedList, false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer ml-auto"
              >
                {isMyanmar ? 'ဒိုင်ကာ အားလုံး ပြန်ဖွင့်မည်' : 'Unblock All'}
              </button>
            )}
          </div>
        </div>

        {/* Current Blocked Numbers Chips */}
        <div>
          <span className="text-xs font-bold text-slate-700 mb-2 block">
            {isMyanmar ? `လက်ရှိ ဒိုင်ကာ ပိတ်ထားသော ဂဏန်းများ (${blockedList.length} ကွက်):` : `Currently Blocked (${blockedList.length}):`}
          </span>
          {blockedList.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs font-medium border border-dashed border-slate-200 rounded-2xl">
              {isMyanmar ? 'ဒိုင်ကာ ပိတ်ထားသော ဂဏန်းမရှိသေးပါ' : 'No numbers currently blocked'}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {blockedList.map(num => (
                <div
                  key={num}
                  className="px-3 py-1.5 bg-rose-100 text-rose-950 font-mono text-sm font-black rounded-xl flex items-center gap-2 border border-rose-200"
                >
                  <span>{num}</span>
                  <button
                    type="button"
                    onClick={() => toggleBlockNumber(num)}
                    title="Remove block"
                    className="text-rose-500 hover:text-rose-900 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom Specific Limits Table */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <span>{isMyanmar ? 'သီးသန့် သတ်မှတ်ထားသော ဂဏန်းဘရိတ်များ စာရင်း' : 'Active Specific Limits'}</span>
            <span className="px-2 py-0.5 bg-teal-100 text-teal-800 text-xs font-bold rounded-full">
              {customLimitList.length}
            </span>
          </h3>
        </div>

        {customLimitList.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs font-medium">
            {isMyanmar ? 'သီးသန့် သတ်မှတ်ထားသော ဂဏန်းမရှိပါ (မူလဘရိတ်အတိုင်း လက်ခံပါသည်)' : 'All numbers using default global limit'}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {customLimitList.map(num => (
              <div
                key={num}
                className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between"
              >
                <div>
                  <span className="font-mono text-lg font-black text-slate-900 block">{num}</span>
                  <span className="font-mono text-xs font-bold text-teal-700">
                    {formatAmount(limits[num], settings.currency)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeNumberLimit(num)}
                  className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
