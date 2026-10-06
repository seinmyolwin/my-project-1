import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Send,
  Sliders,
  Filter,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  Sparkles,
  Ban,
  ShieldCheck,
  Percent
} from 'lucide-react';
import { useTwoDLottery } from '../../context/TwoDLotteryContext';
import { TwoDNumberAggregate } from '../../types';
import { formatAmount } from '../../utils/lotteryUtils';

interface TwoDLiveLedgerViewProps {
  onOpenForwardModal?: (num?: string, amt?: number) => void;
  onOpenLimitsManager?: (num?: string) => void;
}

export const TwoDLiveLedgerView: React.FC<TwoDLiveLedgerViewProps> = ({
  onOpenForwardModal,
  onOpenLimitsManager
}) => {
  const {
    settings,
    activeRound,
    aggregates,
    roundSummary,
    toggleBlockNumber,
    exportToExcel
  } = useTwoDLottery();

  const isMyanmar = settings.language === 'my';

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'danger' | 'warning' | 'blocked' | 'hot'>('all');
  const [selectedDigitFilter, setSelectedDigitFilter] = useState<string | null>(null);

  // Filtered 00-99 numbers
  const filteredNumbers = useMemo(() => {
    let list = Object.values(aggregates) as TwoDNumberAggregate[];

    if (searchTerm.trim()) {
      const term = searchTerm.trim().padStart(searchTerm.length <= 2 ? 2 : 0, '0');
      list = list.filter(item => item.number.includes(searchTerm.trim()));
    }

    if (filterType === 'danger') {
      list = list.filter(item => item.riskLevel === 'danger' && !item.isBlocked);
    } else if (filterType === 'warning') {
      list = list.filter(item => item.riskLevel === 'warning');
    } else if (filterType === 'blocked') {
      list = list.filter(item => item.isBlocked);
    } else if (filterType === 'hot') {
      list = list.filter(item => item.totalSold > 0).sort((a, b) => b.totalSold - a.totalSold);
    }

    if (selectedDigitFilter !== null) {
      list = list.filter(item => item.number.startsWith(selectedDigitFilter));
    }

    return list.sort((a, b) => a.number.localeCompare(b.number));
  }, [aggregates, searchTerm, filterType, selectedDigitFilter]);

  // Max sold for proportional heat map
  const maxSold = useMemo(() => {
    const vals = (Object.values(aggregates) as TwoDNumberAggregate[]).map(a => a.totalSold);
    return Math.max(...vals, 1);
  }, [aggregates]);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <span className="text-xs text-slate-500 font-bold block mb-1">
            {isMyanmar ? 'စုစုပေါင်း အရောင်းရငွေ' : 'Total 2D Sales'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            {formatAmount(roundSummary.totalSales, settings.currency)}
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            {roundSummary.totalVouchers} {isMyanmar ? 'စောင် ရောင်းပြီး' : 'vouchers'}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <span className="text-xs text-teal-700 font-bold block mb-1">
            {isMyanmar ? 'ဒိုင်လက်ကျန်ယူငွေ' : 'Retained Bet'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-teal-700 font-mono">
            {formatAmount(roundSummary.totalSales - roundSummary.totalForwarded, settings.currency)}
          </div>
          <span className="text-[11px] text-teal-600 font-medium">
            {isMyanmar ? 'ဒိုင်ကိုယ်တိုင်ကိုင်ငွေ' : 'In-house retained'}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <span className="text-xs text-indigo-700 font-bold block mb-1">
            {isMyanmar ? 'ဒိုင်ကြီးဆီ လွှဲတင်ငွေ' : 'Forwarded Bet'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-indigo-700 font-mono">
            {formatAmount(roundSummary.totalForwarded, settings.currency)}
          </div>
          <span className="text-[11px] text-indigo-600 font-medium">
            +{formatAmount(roundSummary.forwardedCommission, settings.currency)} {isMyanmar ? 'ကော်မရှင်' : 'comm'}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
          <span className="text-xs text-rose-700 font-bold block mb-1">
            {isMyanmar ? 'အမြင့်ဆုံး လျော်ကြေးအန္တရာယ်' : 'Max Potential Payout'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-rose-700 font-mono">
            {formatAmount(
              Math.max(...(Object.values(aggregates) as TwoDNumberAggregate[]).map(a => a.estimatedPayout), 0),
              settings.currency
            )}
          </div>
          <span className="text-[11px] text-rose-600 font-medium">
            @{activeRound?.multiplier || 85}x {isMyanmar ? 'ဆဖြင့် တွက်ချက်' : 'multiplier'}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
          <span className="text-xs text-slate-500 font-bold block mb-1">
            {isMyanmar ? 'ဒိုင်ကာဂဏန်း (Blocked)' : 'Blocked Numbers'}
          </span>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            {(Object.values(aggregates) as TwoDNumberAggregate[]).filter(a => a.isBlocked).length}
          </div>
          <span className="text-[11px] text-rose-600 font-bold">
            {isMyanmar ? 'လုံးဝလက်မခံ' : 'Total blocked'}
          </span>
        </div>
      </div>

      {/* Control Bar: Filters, Search, Excel Export */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              filterType === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {isMyanmar ? 'အားလုံး (00-99)' : 'All 00-99'}
          </button>
          <button
            type="button"
            onClick={() => setFilterType('hot')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              filterType === 'hot'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
            }`}
          >
            {isMyanmar ? 'အရောင်းများ (Hot)' : 'Hot Numbers'}
          </button>
          <button
            type="button"
            onClick={() => setFilterType('danger')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              filterType === 'danger'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-800'
            }`}
          >
            {isMyanmar ? 'ဘရိတ်ပြည့် (Danger)' : 'Full Limit'}
          </button>
          <button
            type="button"
            onClick={() => setFilterType('warning')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              filterType === 'warning'
                ? 'bg-amber-500 text-white'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800'
            }`}
          >
            {isMyanmar ? 'သတိပေးအဆင့် (80%+)' : 'Warning (80%+)'}
          </button>
          <button
            type="button"
            onClick={() => setFilterType('blocked')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              filterType === 'blocked'
                ? 'bg-purple-700 text-white'
                : 'bg-purple-50 hover:bg-purple-100 text-purple-800'
            }`}
          >
            {isMyanmar ? 'ဒိုင်ကာ (Blocked)' : 'Blocked'}
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-48">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={isMyanmar ? 'ဂဏန်းရှာပါ (ဥပမာ- 24)' : 'Search number...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-xs font-mono rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-200 bg-slate-50"
            />
          </div>

          {onOpenForwardModal && (
            <button
              type="button"
              onClick={() => onOpenForwardModal()}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
              title="သတ်မှတ်ချက်ကျော် ပိုနေသောဂဏန်းများကို စုစည်း၍ ဒိုင်ကြီးဆီ လွှဲတင်မည်"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isMyanmar ? 'ဒိုင်ကြီးဆီ ပြန်တင်မည်' : 'Batch Forward'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={exportToExcel}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isMyanmar ? 'Excel ထုတ်' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* Head Digits Filter Bar (0 ထိပ် မှ 9 ထိပ်) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-slate-500 shrink-0 mr-1">
          {isMyanmar ? 'ထိပ်စီး:' : 'Head:'}
        </span>
        <button
          type="button"
          onClick={() => setSelectedDigitFilter(null)}
          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            selectedDigitFilter === null
              ? 'bg-teal-600 text-white'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          {isMyanmar ? 'အားလုံး' : 'All'}
        </button>
        {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button
            key={d}
            type="button"
            onClick={() => setSelectedDigitFilter(selectedDigitFilter === d ? null : d)}
            className={`px-2.5 py-1 text-xs font-bold font-mono rounded-lg transition-colors cursor-pointer shrink-0 ${
              selectedDigitFilter === d
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {d}x
          </button>
        ))}
      </div>

      {/* 2D Matrix Grid (10x10) */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-2.5 sm:gap-3">
          {filteredNumbers.map(agg => {
            const usagePercent = agg.limit > 0 ? Math.min(Math.round((agg.totalSold / agg.limit) * 100), 100) : 0;
            const isFull = agg.limit > 0 && agg.totalSold >= agg.limit;

            return (
              <div
                key={agg.number}
                className={`relative rounded-2xl p-3 border transition-all flex flex-col justify-between group cursor-pointer ${
                  agg.isBlocked
                    ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-200'
                    : isFull
                    ? 'bg-rose-50 border-rose-400 shadow-2xs'
                    : agg.riskLevel === 'warning'
                    ? 'bg-amber-50/60 border-amber-300 shadow-2xs'
                    : agg.totalSold > 0
                    ? 'bg-teal-50/40 border-teal-200 hover:border-teal-400'
                    : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                }`}
                onClick={() => {
                  if (onOpenLimitsManager) {
                    onOpenLimitsManager(agg.number);
                  }
                }}
              >
                {/* Number & Tag */}
                <div className="flex items-center justify-between">
                  <span
                    className={`font-mono text-2xl font-black ${
                      agg.isBlocked
                        ? 'text-rose-700 line-through'
                        : isFull
                        ? 'text-rose-900'
                        : agg.riskLevel === 'warning'
                        ? 'text-amber-900'
                        : 'text-slate-900'
                    }`}
                  >
                    {agg.number}
                  </span>

                  {agg.isBlocked ? (
                    <span className="px-1.5 py-0.5 bg-rose-200 text-rose-900 text-[10px] font-black rounded-md">
                      {isMyanmar ? 'ကာ' : 'BLK'}
                    </span>
                  ) : isFull ? (
                    <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded-md">
                      {isMyanmar ? 'ပြည့်' : 'FULL'}
                    </span>
                  ) : agg.riskLevel === 'warning' ? (
                    <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-black rounded-md">
                      {usagePercent}%
                    </span>
                  ) : null}
                </div>

                {/* Sold Amount */}
                <div className="my-1.5">
                  <div className="font-mono text-xs font-bold text-slate-800">
                    {formatAmount(agg.totalSold, settings.currency)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {isMyanmar ? 'ကန့်သတ်:' : 'Lmt:'} {formatAmount(agg.limit, settings.currency)}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all rounded-full ${
                      agg.isBlocked
                        ? 'bg-rose-500'
                        : isFull
                        ? 'bg-rose-600'
                        : agg.riskLevel === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-teal-500'
                    }`}
                    style={{ width: `${agg.isBlocked ? 100 : usagePercent}%` }}
                  ></div>
                </div>

                {/* Quick actions on hover */}
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleBlockNumber(agg.number);
                    }}
                    title={agg.isBlocked ? 'Unblock number' : 'Block number (ဒိုင်ကာ)'}
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      agg.isBlocked
                        ? 'text-rose-700 hover:bg-rose-200'
                        : 'text-slate-400 hover:text-rose-600 hover:bg-slate-200'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                  </button>

                  {agg.totalSold > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenForwardModal) {
                          onOpenForwardModal(agg.number, agg.totalSold);
                        }
                      }}
                      title="Forward to master dealer"
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
