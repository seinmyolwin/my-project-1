import React, { useState, useMemo, useEffect } from 'react';
import {
  Trophy,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  DollarSign,
  TrendingUp,
  TrendingDown,
  User,
  Phone,
  FileSpreadsheet,
  AlertCircle,
  Receipt
} from 'lucide-react';
import { useTwoDLottery } from '../../context/TwoDLotteryContext';
import { formatAmount, convertMyanmarToEnglishDigits } from '../../utils/lotteryUtils';
import { verifyOwnerPassword } from '../../utils/securityUtils';
import { evaluateTwoDWinnings } from '../../utils/twoDLotteryUtils';
import { getLocalDateString } from '../../utils/moneyUtils';
import {
  SingleRoundFinancialBreakdown,
  calculateTwoDSingleRoundStatement
} from '../../utils/statementUtils';

interface TwoDWinningPayoutViewProps {
  onOpenStatement?: () => void;
}

export const TwoDWinningPayoutView: React.FC<TwoDWinningPayoutViewProps> = ({ onOpenStatement }) => {
  const {
    settings,
    activeRound,
    activeRoundVouchers,
    activeRoundForwardSlips,
    aggregates,
    roundSummary,
    settleWinningNumber,
    clearWinningSettlement,
    exportToExcel,
    rounds,
    createRound,
    setActiveRoundId
  } = useTwoDLottery();

  const isMyanmar = settings.language === 'my';

  const getCleanMultiplier = (val?: number) => {
    let m = val || settings.defaultMultiplier || 80;
    if (m >= 500 && m <= 10000) m = Math.round(m / 100);
    return m;
  };

  const [winningInput, setWinningInput] = useState(activeRound?.winningNumber || '');
  const [multiplierInput, setMultiplierInput] = useState(() =>
    String(getCleanMultiplier(activeRound?.multiplier))
  );
  const [multiplierHintNotice, setMultiplierHintNotice] = useState<string | null>(null);

  useEffect(() => {
    setWinningInput(activeRound?.winningNumber || '');
    setMultiplierInput(String(getCleanMultiplier(activeRound?.multiplier)));
  }, [activeRound?.id, activeRound?.winningNumber, activeRound?.multiplier, settings.defaultMultiplier]);

  const [sessionSwitchMsg, setSessionSwitchMsg] = useState<string | null>(null);

  const isMorning = activeRound?.session === 'morning' || activeRound?.name.includes('မနက်');

  const handleStartNextSession = () => {
    const today = getLocalDateString();
    const targetSession = isMorning ? 'evening' : 'morning';
    const targetName = isMorning
      ? `${today} ညနေပိုင်း (၀၄:၃၀)`
      : `${today} မနက်ပိုင်း (၁၂:၀၁)`;

    const existing = rounds.find(
      r => r.session === targetSession && r.drawDate === today && r.status === 'open'
    );

    if (existing) {
      setActiveRoundId(existing.id);
      setWinningInput('');
      setSessionSwitchMsg(`[${existing.name}] သို့ ကူးပြောင်းပြီးပါပြီ။ မနက်ပိုင်းစာရင်းများကို အပြီးသတ် သိမ်းဆည်းထားပြီး ညနေပိုင်းအတွက် စာရင်းအသစ် စတင်ပါပြီ။`);
    } else {
      const newRound = createRound({
        name: targetName,
        drawDate: today,
        session: targetSession,
        closingTime: isMorning ? '16:30' : '12:01',
        status: 'open',
        multiplier: settings.defaultMultiplier,
        commissionRate: settings.defaultCommissionRate
      });
      setActiveRoundId(newRound.id);
      setWinningInput('');
      setSessionSwitchMsg(`[${newRound.name}] ပွဲစဉ်အသစ် စတင်ဖွင့်လှစ်ပြီးပါပြီ။ ယခင်စာရင်းများကို သိမ်းဆည်းပြီး ညနေပိုင်းအတွက် စာရင်းအသစ် စတင်လက်ခံနိုင်ပါပြီ။`);
    }

    setTimeout(() => {
      setSessionSwitchMsg(null);
    }, 6000);
  };

  // Settled 2D rounds history strictly for 2D
  const settled2DRounds = useMemo(() => {
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

  // Handle Try / Test Winning Number (No data saved!)
  const handleTryWinning = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanNum = convertMyanmarToEnglishDigits(winningInput).replace(/\D/g, '').slice(0, 2);
    if (!cleanNum || cleanNum.length !== 2) {
      alert(isMyanmar ? 'ပေါက်ဂဏန်း (၀၀ မှ ၉၉) ဂဏန်း ၂ လုံး မှန်ကန်စွာ ရိုက်ထည့်ပါ' : 'Enter a valid 2-digit winning number (00-99)');
      return;
    }
    setWinningInput(cleanNum);
    setTestedWinningNumber(cleanNum);
    setIsTestingMode(true);
    setIsWinningConfirmed(false);
    setIsEnteringPassword(false);
    setConfirmError(null);
  };

  // Open password dialog for confirming official winning number
  const handleOpenConfirm = () => {
    const cleanNum = convertMyanmarToEnglishDigits(winningInput).replace(/\D/g, '').slice(0, 2);
    if (!cleanNum || cleanNum.length !== 2) {
      alert(isMyanmar ? 'ပေါက်ဂဏန်း (၀၀ မှ ၉၉) ဂဏန်း ၂ လုံး မှန်ကန်စွာ ရိုက်ထည့်ပါ' : 'Enter a valid 2-digit winning number (00-99)');
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
    const cleanNum = convertMyanmarToEnglishDigits(winningInput).replace(/\D/g, '').slice(0, 2);
    if (!cleanNum || cleanNum.length !== 2) {
      setConfirmError(isMyanmar ? 'ပေါက်ဂဏန်း ဂဏန်း ၂ လုံး မှန်ကန်စွာ ရိုက်ထည့်ပါ' : 'Enter a valid 2-digit number');
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
    if (isSettled) {
      if (!window.confirm(isMyanmar ? 'ဤဖွင့်ပွဲအား အတည်ပြုပြီးဖြစ်ပါသည်။ ပေါက်မဲ ပြန်လည်ပြင်ဆင် Settle လုပ်ရန် သေချာပါသလား။' : 'Re-settle round?')) {
        return;
      }
    }

    const targetNum = confirmedWinningNumber || convertMyanmarToEnglishDigits(winningInput).replace(/\D/g, '').slice(0, 2);
    if (!targetNum || targetNum.length !== 2) {
      alert(isMyanmar ? 'ပေါက်ဂဏန်း (၀၀ မှ ၉၉) ဂဏန်း ၂ လုံး မှန်ကန်စွာ ရိုက်ထည့်ပါ' : 'Enter a valid 2-digit winning number (00-99)');
      return;
    }

    if (!multiplierInput || multiplierInput.trim() === '') {
      alert(isMyanmar ? 'ပေါက်ကြေးအဆ (Multiplier) ထည့်သွင်းပါ' : 'Please enter multiplier');
      return;
    }

    let mult = parseFloat(multiplierInput);
    if (isNaN(mult) || mult <= 0) {
      alert(isMyanmar ? 'ပေါက်ကြေးအဆ (Multiplier) မှန်ကန်စွာ ထည့်သွင်းပါ' : 'Please enter valid multiplier');
      return;
    }
    // Auto-normalize if user typed 8000 (100 Ks = 8,000 Ks)
    if (mult >= 500 && mult <= 10000) {
      mult = Math.round(mult / 100);
      setMultiplierInput(String(mult));
    }

    // 1. Officially settle round status in context & localStorage FIRST
    settleWinningNumber(targetNum, mult);

    const settledRound = {
      ...activeRound!,
      status: 'settled' as const,
      winningNumber: targetNum,
      multiplier: mult,
      settledAt: new Date().toISOString()
    };
    const evalRes = evaluateTwoDWinnings(activeRoundVouchers, targetNum, mult);
    let totalSoldForWinNum = 0;
    activeRoundVouchers.forEach(v => {
      v.items.forEach(it => {
        if (it.number === targetNum) totalSoldForWinNum += it.amount;
      });
    });
    let totalForwardedForWinNum = 0;
    activeRoundForwardSlips.forEach(f => {
      f.items.forEach(it => {
        if (it.number === targetNum) totalForwardedForWinNum += it.amount;
      });
    });
    const retainedAmount = Math.max(0, totalSoldForWinNum - totalForwardedForWinNum);
    const dealerPayout = mult > 0 ? retainedAmount * mult : 0;

    let totalSales = 0;
    let totalDiscount = 0;
    let netRevenue = 0;
    activeRoundVouchers.forEach(v => {
      totalSales += v.subtotal;
      totalDiscount += v.discountAmount;
      netRevenue += v.netPayable;
    });

    let totalForwarded = 0;
    let forwardedCommission = 0;
    activeRoundForwardSlips.forEach(f => {
      totalForwarded += f.totalAmount;
      forwardedCommission += f.commissionAmount;
    });

    const netPaid = totalForwarded - forwardedCommission;
    const netProfit = netRevenue - netPaid - dealerPayout;

    const settledSummary = {
      totalSales,
      totalVouchers: activeRoundVouchers.length,
      totalDiscount,
      netRevenue,
      totalForwarded,
      forwardedCommission,
      totalPayout: evalRes.totalPayout,
      retainedPayout: dealerPayout,
      winningNumber: targetNum,
      totalWinnersCount: evalRes.totalWinnersCount,
      netProfit,
      isProfit: netProfit >= 0
    };

    // 2. Auto-save the comprehensive 2D Excel report to device with updated settled status and winners
    try {
      exportToExcel(settledRound, evalRes.settledVouchers, settledSummary);
    } catch (err) {
      console.warn('Auto Excel export error:', err);
    }

    setIsWinningConfirmed(false);
    setConfirmedWinningNumber('');
    setIsTestingMode(false);
    setSettledSuccessMsg(`ပွဲစဉ်ချုပ်အား အပြီးသတ်ပိတ်သိမ်းပြီး စာရင်းချုပ် Excel ဖိုင်ကို စက်ထဲသို့ အော်တိုဒေါင်းလုဒ်ဆွဲပြီးပါပြီ`);

    setTimeout(() => {
      setSettledSuccessMsg(null);
    }, 8000);
  };

  // The active winning number for evaluation:
  // 1. If testing mode, use tested number
  // 2. If Stage 1 confirmed, use confirmed winning number
  // 3. If settled, use settled number
  // 4. Otherwise use current input
  const activeEvalNumber = useMemo(() => {
    if (isTestingMode) return (testedWinningNumber || winningInput).trim();
    if (isWinningConfirmed && !isSettled) return confirmedWinningNumber || winningInput.trim();
    if (isSettled) return activeRound?.winningNumber || '';
    return winningInput.trim();
  }, [isTestingMode, testedWinningNumber, isWinningConfirmed, confirmedWinningNumber, winningInput, isSettled, activeRound?.winningNumber]);

  // Dynamic winning results calculated on-the-fly for testing/unsettled preview
  const twoDWinningResults = useMemo(() => {
    const cleanNum = activeEvalNumber.padStart(2, '0');
    if (!cleanNum || cleanNum.length !== 2 || isNaN(Number(cleanNum))) {
      return { settledVouchers: [], totalPayout: 0, totalWinnersCount: 0 };
    }
    let mult = parseFloat(multiplierInput) || activeRound?.multiplier || settings.defaultMultiplier || 80;
    if (mult >= 500 && mult <= 10000) mult = Math.round(mult / 100);
    const evalRes = evaluateTwoDWinnings(activeRoundVouchers, cleanNum, mult);

    let totalSoldForNum = 0;
    activeRoundVouchers.forEach(v => {
      v.items.forEach(it => {
        if (it.number === cleanNum) totalSoldForNum += it.amount;
      });
    });
    let totalForwardedForNum = 0;
    activeRoundForwardSlips.forEach(f => {
      f.items.forEach(it => {
        if (it.number === cleanNum) totalForwardedForNum += it.amount;
      });
    });
    const retainedAmount = Math.max(0, totalSoldForNum - totalForwardedForNum);
    const dealerPayout = mult > 0 ? retainedAmount * mult : 0;

    return {
      settledVouchers: evalRes.settledVouchers,
      totalPayout: evalRes.totalPayout,
      totalWinnersCount: evalRes.totalWinnersCount
    };
  }, [activeRoundVouchers, activeRoundForwardSlips, activeEvalNumber, multiplierInput, activeRound?.multiplier, settings.defaultMultiplier]);

  const previewRoundSummary = useMemo(() => {
    let totalSales = 0;
    let totalDiscount = 0;
    let netRevenue = 0;

    activeRoundVouchers.forEach(v => {
      totalSales += v.subtotal;
      totalDiscount += v.discountAmount;
      netRevenue += v.netPayable;
    });

    let totalForwarded = 0;
    let forwardedCommission = 0;
    activeRoundForwardSlips.forEach(f => {
      totalForwarded += f.totalAmount;
      forwardedCommission += f.commissionAmount;
    });

    let totalForwardedForWinNum = 0;
    if (activeEvalNumber) {
      activeRoundForwardSlips.forEach(f => {
        f.items.forEach(it => {
          if (it.number === activeEvalNumber) totalForwardedForWinNum += it.amount;
        });
      });
    }
    const winningAgg = activeEvalNumber ? aggregates[activeEvalNumber] : undefined;
    const totalSoldForWinNum = winningAgg ? winningAgg.totalSold : 0;
    const retainedAmt = Math.max(0, totalSoldForWinNum - totalForwardedForWinNum);
    let mult = parseFloat(multiplierInput) || settings.defaultMultiplier || 80;
    if (mult >= 500 && mult <= 10000) mult = Math.round(mult / 100);
    const retainedPayout = mult > 0 ? retainedAmt * mult : 0;

    const netPaid = totalForwarded - forwardedCommission;
    const netProfit = netRevenue - netPaid - retainedPayout;

    return {
      totalSales,
      totalVouchers: activeRoundVouchers.length,
      totalDiscount,
      netRevenue,
      totalForwarded,
      forwardedCommission,
      totalPayout: twoDWinningResults.totalPayout,
      retainedPayout,
      winningNumber: activeEvalNumber,
      totalWinnersCount: twoDWinningResults.totalWinnersCount,
      netProfit,
      isProfit: netProfit >= 0
    };
  }, [activeRoundVouchers, activeRoundForwardSlips, twoDWinningResults, activeEvalNumber]);

  const currentWinningNumber = (isTestingMode || (isWinningConfirmed && !isSettled))
    ? activeEvalNumber
    : (isSettled ? (activeRound?.winningNumber || '') : activeEvalNumber);

  let currentMultiplier = isSettled && !isTestingMode
    ? (activeRound?.multiplier || settings.defaultMultiplier || 80)
    : (parseFloat(multiplierInput) || settings.defaultMultiplier || 80);
  if (currentMultiplier >= 500 && currentMultiplier <= 10000) currentMultiplier = Math.round(currentMultiplier / 100);

  const isShowingOnTheFly = isTestingMode || (isWinningConfirmed && !isSettled);

  const currentWinnersCount = isShowingOnTheFly ? previewRoundSummary.totalWinnersCount : roundSummary.totalWinnersCount;
  const currentTotalPayout = isShowingOnTheFly ? previewRoundSummary.totalPayout : roundSummary.totalPayout;
  const currentRetainedPayout = isShowingOnTheFly ? previewRoundSummary.retainedPayout : roundSummary.retainedPayout;
  const currentNetProfit = isShowingOnTheFly ? previewRoundSummary.netProfit : roundSummary.netProfit;
  const currentIsProfit = isShowingOnTheFly ? previewRoundSummary.isProfit : roundSummary.isProfit;

  // Winning items filtered from active vouchers on-the-fly or settled
  const winningTickets = useMemo(() => {
    if (isShowingOnTheFly) {
      return twoDWinningResults.settledVouchers.filter(v => v.items.some(item => item.isWon));
    }
    return activeRoundVouchers.filter(v => v.items.some(item => item.isWon));
  }, [isShowingOnTheFly, activeRoundVouchers, twoDWinningResults]);

  const maxStake = useMemo(() => {
    let max = 0;
    winningTickets.forEach(voucher => {
      const winItems = voucher.items.filter(i => i.isWon || i.number === currentWinningNumber);
      const totalStake = winItems.reduce((sum, i) => sum + i.amount, 0);
      if (totalStake > max) max = totalStake;
    });
    return max;
  }, [winningTickets, currentWinningNumber]);

  // Single-Round Financial Statement Breakdown (Strictly isolated for this round)
  const singleRoundStatement: SingleRoundFinancialBreakdown = useMemo(() => {
    return calculateTwoDSingleRoundStatement({
      round: activeRound,
      vouchers: activeRoundVouchers,
      forwardSlips: activeRoundForwardSlips,
      winningNumber: currentWinningNumber,
      multiplier: currentMultiplier,
      settings
    });
  }, [activeRound, activeRoundVouchers, activeRoundForwardSlips, currentWinningNumber, currentMultiplier, settings]);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Settle Form Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {isMyanmar ? 'ဇီးကွက် ပေါက်ဂဏန်း ထည့်သွင်းခြင်းနှင့် လျော်ကြေးရှင်းတမ်း' : 'Winning Result & Payout Settlement'}
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {activeRound?.name} ({activeRound?.session === 'morning' ? 'မနက် ၁၂:၀၁' : 'ညနေ ၀၄:၃၀'})
              </span>
            </div>
          </div>

          {isSettled && (
            <button
              type="button"
              onClick={() => {
                if (confirm(isMyanmar ? 'အတည်ပြုထားသော ပေါက်ဂဏန်းအား ပြန်လည်ဖျက်သိမ်းပြီး ပွဲစဉ်အား ပြန်လည်ဖွင့်လှစ်လိုပါသလား?' : 'Are you sure you want to reset this settled round?')) {
                  clearWinningSettlement();
                  setWinningInput('');
                  setIsTestingMode(false);
                  setTestedWinningNumber('');
                }
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isMyanmar ? 'ပေါက်ဂဏန်း ပြန်လည်ပြင်ဆင်မည်' : 'Reset Result'}</span>
            </button>
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleTryWinning} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <div className="sm:col-span-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {isMyanmar ? 'ပေါက်ဂဏန်း (၀၀ မှ ၉၉)' : 'Winning Number (00-99)'}
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
              maxLength={2}
              placeholder="82"
              value={winningInput}
              onChange={(e) => {
                const val = convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 2);
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
              className="w-full h-14 px-4 text-center font-mono text-3xl font-black rounded-2xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 bg-slate-50 focus:bg-white transition-all text-amber-950"
            />
          </div>

          <div className="sm:col-span-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {isMyanmar ? 'ပေါက်ကြေးအဆ (ဥပမာ- ၈၀ ဆ)' : 'Multiplier (e.g. 80x)'}
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                (၁၀၀ ဖိုး = ၈,၀၀၀ ကျပ်)
              </span>
            </div>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={multiplierInput}
              onChange={(e) => {
                const clean = convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, '');
                const num = parseInt(clean, 10);
                // If user types 8000 or >= 500, auto-correct to 80
                if (!isNaN(num) && num >= 500 && num <= 10000) {
                  const fixed = Math.round(num / 100);
                  setMultiplierInput(String(fixed));
                  setMultiplierHintNotice(`${clean} အစား ၂ လုံးပေါက်ကြေး စံနှုန်းအရ ${fixed} ဆ သို့ ပြင်ဆင်သတ်မှတ်ပေးလိုက်ပါသည် (၁၀၀ ဖိုး = ${clean} ကျပ်)`);
                } else {
                  setMultiplierInput(clean);
                  setMultiplierHintNotice(null);
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
              className="w-full h-14 px-4 text-right font-mono text-xl font-bold rounded-2xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 bg-slate-50 focus:bg-white transition-all"
            />
            {/* Quick Multiplier Preset Buttons */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] text-slate-500 font-bold shrink-0">ရွေးချယ်ရန်:</span>
              {[80, 85, 90].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setMultiplierInput(String(preset));
                    setMultiplierHintNotice(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                    multiplierInput === String(preset)
                      ? 'bg-amber-600 text-white shadow-2xs ring-1 ring-amber-500'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  {preset} ဆ
                </button>
              ))}
            </div>
            {multiplierHintNotice && (
              <p className="text-[11px] font-bold text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-200 mt-2 animate-in fade-in">
                💡 {multiplierHintNotice}
              </p>
            )}
          </div>

          <div className="sm:col-span-4 flex flex-col gap-1.5">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTryWinning}
                className={`flex-1 h-14 ${isTestingMode ? 'bg-sky-700 ring-2 ring-sky-400 shadow-md' : 'bg-sky-600 hover:bg-sky-700'} text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer`}
                title="ပေါက်မဲဂဏန်းကို အစမ်းတွက်ချက်ကြည့်မည် (ဒေတာမသိမ်းပါ)"
              >
                <Sparkles className="w-4 h-4 text-sky-200" />
                <span>{isTestingMode ? 'အစမ်းစစ်နေသည် (Preview)' : 'အစမ်းထည့်မည်'}</span>
              </button>
              <button
                type="button"
                onClick={handleOpenConfirm}
                className="flex-1 h-14 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
                title="ပေါက်မဲဂဏန်းကို လျှို့ဝှက်နံပါတ်ဖြင့် အတည်ပြုသိမ်းဆည်းမည်"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-200" />
                <span>အတည်ပြုမည်</span>
              </button>
            </div>
          </div>
        </form>

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
                  ပေါက်ဂဏန်း [{currentWinningNumber}] ဖြင့် အစမ်းတွက်ချက် စစ်ဆေးနေပါသည်
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

        {/* Stage 1 Confirmed Banner (Awaiting Final Close & Excel Auto-Download) */}
        {isWinningConfirmed && !isSettled && (
          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-200 mt-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                ✓
              </div>
              <div>
                <h4 className="text-sm font-black text-emerald-950">
                  ပေါက်မဲဂဏန်း [{confirmedWinningNumber}] အား စစ်ဆေးအတည်ပြုပြီးပါပြီ
                </h4>
                <p className="text-xs text-emerald-800">
                  ပွဲစဉ်ချုပ်အား အပြီးသတ်ပိတ်သိမ်းပြီး စာရင်းဇယားဖိုင်ကို စက်ထဲသို့ အော်တိုဒေါင်းလုဒ်ဆွဲရန် အောက်ပါခလုတ်ကို နှိပ်ပါ။
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCloseRound}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer shrink-0 animate-bounce"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>ပွဲစဉ်ပိတ်သိမ်းမည် & စာရင်းသိမ်းမည် (အော်တိုဒေါင်းလုဒ်)</span>
            </button>
          </div>
        )}

        {/* Stage 2 Settled Confirmation Banner */}
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
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>၂D ရှင်းတမ်း အပြည့်အစုံ</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Previous 2D Winning Draws Quick Strip (Strictly 2D only) */}
        {settled2DRounds.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span className="flex items-center gap-1.5 text-teal-900">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isMyanmar ? 'ဇီးကွက် အရင်ပွဲစဉ်များ၏ ထွက်ပေါက်ဂဏန်း မှတ်တမ်းများ:' : 'Previous Winning Numbers:'}</span>
              </span>
              <span className="text-[11px] text-slate-400">
                {settled2DRounds.length} {isMyanmar ? 'ကြိမ် ပြီးဆုံး' : 'rounds'}
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {settled2DRounds.slice(0, 6).map((r) => {
                const isActive = r.id === activeRound?.id;
                const isMorning = r.session === 'morning' || r.name.includes('မနက်');
                const brake = r.winningNumber ? (parseInt(r.winningNumber[0], 10) + parseInt(r.winningNumber[1], 10)) % 10 : null;

                return (
                  <div
                    key={r.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs shrink-0 transition-all ${
                      isActive
                        ? 'bg-teal-50 border-teal-300 ring-2 ring-teal-200 shadow-xs'
                        : 'bg-slate-50 hover:bg-white border-slate-200'
                    }`}
                  >
                    <div className="text-left">
                      <span className="text-[10px] text-slate-500 block font-semibold flex items-center gap-1">
                        {isMorning ? 'မနက်' : 'ညနေ'} • {r.drawDate}
                      </span>
                      <span className="text-xs font-bold text-slate-800 block truncate max-w-[120px]">{r.name}</span>
                    </div>

                    <div className="font-mono text-base font-black px-2 py-0.5 rounded-lg bg-amber-400 text-amber-950 shadow-2xs border border-amber-300">
                      {r.winningNumber || '--'}
                    </div>

                    {brake !== null && (
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded">
                        {brake}B
                      </span>
                    )}

                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRoundId(r.id);
                          if (r.winningNumber) setWinningInput(r.winningNumber);
                        }}
                        className="px-2 py-1 bg-white hover:bg-teal-600 hover:text-white border border-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
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

      {/* Settlement Result Cards */}
      {(isTestingMode || isWinningConfirmed || isSettled) && currentWinningNumber && (
        <div className="space-y-6">
          {/* Prominent Next Session Launcher Banner */}
          {isSettled && !isTestingMode && (
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 border border-indigo-900/60 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-black text-white">
                    {isMorning
                      ? 'မနက်ပိုင်း စာရင်းချုပ် အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ'
                      : 'ညနေပိုင်း စာရင်းချုပ် အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ'}
                  </h3>
                </div>
                <p className="text-xs text-indigo-200 leading-relaxed">
                  ပေါက်ဂဏန်း [{currentWinningNumber}]၊ ရောင်းရငွေ၊ လျော်ကြေးစာရင်းအားလုံးကို မှတ်တမ်းထဲသို့ သိမ်းဆည်းထားပြီး ဖြစ်ပါသည်။
                </p>
              </div>

              <button
                type="button"
                onClick={handleStartNextSession}
                className="w-full sm:w-auto px-6 py-3.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95 shrink-0"
              >
                <span>
                  {isMorning
                    ? '🌆 ညနေပိုင်း (၀၄:၃၀) အတွက် အသစ်စတင်မည်'
                    : '☀️ မနက်ဖြန် မနက်ပိုင်း (၁၂:၀၁) အတွက် အသစ်စတင်မည်'}
                </span>
              </button>
            </div>
          )}

          {/* Active Round Isolated Financial Statement Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-indigo-500/30 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shrink-0">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-black text-white">
                    {activeRound?.name || 'လက်ရှိ ၂D ပွဲစဉ်'}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                    isTestingMode 
                      ? 'bg-sky-500/20 text-sky-300 border-sky-400/40' 
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40'
                  }`}>
                    {isTestingMode ? '🧪 အစမ်းတွက်ချက် စစ်ဆေးမှု (Preview)' : '✓ အတည်ပြုပြီး ရှင်းတမ်း'}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-400 text-slate-950 font-mono">
                    ပေါက်ဂဏန်း: {currentWinningNumber || '--'} ({currentMultiplier}x)
                  </span>
                </div>
                <p className="text-xs text-indigo-200 mt-1 flex items-center gap-1.5 flex-wrap">
                  <span className="text-teal-300 font-bold">📌 ဤရှင်းတမ်းသည် ဤပွဲစဉ် ({activeRound?.session === 'morning' ? 'မနက် ၁၂:၀၁' : 'ညနေ ၀၄:၃၀'}) အတွက်သာ ဖြစ်ပြီး အခြားပွဲစဉ်များနှင့် ရောနှောခြင်းမရှိပါ။</span>
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
                <Receipt className="w-3.5 h-3.5 text-teal-400" />
                <span>
                  ဤပွဲစဉ် စာရင်းရှင်းတမ်းဇယား (Header Tab ရှင်းတမ်း စံနှုန်းအတိုင်း)
                </span>
              </span>
              <span className="text-[10px] text-slate-300 font-bold">
                {activeRound?.drawDate || getLocalDateString()} • {activeRound?.session === 'morning' ? 'မနက် ၁၂:၀၁' : 'ညနေ ၀၄:၃၀'}
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
                      {activeRound?.drawDate || getLocalDateString()}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      <span className="px-1.5 py-0.5 text-[10px] font-black rounded bg-teal-100 text-teal-900 border border-teal-200 mr-1.5">
                        ဇီးကွက်
                      </span>
                      {activeRound?.name || '၂D ပွဲစဉ်'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-black text-amber-950 bg-amber-50">
                      <span className="bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md text-xs">
                        {currentWinningNumber || '--'}
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

          {/* Winning Tickets Table */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>{isMyanmar ? 'ပေါက်မဲရရှိသော ဘောင်ချာများ စာရင်း' : 'Winning Tickets List'}</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                  {winningTickets.length}
                </span>
              </h3>

              <button
                type="button"
                onClick={exportToExcel}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{isMyanmar ? 'Excel စာရင်းထုတ်' : 'Export Excel'}</span>
              </button>
            </div>

            {winningTickets.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Trophy className="w-10 h-10 mx-auto stroke-1 text-slate-300" />
                <p className="text-sm font-medium">
                  {isMyanmar
                    ? `ပေါက်ဂဏန်း [${currentWinningNumber}] ကို ထိုးထားသူ မရှိပါ (ဒိုင်အပြည့်အဝ မြတ်ပါသည်)`
                    : 'No winning bets on this number.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">ဘောင်ချာအမှတ်</th>
                      <th className="p-3">ထိုးသူအမည်</th>
                      <th className="p-3">ဖုန်းနံပါတ်</th>
                      <th className="p-3 text-center">ပေါက်ဂဏန်း</th>
                      <th className="p-3 text-right">ထိုးကြေး</th>
                      <th className="p-3 text-right">အလျော်ငွေ (@{currentMultiplier}x)</th>
                      <th className="p-3 text-center">အခြေအနေ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {winningTickets.map(voucher => {
                      const winItems = voucher.items.filter(i => i.isWon || i.number === currentWinningNumber);
                      const totalWon = winItems.reduce((sum, i) => sum + (i.wonAmount || (i.amount * currentMultiplier)), 0);
                      const totalStake = winItems.reduce((sum, i) => sum + i.amount, 0);

                      return (
                        <tr key={voucher.id} className="hover:bg-amber-50/40 transition-colors">
                          <td className="p-3 font-bold text-slate-900 flex items-center gap-1">
                            {totalStake === maxStake && maxStake > 0 && <span className="text-amber-500 text-lg leading-none">★</span>}
                            {voucher.voucherNo}
                          </td>
                          <td className="p-3 font-sans text-slate-800 font-bold">{voucher.customerName}</td>
                          <td className="p-3 text-slate-500">{voucher.customerPhone || '-'}</td>
                          <td className="p-3 text-center">
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-black rounded-lg text-sm">
                              {currentWinningNumber}
                            </span>
                          </td>
                          <td className="p-3 text-right font-bold text-slate-800">
                            {formatAmount(totalStake, settings.currency)}
                          </td>
                          <td className="p-3 text-right font-black text-rose-700 text-sm">
                            {formatAmount(totalWon, settings.currency)}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-sans font-bold text-[11px] rounded-md">
                              {isMyanmar ? 'ရှင်းပေးရန်' : 'Payable'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
