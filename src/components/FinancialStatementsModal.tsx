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
  Award
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { formatAmount } from '../utils/lotteryUtils';
import { evaluateTwoDWinnings } from '../utils/twoDLotteryUtils';
import { evaluateWinnings } from '../utils/lotteryUtils';
import { printStatementReport } from '../utils/printUtils';
import { verifyOwnerPassword } from '../utils/securityUtils';
import { TwoDVoucher, Voucher, FootballSlip } from '../types';

interface FinancialStatementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'all' | '3d' | '2d' | 'football';
}

export interface StatementRecord {
  id: string;
  date: string;
  mode: '3d' | '2d' | 'football';
  modeLabel: string;
  name: string;
  session?: 'morning' | 'evening' | 'special';
  winningResult: string;
  turnover: number;
  discount: number;
  payout: number;
  commission: number;
  netProfit: number;
  isProfit: boolean;
  winnersCount: number;
  vouchersCount: number;
  status: 'settled' | 'open';
  rawRoundId?: string;
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
  const [periodPreset, setPeriodPreset] = useState<'all' | 'today' | 'three_days' | 'five_days' | 'week' | 'month' | 'custom'>('all');

  const [selectedRecord, setSelectedRecord] = useState<StatementRecord | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Helper to get date string N days ago in YYYY-MM-DD
  const getDaysAgoStr = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const threeDaysAgoStr = getDaysAgoStr(2); // 3 calendar days (today, yesterday, day before)
  const fiveDaysAgoStr = getDaysAgoStr(4);  // 5 calendar days
  const oneWeekAgoStr = getDaysAgoStr(6);   // 7 calendar days
  const oneMonthAgoStr = getDaysAgoStr(29); // 30 calendar days
  const allTimeStartStr = '2020-01-01';

  const [customStartDate, setCustomStartDate] = useState(oneWeekAgoStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  const currency = lottery2D.settings.currency || lottery3D.settings.currency || 'Ks';

  // Determine active date boundaries
  const { startDate, endDate } = useMemo(() => {
    if (periodPreset === 'all') {
      return { startDate: allTimeStartStr, endDate: todayStr };
    }
    if (periodPreset === 'today') {
      return { startDate: todayStr, endDate: todayStr };
    }
    if (periodPreset === 'three_days') {
      return { startDate: threeDaysAgoStr, endDate: todayStr };
    }
    if (periodPreset === 'five_days') {
      return { startDate: fiveDaysAgoStr, endDate: todayStr };
    }
    if (periodPreset === 'week') {
      return { startDate: oneWeekAgoStr, endDate: todayStr };
    }
    if (periodPreset === 'month') {
      return { startDate: oneMonthAgoStr, endDate: todayStr };
    }
    return { startDate: customStartDate, endDate: customEndDate };
  }, [periodPreset, todayStr, threeDaysAgoStr, fiveDaysAgoStr, oneWeekAgoStr, oneMonthAgoStr, customStartDate, customEndDate]);

  // Aggregate statement records from 2D, 3D, and Football
  const statementRecords: StatementRecord[] = useMemo(() => {
    const list: StatementRecord[] = [];

    // ====================================================
    // 1. Process 2D (ဇီးကွက်) Rounds & Vouchers
    // ====================================================
    if (selectedMode === 'all' || selectedMode === '2d') {
      const processedRoundIds = new Set<string>();

      lottery2D.rounds.forEach((round) => {
        const roundDate = (round.drawDate || '').slice(0, 10);
        if (roundDate >= startDate && roundDate <= endDate) {
          processedRoundIds.add(round.id);

          // Get vouchers belonging to this round
          const roundVouchers = lottery2D.vouchers.filter(
            (v) => (v.roundId === round.id || (!v.roundId && (v.createdAt || '').slice(0, 10) === roundDate)) &&
                   v.status !== 'cancelled'
          );

          // Get forward slips for this round
          const roundForwards = lottery2D.forwardSlips.filter(
            (f) => f.roundId === round.id || (f.createdAt || '').slice(0, 10) === roundDate
          );

          let totalTurnover = 0;
          let totalDiscount = 0;
          let netSales = 0;

          roundVouchers.forEach((v) => {
            const voucherSubtotal = v.subtotal ?? v.items.reduce((s, it) => s + (it.amount || 0), 0);
            const voucherDiscount = v.discountAmount ?? 0;
            const voucherNet = v.netPayable ?? (voucherSubtotal - voucherDiscount);

            totalTurnover += voucherSubtotal;
            totalDiscount += voucherDiscount;
            netSales += voucherNet;
          });

          // Forward slips & commission
          let totalForwarded = 0;
          let forwardCommission = 0;
          roundForwards.forEach((f) => {
            totalForwarded += f.totalAmount || 0;
            forwardCommission += f.commissionAmount || 0;
          });

          // Payout and Winners calculation
          let totalPayout = 0;
          let winnersCount = 0;

          const winningNum = round.winningNumber ? round.winningNumber.padStart(2, '0') : undefined;
          const mult = round.multiplier || lottery2D.settings.defaultMultiplier || 80;

          if (winningNum) {
            // Evaluate dynamically for 100% accuracy
            const evalResult = evaluateTwoDWinnings(roundVouchers, winningNum, mult);
            totalPayout = evalResult.totalPayout;
            winnersCount = evalResult.totalWinnersCount;
          } else {
            // Check if any voucher items have wonAmount set
            roundVouchers.forEach((v) => {
              v.items.forEach((it) => {
                if (it.isWon) {
                  totalPayout += (it.wonAmount || (it.amount * mult));
                  winnersCount += 1;
                }
              });
            });
          }

          // Total Commission earned = forwardCommission + total customer discount
          const totalCommission = forwardCommission > 0 ? forwardCommission : totalDiscount;

          // Net dealer profit = (Net Sales - Payout) + Forward Commission
          const netProfit = (netSales - totalPayout) + forwardCommission;

          list.push({
            id: `2d-${round.id}`,
            date: roundDate,
            mode: '2d',
            modeLabel: 'ဇီးကွက်',
            name: round.name || `${roundDate} ${round.session === 'morning' ? 'မနက် (12:01)' : 'ညနေ (04:30)'}`,
            session: round.session,
            winningResult: winningNum || (round.status === 'settled' ? 'ပေါက်မဲမရှိ' : 'မထွက်သေး'),
            turnover: totalTurnover,
            discount: totalDiscount,
            payout: totalPayout,
            commission: totalCommission,
            netProfit,
            isProfit: netProfit >= 0,
            winnersCount,
            vouchersCount: roundVouchers.length,
            status: round.status,
            rawRoundId: round.id
          });
        }
      });

      // Catch any orphaned vouchers with dates in range that didn't match a round
      const orphanedVouchers = lottery2D.vouchers.filter(v => {
        const vDate = (v.createdAt || '').slice(0, 10);
        return vDate >= startDate && vDate <= endDate && v.status !== 'cancelled' && (!v.roundId || !processedRoundIds.has(v.roundId));
      });

      if (orphanedVouchers.length > 0) {
        // Group by date
        const orphanedByDate: { [date: string]: TwoDVoucher[] } = {};
        orphanedVouchers.forEach(v => {
          const d = (v.createdAt || '').slice(0, 10) || todayStr;
          if (!orphanedByDate[d]) orphanedByDate[d] = [];
          orphanedByDate[d].push(v);
        });

        Object.keys(orphanedByDate).forEach(d => {
          const vList = orphanedByDate[d];
          let turnover = 0;
          let discount = 0;
          let netSales = 0;
          let payout = 0;
          let winnersCount = 0;

          vList.forEach(v => {
            const sub = v.subtotal ?? v.items.reduce((s, it) => s + (it.amount || 0), 0);
            const disc = v.discountAmount ?? 0;
            turnover += sub;
            discount += disc;
            netSales += (v.netPayable ?? (sub - disc));
            v.items.forEach(it => {
              if (it.isWon) {
                payout += (it.wonAmount || (it.amount * 80));
                winnersCount += 1;
              }
            });
          });

          const netProfit = netSales - payout;

          list.push({
            id: `2d-orphaned-${d}`,
            date: d,
            mode: '2d',
            modeLabel: 'ဇီးကွက်',
            name: `${d} ဇီးကွက် အရောင်းမှတ်တမ်းများ`,
            session: 'morning',
            winningResult: payout > 0 ? `${winnersCount} ဦးပေါက်` : 'မထွက်သေး',
            turnover,
            discount,
            payout,
            commission: discount,
            netProfit,
            isProfit: netProfit >= 0,
            winnersCount,
            vouchersCount: vList.length,
            status: payout > 0 ? 'settled' : 'open'
          });
        });
      }
    }

    // ====================================================
    // 2. Process 3D (အိုးစည်လေး) Rounds
    // ====================================================
    if (selectedMode === 'all' || selectedMode === '3d') {
      lottery3D.rounds.forEach((round) => {
        const roundDate = (round.drawDate || '').slice(0, 10);
        if (roundDate >= startDate && roundDate <= endDate) {
          const roundVouchers = lottery3D.vouchers.filter(
            (v) => (v.roundId === round.id || (!v.roundId && (v.createdAt || '').slice(0, 10) === roundDate)) &&
                   v.status !== 'cancelled'
          );

          const roundForwards = lottery3D.forwardSlips.filter(
            (f) => f.roundId === round.id || (f.createdAt || '').slice(0, 10) === roundDate
          );

          let totalTurnover = 0;
          let totalDiscount = 0;
          let netSales = 0;

          roundVouchers.forEach((v) => {
            const sub = v.subtotal ?? v.items.reduce((s, it) => s + (it.amount || 0), 0);
            const disc = v.discountAmount ?? 0;
            totalTurnover += sub;
            totalDiscount += disc;
            netSales += (v.netPayable ?? (sub - disc));
          });

          let forwardCommission = 0;
          roundForwards.forEach((f) => {
            forwardCommission += f.commissionAmount || 0;
          });

          let totalPayout = 0;
          let winnersCount = 0;

          const winningNum = round.winningNumber ? round.winningNumber.padStart(3, '0') : undefined;
          const straightMult = round.multiplier || lottery3D.settings.defaultMultiplier || 600;
          const toddMult = round.toddMultiplier || lottery3D.settings.defaultToddMultiplier || 100;

          if (winningNum) {
            const evalResult = evaluateWinnings(roundVouchers, winningNum, straightMult, toddMult);
            totalPayout = evalResult.totalPayout;
            winnersCount = evalResult.winningBetsCount + evalResult.toddWinningBetsCount;
          } else {
            roundVouchers.forEach((v) => {
              v.items.forEach((it) => {
                if (it.isWon) {
                  totalPayout += (it.wonAmount || (it.amount * straightMult));
                  winnersCount += 1;
                }
              });
            });
          }

          const totalCommission = forwardCommission > 0 ? forwardCommission : totalDiscount;
          const netProfit = (netSales - totalPayout) + forwardCommission;

          list.push({
            id: `3d-${round.id}`,
            date: roundDate,
            mode: '3d',
            modeLabel: 'အိုးစည်လေး',
            name: round.name || `${roundDate} ထီဖွင့်ပွဲ`,
            winningResult: winningNum || (round.status === 'settled' ? 'ပေါက်မဲမရှိ' : 'မထွက်သေး'),
            turnover: totalTurnover,
            discount: totalDiscount,
            payout: totalPayout,
            commission: totalCommission,
            netProfit,
            isProfit: netProfit >= 0,
            winnersCount,
            vouchersCount: roundVouchers.length,
            status: round.status,
            rawRoundId: round.id
          });
        }
      });
    }

    // ====================================================
    // 3. Process Football (ပစ်တိုင်းထောင်)
    // ====================================================
    if (selectedMode === 'all' || selectedMode === 'football') {
      const slips = football.slips.filter((s) => {
        const slipDate = (s.createdAt || s.roundDate || '').slice(0, 10);
        return slipDate >= startDate && slipDate <= endDate && s.status !== 'cancelled';
      });

      if (slips.length > 0) {
        // Group football slips by date
        const slipsByDate: { [date: string]: FootballSlip[] } = {};
        slips.forEach((s) => {
          const d = (s.createdAt || s.roundDate || '').slice(0, 10) || todayStr;
          if (!slipsByDate[d]) slipsByDate[d] = [];
          slipsByDate[d].push(s);
        });

        Object.keys(slipsByDate).forEach((d) => {
          const daySlips = slipsByDate[d];
          let turnover = 0;
          let discount = 0;
          let netSales = 0;
          let payout = 0;
          let winnersCount = 0;

          daySlips.forEach((s) => {
            const stake = s.stakeAmount || s.netPayable || 0;
            const disc = s.discountAmount || 0;
            turnover += stake;
            discount += disc;
            netSales += (s.netPayable || (stake - disc));

            if (s.status === 'settled' || s.outcome === 'won' || s.outcome === 'half_won') {
              payout += (s.actualPayout || s.potentialPayout || 0);
              winnersCount += 1;
            }
          });

          const dayForwards = football.forwardSlips.filter((f) => (f.createdAt || f.roundDate || '').slice(0, 10) === d);
          let forwardCommission = 0;
          dayForwards.forEach((f) => {
            forwardCommission += f.commissionAmount || 0;
          });

          const totalCommission = forwardCommission > 0 ? forwardCommission : discount;
          const netProfit = (netSales - payout) + forwardCommission;

          list.push({
            id: `football-${d}`,
            date: d,
            mode: 'football',
            modeLabel: 'ပစ်တိုင်းထောင်',
            name: `${d} ပစ်တိုင်းထောင် မောင်း/ဘော်ဒီ ရှင်းတမ်း`,
            winningResult: winnersCount > 0 ? `${winnersCount} စလစ် ပေါက်` : 'စလစ်အားလုံး ရှင်းပြီး',
            turnover,
            discount,
            payout,
            commission: totalCommission,
            netProfit,
            isProfit: netProfit >= 0,
            winnersCount,
            vouchersCount: daySlips.length,
            status: 'settled'
          });
        });
      }
    }

    // Sort all records by Date descending
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    selectedMode,
    startDate,
    endDate,
    lottery2D.rounds,
    lottery2D.vouchers,
    lottery2D.forwardSlips,
    lottery2D.settings.defaultMultiplier,
    lottery3D.rounds,
    lottery3D.vouchers,
    lottery3D.forwardSlips,
    lottery3D.settings.defaultMultiplier,
    lottery3D.settings.defaultToddMultiplier,
    football.slips,
    football.forwardSlips,
    todayStr
  ]);

  // Grand Totals across all statement records in the filtered period
  const grandTotals = useMemo(() => {
    let totalTurnover = 0;
    let totalDiscount = 0;
    let totalPayout = 0;
    let totalCommission = 0;
    let totalVouchers = 0;
    let totalWinners = 0;

    statementRecords.forEach((r) => {
      totalTurnover += r.turnover;
      totalDiscount += r.discount;
      totalPayout += r.payout;
      totalCommission += r.commission;
      totalVouchers += r.vouchersCount;
      totalWinners += r.winnersCount;
    });

    const netSales = totalTurnover - totalDiscount;
    const netProfit = (netSales - totalPayout) + totalCommission;
    const profitMargin = totalTurnover > 0 ? ((netProfit / totalTurnover) * 100).toFixed(1) : '0.0';

    return {
      totalTurnover,
      totalDiscount,
      netSales,
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
      'အသားတင် အမြတ်/အရှုံး (ကျပ်)': (r.isProfit ? '+' : '-') + Math.abs(r.netProfit),
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
      'အသားတင် အမြတ်/အရှုံး (ကျပ်)': (grandTotals.isProfit ? '+' : '-') + Math.abs(grandTotals.netProfit),
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

  // Delete statement record handler
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
        lottery3D.deleteRound(roundId);
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
        const slipsToDelete = football.slips.filter((s) => (s.createdAt || s.roundDate || '').slice(0, 10) === slipDate);
        slipsToDelete.forEach((s) => football.deleteSlip(s.id));
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
            <div className="w-8 h-8 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center font-bold">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white leading-tight">
                ကာလအလိုက် စာရင်းရှင်းတမ်း & အမြတ်/အရှုံး အစီရင်ခံစာ
              </h3>
              <p className="text-[10px] text-slate-400">
                ၃ ရက်စာ၊ ၁ ပတ်စာ၊ ၁ လစာ စာရင်းရှင်းတမ်းများ၊ ထိုးကြေး၊ အလျော်နှင့် အသားတင်အမြတ်/အရှုံး
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
                onClick={() => setPeriodPreset('all')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  periodPreset === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                အားလုံး (All)
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('today')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  periodPreset === 'today' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ဒီနေ့
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('three_days')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  periodPreset === 'three_days' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ၃ ရက်စာ
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('five_days')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  periodPreset === 'five_days' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ၅ ရက်စာ
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('week')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  periodPreset === 'week' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ၁ ပတ်စာ
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('month')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  periodPreset === 'month' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ၁ လစာ
              </button>
              <button
                type="button"
                onClick={() => setPeriodPreset('custom')}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                  periodPreset === 'custom' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
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
              {periodPreset === 'all' ? 'မှတ်တမ်းအားလုံး ချုပ်' :
               periodPreset === 'today' ? 'ဒီနေ့ စာရင်းရှင်းတမ်း' :
               periodPreset === 'three_days' ? '၃ ရက်စာ စာရင်းရှင်းတမ်း' :
               periodPreset === 'five_days' ? '၅ ရက်စာ စာရင်းရှင်းတမ်း' :
               periodPreset === 'week' ? '၁ ပတ်စာ စာရင်းရှင်းတမ်း' :
               periodPreset === 'month' ? '၁ လစာ စာရင်းရှင်းတမ်း' : 'ရက်ရွေး စာရင်းရှင်းတမ်း'} 
              {' '}({startDate === allTimeStartStr ? 'စတင်ချိန်' : startDate} မှ {endDate} အထိ)
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              အမျိုးအစား: {selectedMode === 'all' ? 'လုပ်ငန်းအားလုံးချုပ်' : selectedMode === '3d' ? 'အိုးစည်လေး (3D)' : selectedMode === '2d' ? 'ဇီးကွက် (2D)' : 'ပစ်တိုင်းထောင် (ဘောလုံး)'}
            </p>
          </div>
          
          {/* Top 4 Hero Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            
            {/* 1. Total Turnover (ထိုးကြေး/ရောင်းရငွေ) */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-slate-500 block mb-0.5">
                ၁။ စုစုပေါင်း ထိုးကြေး / ရောင်းရငွေ
              </span>
              <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {formatAmount(grandTotals.totalTurnover, currency)}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                ဘောင်ချာ {grandTotals.totalVouchers} စောင် ({statementRecords.length} ပွဲစဉ်)
              </span>
            </div>

            {/* 2. Total Payout (လျော်ကြေး) */}
            <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-rose-700 block mb-0.5">
                ၂။ စုစုပေါင်း ပေးလျော်ငွေ
              </span>
              <div className="text-xl sm:text-2xl font-black text-rose-700 font-mono">
                {formatAmount(grandTotals.totalPayout, currency)}
              </div>
              <span className="text-[10px] text-rose-600 mt-0.5 block font-bold">
                ပေါက်သူ {grandTotals.totalWinners} ဦး
              </span>
            </div>

            {/* 3. Total Commission (ကော်မရှင်) */}
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-indigo-700 block mb-0.5">
                ၃။ ကော်မရှင် စုစုပေါင်းရငွေ
              </span>
              <div className="text-xl sm:text-2xl font-black text-indigo-900 font-mono">
                +{formatAmount(grandTotals.totalCommission, currency)}
              </div>
              <span className="text-[10px] text-indigo-600 mt-0.5 block font-medium">
                ဒိုင်ကြီးလွှဲ / လျှော့ငွေ စုစုပေါင်း
              </span>
            </div>

            {/* 4. Net Profit / Loss (အသားတင် အမြတ်/အရှုံး) */}
            <div className={`rounded-2xl p-3.5 border shadow-2xs ${
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
                  <TrendingUp className="w-5 h-5 shrink-0 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 shrink-0 text-rose-600" />
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
                <span>ပွဲစဉ်အလိုက် အသေးစိတ် စာရင်းရှင်းတမ်း မှတ်တမ်းများ ({statementRecords.length} ခု)</span>
              </span>
              <span className="text-[10px] text-slate-300 font-bold">
                {periodPreset === 'all' ? 'မှတ်တမ်းအားလုံး' : `${startDate} မှ ${endDate} အထိ`}
              </span>
            </div>

            <div className="overflow-x-auto max-h-80 divide-y divide-slate-100">
              {statementRecords.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-1">
                  <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-600">ရွေးချယ်ထားသော ကာလအတွင်း ရှင်းတမ်းမှတ်တမ်း မရှိသေးပါ</p>
                  <p className="text-[11px] text-slate-400">"အားလုံး (All)" ခလုတ်ကို နှိပ်၍ ယခင်ထည့်သွင်းထားသော စာရင်းများကို ကြည့်ရှုနိုင်ပါသည်</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">ရက်စွဲ / အချိန်</th>
                      <th className="py-2.5 px-3">ပွဲစဉ် / လိုင်း</th>
                      <th className="py-2.5 px-3 text-center">ပေါက်ဂဏန်း</th>
                      <th className="py-2.5 px-3 text-right">ထိုးကြေး (ရောင်းရ)</th>
                      <th className="py-2.5 px-3 text-right">ပေးလျော်ငွေ</th>
                      <th className="py-2.5 px-3 text-right">ကော်မရှင်</th>
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
                          {rec.commission > 0 ? `+${formatAmount(rec.commission, currency)}` : '-'}
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">ထိုးကြေး (ရောင်းရ)</span>
                  <span className="text-sm font-black font-mono text-slate-900">{formatAmount(selectedRecord.turnover, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-rose-600 font-bold block uppercase">ပေးလျော်ငွေ</span>
                  <span className="text-sm font-black font-mono text-rose-700">{formatAmount(selectedRecord.payout, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-indigo-600 font-bold block uppercase">ကော်မရှင် ရငွေ</span>
                  <span className="text-sm font-black font-mono text-indigo-700">+{formatAmount(selectedRecord.commission, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">အသားတင် ရလဒ်</span>
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
                      
                      return (
                        <div key={index} className="p-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-[11px]">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold font-mono text-slate-900">{v.voucherNo || v.slipNo}</span>
                              <span className="text-slate-600 font-medium">({v.customerName})</span>
                              {hasWonItem && (
                                <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 font-black text-[9px] rounded-md animate-pulse">
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
                            <span className={`text-[10px] ${v.isPaid ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                              {v.isPaid ? 'ရှင်းပြီး ✓' : 'ကြွေးကျန်'}
                            </span>
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
