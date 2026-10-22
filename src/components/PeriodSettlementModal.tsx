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
  Wallet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { formatAmount } from '../utils/lotteryUtils';
import { getLocalDateStr, getDaysAgoStr } from '../utils/statementUtils';

interface PeriodSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PeriodSettlementModal: React.FC<PeriodSettlementModalProps> = ({ isOpen, onClose }) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  const currency = lottery2D.settings.currency || lottery3D.settings.currency || 'Ks';
  const defaultCommission = lottery3D.settings.defaultCommissionRate || 10;

  // Mode: downline (အောက်လက်ဒိုင်ငယ်/ဖောက်သည်) or upline (အထက်ဒိုင်/မာစတာဒိုင်)
  const [settlementType, setSettlementType] = useState<'downline' | 'upline'>('downline');

  // Date boundaries
  const todayStr = getLocalDateStr();
  const fiveDaysAgoStr = getDaysAgoStr(4);
  const [startDate, setStartDate] = useState(fiveDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);

  const [selectedTarget, setSelectedTarget] = useState<string>('');
  const [customCommissionRate, setCustomCommissionRate] = useState<number>(defaultCommission);

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
    const items: Array<{ date: string; mode: string; refNo: string; amount: number; payout: number; summary: string }> = [];

    // 3D Vouchers
    lottery3D.vouchers.forEach((v) => {
      const vDate = (v.createdAt || '').slice(0, 10);
      if (vDate >= startDate && vDate <= endDate && v.customerName?.trim() === selectedTarget) {
        const amt = v.totalAmount || 0;
        const payout = v.winningPayout || 0;
        totalSales += amt;
        totalPayout += payout;
        items.push({
          date: vDate,
          mode: 'အိုးစည်လေး (3D)',
          refNo: v.voucherNo || v.id,
          amount: amt,
          payout,
          summary: v.items ? v.items.map((i: any) => `${i.number}(${i.amount})`).join(', ') : '-'
        });
      }
    });

    // 2D Vouchers
    lottery2D.vouchers.forEach((v) => {
      const vDate = (v.createdAt || '').slice(0, 10);
      if (vDate >= startDate && vDate <= endDate && v.customerName?.trim() === selectedTarget) {
        const amt = v.totalAmount || 0;
        const payout = v.winningPayout || 0;
        totalSales += amt;
        totalPayout += payout;
        items.push({
          date: vDate,
          mode: 'ဇီးကွက် (2D)',
          refNo: v.voucherNo || v.id,
          amount: amt,
          payout,
          summary: v.items ? v.items.map((i: any) => `${i.number}(${i.amount})`).join(', ') : '-'
        });
      }
    });

    // Football Slips
    football.slips.forEach((s) => {
      const sDate = s.roundDate || (s.createdAt || '').slice(0, 10);
      if (sDate >= startDate && sDate <= endDate && s.customerName?.trim() === selectedTarget) {
        const amt = s.netPayable || s.stakeAmount || 0;
        const payout = s.winningPayout || 0;
        totalSales += amt;
        totalPayout += payout;
        items.push({
          date: sDate,
          mode: 'ပစ်တိုင်းထောင်',
          refNo: s.slipNo || s.id,
          amount: amt,
          payout,
          summary: s.selections ? s.selections.map((sel: any) => sel.matchSummary).join(', ') : '-'
        });
      }
    });

    const totalCommission = Math.round((totalSales * customCommissionRate) / 100);
    // Net Balance for Downline = (Total Sales - Commission) - Winning Payout to Customer
    const netBalance = (totalSales - totalCommission) - totalPayout;

    return {
      totalSales,
      totalCommission,
      totalPayout,
      netBalance,
      items: items.sort((a, b) => b.date.localeCompare(a.date))
    };
  }, [selectedTarget, startDate, endDate, customCommissionRate, lottery3D.vouchers, lottery2D.vouchers, football.slips]);

  // ---------------------------------------------------------------------------
  // SETTLEMENT COMPUTATION FOR UPLINE (FORWARD SLIPS)
  // ---------------------------------------------------------------------------
  const uplineSettlementData = useMemo(() => {
    if (!selectedTarget) return { totalForwarded: 0, totalCommission: 0, totalPayout: 0, netBalance: 0, items: [] };

    let totalForwarded = 0;
    let totalCommission = 0;
    let totalPayout = 0;
    const items: Array<{ date: string; mode: string; refNo: string; amount: number; commission: number; payout: number; summary: string }> = [];

    // 3D Forward Slips
    lottery3D.forwardSlips.forEach((f) => {
      const fDate = (f.createdAt || '').slice(0, 10);
      if (fDate >= startDate && fDate <= endDate && f.masterAgentName?.trim() === selectedTarget) {
        const amt = f.totalAmount || 0;
        const comm = f.commissionAmount || 0;
        const payout = (f as any).winningPayout || 0;
        totalForwarded += amt;
        totalCommission += comm;
        totalPayout += payout;
        items.push({
          date: fDate,
          mode: 'အိုးစည်လေး (3D)',
          refNo: f.slipNo || f.id,
          amount: amt,
          commission: comm,
          payout,
          summary: f.items ? `${f.items.length} items` : '-'
        });
      }
    });

    // 2D Forward Slips
    lottery2D.forwardSlips.forEach((f) => {
      const fDate = (f.createdAt || '').slice(0, 10);
      if (fDate >= startDate && fDate <= endDate && f.masterAgentName?.trim() === selectedTarget) {
        const amt = f.totalAmount || 0;
        const comm = f.commissionAmount || 0;
        const payout = (f as any).winningPayout || 0;
        totalForwarded += amt;
        totalCommission += comm;
        totalPayout += payout;
        items.push({
          date: fDate,
          mode: 'ဇီးကွက် (2D)',
          refNo: f.slipNo || f.id,
          amount: amt,
          commission: comm,
          payout,
          summary: f.items ? `${f.items.length} items` : '-'
        });
      }
    });

    // Football Forward Slips
    football.forwardSlips.forEach((f) => {
      const fDate = (f.createdAt || '').slice(0, 10);
      if (fDate >= startDate && fDate <= endDate && f.masterAgentName?.trim() === selectedTarget) {
        const amt = f.totalAmount || 0;
        const comm = f.commissionAmount || 0;
        const payout = (f as any).winningPayout || 0;
        totalForwarded += amt;
        totalCommission += comm;
        totalPayout += payout;
        items.push({
          date: fDate,
          mode: 'ပစ်တိုင်းထောင်',
          refNo: f.slipNo || f.id,
          amount: amt,
          commission: comm,
          payout,
          summary: f.selections ? `${f.selections.length} matches` : '-'
        });
      }
    });

    // Net Balance for Upline = (Total Forwarded - Commission Received) - Payout from Upline
    const netBalance = (totalForwarded - totalCommission) - totalPayout;

    return {
      totalForwarded,
      totalCommission,
      totalPayout,
      netBalance,
      items: items.sort((a, b) => b.date.localeCompare(a.date))
    };
  }, [selectedTarget, startDate, endDate, lottery3D.forwardSlips, lottery2D.forwardSlips, football.forwardSlips]);

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
    window.print();
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
                <span className="text-[11px] font-bold text-amber-300 block mb-1">ပေါက်ကြေး ပြန်ရငွေ</span>
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
                    <th className="p-2.5">နံပါတ် / Ref</th>
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
