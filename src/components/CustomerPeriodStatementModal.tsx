/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Customer 5-Day / Period Settlement Statement Modal (ထိုးသားအလိုက် ၅ ရက်စာ စာရင်းရှင်းတမ်း)
 * Modeled after traditional Myanmar paper ledger slip (EM_25284f9f.jpg):
 * - Customer name & period header
 * - Day-by-day / session-by-session turnover & winning payout details (P)
 * - Grand total turnover, less commission, net sales, less total payout, and final Net Balance (ပေးရန် / ရရန်)
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar,
  User,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  Award,
  Layers,
  Wallet,
  ArrowDownRight,
  ArrowUpRight
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { formatAmount } from '../utils/lotteryUtils';
import { evaluateTwoDWinnings } from '../utils/twoDLotteryUtils';
import { evaluateWinnings } from '../utils/lotteryUtils';
import {
  StatementPeriodPreset,
  getStatementDateRange,
  getStatementPeriodLabel,
  getLocalDateStr
} from '../utils/statementUtils';
import { createRestorePoint } from '../utils/restorePoints';

interface CustomerPeriodStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerPeriodStatementModal: React.FC<CustomerPeriodStatementModalProps> = ({
  isOpen,
  onClose
}) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  const [selectedCustomer, setSelectedCustomer] = useState<string>('all');
  const [selectedGame, setSelectedGame] = useState<'all' | '3d' | '2d' | 'football'>('all');
  const [periodPreset, setPeriodPreset] = useState<StatementPeriodPreset>('five_days');
  const [customStart, setCustomStart] = useState<string>(getLocalDateStr());
  const [customEnd, setCustomEnd] = useState<string>(getLocalDateStr());

  // Create restore point when modal opens
  React.useEffect(() => {
    if (isOpen) {
      createRestorePoint('manual', { reason: 'before-customer-period-statement' }).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Extract all unique customer names across 2D, 3D, and Football
  const allCustomers = useMemo(() => {
    const set = new Set<string>();
    lottery3D.vouchers.forEach(v => { if (v.customerName) set.add(v.customerName.trim()); });
    lottery2D.vouchers.forEach(v => { if (v.customerName) set.add(v.customerName.trim()); });
    football.slips.forEach(s => { if (s.customerName) set.add(s.customerName.trim()); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'my'));
  }, [lottery3D.vouchers, lottery2D.vouchers, football.slips]);

  // Date range
  const { startDate, endDate } = getStatementDateRange(periodPreset, customStart, customEnd);

  // Compute customer-specific period statement records
  const statementData = useMemo(() => {
    const cust = selectedCustomer;
    const game = selectedGame;

    // Filter vouchers/slips by date range and customer
    const vouchers3D = lottery3D.vouchers.filter(v => {
      if (v.status === 'cancelled' || v.deletedAt) return false;
      const vDate = (v.createdAt || '').slice(0, 10);
      if (vDate < startDate || vDate > endDate) return false;
      if (cust !== 'all' && (v.customerName || '').trim() !== cust) return false;
      return game === 'all' || game === '3d';
    });

    const vouchers2D = lottery2D.vouchers.filter(v => {
      if (v.status === 'cancelled' || v.deletedAt) return false;
      const vDate = (v.createdAt || '').slice(0, 10);
      if (vDate < startDate || vDate > endDate) return false;
      if (cust !== 'all' && (v.customerName || '').trim() !== cust) return false;
      return game === 'all' || game === '2d';
    });

    const slipsFB = football.slips.filter(s => {
      if (s.status === 'cancelled' || s.deletedAt) return false;
      const sDate = s.roundDate || (s.createdAt || '').slice(0, 10);
      if (sDate < startDate || sDate > endDate) return false;
      if (cust !== 'all' && (s.customerName || '').trim() !== cust) return false;
      return game === 'all' || game === 'football';
    });

    // Group items by date or session (Day-by-day rows)
    // Map date -> { date, turnover, commission, payout, winningDetails: string[], vouchersCount }
    const dayMap: Record<string, {
      date: string;
      label: string;
      turnover: number;
      commission: number;
      payout: number;
      winningDetails: { number: string; amount: number; type: string }[];
      vouchersCount: number;
    }> = {};

    // Process 3D
    vouchers3D.forEach(v => {
      const d = (v.createdAt || '').slice(0, 10) || getLocalDateStr();
      if (!dayMap[d]) {
        dayMap[d] = { date: d, label: `${d} (3D)`, turnover: 0, commission: 0, payout: 0, winningDetails: [], vouchersCount: 0 };
      }
      const sub = v.subtotal ?? v.items.reduce((s, it) => s + (it.amount || 0), 0);
      const rate = v.discountPercent ?? lottery3D.settings.defaultCustomerDiscount ?? 0;
      const comm = v.discountAmount > 0 ? v.discountAmount : Math.round(sub * (rate / 100));

      dayMap[d].turnover += sub;
      dayMap[d].commission += comm;
      dayMap[d].vouchersCount += 1;

      // Check winnings if round settled
      const round = lottery3D.rounds.find(r => r.id === v.roundId);
      if (round && round.winningNumber) {
        const winNum = round.winningNumber.padStart(3, '0');
        const straightMult = round.multiplier || lottery3D.settings.defaultMultiplier || 0;
        const toddMult = round.toddMultiplier || lottery3D.settings.defaultToddMultiplier || 0;
        const evalRes = evaluateWinnings([v], winNum, straightMult, toddMult);
        dayMap[d].payout += evalRes.totalPayout;
        evalRes.winners.forEach(w => {
          dayMap[d].winningDetails.push({ number: winNum, amount: w.wonPayout, type: w.winType });
        });
      } else {
        v.items.forEach(it => {
          if (it.isWon) {
            const amt = it.wonAmount || (it.amount * (lottery3D.settings.defaultMultiplier || 0));
            dayMap[d].payout += amt;
            dayMap[d].winningDetails.push({ number: it.number, amount: amt, type: it.betType });
          }
        });
      }
    });

    // Process 2D
    vouchers2D.forEach(v => {
      const d = (v.createdAt || '').slice(0, 10) || getLocalDateStr();
      const round = lottery2D.rounds.find(r => r.id === v.roundId);
      const sessionLabel = round?.session === 'morning' ? 'မနက်' : round?.session === 'evening' ? 'ညနေ' : '';
      const key = `${d}_${sessionLabel || 'general'}`;

      if (!dayMap[key]) {
        dayMap[key] = { date: d, label: `${d} ${sessionLabel ? `(${sessionLabel})` : '2D'}`, turnover: 0, commission: 0, payout: 0, winningDetails: [], vouchersCount: 0 };
      }
      const sub = v.subtotal ?? v.items.reduce((s, it) => s + (it.amount || 0), 0);
      const rate = v.discountPercent ?? lottery2D.settings.defaultCustomerDiscount ?? 0;
      const comm = v.discountAmount > 0 ? v.discountAmount : Math.round(sub * (rate / 100));

      dayMap[key].turnover += sub;
      dayMap[key].commission += comm;
      dayMap[key].vouchersCount += 1;

      if (round && round.winningNumber) {
        const winNum = round.winningNumber.padStart(2, '0');
        const mult = round.multiplier || lottery2D.settings.defaultMultiplier || 0;
        const evalRes = evaluateTwoDWinnings([v], winNum, mult);
        dayMap[key].payout += evalRes.totalPayout;
        if (evalRes.totalWinnersCount > 0) {
          v.items.forEach(it => {
            if (it.number === winNum) {
              dayMap[key].winningDetails.push({ number: winNum, amount: it.amount * mult, type: '2D' });
            }
          });
        }
      } else {
        v.items.forEach(it => {
          if (it.isWon) {
            const amt = it.wonAmount || (it.amount * (lottery2D.settings.defaultMultiplier || 0));
            dayMap[key].payout += amt;
            dayMap[key].winningDetails.push({ number: it.number, amount: amt, type: '2D' });
          }
        });
      }
    });

    // Process Football
    slipsFB.forEach(s => {
      const d = s.roundDate || (s.createdAt || '').slice(0, 10) || getLocalDateStr();
      if (!dayMap[d]) {
        dayMap[d] = { date: d, label: `${d} (Football)`, turnover: 0, commission: 0, payout: 0, winningDetails: [], vouchersCount: 0 };
      }
      const stake = s.stakeAmount || s.netPayable || 0;
      const rate = s.discountPercent ?? football.settings?.defaultCustomerDiscount ?? 0;
      const comm = s.discountAmount > 0 ? s.discountAmount : Math.round(stake * (rate / 100));

      dayMap[d].turnover += stake;
      dayMap[d].commission += comm;
      dayMap[d].vouchersCount += 1;

      if (s.status === 'settled' || s.outcome === 'won' || s.outcome === 'half_won') {
        const actPayout = s.actualPayout || s.potentialPayout || 0;
        dayMap[d].payout += actPayout;
        dayMap[d].winningDetails.push({ number: s.slipNo || 'FB', amount: actPayout, type: s.outcome || 'won' });
      }
    });

    const rows = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date));

    // Grand totals
    const totalTurnover = rows.reduce((s, r) => s + r.turnover, 0);
    const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
    const netSales = totalTurnover - totalCommission;
    const totalPayout = rows.reduce((s, r) => s + r.payout, 0);
    
    // Final Net Balance: NetSales - TotalPayout
    // If positive (>0), Customer owes us / we receive (ရရန်). If negative (<0), We pay customer (ပေးရန်).
    const netBalance = netSales - totalPayout;

    return {
      rows,
      totalTurnover,
      totalCommission,
      netSales,
      totalPayout,
      netBalance
    };
  }, [selectedCustomer, selectedGame, startDate, endDate, lottery3D, lottery2D, football]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-white px-5 py-4 flex items-center justify-between border-b border-amber-900/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold shadow-xs">
              <User className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-amber-100">
                ထိုးသားအလိုက် ၅ ရက်စာ စာရင်းရှင်းတမ်း (Customer Period Settlement)
              </h3>
              <p className="text-xs text-amber-200/80 mt-0.5">
                ထိုးသားတစ်ဦးချင်းစီ၏ ကာလအလိုက် (၅ ရက်စာ/၁ ပတ်စာ) ထိုးကြေး၊ ပေါက်ကြေး၊ ကော်မရှင်နှင့် ပေးရန်/ရရန် စာရင်းရှင်းတမ်း
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>ပရင့်ထုတ်မည်</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Customer Select */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">ထိုးသားအမည် (Customer)</label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-1.5 shadow-2xs"
              >
                <option value="all">ထိုးသားအားလုံး (All Customers)</option>
                {allCustomers.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Game Mode Select */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">ဂိမ်းအမျိုးအစား</label>
              <select
                value={selectedGame}
                onChange={(e) => setSelectedGame(e.target.value as any)}
                className="bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-1.5 shadow-2xs"
              >
                <option value="all">အားလုံး (3D + 2D + FB)</option>
                <option value="3d">အိုးစည်လေး (3D)</option>
                <option value="2d">ဇီးကွက် (2D)</option>
                <option value="football">ပစ်တိုင်းထောင် (Football)</option>
              </select>
            </div>

            {/* Period Preset */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">ကာလအမျိုးအစား (Period)</label>
              <select
                value={periodPreset}
                onChange={(e) => setPeriodPreset(e.target.value as StatementPeriodPreset)}
                className="bg-white border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-1.5 shadow-2xs"
              >
                <option value="five_days">၅ ရက်စာ (5 Days)</option>
                <option value="today">ဒီနေ့ (1 ရက်စာ)</option>
                <option value="two_days">၂ ရက်စာ</option>
                <option value="three_days">၃ ရက်စာ</option>
                <option value="week">၁ ပတ်စာ (7 Days)</option>
                <option value="month">၁ လစာ (30 Days)</option>
                <option value="custom">ရက်စွဲအလိုက် စိတ်ကြိုက်</option>
              </select>
            </div>
          </div>

          <div className="text-xs font-mono font-bold text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
            ရက်စွဲ: {startDate} မှ {endDate} အထိ
          </div>
        </div>

        {/* Custom Date Range if preset is custom */}
        {periodPreset === 'custom' && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-2.5 flex items-center gap-3 text-xs">
            <span className="font-bold text-amber-950">စတင်ရက်:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="bg-white border border-amber-300 rounded-lg px-2 py-1 font-mono text-slate-900"
            />
            <span className="font-bold text-amber-950">ပြီးဆုံးရက်:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="bg-white border border-amber-300 rounded-lg px-2 py-1 font-mono text-slate-900"
            />
          </div>
        )}

        {/* Content Body: Paper Slip Ledger Style */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-6">
          
          {/* Paper Slip Simulation Card */}
          <div className="bg-white border-2 border-amber-900/30 rounded-2xl p-6 shadow-md max-w-2xl mx-auto space-y-6 font-mono text-slate-900">
            
            {/* Slip Header */}
            <div className="text-center border-b-2 border-dashed border-amber-900/30 pb-4 space-y-1">
              <h2 className="text-lg font-black tracking-wider text-amber-950">ရွှေမင်္ဂလာ - စာရင်းရှင်းတမ်း</h2>
              <div className="text-xs text-slate-600 font-bold">
                ထိုးသားအမည်: <span className="text-indigo-700 text-sm font-black underline">{selectedCustomer === 'all' ? 'ထိုးသားအားလုံး (All)' : selectedCustomer}</span>
              </div>
              <div className="text-[11px] text-slate-500">
                ကာလ: {startDate} မှ {endDate} အထိ ({getStatementPeriodLabel(periodPreset)})
              </div>
            </div>

            {/* Day-by-Day Rows */}
            <div className="space-y-3">
              {statementData.rows.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  ဤကာလအတွင်း ထိုးသား၏ ထိုးကြေးစာရင်းများ မရှိသေးပါ။
                </div>
              ) : (
                statementData.rows.map((row, idx) => (
                  <div key={idx} className="flex items-start justify-between border-b border-slate-200/80 pb-2 text-xs">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-800">{row.label}</div>
                      {row.winningDetails.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {row.winningDetails.map((w, wIdx) => (
                            <span key={wIdx} className="bg-rose-100 text-rose-800 border border-rose-300 px-1.5 py-0.5 rounded text-[10px] font-black">
                              {w.number} ({formatAmount(w.amount, '')}P)
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-right space-y-0.5 font-mono">
                      <div className="font-bold text-slate-900">ထိုးကြေး: {formatAmount(row.turnover, 'Ks')}</div>
                      {row.payout > 0 && (
                        <div className="text-rose-600 font-bold">ပေါက်ကြေး: {formatAmount(row.payout, 'Ks')}P</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Grand Totals & Ledger Calculation Formula */}
            <div className="border-t-2 border-slate-900 pt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between font-bold">
                <span>စုစုပေါင်းထိုးကြေး (Total Turnover):</span>
                <span>{formatAmount(statementData.totalTurnover, 'Ks')}</span>
              </div>

              <div className="flex items-center justify-between text-rose-700 font-bold border-b border-dashed border-slate-300 pb-2">
                <span>နုတ် - ကော်မရှင် (Less Commission):</span>
                <span>- {formatAmount(statementData.totalCommission, 'Ks')}</span>
              </div>

              <div className="flex items-center justify-between font-black text-slate-900 pt-1">
                <span>ကော်နှုတ်ပြီးကျန်ငွေ (Net Sales):</span>
                <span>{formatAmount(statementData.netSales, 'Ks')}</span>
              </div>

              <div className="flex items-center justify-between text-rose-700 font-bold border-b border-dashed border-slate-300 pb-2">
                <span>နုတ် - ပေါက်ကြေးစုစုပေါင်း (Less Total Payout):</span>
                <span>- {formatAmount(statementData.totalPayout, 'Ks')}P</span>
              </div>

              {/* Final Net Balance */}
              <div className={`p-4 rounded-xl border-2 flex items-center justify-between text-base font-black ${
                statementData.netBalance >= 0
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                  : 'bg-rose-50 border-rose-500 text-rose-900'
              }`}>
                <div className="flex items-center gap-2">
                  {statementData.netBalance >= 0 ? (
                    <ArrowDownRight className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <ArrowUpRight className="w-6 h-6 text-rose-600" />
                  )}
                  <span>နောက်ဆုံး {statementData.netBalance >= 0 ? 'ရရန်ငွေ (Receive)' : 'ပေးရန်ငွေ (Pay)'}:</span>
                </div>
                <span className="text-lg font-mono font-black">
                  {formatAmount(Math.abs(statementData.netBalance), 'Ks')}
                </span>
              </div>

            </div>

            {/* Slip Footer */}
            <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-dashed border-slate-200">
              ရွှေမင်္ဂလာ စာရင်းစီမံခန့်ခွဲမှုစနစ် • {new Date().toLocaleString()}
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
