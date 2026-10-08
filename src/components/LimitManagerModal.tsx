import React, { useState } from 'react';
import {
  X,
  Sliders,
  Lock,
  Unlock,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Layers,
  Search,
  Zap,
  Info,
  Edit2,
  Check,
  ShieldAlert
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { formatAmount, getPermutations, convertMyanmarToEnglishDigits } from '../utils/lotteryUtils';

interface LimitManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialNumber?: string;
  initialTab?: 'custom' | 'blocked' | 'global';
}

export const LimitManagerModal: React.FC<LimitManagerModalProps> = ({
  isOpen,
  onClose,
  initialNumber,
  initialTab = 'custom'
}) => {
  const {
    settings,
    updateSettings,
    limits,
    setNumberLimit,
    setBatchLimits,
    removeNumberLimit,
    blockedNumbers,
    toggleBlockNumber,
    setBatchBlocked,
    aggregates
  } = useLottery();

  const isMyanmar = settings.language === 'my';

  const [activeTab, setActiveTab] = useState<'custom' | 'blocked' | 'global'>(initialTab);

  // Per-number limit state
  const [numberInput, setNumberInput] = useState(initialNumber || '');
  const [limitInput, setLimitInput] = useState('50000');
  const [isRumbleLimit, setIsRumbleLimit] = useState(false);
  const [limitSearch, setLimitSearch] = useState('');

  // Editing existing limit
  const [editingNumber, setEditingNumber] = useState<string | null>(null);
  const [editingAmount, setEditingAmount] = useState<string>('');

  // Blocked numbers (ဒိုင်ကာဂဏန်းများ) state
  const [blockedInput, setBlockedInput] = useState('');
  const [isRumbleBlocked, setIsRumbleBlocked] = useState(false);
  const [blockedSearch, setBlockedSearch] = useState('');

  // Global defaults
  const [globalLimitInput, setGlobalLimitInput] = useState(String(settings.globalStockLimit || ''));
  const [alertPctInput, setAlertPctInput] = useState(String(settings.lowStockAlertPercentage || ''));

  if (!isOpen) return null;

  // Set Custom Limit (supports single 3-digit or comma/space separated or Rumble)
  const handleSetCustomLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numberInput.trim()) return;
    const lmt = parseInt(limitInput, 10);
    if (isNaN(lmt) || lmt <= 0) return;

    // Parse tokens
    const tokens = numberInput.trim().split(/[\s,]+/);
    const validNumbers: string[] = [];

    tokens.forEach(tok => {
      const clean = tok.replace(/[^0-9]/g, '');
      if (clean.length === 3) {
        if (isRumbleLimit) {
          const perms = getPermutations(clean);
          validNumbers.push(...perms);
        } else {
          validNumbers.push(clean);
        }
      }
    });

    if (validNumbers.length > 0) {
      setBatchLimits(Array.from(new Set(validNumbers)), lmt);
      setNumberInput('');
      setIsRumbleLimit(false);
    }
  };

  // Save Inline Edit
  const handleSaveInlineEdit = (num: string) => {
    const val = parseInt(editingAmount, 10);
    if (!isNaN(val) && val > 0) {
      setNumberLimit(num, val);
    }
    setEditingNumber(null);
  };

  // Add Blocked Numbers (ဒိုင်ကာဂဏန်း)
  const handleAddBlockedNumbers = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockedInput.trim()) return;

    const tokens = blockedInput.trim().split(/[\s,]+/);
    const validNumbers: string[] = [];

    tokens.forEach(tok => {
      const clean = tok.replace(/[^0-9]/g, '');
      if (clean.length === 3) {
        if (isRumbleBlocked) {
          const perms = getPermutations(clean);
          validNumbers.push(...perms);
        } else {
          validNumbers.push(clean);
        }
      }
    });

    if (validNumbers.length > 0) {
      setBatchBlocked(Array.from(new Set(validNumbers)), true);
      setBlockedInput('');
      setIsRumbleBlocked(false);
    }
  };

  // Add common patterns to ဒိုင်ကာဂဏန်း
  const handleAddPatternBlocked = (patternType: 'triples' | 'powers' | 'natkhat') => {
    if (patternType === 'triples') {
      const triples = ['000', '111', '222', '333', '444', '555', '666', '777', '888', '999'];
      setBatchBlocked(triples, true);
    } else if (patternType === 'powers') {
      // 05, 16, 27, 38, 49 patterns
      const powers = ['050', '505', '161', '616', '272', '727', '383', '838', '494', '949'];
      setBatchBlocked(powers, true);
    } else if (patternType === 'natkhat') {
      // 18, 24, 35, 70, 96 patterns
      const natkhat = ['181', '818', '242', '424', '353', '535', '707', '070', '969', '696'];
      setBatchBlocked(natkhat, true);
    }
  };

  // Clear all blocked numbers
  const handleClearAllBlocked = () => {
    if (window.confirm(isMyanmar ? 'ဒိုင်ကာဂဏန်းများ အားလုံးကို ဖယ်ရှားပြီး ပြန်ဖွင့်ပေးမည်လား?' : 'Unblock all dealer protected numbers?')) {
      const allActive = Object.keys(blockedNumbers).filter(k => blockedNumbers[k]);
      setBatchBlocked(allActive, false);
    }
  };

  // Save Global Settings
  const handleSaveGlobalSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const gLimit = parseInt(globalLimitInput, 10) || settings.globalStockLimit;
    const pct = parseInt(alertPctInput, 10) || settings.lowStockAlertPercentage;
    updateSettings({
      globalStockLimit: gLimit,
      lowStockAlertPercentage: pct
    });
  };

  // Filtered limits list
  const filteredLimits = Object.entries(limits).filter(([num]) =>
    limitSearch.trim() ? num.includes(limitSearch.trim()) : true
  );

  // Active blocked numbers list
  const activeBlockedList = Object.keys(blockedNumbers)
    .filter(k => blockedNumbers[k])
    .filter(num => (blockedSearch.trim() ? num.includes(blockedSearch.trim()) : true))
    .sort();

  const totalBlockedCount = Object.keys(blockedNumbers).filter(k => blockedNumbers[k]).length;
  const totalCustomLimitsCount = Object.keys(limits).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isMyanmar ? 'ဒိုင်ကာဂဏန်းနှင့် သတ်မှတ်ထိုးကြေး စီမံခန့်ခွဲမှု' : 'Limits & Protected Numbers Management'}
              </h3>
              <p className="text-xs text-slate-500">
                {isMyanmar
                  ? 'ဒိုင်ကာဂဏန်းများ (လုံးဝလက်မခံ) နှင့် ဂဏန်းတစ်ခုချင်း သတ်မှတ်ထိုးကြေး (ဘရိတ်ငွေ) သတ်မှတ်ရန်'
                  : 'Configure dealer protected numbers (strict rejection) and per-number quotas.'}
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

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-5 pt-2">
          {/* Tab 1: Dealer Protected (ဒိုင်ကာဂဏန်း) */}
          <button
            type="button"
            onClick={() => setActiveTab('blocked')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'blocked'
                ? 'border-rose-600 text-rose-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-4 h-4 text-rose-600" />
            <span>{isMyanmar ? 'ဒိုင်ကာဂဏန်းများ (လက်မခံပါ)' : 'Protected Numbers'}</span>
            {totalBlockedCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                {totalBlockedCount}
              </span>
            )}
          </button>

          {/* Tab 2: Custom Limits (ဂဏန်းတစ်ခုချင်း သတ်မှတ်ထိုးကြေး) */}
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'custom'
                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-4 h-4 text-indigo-600" />
            <span>{isMyanmar ? 'ဂဏန်းတစ်ခုချင်း သတ်မှတ်ထိုးကြေး' : 'Per-Number Limits'}</span>
            {totalCustomLimitsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                {totalCustomLimitsCount}
              </span>
            )}
          </button>

          {/* Tab 3: Global Limits */}
          <button
            type="button"
            onClick={() => setActiveTab('global')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'global'
                ? 'border-amber-600 text-amber-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Shield className="w-4 h-4 text-amber-600" />
            <span>{isMyanmar ? 'အထွေထွေ အခြေခံ ကန့်သတ်ချက်' : 'Default Limits'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 max-h-[72vh] overflow-y-auto">
          
          {/* TAB 1: DEALER PROTECTED NUMBERS (ဒိုင်ကာဂဏန်းများ) */}
          {activeTab === 'blocked' && (
            <div className="space-y-5">
              {/* Info banner */}
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-3 text-rose-900">
                <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-bold block">
                    {isMyanmar ? 'ဒိုင်ကာဂဏန်း စည်းမျဉ်း (Strict Rejection Policy)' : 'Protected Numbers Policy'}
                  </span>
                  <p className="text-rose-800/90 leading-relaxed">
                    {isMyanmar
                      ? 'ဤနေရာတွင် သတ်မှတ်ထားသော ဂဏန်းများအား အရောင်းစာရင်းသွင်းရာ၌ ဖြစ်စေ၊ စာသား ကူးထည့်ရာ၌ ဖြစ်စေ၊ ဓါတ်ပုံဖတ်ရာ၌ ဖြစ်စေ ထိုးကြေးတက်လာသော်လည်း စနစ်မှ လုံးဝလက်မခံဘဲ ပယ်ဖျက်ပေးပါမည်။'
                      : 'Numbers marked here are strictly protected. Incoming bets will be rejected regardless of offered amount.'}
                  </p>
                </div>
              </div>

              {/* Add Protected Number Form */}
              <form onSubmit={handleAddBlockedNumbers} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-rose-600" />
                    <span>{isMyanmar ? 'ဒိုင်ကာဂဏန်း အသစ်ထည့်သွင်းရန်' : 'Add Protected Number(s)'}</span>
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-indigo-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRumbleBlocked}
                      onChange={(e) => setIsRumbleBlocked(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold">{isMyanmar ? 'R ပတ်လည်ပါ ကာမည် (Rumble Permutations)' : 'Include All R'}</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-8 space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      {isMyanmar ? 'ဂဏန်း (၃ လုံး သို့မဟုတ် ကော်မာခြား၍ အများအပြား)' : '3-Digit Number(s)'}
                    </label>
                    <input
                      type="text"
                      value={blockedInput}
                      onChange={(e) => setBlockedInput(convertMyanmarToEnglishDigits(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      placeholder={isMyanmar ? 'ဥပမာ: 987 သို့မဟုတ် 123, 456, 789' : 'e.g. 987 or 123, 456'}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold font-mono text-rose-900 outline-none focus:border-rose-500 shadow-2xs"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <button
                      type="submit"
                      disabled={!blockedInput.trim()}
                      className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <Lock className="w-4 h-4" />
                      <span>{isMyanmar ? 'ဒိုင်ကာအဖြစ် သတ်မှတ်' : 'Set Protected'}</span>
                    </button>
                  </div>
                </div>

                {/* Quick Pattern Buttons */}
                <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-500 text-[11px] font-semibold">
                    {isMyanmar ? 'အမြန်သတ်မှတ်ရန်:' : 'Quick Presets:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleAddPatternBlocked('triples')}
                    className="px-2 py-1 rounded-lg bg-slate-200/70 hover:bg-slate-300 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    + {isMyanmar ? 'အပူးဂဏန်းများ (000-999)' : 'Triples (000-999)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPatternBlocked('powers')}
                    className="px-2 py-1 rounded-lg bg-slate-200/70 hover:bg-slate-300 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    + {isMyanmar ? 'ပါဝါဂဏန်းများ' : 'Powers'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddPatternBlocked('natkhat')}
                    className="px-2 py-1 rounded-lg bg-slate-200/70 hover:bg-slate-300 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                  >
                    + {isMyanmar ? 'နက္ခတ်ဂဏန်းများ' : 'Natkhat'}
                  </button>
                </div>
              </form>

              {/* Active Protected Numbers List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      {isMyanmar ? 'သတ်မှတ်ထားသော ဒိုင်ကာဂဏန်းများ စာရင်း:' : 'Active Protected Numbers:'}
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                      {totalBlockedCount} {isMyanmar ? 'လုံး' : 'numbers'}
                    </span>
                  </div>

                  {totalBlockedCount > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                        <input
                          type="text"
                          value={blockedSearch}
                          onChange={(e) => setBlockedSearch(e.target.value)}
                          placeholder={isMyanmar ? 'ရှာရန်...' : 'Search...'}
                          className="bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2 py-1 text-xs outline-none focus:border-indigo-500 w-28"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleClearAllBlocked}
                        className="text-xs text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
                      >
                        {isMyanmar ? 'အားလုံးဖျက်မည်' : 'Clear All'}
                      </button>
                    </div>
                  )}
                </div>

                {activeBlockedList.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                    <Lock className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
                    <span>{isMyanmar ? 'ဒိုင်ကာဂဏန်း သတ်မှတ်ထားခြင်း မရှိသေးပါ' : 'No protected numbers set'}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {activeBlockedList.map(num => (
                      <div
                        key={num}
                        className="bg-rose-50 border border-rose-200 p-2 rounded-xl flex items-center justify-between text-xs group hover:border-rose-400 transition-all shadow-2xs"
                      >
                        <span className="font-mono font-black text-rose-950 text-sm">
                          {num}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleBlockNumber(num)}
                          className="text-rose-400 hover:text-rose-700 p-0.5 transition-colors cursor-pointer"
                          title={isMyanmar ? 'ဒိုင်ကာမှ ဖယ်ရှားမည်' : 'Unblock'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PER-NUMBER CUSTOM LIMITS (ဂဏန်းတစ်ခုချင်း သတ်မှတ်ထိုးကြေး) */}
          {activeTab === 'custom' && (
            <div className="space-y-5">
              
              {/* Add Custom Limit Form */}
              <form onSubmit={handleSetCustomLimit} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    <span>{isMyanmar ? 'ဂဏန်းတစ်ခုချင်း သတ်မှတ်ထိုးကြေး (ဘရိတ်ငွေ) သတ်မှတ်ရန်' : 'Set Individual Custom Limit'}</span>
                  </span>
                  <label className="flex items-center gap-1.5 text-xs text-indigo-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRumbleLimit}
                      onChange={(e) => setIsRumbleLimit(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold">{isMyanmar ? 'R ပတ်လည်ပါ သတ်မှတ်မည်' : 'Apply to All R Permutations'}</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-4 space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      {isMyanmar ? 'ဂဏန်း (၃ လုံး)' : 'Number(s)'}
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={numberInput}
                      onChange={(e) => setNumberInput(convertMyanmarToEnglishDigits(e.target.value))}
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
                      placeholder={isMyanmar ? 'ဥပမာ: 789 သို့ 123, 456' : 'e.g. 789 or 123, 456'}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold font-mono text-indigo-900 outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>

                  <div className="sm:col-span-5 space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-700">
                      {isMyanmar ? 'သတ်မှတ်ထိုးကြေး' : 'Max Limit'} ({settings.currency})
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={limitInput}
                      onChange={(e) => setLimitInput(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, ''))}
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
                      placeholder="50000"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold font-mono text-emerald-800 outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      disabled={!numberInput.trim()}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isMyanmar ? 'ဘရိတ်ထည့်မည်' : 'Set Limit'}</span>
                    </button>
                  </div>
                </div>

                {/* Quick Presets for limit amount */}
                <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-500 text-[11px] font-semibold">
                    {isMyanmar ? 'ငွေပမာဏ အမြန်ရွေးရန်:' : 'Amount Presets:'}
                  </span>
                  {[10000, 30000, 50000, 100000, 200000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setLimitInput(String(amt))}
                      className="px-2 py-0.5 rounded-lg bg-slate-200/70 hover:bg-slate-300 text-slate-700 text-[11px] font-mono font-semibold transition-colors cursor-pointer"
                    >
                      {formatAmount(amt, settings.currency)}
                    </button>
                  ))}
                </div>
              </form>

              {/* Active Limits Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      {isMyanmar ? 'သတ်မှတ်ထားသော သီးသန့်ဘရိတ်များ စာရင်း:' : 'Configured Custom Limits:'}
                    </span>
                    <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      {totalCustomLimitsCount} {isMyanmar ? 'မျိုး' : 'limits'}
                    </span>
                  </div>

                  {totalCustomLimitsCount > 0 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
                      <input
                        type="text"
                        value={limitSearch}
                        onChange={(e) => setLimitSearch(e.target.value)}
                        placeholder={isMyanmar ? 'ရှာရန်...' : 'Search number...'}
                        className="bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2 py-1 text-xs outline-none focus:border-indigo-500 w-32"
                      />
                    </div>
                  )}
                </div>

                {filteredLimits.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                    <Sliders className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
                    <span>{isMyanmar ? 'သီးသန့်ဘရိတ် သတ်မှတ်ထားခြင်း မရှိသေးပါ' : 'No custom limits found'}</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filteredLimits.map(([num, lmt]) => {
                      const limitVal = typeof lmt === 'number' ? lmt : Number(lmt) || 0;
                      const sold = aggregates[num]?.totalSold || 0;
                      const quota = Math.max(0, limitVal - sold);
                      const pct = limitVal > 0 ? Math.round((sold / limitVal) * 100) : 0;
                      const isEditing = editingNumber === num;

                      return (
                        <div
                          key={num}
                          className="bg-white border border-slate-200 p-3 rounded-xl flex items-center justify-between text-xs shadow-2xs hover:border-slate-300 transition-all"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="bg-indigo-50 text-indigo-950 font-mono font-black text-sm px-2.5 py-1 rounded-lg border border-indigo-200 tracking-wider">
                              {num}
                            </span>
                            
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={editingAmount}
                                  onChange={(e) => setEditingAmount(e.target.value)}
                                  className="w-24 bg-white border border-indigo-400 rounded px-1.5 py-0.5 text-xs font-bold font-mono"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveInlineEdit(num)}
                                  className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingNumber(null)}
                                  className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-900">
                                    {formatAmount(limitVal, settings.currency)}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingNumber(num);
                                      setEditingAmount(String(limitVal));
                                    }}
                                    className="text-slate-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                                    title={isMyanmar ? 'ပြင်မည်' : 'Edit'}
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>
                                <span className={`text-[10px] block font-mono ${
                                  pct >= 100
                                    ? 'text-rose-600 font-bold'
                                    : pct >= 80
                                    ? 'text-amber-700 font-semibold'
                                    : 'text-slate-500'
                                }`}>
                                  ရောင်းပြီး: {formatAmount(sold, settings.currency)} ({pct}%)
                                  {quota > 0 ? ` • ကျန်: ${formatAmount(quota, settings.currency)}` : ' • ဘရိတ်ပြည့်'}
                                </span>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeNumberLimit(num)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title={isMyanmar ? 'ဘရိတ် ဖျက်မည်' : 'Remove Limit'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: GLOBAL LIMITS (အထွေထွေ အခြေခံ ကန့်သတ်ချက်) */}
          {activeTab === 'global' && (
            <form onSubmit={handleSaveGlobalSettings} className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4 shadow-2xs">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-600" />
                <span>{isMyanmar ? 'အထွေထွေ အခြေခံ ကန့်သတ်ချက်များ (Default Limit)' : 'Global Default Limits'}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {isMyanmar ? 'သီးသန့်ဘရိတ်မရှိသော ဂဏန်းများအတွက် အခြေခံ ကန့်သတ်ငွေ' : 'Default Max Limit Per Number'} ({settings.currency})
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    step="5000"
                    value={globalLimitInput}
                    onChange={(e) => setGlobalLimitInput(e.target.value)}
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
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold font-mono text-emerald-700 outline-none focus:border-indigo-500 shadow-2xs"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    {isMyanmar
                      ? 'သီးသန့်ဘရိတ် မသတ်မှတ်ထားသော ဂဏန်းတိုင်းကို ဤပမာဏအထိသာ လက်ခံပါမည်။'
                      : 'Applies to any number without an individual custom limit.'}
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    {isMyanmar ? 'သတိပေးချက် စတင်ပြသမည့် ရာခိုင်နှုန်း (%)' : 'Low Stock Alert Trigger (%)'}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    min="50"
                    max="100"
                    value={alertPctInput}
                    onChange={(e) => setAlertPctInput(e.target.value)}
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
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold font-mono text-amber-800 outline-none focus:border-indigo-500 shadow-2xs"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    {isMyanmar
                      ? 'ဘရိတ်ငွေ၏ ဤရာခိုင်နှုန်း ရောက်ရှိပါက အဝါရောင် သတိပေးချက် ပြသပါမည်။'
                      : 'Warning bell rings when sold reaches this percentage.'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-200">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {isMyanmar ? 'အခြေခံကန့်သတ်ချက် သိမ်းမည်' : 'Save Default Settings'}
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
