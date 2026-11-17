import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Sliders,
  Lock,
  Unlock,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Download,
  Info,
  LayoutGrid,
  List,
  Send,
  Star,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { formatAmount } from '../utils/lotteryUtils';
import { NumberAggregate } from '../types';
import { ThreeDSmartCapAdvisory } from './ThreeDSmartCapAdvisory';

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
    limits,
    blockedNumbers,
    toggleBlockNumber,
    exportToExcel
  } = useLottery();

  const isMyanmar = settings.language === 'my';

  // Filters & Layout
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'hot' | 'danger' | 'warning' | 'blocked' | 'empty'>('all');
  const [selectedHeadDigit, setSelectedHeadDigit] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'num_asc' | 'sold_desc' | 'risk_desc' | 'payout_desc'>('num_asc');
  const [viewLayout, setViewLayout] = useState<'grid' | 'table'>('grid');

  // Pagination for smooth rendering of 1,000 numbers (100 per page = 10x10 matrix)
  const PAGE_SIZE = 100;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Master 000-999 list generation
  const all1000Numbers = useMemo(() => {
    const list: NumberAggregate[] = [];
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

  // Excess over-limit numbers count for batch master forwarding
  const excessCount = useMemo(() => {
    return (Object.values(aggregates) as NumberAggregate[]).filter(
      (a) => a.limit > 0 && Math.max(0, a.totalSold - (a.forwardedAmount || 0)) > a.limit
    ).length;
  }, [aggregates]);

  // Max sold for identifying highest bet cell
  const maxSold3D = useMemo(() => {
    const vals = (Object.values(aggregates) as NumberAggregate[]).map((a) => a.totalSold);
    return Math.max(...vals, 0);
  }, [aggregates]);

  // Category counts
  const counts = useMemo(() => {
    let all = 0, hot = 0, danger = 0, warning = 0, blocked = 0, empty = 0;
    for (let i = 0; i < all1000Numbers.length; i++) {
      const a = all1000Numbers[i];
      all++;
      if (a.isBlocked) {
        blocked++;
      } else if (a.riskLevel === 'danger' || (a.limit > 0 && a.totalSold >= a.limit)) {
        danger++;
      } else if (a.riskLevel === 'warning') {
        warning++;
      }
      if (a.totalSold > 0) hot++;
      if (a.totalSold === 0) empty++;
    }
    return { all, hot, danger, warning, blocked, empty };
  }, [all1000Numbers]);

  // Filtered & Sorted items
  const displayItems = useMemo(() => {
    let baseList = all1000Numbers;

    if (filterMode === 'hot') {
      baseList = baseList.filter((a) => a.totalSold > 0);
    } else if (filterMode === 'danger') {
      baseList = baseList.filter((a) => (a.riskLevel === 'danger' || (a.limit > 0 && a.totalSold >= a.limit)) && !a.isBlocked);
    } else if (filterMode === 'warning') {
      baseList = baseList.filter((a) => a.riskLevel === 'warning' && !a.isBlocked);
    } else if (filterMode === 'blocked') {
      baseList = baseList.filter((a) => a.isBlocked);
    } else if (filterMode === 'empty') {
      baseList = baseList.filter((a) => a.totalSold === 0);
    }

    if (selectedHeadDigit !== null) {
      baseList = baseList.filter((item) => item.number.startsWith(selectedHeadDigit));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      baseList = baseList.filter((item) => {
        if (q.startsWith('*')) return item.number.endsWith(q.slice(1));
        if (q.endsWith('*')) return item.number.startsWith(q.slice(0, -1));
        return item.number.includes(q);
      });
    }

    return [...baseList].sort((a, b) => {
      if (sortBy === 'sold_desc') return b.totalSold - a.totalSold || a.number.localeCompare(b.number);
      if (sortBy === 'payout_desc') return b.estimatedPayout - a.estimatedPayout || a.number.localeCompare(b.number);
      if (sortBy === 'risk_desc') {
        const riskScore = { danger: 3, warning: 2, safe: 1 };
        return (riskScore[b.riskLevel] || 0) - (riskScore[a.riskLevel] || 0) || b.totalSold - a.totalSold;
      }
      return a.number.localeCompare(b.number);
    });
  }, [filterMode, all1000Numbers, selectedHeadDigit, searchQuery, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMode, selectedHeadDigit, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(displayItems.length / PAGE_SIZE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return displayItems.slice(start, start + PAGE_SIZE);
  }, [displayItems, currentPage]);

  // Summary metrics
  const currentSoldSum = useMemo(() => {
    return (Object.values(aggregates) as NumberAggregate[]).reduce((acc, a) => acc + a.totalSold, 0);
  }, [aggregates]);

  const currentFwdSum = useMemo(() => {
    return (Object.values(aggregates) as NumberAggregate[]).reduce((acc, a) => acc + a.forwardedAmount, 0);
  }, [aggregates]);

  const currentRetainedSum = useMemo(() => {
    return (Object.values(aggregates) as NumberAggregate[]).reduce((acc, a) => acc + a.retainedAmount, 0);
  }, [aggregates]);

  const getSuggestedForwardAmount = (item: NumberAggregate) => {
    const netSold = Math.max(0, item.totalSold - (item.forwardedAmount || 0));
    if (item.limit > 0 && netSold > item.limit) {
      return netSold - item.limit;
    }
    return netSold;
  };

  return (
    <div className="max-w-7xl mx-auto p-2.5 sm:p-4 space-y-3">
      {/* Top Smart Safe Cap Advisory */}
      <ThreeDSmartCapAdvisory onOpenLimitsManager={onOpenLimitsManager} />

      {/* Top Controls & Metrics Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{isMyanmar ? 'အိုးစည်လေး (3D) စာရင်းချုပ် (၀၀၀-၉၉၉)' : '3D Live Ledger (000-999)'}</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              {isMyanmar
                ? 'ဂဏန်းတစ်ခုချင်း လော့ချ/ဖွင့်၊ ဘရိတ်သတ်မှတ် နှင့် အထက်တင် လုပ်ဆောင်နိုင်သည်'
                : 'Per-number lock, limit cap, and master forwarding'}
            </p>
          </div>

          {/* Compact Metrics */}
          <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
            <div className="bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
              <span className="text-slate-500 block text-[10px] font-sans font-semibold whitespace-nowrap">
                {isMyanmar ? 'စုစုပေါင်းရောင်း' : 'Total Gross'}
              </span>
              <span className="font-black text-slate-900 text-xs sm:text-sm">
                {formatAmount(currentSoldSum, settings.currency)}
              </span>
            </div>

            <div className="bg-indigo-50/70 border border-indigo-200 px-2.5 py-1.5 rounded-xl">
              <span className="text-indigo-700 block text-[10px] font-sans font-semibold whitespace-nowrap">
                {isMyanmar ? 'အထက်တင်ပြီး' : 'Forwarded'}
              </span>
              <span className="font-black text-indigo-900 text-xs sm:text-sm">
                {formatAmount(currentFwdSum, settings.currency)}
              </span>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-200 px-2.5 py-1.5 rounded-xl">
              <span className="text-emerald-700 block text-[10px] font-sans font-semibold whitespace-nowrap">
                {isMyanmar ? 'ကိုယ်ပိုင်လက်ကျန်' : 'Retained'}
              </span>
              <span className="font-black text-emerald-800 text-xs sm:text-sm">
                {formatAmount(currentRetainedSum, settings.currency)}
              </span>
            </div>
          </div>
        </div>

        {/* Filter Bar, Search & Global Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Status Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: 'all', label: isMyanmar ? 'အားလုံး' : 'All', count: counts.all, activeCls: 'bg-slate-900 text-white border-slate-900', idleCls: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200' },
              { id: 'hot', label: isMyanmar ? 'အရောင်းရှိ' : 'Sold', count: counts.hot, activeCls: 'bg-amber-600 text-white border-amber-600', idleCls: 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200' },
              { id: 'danger', label: isMyanmar ? 'ဘရိတ်ပြည့်' : 'Full', count: counts.danger, activeCls: 'bg-rose-600 text-white border-rose-600', idleCls: 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200' },
              { id: 'warning', label: isMyanmar ? 'သတိပေး' : 'Warn', count: counts.warning, activeCls: 'bg-amber-500 text-white border-amber-500', idleCls: 'bg-amber-50/70 hover:bg-amber-100 text-amber-800 border-amber-200' },
              { id: 'blocked', label: isMyanmar ? 'လော့ပိတ်' : 'Locked', count: counts.blocked, activeCls: 'bg-purple-700 text-white border-purple-700', idleCls: 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-200' },
              { id: 'empty', label: isMyanmar ? 'အလွတ်' : 'Empty', count: counts.empty, activeCls: 'bg-blue-600 text-white border-blue-600', idleCls: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200' }
            ].map((f) => {
              const isActive = filterMode === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilterMode(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0 ${
                    isActive ? f.activeCls : f.idleCls
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`text-[10px] font-mono tabular-nums px-1 rounded ${isActive ? 'bg-black/20 text-white' : 'bg-white/80 text-slate-700'}`}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search, View Toggle, Sort, Master Forward, Excel */}
          <div className="flex flex-wrap items-center gap-1.5 justify-end">
            <div className="relative flex-1 sm:w-40 min-w-[130px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isMyanmar ? 'ဂဏန်းရှာ (789, *89)' : 'Search 789...'}
                className="w-full h-8 bg-slate-50 focus:bg-white border border-slate-200 rounded-lg pl-8 pr-6 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 font-mono"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1.5 text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Grid vs Table Layout Toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setViewLayout('grid')}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                  viewLayout === 'grid' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
                title={isMyanmar ? 'ဂဏန်းကွက်ဖြင့် ကြည့်မည်' : 'Grid View'}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isMyanmar ? 'အကွက်' : 'Grid'}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('table')}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                  viewLayout === 'table' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
                title={isMyanmar ? 'ဇယားဖြင့် ကြည့်မည်' : 'Table View'}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isMyanmar ? 'ဇယား' : 'Table'}</span>
              </button>
            </div>

            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="h-8 bg-slate-50 border border-slate-200 rounded-lg px-2 text-[11px] font-bold text-slate-700 outline-none focus:border-indigo-500 cursor-pointer shrink-0"
            >
              <option value="num_asc">{isMyanmar ? 'ဂဏန်းစဉ် (၀၀၀-၉၉၉)' : '000 - 999'}</option>
              <option value="sold_desc">{isMyanmar ? 'ရောင်းအားများစဉ်' : 'Sold: High-Low'}</option>
              <option value="payout_desc">{isMyanmar ? 'လျော်ကြေးများစဉ်' : 'Payout: High-Low'}</option>
              <option value="risk_desc">{isMyanmar ? 'အန္တရာယ်များစဉ်' : 'Risk: High-Low'}</option>
            </select>

            <button
              type="button"
              onClick={() => onOpenForwardModal()}
              className="h-8 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="သတ်မှတ်ချက်ကျော် ပိုနေသောဂဏန်းများကို စုစည်း၍ ဒိုင်ကြီးဆီ လွှဲတင်မည်"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isMyanmar ? 'ဒိုင်ကြီးဆီတင်' : 'Forward'}</span>
              {excessCount > 0 && (
                <span className="bg-amber-400 text-slate-950 font-black font-mono text-[10px] px-1.5 rounded-full">
                  {excessCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={exportToExcel}
              className="h-8 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Excel ထုတ်မည်"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Head Digits Filter Bar (0xx to 9xx) */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
        <span className="text-[11px] font-bold text-slate-500 shrink-0 mr-1 whitespace-nowrap">
          {isMyanmar ? 'ထိပ်စီး:' : 'Head:'}
        </span>
        <button
          type="button"
          onClick={() => setSelectedHeadDigit(null)}
          className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            selectedHeadDigit === null
              ? 'bg-indigo-600 text-white'
              : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
          }`}
        >
          {isMyanmar ? 'အားလုံး' : 'All'}
        </button>
        {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setSelectedHeadDigit(selectedHeadDigit === d ? null : d)}
            className={`px-2 py-1 text-[11px] font-bold font-mono rounded-lg transition-colors cursor-pointer shrink-0 ${
              selectedHeadDigit === d
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
            }`}
          >
            {d}xx
          </button>
        ))}
      </div>

      {/* Results Count & Action Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 px-1">
        <div className="font-medium">
          {isMyanmar ? 'ဂဏန်းစုစုပေါင်း:' : 'Showing:'}{' '}
          <span className="font-bold text-indigo-700 font-mono tabular-nums">{displayItems.length}</span>{' '}
          {isMyanmar ? 'ခု' : ''}
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-[10px] text-slate-600">
          <span className="inline-flex items-center gap-1 font-semibold">
            <Lock className="w-3 h-3 text-rose-600" />
            <span>{isMyanmar ? 'လော့' : 'Lock'}</span>
          </span>
          <span className="inline-flex items-center gap-1 font-semibold">
            <Sliders className="w-3 h-3 text-amber-600" />
            <span>{isMyanmar ? 'ဘရိတ်သတ်မှတ်' : 'Limit'}</span>
          </span>
          <span className="inline-flex items-center gap-1 font-semibold">
            <ArrowUpRight className="w-3 h-3 text-indigo-600" />
            <span>{isMyanmar ? 'အထက်တင်' : 'Forward'}</span>
          </span>
          <span className="text-slate-300">|</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>{isMyanmar ? 'စိတ်ချရ' : 'Safe'}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span>{isMyanmar ? 'သတိပေး' : 'Warn'}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>{isMyanmar ? 'ပြည့်/ပိတ်' : 'Full/Lock'}</span>
          </span>
        </div>
      </div>

      {viewLayout === 'grid' ? (
        /* Ultra-Compact 3D Matrix Grid View (10 columns on desktop) */
        <div className="bg-white rounded-2xl p-2 sm:p-3 border border-slate-200 shadow-xs">
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-2">
            {displayItems.length === 0 ? (
              <div className="col-span-full py-10 text-center text-xs text-slate-500 font-sans">
                {isMyanmar ? 'ရှာဖွေမှုနှင့် ကိုက်ညီသော ဂဏန်းမရှိပါ' : 'No numbers found matching filter'}
              </div>
            ) : (
              paginatedItems.map((item) => {
                const usagePercent = item.limit > 0 ? Math.min(Math.round((item.totalSold / item.limit) * 100), 100) : 0;
                const isFull = item.limit > 0 && item.totalSold >= item.limit;
                const isEmpty = item.totalSold === 0 && !item.isBlocked;
                const isWinningNumber = activeRound?.winningNumber === item.number;
                const isTopBet = maxSold3D > 0 && item.totalSold === maxSold3D;
                const netSold = Math.max(0, item.totalSold - (item.forwardedAmount || 0));
                const isOverNetLimit = item.limit > 0 && netSold > item.limit;
                const forwardAmt = getSuggestedForwardAmount(item);

                return (
                  <div
                    key={item.number}
                    onClick={() => onOpenLimitsManager(item.number)}
                    className={`rounded-xl p-1.5 sm:p-2 border transition-colors flex flex-col justify-between cursor-pointer ${
                      isWinningNumber
                        ? 'bg-amber-100 border-amber-400'
                        : item.isBlocked
                        ? 'bg-rose-50/90 border-rose-300'
                        : isFull
                        ? 'bg-rose-50/70 border-rose-300'
                        : item.riskLevel === 'warning'
                        ? 'bg-amber-50/70 border-amber-300'
                        : isTopBet
                        ? 'bg-amber-50/60 border-amber-400'
                        : item.totalSold > 0
                        ? 'bg-emerald-50/40 border-emerald-200 hover:border-emerald-400'
                        : 'bg-blue-50/90 border-blue-300 hover:border-blue-500'
                    }`}
                  >
                    {/* Top: Number & Micro Status Badge */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-0.5 min-w-0">
                        <span
                          className={`font-mono text-sm sm:text-base font-black tabular-nums leading-none ${
                            item.isBlocked
                              ? 'text-rose-700 line-through'
                              : isFull
                              ? 'text-rose-800'
                              : item.riskLevel === 'warning'
                              ? 'text-amber-900'
                              : item.totalSold > 0
                              ? 'text-slate-900'
                              : 'text-blue-700'
                          }`}
                        >
                          {item.number}
                        </span>
                        {isTopBet && <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />}
                      </div>

                      {item.isBlocked ? (
                        <span className="px-1 py-0.5 bg-rose-200 text-rose-900 text-[9px] font-black rounded leading-none shrink-0">
                          {isMyanmar ? 'လော့' : 'LCK'}
                        </span>
                      ) : isWinningNumber ? (
                        <span className="px-1 py-0.5 bg-amber-400 text-slate-950 text-[9px] font-black rounded leading-none shrink-0">
                          {isMyanmar ? 'ပေါက်' : 'WIN'}
                        </span>
                      ) : isFull ? (
                        <span className="px-1 py-0.5 bg-rose-600 text-white text-[9px] font-black rounded leading-none shrink-0">
                          {isMyanmar ? 'ပြည့်' : 'FULL'}
                        </span>
                      ) : item.riskLevel === 'warning' ? (
                        <span className="px-1 py-0.5 bg-amber-500 text-white text-[9px] font-black font-mono tabular-nums rounded leading-none shrink-0">
                          {usagePercent}%
                        </span>
                      ) : null}
                    </div>

                    {/* Middle: Compact Sold & Limit */}
                    <div className="mt-1 space-y-0.5">
                      <div className={`font-mono text-[11px] font-bold tabular-nums leading-tight truncate ${
                        isEmpty ? 'text-blue-500' : 'text-slate-900'
                      }`}>
                        {item.totalSold > 0 ? formatAmount(item.totalSold, '') : '0'}
                      </div>
                      <div className={`flex items-center justify-between gap-1 text-[9px] font-mono tabular-nums leading-none ${
                        isEmpty ? 'text-blue-400' : 'text-slate-400'
                      }`}>
                        <span className="truncate">
                          /{item.limit > 0 ? formatAmount(item.limit, '') : '∞'}
                        </span>
                        {item.forwardedAmount > 0 && (
                          <span className="text-indigo-600 font-bold shrink-0">
                            ↑{formatAmount(item.forwardedAmount, '')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hairline Progress Bar */}
                    <div className="w-full rounded-full h-1 bg-slate-200/80 overflow-hidden my-1">
                      <div
                        className={`h-full rounded-full transition-all ${
                          item.isBlocked
                            ? 'bg-rose-500'
                            : isFull
                            ? 'bg-rose-600'
                            : item.riskLevel === 'warning'
                            ? 'bg-amber-500'
                            : item.totalSold > 0
                            ? 'bg-emerald-500'
                            : 'bg-transparent'
                        }`}
                        style={{ width: `${item.isBlocked ? 100 : isEmpty ? 0 : usagePercent}%` }}
                      />
                    </div>

                    {/* Bottom: Uniform 3 Per-Number Actions (Lock, Set Limit, Forward) */}
                    <div className="pt-1 border-t border-slate-200/70 grid grid-cols-3 gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBlockNumber(item.number);
                        }}
                        title={item.isBlocked ? 'လော့ဖွင့်မည်' : 'လော့ချမည် (ဒိုင်ကာ)'}
                        className={`h-6 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${
                          item.isBlocked
                            ? 'bg-rose-100 border-rose-300 text-rose-700 hover:bg-rose-200'
                            : 'bg-white border-slate-200 text-slate-500 hover:text-rose-700 hover:border-rose-200 hover:bg-rose-50'
                        }`}
                      >
                        {item.isBlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenLimitsManager(item.number);
                        }}
                        title="ဘရိတ်သတ်မှတ်မည်"
                        className="h-6 rounded-md flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:text-amber-700 hover:border-amber-300 hover:bg-amber-50 transition-colors cursor-pointer"
                      >
                        <Sliders className="w-3 h-3" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenForwardModal(item.number, forwardAmt);
                        }}
                        title="အထက်တင်မည်"
                        className={`h-6 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${
                          isOverNetLimit
                            ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                            : 'bg-white border-slate-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300'
                        }`}
                      >
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* Compact 3D Ledger Table */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 whitespace-nowrap">
                <tr>
                  <th className="py-2 px-3">{isMyanmar ? 'ဂဏန်း' : 'No.'}</th>
                  <th className="py-2 px-3 text-right">{isMyanmar ? 'ရောင်းရငွေ' : 'Sold'}</th>
                  <th className="py-2 px-3 text-right">{isMyanmar ? 'အထက်တင်' : 'Fwd'}</th>
                  <th className="py-2 px-3 text-right">{isMyanmar ? 'လက်ကျန်' : 'Retained'}</th>
                  <th className="py-2 px-3">{isMyanmar ? 'ဘရိတ် / %' : 'Limit / %'}</th>
                  <th className="py-2 px-3 text-right">{isMyanmar ? 'လျော်ကြေး' : 'Est. Payout'}</th>
                  <th className="py-2 px-3">{isMyanmar ? 'အခြေအနေ' : 'Status'}</th>
                  <th className="py-2 px-3 text-right">{isMyanmar ? 'လော့ / ဘရိတ် / တင်' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {displayItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500 font-sans">
                      {isMyanmar ? 'ရှာဖွေမှုနှင့် ကိုက်ညီသော ဂဏန်းမရှိပါ' : 'No numbers found matching filter'}
                    </td>
                  </tr>
                ) : (
                  paginatedItems.map((item) => {
                    const usagePct = item.limit > 0 ? Math.round((item.totalSold / item.limit) * 100) : 0;
                    const isWinningNumber = activeRound?.winningNumber === item.number;
                    const isTopBet = maxSold3D > 0 && item.totalSold === maxSold3D;
                    const isEmpty = item.totalSold === 0 && !item.isBlocked;
                    const forwardAmt = getSuggestedForwardAmount(item);

                    return (
                      <tr
                        key={item.number}
                        className={`transition-colors ${
                          isWinningNumber
                            ? 'bg-amber-50/90'
                            : isTopBet
                            ? 'bg-amber-50/40'
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md text-xs font-black tracking-wider border ${
                                item.isBlocked
                                  ? 'bg-rose-50 text-rose-700 border-rose-200 line-through'
                                  : isWinningNumber
                                  ? 'bg-amber-400 text-slate-950 border-amber-500'
                                  : isEmpty
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-indigo-50 text-indigo-950 border-indigo-200'
                              }`}
                            >
                              {item.number}
                            </span>
                            {isTopBet && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500 shrink-0" />}
                            {item.betCount > 0 && (
                              <span className="text-[10px] text-slate-400 font-sans">
                                ({item.betCount})
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                          {item.totalSold > 0 ? (
                            formatAmount(item.totalSold, settings.currency)
                          ) : (
                            <span className="text-slate-400 font-normal">0</span>
                          )}
                        </td>

                        <td className="py-1.5 px-3 text-right font-medium text-indigo-700">
                          {item.forwardedAmount > 0 ? formatAmount(item.forwardedAmount, settings.currency) : <span className="text-slate-300">-</span>}
                        </td>

                        <td className="py-1.5 px-3 text-right font-bold text-emerald-700">
                          {item.retainedAmount > 0 ? formatAmount(item.retainedAmount, settings.currency) : <span className="text-slate-300">-</span>}
                        </td>

                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-2 min-w-[110px] max-w-[140px]">
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  item.isBlocked
                                    ? 'bg-rose-500'
                                    : usagePct >= 100
                                    ? 'bg-rose-500'
                                    : usagePct >= settings.lowStockAlertPercentage
                                    ? 'bg-amber-400'
                                    : item.totalSold > 0
                                    ? 'bg-emerald-500'
                                    : 'bg-transparent'
                                }`}
                                style={{ width: `${Math.min(100, usagePct)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-500 whitespace-nowrap">
                              {item.limit > 0 ? `${formatAmount(item.limit, '')} (${usagePct}%)` : '∞'}
                            </span>
                          </div>
                        </td>

                        <td className="py-1.5 px-3 text-right font-bold text-rose-600">
                          {item.estimatedPayout > 0 ? formatAmount(item.estimatedPayout, settings.currency) : <span className="text-slate-300">-</span>}
                        </td>

                        <td className="py-1.5 px-3 font-sans whitespace-nowrap">
                          {item.isBlocked ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                              <Lock className="w-2.5 h-2.5" />
                              <span>{isMyanmar ? 'လော့' : 'Locked'}</span>
                            </span>
                          ) : item.riskLevel === 'danger' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>{isMyanmar ? 'ပြည့်' : 'Full'}</span>
                            </span>
                          ) : item.riskLevel === 'warning' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold">
                              <Info className="w-2.5 h-2.5" />
                              <span>{isMyanmar ? 'သတိ' : 'Warn'}</span>
                            </span>
                          ) : isEmpty ? (
                            <span className="text-[10px] text-blue-600 font-medium">
                              {isMyanmar ? 'အလွတ်' : 'Empty'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>{isMyanmar ? 'စိတ်ချ' : 'Safe'}</span>
                            </span>
                          )}
                        </td>

                        <td className="py-1.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1 font-sans">
                            <button
                              type="button"
                              onClick={() => toggleBlockNumber(item.number)}
                              className={`p-1 rounded-md border transition-colors cursor-pointer ${
                                item.isBlocked
                                  ? 'bg-rose-100 hover:bg-rose-200 text-rose-700 border-rose-300'
                                  : 'bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border-slate-200'
                              }`}
                              title={item.isBlocked ? 'လော့ဖွင့်မည်' : 'လော့ချမည် (ဒိုင်ကာ)'}
                            >
                              {item.isBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenLimitsManager(item.number)}
                              className="p-1 rounded-md bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 transition-colors cursor-pointer"
                              title="ဘရိတ်သတ်မှတ်မည်"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenForwardModal(item.number, forwardAmt)}
                              className="p-1 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                              title="အထက်တင်မည်"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
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

      {/* Pagination Controls for smooth 3D Navigation */}
      {totalPages > 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-2.5 sm:p-3 shadow-xs flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-slate-500 font-mono tabular-nums">
            {isMyanmar
              ? `စာမျက်နှာ ${currentPage}/${totalPages} (${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, displayItems.length)} / ${displayItems.length})`
              : `Page ${currentPage}/${totalPages} (${(currentPage - 1) * PAGE_SIZE + 1}-${Math.min(currentPage * PAGE_SIZE, displayItems.length)} of ${displayItems.length})`}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>{isMyanmar ? 'ရှေ့' : 'Prev'}</span>
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1];
                  const hasGap = prev && p - prev > 1;
                  return (
                    <React.Fragment key={p}>
                      {hasGap && <span className="text-slate-400 px-1 text-xs">...</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`w-7 h-7 rounded-lg text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                          currentPage === p
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 cursor-pointer transition-colors"
            >
              <span>{isMyanmar ? 'နောက်' : 'Next'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
