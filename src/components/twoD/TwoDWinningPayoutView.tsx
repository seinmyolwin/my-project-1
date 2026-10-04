import React, { useState, useMemo } from 'react';
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
  Globe,
  Loader2
} from 'lucide-react';
import { useTwoDLottery } from '../../context/TwoDLotteryContext';
import { formatAmount, convertMyanmarToEnglishDigits } from '../../utils/lotteryUtils';
import { fetchLiveThai2D } from '../../utils/thaiLotteryApi';

export const TwoDWinningPayoutView: React.FC = () => {
  const {
    settings,
    activeRound,
    activeRoundVouchers,
    roundSummary,
    settleWinningNumber,
    clearWinningSettlement,
    exportToExcel,
    rounds,
    setActiveRoundId
  } = useTwoDLottery();

  const isMyanmar = settings.language === 'my';

  const [winningInput, setWinningInput] = useState(activeRound?.winningNumber || '');
  const [multiplierInput, setMultiplierInput] = useState(
    String(activeRound?.multiplier || settings.defaultMultiplier || 85)
  );

  const [isFetchingLive, setIsFetchingLive] = useState(false);
  const [liveStatusMsg, setLiveStatusMsg] = useState<string | null>(null);

  const handleFetchLiveThai2D = async () => {
    setIsFetchingLive(true);
    setLiveStatusMsg('ထိုင်း SET တရားဝင် ဝက်ဘ်ဆိုက်မှ 2D ရလဒ် ရယူနေပါသည်...');
    try {
      const sess = activeRound?.session === 'morning' ? 'morning' : 'evening';
      const res = await fetchLiveThai2D(sess);
      if (res.success && res.result) {
        setWinningInput(res.result.twod);
        setLiveStatusMsg(res.message);
      } else {
        setLiveStatusMsg('ထိုင်း 2D ရလဒ် ရယူရာတွင် အဆင်မပြေပါ၊ စိတ်ကြိုက် ရိုက်ထည့်နိုင်ပါသည်');
      }
    } catch {
      setLiveStatusMsg('အင်တာနက် ချိတ်ဆက်မှု စစ်ဆေးပြီး စိတ်ကြိုက် ရိုက်ထည့်နိုင်ပါသည်');
    } finally {
      setIsFetchingLive(false);
    }
  };

  // Settled 2D rounds history strictly for 2D
  const settled2DRounds = useMemo(() => {
    return rounds
      .filter(r => r.status === 'settled' || !!r.winningNumber)
      .sort((a, b) => new Date(b.drawDate).getTime() - new Date(a.drawDate).getTime());
  }, [rounds]);

  const isSettled = activeRound?.status === 'settled' && !!activeRound?.winningNumber;

  const handleSettle = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = winningInput.trim();
    if (!cleanNum || cleanNum.length !== 2 || isNaN(Number(cleanNum))) {
      alert(isMyanmar ? '၂ လုံး ပေါက်ဂဏန်း (၀၀ မှ ၉၉) မှန်ကန်စွာ ထည့်ပါ' : 'Enter a valid 2-digit winning number');
      return;
    }

    const mult = parseFloat(multiplierInput) || 85;
    settleWinningNumber(cleanNum, mult);
  };

  // Winning items filtered from active vouchers
  const winningTickets = activeRoundVouchers.filter(v =>
    v.items.some(item => item.isWon)
  );

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
                {isMyanmar ? '၂ လုံး ပေါက်ဂဏန်း ထည့်သွင်းခြင်းနှင့် လျော်ကြေးရှင်းတမ်း' : '2D Winning Result & Payout Settlement'}
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {activeRound?.name} ({activeRound?.session === 'morning' ? 'မနက် ၁၂:၀၁' : 'ညနေ ၀၄:၃၀'})
              </span>
            </div>
          </div>

          {isSettled && (
            <button
              type="button"
              onClick={clearWinningSettlement}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isMyanmar ? 'ပေါက်ဂဏန်း ပြန်ဖျက်မည်' : 'Reset Result'}</span>
            </button>
          )}
        </div>

        {/* Live Status Banner */}
        {liveStatusMsg && (
          <div className="bg-teal-50 border border-teal-200 text-teal-900 rounded-2xl p-3.5 text-xs font-bold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-teal-600 animate-pulse shrink-0" />
              <span>{liveStatusMsg}</span>
            </div>
            <button onClick={() => setLiveStatusMsg(null)} className="text-slate-400 hover:text-slate-700 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSettle} className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <div className="sm:col-span-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                {isMyanmar ? 'ပေါက်ဂဏန်း (၂ လုံး - ၀၀ မှ ၉၉)' : 'Winning Number (2-Digit)'}
              </label>
              <button
                type="button"
                onClick={handleFetchLiveThai2D}
                disabled={isFetchingLive}
                className="text-[11px] font-bold text-teal-800 hover:text-teal-950 flex items-center gap-1 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                title="ထိုင်း SET တရားဝင် ဝက်ဘ်ဆိုက်မှ ရလဒ် ရယူရန်"
              >
                {isFetchingLive ? (
                  <Loader2 className="w-3 h-3 animate-spin text-teal-600" />
                ) : (
                  <Globe className="w-3 h-3 text-teal-600" />
                )}
                <span>{isMyanmar ? 'ထိုင်း SET တရားဝင် ရယူမည်' : 'Fetch Thai SET'}</span>
              </button>
            </div>
            <input
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="82"
              value={winningInput}
              onChange={(e) => setWinningInput(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 2))}
              onFocus={(e) => e.target.select()}
              className="w-full h-14 px-4 text-center font-mono text-3xl font-black rounded-2xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 bg-slate-50 focus:bg-white transition-all text-amber-950"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {isMyanmar ? 'အလျော်ဆ (ဥပမာ- 85 ဆ)' : 'Multiplier (e.g. 85x)'}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={multiplierInput}
              onChange={(e) => setMultiplierInput(convertMyanmarToEnglishDigits(e.target.value).replace(/\D/g, ''))}
              onFocus={(e) => e.target.select()}
              className="w-full h-14 px-4 text-right font-mono text-xl font-bold rounded-2xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 bg-slate-50 focus:bg-white transition-all"
            />
          </div>

          <div className="sm:col-span-4">
            <button
              type="submit"
              className="w-full h-14 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black text-base rounded-2xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
              <span>{isMyanmar ? 'ပေါက်မဲ စစ်ဆေးအတည်ပြုမည်' : 'Calculate Winnings'}</span>
            </button>
          </div>
        </form>

        {/* Previous 2D Winning Draws Quick Strip (Strictly 2D only) */}
        {settled2DRounds.length > 0 && (
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span className="flex items-center gap-1.5 text-teal-900">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>{isMyanmar ? '၂ လုံး အရင်ပွဲစဉ်များ၏ ထွက်ပေါက်ဂဏန်း မှတ်တမ်းများ:' : 'Previous 2D Winning Numbers:'}</span>
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
      {isSettled && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-bold block mb-1">
                {isMyanmar ? 'ပေါက်ဂဏန်း' : 'Winning Number'}
              </span>
              <div className="text-4xl font-black text-amber-600 font-mono">
                {activeRound.winningNumber}
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {isMyanmar ? 'အလျော်ဆ' : 'Multiplier'}: {activeRound.multiplier || 85}x
              </span>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 font-bold block mb-1">
                {isMyanmar ? 'ပေါက်သူ အရေအတွက်' : 'Total Winners'}
              </span>
              <div className="text-3xl font-black text-slate-900 font-mono">
                {roundSummary.totalWinnersCount} {isMyanmar ? 'ဦး' : 'tickets'}
              </div>
              <span className="text-xs text-emerald-600 font-bold">
                {isMyanmar ? 'ပေါက်မဲဘောင်ချာများ' : 'Winning vouchers'}
              </span>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs">
              <span className="text-xs text-rose-700 font-bold block mb-1">
                {isMyanmar ? 'စုစုပေါင်း လျော်ကြေးငွေ' : 'Total Payout'}
              </span>
              <div className="text-2xl sm:text-3xl font-black text-rose-700 font-mono">
                {formatAmount(roundSummary.totalPayout, settings.currency)}
              </div>
              <span className="text-xs text-rose-600 font-medium">
                {isMyanmar ? 'ဖောက်သည်များသို့ ပေးလျော်ရမည်' : 'Must pay out'}
              </span>
            </div>

            <div
              className={`rounded-3xl p-5 border shadow-2xs ${
                roundSummary.isProfit
                  ? 'bg-emerald-50/80 border-emerald-300'
                  : 'bg-rose-50/80 border-rose-300'
              }`}
            >
              <span
                className={`text-xs font-bold block mb-1 ${
                  roundSummary.isProfit ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {isMyanmar ? 'ဒိုင် အသားတင် အမြတ် / အရှုံး' : 'Dealer Net Profit/Loss'}
              </span>
              <div
                className={`text-2xl sm:text-3xl font-black font-mono flex items-center gap-1.5 ${
                  roundSummary.isProfit ? 'text-emerald-800' : 'text-rose-800'
                }`}
              >
                {roundSummary.isProfit ? (
                  <TrendingUp className="w-6 h-6 shrink-0 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-6 h-6 shrink-0 text-rose-600" />
                )}
                <span>{formatAmount(Math.abs(roundSummary.netProfit), settings.currency)}</span>
              </div>
              <span
                className={`text-xs font-black ${
                  roundSummary.isProfit ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {roundSummary.isProfit
                  ? (isMyanmar ? 'အသားတင် အမြတ်ငွေ ရရှိပါသည်' : 'Net Profit')
                  : (isMyanmar ? 'အရှုံးပေါ်နေပါသည်' : 'Net Loss')}
              </span>
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
                    ? `ပေါက်ဂဏန်း [${activeRound.winningNumber}] ကို ထိုးထားသူ မရှိပါ (ဒိုင်အပြည့်အဝ မြတ်ပါသည်)`
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
                      <th className="p-3 text-right">အလျော်ငွေ (@{activeRound.multiplier || 85}x)</th>
                      <th className="p-3 text-center">အခြေအနေ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {winningTickets.map(voucher => {
                      const winItems = voucher.items.filter(i => i.isWon);
                      const totalWon = winItems.reduce((sum, i) => sum + (i.wonAmount || 0), 0);
                      const totalStake = winItems.reduce((sum, i) => sum + i.amount, 0);

                      return (
                        <tr key={voucher.id} className="hover:bg-amber-50/40 transition-colors">
                          <td className="p-3 font-bold text-slate-900">{voucher.voucherNo}</td>
                          <td className="p-3 font-sans text-slate-800 font-bold">{voucher.customerName}</td>
                          <td className="p-3 text-slate-500">{voucher.customerPhone || '-'}</td>
                          <td className="p-3 text-center">
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-black rounded-lg text-sm">
                              {activeRound.winningNumber}
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
