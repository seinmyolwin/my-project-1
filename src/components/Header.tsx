import React, { useState } from 'react';
import {
  Sparkles,
  Calendar,
  AlertTriangle,
  FileSpreadsheet,
  Settings,
  PlusCircle,
  Bell,
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  HelpCircle,
  Database,
  Trophy,
  Sliders,
  Layers,
  Activity,
  Edit3,
  MessageSquare,
  Lock,
  Bot,
  RotateCcw,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { formatAmount } from '../utils/lotteryUtils';
import { PWAInstallButton } from './PWAInstallButton';
import { BookieMode } from '../types';
import { getTelegramOrders } from '../utils/telegramIntegration';
import { getViberOrders } from '../utils/viberIntegration';
import { AppLogo } from './AppLogo';

import { EnabledModes } from '../utils/securityUtils';

interface HeaderProps {
  dealerMode: BookieMode;
  setDealerMode: (mode: BookieMode) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  enabledModes?: EnabledModes;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
  onOpenRoundManager: () => void;
  onOpenLimitsManager: () => void;
  onOpenForwardModal: () => void;
  onOpenBackupModal: () => void;
  onOpenHelp: () => void;
  onOpenStatements?: () => void;
  onOpenPreviousResults?: () => void;
  onOpenTitleModal?: () => void;
  onOpenViberHub?: () => void;
  onOpenTelegramHub?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  dealerMode,
  setDealerMode,
  activeTab,
  setActiveTab,
  enabledModes = { '3d': true, '2d': true, 'football': true },
  onOpenSettings,
  onOpenNotifications,
  onOpenRoundManager,
  onOpenLimitsManager,
  onOpenForwardModal,
  onOpenBackupModal,
  onOpenHelp,
  onOpenStatements,
  onOpenPreviousResults,
  onOpenTitleModal,
  onOpenViberHub,
  onOpenTelegramHub
}) => {
  // Contexts
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  const telegramPendingCount = React.useMemo(() => {
    try {
      const orders = getTelegramOrders();
      return orders.filter(o => o.status === 'pending_review').length;
    } catch {
      return 0;
    }
  }, []);

  const viberPendingCount = React.useMemo(() => {
    try {
      const orders = getViberOrders();
      return orders.filter(o => o.status === 'pending_review').length;
    } catch {
      return 0;
    }
  }, []);

  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('bookie_header_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleHeaderCollapse = () => {
    setIsHeaderCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('bookie_header_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const isMyanmar =
    dealerMode === '3d'
      ? lottery3D.settings.language === 'my'
      : dealerMode === '2d'
      ? lottery2D.settings.language === 'my'
      : football.settings.language === 'my';

  // Metrics for current active mode
  let shopName = '';
  let revenue = 0;
  let isSettled = false;
  let isProfit = true;
  let netOutcome = 0;
  let alertCount = 0;
  let currency = 'MMK';

  if (dealerMode === '3d') {
    shopName = lottery3D.settings.shopName?.trim() || '';
    revenue = lottery3D.roundSummary.netRevenue;
    isSettled = lottery3D.activeRound?.status === 'settled';
    isProfit = lottery3D.roundSummary.isProfit;
    netOutcome = lottery3D.roundSummary.netProfit;
    alertCount = lottery3D.lowStockAlerts.length;
    currency = lottery3D.settings.currency;
  } else if (dealerMode === '2d') {
    shopName = lottery2D.settings.shopName?.trim() || '';
    revenue = lottery2D.roundSummary.netRevenue;
    isSettled = lottery2D.activeRound?.status === 'settled';
    isProfit = lottery2D.roundSummary.isProfit;
    netOutcome = lottery2D.roundSummary.netProfit;
    alertCount = lottery2D.lowStockAlerts.length;
    currency = lottery2D.settings.currency;
  } else {
    shopName = football.settings.shopName?.trim() || '';
    revenue = football.summary.netRevenue;
    isSettled = football.summary.wonTicketsCount > 0 || football.summary.lostTicketsCount > 0;
    isProfit = football.summary.isProfit;
    netOutcome = football.summary.netProfit;
    alertCount = 0;
    currency = football.settings.currency;
  }

  const handleExport = () => {
    if (dealerMode === '3d') lottery3D.exportToExcel();
    else if (dealerMode === '2d') lottery2D.exportToExcel();
    else football.exportToExcel();
  };

  const latestSettled2D = lottery2D.rounds.find((r) => r.status === 'settled' || !!r.winningNumber);
  const latestSettled3D = lottery3D.rounds.find((r) => r.status === 'settled' || !!r.winningNumber);
  const latestFinishedFB = football.matches.find((m) => m.status === 'finished');

  return (
    <header className="bg-white border-b border-slate-200 text-slate-900 sticky top-0 z-30 shadow-xs">
      {!isHeaderCollapsed && (
        <>
          {/* Top Dealer Mode Switcher Bar */}
          <div className="bg-slate-900 text-white px-2 sm:px-4 py-1.5 sm:py-2 border-b border-slate-800">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-1.5 sm:gap-2">
              {/* Left Zone: Mode Switcher + Secondary Channels (scrollable on tiny screens) */}
              <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar min-w-0 flex-1">
                {/* Multi-Bookie Dealer Mode Switcher Tabs */}
                <div className="flex items-center gap-1 p-0.5 sm:p-1 bg-slate-800/90 rounded-2xl border border-slate-700 shrink-0">
                  {enabledModes['3d'] && (
                    <button
                      type="button"
                      onClick={() => {
                        setDealerMode('3d');
                        setActiveTab('sales');
                      }}
                      className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer ${
                        dealerMode === '3d'
                          ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/40'
                          : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-indigo-300 shrink-0"></span>
                      <span>{isMyanmar ? 'အိုးစည်လေး' : '1'}</span>
                    </button>
                  )}

                  {enabledModes['2d'] && (
                    <button
                      type="button"
                      onClick={() => {
                        setDealerMode('2d');
                        setActiveTab('sales');
                      }}
                      className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer ${
                        dealerMode === '2d'
                          ? 'bg-teal-600 text-white shadow-md ring-2 ring-teal-400/40'
                          : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-teal-300 shrink-0"></span>
                      <span>{isMyanmar ? 'ဇီးကွက်' : '2'}</span>
                    </button>
                  )}

                  {enabledModes['football'] && (
                    <button
                      type="button"
                      onClick={() => {
                        setDealerMode('football');
                        setActiveTab('fixtures');
                      }}
                      className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 sm:gap-1.5 cursor-pointer ${
                        dealerMode === 'football'
                          ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/40'
                          : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-300 shrink-0"></span>
                      <span>{isMyanmar ? 'ပစ်တိုင်းထောင်' : '3'}</span>
                    </button>
                  )}
                </div>

                {/* Previous Results Ticker & Action Buttons */}
                {onOpenPreviousResults && (
                  <button
                    type="button"
                    onClick={onOpenPreviousResults}
                    className={`px-2 sm:px-2.5 py-1.5 border text-xs font-black rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0 ${
                      dealerMode === '3d'
                        ? 'bg-indigo-950/80 hover:bg-indigo-900 border-indigo-400/60 text-indigo-200 ring-1 ring-indigo-400/20'
                        : dealerMode === '2d'
                        ? 'bg-teal-950/80 hover:bg-teal-900 border-teal-400/60 text-teal-200 ring-1 ring-teal-400/20'
                        : 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-400/60 text-emerald-200 ring-1 ring-emerald-400/20'
                    }`}
                    title={
                      dealerMode === '3d'
                        ? 'အိုးစည်လေး အရင်ပွဲစဉ်များ ထွက်ဂဏန်းနှင့် ရလဒ်မှတ်တမ်း'
                        : dealerMode === '2d'
                        ? 'ဇီးကွက် အရင်ပွဲစဉ်များ ထွက်ဂဏန်းနှင့် ရလဒ်မှတ်တမ်း'
                        : 'ပစ်တိုင်းထောင် ပြီးဆုံးခဲ့သော ပွဲစဉ်ရလဒ်များနှင့် အဖြေများ'
                    }
                  >
                    <Trophy
                      className={`w-3.5 h-3.5 shrink-0 ${
                        dealerMode === '3d'
                          ? 'text-amber-400'
                          : dealerMode === '2d'
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }`}
                    />
                    <span className="hidden md:inline">
                      {dealerMode === '3d' && 'ထွက်ဂဏန်း'}
                      {dealerMode === '2d' && 'ထွက်ဂဏန်း'}
                      {dealerMode === 'football' && 'ရလဒ်'}
                    </span>

                    {dealerMode === '3d' && latestSettled3D?.winningNumber && (
                      <span className="bg-amber-400 text-amber-950 px-1.5 py-0.2 rounded font-mono font-black text-xs">
                        {latestSettled3D.winningNumber}
                      </span>
                    )}
                    {dealerMode === '2d' && latestSettled2D?.winningNumber && (
                      <span className="bg-amber-400 text-amber-950 px-1.5 py-0.2 rounded font-mono font-black text-xs">
                        {latestSettled2D.winningNumber}
                      </span>
                    )}
                    {dealerMode === 'football' && latestFinishedFB && (
                      <span className="bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded font-mono font-black text-[11px]">
                        {latestFinishedFB.homeScore}-{latestFinishedFB.awayScore}
                      </span>
                    )}
                  </button>
                )}


                {/* Viber Direct Ingest Hub Button */}
                {onOpenViberHub && (
                  <button
                    type="button"
                    onClick={onOpenViberHub}
                    className="px-2 sm:px-2.5 py-1.5 bg-purple-950/70 hover:bg-purple-900 border border-purple-500/50 text-purple-200 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                    title="Viber တိုက်ရိုက် အရောင်းနှင့် စာရင်းစိစစ်ခန်း"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="hidden md:inline">Viber</span>
                    {viberPendingCount > 0 && (
                      <span className="bg-purple-500 text-white font-mono text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                        {viberPendingCount}
                      </span>
                    )}
                  </button>
                )}

                {/* Telegram Direct Ingest Hub Button */}
                {onOpenTelegramHub && (
                  <button
                    type="button"
                    onClick={onOpenTelegramHub}
                    className="px-2 sm:px-2.5 py-1.5 bg-sky-900/70 hover:bg-sky-800 border border-sky-500/50 text-sky-200 text-xs font-bold rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                    title="Telegram Bot တိုက်ရိုက် အရောင်းနှင့် စာရင်းစိစစ်ရာနေရာ"
                  >
                    <Bot className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="hidden md:inline">{isMyanmar ? 'Telegram' : 'Telegram'}</span>
                    {telegramPendingCount > 0 && (
                      <span className="bg-sky-500 text-white font-mono text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                        {telegramPendingCount}
                      </span>
                    )}
                  </button>
                )}

                {/* Backup & Restore Modal Trigger */}
                <button
                  type="button"
                  onClick={onOpenBackupModal}
                  className="px-2 sm:px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  title="ဖိုင်သီးသန့် သိမ်းဆည်းရန်/ပြန်သွင်းရန်"
                >
                  <Database className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span className="hidden md:inline">Backup</span>
                </button>

                <PWAInstallButton />
              </div>

              {/* Right Zone: PINNED & ALWAYS ACCESSIBLE ON PHONES/TABLETS */}
              <div className="flex items-center gap-1.5 shrink-0 pl-1 z-10">
                {/* View / Manage Round Button */}
                {onOpenRoundManager && (
                  <button
                    type="button"
                    onClick={onOpenRoundManager}
                    className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95 shrink-0 ring-1 ring-amber-300/60"
                    title="ဖွင့်ထားသော ပွဲစဉ်ကြည့်ရန်နှင့် ပွဲစဉ် စီမံခန့်ခွဲရန်"
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-100 shrink-0" />
                    <span>{isMyanmar ? 'ပွဲစဉ်' : 'Round'}</span>
                  </button>
                )}

                {/* Collapse Header Toggle Button (Icon-only chevron) */}
                <button
                  type="button"
                  onClick={toggleHeaderCollapse}
                  className="p-1.5 sm:p-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-amber-400 rounded-xl border border-slate-600/80 flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-sm ring-1 ring-slate-500/30"
                  aria-label="Toggle Header"
                >
                  <ChevronUp className="w-4 h-4 text-amber-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Mode Sub-Banner with Brand, Round Switcher & Mini Stats */}
          <div className="max-w-7xl mx-auto px-2 sm:px-6 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2">
            {/* Brand & Round info */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <AppLogo size="sm" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900">
                      {shopName}
                    </h1>

                    {onOpenTitleModal && (
                      <button
                        type="button"
                        onClick={onOpenTitleModal}
                        className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="ဆိုင်အမည် ပြောင်းမည်"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-bold">
                    {dealerMode === '3d'
                      ? 'အိုးစည် စားရင်း စီမံမှု 1'
                      : dealerMode === '2d'
                      ? 'ဇီးကွက်စားရင်းစီမံမှု 2'
                      : 'ပစ်တိုင်ထောင်စားရင် စီမံမှု 3'}
                  </p>
                </div>
              </div>

              {/* Active Round Switcher (Visible and Responsive on Mobile, Tablet & Desktop) */}
              {dealerMode === '3d' && (
                <div className="flex items-center bg-slate-100/95 border border-slate-200 rounded-xl p-0.5 sm:p-1 shadow-2xs">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600 ml-1.5 shrink-0" />
                  <select
                    value={lottery3D.activeRoundId}
                    onChange={(e) => lottery3D.setActiveRoundId(e.target.value)}
                    className="bg-transparent text-[11px] sm:text-xs text-slate-800 font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 outline-none cursor-pointer max-w-[130px] sm:max-w-none"
                  >
                    {lottery3D.rounds.map((r) => (
                      <option key={r.id} value={r.id} className="bg-white text-slate-800">
                        {r.name} {r.status === 'settled' ? '✓' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={onOpenRoundManager}
                    title="ပွဲစဉ်အသစ်ဖွင့်ရန်"
                    className="p-1 hover:bg-white rounded-lg text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-indigo-600" />
                  </button>
                </div>
              )}

              {dealerMode === '2d' && (
                <div className="flex items-center bg-slate-100/95 border border-slate-200 rounded-xl p-0.5 sm:p-1 shadow-2xs">
                  <Calendar className="w-3.5 h-3.5 text-teal-600 ml-1.5 shrink-0" />
                  <select
                    value={lottery2D.activeRoundId}
                    onChange={(e) => lottery2D.setActiveRoundId(e.target.value)}
                    className="bg-transparent text-[11px] sm:text-xs text-slate-800 font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 outline-none cursor-pointer max-w-[140px] sm:max-w-none"
                  >
                    {lottery2D.rounds.map((r) => (
                      <option key={r.id} value={r.id} className="bg-white text-slate-800">
                        {r.name} {r.status === 'settled' ? `✓ (${r.winningNumber || ''})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={onOpenRoundManager}
                    title="၂ လုံး ပွဲစဉ်အသစ်ဖွင့်ရန်"
                    className="p-1 hover:bg-white rounded-lg text-slate-500 hover:text-teal-600 transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-teal-600" />
                  </button>
                </div>
              )}

              {dealerMode === 'football' && (
                <div className="flex items-center bg-slate-100/95 border border-slate-200 rounded-xl p-0.5 sm:p-1 shadow-2xs">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 ml-1.5 shrink-0" />
                  <input
                    type="date"
                    value={football.activeDate}
                    onChange={(e) => football.setActiveDate(e.target.value)}
                    className="bg-transparent text-[11px] sm:text-xs text-slate-800 font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 outline-none cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Real-time Stats & Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs">
              {/* Revenue */}
              <div className="bg-slate-50 border border-slate-200/80 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl shadow-2xs">
                <span className="text-slate-500 block text-[9px] sm:text-[10px] uppercase font-semibold">
                  {isMyanmar ? 'ရောင်းရငွေ' : 'Revenue'}
                </span>
                <span className="font-bold text-emerald-600 text-xs sm:text-sm font-mono">
                  {formatAmount(revenue, currency)}
                </span>
              </div>

              {/* Net Outcome */}
              {isSettled ? (
                <div
                  className={`border px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl shadow-2xs ${
                    isProfit ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                  }`}
                >
                  <span className="text-slate-500 block text-[9px] sm:text-[10px] uppercase font-semibold">
                    {isMyanmar ? 'အမြတ်/ရှုံး' : 'Outcome'}
                  </span>
                  <span
                    className={`font-bold text-xs sm:text-sm font-mono ${
                      isProfit ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {isProfit ? '+' : '-'}{formatAmount(Math.abs(netOutcome), currency)}
                  </span>
                </div>
              ) : null}

              {/* Quick Action Icons */}
              <div className="flex items-center gap-1">
                {/* Bell Notifications */}
                {dealerMode !== 'football' && (
                  <button
                    onClick={onOpenNotifications}
                    className="relative p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
                    title="သတိပေးချက်များ"
                  >
                    <Bell className="w-4 h-4" />
                    {alertCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-bold text-[10px] w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-xs">
                        {alertCount > 9 ? '9+' : alertCount}
                      </span>
                    )}
                  </button>
                )}

                {/* စာရင်းရှင်းတမ်း (Financial Statements) Quick Action */}
                <button
                  onClick={() => onOpenStatements?.()}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
                  title="၁ ပတ်စာ၊ ၅ ရက်စာ၊ ၁ လစာ စာရင်းရှင်းတမ်း အစီရင်ခံစာများ"
                >
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  <span className="hidden sm:inline">{isMyanmar ? 'ရှင်းတမ်း' : 'Statements'}</span>
                </button>

                {/* Settings with Lock Badge (Contains Limits, Statements, Excel & Security) */}
                <button
                  onClick={onOpenSettings}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
                  title="ဆက်တင် (ကန့်သတ်ချက်၊ စာရင်းရှင်းတမ်း၊ Excel ထုတ်ရန် နှင့် Password)"
                >
                  <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">{isMyanmar ? 'ဆက်တင်' : 'Settings'}</span>
                  <Lock className="w-2.5 h-2.5 opacity-70" />
                </button>

                {/* Help */}
                <button
                  onClick={onOpenHelp}
                  className="p-1.5 sm:p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
                  title="အသုံးပြုနည်း လမ်းညွှန်ချက်"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Mode-Specific Navigation Tabs */}
      <div className="bg-slate-50/80 border-t border-slate-200 px-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar">
          {/* Mode-Specific Navigation Tabs */}
          {dealerMode === '3d' && (
            <nav className="flex space-x-1 sm:space-x-2 py-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
              <button
                onClick={() => setActiveTab('sales')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'sales'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>{isMyanmar ? 'အမှာစာ / စာရင်းသွင်း' : 'Order Entry'}</span>
              </button>

              <button
                onClick={() => setActiveTab('ledger')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>{isMyanmar ? 'စာရင်းချုပ် (၀၀၀-၉၉၉)' : 'Master Ledger'}</span>
              </button>

              <button
                onClick={() => setActiveTab('winning')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'winning'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>{isMyanmar ? 'ရလဒ်စစ်ဆေး & ရှင်းတမ်း' : 'Verification & Settlement'}</span>
              </button>

              <button
                onClick={() => setActiveTab('vouchers')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'vouchers'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isMyanmar ? 'ပြေစာမှတ်တမ်းများ' : 'Invoices & Slips'}</span>
              </button>

              <button
                onClick={() => setActiveTab('analytics')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>{isMyanmar ? 'သုံးသပ်ချက် & ခွဲခြမ်းစိတ်ဖြာမှု' : 'Analytics'}</span>
              </button>
            </nav>
          )}

          {dealerMode === '2d' && (
            <nav className="flex space-x-1 sm:space-x-2 py-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
              <button
                onClick={() => setActiveTab('sales')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'sales'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>{isMyanmar ? 'အမှာစာ / စာရင်းသွင်း' : 'Order Entry'}</span>
              </button>

              <button
                onClick={() => setActiveTab('ledger')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'ledger'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>{isMyanmar ? 'စာရင်းချုပ် (၀၀-၉၉)' : 'Master Ledger'}</span>
              </button>

              <button
                onClick={() => setActiveTab('winning')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'winning'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>{isMyanmar ? 'ရလဒ်စစ်ဆေး & ရှင်းတမ်း' : 'Verification & Settlement'}</span>
              </button>

              <button
                onClick={() => setActiveTab('vouchers')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'vouchers'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isMyanmar ? 'ပြေစာမှတ်တမ်းများ' : 'Invoices & Slips'}</span>
              </button>
            </nav>
          )}

          {dealerMode === 'football' && (
            <nav className="flex space-x-1 sm:space-x-2 py-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
              <button
                onClick={() => setActiveTab('fixtures')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'fixtures'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span>{isMyanmar ? 'ပွဲစဉ်ဇယားနှင့် ရလဒ်' : 'Fixtures & Scores'}</span>
              </button>

              <button
                onClick={() => setActiveTab('slip_entry')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'slip_entry'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>{isMyanmar ? 'အမှာစာ / စာရင်းသွင်း' : 'Ticket Entry'}</span>
              </button>

              <button
                onClick={() => setActiveTab('slips_list')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'slips_list'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isMyanmar ? 'ပြေစာမှတ်တမ်းများနှင့် ရှင်းတမ်း' : 'Tickets & Settlement'}</span>
              </button>
            </nav>
          )}

          {/* Fast Controls when collapsed */}
          <div className="flex items-center gap-1.5 py-1 pl-1 shrink-0">
            {/* When collapsed, provide quick mode switch pills */}
            {isHeaderCollapsed && (
              <div className="flex items-center gap-0.5 p-0.5 bg-slate-200/80 rounded-xl border border-slate-300">
                {enabledModes['3d'] && (
                  <button
                    type="button"
                    onClick={() => {
                      setDealerMode('3d');
                      setActiveTab('sales');
                    }}
                    className={`px-2 py-0.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      dealerMode === '3d'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    3D
                  </button>
                )}
                {enabledModes['2d'] && (
                  <button
                    type="button"
                    onClick={() => {
                      setDealerMode('2d');
                      setActiveTab('sales');
                    }}
                    className={`px-2 py-0.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      dealerMode === '2d'
                        ? 'bg-teal-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    2D
                  </button>
                )}
                {enabledModes['football'] && (
                  <button
                    type="button"
                    onClick={() => {
                      setDealerMode('football');
                      setActiveTab('fixtures');
                    }}
                    className={`px-2 py-0.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      dealerMode === 'football'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    FB
                  </button>
                )}
              </div>
            )}

            {/* Mobile Round Switcher */}
            <div className="sm:hidden">
              <button
                type="button"
                onClick={onOpenRoundManager}
                className="text-xs bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white px-2.5 py-1 rounded-xl border border-amber-400 flex items-center gap-1 shadow-xs font-black cursor-pointer"
                title="ဖွင့်ထားသော ပွဲစဉ်ကြည့်ရန်နှင့် ပွဲစဉ် စီမံခန့်ခွဲရန်"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-100 shrink-0" />
                <span>{isMyanmar ? 'ပွဲစဉ်' : 'Round'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Center Prominent Up/Down Arrow Toggle Handle (Mobile & Tablet & Desktop) */}
        <div className="w-full flex justify-center -mb-3 relative z-20 pointer-events-none">
          <button
            type="button"
            onClick={toggleHeaderCollapse}
            className={`pointer-events-auto h-7 px-4 rounded-full flex items-center justify-center border shadow-md transition-all duration-200 cursor-pointer active:scale-95 ${
              isHeaderCollapsed
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 border-amber-400 ring-2 ring-amber-300/80 animate-pulse'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 hover:text-slate-900'
            }`}
            aria-label="Toggle Header"
          >
            {isHeaderCollapsed ? (
              <ChevronDown className="w-4 h-4 stroke-[2.5]" />
            ) : (
              <ChevronUp className="w-4 h-4 stroke-[2.5]" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
