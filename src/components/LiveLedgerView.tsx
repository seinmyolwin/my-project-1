import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ShieldAlert,
  Sliders,
  Lock,
  Unlock,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Sparkles,
  Download,
  Info,
  LayoutGrid,
  List,
  Ban,
  Send
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { formatAmount } from '../utils/lotteryUtils';
import { NumberAggregate } from '../types';

interface LiveLedgerViewProps {
  onOpenForwardModal: (initialNumber?: string, initialAmount?: number) => void;
  onOpenLimitsManager: (initialNumber?: string) => void;
}

export const LiveLedgerView: React.FC<LiveLedgerViewProps> = ({
  onOpenForwardModal,
  onOpenLimitsManager
}) => {
  const {
    activeRound,
    settings,
    aggregates,
    hotNumbers,
    limits,
    blockedNumbers,
    toggleBlockNumber,
    exportToExcel
  } = useLottery();

  const isMyanmar = settings.language === 'my';

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'hot' | 'danger' | 'warning' | 'blocked' | 'empty'>('all');
  const [selectedHeadDigit, setSelectedHeadDigit] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'sold_desc' | 'num_asc' | 'risk_desc' | 'payout_desc'>('sold_desc');
  const [viewLayout, setViewLayout] = useState<'table' | 'grid'>('table');

  // Master 000-999 list generation
  const all1000Numbers = useMemo(() => {
    const list: NumberAggregate[] = [];
    const multiplier = activeRound?.multiplier || settings.defaultMultiplier;

    for (let i = 0; i <= 999; i++) {
      const num = String(i).padStart(3, '0');
      if (aggregates[num]) {
        list.push(aggregates[num]);
      } else {
        const numLimit = limits[num] !== undefined ? limits[num] : settings.globalStockLimit;
        const isBlocked = !!blockedNumbers[num];
        list.push({
          number: num,
          totalSold: 0,
          forwardedAmount: 0,
          retainedAmount: 0,
          limit: numLimit,
          isBlocked,
          betCount: 0,
          estimatedPayout: 0,
          netRisk: 0,
          riskLevel: isBlocked ? 'danger' : 'safe'
        });
      }
    }
    return list;
  }, [aggregates, limits, blockedNumbers, activeRound, settings]);

  // Category counts
  const counts = useMemo(() => {
    return {
      all: all1000Numbers.length,
      hot: all1000Numbers.filter(a => a.totalSold > 0).length,
      danger: all1000Numbers.filter(a => (a.riskLevel === 'danger' || (a.limit > 0 && a.totalSold >= a.limit)) && !a.isBlocked).length,
      warning: all1000Numbers.filter(a => a.riskLevel === 'warning').length,
      blocked: all1000Numbers.filter(a => a.isBlocked).length,
      empty: all1000Numbers.filter(a => a.totalSold === 0).length,
    };
  }, [all1000Numbers]);

  // Filtered & Sorted items
  const displayItems = useMemo(() => {
    let baseList = all1000Numbers;

    // Apply filter modes
    if (filterMode === 'hot') {
      baseList = baseList.filter(a => a.totalSold > 0);
    } else if (filterMode === 'danger') {
      baseList = baseList.filter(a => (a.riskLevel === 'danger' || (a.limit > 0 && a.totalSold >= a.limit)) && !a.isBlocked);
    } else if (filterMode === 'warning') {
      baseList = baseList.filter(a => a.riskLevel === 'warning');
    } else if (filterMode === 'blocked') {
      baseList = baseList.filter(a => a.isBlocked);
    } else if (filterMode === 'empty') {
      baseList = baseList.filter(a => a.totalSold === 0);
    }

    // Apply Head filter
    if (selectedHeadDigit !== null) {
      baseList = baseList.filter(item => item.number.startsWith(selectedHeadDigit));
    }

    // Apply Search Query (supports exact "123", prefix "12*", or ending "*89")
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      baseList = baseList.filter(item => {
        if (q.startsWith('*')) {
          const suffix = q.slice(1);
          return item.number.endsWith(suffix);
        }
        if (q.endsWith('*')) {
          const prefix = q.slice(0, -1);
          return item.number.startsWith(prefix);
        }
        return item.number.includes(q);
      });
    }

    // Sorting
    return [...baseList].sort((a, b) => {
      if (sortBy === 'sold_desc') return b.totalSold - a.totalSold;
      if (sortBy === 'num_asc') return a.number.localeCompare(b.number);
      if (sortBy === 'payout_desc') return b.estimatedPayout - a.estimatedPayout;
      if (sortBy === 'risk_desc') {
        const riskScore = { danger: 3, warning: 2, safe: 1 };
        return (riskScore[b.riskLevel] || 0) - (riskScore[a.riskLevel] || 0);
      }
      return 0;
    });
  }, [filterMode, all1000Numbers, selectedHeadDigit, searchQuery, sortBy]);

  // Totals for the current filtered list
  const currentSoldSum = useMemo(() => {
    return (Object.values(aggregates) as NumberAggregate[]).reduce((acc, a) => acc + a.totalSold, 0);
  }, [aggregates]);

  const currentFwdSum = useMemo(() => {
    return (Object.values(aggregates) as NumberAggregate[]).reduce((acc, a) => acc + a.forwardedAmount, 0);
  }, [aggregates]);

  const currentRetainedSum = useMemo(() => {
    return (Object.values(aggregates) as NumberAggregate[]).reduce((acc, a) => acc + a.retainedAmount, 0);
  }, [aggregates]);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      
      {/* Top Controls & Metrics Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <span>{isMyanmar ? 'အရောင်းစာရင်းချုပ် (၀-၉၉၉)' : '3D Master Live Ledger'}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isMyanmar
                ? 'ဂဏန်းတစ်ခုချင်းစီအလိုက် ရောင်းရငွေ၊ အပေါ်လွှဲငွေ၊ ကိုယ်ပိုင်တာဝန်နှင့် လျော်ကြေးခန့်မှန်းချက်များ'
                : 'Real-time sales, forwarded amounts, retained risk liability per 3-digit number'}
            </p>
          </div>

          {/* Quick Metrics Pills */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
            <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
              <span className="text-slate-500 block text-[10px] uppercase font-sans font-semibold">
                {isMyanmar ? 'စုစုပေါင်း ရောင်းရငွေ' : 'Total Gross'}
              </span>
              <span className="font-bold text-slate-900 text-sm">
                {formatAmount(currentSoldSum, settings.currency)}
              </span>
            </div>

            <div className="bg-indigo-50/60 border border-indigo-200 px-3 py-2 rounded-xl">
              <span className="text-indigo-700 block text-[10px] uppercase font-sans font-semibold">
                {isMyanmar ? 'အပေါ်လွှဲ/ဖြတ်တင်' : 'Forwarded'}
              </span>
              <span className="font-bold text-indigo-900 text-sm">
                {formatAmount(currentFwdSum, settings.currency)}
              </span>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 px-3 py-2 rounded-xl">
              <span className="text-emerald-700 block text-[10px] uppercase font-sans font-semibold">
                {isMyanmar ? 'ကိုယ်ပိုင်လက်ကျန်' : 'Net Retained'}
              </span>
              <span className="font-bold text-emerald-800 text-sm">
                {formatAmount(currentRetainedSum, settings.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Filter Bar & Search Input */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isMyanmar ? 'ဂဏန်းရှာရန် (ဥပမာ: 789, *89, 7*)' : 'Search digit (e.g. 789, *89)'}
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 font-mono transition-colors shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="md:col-span-5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <span>{isMyanmar ? 'အားလုံး' : 'All'}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filterMode === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {counts.all}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('hot')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'hot'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              <span>{isMyanmar ? 'အရောင်းများ' : 'Hot'}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filterMode === 'hot' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'}`}>
                {counts.hot}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('danger')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'danger'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200'
              }`}
            >
              <span>{isMyanmar ? 'ဘရိတ်ပြည့်' : 'Full Limit'}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filterMode === 'danger' ? 'bg-rose-700 text-white' : 'bg-rose-200 text-rose-900'}`}>
                {counts.danger}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('warning')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'warning'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
              }`}
            >
              <span>{isMyanmar ? 'သတိပေး' : 'Warning'}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filterMode === 'warning' ? 'bg-amber-600 text-white' : 'bg-amber-200 text-amber-900'}`}>
                {counts.warning}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('blocked')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'blocked'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200'
              }`}
            >
              <span>{isMyanmar ? 'ဒိုင်' : 'Blocked'}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filterMode === 'blocked' ? 'bg-purple-800 text-white' : 'bg-purple-200 text-purple-900'}`}>
                {counts.blocked}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('empty')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterMode === 'empty'
                  ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-300'
                  : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200'
              }`}
            >
              <span>{isMyanmar ? 'အလွတ်' : 'Empty'}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filterMode === 'empty' ? 'bg-blue-700 text-white' : 'bg-blue-200 text-blue-800'}`}>
                {counts.empty}
              </span>
            </button>
          </div>

          {/* Sort Selector, Layout Toggle & Excel Button */}
          <div className="md:col-span-3 flex flex-wrap items-center justify-end gap-2">
            {/* View layout toggle: Table vs Grid */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewLayout('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  viewLayout === 'table' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
                title={isMyanmar ? 'ဇယားကွက်ဖြင့် ကြည့်မည်' : 'Table View'}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isMyanmar ? 'ဇယား' : 'Table'}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  viewLayout === 'grid' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
                title={isMyanmar ? 'ဂဏန်းကွက်ဖြင့် ကြည့်မည်' : 'Grid View'}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isMyanmar ? 'ဂဏန်းကွက်' : 'Grid'}</span>
              </button>
            </div>

            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
            >
              <option value="sold_desc">{isMyanmar ? 'ရောင်းအား အများဆုံး' : 'Sold: High to Low'}</option>
              <option value="payout_desc">{isMyanmar ? 'လျော်ကြေး အများဆုံး' : 'Payout: High to Low'}</option>
              <option value="risk_desc">{isMyanmar ? 'အန္တရာယ် အမြင့်ဆုံး' : 'Highest Risk'}</option>
              <option value="num_asc">{isMyanmar ? 'ဂဏန်းစဉ် (၀၀၀ - ၉၉၉)' : 'Number Ascending'}</option>
            </select>

            {onOpenForwardModal && (
              <button
                type="button"
                onClick={() => onOpenForwardModal()}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="သတ်မှတ်ချက်ကျော် ပိုနေသောဂဏန်းများကို စုစည်း၍ ဒိုင်ကြီးဆီ လွှဲတင်မည်"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isMyanmar ? 'ဒိုင်ကြီးဆီတင်မည်' : 'Forward to Master'}</span>
              </button>
            )}

            <button
              onClick={exportToExcel}
              className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-2xs transition-colors cursor-pointer"
              title="Excel ထုတ်မည်"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* Head Digits Filter Bar (0xx မှ 9xx) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <span className="text-xs font-bold text-slate-500 shrink-0 mr-1">
          {isMyanmar ? 'ရာဂဏန်းထိပ်စီး:' : '100s Head:'}
        </span>
        <button
          type="button"
          onClick={() => setSelectedHeadDigit(null)}
          className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
            selectedHeadDigit === null
              ? 'bg-indigo-600 text-white'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
          }`}
        >
          {isMyanmar ? 'အားလုံး' : 'All'}
        </button>
        {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button
            key={d}
            type="button"
            onClick={() => setSelectedHeadDigit(selectedHeadDigit === d ? null : d)}
            className={`px-2.5 py-1 text-xs font-bold font-mono rounded-lg transition-colors cursor-pointer shrink-0 ${
              selectedHeadDigit === d
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            {d}xx
          </button>
        ))}
      </div>

      {/* Results Count & Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 px-1">
        <div>
          {isMyanmar ? 'တွေ့ရှိသော ဂဏန်း အရေအတွက်:' : 'Showing:'}{' '}
          <span className="font-bold text-indigo-700 font-mono">{displayItems.length}</span> ခု
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span>{isMyanmar ? 'စိတ်ချရ (Safe)' : 'Safe'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
            <span>{isMyanmar ? `သတိပေး (${settings.lowStockAlertPercentage}%+)` : 'Warning'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
            <span>{isMyanmar ? 'ဘရိတ်ပြည့် (Danger)' : 'Full Limit'}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-600 inline-block"></span>
            <span>{isMyanmar ? 'ဒိုင်ကာ (Blocked)' : 'Blocked'}</span>
          </span>
          <span className="flex items-center gap-1.5 font-bold text-blue-700">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
            <span>{isMyanmar ? 'အလွတ် (ထိုးကြေးမရှိ)' : 'Empty (No bets)'}</span>
          </span>
        </div>
      </div>

      {viewLayout === 'grid' ? (
        /* 3D Number Matrix Grid View */
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-2.5 sm:gap-3">
            {displayItems.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 font-sans">
                {isMyanmar ? 'ရှာဖွေမှုနှင့် ကိုက်ညီသော ဂဏန်းမရှိပါ' : 'No numbers found matching filter'}
              </div>
            ) : (
              displayItems.map(item => {
                const usagePercent = item.limit > 0 ? Math.min(Math.round((item.totalSold / item.limit) * 100), 100) : 0;
                const isFull = item.limit > 0 && item.totalSold >= item.limit;
                const isEmpty = item.totalSold === 0 && !item.isBlocked;
                const isWinningNumber = activeRound?.winningNumber === item.number;

                return (
                  <div
                    key={item.number}
                    className={`relative rounded-2xl p-3 border transition-all flex flex-col justify-between group cursor-pointer ${
                      isWinningNumber
                        ? 'bg-amber-100/90 border-amber-400 ring-2 ring-amber-300'
                        : item.isBlocked
                        ? 'bg-rose-50/80 border-rose-300 ring-1 ring-rose-200'
                        : isFull
                        ? 'bg-rose-50 border-rose-400 shadow-2xs'
                        : item.riskLevel === 'warning'
                        ? 'bg-amber-50/60 border-amber-300 shadow-2xs'
                        : item.totalSold > 0
                        ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400'
                        : 'bg-blue-50/70 border-blue-200 hover:border-blue-400 hover:bg-blue-100/50 ring-1 ring-blue-100/70 shadow-2xs'
                    }`}
                    onClick={() => onOpenLimitsManager(item.number)}
                  >
                    {/* Number & Tag */}
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-mono text-xl sm:text-2xl font-black ${
                          item.isBlocked
                            ? 'text-rose-700 line-through'
                            : isFull
                            ? 'text-rose-900'
                            : item.riskLevel === 'warning'
                            ? 'text-amber-900'
                            : item.totalSold > 0
                            ? 'text-slate-900'
                            : 'text-blue-700'
                        }`}
                      >
                        {item.number}
                      </span>

                      {item.isBlocked ? (
                        <span className="px-1.5 py-0.5 bg-rose-200 text-rose-900 text-[10px] font-black rounded-md">
                          {isMyanmar ? 'ကာ' : 'BLK'}
                        </span>
                      ) : isFull ? (
                        <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded-md">
                          {isMyanmar ? 'ပြည့်' : 'FULL'}
                        </span>
                      ) : item.riskLevel === 'warning' ? (
                        <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-black rounded-md">
                          {usagePercent}%
                        </span>
                      ) : isEmpty ? (
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-md border border-blue-200">
                          {isMyanmar ? 'အလွတ်' : 'EMPTY'}
                        </span>
                      ) : null}
                    </div>

                    {/* Sold Amount */}
                    <div className="my-1.5">
                      <div className={`font-mono text-xs font-bold ${isEmpty ? 'text-blue-600' : 'text-slate-800'}`}>
                        {isEmpty ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-[11px] text-blue-600">
                            {isMyanmar ? 'ထိုးကြေးမရှိ' : 'No bets (0)'}
                          </span>
                        ) : (
                          formatAmount(item.totalSold, settings.currency)
                        )}
                      </div>
                      <div className={`text-[10px] font-medium ${isEmpty ? 'text-blue-400' : 'text-slate-400'}`}>
                        {isMyanmar ? 'ကန့်သတ်:' : 'Lmt:'} {formatAmount(item.limit, settings.currency)}
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className={`w-full rounded-full h-1.5 overflow-hidden ${isEmpty ? 'bg-blue-100' : 'bg-slate-200'}`}>
                      <div
                        className={`h-full transition-all rounded-full ${
                          item.isBlocked
                            ? 'bg-rose-500'
                            : isFull
                            ? 'bg-rose-600'
                            : item.riskLevel === 'warning'
                            ? 'bg-amber-500'
                            : item.totalSold > 0
                            ? 'bg-emerald-500'
                            : 'bg-blue-400'
                        }`}
                        style={{ width: `${item.isBlocked ? 100 : isEmpty ? 0 : usagePercent}%` }}
                      ></div>
                    </div>

                    {/* Quick actions on hover */}
                    <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBlockNumber(item.number);
                        }}
                        title={item.isBlocked ? 'ဂဏန်း ပြန်ဖွင့်မည်' : 'ဂဏန်း ပိတ်မည် (ဒိုင်ကာ)'}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          item.isBlocked
                            ? 'text-rose-700 hover:bg-rose-200'
                            : 'text-slate-400 hover:text-rose-600 hover:bg-slate-200'
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                      </button>

                      {item.totalSold > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenForwardModal(item.number, Math.max(0, item.totalSold - (item.limit || 0)));
                          }}
                          title="အပေါ်သို့ လွှဲတင်မည်"
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Ledger Table */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">{isMyanmar ? 'ဂဏန်း' : 'Number'}</th>
                  <th className="py-3 px-4">{isMyanmar ? 'ရောင်းရငွေ' : 'Total Sold'}</th>
                  <th className="py-3 px-4">{isMyanmar ? 'အပေါ်လွှဲငွေ' : 'Forwarded'}</th>
                  <th className="py-3 px-4">{isMyanmar ? 'လက်ကျန်တာဝန်' : 'Retained'}</th>
                  <th className="py-3 px-4">{isMyanmar ? 'ကန့်သတ်ဘရိတ်' : 'Limit / Usage'}</th>
                  <th className="py-3 px-4">{isMyanmar ? 'ပေါက်ပါက လျော်ကြေး' : 'Est. Payout'}</th>
                  <th className="py-3 px-4">{isMyanmar ? 'အခြေအနေ' : 'Status'}</th>
                  <th className="py-3 px-4 text-right">{isMyanmar ? 'လုပ်ဆောင်ချက်' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {displayItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500 font-sans">
                      {isMyanmar ? 'ရှာဖွေမှုနှင့် ကိုက်ညီသော ဂဏန်းမရှိပါ' : 'No numbers found matching filter'}
                    </td>
                  </tr>
                ) : (
                  displayItems.map((item) => {
                    const usagePct = item.limit > 0 ? Math.round((item.totalSold / item.limit) * 100) : 0;
                    const isWinningNumber = activeRound?.winningNumber === item.number;
                    const isEmpty = item.totalSold === 0 && !item.isBlocked;

                    return (
                      <tr
                        key={item.number}
                        className={`transition-colors ${
                          isWinningNumber
                            ? 'bg-amber-50/80 border-l-4 border-l-amber-500'
                            : isEmpty
                            ? 'bg-blue-50/25 hover:bg-blue-50/60'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Number Badge */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-1 rounded-lg text-sm font-black tracking-widest ${
                              item.isBlocked
                                ? 'bg-slate-100 text-slate-400 line-through border border-slate-200'
                                : isWinningNumber
                                ? 'bg-amber-400 text-slate-950 font-black ring-2 ring-amber-300 animate-pulse'
                                : isEmpty
                                ? 'bg-blue-50 text-blue-700 border border-blue-200 ring-1 ring-blue-300'
                                : 'bg-slate-100 text-indigo-950 border border-slate-200'
                            }`}>
                              {item.number}
                            </span>
                            {isWinningNumber && (
                              <span className="text-[10px] font-sans font-bold bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded">
                                ပေါက်ဂဏန်း
                              </span>
                            )}
                            {item.betCount > 0 && (
                              <span className="text-[10px] text-slate-500 font-sans">
                                ({item.betCount} စောင်)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Total Sold */}
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {isEmpty ? (
                            <span className="text-blue-600 font-semibold text-xs inline-flex items-center gap-1">
                              {isMyanmar ? 'ထိုးကြေးမရှိ' : 'No bets (0)'}
                            </span>
                          ) : (
                            formatAmount(item.totalSold, settings.currency)
                          )}
                        </td>

                        {/* Forwarded */}
                        <td className="py-3 px-4 font-medium text-indigo-700">
                          {item.forwardedAmount > 0 ? (
                            <span className="flex items-center gap-1">
                              <ArrowUpRight className="w-3.5 h-3.5 text-indigo-600" />
                              {formatAmount(item.forwardedAmount, settings.currency)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Retained */}
                        <td className="py-3 px-4 font-bold text-emerald-700">
                          {formatAmount(item.retainedAmount, settings.currency)}
                        </td>

                        {/* Limit & Progress */}
                        <td className="py-3 px-4">
                          <div className="space-y-1 max-w-[130px]">
                            <div className="flex justify-between text-[11px]">
                              <span className={isEmpty ? 'text-blue-400' : 'text-slate-500'}>
                                {item.limit > 0 ? formatAmount(item.limit, settings.currency) : 'ကန့်သတ်မရှိ'}
                              </span>
                              {item.limit > 0 && (
                                <span className={`font-bold ${
                                  usagePct >= 100 ? 'text-rose-600' : usagePct >= 80 ? 'text-amber-600' : isEmpty ? 'text-blue-500' : 'text-slate-500'
                                }`}>
                                  {usagePct}%
                                </span>
                              )}
                            </div>
                            {item.limit > 0 && (
                              <div className={`w-full rounded-full h-1.5 overflow-hidden ${isEmpty ? 'bg-blue-100' : 'bg-slate-100'}`}>
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    item.isBlocked
                                      ? 'bg-rose-500'
                                      : usagePct >= 100
                                      ? 'bg-rose-500'
                                      : usagePct >= settings.lowStockAlertPercentage
                                      ? 'bg-amber-400'
                                      : item.totalSold > 0
                                      ? 'bg-emerald-500'
                                      : 'bg-blue-300'
                                  }`}
                                  style={{ width: `${Math.min(100, usagePct)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Est Payout */}
                        <td className="py-3 px-4 font-bold text-rose-600">
                          {item.estimatedPayout > 0 ? (
                            <span>{formatAmount(item.estimatedPayout, settings.currency)}</span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 font-sans">
                          {item.isBlocked ? (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                              <Lock className="w-3 h-3" />
                              <span>ပိတ်ထားသည်</span>
                            </span>
                          ) : item.riskLevel === 'danger' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-semibold">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>ဘရိတ်ပြည့်</span>
                            </span>
                          ) : item.riskLevel === 'warning' ? (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                              <Info className="w-3 h-3 text-amber-600" />
                              <span>ဘရိတ်နီး</span>
                            </span>
                          ) : isEmpty ? (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                              <Sparkles className="w-3 h-3 text-blue-500" />
                              <span>{isMyanmar ? 'အလွတ်' : 'Empty'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>စိတ်ချရ</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 font-sans">
                            {/* Forward / Offload button */}
                            <button
                              onClick={() => onOpenForwardModal(item.number, Math.max(0, item.totalSold - (item.limit || 0)))}
                              className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                              title="အပေါ်သို့ လွှဲတင်မည် (Forward/Offload)"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>

                            {/* Set Limit */}
                            <button
                              onClick={() => onOpenLimitsManager(item.number)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer"
                              title="ဘရိတ် သတ်မှတ်မည်"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>

                            {/* Block/Unblock toggle */}
                            <button
                              onClick={() => toggleBlockNumber(item.number)}
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                item.isBlocked
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200'
                              }`}
                              title={item.isBlocked ? 'ဂဏန်း ပြန်ဖွင့်မည်' : 'ဂဏန်း ပိတ်မည်'}
                            >
                              {item.isBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
