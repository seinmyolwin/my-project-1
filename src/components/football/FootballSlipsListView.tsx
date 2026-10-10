import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Printer,
  Trash2,
  RotateCcw,
  Sparkles,
  Trophy,
  FileSpreadsheet,
  TrendingUp,
  X
} from 'lucide-react';
import { useFootball } from '../../context/FootballContext';
import { FootballSlip } from '../../types';
import { formatAmount } from '../../utils/lotteryUtils';
import { printVoucherSlip } from '../../utils/printUtils';

interface FootballSlipsListViewProps {
  onOpenStatement?: () => void;
}

export const FootballSlipsListView: React.FC<FootballSlipsListViewProps> = ({ onOpenStatement }) => {
  const {
    settings,
    activeDate,
    activeDateSlips,
    summary,
    settleMatches,
    deleteSlip,
    exportToExcel
  } = useFootball();

  const isMyanmar = settings.language === 'my';

  const [searchTerm, setSearchTerm] = useState('');
  const [filterOutcome, setFilterOutcome] = useState<'all' | 'won' | 'lost' | 'pending'>('all');
  const [selectedSlip, setSelectedSlip] = useState<FootballSlip | null>(null);

  const filteredSlips = useMemo(() => {
    let list = activeDateSlips;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(s =>
        s.slipNo.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        (s.customerPhone && s.customerPhone.includes(q))
      );
    }

    if (filterOutcome === 'won') {
      list = list.filter(s => s.outcome === 'won' || s.outcome === 'half_won');
    } else if (filterOutcome === 'lost') {
      list = list.filter(s => s.outcome === 'lost');
    } else if (filterOutcome === 'pending') {
      list = list.filter(s => !s.outcome || s.outcome === 'pending');
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activeDateSlips, searchTerm, filterOutcome]);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-bold block mb-1">
            {isMyanmar ? 'စုစုပေါင်း ထိုးကြေးငွေ' : 'Total Stakes'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            {formatAmount(summary.totalStake, settings.currency)}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            {summary.totalTickets} {isMyanmar ? 'စောင် ရောင်းပြီး' : 'tickets'}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <span className="text-xs text-emerald-700 font-bold block mb-1">
            {isMyanmar ? 'ဘော်ဒီ ထိုးကြေး' : 'Body Stakes'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
            {formatAmount(summary.totalBodyStake, settings.currency)}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">
            {isMyanmar ? 'ဘော်ဒီသီးသန့်' : 'Singles'}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <span className="text-xs text-indigo-700 font-bold block mb-1">
            {isMyanmar ? 'မောင်း ထိုးကြေး' : 'Parlay Stakes'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-indigo-700 font-mono">
            {formatAmount(summary.totalMaungStake, settings.currency)}
          </div>
          <span className="text-[11px] text-indigo-600 font-medium">
            {isMyanmar ? 'မောင်းလက်မှတ်များ' : 'Mix parlays'}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <span className="text-xs text-rose-700 font-bold block mb-1">
            {isMyanmar ? 'စုစုပေါင်း ပေးလျော်ငွေ' : 'Total Payouts'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-rose-700 font-mono">
            {formatAmount(summary.totalPayout, settings.currency)}
          </div>
          <span className="text-[11px] text-rose-600 font-medium">
            {summary.wonTicketsCount} {isMyanmar ? 'စောင် ပေါက်သည်' : 'won tickets'}
          </span>
        </div>

        <div
          className={`rounded-2xl p-4 border shadow-2xs col-span-2 lg:col-span-1 ${
            summary.isProfit ? 'bg-emerald-50/80 border-emerald-300' : 'bg-rose-50/80 border-rose-300'
          }`}
        >
          <span
            className={`text-xs font-bold block mb-1 ${
              summary.isProfit ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {isMyanmar ? 'ဒိုင် အသားတင် အမြတ်/ရှုံး' : 'Net Profit'}
          </span>
          <div
            className={`text-xl sm:text-2xl font-black font-mono ${
              summary.isProfit ? 'text-emerald-900' : 'text-rose-900'
            }`}
          >
            {formatAmount(Math.abs(summary.netProfit), settings.currency)}
          </div>
          <span
            className={`text-[11px] font-bold ${
              summary.isProfit ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {summary.isProfit ? (isMyanmar ? 'အမြတ်ငွေ' : 'Profit') : (isMyanmar ? 'အရှုံး' : 'Loss')}
          </span>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterOutcome('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              filterOutcome === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {isMyanmar ? 'အားလုံး' : 'All'} ({activeDateSlips.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterOutcome('won')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              filterOutcome === 'won'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
            }`}
          >
            {isMyanmar ? 'ပေါက်မဲ (Won)' : 'Won'} ({summary.wonTicketsCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterOutcome('lost')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              filterOutcome === 'lost'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800'
            }`}
          >
            {isMyanmar ? 'အရှုံး (Lost)' : 'Lost'} ({summary.lostTicketsCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterOutcome('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              filterOutcome === 'pending'
                ? 'bg-amber-500 text-white'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
            }`}
          >
            {isMyanmar ? 'မပြီးသေး (Pending)' : 'Pending'} ({summary.pendingTicketsCount})
          </button>
        </div>

        {/* Settle Matches & Excel Export */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder={isMyanmar ? 'ဘောင်ချာ ရှာရန်...' : 'Search slip...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-8 pr-3 text-xs rounded-xl border border-slate-300 focus:border-emerald-500 bg-slate-50"
            />
          </div>

          <button
            type="button"
            onClick={() => settleMatches()}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isMyanmar ? 'ရလဒ်တွက်ချက် စာရင်းရှင်း' : 'Auto Settle'}</span>
          </button>

          <button
            type="button"
            onClick={exportToExcel}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isMyanmar ? 'Excel' : 'Export'}</span>
          </button>

          {onOpenStatement && (
            <button
              type="button"
              onClick={onOpenStatement}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
              title="ပစ်တိုင်းထောင် ကာလအလိုက် စာရင်းရှင်းတမ်း အစီရင်ခံစာ"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{isMyanmar ? 'ရှင်းတမ်း' : 'Statements'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Slips Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredSlips.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <FileText className="w-10 h-10 mx-auto stroke-1" />
            <p className="text-sm font-medium">
              {isMyanmar ? 'ဘောလုံးဘောင်ချာ မှတ်တမ်း မရှိသေးပါ' : 'No betting tickets found.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">ဘောင်ချာအမှတ်</th>
                  <th className="p-3.5">ထိုးသူ</th>
                  <th className="p-3.5">အမျိုးအစား</th>
                  <th className="p-3.5 text-right">ထိုးကြေး</th>
                  <th className="p-3.5 text-right">အဆ (Odds)</th>
                  <th className="p-3.5 text-right">ဖြစ်နိုင်ခြေလျော်ကြေး</th>
                  <th className="p-3.5 text-right">အမှန်တကယ်လျော်ငွေ</th>
                  <th className="p-3.5 text-center">အခြေအနေ</th>
                  <th className="p-3.5 text-center">လုပ်ဆောင်ချက်</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredSlips.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold text-emerald-800">{s.slipNo}</td>
                    <td className="p-3.5 font-sans font-bold text-slate-900">{s.customerName}</td>
                    <td className="p-3.5 font-sans">
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md font-bold text-slate-700">
                        {s.slipType === 'maung' ? `${s.teamCount} သင်းမောင်း` : 'ဘော်ဒီသီးသန့်'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-800">
                      {formatAmount(s.stakeAmount, settings.currency)}
                    </td>
                    <td className="p-3.5 text-right font-bold text-emerald-700">
                      x{s.combinedOdds}
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-600">
                      {formatAmount(s.potentialPayout, settings.currency)}
                    </td>
                    <td className="p-3.5 text-right font-black text-sm text-slate-900">
                      {s.actualPayout ? (
                        <span className="text-rose-700">{formatAmount(s.actualPayout, settings.currency)}</span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3.5 text-center font-sans">
                      {s.outcome === 'won' || s.outcome === 'half_won' ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[11px] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{s.outcome === 'half_won' ? 'ဝက်နိုင်' : 'ပေါက်'}</span>
                        </span>
                      ) : s.outcome === 'lost' ? (
                        <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold rounded-lg text-[11px] inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          <span>အပြည့်ရှုံး</span>
                        </span>
                      ) : s.outcome === 'draw' ? (
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold rounded-lg text-[11px]">
                          သရေ
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-lg text-[11px] inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>မပြီးသေး</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedSlip(s)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(isMyanmar ? 'ဤဘောင်ချာကို ဖျက်ရန် သေချာပါသလား?' : 'Delete this ticket?')) {
                              deleteSlip(s.id);
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Ticket Details Modal */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="text-xs font-black text-slate-500">FOOTBALL BET SLIP</span>
              <button
                type="button"
                onClick={() => setSelectedSlip(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div id="printable-voucher" className="font-mono text-xs space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-center space-y-1">
                <h4 className="font-black text-sm text-slate-900">{settings.shopName}</h4>
                <p className="text-[11px] text-slate-500">
                  {selectedSlip.slipType === 'maung' ? `${selectedSlip.teamCount} TEAMS PARLAY` : 'SINGLE BET'}
                </p>
                <p className="text-[10px] text-slate-400">{selectedSlip.slipNo}</p>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold">{selectedSlip.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(selectedSlip.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Legs */}
              <div className="border-t border-dashed border-slate-300 pt-2 space-y-2 max-h-48 overflow-y-auto">
                {selectedSlip.selections.map((sel, idx) => (
                  <div key={idx} className="border-b border-slate-200/60 pb-1.5">
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>{sel.choiceLabel}</span>
                      <span>x{sel.odds}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>{sel.matchSummary}</span>
                      <span className="uppercase font-bold text-emerald-700">{sel.outcome}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 font-bold">
                <div className="flex justify-between text-slate-600">
                  <span>Stake:</span>
                  <span>{formatAmount(selectedSlip.stakeAmount, settings.currency)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Combined Odds:</span>
                  <span>x{selectedSlip.combinedOdds}</span>
                </div>
                <div className="flex justify-between text-slate-900 text-sm pt-1 border-t border-slate-200">
                  <span>POTENTIAL PAYOUT:</span>
                  <span className="text-emerald-700">
                    {formatAmount(selectedSlip.potentialPayout, settings.currency)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => printVoucherSlip('printable-voucher', 'ပစ်တိုင်းထောင် ဘေလ် - ' + selectedSlip.slipNo)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedSlip(null)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
