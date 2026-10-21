import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  X,
  Search,
  Sliders,
  DollarSign,
  ArrowRight,
  Info,
  RotateCcw,
  Sparkles,
  Calculator
} from 'lucide-react';
import { useTwoDLottery } from '../../context/TwoDLotteryContext';
import { TwoDNumberAggregate } from '../../types';
import { formatAmount } from '../../utils/lotteryUtils';
import {
  calculateOptimalSafeCap,
  evaluateCustomCap,
  OptimalCapResult
} from '../../utils/optimalCapCalculator';

interface TwoDSmartCapAdvisoryProps {
  onOpenLimitsManager?: (num?: string) => void;
}

export const TwoDSmartCapAdvisory: React.FC<TwoDSmartCapAdvisoryProps> = ({
  onOpenLimitsManager
}) => {
  const { settings, activeRound, aggregates, roundSummary } = useTwoDLottery();
  const isMyanmar = settings.language === 'my';

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailSearch, setDetailSearch] = useState('');
  const [riskBudget, setRiskBudget] = useState<number>(0);

  // Custom Cap Testing State
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customCapInput, setCustomCapInput] = useState<string>('2000');

  // Pull settings directly as explicitly required:
  // 1. ပေါက်ဆ/ပေါက်ကြေး: Taken strictly from settings.defaultMultiplier
  const multiplier = (typeof settings.defaultMultiplier === 'number' && settings.defaultMultiplier > 0)
    ? Number(settings.defaultMultiplier)
    : (Number(activeRound?.multiplier) || 80);

  // 2. အောက်လက်ကော်မရှင် (ကိုယ်က ပေးရမှာ / customer discount): Taken strictly from settings.defaultCustomerDiscount
  const downlineCommRate = typeof settings.defaultCustomerDiscount === 'number'
    ? Number(settings.defaultCustomerDiscount)
    : 0;

  // 3. အထက်ကော်မရှင် (ကိုယ်ရမှာ / master bookie commission): Taken strictly from settings.defaultCommissionRate
  const uplineCommRate = typeof settings.defaultCommissionRate === 'number'
    ? Number(settings.defaultCommissionRate)
    : (Number(activeRound?.commissionRate) || 12);

  // Convert aggregates to betsList for calculator
  const betsList = useMemo(() => {
    return (Object.values(aggregates) as TwoDNumberAggregate[])
      .filter(item => item.totalSold > 0)
      .map(item => ({
        number: item.number,
        stake: item.totalSold
      }));
  }, [aggregates]);

  // 1. Auto Calculated Optimal Safe Cap
  const autoResult: OptimalCapResult = useMemo(() => {
    return calculateOptimalSafeCap({
      betsList,
      multiplier,
      downlineCommRate,
      uplineCommRate,
      maxRiskBudget: riskBudget,
      globalLimit: settings.globalStockLimit
    });
  }, [betsList, multiplier, downlineCommRate, uplineCommRate, riskBudget, settings.globalStockLimit]);

  // Keep customCapInput synced with auto optimalCap when in auto mode
  useEffect(() => {
    if (!isCustomMode && autoResult.optimalCap > 0) {
      setCustomCapInput(autoResult.optimalCap.toString());
    }
  }, [autoResult.optimalCap, isCustomMode]);

  // 2. Custom Tested Cap Result
  const customCapNumber = useMemo(() => {
    const parsed = parseFloat(customCapInput.replace(/,/g, ''));
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [customCapInput]);

  const customResult: OptimalCapResult = useMemo(() => {
    return evaluateCustomCap(customCapNumber, {
      betsList,
      multiplier,
      downlineCommRate,
      uplineCommRate,
      maxRiskBudget: riskBudget
    });
  }, [betsList, multiplier, downlineCommRate, uplineCommRate, customCapNumber, riskBudget]);

  // Active result displayed
  const activeResult = isCustomMode ? customResult : autoResult;

  // Filtered breakdown in modal
  const filteredBreakdown = useMemo(() => {
    if (!detailSearch.trim()) return activeResult.breakdown;
    return activeResult.breakdown.filter(item => item.number.includes(detailSearch.trim()));
  }, [activeResult.breakdown, detailSearch]);

  const handleSelectPreset = (amt: number) => {
    setIsCustomMode(true);
    setCustomCapInput(amt.toString());
  };

  const handleResetToAuto = () => {
    setIsCustomMode(false);
    setCustomCapInput(autoResult.optimalCap.toString());
  };

  return (
    <div className="space-y-3">
      {/* Interactive Cap Simulator Bar (ပိုင်ရှင် စိတ်ကြိုက် စမ်းသပ်တွက်ချက်နိုင်သည့် Control Bar) */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 mr-1">
            <Calculator className="w-4 h-4 text-teal-700" />
            <span className="text-xs font-black text-slate-800">
              {isMyanmar ? 'ဘရိတ် စမ်းသပ်တွက်ချက်မှု:' : 'Cap Simulator:'}
            </span>
          </div>

          {/* Mode Switch Buttons */}
          <button
            type="button"
            onClick={handleResetToAuto}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              !isCustomMode
                ? 'bg-teal-700 text-white shadow-xs ring-2 ring-teal-200'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isMyanmar ? 'Auto အကြံပြုချက်' : 'Auto Suggested'}</span>
            <span className="text-[10px] font-mono bg-teal-800 text-teal-100 px-1 rounded">
              {formatAmount(autoResult.optimalCap, settings.currency)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setIsCustomMode(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              isCustomMode
                ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-200'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{isMyanmar ? 'စိတ်ကြိုက် စမ်းသပ်မည်' : 'Custom Test'}</span>
            {isCustomMode && (
              <span className="text-[10px] font-mono bg-indigo-700 text-indigo-100 px-1 rounded">
                {formatAmount(customCapNumber, settings.currency)}
              </span>
            )}
          </button>

          {/* Quick Presets */}
          <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
            {[1000, 2000, 2500, 3000, 5000].map(amt => (
              <button
                key={amt}
                type="button"
                onClick={() => handleSelectPreset(amt)}
                className={`px-2 py-1 text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer ${
                  isCustomMode && customCapNumber === amt
                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
                title={`ဘရိတ် ${amt} ဖြင့် စမ်းသပ်မည်`}
              >
                {amt.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Input Field with Disclaimer Badge */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-500 font-medium shrink-0">
              {isMyanmar ? 'စမ်းသပ်ဘရိတ်:' : 'Test Cap:'}
            </span>
            <div className="relative w-28">
              <input
                type="number"
                step="100"
                min="0"
                placeholder="2000"
                value={customCapInput}
                onChange={(e) => {
                  setCustomCapInput(e.target.value);
                  setIsCustomMode(true);
                }}
                className="w-full h-8 px-2 text-xs font-mono font-bold rounded-xl border border-indigo-300 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-200 bg-indigo-50/40 text-indigo-900"
              />
            </div>
            <span className="text-[11px] text-slate-400 font-mono">Ks</span>
          </div>

          <span
            className="text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg shrink-0 font-medium"
            title="ဒီနေရာမှာထည့်သည့်ဘရိတ်သည် စမ်းခြင်းသာဖြစ်သည်။ ဆက်တင်ထဲကဘရိတ်သည်သာအတည်ဖြစ်သည်။"
          >
            {isMyanmar ? '⚠️ စမ်းသပ်ချက်သာ (ဆက်တင်အတည်)' : 'Test Only'}
          </span>
        </div>
      </div>

      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Sales */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500 font-bold block">
                {isMyanmar ? 'စုစုပေါင်း အရောင်းရငွေ' : 'Total 2D Sales'}
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono font-bold" title="ဆက်တင်ထဲက အောက်လက်ကော်မရှင် / လျှော့ငွေ (%)">
                {isMyanmar ? 'အောက်လက်' : 'Downline'} @{downlineCommRate}%
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
              {formatAmount(roundSummary.totalSales, settings.currency)}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>{roundSummary.totalVouchers} {isMyanmar ? 'စောင် ရောင်းပြီး' : 'vouchers'}</span>
            <span className="font-mono text-slate-500">{betsList.length} {isMyanmar ? 'ကွက် ဝင်ထား' : 'active'}</span>
          </div>
        </div>

        {/* Card 2: Safe Cap / Tested Cap */}
        <div className={`rounded-2xl p-4 border shadow-2xs flex flex-col justify-between relative overflow-hidden transition-all ${
          isCustomMode
            ? 'bg-gradient-to-br from-indigo-50 to-blue-50/60 border-indigo-200'
            : 'bg-gradient-to-br from-teal-50 to-emerald-50/60 border-teal-200'
        }`}>
          <div className="absolute top-2 right-2 opacity-10 pointer-events-none">
            <ShieldCheck className="w-16 h-16 text-slate-800" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-bold flex items-center gap-1 ${
                isCustomMode ? 'text-indigo-900' : 'text-teal-900'
              }`}>
                <ShieldCheck className={`w-3.5 h-3.5 ${isCustomMode ? 'text-indigo-700' : 'text-teal-700'}`} />
                <span>
                  {isCustomMode
                    ? (isMyanmar ? 'စမ်းသပ်ထားသော ဘရိတ်' : 'Simulated Cap')
                    : (isMyanmar ? 'အန္တရာယ်ကင်း ဘရိတ် (Safe Cap)' : 'Optimal Safe Cap')}
                </span>
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                isCustomMode
                  ? 'bg-indigo-600 text-white'
                  : activeResult.isGuaranteedProfit
                  ? 'bg-teal-600 text-white'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {isCustomMode
                  ? (isMyanmar ? 'စမ်းသပ်ချက်' : 'Simulation')
                  : activeResult.isGuaranteedProfit
                  ? (isMyanmar ? 'အာမခံအမြတ်' : 'Zero-Risk')
                  : (isMyanmar ? 'အရှုံးအနည်းဆုံး' : 'Min-Risk')}
              </span>
            </div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${
              isCustomMode ? 'text-indigo-900' : 'text-teal-800'
            }`}>
              {formatAmount(activeResult.optimalCap, settings.currency)}
              <span className="text-xs font-normal text-slate-500 ml-1">/ {isMyanmar ? 'ကွက်' : 'num'}</span>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
            {isCustomMode ? (
              <button
                type="button"
                onClick={handleResetToAuto}
                className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isMyanmar ? 'Auto သို့ ပြန်ထားမည်' : 'Reset to Auto'}</span>
              </button>
            ) : (
              <span className="text-teal-800 font-medium">
                {isMyanmar ? 'အရှုံးမရှိ စားနိုင်သောဘရိတ်' : 'Safe retention limit'}
              </span>
            )}
            <button
              type="button"
              onClick={() => setIsDetailModalOpen(true)}
              className="text-[11px] font-bold text-teal-800 hover:text-teal-900 underline flex items-center gap-0.5 cursor-pointer ml-auto"
            >
              <span>{isMyanmar ? 'အသေးစိတ်' : 'Details'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Card 3: Suggested / Simulated Retained vs Forwarded */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-indigo-700 font-bold block">
                {isCustomMode
                  ? (isMyanmar ? 'စမ်းသပ် ကိုယ်တိုင်စား / လွှဲငွေ' : 'Simulated Retain / Fwd')
                  : (isMyanmar ? 'အကြံပြု ကိုယ်တိုင်စား / လွှဲငွေ' : 'Suggested Retain / Fwd')}
              </span>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-bold" title="ဆက်တင်ထဲက ဒိုင်ကြီးအထက်ကော်မရှင် (%)">
                {isMyanmar ? 'ဒိုင်ကြီးအထက်' : 'Upline'} @{uplineCommRate}%
              </span>
            </div>
            <div className="flex items-baseline justify-between font-mono">
              <div>
                <span className="text-[10px] text-slate-400 block font-sans">{isMyanmar ? 'စားငွေ' : 'Retain'}</span>
                <span className="text-base sm:text-lg font-black text-teal-700">
                  {formatAmount(activeResult.totalRetained, settings.currency)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block font-sans">{isMyanmar ? 'လွှဲငွေ' : 'Forward'}</span>
                <span className="text-base sm:text-lg font-black text-indigo-700">
                  {formatAmount(activeResult.totalForwarded, settings.currency)}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>{isMyanmar ? 'ကျန်အသားတင်ငွေ:' : 'Net cash:'} {formatAmount(activeResult.netCashOnHand, settings.currency)}</span>
            <span className="text-indigo-600 font-medium">@{multiplier}x {isMyanmar ? 'ပေါက်ကြေး' : 'multiplier'}</span>
          </div>
        </div>

        {/* Card 4: Worst-Case Net Profit / Loss */}
        <div className={`rounded-2xl p-4 border shadow-2xs flex flex-col justify-between ${
          activeResult.worstCaseNet >= 0
            ? 'bg-emerald-50/40 border-emerald-200'
            : 'bg-rose-50/40 border-rose-200'
        }`}>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-bold block ${
                activeResult.worstCaseNet >= 0 ? 'text-emerald-800' : 'text-rose-800'
              }`}>
                {isMyanmar ? 'အဆိုးဆုံး အမြတ်/အရှုံး' : 'Worst-Case Net Result'}
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                activeResult.worstCaseNet >= 0
                  ? 'bg-emerald-200 text-emerald-900'
                  : 'bg-rose-200 text-rose-900'
              }`}>
                {activeResult.worstCaseNet >= 0 ? (isMyanmar ? 'အမြတ်ကျန်' : 'Profit') : (isMyanmar ? 'အရှုံးဖြစ်နိုင်' : 'Risk')}
              </span>
            </div>
            <div className={`text-xl sm:text-2xl font-black font-mono ${
              activeResult.worstCaseNet >= 0 ? 'text-emerald-700' : 'text-rose-700'
            }`}>
              {activeResult.worstCaseNet >= 0 ? '+' : ''}{formatAmount(activeResult.worstCaseNet, settings.currency)}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 truncate max-w-[170px]" title="မည်သည့်ဂဏန်းပေါက်ပေါက် အဆိုးဆုံးအခြေအနေ">
              {isMyanmar ? 'မည်သည့်ဂဏန်းပေါက်ပေါက်' : 'Any number hits'}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {isMyanmar ? 'လျော်ကြေး:' : 'Payout:'} {formatAmount(activeResult.worstCasePayout, settings.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Advisory Breakdown & Analysis Modal (Pure Advisory - No Forward Button as requested) */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-teal-50 via-slate-50 to-indigo-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    {isMyanmar ? 'အန္တရာယ်အကင်းဆုံး ဖြတ်စားရမည့် ဘရိတ် အကြံပြုချက်' : 'Optimal Safe Cap Advisory'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {isMyanmar ? 'ဒိုင်ပိုင်ရှင် ဆုံးဖြတ်ချက်အတွက် တွက်ချက်မှု အသေးစိတ် အကြံပေးချက်' : 'Analytical safe retention suggestion based on current sales'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="w-9 h-9 rounded-xl hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Advisory Info Note (Explicit disclaimer that this is simulation/advice only) */}
            <div className="px-5 py-3 bg-amber-50/80 border-b border-amber-200 flex items-start gap-2.5 text-xs text-amber-900">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <span className="font-bold">
                  {isMyanmar ? 'သတိပြုရန် အကြံပေးချက်:' : 'Advisory Note:'}
                </span>{' '}
                <span>
                  {isMyanmar
                    ? 'ဤနေရာတွင် ရိုက်ထည့်၍ စမ်းသပ်တွက်ချက်မှုသည် အကြံပေးချက် သက်သက်သာ ဖြစ်ပါသည်။ ဆက်တင် (Settings) ထဲရှိ ဘရိတ်ကို လုံးဝမထိခိုက်ပါ။ အထက်သို့တင်ခြင်း သို့မဟုတ် ဘရိတ်သတ်မှတ်ခြင်းကို ပိုင်ရှင်က ဆက်တင်ထဲတွင်သာ လိုအပ်သလို သတ်မှတ်ဆောင်ရွက်မည် ဖြစ်ပါသည်။'
                    : 'The cap entered here is for testing and simulation only. It does not alter your saved Settings.'}
                </span>
              </div>
            </div>

            {/* Modal Body: Metrics Summary & Parameters */}
            <div className="p-5 overflow-y-auto space-y-4 text-slate-700 text-xs">
              {/* Parameter Settings Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    {isMyanmar ? 'ပေါက်ကြေးအဆ (Multiplier):' : 'Multiplier:'}
                  </span>
                  <span className="font-black text-slate-900 font-mono text-sm">
                    {multiplier}x
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    {isMyanmar ? 'အောက်လက် ကော်မရှင်:' : 'Downline Comm:'}
                  </span>
                  <span className="font-black text-slate-900 font-mono text-sm">
                    {downlineCommRate}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    {isMyanmar ? 'အထက်ဒိုင် ကော်မရှင်:' : 'Upline Comm:'}
                  </span>
                  <span className="font-black text-slate-900 font-mono text-sm">
                    {uplineCommRate}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    {isMyanmar ? 'အများဆုံး ထိုးကြေး (Max):' : 'Peak Stake:'}
                  </span>
                  <span className="font-black text-rose-700 font-mono text-sm">
                    {formatAmount(activeResult.maxSingleStake, settings.currency)}
                  </span>
                </div>
              </div>

              {/* Cap Summary Banner */}
              <div className={`rounded-2xl p-4 text-white shadow-sm flex flex-wrap items-center justify-between gap-3 ${
                isCustomMode
                  ? 'bg-gradient-to-r from-indigo-600 to-blue-600'
                  : 'bg-gradient-to-r from-teal-500 to-emerald-600'
              }`}>
                <div>
                  <span className="text-white/80 text-[11px] font-bold block">
                    {isCustomMode
                      ? (isMyanmar ? 'စမ်းသပ်ထားသော ဘရိတ် (Simulated Cap)' : 'Simulated Cap')
                      : (isMyanmar ? 'အကြံပြု အန္တရာယ်ကင်း ဘရိတ် (Suggested Safe Cap)' : 'Recommended Safe Cap')}
                  </span>
                  <div className="text-2xl sm:text-3xl font-black font-mono">
                    {formatAmount(activeResult.optimalCap, settings.currency)}{' '}
                    <span className="text-sm font-normal text-white/80">/ {isMyanmar ? 'ကွက်' : 'num'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-white/80 text-[11px] font-bold block">
                    {isMyanmar ? 'မည်သည့်ဂဏန်းပေါက်ပေါက် အဆိုးဆုံးရလဒ်' : 'Guaranteed Worst-Case'}
                  </span>
                  <div className="text-xl sm:text-2xl font-black font-mono">
                    {activeResult.worstCaseNet >= 0 ? '+' : ''}{formatAmount(activeResult.worstCaseNet, settings.currency)}
                  </div>
                </div>
              </div>

              {/* Number-by-Number Breakdown Table */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 text-sm">
                    {isMyanmar ? 'ဂဏန်းအလိုက် စားငွေ နှင့် လွှဲငွေ ခွဲခြမ်းစိတ်ဖြာချက်' : 'Per-Number Retained & Forwarded Breakdown'} ({filteredBreakdown.length} {isMyanmar ? 'ကွက်' : 'items'})
                  </span>
                  <div className="relative w-44">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder={isMyanmar ? 'ဂဏန်းရှာပါ...' : 'Search number...'}
                      value={detailSearch}
                      onChange={(e) => setDetailSearch(e.target.value)}
                      className="w-full h-8 pl-8 pr-2 text-xs font-mono rounded-xl border border-slate-300 focus:border-teal-500 bg-slate-50"
                    />
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 sticky top-0 font-bold text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5 pl-4">{isMyanmar ? 'ဂဏန်း' : 'Number'}</th>
                        <th className="p-2.5 text-right">{isMyanmar ? 'စုစုပေါင်း ထိုးကြေး' : 'Total Stake'}</th>
                        <th className="p-2.5 text-right text-teal-800">{isMyanmar ? 'စားမည့်ငွေ (Cap အထိ)' : 'Retained (Cap)'}</th>
                        <th className="p-2.5 text-right text-indigo-700 pr-4">{isMyanmar ? 'လွှဲမည့်ငွေ (ပိုငွေ)' : 'Forward (Excess)'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {filteredBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-400 font-sans">
                            {isMyanmar ? 'ထိုးကြေးဝင်ထားသော ဂဏန်း မရှိသေးပါ' : 'No active bets yet'}
                          </td>
                        </tr>
                      ) : (
                        filteredBreakdown.map((row) => (
                          <tr key={row.number} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-2.5 pl-4 font-black text-slate-900 text-sm">
                              {row.number}
                            </td>
                            <td className="p-2.5 text-right font-bold text-slate-800">
                              {formatAmount(row.stake, settings.currency)}
                            </td>
                            <td className="p-2.5 text-right font-bold text-teal-700">
                              {formatAmount(row.retained, settings.currency)}
                            </td>
                            <td className="p-2.5 text-right font-bold text-indigo-700 pr-4">
                              {row.forwarded > 0 ? (
                                formatAmount(row.forwarded, settings.currency)
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                {isMyanmar ? 'ဘရိတ်သတ်မှတ်ရန် စာရင်းချုပ်မျက်နှာပြင်တွင် ဂဏန်းကို နှိပ်ပါ' : 'Click any number on the ledger to adjust its limit'}
              </span>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                {isMyanmar ? 'ပိတ်မည်' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
