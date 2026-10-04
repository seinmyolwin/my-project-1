import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Layers,
  ChevronRight,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { formatAmount } from '../utils/lotteryUtils';

interface FinancialStatementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'all' | '3d' | '2d' | 'football';
}

interface StatementRecord {
  id: string;
  date: string;
  mode: '3d' | '2d' | 'football';
  modeLabel: string;
  name: string;
  session?: 'morning' | 'evening';
  winningResult: string;
  turnover: number;
  payout: number;
  commission: number;
  netProfit: number;
  isProfit: boolean;
  winnersCount: number;
  vouchersCount: number;
  status: 'settled' | 'open';
}

export const FinancialStatementsModal: React.FC<FinancialStatementsModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'all'
}) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  const [selectedMode, setSelectedMode] = useState<'all' | '3d' | '2d' | 'football'>(initialMode);
  const [periodPreset, setPeriodPreset] = useState<'today' | 'week' | 'month' | 'custom'>('week');

  // Custom date range state
  const todayStr = new Date().toISOString().slice(0, 10);
  const oneWeekAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const oneMonthAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [customStartDate, setCustomStartDate] = useState(oneWeekAgoStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  const currency = lottery3D.settings.currency || 'Ks';

  if (!isOpen) return null;

  // Determine active date boundaries
  const { startDate, endDate } = useMemo(() => {
    if (periodPreset === 'today') {
      return { startDate: todayStr, endDate: todayStr };
    }
    if (periodPreset === 'week') {
      return { startDate: oneWeekAgoStr, endDate: todayStr };
    }
    if (periodPreset === 'month') {
      return { startDate: oneMonthAgoStr, endDate: todayStr };
    }
    return { startDate: customStartDate, endDate: customEndDate };
  }, [periodPreset, todayStr, oneWeekAgoStr, oneMonthAgoStr, customStartDate, customEndDate]);

  // Aggregate statement records from 3D, 2D, and Football
  const statementRecords: StatementRecord[] = useMemo(() => {
    const list: StatementRecord[] = [];

    // 1. Process 3D Rounds
    if (selectedMode === 'all' || selectedMode === '3d') {
      lottery3D.rounds.forEach((round) => {
        if (round.drawDate >= startDate && round.drawDate <= endDate) {
          const roundVouchers = lottery3D.vouchers.filter(
            (v) => v.roundId === round.id && v.status !== 'cancelled'
          );

          let turnover = 0;
          let payout = 0;
          let commission = 0;
          let winnersCount = 0;

          roundVouchers.forEach((v) => {
            turnover += v.netPayable;
            commission += v.totalCommission || 0;
            v.items.forEach((it) => {
              if (it.isWon) {
                payout += it.winningAmount || 0;
                winnersCount += 1;
              }
            });
          });

          const netProfit = turnover - payout + commission;

          list.push({
            id: `3d-${round.id}`,
            date: round.drawDate,
            mode: '3d',
            modeLabel: 'အိုးစည်လေး (3D)',
            name: round.name,
            winningResult: round.winningNumber || (round.status === 'settled' ? 'မပေါက်' : 'မထွက်သေး'),
            turnover,
            payout,
            commission,
            netProfit,
            isProfit: netProfit >= 0,
            winnersCount,
            vouchersCount: roundVouchers.length,
            status: round.status
          });
        }
      });
    }

    // 2. Process 2D Rounds
    if (selectedMode === 'all' || selectedMode === '2d') {
      lottery2D.rounds.forEach((round) => {
        if (round.drawDate >= startDate && round.drawDate <= endDate) {
          const roundVouchers = lottery2D.vouchers.filter(
            (v) => v.roundId === round.id && v.status !== 'cancelled'
          );

          let turnover = 0;
          let payout = 0;
          let commission = 0;
          let winnersCount = 0;

          roundVouchers.forEach((v) => {
            turnover += v.netPayable;
            commission += v.totalCommission || 0;
            v.items.forEach((it) => {
              if (it.isWon) {
                payout += it.winningAmount || 0;
                winnersCount += 1;
              }
            });
          });

          const netProfit = turnover - payout + commission;

          list.push({
            id: `2d-${round.id}`,
            date: round.drawDate,
            mode: '2d',
            modeLabel: 'ဇီးကွက် (2D)',
            name: round.name,
            session: round.session,
            winningResult: round.winningNumber || (round.status === 'settled' ? 'မပေါက်' : 'မထွက်သေး'),
            turnover,
            payout,
            commission,
            netProfit,
            isProfit: netProfit >= 0,
            winnersCount,
            vouchersCount: roundVouchers.length,
            status: round.status
          });
        }
      });
    }

    // 3. Process Football
    if (selectedMode === 'all' || selectedMode === 'football') {
      const slips = football.slips.filter((s) => {
        const slipDate = s.createdAt.slice(0, 10);
        return slipDate >= startDate && slipDate <= endDate && s.status !== 'cancelled';
      });

      if (slips.length > 0) {
        let turnover = 0;
        let payout = 0;
        let commission = 0;
        let winnersCount = 0;

        slips.forEach((s) => {
          turnover += s.netPayable;
          commission += s.commissionAmount || 0;
          if (s.status === 'won') {
            payout += s.payoutAmount || 0;
            winnersCount += 1;
          }
        });

        const netProfit = turnover - payout + commission;

        list.push({
          id: `football-${startDate}-${endDate}`,
          date: endDate,
          mode: 'football',
          modeLabel: 'ပစ်တိုင်းထောင် (အားကစား)',
          name: 'ဘောလုံး မောင်း/ဘော်ဒီ စာရင်းရှင်းတမ်း',
          winningResult: `${winnersCount} စလစ် ပေါက်`,
          turnover,
          payout,
          commission,
          netProfit,
          isProfit: netProfit >= 0,
          winnersCount,
          vouchersCount: slips.length,
          status: 'settled'
        });
      }
    }

    // Sort by Date Descending
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [selectedMode, startDate, endDate, lottery3D.rounds, lottery3D.vouchers, lottery2D.rounds, lottery2D.vouchers, football.slips]);

  // Totals calculations
  const grandTotals = useMemo(() => {
    let totalTurnover = 0;
    let totalPayout = 0;
    let totalCommission = 0;
    let totalVouchers = 0;
    let totalWinners = 0;

    statementRecords.forEach((r) => {
      totalTurnover += r.turnover;
      totalPayout += r.payout;
      totalCommission += r.commission;
      totalVouchers += r.vouchersCount;
      totalWinners += r.winnersCount;
    });

    const netProfit = totalTurnover - totalPayout + totalCommission;
    const profitMargin = totalTurnover > 0 ? ((netProfit / totalTurnover) * 100).toFixed(1) : '0';

    return {
      totalTurnover,
      totalPayout,
      totalCommission,
      netProfit,
      isProfit: netProfit >= 0,
      profitMargin,
      totalVouchers,
      totalWinners,
      recordsCount: statementRecords.length
    };
  }, [statementRecords]);

  // Export to Excel handler
  const handleExportExcel = () => {
    const data = statementRecords.map((r, i) => ({
      'စဉ်': i + 1,
      'ရက်စွဲ': r.date,
      'လုပ်ငန်းလိုင်း': r.modeLabel,
      'ပွဲစဉ်အမည်': r.name,
      'ပေါက်ဂဏန်း/ရလဒ်': r.winningResult,
      'ထိုးကြေး/ရောင်းရငွေ (ကျပ်)': r.turnover,
      'ပေးလျော်ငွေ (ကျပ်)': r.payout,
      'ကော်မရှင် (ကျပ်)': r.commission,
      'အသားတင် အမြတ်/အရှုံး (ကျပ်)': r.netProfit,
      'ပေါက်သူဦးရေ': r.winnersCount,
      'ဘောင်ချာစောင်ရေ': r.vouchersCount,
      'အခြေအနေ': r.status === 'settled' ? 'ရှင်းတမ်းပြီး' : 'ဖွင့်လှစ်ဆဲ'
    }));

    // Add Summary Row
    data.push({
      'စဉ်': 0 as any,
      'ရက်စွဲ': 'စုစုပေါင်း ချုပ်',
      'လုပ်ငန်းလိုင်း': '-',
      'ပွဲစဉ်အမည်': `${startDate} မှ ${endDate} အထိ`,
      'ပေါက်ဂဏန်း/ရလဒ်': '-',
      'ထိုးကြေး/ရောင်းရငွေ (ကျပ်)': grandTotals.totalTurnover,
      'ပေးလျော်ငွေ (ကျပ်)': grandTotals.totalPayout,
      'ကော်မရှင် (ကျပ်)': grandTotals.totalCommission,
      'အသားတင် အမြတ်/အရှုံး (ကျပ်)': grandTotals.netProfit,
      'ပေါက်သူဦးရေ': grandTotals.totalWinners,
      'ဘောင်ချာစောင်ရေ': grandTotals.totalVouchers,
      'အခြေအနေ': grandTotals.isProfit ? 'အမြတ်' : 'အရှုံး'
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'စာရင်းရှင်းတမ်း');

    const filename = `စာရင်းရှင်းတမ်း_${selectedMode}_${startDate}_${endDate}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // Print Statement Handler
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col justify-between overflow-hidden">
        
        {/* Header - Compact */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white leading-tight">
                ကာလအလိုက် စာရင်းရှင်းတမ်း & အမြတ်/အရှုံး အစီရင်ခံစာ
              </h3>
              <p className="text-[10px] text-slate-400">
                တပတ်စာ၊ တလစာ သီးသန့်ဆွဲထုတ်ခြင်း၊ ထိုးကြေး၊ အလျော်နှင့် အသားတင်ရှင်းတမ်းများ
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Excel ဖိုင်ထုတ်မည်"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel ထုတ်မည်</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Controls Bar: Mode Switcher & Time Preset Buttons */}
        <div className="bg-slate-100 p-2 sm:p-3 border-b border-slate-200 space-y-2 shrink-0 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Mode Filter Tabs */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedMode('all')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  selectedMode === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                အားလုံး ချုပ်
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('3d')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  selectedMode === '3d'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                အိုးစည်လေး (3D)
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('2d')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  selectedMode === '2d'
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ဇီးကွက် (2D)
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('football')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  selectedMode === 'football'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ပစ်တိုင်းထောင် (အားကစား)
              </button>
            </div>

            {/* Time Period Filter Buttons */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setPeriodPreset('today')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  periodPreset === 'today'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ဒီနေ့
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('week')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  periodPreset === 'week'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ၁ ပတ်စာ
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('month')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  periodPreset === 'month'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ၁ လစာ
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('custom')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  periodPreset === 'custom'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                စိတ်ကြိုက်ရက်
              </button>
            </div>
          </div>

          {/* Custom Date Pickers */}
          {periodPreset === 'custom' && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-200 animate-in fade-in">
              <span className="text-[11px] font-bold text-slate-600">ရက်စွဲ ရွေးချယ်ရန်:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
              />
              <span className="text-slate-400 font-bold">မှ</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
              />
            </div>
          )}
        </div>

        {/* Modal Body: Hero Metrics & Detailed Statements Table */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 text-xs">
          
          {/* Top 4 Hero Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            
            {/* 1. Total Turnover (ထိုးကြေး) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block mb-0.5">
                ၁။ စုစုပေါင်း ထိုးကြေး / ရောင်းရငွေ
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {formatAmount(grandTotals.totalTurnover, currency)}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                ဘောင်ချာ {grandTotals.totalVouchers} စောင် ({startDate} မှ {endDate})
              </span>
            </div>

            {/* 2. Total Payout (လျော်ကြေး) */}
            <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-3 shadow-2xs">
              <span className="text-[11px] font-bold text-rose-700 block mb-0.5">
                ၂။ စုစုပေါင်း ပေးလျော်ငွေ
              </span>
              <div className="text-xl sm:text-2xl font-black text-rose-700 font-mono">
                {formatAmount(grandTotals.totalPayout, currency)}
              </div>
              <span className="text-[10px] text-rose-600 mt-0.5 block">
                ပေါက်သူ {grandTotals.totalWinners} ဦး
              </span>
            </div>

            {/* 3. Total Commission (ကော်မရှင်) */}
            <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-3 shadow-2xs">
              <span className="text-[11px] font-bold text-indigo-700 block mb-0.5">
                ၃။ ကော်မရှင် စုစုပေါင်းရငွေ
              </span>
              <div className="text-xl sm:text-2xl font-black text-indigo-900 font-mono">
                +{formatAmount(grandTotals.totalCommission, currency)}
              </div>
              <span className="text-[10px] text-indigo-600 mt-0.5 block">
                ပွဲစဉ် {grandTotals.recordsCount} ခု ချုပ်
              </span>
            </div>

            {/* 4. Net Profit / Loss (အသားတင် အမြတ်/အရှုံး) */}
            <div className={`rounded-2xl p-3 border shadow-2xs ${
              grandTotals.isProfit
                ? 'bg-emerald-50/90 border-emerald-300'
                : 'bg-rose-50/90 border-rose-300'
            }`}>
              <span className={`text-[11px] font-bold block mb-0.5 ${
                grandTotals.isProfit ? 'text-emerald-800' : 'text-rose-800'
              }`}>
                ၄။ ဒိုင် အသားတင် {grandTotals.isProfit ? 'အမြတ်' : 'အရှုံး'}
              </span>
              <div className={`text-xl sm:text-2xl font-black font-mono flex items-center gap-1 ${
                grandTotals.isProfit ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {grandTotals.isProfit ? (
                  <TrendingUp className="w-5 h-5 shrink-0" />
                ) : (
                  <TrendingDown className="w-5 h-5 shrink-0" />
                )}
                <span>{formatAmount(Math.abs(grandTotals.netProfit), currency)}</span>
              </div>
              <span className={`text-[10px] font-bold block mt-0.5 ${
                grandTotals.isProfit ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                အမြတ်ရာခိုင်နှုန်း: {grandTotals.profitMargin}%
              </span>
            </div>

          </div>

          {/* Statements Records Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
              <span className="font-black text-slate-800 text-xs flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>ပွဲစဉ်အလိုက် စာရင်းရှင်းတမ်း မှတ်တမ်းများ ({statementRecords.length} ခု)</span>
              </span>
              <span className="text-[10px] text-slate-500 font-bold">
                ကာလ: {startDate} မှ {endDate} အထိ
              </span>
            </div>

            <div className="overflow-x-auto max-h-72 divide-y divide-slate-100">
              {statementRecords.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold">ရွေးချယ်ထားသော ကာလအတွင်း ရှင်းတမ်းမှတ်တမ်း မရှိသေးပါ</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-3">ရက်စွဲ</th>
                      <th className="py-2 px-3">ပွဲစဉ် / လိုင်း</th>
                      <th className="py-2 px-3 text-center">ပေါက်ဂဏန်း</th>
                      <th className="py-2 px-3 text-right">ထိုးကြေး (ရောင်းရ)</th>
                      <th className="py-2 px-3 text-right">လျော်ကြေး</th>
                      <th className="py-2 px-3 text-right">အသားတင် အမြတ်/အရှုံး</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {statementRecords.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                          {rec.date}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              rec.mode === '3d' ? 'bg-indigo-600' : rec.mode === '2d' ? 'bg-teal-600' : 'bg-emerald-600'
                            }`} />
                            <span>{rec.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {rec.modeLabel} • ဘောင်ချာ {rec.vouchersCount} စောင်
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="font-mono font-black text-amber-950 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md text-xs shadow-2xs">
                            {rec.winningResult}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatAmount(rec.turnover, currency)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                          {rec.payout > 0 ? formatAmount(rec.payout, currency) : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-md ${
                            rec.isProfit
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {rec.isProfit ? '+' : '-'}{formatAmount(Math.abs(rec.netProfit), currency)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs">
          <div className="text-[11px] text-slate-500 font-bold">
            ကာလစုစုပေါင်း အသားတင်: {' '}
            <span className={`font-black font-mono ${
              grandTotals.isProfit ? 'text-emerald-600' : 'text-rose-600'
            }`}>
              {grandTotals.isProfit ? '+' : '-'}{formatAmount(Math.abs(grandTotals.netProfit), currency)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer"
            >
              ပိတ်မည်
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
