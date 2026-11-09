import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  DollarSign,
  Printer,
  FileSpreadsheet,
  Users,
  Shield,
  Percent,
  CheckCircle2,
  Clock,
  ArrowRight,
  Wallet,
  Copy,
  Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { formatAmount } from '../utils/lotteryUtils';
import { getLocalDateStr, getDaysAgoStr, generateStatementRecords } from '../utils/statementUtils';
import { getCustomerCommission } from '../utils/commissionUtils';
import { printStatementReport } from '../utils/printUtils';

interface PeriodSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PeriodSettlementModal: React.FC<PeriodSettlementModalProps> = ({ isOpen, onClose }) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  const currency = lottery2D.settings.currency || lottery3D.settings.currency || 'Ks';
  const defaultCommission = lottery3D.settings.defaultCommissionRate;

  // Mode: downline (အောက်လက်ဒိုင်ငယ်/ဖောက်သည်) or upline (အထက်ဒိုင်/မာစတာဒိုင်)
  const [settlementType, setSettlementType] = useState<'downline' | 'upline'>('downline');

  // Date boundaries
  const todayStr = getLocalDateStr();
  const fiveDaysAgoStr = getDaysAgoStr(4);
  const [startDate, setStartDate] = useState(fiveDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [customCommissionRate, setCustomCommissionRate] = useState<number>(defaultCommission);
  const [copiedStatementText, setCopiedStatementText] = useState(false);

  // Load/save customer custom commission rates in localStorage
  const commissionStorageKey = 'shwe_customer_commissions_v1';
  const customerCommissions = useMemo(() => {
    try {
      const saved = localStorage.getItem(commissionStorageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  }, []);

  // When selected target changes for downline, load its saved custom commission rate if any
  React.useEffect(() => {
    if (settlementType === 'downline' && selectedTarget) {
      if (customerCommissions[selectedTarget] !== undefined) {
        setCustomCommissionRate(customerCommissions[selectedTarget]);
      } else {
        setCustomCommissionRate(defaultCommission);
      }
    }
  }, [selectedTarget, settlementType, defaultCommission, customerCommissions]);

  const handleSaveCustomerCommission = (name: string, rate: number) => {
    try {
      const updated = { ...customerCommissions, [name]: rate };
      localStorage.setItem(commissionStorageKey, JSON.stringify(updated));
      setCustomCommissionRate(rate);
      alert(`"${name}" အတွက် ကော်မရှင်နှုန်း ${rate}% အား အောင်မြင်စွာ မှတ်သားပြီးပါပြီ ✓`);
    } catch {}
  };

  // 1. Gather all unique Downline Customer Names
  const downlineNames = useMemo(() => {
    const set = new Set<string>();
    lottery3D.vouchers.forEach((v) => {
      if (v.customerName && v.customerName.trim()) set.add(v.customerName.trim());
    });
    lottery2D.vouchers.forEach((v) => {
      if (v.customerName && v.customerName.trim()) set.add(v.customerName.trim());
    });
    football.slips.forEach((s) => {
      if (s.customerName && s.customerName.trim()) set.add(s.customerName.trim());
    });
    return Array.from(set).sort();
  }, [lottery3D.vouchers, lottery2D.vouchers, football.slips]);

  // 2. Gather all unique Upline Master Agent Names
  const uplineNames = useMemo(() => {
    const set = new Set<string>();
    lottery3D.forwardSlips.forEach((f) => {
      if (f.masterAgentName && f.masterAgentName.trim()) set.add(f.masterAgentName.trim());
    });
    lottery2D.forwardSlips.forEach((f) => {
      if (f.masterAgentName && f.masterAgentName.trim()) set.add(f.masterAgentName.trim());
    });
    football.forwardSlips.forEach((f) => {
      if (f.masterAgentName && f.masterAgentName.trim()) set.add(f.masterAgentName.trim());
    });
    try {
      const savedAgents = localStorage.getItem('shwe_master_agents_list');
      if (savedAgents) {
        const parsed = JSON.parse(savedAgents);
        if (Array.isArray(parsed)) {
          parsed.forEach((a: any) => {
            if (a.name) set.add(a.name.trim());
          });
        }
      }
    } catch {}
    return Array.from(set).sort();
  }, [lottery3D.forwardSlips, lottery2D.forwardSlips, football.forwardSlips]);

  // Set default target if empty
  React.useEffect(() => {
    if (settlementType === 'downline' && downlineNames.length > 0 && !selectedTarget) {
      setSelectedTarget(downlineNames[0]);
    } else if (settlementType === 'upline' && uplineNames.length > 0 && !selectedTarget) {
      setSelectedTarget(uplineNames[0]);
    }
  }, [settlementType, downlineNames, uplineNames, selectedTarget]);

  // Quick preset handlers
  const applyPreset = (days: number) => {
    const end = getLocalDateStr();
    const start = getDaysAgoStr(days - 1);
    setStartDate(start);
    setEndDate(end);
  };

  // ---------------------------------------------------------------------------
  // SETTLEMENT COMPUTATION FOR DOWNLINE (VOUCHERS)
  // ---------------------------------------------------------------------------
  const downlineSettlementData = useMemo(() => {
    if (!selectedTarget) return { totalSales: 0, totalCommission: 0, totalPayout: 0, netBalance: 0, items: [] };

    let totalSales = 0;
    let totalPayout = 0;
    const dayGroupMap: Record<string, {
      date: string;
      mode: string;
      amount: number;
      payout: number;
      itemsCount: number;
      summaries: string[];
      winningNumbers: string[];
      winningBets: Array<{ num: string; amt: number; wonAmt: number }>;
    }> = {};

    const addRecord = (
      date: string,
      mode: string,
      amount: number,
      payout: number,
      summary: string,
      winningNumber?: string,
      wonBets?: Array<{ num: string; amt: number; wonAmt: number }>
    ) => {
      const key = `${date}|${mode}`;
      if (!dayGroupMap[key]) {
        dayGroupMap[key] = {
          date,
          mode,
          amount: 0,
          payout: 0,
          itemsCount: 0,
          summaries: [],
          winningNumbers: [],
          winningBets: []
        };
      }
      dayGroupMap[key].amount += amount;
      dayGroupMap[key].payout += payout;
      dayGroupMap[key].itemsCount += 1;
      if (summary && summary !== '-') {
        dayGroupMap[key].summaries.push(summary);
      }
      if (winningNumber && !dayGroupMap[key].winningNumbers.includes(winningNumber)) {
        dayGroupMap[key].winningNumbers.push(winningNumber);
      }
      if (wonBets && wonBets.length > 0) {
        wonBets.forEach(wb => {
          const existing = dayGroupMap[key].winningBets.find(x => x.num === wb.num);
          if (existing) {
            existing.amt += wb.amt;
            existing.wonAmt += wb.wonAmt;
          } else {
            dayGroupMap[key].winningBets.push({ ...wb });
          }
        });
      }
    };

    // 3D Vouchers
    lottery3D.vouchers.forEach((v: any) => {
      const vDate = (v.createdAt || '').slice(0, 10);
      if (vDate >= startDate && vDate <= endDate && v.customerName?.trim() === selectedTarget) {
        const amt = v.subtotal ?? v.netPayable ?? 0;
        const round = lottery3D.rounds.find(r => r.id === v.roundId);
        const winningNum = round?.winningNumber;
        const mult = round?.multiplier || lottery3D.settings.defaultMultiplier || 600;

        let payout = v.winningPayout ?? 0;
        const wonBets: Array<{ num: string; amt: number; wonAmt: number }> = [];

        if (v.items) {
          v.items.forEach((it: any) => {
            const isHit = it.isWon || (winningNum && it.number === winningNum);
            if (isHit) {
              const won = it.wonAmount || (it.amount * mult);
              payout += won;
              wonBets.push({ num: it.number, amt: it.amount, wonAmt: won });
            }
          });
        }
        totalSales += amt;
        totalPayout += payout;
        const sumText = v.items ? v.items.map((i: any) => `${i.number}(${i.amount})`).join(', ') : '-';
        addRecord(vDate, 'အိုးစည်လေး (3D)', amt, payout, sumText, winningNum, wonBets);
      }
    });

    // 2D Vouchers
    lottery2D.vouchers.forEach((v: any) => {
      const vDate = (v.createdAt || '').slice(0, 10);
      if (vDate >= startDate && vDate <= endDate && v.customerName?.trim() === selectedTarget) {
        const round = lottery2D.rounds.find(r => r.id === v.roundId);
        const sessionLabel = round?.session === 'morning' ? 'မနက်' : round?.session === 'evening' ? 'ညနေ' : '2D';
        const amt = v.subtotal ?? v.netPayable ?? 0;
        const winningNum = round?.winningNumber;
        const mult = round?.multiplier || lottery2D.settings.defaultMultiplier || 80;

        let payout = v.winningPayout ?? 0;
        const wonBets: Array<{ num: string; amt: number; wonAmt: number }> = [];

        if (v.items) {
          v.items.forEach((it: any) => {
            const isHit = it.isWon || (winningNum && it.number === winningNum);
            if (isHit) {
              const won = it.wonAmount || (it.amount * mult);
              payout += won;
              wonBets.push({ num: it.number, amt: it.amount, wonAmt: won });
            }
          });
        }
        totalSales += amt;
        totalPayout += payout;
        const sumText = v.items ? v.items.map((i: any) => `${i.number}(${i.amount})`).join(', ') : '-';
        addRecord(vDate, `ဇီးကွက် (${sessionLabel})`, amt, payout, sumText, winningNum, wonBets);
      }
    });

    // Football Slips
    football.slips.forEach((s: any) => {
      const sDate = s.roundDate || (s.createdAt || '').slice(0, 10);
      if (sDate >= startDate && sDate <= endDate && s.customerName?.trim() === selectedTarget) {
        const amt = s.stakeAmount || s.netPayable || 0;
        const payout = s.winningPayout || 0;
        totalSales += amt;
        totalPayout += payout;
        const sumText = s.selections ? s.selections.map((sel: any) => sel.matchSummary).join(', ') : '-';
        addRecord(sDate, 'ပစ်တိုင်းထောင်', amt, payout, sumText);
      }
    });

    const items = Object.values(dayGroupMap).map(g => ({
      date: g.date,
      mode: g.mode,
      refNo: `${g.itemsCount} ဘောင်ချာ`,
      amount: g.amount,
      payout: g.payout,
      winningNumbers: g.winningNumbers,
      winningBets: g.winningBets,
      summary: g.summaries.join(' | ') || '-'
    }));

    const commissionRate = getCustomerCommission(selectedTarget, customCommissionRate);
    const totalCommission = Math.round((totalSales * commissionRate) / 100);
    const netBalance = (totalSales - totalCommission) - totalPayout;

    return {
      totalSales,
      totalCommission,
      totalPayout,
      netBalance,
      items: items.sort((a, b) => b.date.localeCompare(a.date))
    };
  }, [selectedTarget, startDate, endDate, customCommissionRate, lottery3D.vouchers, lottery2D.vouchers, lottery2D.rounds, football.slips]);

  // ---------------------------------------------------------------------------
  // SETTLEMENT COMPUTATION FOR UPLINE (FORWARD SLIPS via generateStatementRecords)
  // ---------------------------------------------------------------------------
  const uplineSettlementData = useMemo(() => {
    if (!selectedTarget) return { totalForwarded: 0, totalCommission: 0, totalPayout: 0, netBalance: 0, items: [] };

    const dataSources = {
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
    };

    const records = generateStatementRecords(dataSources, 'all', startDate, endDate);

    let totalForwarded = 0;
    let totalCommission = 0;
    let totalPayout = 0;
    const items: Array<{ date: string; mode: string; refNo: string; amount: number; commission: number; payout: number; summary: string }> = [];

    records.forEach((rec) => {
      const forwards = rec.forwardList || [];
      const targetForwards = forwards.filter((f: any) => f.masterAgentName?.trim() === selectedTarget);

      if (targetForwards.length > 0) {
        let recAgentForwarded = 0;
        let recAgentCommission = 0;
        targetForwards.forEach((f: any) => {
          recAgentForwarded += f.totalAmount || 0;
          recAgentCommission += f.commissionAmount || 0;
        });

        // Proportionate master payout (အထက်ပေါက်ကြေး) for this agent in this record
        let recAgentPayout = 0;
        if (rec.totalForwarded > 0 && rec.masterPayout > 0) {
          recAgentPayout = Math.round((recAgentForwarded / rec.totalForwarded) * rec.masterPayout);
        }

        totalForwarded += recAgentForwarded;
        totalCommission += recAgentCommission;
        totalPayout += recAgentPayout;

        items.push({
          date: rec.date,
          mode: rec.modeLabel,
          refNo: rec.name,
          amount: recAgentForwarded,
          commission: recAgentCommission,
          payout: recAgentPayout,
          summary: `ရလဒ်: ${rec.winningResult} (တင်ကြေး: ${recAgentForwarded}, ပေါက်ကြေးရရန်: ${recAgentPayout})`
        });
      }
    });

    const netBalance = (totalForwarded - totalCommission) - totalPayout;

    return {
      totalForwarded,
      totalCommission,
      totalPayout,
      netBalance,
      items: items.sort((a, b) => b.date.localeCompare(a.date))
    };
  }, [selectedTarget, startDate, endDate, lottery2D.rounds, lottery2D.vouchers, lottery2D.forwardSlips, lottery2D.settings, lottery3D.rounds, lottery3D.vouchers, lottery3D.forwardSlips, lottery3D.settings, football.slips, football.forwardSlips, football.settings]);

  // Export to Excel
  const handleExportExcel = () => {
    if (settlementType === 'downline') {
      const data = downlineSettlementData.items.map((item, idx) => ({
        'စဉ်': idx + 1,
        'ရက်စွဲ': item.date,
        'လုပ်ငန်းလိုင်း': item.mode,
        'ဘောက်ချာနံပါတ်': item.refNo,
        'ထိုးငွေ (ကျပ်)': item.amount,
        'ပေါက်ကြေး (ကျပ်)': item.payout,
        'အသေးစိတ်': item.summary
      }));

      data.push({
        'စဉ်': 0 as any,
        'ရက်စွဲ': 'စုစုပေါင်း ချုပ်',
        'လုပ်ငန်းလိုင်း': '-',
        'ဘောက်ချာနံပါတ်': `ဒိုင်ငယ်: ${selectedTarget}`,
        'ထိုးငွေ (ကျပ်)': downlineSettlementData.totalSales,
        'ပေါက်ကြေး (ကျပ်)': downlineSettlementData.totalPayout,
        'အသေးစိတ်': `ကော်မရှင် (${customCommissionRate}%): ${downlineSettlementData.totalCommission}`
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Downline_Settlement');
      XLSX.writeFile(wb, `အောက်လက်ရှင်းတမ်း_${selectedTarget}_${startDate}_မှ_${endDate}.xlsx`);
    } else {
      const data = uplineSettlementData.items.map((item, idx) => ({
        'စဉ်': idx + 1,
        'ရက်စွဲ': item.date,
        'လုပ်ငန်းလိုင်း': item.mode,
        'လွှဲစာရင်းနံပါတ်': item.refNo,
        'တင်ကြေး (ကျပ်)': item.amount,
        'ကော်မရှင် (ကျပ်)': item.commission,
        'ပေါက်ကြေး (ကျပ်)': item.payout,
        'အသေးစိတ်': item.summary
      }));

      data.push({
        'စဉ်': 0 as any,
        'ရက်စွဲ': 'စုစုပေါင်း ချုပ်',
        'လုပ်ငန်းလိုင်း': '-',
        'လွှဲစာရင်းနံပါတ်': `အထက်ဒိုင်: ${selectedTarget}`,
        'တင်ကြေး (ကျပ်)': uplineSettlementData.totalForwarded,
        'ကော်မရှင် (ကျပ်)': uplineSettlementData.totalCommission,
        'ပေါက်ကြေး (ကျပ်)': uplineSettlementData.totalPayout,
        'အသေးစိတ်': `အသားတင်ရှင်းရန်: ${uplineSettlementData.netBalance}`
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Upline_Settlement');
      XLSX.writeFile(wb, `အထက်ဒိုင်ရှင်းတမ်း_${selectedTarget}_${startDate}_မှ_${endDate}.xlsx`);
    }
  };

  const handlePrint = () => {
    printStatementReport('printable-period-settlement', 'ကာလအလိုက် စာရင်းရှင်းတမ်း အစီရင်ခံစာ');
  };

  const handleCopyText = () => {
    const isDownline = settlementType === 'downline';
    const targetName = selectedTarget || '-';
    const totalSalesOrForward = isDownline ? downlineSettlementData.totalSales : uplineSettlementData.totalForwarded;
    const totalComm = isDownline ? downlineSettlementData.totalCommission : uplineSettlementData.totalCommission;
    const netSales = isDownline ? (downlineSettlementData.totalSales - downlineSettlementData.totalCommission) : (uplineSettlementData.totalForwarded - uplineSettlementData.totalCommission);
    const totalPayout = isDownline ? downlineSettlementData.totalPayout : uplineSettlementData.totalPayout;
    const netBal = isDownline ? downlineSettlementData.netBalance : uplineSettlementData.netBalance;

    let text = `${isDownline ? 'အောက်လက်ဒိုင်ငယ် ရှင်းတမ်း' : 'အထက်ဒိုင်ကြီး ရှင်းတမ်း'}\n`;
    text += `အမည်: ${targetName}\n`;
    text += `ကာလ: ${startDate} မှ ${endDate} အထိ\n`;
    text += `------------------------------------\n`;

    const items = isDownline ? downlineSettlementData.items : uplineSettlementData.items;
    items.forEach((item: any) => {
      text += `${item.date} (${item.mode}) - ထိုး/တင်: ${formatAmount(Number(item.amount), '')}`;
      if (item.winningNumbers && item.winningNumbers.length > 0) {
        text += ` [ထွက်ဂဏန်း: ${item.winningNumbers.join(', ')}]`;
      }
      if (item.commission) text += `, ကော်: ${formatAmount(Number(item.commission), '')}`;
      if (item.payout > 0) {
        text += `, ပေါက်ကြေး: ${formatAmount(Number(item.payout), '')} Ks`;
        if (item.winningBets && item.winningBets.length > 0) {
          const wDetail = item.winningBets.map((wb: any) => `${wb.num} ${formatAmount(wb.amt, '')}P`).join(', ');
          text += ` [${wDetail}]`;
        }
      }
      text += `\n`;
    });

    text += `------------------------------------\n`;
    text += `စုစုပေါင်း ${isDownline ? 'ထိုးကြေး' : 'တင်ကြေး'}: ${formatAmount(totalSalesOrForward, currency)}\n`;
    text += `နုတ် - ကော်မရှင်: - ${formatAmount(totalComm, currency)}\n`;
    text += `အမှန်ရောင်းငွေ / ကျန်ငွေ: ${formatAmount(netSales, currency)}\n`;
    text += `နုတ် - ပေါက်ကြေး: - ${formatAmount(totalPayout, currency)}P\n`;
    text += `နောက်ဆုံး ${isDownline ? (netBal >= 0 ? 'ရရန်ငွေ (Receive)' : 'ပေးရန်ငွေ (Pay)') : (netBal >= 0 ? 'အထက်ဒိုင်သို့ ပေးရန်' : 'အထက်ဒိုင်မှ ရရန်')}: ${formatAmount(Math.abs(netBal), currency)}\n`;

    navigator.clipboard.writeText(text);
    setCopiedStatementText(true);
    setTimeout(() => setCopiedStatementText(false), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col justify-between overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold border border-teal-500/30">
              <Wallet className="w-5 h-5 text-teal-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide">
                ကာလအလိုက် အကြွေးစာရင်းရှင်းတမ်း (Period Settlement)
              </h2>
              <span className="text-xs font-bold text-slate-400">
                ၅ ရက်စာ (တနင်္လာမှ သောကြာ) အထက်ဒိုင်နှင့် အောက်လက်ဒိုင်ငယ်များ ရှင်းတမ်း
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-6 flex-1">
          
          {/* Top Switcher: Downline vs Upline */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setSettlementType('downline');
                setSelectedTarget(downlineNames[0] || '');
              }}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                settlementType === 'downline'
                  ? 'bg-teal-700 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>အောက်လက် (ဒိုင်ငယ်/ထိုးသား) ရှင်းတမ်း</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSettlementType('upline');
                setSelectedTarget(uplineNames[0] || '');
              }}
              className={`py-2 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                settlementType === 'upline'
                  ? 'bg-indigo-700 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>အထက်ဒိုင် (Master Agent) ရှင်းတမ်း</span>
            </button>
          </div>

          {/* Filter Bar: Target Selection & Date Range */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 sm:p-4 grid grid-cols-1 md:grid-cols-3 gap-3.5 items-end">
            
            {/* Target Select */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {settlementType === 'downline' ? 'ဒိုင်ငယ် / ဖောက်သည် အမည်' : 'အထက်ဒိုင် အမည်'}
              </label>
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/30 outline-none"
              >
                {settlementType === 'downline' ? (
                  downlineNames.length === 0 ? (
                    <option value="">ထိုးသား အမည် မရှိသေးပါ</option>
                  ) : (
                    downlineNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))
                  )
                ) : (
                  uplineNames.length === 0 ? (
                    <option value="">အထက်ဒိုင် အမည် မရှိသေးပါ</option>
                  ) : (
                    uplineNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))
                  )
                )}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">စတင်မည့်ရက် (Start Date)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/30 outline-none"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ပြီးဆုံးမည့်ရက် (End Date)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono font-bold text-slate-800 focus:ring-2 focus:ring-teal-500/30 outline-none"
              />
            </div>
          </div>

          {/* Quick Presets & Commission Override Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-2xl p-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-500 mr-1">ကာလရွေးရန်:</span>
              <button
                type="button"
                onClick={() => applyPreset(5)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                ၅ ရက်စာ (Default)
              </button>
              <button
                type="button"
                onClick={() => applyPreset(7)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                ၇ ရက်စာ (၁ ပတ်)
              </button>
              <button
                type="button"
                onClick={() => applyPreset(30)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                ၃၀ ရက်စာ (၁ လ)
              </button>
            </div>

            {settlementType === 'downline' && selectedTarget && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-teal-600" />
                  ကော်မရှင် %:
                </span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={customCommissionRate}
                  onChange={(e) => setCustomCommissionRate(parseFloat(e.target.value) || 0)}
                  className="w-16 bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-center text-slate-800 focus:ring-2 focus:ring-teal-500/30 outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleSaveCustomerCommission(selectedTarget, customCommissionRate)}
                  className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  title="ဤဖောက်သည်အတွက် ကော်မရှင်နှုန်းအား အမြဲမှတ်သားရန်"
                >
                  မှတ်သား
                </button>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          {settlementType === 'downline' ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-teal-950 text-white rounded-2xl p-3.5 border border-teal-800/60 shadow-xs">
                <span className="text-[11px] font-bold text-teal-300 block mb-1">စုစုပေါင်း ထိုးငွေ (Sales)</span>
                <span className="text-base sm:text-lg font-mono font-black text-amber-400">
                  {formatAmount(downlineSettlementData.totalSales)} {currency}
                </span>
              </div>
              <div className="bg-sky-950 text-white rounded-2xl p-3.5 border border-sky-800/60 shadow-xs">
                <span className="text-[11px] font-bold text-sky-300 block mb-1">ကော်မရှင် ({customCommissionRate}%)</span>
                <span className="text-base sm:text-lg font-mono font-black text-sky-300">
                  {formatAmount(downlineSettlementData.totalCommission)} {currency}
                </span>
              </div>
              <div className="bg-amber-950 text-white rounded-2xl p-3.5 border border-amber-800/60 shadow-xs">
                <span className="text-[11px] font-bold text-amber-300 block mb-1">ပေါက်ကြေး / လျော်ငွေ</span>
                <span className="text-base sm:text-lg font-mono font-black text-amber-300">
                  {formatAmount(downlineSettlementData.totalPayout)} {currency}
                </span>
              </div>
              <div className={`rounded-2xl p-3.5 border shadow-xs text-white ${downlineSettlementData.netBalance >= 0 ? 'bg-emerald-900 border-emerald-700' : 'bg-rose-950 border-rose-800'}`}>
                <span className="text-[11px] font-bold text-emerald-200 block mb-1">
                  {downlineSettlementData.netBalance >= 0 ? 'ရှင်းရန် (ရရန်ငွေ)' : 'ရှင်းရန် (ပေးရန်ငွေ)'}
                </span>
                <span className="text-base sm:text-lg font-mono font-black text-white">
                  {formatAmount(Math.abs(downlineSettlementData.netBalance))} {currency}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-indigo-950 text-white rounded-2xl p-3.5 border border-indigo-800/60 shadow-xs">
                <span className="text-[11px] font-bold text-indigo-300 block mb-1">စုစုပေါင်း တတင်ကြေး</span>
                <span className="text-base sm:text-lg font-mono font-black text-amber-400">
                  {formatAmount(uplineSettlementData.totalForwarded)} {currency}
                </span>
              </div>
              <div className="bg-sky-950 text-white rounded-2xl p-3.5 border border-sky-800/60 shadow-xs">
                <span className="text-[11px] font-bold text-sky-300 block mb-1">ကော်မရှင်ပြန်ရငွေ</span>
                <span className="text-base sm:text-lg font-mono font-black text-sky-300">
                  {formatAmount(uplineSettlementData.totalCommission)} {currency}
                </span>
              </div>
              <div className="bg-amber-950 text-white rounded-2xl p-3.5 border border-amber-800/60 shadow-xs">
                <span className="text-[11px] font-bold text-amber-300 block mb-1">အထက်ပေါက်ကြေး ပြန်ရငွေ</span>
                <span className="text-base sm:text-lg font-mono font-black text-amber-300">
                  {formatAmount(uplineSettlementData.totalPayout)} {currency}
                </span>
              </div>
              <div className={`rounded-2xl p-3.5 border shadow-xs text-white ${uplineSettlementData.netBalance >= 0 ? 'bg-emerald-900 border-emerald-700' : 'bg-rose-950 border-rose-800'}`}>
                <span className="text-[11px] font-bold text-emerald-200 block mb-1">
                  {uplineSettlementData.netBalance >= 0 ? 'အထက်ဒိုင်သို့ ပေးရန်' : 'အထက်ဒိုင်မှ ရရန်'}
                </span>
                <span className="text-base sm:text-lg font-mono font-black text-white">
                  {formatAmount(Math.abs(uplineSettlementData.netBalance))} {currency}
                </span>
              </div>
            </div>
          )}

          {/* Traditional Paper Slip Ledger Preview Card (Matching EM_25284f9f.jpg & image_0b84c059.png) */}
          <div id="printable-period-settlement" className="bg-amber-50/90 border-2 border-amber-900/30 rounded-2xl p-5 shadow-sm max-w-xl mx-auto space-y-4 font-mono text-slate-900">
            <div className="text-center border-b-2 border-dashed border-amber-900/30 pb-3 space-y-0.5">
              <h4 className="text-sm font-black text-amber-950 uppercase">
                {settlementType === 'downline' ? 'အောက်လက်ဒိုင်ငယ် ရှင်းတမ်း' : 'အထက်ဒိုင်ကြီး ရှင်းတမ်း'}
              </h4>
              <div className="text-xs font-bold text-slate-700">
                အမည်: <span className="text-indigo-700 underline">{selectedTarget || '-'}</span>
              </div>
              <div className="text-[11px] text-slate-500 font-sans">
                ({startDate} မှ {endDate} အထိ)
              </div>
            </div>

            {/* Day-by-Day / Session-by-Session Breakdown Items (တနေ့စာချင်း အသေးစိတ်) */}
            <div className="border-b border-dashed border-slate-300 pb-3 space-y-2">
              <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1">
                ရက်အလိုက် / ပွဲစဉ်အလိုက် အသေးစိတ် (Day-by-Day Breakdown)
              </div>
              {settlementType === 'downline' ? (
                downlineSettlementData.items.length === 0 ? (
                  <div className="text-xs text-slate-400 py-1">စာရင်းများ မရှိသေးပါ</div>
                ) : (
                  downlineSettlementData.items.map((item, i) => (
                    <div key={i} className="py-2 border-b border-slate-200/80 last:border-0 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{item.date}</span>
                          <span className="text-slate-600 font-bold text-[11px]">({item.mode})</span>
                          {item.winningNumbers && item.winningNumbers.length > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-300">
                              ထွက်ဂဏန်း: {item.winningNumbers.join(', ')}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-800">ထိုးကြေး: {formatAmount(item.amount, '')}</span>
                        </div>
                      </div>

                      {/* Winning details: numbers and bet P like paper ledger */}
                      {item.payout > 0 && (
                        <div className="flex items-center justify-between text-xs bg-rose-50/70 border border-rose-200 rounded-lg px-2.5 py-1.5">
                          <div className="text-[12px] text-rose-800 flex items-center gap-2 flex-wrap">
                            {item.winningBets && item.winningBets.length > 0 ? (
                              item.winningBets.map((wb, wIdx) => (
                                <span key={wIdx} className="font-mono font-bold inline-flex items-center gap-1.5">
                                  <span className="inline-block px-2 py-0.5 bg-white border border-rose-400 text-rose-700 rounded-full font-black text-xs shadow-2xs">
                                    {wb.num}
                                  </span>
                                  <span className="font-black text-rose-700">{formatAmount(wb.amt, '')} P</span>
                                </span>
                              ))
                            ) : (
                              item.winningNumbers && item.winningNumbers.map((wn, wnIdx) => (
                                <span key={wnIdx} className="inline-block px-2 py-0.5 bg-white border border-rose-400 text-rose-700 rounded-full font-black text-xs shadow-2xs">
                                  {wn}
                                </span>
                              ))
                            )}
                          </div>
                          <div className="text-rose-700 font-black text-right shrink-0">
                            ပေါက်ကြေး: {formatAmount(item.payout, '')} Ks
                          </div>
                        </div>
                      )}

                      {/* Betting summary line */}
                      <div className="text-[10px] text-slate-500 truncate max-w-full font-sans">
                        {item.summary}
                      </div>
                    </div>
                  ))
                )
              ) : (
                uplineSettlementData.items.length === 0 ? (
                  <div className="text-xs text-slate-400 py-1">လွှဲစာရင်းများ မရှိသေးပါ</div>
                ) : (
                  uplineSettlementData.items.map((item, i) => (
                    <div key={i} className="py-2 border-b border-slate-200/80 last:border-0 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900">{item.date}</span>
                          <span className="text-slate-600 font-bold text-[11px]">({item.mode})</span>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <span className="font-bold text-slate-800">တင်ကြေး: {formatAmount(item.amount, '')}</span>
                          <span className="text-sky-700 font-bold text-[11px]">ကော်: {formatAmount(item.commission, '')}</span>
                        </div>
                      </div>

                      {item.payout > 0 && (
                        <div className="flex items-center justify-between text-xs bg-rose-50/70 border border-rose-200 rounded-lg px-2 py-1">
                          <span className="text-[11px] text-rose-800 font-bold">အထက်ပေါက်ကြေး ပြန်ရငွေ</span>
                          <span className="text-rose-700 font-black">ပေါက်ကြေး: {formatAmount(item.payout, '')}P</span>
                        </div>
                      )}

                      <div className="text-[10px] text-slate-500 truncate max-w-full font-sans">
                        {item.summary}
                      </div>
                    </div>
                  ))
                )
              )}
            </div>

            {/* Grand Totals Summary (Matching image_0b84c059.png) */}
            <div className="space-y-2 text-xs pt-1">
              <div className="flex items-center justify-between font-bold">
                <span>{settlementType === 'downline' ? 'စုစုပေါင်းထိုးကြေး (Turnover):' : 'စုစုပေါင်းတင်ကြေး (Forwarded):'}</span>
                <span>{formatAmount(settlementType === 'downline' ? downlineSettlementData.totalSales : uplineSettlementData.totalForwarded, currency)}</span>
              </div>

              <div className="flex items-center justify-between text-rose-700 font-bold border-b border-dashed border-slate-300 pb-2">
                <span>နုတ် - ကော်မရှင် (Commission):</span>
                <span>- {formatAmount(settlementType === 'downline' ? downlineSettlementData.totalCommission : uplineSettlementData.totalCommission, currency)}</span>
              </div>

              <div className="flex items-center justify-between font-black text-slate-900 pt-0.5">
                <span>အမှန်ရောင်းငွေ / ကျန်ငွေ (Net Sales):</span>
                <span>{formatAmount(settlementType === 'downline' ? (downlineSettlementData.totalSales - downlineSettlementData.totalCommission) : (uplineSettlementData.totalForwarded - uplineSettlementData.totalCommission), currency)}</span>
              </div>

              <div className="flex items-center justify-between text-rose-700 font-bold border-b border-dashed border-slate-300 pb-2">
                <span>နုတ် - ပေါက်ကြေး (Total Payout):</span>
                <span>- {formatAmount(settlementType === 'downline' ? downlineSettlementData.totalPayout : uplineSettlementData.totalPayout, currency)}P</span>
              </div>

              {/* Final Net Balance */}
              <div className={`p-3.5 rounded-xl border-2 flex items-center justify-between text-sm font-black ${
                (settlementType === 'downline' ? downlineSettlementData.netBalance : uplineSettlementData.netBalance) >= 0
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                  : 'bg-rose-50 border-rose-500 text-rose-900'
              }`}>
                <span>
                  {settlementType === 'downline'
                    ? ((downlineSettlementData.netBalance >= 0) ? 'နောက်ဆုံး ရရန်ငွေ (Receive):' : 'နောက်ဆုံး ပေးရန်ငွေ (Pay):')
                    : ((uplineSettlementData.netBalance >= 0) ? 'နောက်ဆုံး အထက်ဒိုင်သို့ ပေးရန်:' : 'နောက်ဆုံး အထက်ဒိုင်မှ ရရန်:')}
                </span>
                <span className="font-mono text-base font-black">
                  {formatAmount(Math.abs(settlementType === 'downline' ? downlineSettlementData.netBalance : uplineSettlementData.netBalance), currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Table */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 text-xs font-black text-slate-700 flex items-center justify-between">
              <span>ကာလအတွင်း ဝင်ငွေ/ထွက်ငွေ စာရင်းအသေးစိတ်</span>
              <span className="text-slate-500 font-mono text-[11px]">
                ({startDate} မှ {endDate} အထိ)
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0">
                    <th className="p-2.5">ရက်စွဲ</th>
                    <th className="p-2.5">လိုင်း</th>
                    <th className="p-2.5">ပွဲစဉ် / Ref</th>
                    <th className="p-2.5 text-right">{settlementType === 'downline' ? 'ထိုးငွေ' : 'တင်ကြေး'}</th>
                    {settlementType === 'upline' && <th className="p-2.5 text-right">ကော်မရှင်</th>}
                    <th className="p-2.5 text-right">ပေါက်ငွေ</th>
                    <th className="p-2.5">အကျဉ်းချုပ်</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                  {settlementType === 'downline' ? (
                    downlineSettlementData.items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400 font-sans text-xs">
                          သတ်မှတ်ထားသော ရက်စွဲအတွင်း ဤဖောက်သည်၏ စာရင်းမရှိပါ။
                        </td>
                      </tr>
                    ) : (
                      downlineSettlementData.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 text-slate-500">{item.date}</td>
                          <td className="p-2.5 font-sans font-bold text-slate-800">{item.mode}</td>
                          <td className="p-2.5 text-teal-700 font-bold">{item.refNo}</td>
                          <td className="p-2.5 text-right font-bold text-slate-900">{formatAmount(item.amount)}</td>
                          <td className="p-2.5 text-right font-bold text-amber-600">{formatAmount(item.payout)}</td>
                          <td className="p-2.5 font-sans text-slate-600 truncate max-w-xs">{item.summary}</td>
                        </tr>
                      ))
                    )
                  ) : (
                    uplineSettlementData.items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400 font-sans text-xs">
                          သတ်မှတ်ထားသော ရက်စွဲအတွင်း ဤအထက်ဒိုင်၏ လွှဲစာရင်းမရှိပါ။
                        </td>
                      </tr>
                    ) : (
                      uplineSettlementData.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 text-slate-500">{item.date}</td>
                          <td className="p-2.5 font-sans font-bold text-slate-800">{item.mode}</td>
                          <td className="p-2.5 text-indigo-700 font-bold">{item.refNo}</td>
                          <td className="p-2.5 text-right font-bold text-slate-900">{formatAmount(item.amount)}</td>
                          <td className="p-2.5 text-right font-bold text-sky-600">{formatAmount(item.commission)}</td>
                          <td className="p-2.5 text-right font-bold text-amber-600">{formatAmount(item.payout)}</td>
                          <td className="p-2.5 font-sans text-slate-600 truncate max-w-xs">{item.summary}</td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 px-4 sm:px-6 py-3 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 font-bold">
            ဒိုင်စုစုပေါင်း: <span className="text-slate-800 font-mono font-black">{selectedTarget || '-'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 sm:px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel ထုတ်ရန်</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 sm:px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>ပရင့်ထုတ်ရန်</span>
            </button>
            <button
              type="button"
              onClick={handleCopyText}
              className="px-3 sm:px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              {copiedStatementText ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copiedStatementText ? 'ကူးယူပြီး ✓' : 'စာသားကူးရန်'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              ပိတ်မည်
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
