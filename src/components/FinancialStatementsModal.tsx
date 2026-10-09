import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  Printer,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  Layers,
  Sparkles,
  Award,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  Percent,
  Wallet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { formatAmount } from '../utils/lotteryUtils';
import { printStatementReport } from '../utils/printUtils';
import { verifyOwnerPassword } from '../utils/securityUtils';
import { TwoDVoucher, Voucher, FootballSlip } from '../types';
import {
  StatementRecord,
  StatementGrandTotals,
  StatementPeriodPreset,
  getLocalDateStr,
  getDaysAgoStr,
  getStatementDateRange,
  getStatementPeriodLabel,
  generateStatementRecords,
  computeStatementGrandTotals
} from '../utils/statementUtils';

interface FinancialStatementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'all' | '3d' | '2d' | 'football';
}

export type { StatementRecord };

export const FinancialStatementsModal: React.FC<FinancialStatementsModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'all'
}) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  const [selectedMode, setSelectedMode] = useState<'all' | '3d' | '2d' | 'football'>(initialMode);
  const [periodPreset, setPeriodPreset] = useState<'all' | 'today' | 'three_days' | 'five_days' | 'week' | 'month' | 'custom'>('five_days');

  const [selectedRecord, setSelectedRecord] = useState<StatementRecord | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Exact local date boundaries
  const todayStr = getLocalDateStr();
  const threeDaysAgoStr = getDaysAgoStr(2); // Today, Yesterday, 2 days ago (3 days)
  const fiveDaysAgoStr = getDaysAgoStr(4);  // 5 Calendar Days (၅ ရက်တဖြတ် စာရင်း)
  const oneWeekAgoStr = getDaysAgoStr(6);   // 7 Calendar Days (၁ ပတ်စာ)
  const oneMonthAgoStr = getDaysAgoStr(29); // 30 Calendar Days (၁ လစာ)
  const allTimeStartStr = '2020-01-01';
  const allTimeEndStr = '2099-12-31';

  const [customStartDate, setCustomStartDate] = useState(fiveDaysAgoStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  const currency = lottery2D.settings.currency || lottery3D.settings.currency || 'Ks';

  // Determine active date boundaries based on user selection
  const { startDate, endDate } = useMemo(() => {
    return getStatementDateRange(periodPreset, customStartDate, customEndDate);
  }, [periodPreset, customStartDate, customEndDate]);

  // Aggregate statement records from 2D, 3D, and Football using Single Source of Truth
  const statementRecords: StatementRecord[] = useMemo(() => {
    return generateStatementRecords(
      {
        lottery2D: {
          rounds: lottery2D.rounds,
          vouchers: lottery2D.vouchers,
          forwardSlips: lottery2D.forwardSlips,
          settings: lottery2D.settings
        },
        lottery3D: {
          rounds: lottery3D.rounds,
          vouchers: lottery3D.vouchers,
          forwardSlips: lottery3D.forwardSlips,
          settings: lottery3D.settings
        },
        football: {
          slips: football.slips,
          forwardSlips: football.forwardSlips
        }
      },
      selectedMode,
      startDate,
      endDate
    );
  }, [
    selectedMode,
    startDate,
    endDate,
    lottery2D.rounds,
    lottery2D.vouchers,
    lottery2D.forwardSlips,
    lottery2D.settings,
    lottery3D.rounds,
    lottery3D.vouchers,
    lottery3D.forwardSlips,
    lottery3D.settings,
    football.slips,
    football.forwardSlips
  ]);

  // Grand Totals across all statement records in the filtered period
  const grandTotals = useMemo(() => {
    const totals = computeStatementGrandTotals(statementRecords);
    const profitMargin = totals.totalTurnover > 0 ? ((totals.totalNetProfit / totals.totalTurnover) * 100).toFixed(1) : '0.0';

    return {
      totalTurnover: totals.totalTurnover,
      totalAgentCommission: totals.totalAgentCommission,
      totalNetSales: totals.netSales,
      totalPayout: totals.totalPayout,
      totalForwarded: totals.totalForwarded,
      totalForwardCommission: totals.totalForwardCommission,
      totalNetPaid: totals.totalNetPaid,
      netProfit: totals.totalNetProfit,
      isProfit: totals.isProfit,
      profitMargin,
      totalVouchers: totals.totalVouchers,
      totalWinners: totals.totalWinners,
      recordsCount: statementRecords.length
    };
  }, [statementRecords]);

  // Human readable period label
  const periodLabel = useMemo(() => {
    switch (periodPreset) {
      case 'today': return 'ဒီနေ့ စာရင်းရှင်းတမ်း';
      case 'three_days': return '၃ ရက်စာ စာရင်းရှင်းတမ်း';
      case 'five_days': return '၅ ရက်တဖြတ် စာရင်းရှင်းတမ်း';
      case 'week': return '၁ ပတ်စာ စာရင်းရှင်းတမ်း';
      case 'month': return '၁ လစာ စာရင်းရှင်းတမ်း';
      case 'all': return 'မှတ်တမ်းအားလုံး ချုပ်';
      case 'custom': return `ရက်ရွေး စာရင်း (${startDate} မှ ${endDate})`;
      default: return 'စာရင်းရှင်းတမ်း';
    }
  }, [periodPreset, startDate, endDate]);

  // Export to Excel handler
  const handleExportExcel = () => {
    const data = statementRecords.map((r, i) => ({
      'စဉ်': i + 1,
      'ရက်စွဲ': r.date,
      'လုပ်ငန်းလိုင်း': r.modeLabel,
      'ပွဲစဉ်အမည်': r.name,
      'ပေါက်ဂဏန်း/ရလဒ်': r.winningResult,
      'စုစုပေါင်း ထိုးကြေး (ကျပ်)': r.turnover,
      'အောက်လက် ကော်မရှင် (ကျပ်)': r.agentCommission,
      'အမှန်ရောင်းရငွေ (ကျပ်)': r.netSales,
      'ပေးလျော်ငွေ (ကျပ်)': r.payout,
      'ဒိုင်ကြီးလွှဲ ကော်မရှင်ရငွေ (ကျပ်)': r.forwardCommission,
      'ဒိုင် အသားတင် အမြတ်/အရှုံး (ကျပ်)': (r.isProfit ? '+' : '-') + Math.abs(r.netProfit),
      'ပေါက်သူဦးရေ': r.winnersCount,
      'ဘောင်ချာစောင်ရေ': r.vouchersCount,
      'အခြေအနေ': r.status === 'settled' ? 'ရှင်းတမ်းပြီး' : 'ဖွင့်လှစ်ဆဲ'
    }));

    // Add Summary Row
    data.push({
      'စဉ်': 0 as any,
      'ရက်စွဲ': 'စုစုပေါင်း ချုပ်',
      'လုပ်ငန်းလိုင်း': '-',
      'ပွဲစဉ်အမည်': `${periodLabel} (${startDate === allTimeStartStr ? 'စတင်ချိန်' : startDate} မှ ${endDate === allTimeEndStr ? 'ယခု' : endDate} အထိ)`,
      'ပေါက်ဂဏန်း/ရလဒ်': '-',
      'စုစုပေါင်း ထိုးကြေး (ကျပ်)': grandTotals.totalTurnover,
      'အောက်လက် ကော်မရှင် (ကျပ်)': grandTotals.totalAgentCommission,
      'အမှန်ရောင်းရငွေ (ကျပ်)': grandTotals.totalNetSales,
      'ပေးလျော်ငွေ (ကျပ်)': grandTotals.totalPayout,
      'ဒိုင်ကြီးလွှဲ ကော်မရှင်ရငွေ (ကျပ်)': grandTotals.totalForwardCommission,
      'ဒိုင် အသားတင် အမြတ်/အရှုံး (ကျပ်)': (grandTotals.isProfit ? '+' : '-') + Math.abs(grandTotals.netProfit),
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

  const handleDeleteRecord = () => {
    if (!selectedRecord) return;
    
    if (!verifyOwnerPassword(deletePassword)) {
      setDeleteError('လျှို့ဝှက်နံပါတ် (Password) မှားယွင်းနေပါသည်!');
      return;
    }
    
    const recordId = selectedRecord.id;
    const mode = selectedRecord.mode;
    
    try {
      if (mode === '3d') {
        const roundId = recordId.replace('3d-', '');
        if (roundId.startsWith('orphaned-')) {
          const orphanDate = roundId.replace('orphaned-', '');
          const toDelete = lottery3D.vouchers.filter(v => (v.createdAt || '').slice(0, 10) === orphanDate);
          toDelete.forEach(v => lottery3D.deleteVoucher(v.id));
        } else {
          lottery3D.deleteRound(roundId);
        }
      } else if (mode === '2d') {
        const roundId = recordId.replace('2d-', '');
        if (roundId.startsWith('orphaned-')) {
          const orphanDate = roundId.replace('orphaned-', '');
          const toDelete = lottery2D.vouchers.filter(v => (v.createdAt || '').slice(0, 10) === orphanDate);
          toDelete.forEach(v => lottery2D.deleteVoucher(v.id));
        } else {
          lottery2D.deleteRound(roundId);
        }
      } else if (mode === 'football') {
        const slipDate = recordId.replace('football-', '');
        const slipsToDelete = football.slips.filter((s) => (s.roundDate || (s.createdAt || '').slice(0, 10)) === slipDate);
        slipsToDelete.forEach((s) => football.deleteSlip(s.id));
        const forwardsToDelete = football.forwardSlips.filter((f) => (f.roundDate || (f.createdAt || '').slice(0, 10)) === slipDate);
        forwardsToDelete.forEach((f) => football.deleteForwardSlip(f.id));
      }
      
      setSelectedRecord(null);
      setIsConfirmingDelete(false);
      setDeletePassword('');
      setDeleteError(null);
      alert('စာရင်းရှင်းတမ်းမှတ်တမ်းအား အပြီးတိုင် ဖျက်သိမ်းပြီးပါပြီ!');
    } catch (err) {
      console.error(err);
      alert('ဖျက်သိမ်းစဉ် ချို့ယွင်းချက်ရှိပါသည်');
    }
  };

  const handlePrint = () => {
    printStatementReport('printable-statement-modal', 'ရွှေမင်္ဂလာ စာရင်းရှင်းတမ်း အစီရင်ခံစာ');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 max-h-[94vh] flex flex-col justify-between overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-600/30 text-teal-400 border border-teal-500/40 flex items-center justify-center font-bold">
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white leading-tight">
                ကာလအလိုက် စာရင်းရှင်းတမ်း (၅ ရက်တဖြတ် / အမြတ်၊ အရှုံး & ကော်မရှင် အစီရင်ခံစာ)
              </h3>
              <p className="text-[10px] text-slate-400">
                အောက်လက်ကော်မရှင် ပေးငွေ၊ ဒိုင်ကြီးလွှဲကော်မရှင်၊ ထိုးကြေးနှင့် ပေးလျော်ငွေ အတိအကျ ရှင်းတမ်း
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
              <span className="hidden sm:inline">Excel ထုတ်</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="စာရင်းရှင်းတမ်းအား ပရင့်ထုတ်ရန် သို့မဟုတ် PDF အဖြစ် သိမ်းဆည်းရန်"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">ပရင့် / PDF</span>
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

        {/* Filter Controls Bar */}
        <div className="bg-slate-100 p-2.5 sm:p-3 border-b border-slate-200 space-y-2 shrink-0 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Mode Filter Tabs */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setSelectedMode('all')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  selectedMode === 'all'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                အားလုံး ချုပ်
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('2d')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  selectedMode === '2d'
                    ? 'bg-teal-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ဇီးကွက် (2D)
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('3d')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  selectedMode === '3d'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                အိုးစည်လေး (3D)
              </button>
              <button
                type="button"
                onClick={() => setSelectedMode('football')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  selectedMode === 'football'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ပစ်တိုင်းထောင်
              </button>
            </div>

            {/* Time Period Filter Buttons */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs overflow-x-auto">
              <button
                type="button"
                onClick={() => setPeriodPreset('five_days')}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  periodPreset === 'five_days' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                ★ ၅ ရက်တဖြတ်
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('today')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  periodPreset === 'today' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ဒီနေ့
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('three_days')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  periodPreset === 'three_days' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ၃ ရက်စာ
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('week')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  periodPreset === 'week' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ၁ ပတ်စာ
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('month')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  periodPreset === 'month' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ၁ လစာ
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  periodPreset === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                အားလုံး (All)
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('custom')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  periodPreset === 'custom' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ရက်ရွေး
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

        {/* Modal Body */}
        <div id="printable-statement-modal" className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 text-xs">
          
          {/* Print-only Statement Header Banner */}
          <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4 text-center">
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {lottery2D.settings.shopName || lottery3D.settings.shopName || 'ရွှေမင်္ဂလာ'} - စာရင်းရှင်းတမ်း အစီရင်ခံစာ
            </h2>
            <p className="text-xs text-slate-600 font-bold mt-1">
              {periodLabel} ({startDate === allTimeStartStr ? 'စတင်ချိန်' : startDate} မှ {endDate === allTimeEndStr ? 'ယခု' : endDate} အထိ)
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              အမျိုးအစား: {selectedMode === 'all' ? 'လုပ်ငန်းအားလုံးချုပ်' : selectedMode === '3d' ? 'အိုးစည်လေး (3D)' : selectedMode === '2d' ? 'ဇီးကွက် (2D)' : 'ပစ်တိုင်းထောင် (ဘောလုံး)'}
            </p>
          </div>

          {/* Active Period Highlight Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-3 sm:p-3.5 shadow-md flex flex-wrap items-center justify-between gap-3 border border-indigo-500/20">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white">{periodLabel}</span>
                  <span className="px-2 py-0.5 bg-teal-500/20 text-teal-300 border border-teal-500/30 rounded-md text-[10px] font-bold">
                    {startDate === allTimeStartStr ? 'မှတ်တမ်းအားလုံး' : `${startDate} မှ ${endDate} ထိ`}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  ပွဲစဉ်ပေါင်း <b className="text-teal-300">{statementRecords.length}</b> ခု • ဘောင်ချာ <b className="text-white">{grandTotals.totalVouchers}</b> စောင် • ပေါက်သူ <b className="text-amber-300">{grandTotals.totalWinners}</b> ဦး
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <span className="text-[10px] text-slate-300 font-bold block">ဒိုင် အသားတင် ရလဒ်</span>
                <span className={`text-base font-black font-mono px-2 py-0.5 rounded-lg border ${
                  grandTotals.isProfit 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' 
                    : 'bg-rose-500/20 text-rose-300 border-rose-400/40'
                }`}>
                  {grandTotals.isProfit ? '+' : '-'}{formatAmount(Math.abs(grandTotals.netProfit), currency)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Comprehensive Settlement Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            
            {/* 1. Gross Turnover (စုစုပေါင်း ထိုးကြေး) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-500 block mb-0.5 uppercase">
                ၁။ စုစုပေါင်း ထိုးကြေး
              </span>
              <div className="text-base sm:text-lg font-black text-slate-900 font-mono">
                {formatAmount(grandTotals.totalTurnover, currency)}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block font-medium">
                ရောင်းရငွေ စုစုပေါင်း
              </span>
            </div>

            {/* 2. Agent Commission Payable (အောက်လက်ကို ပေးရမည့် ကော်မရှင်ခ) */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-amber-900 block mb-0.5 uppercase flex items-center justify-between">
                <span>၂။ အောက်လက် ကော်မရှင်</span>
                <span className="text-[9px] px-1 py-0.2 bg-amber-200 text-amber-900 rounded font-black">နုတ်ပေးငွေ</span>
              </span>
              <div className="text-base sm:text-lg font-black text-amber-900 font-mono">
                -{formatAmount(grandTotals.totalAgentCommission, currency)}
              </div>
              <span className="text-[10px] text-amber-700 mt-0.5 block font-medium">
                အောက်လက်ပေး ကော်မရှင်ခ
              </span>
            </div>

            {/* 3. Net Sales (ဒိုင် လက်ကျန် ရောင်းရငွေ) */}
            <div className="bg-sky-50/80 border border-sky-200 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-sky-900 block mb-0.5 uppercase flex items-center justify-between">
                <span>၃။ အမှန်ရောင်းငွေ</span>
                <span className="text-[9px] px-1 py-0.2 bg-sky-200 text-sky-900 rounded font-black">လက်ခံရငွေ</span>
              </span>
              <div className="text-base sm:text-lg font-black text-sky-950 font-mono">
                {formatAmount(grandTotals.totalNetSales, currency)}
              </div>
              <span className="text-[10px] text-sky-700 mt-0.5 block font-medium">
                ထိုးကြေး - ကော်မရှင်
              </span>
            </div>

            {/* 4. Total Payout (ပေါက်မဲ ပေးလျော်ငွေ) */}
            <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-rose-700 block mb-0.5 uppercase flex items-center justify-between">
                <span>၄။ ပေးလျော်ငွေ</span>
                <span className="text-[9px] px-1 py-0.2 bg-rose-200 text-rose-900 rounded font-black">ပေါက်မဲ</span>
              </span>
              <div className="text-base sm:text-lg font-black text-rose-700 font-mono">
                {formatAmount(grandTotals.totalPayout, currency)}
              </div>
              <span className="text-[10px] text-rose-600 mt-0.5 block font-bold">
                ပေါက်သူ {grandTotals.totalWinners} ဦး
              </span>
            </div>

            {/* 5. Forward Commission In (ဒိုင်ကြီးဆီ လွှဲတင်ကော်မရှင် ရငွေ) */}
            <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-3 shadow-2xs">
              <span className="text-[10px] font-bold text-indigo-800 block mb-0.5 uppercase flex items-center justify-between">
                <span>၅။ ဒိုင်ကြီးလွှဲ ကော်မရှင်</span>
                <span className="text-[9px] px-1 py-0.2 bg-indigo-200 text-indigo-900 rounded font-black">ရငွေ</span>
              </span>
              <div className="text-base sm:text-lg font-black text-indigo-900 font-mono">
                +{formatAmount(grandTotals.totalForwardCommission, currency)}
              </div>
              <span className="text-[10px] text-indigo-700 mt-0.5 block font-medium">
                ဒိုင်ကြီးဆီမှ ပြန်ရငွေ
              </span>
            </div>

            {/* 6. Net Profit / Loss (ဒိုင် အသားတင် အမြတ်/အရှုံး) */}
            <div className={`rounded-2xl p-3 border shadow-2xs ${
              grandTotals.isProfit
                ? 'bg-emerald-50/95 border-emerald-300'
                : 'bg-rose-50/95 border-rose-300'
            }`}>
              <span className={`text-[10px] font-bold block mb-0.5 uppercase ${
                grandTotals.isProfit ? 'text-emerald-800' : 'text-rose-800'
              }`}>
                ၆။ ဒိုင် အသားတင် {grandTotals.isProfit ? 'အမြတ်' : 'အရှုံး'}
              </span>
              <div className={`text-base sm:text-lg font-black font-mono flex items-center gap-1 ${
                grandTotals.isProfit ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {grandTotals.isProfit ? (
                  <TrendingUp className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 shrink-0 text-rose-600" />
                )}
                <span>
                  {grandTotals.isProfit ? '+' : '-'}{formatAmount(Math.abs(grandTotals.netProfit), currency)}
                </span>
              </div>
              <span className={`text-[10px] font-bold block mt-0.5 ${
                grandTotals.isProfit ? 'text-emerald-700' : 'text-rose-700'
              }`}>
                {grandTotals.isProfit ? 'မြတ်' : 'ရှုံး'} ({grandTotals.profitMargin}%)
              </span>
            </div>

          </div>

          {/* Statements Records Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
              <span className="font-black text-xs flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                <span>
                  {periodLabel} - ပွဲစဉ်အလိုက် အသေးစိတ် ({statementRecords.length} ခု)
                </span>
              </span>
              <span className="text-[10px] text-slate-300 font-bold">
                {startDate === allTimeStartStr ? 'မှတ်တမ်းအားလုံး' : `${startDate} မှ ${endDate} အထိ`}
              </span>
            </div>

            <div className="overflow-x-auto max-h-80 divide-y divide-slate-100">
              {statementRecords.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">ရွေးချယ်ထားသော ကာလအတွင်း ရှင်းတမ်းမှတ်တမ်း မရှိသေးပါ</p>
                  <p className="text-[11px] text-slate-400">"★ ၅ ရက်တဖြတ်" သို့မဟုတ် "အားလုံး (All)" ခလုတ်ကို နှိပ်၍ ကြည့်ရှုနိုင်ပါသည်</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">ရက်စွဲ / အချိန်</th>
                      <th className="py-2.5 px-3">ပွဲစဉ် / လိုင်း</th>
                      <th className="py-2.5 px-3 text-center">ပေါက်ဂဏန်း</th>
                      <th className="py-2.5 px-3 text-right">ထိုးကြေး (စုစုပေါင်း)</th>
                      <th className="py-2.5 px-3 text-right text-amber-800">အောက်လက် ကော်မရှင်</th>
                      <th className="py-2.5 px-3 text-right text-sky-900">အမှန်ရောင်းငွေ</th>
                      <th className="py-2.5 px-3 text-right text-rose-700">ပေးလျော်ငွေ</th>
                      <th className="py-2.5 px-3 text-right text-indigo-700">ဒိုင်ကြီးလွှဲ ကော်မရှင်</th>
                      <th className="py-2.5 px-3 text-right">အသားတင် ရလဒ်</th>
                      <th className="py-2.5 px-3 text-center">အသေးစိတ်</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {statementRecords.map((rec) => (
                      <tr 
                        key={rec.id} 
                        onClick={() => setSelectedRecord(rec)}
                        className="hover:bg-indigo-50/60 transition-all cursor-pointer group"
                        title="အသေးစိတ်စာရင်းကြည့်ရန် နှိပ်ပါ"
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {rec.date}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 text-[10px] font-black rounded ${
                              rec.mode === '3d'
                                ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                : rec.mode === '2d'
                                ? 'bg-teal-100 text-teal-900 border border-teal-200'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            }`}>
                              {rec.modeLabel}
                            </span>
                            <span>{rec.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            ဘောင်ချာ {rec.vouchersCount} စောင် {rec.winnersCount > 0 ? `• ပေါက်သူ ${rec.winnersCount} ဦး` : ''}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="font-mono font-black text-amber-950 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md text-xs shadow-2xs">
                            {rec.winningResult}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatAmount(rec.turnover, currency)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800 whitespace-nowrap">
                          {rec.agentCommission > 0 ? `-${formatAmount(rec.agentCommission, currency)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-950 whitespace-nowrap">
                          {formatAmount(rec.netSales, currency)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                          {rec.payout > 0 ? (
                            <span className="text-rose-700 font-black">
                              {formatAmount(rec.payout, currency)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700 whitespace-nowrap">
                          {rec.forwardCommission > 0 ? `+${formatAmount(rec.forwardCommission, currency)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-lg border text-xs inline-block font-mono ${
                            rec.isProfit
                              ? 'bg-emerald-100/90 text-emerald-800 border-emerald-300'
                              : 'bg-rose-100/90 text-rose-800 border-rose-300'
                          }`}>
                            {rec.isProfit ? '+' : '-'}{formatAmount(Math.abs(rec.netProfit), currency)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            className="p-1 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
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
          <div className="text-[11px] text-slate-600 font-bold flex items-center gap-2">
            <span>ကာလအသားတင် အမြတ်/အရှုံး:</span>
            <span className={`font-black font-mono text-sm px-2 py-0.5 rounded-lg border ${
              grandTotals.isProfit 
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                : 'bg-rose-100 text-rose-800 border-rose-300'
            }`}>
              {grandTotals.isProfit ? '+' : '-'}{formatAmount(Math.abs(grandTotals.netProfit), currency)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer transition-colors"
            >
              ပိတ်မည်
            </button>
          </div>
        </div>

      </div>

      {/* Selected Statement Record Inspector Dialog */}
      {selectedRecord && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[88vh] flex flex-col justify-between">
            {/* Detail Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                  selectedRecord.mode === '2d' ? 'bg-teal-500 text-white' : selectedRecord.mode === '3d' ? 'bg-indigo-500 text-white' : 'bg-emerald-500 text-white'
                }`}>
                  {selectedRecord.modeLabel}
                </span>
                <span className="font-black text-sm">{selectedRecord.name} (အသေးစိတ်ရှင်းတမ်း)</span>
              </div>
              <button
                onClick={() => { setSelectedRecord(null); setIsConfirmingDelete(false); setDeletePassword(''); setDeleteError(null); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Detail Content */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              
              {/* Metrics summary */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">၁။ ထိုးကြေး</span>
                  <span className="text-sm font-black font-mono text-slate-900">{formatAmount(selectedRecord.turnover, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800 font-bold block uppercase">၂။ အောက်လက်ကော်မရှင်</span>
                  <span className="text-sm font-black font-mono text-amber-800">-{formatAmount(selectedRecord.agentCommission, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-rose-600 font-bold block uppercase">၃။ ပေးလျော်ငွေ</span>
                  <span className="text-sm font-black font-mono text-rose-700">{formatAmount(selectedRecord.payout, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-indigo-600 font-bold block uppercase">၄။ ဒိုင်ကြီးလွှဲကော်မရှင်</span>
                  <span className="text-sm font-black font-mono text-indigo-700">+{formatAmount(selectedRecord.forwardCommission, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">၅။ အသားတင်ရလဒ်</span>
                  <span className={`text-sm font-black font-mono px-1.5 py-0.5 rounded ${
                    selectedRecord.isProfit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {selectedRecord.isProfit ? '+' : '-'}{formatAmount(Math.abs(selectedRecord.netProfit), currency)}
                  </span>
                </div>
              </div>

              {/* Vouchers lists */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>အရောင်းဘောင်ချာများ စာရင်း ({selectedRecord.vouchersCount} စောင်)</span>
                  </h4>
                  <span className="text-[10px] text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md font-bold">
                    ပေါက်ဂဏန်း: {selectedRecord.winningResult}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {(() => {
                    const is3D = selectedRecord.mode === '3d';
                    const is2D = selectedRecord.mode === '2d';
                    const roundId = selectedRecord.rawRoundId || selectedRecord.id.replace(/^(3d|2d|football)-/, '');

                    let vouchersToDisplay: any[] = [];
                    if (is2D) {
                      vouchersToDisplay = lottery2D.vouchers.filter(v => 
                        (v.roundId === roundId || (!v.roundId && (v.createdAt || '').slice(0, 10) === selectedRecord.date)) &&
                        v.status !== 'cancelled'
                      );
                    } else if (is3D) {
                      vouchersToDisplay = lottery3D.vouchers.filter(v => 
                        (v.roundId === roundId || (!v.roundId && (v.createdAt || '').slice(0, 10) === selectedRecord.date)) &&
                        v.status !== 'cancelled'
                      );
                    } else {
                      vouchersToDisplay = football.slips.filter(s => (s.createdAt || s.roundDate || '').slice(0, 10) === selectedRecord.date && s.status !== 'cancelled');
                    }

                    if (vouchersToDisplay.length === 0) {
                      return <p className="p-4 text-center text-slate-400">ဤပွဲစဉ်အတွက် ဘောင်ချာမှတ်တမ်း မရှိပါ</p>;
                    }

                    return vouchersToDisplay.map((v: any, index: number) => {
                      const itemsStr = v.items ? v.items.map((it: any) => `${it.number}=${it.amount}`).join(', ') : '-';
                      const hasWonItem = v.items ? v.items.some((it: any) => it.isWon || it.number === selectedRecord.winningResult) : false;
                      const voucherDisc = v.discountAmount > 0 ? v.discountAmount : 0;
                      
                      return (
                        <div key={index} className="p-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-[11px]">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold font-mono text-slate-900">{v.voucherNo || v.slipNo}</span>
                              <span className="text-slate-600 font-medium">({v.customerName})</span>
                              {hasWonItem && (
                                <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 font-black text-[9px] rounded-md">
                                  ★ ပေါက်မဲ
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-xs">
                              {itemsStr}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold font-mono text-slate-900 block">{formatAmount(v.netPayable || v.subtotal || v.stakeAmount, currency)}</span>
                            <div className="flex items-center justify-end gap-1.5 mt-0.5">
                              {voucherDisc > 0 && (
                                <span className="text-[9px] text-amber-700 font-mono">
                                  (ကော် -{formatAmount(voucherDisc, currency)})
                                </span>
                              )}
                              <span className={`text-[10px] ${v.isPaid ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                                {v.isPaid ? 'ရှင်းပြီး ✓' : 'ကြွေးကျန်'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* PIN-Protected Deletion Area */}
              <div className="border-t border-slate-200 pt-3 space-y-2">
                {!isConfirmingDelete ? (
                  <div className="flex items-center justify-between gap-3 bg-rose-50/70 border border-rose-200 rounded-xl p-2.5">
                    <div>
                      <h5 className="font-black text-rose-950 text-xs">ဤရှင်းတမ်းမှတ်တမ်းအား ဖျက်သိမ်းလိုပါသလား။</h5>
                      <p className="text-[10px] text-rose-800">ဖျက်သိမ်းပြီးပါက ဤပွဲစဉ်၏ အရောင်းနှင့် ဘောင်ချာများ အားလုံး ပျက်သွားမည်။</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(true)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-2xs shrink-0"
                    >
                      ဖျက်မည်
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-300 rounded-2xl p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center gap-2 text-slate-800 font-bold">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>ဖျက်သိမ်းရန် ဆက်တင်လျှို့ဝှက်နံပါတ် (Password) လိုအပ်ပါသည်</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        placeholder="လျှို့ဝှက်နံပါတ် ရိုက်ထည့်ပါ"
                        value={deletePassword}
                        onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(null); }}
                        className="flex-1 bg-white border border-slate-300 focus:border-rose-500 rounded-xl px-3 py-1.5 outline-none font-bold text-slate-900 shadow-2xs text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleDeleteRecord}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer shadow-xs text-xs"
                      >
                        အတည်ပြုဖျက်မည်
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsConfirmingDelete(false); setDeletePassword(''); setDeleteError(null); }}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer text-xs"
                      >
                        မဖျက်တော့ပါ
                      </button>
                    </div>

                    {deleteError && (
                      <p className="text-xs text-rose-600 font-bold flex items-center gap-1">
                        ⚠️ {deleteError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => { setSelectedRecord(null); setIsConfirmingDelete(false); setDeletePassword(''); setDeleteError(null); }}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer text-xs"
              >
                ပိတ်မည်
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
