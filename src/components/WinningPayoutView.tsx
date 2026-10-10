import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  Award,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  RotateCcw,
  Copy,
  Check,
  Phone,
  User,
  Share2,
  DollarSign,
  AlertCircle,
  Receipt
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { evaluateWinnings, formatAmount, getPermutations, convertMyanmarToEnglishDigits } from '../utils/lotteryUtils';
import { verifyOwnerPassword } from '../utils/securityUtils';
import {
  SingleRoundFinancialBreakdown,
  calculateThreeDSingleRoundStatement
} from '../utils/statementUtils';

interface WinningPayoutViewProps {
  onOpenStatement?: () => void;
}

export const WinningPayoutView: React.FC<WinningPayoutViewProps> = ({ onOpenStatement }) => {
  const {
    activeRound,
    settings,
    activeRoundVouchers,
    activeRoundForwardSlips,
    settleWinningNumber,
    clearWinningSettlement,
    roundSummary,
    exportToExcel,
    updateVoucher,
    rounds,
    createRound,
    setActiveRoundId
  } = useLottery();

  const isMyanmar = settings.language === 'my';

  const [winningInput, setWinningInput] = useState(activeRound?.winningNumber || '');
  const [multiplierInput, setMultiplierInput] = useState(
    String(activeRound?.multiplier || settings.defaultMultiplier || 600)
  );
  const [toddMultiplierInput, setToddMultiplierInput] = useState(
    String(activeRound?.toddMultiplier || settings.defaultToddMultiplier || 100)
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setWinningInput(activeRound?.winningNumber || '');
    setMultiplierInput(String(activeRound?.multiplier || settings.defaultMultiplier || 600));
    setToddMultiplierInput(String(activeRound?.toddMultiplier || settings.defaultToddMultiplier || 100));
  }, [
    activeRound?.id,
    activeRound?.winningNumber,
    activeRound?.multiplier,
    activeRound?.toddMultiplier,
    settings.defaultMultiplier,
    settings.defaultToddMultiplier
  ]);

  const [sessionSwitchMsg, setSessionSwitchMsg] = useState<string | null>(null);

  const handleStartNext3DRound = () => {
    const today = new Date();
    // Default next draw date ~ 15 days later (1st or 16th)
    const nextDate = new Date(today);
    nextDate.setDate(nextDate.getDate() + 15);
    const dateStr = nextDate.toISOString().slice(0, 10);
    const roundName = `${dateStr} အိုးစည်လေး ပွဲစဉ်`;

    const newRound = createRound({
      name: roundName,
      drawDate: dateStr,
      closingTime: '15:30',
      status: 'open',
      multiplier: settings.defaultMultiplier || 0,
      toddMultiplier: settings.defaultToddMultiplier || 0,
      commissionRate: settings.defaultCommissionRate || 0
    });

    setActiveRoundId(newRound.id);
    setWinningInput('');
    setSessionSwitchMsg(`[${newRound.name}] ပွဲစဉ်အသစ် စတင်ဖွင့်လှစ်ပြီးပါပြီ။ ယခင်ပွဲစဉ်အား မှတ်တမ်းထဲသို့ သိမ်းဆည်းပြီး စာရင်းအသစ် စတင်လက်ခံနိုင်ပါပြီ။`);

    setTimeout(() => {
      setSessionSwitchMsg(null);
    }, 6000);
  };

  // Settled 3D rounds history strictly for 3D
  const settled3DRounds = useMemo(() => {
    return rounds
      .filter(r => r.status === 'settled' || !!r.winningNumber)
      .sort((a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime());
  }, [rounds]);

  const isSettled = activeRound?.status === 'settled' && !!activeRound?.winningNumber;

  const [isTestingMode, setIsTestingMode] = useState(false);
  const [testedWinningNumber, setTestedWinningNumber] = useState('');
  const [isWinningConfirmed, setIsWinningConfirmed] = useState(false);
  const [confirmedWinningNumber, setConfirmedWinningNumber] = useState('');
  const [isEnteringPassword, setIsEnteringPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [settledSuccessMsg, setSettledSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeRound?.status === 'settled') {
      setIsTestingMode(false);
      setTestedWinningNumber('');
      setIsWinningConfirmed(false);
      setConfirmedWinningNumber('');
    }
  }, [activeRound?.status, activeRound?.id]);

  // Preview results temporarily without storing anything (No data saved!)
  const handleTryWinning = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanNum = convertMyanmarToEnglishDigits(winningInput).replace(/\D/g, '').slice(0, 3);
    if (!cleanNum || cleanNum.length !== 3) {
      alert(isMyanmar ? 'ပေါက်ဂဏန်း ဂဏန်း ၃ လုံး (၀၀၀ မှ ၉၉၉) မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid 3-digit winning number (000-999)');
      return;
    }
    setWinningInput(cleanNum);
    setTestedWinningNumber(cleanNum);
    setIsTestingMode(true);
    setIsWinningConfirmed(false);
    setIsEnteringPassword(false);
    setConfirmError(null);
  };

  // Open password dialog for confirming official 3D winning number
  const handleOpenConfirm = () => {
    const cleanNum = convertMyanmarToEnglishDigits(winningInput).replace(/\D/g, '').slice(0, 3);
    if (!cleanNum || cleanNum.length !== 3) {
      alert(isMyanmar ? 'ပေါက်ဂဏန်း ဂဏန်း ၃ လုံး (၀၀၀ မှ ၉၉၉) မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid 3-digit winning number (000-999)');
      return;
    }
    setWinningInput(cleanNum);
    setIsEnteringPassword(true);
    setConfirmPassword('');
    setConfirmError(null);
  };

  // Stage 1: Confirm winning number with Owner Password (evaluates on-the-fly, round stays open)
  const handleSettleWithPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = convertMyanmarToEnglishDigits(winningInput).replace(/\D/g, '').slice(0, 3);
    if (!cleanNum || cleanNum.length !== 3) {
      setConfirmError(isMyanmar ? 'ပေါက်ဂဏန်း ဂဏန်း ၃ လုံး မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid 3-digit number');
      return;
    }
    
    if (!verifyOwnerPassword(confirmPassword)) {
      setConfirmError('လျှို့ဝှက်နံပါတ် (Password) မှားယွင်းနေပါသည်!');
      return;
    }

    // Set local confirmed state so results are displayed on screen for inspection
    setWinningInput(cleanNum);
    setConfirmedWinningNumber(cleanNum);
    setIsWinningConfirmed(true);
    setIsTestingMode(false);
    setTestedWinningNumber('');
    setIsEnteringPassword(false);
    setConfirmPassword('');
    setConfirmError(null);
    setSettledSuccessMsg(`ပေါက်မဲဂဏန်း [${cleanNum}] အား စစ်ဆေးအတည်ပြုပြီးပါပြီ။ အပြီးသတ်ပိတ်သိမ်းပြီး Excel စာရင်းချုပ်သိမ်းရန် အောက်ပါခလုတ်ကို နှိပ်ပါ`);

    setTimeout(() => {
      setSettledSuccessMsg(null);
    }, 6000);
  };

  // Stage 2: Settle & Close Round (Auto-downloads Excel & persists settled status in DB)
  const handleCloseRound = () => {
    const targetNum = confirmedWinningNumber || convertMyanmarToEnglishDigits(winningInput).replace(/\D/g, '').slice(0, 3);
    if (!targetNum || targetNum.length !== 3) return;
    const mult = parseInt(multiplierInput, 10) || 600;
    const toddMult = parseInt(toddMultiplierInput, 10) || 100;

    // 1. Auto-save comprehensive Excel report to device first!
    try {
      exportToExcel();
    } catch (err) {
      console.warn('Auto Excel export error:', err);
    }

    // 2. Officially settle round status to 'settled' in context & localStorage
    settleWinningNumber(targetNum, mult, toddMult);

    setIsWinningConfirmed(false);
    setConfirmedWinningNumber('');
    setIsTestingMode(false);
    setSettledSuccessMsg(`ပွဲစဉ်ချုပ်အား အပြီးသတ်ပိတ်သိမ်းပြီး စာရင်းချုပ် Excel ဖိုင်ကို စက်ထဲသို့ အော်တိုဒေါင်းလုဒ်ဆွဲပြီးပါပြီ`);

    setTimeout(() => {
      setSettledSuccessMsg(null);
    }, 8000);
  };

  const activeEvalNumber = useMemo(() => {
    if (isTestingMode) return (testedWinningNumber || winningInput).trim();
    if (isWinningConfirmed && !isSettled) return confirmedWinningNumber || winningInput.trim();
    if (isSettled) return activeRound?.winningNumber || '';
    return winningInput.trim();
  }, [isTestingMode, testedWinningNumber, isWinningConfirmed, confirmedWinningNumber, winningInput, isSettled, activeRound?.winningNumber]);

  // Evaluate winners based on winning number & multipliers
  const winningResults = useMemo(() => {
    const mult = parseInt(multiplierInput, 10) || 600;
    const toddMult = parseInt(toddMultiplierInput, 10) || 100;
    const num = activeEvalNumber.trim();

    if (!num || num.length !== 3) {
      return { winners: [], totalPayout: 0, winningBetsCount: 0, toddWinningBetsCount: 0 };
    }

    return evaluateWinnings(activeRoundVouchers, num, mult, toddMult);
  }, [activeRoundVouchers, activeEvalNumber, multiplierInput, toddMultiplierInput]);

  // Copy Winning Message for Customer
  const handleCopyWinningMessage = (winner: any) => {
    const text = `🎉 ဂုဏ်ယူပါသည်! ${winner.customerName}
📋 ဘောင်ချာအမှတ်: ${winner.voucherNo}
🎯 ပေါက်ဂဏန်း: ${winner.betNumber} (${winner.winType === 'straight' ? 'တည့်ပေါက်' : 'ပတ်လည်ပေါက်'})
💰 ထိုးကြေး: ${formatAmount(winner.betAmount, settings.currency)} (${winner.multiplier} ဆ)
🏆 ရရှိသောလျော်ကြေးငွေ: ${formatAmount(winner.wonPayout, settings.currency)}

${settings.shopName} (${settings.shopPhone})`;

    navigator.clipboard.writeText(text);
    setCopiedId(winner.voucherId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Toggle Claimed/Paid status of winner's voucher
  const handleToggleVoucherPaid = (voucherId: string, currentPaid: boolean) => {
    updateVoucher(voucherId, { isPaid: !currentPaid });
  };

  // Quick Multiplier Presets
  const multipliersList = [500, 550, 600, 650, 700, 800];

  // Permutations of current winning number for Todd
  const toddPerms = useMemo(() => {
    if (!winningInput || winningInput.length !== 3) return [];
    return getPermutations(winningInput).filter(p => p !== winningInput);
  }, [winningInput]);

  // Single-Round Financial Statement Breakdown for 3D (Strictly isolated for this round)
  const singleRoundStatement: SingleRoundFinancialBreakdown = useMemo(() => {
    const straightMult = parseInt(multiplierInput, 10) || settings.defaultMultiplier || 600;
    const toddMult = parseInt(toddMultiplierInput, 10) || settings.defaultToddMultiplier || 100;
    return calculateThreeDSingleRoundStatement({
      round: activeRound,
      vouchers: activeRoundVouchers,
      forwardSlips: activeRoundForwardSlips,
      winningNumber: activeEvalNumber,
      straightMultiplier: straightMult,
      toddMultiplier: toddMult,
      settings
    });
  }, [activeRound, activeRoundVouchers, activeRoundForwardSlips, activeEvalNumber, multiplierInput, toddMultiplierInput, settings]);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      
      {/* Top Winning Number Input & Settle Box */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isMyanmar ? 'ပေါက်ဂဏန်း ထည့်သွင်းခြင်းနှင့် လျော်ကြေးတွက်ချက်ခြင်း' : 'Winning Number & Payout Settlement'}
              </h2>
              <p className="text-xs text-slate-500">
                {isMyanmar
                  ? 'ပေါက်ဂဏန်းထည့်လိုက်သည်နှင့် လျော်ကြေး၊ အမြတ်/အရှုံးကို အလိုအလျောက် ချက်ချင်းတွက်ချက်ပေးပါမည်'
                  : 'Enter 3D winning number to instantly compute total payouts, commission, and net profit/loss'}
              </p>
            </div>
          </div>

          {isSettled && (
            <button
              onClick={() => {
                if (confirm(isMyanmar ? 'အတည်ပြုထားသော ပေါက်ဂဏန်းအား ပြန်လည်ဖျက်သိမ်းပြီး ပွဲစဉ်အား ပြန်လည်ဖွင့်လှစ်လိုပါသလား?' : 'Are you sure you want to reset this settled round?')) {
                  clearWinningSettlement();
                  setWinningInput('');
                  setIsTestingMode(false);
                  setTestedWinningNumber('');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isMyanmar ? 'ပေါက်ဂဏန်း ပြန်လည်ပြင်ဆင်မည်' : 'Reset Result'}</span>
            </button>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleTryWinning} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            
            {/* 3-Digit Winning Number */}
            <div className="sm:col-span-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider">
                  {isMyanmar ? 'ပေါက်ဂဏန်း' : 'Winning Number'}
                </label>
                {isTestingMode && (
                  <span className="text-[11px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                    စမ်းသပ်နေဆဲ (Preview)
                  </span>
                )}
              </div>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={3}
                value={winningInput}
                onChange={(e) => {
                  const val = convertMyanmarToEnglishDigits(e.target.value).replace(/[^0-9]/g, '').slice(0, 3);
                  setWinningInput(val);
                  if (isTestingMode) {
                    setTestedWinningNumber(val);
                  }
                }}
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
                placeholder="000 - 999"
                className="w-full bg-slate-50 focus:bg-white border-2 border-amber-300 focus:border-amber-500 rounded-xl px-4 py-3 text-3xl font-black text-amber-900 font-mono tracking-widest text-center outline-none shadow-2xs transition-colors"
              />
            </div>

            {/* Straight Multiplier */}
            <div className="sm:col-span-3 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {isMyanmar ? 'တည့်ပေါက် အဆ (ဆ)' : 'Straight Multiplier'}
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={multiplierInput}
                onChange={(e) => setMultiplierInput(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, ''))}
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
                placeholder="600"
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-3 text-xl font-bold text-slate-900 font-mono text-center outline-none transition-colors shadow-2xs"
              />
            </div>

            {/* Todd/Rumble Multiplier */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {isMyanmar ? 'ပတ်လည်ပေါက် (ဆ)' : 'Todd Mult.'}
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={toddMultiplierInput}
                onChange={(e) => setToddMultiplierInput(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, ''))}
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
                placeholder="100"
                className="w-full bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-3 text-xl font-bold text-slate-900 font-mono text-center outline-none transition-colors shadow-2xs"
              />
            </div>

            {/* Calculate / Settle Button */}
            <div className="sm:col-span-3 flex flex-col gap-1.5">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleTryWinning}
                  className={`flex-1 h-[50px] ${isTestingMode ? 'bg-sky-700 ring-2 ring-sky-400 shadow-md' : 'bg-sky-600 hover:bg-sky-700'} text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer`}
                  title="ပေါက်မဲဂဏန်းကို အစမ်းတွက်ချက်ကြည့်မည် (ဒေတာမသိမ်းပါ)"
                >
                  <Sparkles className="w-4 h-4 text-sky-200" />
                  <span>{isTestingMode ? 'အစမ်းစစ်နေသည် (Preview)' : 'အစမ်းထည့်မည်'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenConfirm}
                  className="flex-1 h-[50px] bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
                  title="ပေါက်မဲဂဏန်းကို လျှို့ဝှက်နံပါတ်ဖြင့် အတည်ပြုသိမ်းဆည်းမည်"
                >
                  <CheckCircle2 className="w-4 h-4 text-amber-200" />
                  <span>အတည်ပြုမည်</span>
                </button>
              </div>
            </div>

          </div>

          {/* Password Prompt Area */}
          {isEnteringPassword && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 space-y-3 animate-in fade-in slide-in-from-top-4 duration-150">
              <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                <AlertCircle className="w-4 h-4 text-amber-600 animate-bounce" />
                <span>ပေါက်မဲဂဏန်း [{winningInput}] အား အတည်ပြုသိမ်းဆည်းရန် ပိုင်ရှင် လျှို့ဝှက်နံပါတ် (Owner Password) ထည့်ပါ</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  placeholder="လျှို့ဝှက်နံပါတ် (Default: 123456)"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setConfirmError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSettleWithPassword(e);
                    }
                  }}
                  autoFocus
                  className="flex-1 bg-white border border-slate-300 focus:border-amber-500 rounded-xl px-3 py-2 outline-none font-bold text-slate-900 shadow-2xs font-mono"
                />
                <button
                  type="button"
                  onClick={handleSettleWithPassword}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow-xs active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>အတည်ပြုသိမ်းဆည်းမည်</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEnteringPassword(false);
                    setConfirmPassword('');
                    setConfirmError(null);
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  မလုပ်တော့ပါ
                </button>
              </div>
              {confirmError && (
                <p className="text-xs text-rose-600 font-bold animate-pulse flex items-center gap-1">
                  ⚠️ {confirmError}
                </p>
              )}
            </div>
          )}

          {/* Quick Multiplier presets */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 pt-1">
            <span>{isMyanmar ? 'အသုံးများသော ပေါက်ကြေးအဆများ:' : 'Standard Multipliers:'}</span>
            {multipliersList.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMultiplierInput(String(m))}
                className={`px-2.5 py-1 rounded-lg font-mono font-bold border transition-colors cursor-pointer ${
                  multiplierInput === String(m)
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-white hover:border-slate-300'
                }`}
              >
                {m}x
              </button>
            ))}
          </div>
        </form>

        {/* Success Confirmation Toast Banner */}
        {settledSuccessMsg && (
          <div className="bg-emerald-600 text-white rounded-2xl p-4 text-xs font-bold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
              <span>{settledSuccessMsg}</span>
            </div>
            <button onClick={() => setSettledSuccessMsg(null)} className="text-emerald-200 hover:text-white font-bold cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Testing Preview Banner */}
        {isTestingMode && (
          <div className="bg-sky-50 border-2 border-sky-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200 mt-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold font-sans shrink-0">
                🧪
              </div>
              <div>
                <h4 className="text-sm font-black text-sky-950">
                  ပေါက်ဂဏန်း [{activeEvalNumber}] ဖြင့် အစမ်းတွက်ချက် စစ်ဆေးနေပါသည်
                </h4>
                <p className="text-xs text-sky-800">
                  မှတ်တမ်းများကို သိမ်းဆည်းထားခြင်းမရှိပါ (ဒေတာမသိမ်းပါ)။ ဤပေါက်ဂဏန်းအား အတည်ယူရန် "အတည်ပြုမည်" ခလုတ်ကို နှိပ်ပြီး Password ပေးပါ။
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsTestingMode(false);
                  setTestedWinningNumber('');
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                စမ်းသပ်မှု ပိတ်မည်
              </button>
              <button
                type="button"
                onClick={handleOpenConfirm}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>အတည်ပြုမည် (Password ဖြင့်)</span>
              </button>
            </div>
          </div>
        )}

        {/* Settled Confirmation Banner */}
        {isSettled && !isTestingMode && (
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-200 mt-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                ✓
              </div>
              <div>
                <h4 className="text-sm font-black text-emerald-950">
                  ပေါက်မဲ [{activeRound?.winningNumber}] တရားဝင် အတည်ပြုသိမ်းဆည်းပြီးပါပြီ
                </h4>
                <p className="text-xs text-emerald-800">
                  ပေါက်သူများနှင့် လျော်ကြေးများကို တွက်ချက်သိမ်းဆည်းထားပြီး ဖြစ်ပါသည်။ စာရင်းချုပ် Excel ဖိုင်အား လိုအပ်ပါက အောက်ပါခလုတ်ဖြင့် ထပ်မံထုတ်ယူနိုင်ပါသည်။
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={exportToExcel}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel ပြန်ဒေါင်းမည်</span>
              </button>
              {onOpenStatement && (
                <button
                  type="button"
                  onClick={onOpenStatement}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>၃D ရှင်းတမ်း အပြည့်အစုံ</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Previous 3D Winning Draws Quick Strip (Strictly 3D only) */}
        {settled3DRounds.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span className="flex items-center gap-1.5 text-indigo-900">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isMyanmar ? 'အိုးစည်လေး အရင်ပွဲစဉ်များ၏ ထွက်ပေါက်ဂဏန်း မှတ်တမ်းများ:' : 'Previous Winning Numbers:'}</span>
              </span>
              <span className="text-[11px] text-slate-400">
                {settled3DRounds.length} {isMyanmar ? 'ကြိမ် ပြီးဆုံး' : 'rounds'}
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {settled3DRounds.slice(0, 6).map((r) => {
                const isActive = r.id === activeRound?.id;
                return (
                  <div
                    key={r.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs shrink-0 transition-all ${
                      isActive
                        ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-200 shadow-xs'
                        : 'bg-slate-50 hover:bg-white border-slate-200'
                    }`}
                  >
                    <div className="text-left">
                      <span className="text-[10px] text-slate-500 block font-semibold">{r.drawDate}</span>
                      <span className="text-xs font-bold text-slate-800 block truncate max-w-[120px]">{r.name}</span>
                    </div>

                    <div className="font-mono text-base font-black px-2 py-0.5 rounded-lg bg-indigo-950 text-amber-300 shadow-2xs border border-indigo-800">
                      {r.winningNumber || '---'}
                    </div>

                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRoundId(r.id);
                          if (r.winningNumber) setWinningInput(r.winningNumber);
                        }}
                        className="px-2 py-1 bg-white hover:bg-indigo-600 hover:text-white border border-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                        title="ဤပွဲစဉ်သို့ ကူးပြောင်းပြီး ပေါက်စာရင်းစစ်မည်"
                      >
                        {isMyanmar ? 'ဖွင့်စစ်မည်' : 'View'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Session Switch Success Banner */}
      {sessionSwitchMsg && (
        <div className="bg-emerald-600 text-white rounded-2xl p-4 text-xs font-bold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
            <span>{sessionSwitchMsg}</span>
          </div>
          <button onClick={() => setSessionSwitchMsg(null)} className="text-emerald-200 hover:text-white font-bold cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Real-time Settlement Summary Banner */}
      {(isTestingMode || isWinningConfirmed || isSettled) && activeEvalNumber.length === 3 && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <h3 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2 mt-4">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            {isMyanmar ? 'ဘဏ္ဍာရေး ရလဒ်များ' : 'Financial Outcomes'}
          </h3>
          
          {/* Prominent Next Round Launcher Banner */}
          {activeRound?.status === 'settled' && !isTestingMode && (
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 border border-indigo-900/60 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-black text-white">
                    {activeRound.name} စာရင်းချုပ် အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ
                  </h3>
                </div>
                <p className="text-xs text-indigo-200 leading-relaxed">
                  ပေါက်ဂဏန်း [{activeEvalNumber}]၊ ရောင်းရငွေ၊ လျော်ကြေးစာရင်းအားလုံးကို မှတ်တမ်းထဲသို့ သိမ်းဆည်းထားပြီး ဖြစ်ပါသည်။
                </p>
              </div>

              <button
                type="button"
                onClick={handleStartNext3DRound}
                className="w-full sm:w-auto px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95 shrink-0"
              >
                <span>☀️ နောက်ပွဲစဉ်အသစ်အတွက် စာရင်းစတင်မည်</span>
              </button>
            </div>
          )}

          {/* Active Round Isolated Financial Statement Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-indigo-500/30 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-black text-white">
                    {activeRound?.name || 'လက်ရှိ ၃D ပွဲစဉ်'}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                    isTestingMode 
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/40' 
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  }`}>
                    {isTestingMode ? '🧪 အစမ်းတွက်ချက် စစ်ဆေးမှု (Preview)' : '✓ အတည်ပြုပြီး ရှင်းတမ်း'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-400 text-slate-950 font-mono">
                    ပေါက်ဂဏန်း: {activeEvalNumber || '---'} (တည့် {multiplierInput || 600}x / ပတ် {toddMultiplierInput || 100}x)
                  </span>
                </div>
                <p className="text-xs text-indigo-200 mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="text-indigo-300 font-bold">📌 ဤရှင်းတမ်းသည် ဤ 3D ပွဲစဉ် ({activeRound?.drawDate || 'ဖွင့်ပွဲ'}) အတွက်သာ ဖြစ်ပြီး အခြားပွဲစဉ်များနှင့် ရောနှောခြင်းမရှိပါ။</span>
                  <span className="text-slate-400">• ဘောင်ချာ {singleRoundStatement.vouchersCount} စောင် • ပေါက်သူ {singleRoundStatement.winnersCount} ဦး</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-slate-300 font-bold block uppercase tracking-wider">ဒိုင် အသားတင် ရလဒ်</span>
                <span className={`text-base sm:text-lg font-black font-mono px-3 py-1 rounded-xl border block ${
                  singleRoundStatement.isProfit
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                    : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                }`}>
                  {singleRoundStatement.isProfit ? '+' : '-'}{formatAmount(Math.abs(singleRoundStatement.netProfit), settings.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Comprehensive 8-Step Formula Cards matching Header Financial Statement tab */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {/* 1. မူလထိုးကြေး */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-2xs hover:bg-white transition-all">
              <span className="text-[10px] font-black text-slate-500 block mb-0.5 uppercase tracking-wide">
                ၁။ မူလထိုးကြေး
              </span>
              <div className="text-sm font-black text-slate-900 font-mono">
                {formatAmount(singleRoundStatement.turnover, settings.currency)}
              </div>
              <span className="text-[9px] text-slate-400 block font-medium mt-0.5">
                ထိုးကြေး အားလုံးပေါင်း
              </span>
            </div>

            {/* 2. အထက်တင်ကြေး */}
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3 shadow-2xs hover:bg-indigo-50 transition-all">
              <span className="text-[10px] font-black text-indigo-900 block mb-0.5 uppercase tracking-wide">
                ၂။ အထက်တင်ကြေး
              </span>
              <div className="text-sm font-black text-indigo-950 font-mono">
                {formatAmount(singleRoundStatement.totalForwarded, settings.currency)}
              </div>
              <span className="text-[9px] text-indigo-600 block font-medium mt-0.5">
                ဒိုင်ကြီးဆီ လွှဲငွေ
              </span>
            </div>

            {/* 3. အောက်လက်ကော် */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 shadow-2xs hover:bg-amber-50 transition-all">
              <span className="text-[10px] font-black text-amber-900 block mb-0.5 uppercase tracking-wide">
                ၃။ အောက်လက်ကော်
              </span>
              <div className="text-sm font-black text-amber-900 font-mono">
                -{formatAmount(singleRoundStatement.agentCommission, settings.currency)}
              </div>
              <span className="text-[9px] text-amber-700 block font-medium mt-0.5">
                ကိုယ်က ပေးရမည့်ငွေ
              </span>
            </div>

            {/* 4. အမှန်ရောင်းငွေ */}
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3 shadow-2xs hover:bg-sky-50/80 transition-all">
              <span className="text-[10px] font-black text-sky-900 block mb-0.5 uppercase tracking-wide">
                ၄။ အမှန်ရောင်းငွေ
              </span>
              <div className="text-sm font-black text-sky-950 font-mono">
                {formatAmount(singleRoundStatement.netSales, settings.currency)}
              </div>
              <span className="text-[9px] text-sky-700 block font-medium mt-0.5">
                ဒိုင်လက်ကျန်ရောင်းငွေ
              </span>
            </div>

            {/* 5. အထက်ပေါက်ကြေး */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 shadow-2xs hover:bg-emerald-50/80 transition-all">
              <span className="text-[10px] font-black text-emerald-900 block mb-0.5 uppercase tracking-wide">
                ၅။ အထက်ပေါက်ကြေး
              </span>
              <div className="text-sm font-black text-emerald-900 font-mono">
                +{formatAmount(singleRoundStatement.masterPayout, settings.currency)}
              </div>
              <span className="text-[9px] text-emerald-700 block font-medium mt-0.5">
                ဒိုင်ကြီး ပြန်လျော်ငွေ
              </span>
            </div>

            {/* 6. အထက်ကော်မရှင် */}
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 shadow-2xs hover:bg-purple-50/80 transition-all">
              <span className="text-[10px] font-black text-purple-900 block mb-0.5 uppercase tracking-wide">
                ၆။ အထက်ကော်မရှင်
              </span>
              <div className="text-sm font-black text-purple-900 font-mono">
                +{formatAmount(singleRoundStatement.forwardCommission, settings.currency)}
              </div>
              <span className="text-[9px] text-purple-700 block font-medium mt-0.5">
                ကိုယ်ရမည့် ကော်မရှင်ခ
              </span>
            </div>

            {/* 7. ပေးလျှော်ငွေ */}
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 shadow-2xs hover:bg-rose-50/80 transition-all">
              <span className="text-[10px] font-black text-rose-800 block mb-0.5 uppercase tracking-wide">
                ၇။ ပေးလျှော်ငွေ
              </span>
              <div className="text-sm font-black text-rose-800 font-mono">
                -{formatAmount(singleRoundStatement.totalPayout, settings.currency)}
              </div>
              <span className="text-[9px] text-rose-600 block font-medium mt-0.5">
                အောက်လက်ပေါက်ကြေး
              </span>
            </div>

            {/* 8. ဒိုင်အသားတင် အမြတ်/အရှုံး */}
            <div className={`rounded-2xl p-3 border shadow-2xs transition-all ${
              singleRoundStatement.isProfit ? 'bg-teal-50 border-teal-300' : 'bg-rose-100 border-rose-300'
            }`}>
              <span className={`text-[10px] font-black block mb-0.5 uppercase tracking-wide ${
                singleRoundStatement.isProfit ? 'text-teal-900' : 'text-rose-900'
              }`}>
                ၈။ အသားတင် {singleRoundStatement.isProfit ? 'အမြတ်' : 'အရှုံး'}
              </span>
              <div className={`text-sm font-black font-mono ${
                singleRoundStatement.isProfit ? 'text-teal-800' : 'text-rose-800'
              }`}>
                {singleRoundStatement.isProfit ? '+' : '-'}{formatAmount(Math.abs(singleRoundStatement.netProfit), settings.currency)}
              </div>
              <span className={`text-[9px] font-black block mt-0.5 ${
                singleRoundStatement.isProfit ? 'text-teal-700' : 'text-rose-700'
              }`}>
                {singleRoundStatement.isProfit ? 'အမြတ်' : 'အရှုံး'} ({singleRoundStatement.profitMargin}%)
              </span>
            </div>
          </div>

          {/* Single-Round Financial Statement Table Row (Matching Header tab format) */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
              <span className="font-black text-xs flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  ဤ 3D ပွဲစဉ် စာရင်းရှင်းတမ်းဇယား (Header Tab ရှင်းတမ်း စံနှုန်းအတိုင်း)
                </span>
              </span>
              <span className="text-[10px] text-slate-300 font-bold">
                {activeRound?.drawDate || ''} • အိုးစည်လေး (3D)
              </span>
            </div>
            <div className="overflow-x-auto whitespace-nowrap text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">ရက်စွဲ</th>
                    <th className="py-2.5 px-3">ပွဲစဉ်</th>
                    <th className="py-2.5 px-3 text-center">ပေါက်ဂဏန်း</th>
                    <th className="py-2.5 px-3 text-right">၁။ မူလထိုးကြေး</th>
                    <th className="py-2.5 px-3 text-right text-indigo-900">၂။ အထက်တင်ကြေး</th>
                    <th className="py-2.5 px-3 text-right text-amber-800">၃။ အောက်လက်ကော်</th>
                    <th className="py-2.5 px-3 text-right text-sky-900">၄။ အမှန်ရောင်းငွေ</th>
                    <th className="py-2.5 px-3 text-right text-emerald-800">၅။ အထက်ပေါက်ကြေး</th>
                    <th className="py-2.5 px-3 text-right text-purple-800">၆။ အထက်ကော်</th>
                    <th className="py-2.5 px-3 text-right text-rose-700">၇။ ပေးလျှော်ငွေ</th>
                    <th className="py-2.5 px-3 text-right font-black">၈။ ဒိုင်အသားတင်</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                      {(activeRound?.drawDate || '').slice(0, 10)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-indigo-100 text-indigo-900 border border-indigo-200 mr-1.5">
                        အိုးစည်လေး
                      </span>
                      {activeRound?.name || '၃D ထီဖွင့်ပွဲ'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-black text-amber-950 bg-amber-50">
                      <span className="bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md text-xs">
                        {activeEvalNumber || '---'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatAmount(singleRoundStatement.turnover, settings.currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-900">
                      {singleRoundStatement.totalForwarded > 0 ? formatAmount(singleRoundStatement.totalForwarded, settings.currency) : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">
                      {singleRoundStatement.agentCommission > 0 ? `-${formatAmount(singleRoundStatement.agentCommission, settings.currency)}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-950 bg-sky-50/50">
                      {formatAmount(singleRoundStatement.netSales, settings.currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800 bg-emerald-50/40">
                      {singleRoundStatement.masterPayout > 0 ? `+${formatAmount(singleRoundStatement.masterPayout, settings.currency)}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-800 bg-purple-50/40">
                      {singleRoundStatement.forwardCommission > 0 ? `+${formatAmount(singleRoundStatement.forwardCommission, settings.currency)}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 bg-rose-50/40">
                      {singleRoundStatement.totalPayout > 0 ? `-${formatAmount(singleRoundStatement.totalPayout, settings.currency)}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black">
                      <span className={`px-2 py-0.5 rounded-md font-mono text-xs ${
                        singleRoundStatement.isProfit
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}>
                        {singleRoundStatement.isProfit ? '+' : '-'}{formatAmount(Math.abs(singleRoundStatement.netProfit), settings.currency)}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Winners List Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden space-y-3">
            
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500" />
                  <span>{isMyanmar ? 'ပေါက်သူများ စာရင်း' : 'Winning Customers List'}</span>
                  <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full text-xs font-mono border border-amber-200">
                    {winningResults.winners.length} ဦး
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isMyanmar
                    ? 'ပေါက်ဂဏန်း တည့်ပေါက်နှင့် ပတ်လည်ပေါက်သူများ'
                    : 'List of customers who hit straight or todd combinations'}
                </p>
              </div>

              <button
                onClick={exportToExcel}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-2xs transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{isMyanmar ? 'ပေါက်သူစာရင်း Excel ထုတ်မည်' : 'Export Winners Excel'}</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">{isMyanmar ? 'ဘောင်ချာအမှတ်' : 'Voucher No'}</th>
                    <th className="py-3 px-4">{isMyanmar ? 'ဝယ်သူအမည်' : 'Customer'}</th>
                    <th className="py-3 px-4">{isMyanmar ? 'ပေါက်ဂဏန်း' : 'Won Number'}</th>
                    <th className="py-3 px-4">{isMyanmar ? 'အမျိုးအစား' : 'Type'}</th>
                    <th className="py-3 px-4">{isMyanmar ? 'ထိုးကြေး' : 'Bet Amt'}</th>
                    <th className="py-3 px-4">{isMyanmar ? 'အဆ' : 'Multiplier'}</th>
                    <th className="py-3 px-4">{isMyanmar ? 'လျော်ကြေးငွေ' : 'Won Payout'}</th>
                    <th className="py-3 px-4">{isMyanmar ? 'ငွေရှင်းမှု' : 'Claim Status'}</th>
                    <th className="py-3 px-4 text-right">{isMyanmar ? 'အကြောင်းကြားစာ' : 'Notify'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {winningResults.winners.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-500 font-sans">
                        {isMyanmar
                          ? `ပေါက်ဂဏန်း [${activeEvalNumber}] ကို ထိုးထားသော ဝယ်သူမရှိပါ (ဒိုင် အမြတ်ငွေ အပြည့်ရရှိ)`
                          : `No customers bet on winning number [${activeEvalNumber}]. Full dealer retention.`}
                      </td>
                    </tr>
                  ) : (
                    winningResults.winners.map((winner, idx) => (
                      <tr key={`${winner.voucherId}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-slate-400">{idx + 1}</td>

                        {/* Voucher No */}
                        <td className="py-3 px-4 font-bold text-indigo-700">
                          {winner.voucherNo}
                        </td>

                        {/* Customer */}
                        <td className="py-3 px-4 font-sans font-medium text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{winner.customerName}</span>
                            {winner.customerPhone && (
                              <span className="text-[11px] text-slate-500 font-mono">
                                ({winner.customerPhone})
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Won Number */}
                        <td className="py-3 px-4">
                          <span className="bg-amber-100 text-amber-950 font-black px-2 py-0.5 rounded tracking-widest text-sm border border-amber-300">
                            {winner.betNumber}
                          </span>
                        </td>

                        {/* Type */}
                        <td className="py-3 px-4 font-sans">
                          {winner.winType === 'straight' ? (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                              တည့်ပေါက်
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold">
                              ပတ်လည် (R)
                            </span>
                          )}
                        </td>

                        {/* Bet Amt */}
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {formatAmount(winner.betAmount, settings.currency)}
                        </td>

                        {/* Multiplier */}
                        <td className="py-3 px-4 text-slate-500">
                          {winner.multiplier}x
                        </td>

                        {/* Payout */}
                        <td className="py-3 px-4 font-black text-rose-600 text-sm">
                          {formatAmount(winner.wonPayout, settings.currency)}
                        </td>

                        {/* Claim Status */}
                        <td className="py-3 px-4 font-sans">
                          <button
                            onClick={() => handleToggleVoucherPaid(winner.voucherId, winner.isPaid)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
                              winner.isPaid
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                            }`}
                          >
                            {winner.isPaid ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>ငွေထုတ်ပြီး</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3 h-3 text-amber-600" />
                                <span>မထုတ်ရသေး</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Copy SMS / Chat action */}
                        <td className="py-3 px-4 text-right font-sans">
                          <button
                            onClick={() => handleCopyWinningMessage(winner)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium transition-colors cursor-pointer"
                            title="ပေါက်ဂဏန်း အကြောင်းကြားစာ ကူးယူမည်"
                          >
                            {copiedId === winner.voucherId ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700 font-semibold">ကူးပြီး</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>စာသားကူးမည်</span>
                              </>
                            )}
                          </button>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
