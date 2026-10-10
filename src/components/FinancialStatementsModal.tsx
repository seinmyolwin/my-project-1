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
  Wallet,
  Search
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
  const [periodPreset, setPeriodPreset] = useState<StatementPeriodPreset>('five_days');

  const [selectedRecord, setSelectedRecord] = useState<StatementRecord | null>(null);
  const [inspectingVoucher, setInspectingVoucher] = useState<any | null>(null);
  const [copiedVoucherText, setCopiedVoucherText] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Tab switch between rounds table and consolidated vouchers list
  const [viewMode, setViewMode] = useState<'rounds' | 'vouchers'>('rounds');
  const [voucherSearch, setVoucherSearch] = useState('');

  // Sync selectedMode if initialMode changes
  React.useEffect(() => {
    if (isOpen && initialMode) {
      setSelectedMode(initialMode);
    }
  }, [isOpen, initialMode]);

  // Exact local date boundaries
  const todayStr = getLocalDateStr();
  const twoDaysAgoStr = getDaysAgoStr(1);
  const threeDaysAgoStr = getDaysAgoStr(2);
  const fiveDaysAgoStr = getDaysAgoStr(4);
  const oneWeekAgoStr = getDaysAgoStr(6);
  const oneMonthAgoStr = getDaysAgoStr(29);
  const allTimeStartStr = '2020-01-01';
  const allTimeEndStr = '2099-12-31';

  const [customStartDate, setCustomStartDate] = useState(fiveDaysAgoStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  const currency = lottery2D.settings.currency || lottery3D.settings.currency || 'Ks';

  // Determine active date boundaries based on user selection
  const { startDate, endDate } = useMemo(() => {
    return getStatementDateRange(periodPreset, customStartDate, customEndDate);
  }, [periodPreset, customStartDate, customEndDate]);

  // Line-specific isolation vs Master All Mode
  const isLineSpecific = initialMode !== 'all';
  const effectiveMode = isLineSpecific ? initialMode : selectedMode;

  const lineTitle =
    effectiveMode === '2d'
      ? 'ဇီးကွက် (2D) စာရင်းရှင်းတမ်း'
      : effectiveMode === '3d'
      ? 'အိုးစည်လေး (3D) စာရင်းရှင်းတမ်း'
      : effectiveMode === 'football'
      ? 'ပစ်တိုင်းထောင် (ဘောလုံး) စာရင်းရှင်းတမ်း'
      : 'ကာလအလိုက် စာရင်းရှင်းတမ်း (လုပ်ငန်းအားလုံးချုပ်)';

  const lineSubtitle =
    effectiveMode === '2d'
      ? 'ဇီးကွက် (2D) သီးသန့် ကာလအလိုက် စာရင်းရှင်းတမ်းနှင့် အမြတ်/အရှုံး အစီရင်ခံစာ'
      : effectiveMode === '3d'
      ? 'အိုးစည်လေး (3D) သီးသန့် ကာလအလိုက် စာရင်းရှင်းတမ်းနှင့် အမြတ်/အရှုံး အစီရင်ခံစာ'
      : effectiveMode === 'football'
      ? 'ပစ်တိုင်းထောင် (ဘောလုံး) သီးသန့် ကာလအလိုက် စာရင်းရှင်းတမ်းနှင့် အမြတ်/အရှုံး အစီရင်ခံစာ'
      : 'အောက်လက်ကော်မရှင် ပေးငွေ၊ ဒိုင်ကြီးလွှဲကော်မရှင်၊ ထိုးကြေးနှင့် ပေးလျော်ငွေ အတိအကျ ရှင်းတမ်း';

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
          forwardSlips: football.forwardSlips,
          settings: football.settings
        }
      },
      effectiveMode,
      startDate,
      endDate
    );
  }, [
    effectiveMode,
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
    football.forwardSlips,
    football.settings
  ]);

  // Grand Totals across all statement records in the filtered period
  const grandTotals = useMemo(() => {
    const totals = computeStatementGrandTotals(statementRecords);
    const profitMargin = totals.totalTurnover > 0 ? ((totals.totalNetProfit / totals.totalTurnover) * 100).toFixed(1) : '0.0';

    return {
      totalTurnover: totals.totalTurnover,
      totalForwarded: totals.totalForwarded,
      totalAgentCommission: totals.totalAgentCommission,
      totalNetSales: totals.netSales,
      totalMasterPayout: totals.totalMasterPayout,
      totalForwardCommission: totals.totalForwardCommission,
      totalPayout: totals.totalPayout,
      retainedPayout: totals.retainedPayout,
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
    return getStatementPeriodLabel(periodPreset);
  }, [periodPreset]);

  // Consolidated list of all vouchers across this statement period
  const allPeriodVouchers = useMemo(() => {
    const list: Array<{ voucher: any; roundName: string; mode: string; modeLabel: string; date: string }> = [];
    statementRecords.forEach((rec) => {
      (rec.vouchersList || []).forEach((v) => {
        list.push({
          voucher: v,
          roundName: rec.name,
          mode: rec.mode,
          modeLabel: rec.modeLabel,
          date: rec.date
        });
      });
    });
    return list;
  }, [statementRecords]);

  // Search filtered period vouchers
  const filteredPeriodVouchers = useMemo(() => {
    if (!voucherSearch.trim()) return allPeriodVouchers;
    const q = voucherSearch.toLowerCase().trim();
    return allPeriodVouchers.filter(({ voucher, roundName, modeLabel }) => {
      const vNo = (voucher.voucherNo || voucher.slipNo || '').toLowerCase();
      const cName = (voucher.customerName || '').toLowerCase();
      const cPhone = (voucher.customerPhone || '').toLowerCase();
      const rName = (roundName || '').toLowerCase();
      const mLabel = (modeLabel || '').toLowerCase();
      const itemsStr = voucher.items ? voucher.items.map((it: any) => it.number).join(' ') : (voucher.matchesSummary || '');
      return vNo.includes(q) || cName.includes(q) || cPhone.includes(q) || rName.includes(q) || mLabel.includes(q) || itemsStr.toLowerCase().includes(q);
    });
  }, [allPeriodVouchers, voucherSearch]);

  // Export to Excel handler with complete exact formula columns
  const handleExportExcel = () => {
    const data = statementRecords.map((r, i) => ({
      'စဉ်': i + 1,
      'ရက်စွဲ': r.date,
      'လုပ်ငန်းလိုင်း': r.modeLabel,
      'ပွဲစဉ်အမည်': r.name,
      'ပေါက်ဂဏန်း/ရလဒ်': r.winningResult,
      '၁။ မူလထိုးကြေး (ကျပ်)': r.turnover,
      '၂။ အထက်တင်ကြေး (ကျပ်)': r.totalForwarded,
      '၃။ အောက်လက်ကော်မရှင် (ကျပ်)': r.agentCommission,
      '၄။ အမှန်ရောင်းငွေ (ကျပ်)': r.netSales,
      '၅။ အထက်ပေါက်ကြေး (ကျပ်)': r.masterPayout,
      '၆။ အထက်ကော်မရှင်ခ (ကျပ်)': r.forwardCommission,
      '၇။ ပေးလျှော်ငွေ (ကျပ်)': r.totalPayout,
      '၈။ ဒိုင်အသားတင် အမြတ်/အရှုံး (ကျပ်)': (r.isProfit ? '+' : '-') + Math.abs(r.netProfit),
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
      '၁။ မူလထိုးကြေး (ကျပ်)': grandTotals.totalTurnover,
      '၂။ အထက်တင်ကြေး (ကျပ်)': grandTotals.totalForwarded,
      '၃။ အောက်လက်ကော်မရှင် (ကျပ်)': grandTotals.totalAgentCommission,
      '၄။ အမှန်ရောင်းငွေ (ကျပ်)': grandTotals.totalNetSales,
      '၅။ အထက်ပေါက်ကြေး (ကျပ်)': grandTotals.totalMasterPayout,
      '၆။ အထက်ကော်မရှင်ခ (ကျပ်)': grandTotals.totalForwardCommission,
      '၇။ ပေးလျှော်ငွေ (ကျပ်)': grandTotals.totalPayout,
      '၈။ ဒိုင်အသားတင် အမြတ်/အရှုံး (ကျပ်)': (grandTotals.isProfit ? '+' : '-') + Math.abs(grandTotals.netProfit),
      'ပေါက်သူဦးရေ': grandTotals.totalWinners,
      'ဘောင်ချာစောင်ရေ': grandTotals.totalVouchers,
      'အခြေအနေ': grandTotals.isProfit ? 'အမြတ်' : 'အရှုံး'
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'စာရင်းရှင်းတမ်း');

    const filename = `စာရင်းရှင်းတမ်း_${effectiveMode}_${startDate}_${endDate}.xlsx`;
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
    printStatementReport('printable-statement-modal', `${lineTitle} (${startDate} မှ ${endDate})`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 max-h-[94vh] flex flex-col justify-between overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold border ${
              effectiveMode === '2d'
                ? 'bg-teal-600/30 text-teal-400 border-teal-500/40'
                : effectiveMode === '3d'
                ? 'bg-indigo-600/30 text-indigo-400 border-indigo-500/40'
                : effectiveMode === 'football'
                ? 'bg-emerald-600/30 text-emerald-400 border-emerald-500/40'
                : 'bg-slate-700/50 text-slate-300 border-slate-600/40'
            }`}>
              <Receipt className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white leading-tight">
                {lineTitle}
              </h3>
              <p className="text-[10px] text-slate-400">
                {lineSubtitle}
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
            {isLineSpecific ? (
              /* Dedicated Line Badge for 2D, 3D, or Football */
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-black text-xs shadow-2xs border ${
                    effectiveMode === '2d'
                      ? 'bg-teal-50 border-teal-300 text-teal-950'
                      : effectiveMode === '3d'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-950'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      effectiveMode === '2d'
                        ? 'bg-teal-500'
                        : effectiveMode === '3d'
                        ? 'bg-indigo-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <span>
                    {effectiveMode === '2d'
                      ? 'ဇီးကွက် (2D) သီးသန့် ရှင်းတမ်း'
                      : effectiveMode === '3d'
                      ? 'အိုးစည်လေး (3D) သီးသန့် ရှင်းတမ်း'
                      : 'ပစ်တိုင်းထောင် (ဘောလုံး) သီးသန့် ရှင်းတမ်း'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 hidden md:inline font-medium">
                  ★ လုပ်ငန်း ၃ ခုလုံး ပေါင်းချုပ်ရှင်းတမ်းကို "ဆက်တင် &gt; ရှင်းတမ်း" တွင် ကြည့်နိုင်ပါသည်
                </span>
              </div>
            ) : (
              /* Mode Filter Tabs when opened in Master All mode */
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
            )}

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
                ဒီနေ့ (၁ ရက်)
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('two_days')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  periodPreset === 'two_days' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ၂ ရက်စာ
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
          
          {/* Comprehensive 8-Step Formula Overview Cards matching Exact Bookie Rules */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            
            {/* 1. မူလထိုးကြေး (စုစုပေါင်း) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 shadow-2xs">
              <span className="text-[9px] font-bold text-slate-500 block mb-0.5 uppercase">
                ၁။ မူလထိုးကြေး
              </span>
              <div className="text-sm font-black text-slate-900 font-mono">
                {formatAmount(grandTotals.totalTurnover, currency)}
              </div>
              <span className="text-[9px] text-slate-400 block font-medium">
                ထိုးကြေး အားလုံးပေါင်း
              </span>
            </div>

            {/* 2. အထက်တင်ကြေး (လွှဲငွေ) */}
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-2.5 shadow-2xs">
              <span className="text-[9px] font-bold text-indigo-900 block mb-0.5 uppercase">
                ၂။ အထက်တင်ကြေး
              </span>
              <div className="text-sm font-black text-indigo-950 font-mono">
                {formatAmount(grandTotals.totalForwarded, currency)}
              </div>
              <span className="text-[9px] text-indigo-600 block font-medium">
                ဒိုင်ကြီးဆီ လွှဲငွေ
              </span>
            </div>

            {/* 3. အောက်လက်ကော်မရှင် (ကိုယ်ကပေးငွေ) */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 shadow-2xs">
              <span className="text-[9px] font-bold text-amber-900 block mb-0.5 uppercase">
                ၃။ အောက်လက်ကော်
              </span>
              <div className="text-sm font-black text-amber-900 font-mono">
                -{formatAmount(grandTotals.totalAgentCommission, currency)}
              </div>
              <span className="text-[9px] text-amber-700 block font-medium">
                ကိုယ်က ပေးရမည့်ငွေ
              </span>
            </div>

            {/* 4. အမှန်ရောင်းငွေ (ဒိုင်လက်ကျန်) = ၁ - ၂ - ၃ */}
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-2.5 shadow-2xs">
              <span className="text-[9px] font-bold text-sky-900 block mb-0.5 uppercase">
                ၄။ အမှန်ရောင်းငွေ
              </span>
              <div className="text-sm font-black text-sky-950 font-mono">
                {formatAmount(grandTotals.totalNetSales, currency)}
              </div>
              <span className="text-[9px] text-sky-700 block font-medium">
                ဒိုင်လက်ကျန်ရောင်းငွေ
              </span>
            </div>

            {/* 5. အထက်ပေါက်ကြေး (ဒိုင်ကြီးဆီမှ ပြန်ရငွေ) */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 shadow-2xs">
              <span className="text-[9px] font-bold text-emerald-900 block mb-0.5 uppercase">
                ၅။ အထက်ပေါက်ကြေး
              </span>
              <div className="text-sm font-black text-emerald-900 font-mono">
                +{formatAmount(grandTotals.totalMasterPayout, currency)}
              </div>
              <span className="text-[9px] text-emerald-700 block font-medium">
                ဒိုင်ကြီး ပြန်လျော်ငွေ
              </span>
            </div>

            {/* 6. အထက်ကော်မရှင် (ဒိုင်ကြီးဆီမှ ရငွေ) */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-2.5 shadow-2xs">
              <span className="text-[9px] font-bold text-purple-900 block mb-0.5 uppercase">
                ၆။ အထက်ကော်မရှင်
              </span>
              <div className="text-sm font-black text-purple-900 font-mono">
                +{formatAmount(grandTotals.totalForwardCommission, currency)}
              </div>
              <span className="text-[9px] text-purple-700 block font-medium">
                ကိုယ်ရမည့် ကော်မရှင်ခ
              </span>
            </div>

            {/* 7. ပေးလျှော်ငွေ (ဖောက်သည် အားလုံးအတွက်) */}
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 shadow-2xs">
              <span className="text-[9px] font-bold text-rose-800 block mb-0.5 uppercase">
                ၇။ ပေးလျှော်ငွေ
              </span>
              <div className="text-sm font-black text-rose-800 font-mono">
                -{formatAmount(grandTotals.totalPayout, currency)}
              </div>
              <span className="text-[9px] text-rose-600 block font-medium">
                အောက်လက်ပေါက်ကြေး
              </span>
            </div>

            {/* 8. ဒိုင်အသားတင် အမြတ်/အရှုံး = ၄ + ၅ + ၆ - ၇ */}
            <div className={`rounded-xl p-2.5 border shadow-2xs ${
              grandTotals.isProfit ? 'bg-teal-50 border-teal-300' : 'bg-rose-100 border-rose-300'
            }`}>
              <span className={`text-[9px] font-bold block mb-0.5 uppercase ${
                grandTotals.isProfit ? 'text-teal-900' : 'text-rose-900'
              }`}>
                ၈။ အသားတင် {grandTotals.isProfit ? 'အမြတ်' : 'အရှုံး'}
              </span>
              <div className={`text-sm font-black font-mono ${
                grandTotals.isProfit ? 'text-teal-800' : 'text-rose-800'
              }`}>
                {grandTotals.isProfit ? '+' : '-'}{formatAmount(Math.abs(grandTotals.netProfit), currency)}
              </div>
              <span className={`text-[9px] font-bold block ${
                grandTotals.isProfit ? 'text-teal-700' : 'text-rose-700'
              }`}>
                {grandTotals.isProfit ? 'အမြတ်' : 'အရှုံး'} ({grandTotals.profitMargin}%)
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
                  <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10 whitespace-nowrap">
                    <tr>
                      <th className="py-2.5 px-3">ရက်စွဲ</th>
                      <th className="py-2.5 px-3">ပွဲစဉ် / လိုင်း</th>
                      <th className="py-2.5 px-3 text-center">ပေါက်ဂဏန်း</th>
                      <th className="py-2.5 px-3 text-right">၁။ မူလထိုးကြေး</th>
                      <th className="py-2.5 px-3 text-right text-indigo-900">၂။ အထက်တင်ကြေး</th>
                      <th className="py-2.5 px-3 text-right text-amber-800">၃။ အောက်လက်ကော်</th>
                      <th className="py-2.5 px-3 text-right text-sky-900">၄။ အမှန်ရောင်းငွေ</th>
                      <th className="py-2.5 px-3 text-right text-emerald-800">၅။ အထက်ပေါက်ကြေး</th>
                      <th className="py-2.5 px-3 text-right text-purple-800">၆။ အထက်ကော်</th>
                      <th className="py-2.5 px-3 text-right text-rose-700">၇။ ပေးလျှော်ငွေ</th>
                      <th className="py-2.5 px-3 text-right">၈။ ဒိုင်အသားတင်</th>
                      <th className="py-2.5 px-3 text-center">ဘောင်ချာများ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 whitespace-nowrap">
                    {statementRecords.map((rec) => (
                      <tr 
                        key={rec.id} 
                        onClick={() => setSelectedRecord(rec)}
                        className="hover:bg-indigo-50/60 transition-all cursor-pointer group"
                        title="အသေးစိတ်ရှင်းတမ်းနှင့် ဘောင်ချာများ ကြည့်ရန် နှိပ်ပါ"
                      >
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
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
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {formatAmount(rec.turnover, currency)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-900">
                          {rec.totalForwarded > 0 ? formatAmount(rec.totalForwarded, currency) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-800">
                          {rec.agentCommission > 0 ? `-${formatAmount(rec.agentCommission, currency)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-sky-950 bg-sky-50/50">
                          {formatAmount(rec.netSales, currency)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800">
                          {rec.masterPayout > 0 ? `+${formatAmount(rec.masterPayout, currency)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-800">
                          {rec.forwardCommission > 0 ? `+${formatAmount(rec.forwardCommission, currency)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700">
                          {rec.totalPayout > 0 ? `-${formatAmount(rec.totalPayout, currency)}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-black">
                          <span className={`px-2 py-1 rounded-lg border text-xs inline-block font-mono ${
                            rec.isProfit
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}>
                            {rec.isProfit ? '+' : '-'}{formatAmount(Math.abs(rec.netProfit), currency)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRecord(rec);
                            }}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg font-bold text-[11px] transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer"
                            title="ဘောင်ချာများ စာရင်းကြည့်ရန်"
                          >
                            <Layers className="w-3 h-3" />
                            <span>{rec.vouchersCount} စောင်</span>
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
              
              {/* Metrics summary - 8 exact steps */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">၁။ မူလထိုးကြေး</span>
                  <span className="text-sm font-black font-mono text-slate-900">{formatAmount(selectedRecord.turnover, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-indigo-900 font-bold block uppercase">၂။ အထက်တင်ကြေး</span>
                  <span className="text-sm font-black font-mono text-indigo-900">{formatAmount(selectedRecord.totalForwarded, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800 font-bold block uppercase">၃။ အောက်လက်ကော်</span>
                  <span className="text-sm font-black font-mono text-amber-800">-{formatAmount(selectedRecord.agentCommission, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-sky-900 font-bold block uppercase">၄။ အမှန်ရောင်းငွေ</span>
                  <span className="text-sm font-black font-mono text-sky-950">{formatAmount(selectedRecord.netSales, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-800 font-bold block uppercase">၅။ အထက်ပေါက်ကြေး</span>
                  <span className="text-sm font-black font-mono text-emerald-800">+{formatAmount(selectedRecord.masterPayout, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-purple-800 font-bold block uppercase">၆။ အထက်ကော်မရှင်</span>
                  <span className="text-sm font-black font-mono text-purple-800">+{formatAmount(selectedRecord.forwardCommission, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-rose-700 font-bold block uppercase">၇။ ပေးလျှော်ငွေ</span>
                  <span className="text-sm font-black font-mono text-rose-700">-{formatAmount(selectedRecord.totalPayout, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-600 font-bold block uppercase">၈။ အသားတင်ရလဒ်</span>
                  <span className={`text-sm font-black font-mono px-1.5 py-0.5 rounded inline-block ${
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

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto divide-y divide-slate-100">
                  {(() => {
                    const vouchersToDisplay = selectedRecord.vouchersList || [];

                    if (vouchersToDisplay.length === 0) {
                      return <p className="p-4 text-center text-slate-400">ဤပွဲစဉ်အတွက် ဘောင်ချာမှတ်တမ်း မရှိပါ</p>;
                    }

                    return vouchersToDisplay.map((v: any, index: number) => {
                      const itemsStr = v.items ? v.items.map((it: any) => `${it.number}=${it.amount}`).join(', ') : (v.matchesSummary || v.description || '-');
                      const hasWonItem = v.items ? v.items.some((it: any) => it.isWon || it.number === selectedRecord.winningResult) : (v.status === 'settled' && (v.outcome === 'won' || v.outcome === 'half_won'));
                      const voucherDisc = v.discountAmount > 0 ? v.discountAmount : 0;
                      
                      return (
                        <div 
                          key={index} 
                          onClick={() => setInspectingVoucher(v)}
                          className="p-2.5 hover:bg-indigo-50/50 transition-colors flex items-center justify-between text-[11px] cursor-pointer group"
                          title="ဤဘောင်ချာအား အပြည့်အစုံ ဖွင့်ကြည့်ရန် နှိပ်ပါ"
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold font-mono text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {v.voucherNo || v.slipNo || `V-${index + 1}`}
                              </span>
                              <span className="text-slate-600 font-medium">({v.customerName || 'အထွေထွေ'})</span>
                              {hasWonItem && (
                                <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 font-black text-[9px] rounded-md animate-pulse">
                                  ★ ပေါက်မဲ
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-md">
                              {itemsStr}
                            </div>
                          </div>
                          <div className="text-right shrink-0 flex items-center gap-2">
                            <div>
                              <span className="font-bold font-mono text-slate-900 block">
                                {formatAmount(v.netPayable || v.subtotal || v.stakeAmount, currency)}
                              </span>
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
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectingVoucher(v);
                              }}
                              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 cursor-pointer shadow-xs transition-transform active:scale-95"
                              title="ဘောင်ချာအပြည့်အစုံ ကြည့်မည်"
                            >
                              <Eye className="w-3 h-3" />
                              <span className="hidden sm:inline">ကြည့်မည်</span>
                            </button>
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

      {/* Individual Single Voucher Slip Inspector Modal */}
      {inspectingVoucher && (
        <div className="fixed inset-0 z-[70] bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in zoom-in-95 duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col justify-between max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-teal-400" />
                <span className="font-black text-sm">
                  ဘောင်ချာ အသေးစိတ်စစ်ဆေးခြင်း ({inspectingVoucher.voucherNo || inspectingVoucher.slipNo})
                </span>
              </div>
              <button
                onClick={() => setInspectingVoucher(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Voucher Body (Printable Slip Styled) */}
            <div id="statement-single-voucher" className="p-4 overflow-y-auto space-y-3 text-xs bg-slate-50/50">
              {/* Slip Header */}
              <div className="text-center border-b border-slate-200 pb-2">
                <h3 className="font-black text-slate-900 text-sm">
                  {lottery2D.settings.shopName || lottery3D.settings.shopName || 'ရွှေမင်္ဂလာ'}
                </h3>
                <p className="text-[10px] text-slate-500 font-bold">
                  {selectedRecord?.modeLabel || 'အရောင်းဘောင်ချာ'} • {new Date(inspectingVoucher.createdAt).toLocaleString('en-GB')}
                </p>
                <div className="mt-1 inline-block px-2.5 py-0.5 bg-slate-900 text-white rounded-md font-mono font-bold text-xs">
                  {inspectingVoucher.voucherNo || inspectingVoucher.slipNo}
                </div>
              </div>

              {/* Customer info */}
              <div className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200 text-[11px]">
                <div>
                  <span className="text-slate-400 text-[10px] block">ဝယ်သူအမည်:</span>
                  <span className="font-bold text-slate-800">{inspectingVoucher.customerName || 'အထွေထွေ'}</span>
                </div>
                {inspectingVoucher.customerPhone && (
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] block">ဖုန်းနံပါတ်:</span>
                    <span className="font-bold text-slate-800 font-mono">{inspectingVoucher.customerPhone}</span>
                  </div>
                )}
              </div>

              {/* Items Table for 2D/3D */}
              {Array.isArray(inspectingVoucher.items) && inspectingVoucher.items.length > 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-1.5 px-2.5">စဉ်</th>
                        <th className="py-1.5 px-2.5">ဂဏန်း</th>
                        <th className="py-1.5 px-2.5">ပုံစံ</th>
                        <th className="py-1.5 px-2.5 text-right">ထိုးငွေ</th>
                        <th className="py-1.5 px-2.5 text-center">ပေါက်/မပေါက်</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {inspectingVoucher.items.map((it: any, idx: number) => {
                        const isWin = it.isWon || it.number === selectedRecord?.winningResult;
                        return (
                          <tr key={idx} className={isWin ? 'bg-amber-50/80 font-bold' : ''}>
                            <td className="py-1.5 px-2.5 text-slate-400 font-mono">{idx + 1}</td>
                            <td className="py-1.5 px-2.5 font-black font-mono text-slate-900 text-sm">
                              {it.number}
                            </td>
                            <td className="py-1.5 px-2.5 text-[10px] text-slate-500 font-bold">
                              {it.isRumble || it.betType === 'rumble' ? 'အာ (ပတ်)' : 'ဒဲ့'}
                            </td>
                            <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-800">
                              {formatAmount(it.amount, currency)}
                            </td>
                            <td className="py-1.5 px-2.5 text-center">
                              {isWin ? (
                                <span className="px-1.5 py-0.2 bg-rose-600 text-white font-black text-[9px] rounded">
                                  ပေါက် ✓
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Football Slip Details */
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 font-bold">ဘောလုံးလိုင်း:</span>
                    <span className="font-bold text-slate-900">{inspectingVoucher.slipType === 'body' ? 'ဘော်ဒီ' : 'မောင်း'}</span>
                  </div>
                  {inspectingVoucher.matchesSummary && (
                    <div className="p-2 bg-slate-50 rounded-lg text-[10px] font-mono text-slate-700 whitespace-pre-wrap">
                      {inspectingVoucher.matchesSummary}
                    </div>
                  )}
                </div>
              )}

              {/* Financial Calculation Breakdown */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
                <div className="flex justify-between items-center text-slate-600">
                  <span>၁။ မူလထိုးကြေး စုစုပေါင်း:</span>
                  <span className="font-bold font-mono text-slate-900">
                    {formatAmount(inspectingVoucher.subtotal || inspectingVoucher.stakeAmount || 0, currency)}
                  </span>
                </div>
                {inspectingVoucher.discountAmount > 0 && (
                  <div className="flex justify-between items-center text-amber-800">
                    <span>၂။ အောက်လက် ကော်မရှင်ခ ({inspectingVoucher.discountPercent || 0}%):</span>
                    <span className="font-bold font-mono">
                      -{formatAmount(inspectingVoucher.discountAmount, currency)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-slate-900 font-bold">
                  <span>၃။ အသားတင် ကျသင့်ငွေ (ပေးငွေ):</span>
                  <span className="text-sm font-black font-mono text-indigo-900">
                    {formatAmount(inspectingVoucher.netPayable || inspectingVoucher.subtotal || inspectingVoucher.stakeAmount || 0, currency)}
                  </span>
                </div>
                {inspectingVoucher.totalPayout > 0 && (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-rose-700 font-bold">
                    <span>★ ပေါက်မဲ ပေးလျော်ငွေ:</span>
                    <span className="text-sm font-black font-mono">
                      +{formatAmount(inspectingVoucher.totalPayout || inspectingVoucher.actualPayout || 0, currency)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Slip Action Buttons */}
            <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  const text = `🧾 ${lottery2D.settings.shopName || lottery3D.settings.shopName || 'ရွှေမင်္ဂလာ'}
ဘောင်ချာအမှတ်: ${inspectingVoucher.voucherNo || inspectingVoucher.slipNo}
ရက်စွဲ: ${new Date(inspectingVoucher.createdAt).toLocaleString('en-GB')}
ဝယ်သူ: ${inspectingVoucher.customerName || 'အထွေထွေ'}
--------------------------------
${Array.isArray(inspectingVoucher.items) ? inspectingVoucher.items.map((it: any) => `${it.number}=${it.amount}`).join('\n') : inspectingVoucher.matchesSummary || ''}
--------------------------------
မူလထိုးကြေး: ${formatAmount(inspectingVoucher.subtotal || inspectingVoucher.stakeAmount || 0, currency)}
${inspectingVoucher.discountAmount > 0 ? `အောက်လက်ကော်: -${formatAmount(inspectingVoucher.discountAmount, currency)}\n` : ''}အမှန်ပေးငွေ: ${formatAmount(inspectingVoucher.netPayable || inspectingVoucher.subtotal || inspectingVoucher.stakeAmount || 0, currency)}`;
                  navigator.clipboard.writeText(text);
                  setCopiedVoucherText(true);
                  setTimeout(() => setCopiedVoucherText(false), 2000);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedVoucherText ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Receipt className="w-3.5 h-3.5" />}
                <span>{copiedVoucherText ? 'ကူးပြီးပြီ ✓' : 'စာသား ကော်ပီ'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printStatementReport('statement-single-voucher', `ဘောင်ချာ - ${inspectingVoucher.voucherNo || inspectingVoucher.slipNo}`)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>ပရင့်ထုတ်</span>
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingVoucher(null)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs cursor-pointer"
                >
                  ပိတ်မည်
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
