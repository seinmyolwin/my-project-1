import React from 'react';
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
  MessageSquare
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { formatAmount } from '../utils/lotteryUtils';
import { PWAInstallButton } from './PWAInstallButton';
import { BookieMode } from '../types';
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
  onOpenViberHub
}) => {
  // Contexts
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  const viberPendingCount = React.useMemo(() => {
    try {
      const orders = getViberOrders();
      return orders.filter(o => o.status === 'pending_review').length;
    } catch {
      return 0;
    }
  }, []);

  const isMyanmar =
    dealerMode === '3d'
      ? lottery3D.settings.language === 'my'
      : dealerMode === '2d'
      ? lottery2D.settings.language === 'my'
      : football.settings.language === 'my';

  // Metrics for current active mode
  let appTitle = '';
  let shopName = '';
  let revenue = 0;
  let isSettled = false;
  let isProfit = true;
  let netOutcome = 0;
  let alertCount = 0;
  let currency = 'MMK';

  if (dealerMode === '3d') {
    appTitle = lottery3D.settings.appName || 'ရွှေမင်္ဂလာ';
    shopName = lottery3D.settings.shopName || 'ပိုင်ရှင်အကြိုက် ဆိုင်အမည်';
    revenue = lottery3D.roundSummary.netRevenue;
    isSettled = lottery3D.activeRound?.status === 'settled';
    isProfit = lottery3D.roundSummary.isProfit;
    netOutcome = lottery3D.roundSummary.netProfit;
    alertCount = lottery3D.lowStockAlerts.length;
    currency = lottery3D.settings.currency;
  } else if (dealerMode === '2d') {
    appTitle = lottery2D.settings.appName || 'ရွှေမင်္ဂလာ';
    shopName = lottery2D.settings.shopName || 'ပိုင်ရှင်အကြိုက် ဆိုင်အမည်';
    revenue = lottery2D.roundSummary.netRevenue;
    isSettled = lottery2D.activeRound?.status === 'settled';
    isProfit = lottery2D.roundSummary.isProfit;
    netOutcome = lottery2D.roundSummary.netProfit;
    alertCount = lottery2D.lowStockAlerts.length;
    currency = lottery2D.settings.currency;
  } else {
    appTitle = football.settings.appName || 'ရွှေမင်္ဂလာ';
    shopName = football.settings.shopName || 'ပိုင်ရှင်အကြိုက် ဆိုင်အမည်';
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
      {/* Top Dealer Mode Switcher Bar */}
      <div className="bg-slate-900 text-white px-3 sm:px-6 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          {/* Multi-Bookie Dealer Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-800/90 rounded-2xl border border-slate-700">
            {enabledModes['3d'] && (
              <button
                type="button"
                onClick={() => {
                  setDealerMode('3d');
                  setActiveTab('sales');
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  dealerMode === '3d'
                    ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-300"></span>
                <span>{isMyanmar ? 'အိုးစည်လေး' : 'Line 1 (OSL)'}</span>
              </button>
            )}

            {enabledModes['2d'] && (
              <button
                type="button"
                onClick={() => {
                  setDealerMode('2d');
                  setActiveTab('sales');
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  dealerMode === '2d'
                    ? 'bg-teal-600 text-white shadow-md ring-2 ring-teal-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-teal-300"></span>
                <span>{isMyanmar ? 'ဇီးကွက်' : 'Line 2 (ZKW)'}</span>
              </button>
            )}

            {enabledModes['football'] && (
              <button
                type="button"
                onClick={() => {
                  setDealerMode('football');
                  setActiveTab('fixtures');
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  dealerMode === 'football'
                    ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
                <span>{isMyanmar ? 'ပစ်တိုင်းထောင်' : 'Line 3 (PTH)'}</span>
              </button>
            )}
          </div>

          {/* Previous Results Ticker & Action Buttons */}
          <div className="flex items-center gap-2">
            {onOpenPreviousResults && (
              <button
                type="button"
                onClick={onOpenPreviousResults}
                className={`px-3 py-1.5 border text-xs font-black rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 ${
                  dealerMode === '3d'
                    ? 'bg-indigo-950/80 hover:bg-indigo-900 border-indigo-400/60 text-indigo-200 ring-1 ring-indigo-400/20'
                    : dealerMode === '2d'
                    ? 'bg-teal-950/80 hover:bg-teal-900 border-teal-400/60 text-teal-200 ring-1 ring-teal-400/20'
                    : 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-400/60 text-emerald-200 ring-1 ring-emerald-400/20'
                }`}
                title={
                  dealerMode === '3d'
                    ? 'အိုးစည်လေး (3D) အရင်ပွဲစဉ်များ ထွက်ဂဏန်းနှင့် ရလဒ်မှတ်တမ်း'
                    : dealerMode === '2d'
                    ? 'ဇီးကွက် (2D) အရင်ပွဲစဉ်များ ထွက်ဂဏန်းနှင့် ရလဒ်မှတ်တမ်း'
                    : 'ပစ်တိုင်းထောင် (Football) ပြီးဆုံးခဲ့သော ပွဲစဉ်ရလဒ်များနှင့် အဖြေများ'
                }
              >
                <Trophy
                  className={`w-3.5 h-3.5 ${
                    dealerMode === '3d'
                      ? 'text-amber-400'
                      : dealerMode === '2d'
                      ? 'text-amber-300'
                      : 'text-emerald-400'
                  }`}
                />
                <span className="hidden sm:inline">
                  {dealerMode === '3d' && 'အိုးစည်လေး ထွက်ဂဏန်းမှတ်တမ်း'}
                  {dealerMode === '2d' && 'ဇီးကွက် ထွက်ဂဏန်းမှတ်တမ်း'}
                  {dealerMode === 'football' && 'ပစ်တိုင်းထောင် ပွဲပြီးရလဒ်မှတ်တမ်း'}
                </span>
                <span className="sm:hidden">
                  {dealerMode === '3d' ? 'အိုးစည်လေး ရလဒ်' : dealerMode === '2d' ? 'ဇီးကွက် ရလဒ်' : 'ပစ်တိုင်းထောင် ရလဒ်'}
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
                className="px-3 py-1.5 bg-purple-900/70 hover:bg-purple-800 border border-purple-500/50 text-purple-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                title="Viber တိုက်ရိုက် အရောင်းနှင့် စာရင်းစိစစ်ရာနေရာ"
              >
                <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                <span className="hidden sm:inline">{isMyanmar ? 'Viber စာရင်းများ' : 'Viber Orders'}</span>
                {viberPendingCount > 0 && (
                  <span className="bg-purple-500 text-white font-mono text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                    {viberPendingCount}
                  </span>
                )}
              </button>
            )}

            {/* Backup & Restore Modal Trigger */}
            <button
              type="button"
              onClick={onOpenBackupModal}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              title="ဖိုင်သီးသန့် သိမ်းဆည်းရန်/ပြန်သွင်းရန်"
            >
              <Database className="w-3.5 h-3.5 text-teal-400" />
              <span className="hidden sm:inline">{isMyanmar ? 'ဖိုင်သိမ်းဆည်းမှု (Backup)' : 'Backup & Restore'}</span>
            </button>

            <PWAInstallButton />
          </div>
        </div>
      </div>

      {/* Mode Sub-Banner with Brand, Round Switcher & Mini Stats */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Round info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <AppLogo size="md" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                  {appTitle || 'ရွှေမင်္ဂလာ'}
                </h1>
                <span
                  className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                    dealerMode === '3d'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                      : dealerMode === '2d'
                      ? 'bg-teal-50 text-teal-700 border border-teal-100'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  }`}
                >
                  {shopName}
                </span>

                {onOpenTitleModal && (
                  <button
                    type="button"
                    onClick={onOpenTitleModal}
                    className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="အက်ပ်ခေါင်းစဉ်နှင့် ဆိုင်အမည် ပြောင်းမည်"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {dealerMode === '3d'
                  ? 'အိုးစည်လေး စာရင်းစီမံမှု (Line 1)'
                  : dealerMode === '2d'
                  ? 'ဇီးကွက် စာရင်းစီမံမှု (Line 2)'
                  : 'ပစ်တိုင်းထောင် စာရင်းစီမံမှု (Line 3)'}
              </p>
            </div>
          </div>

          {/* Active Round Switcher (3D or 2D) */}
          {dealerMode === '3d' && (
            <div className="hidden lg:flex items-center bg-slate-100/90 border border-slate-200 rounded-xl p-1 shadow-2xs">
              <Calendar className="w-4 h-4 text-indigo-600 ml-2 shrink-0" />
              <select
                value={lottery3D.activeRoundId}
                onChange={(e) => lottery3D.setActiveRoundId(e.target.value)}
                className="bg-transparent text-xs text-slate-800 font-semibold px-2 py-1 outline-none cursor-pointer"
              >
                {lottery3D.rounds.map((r) => (
                  <option key={r.id} value={r.id} className="bg-white text-slate-800">
                    {r.name} {r.status === 'settled' ? '✓ (ပေါက်ပြီး)' : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={onOpenRoundManager}
                title="ပွဲစဉ်အသစ်ဖွင့်ရန်"
                className="p-1 hover:bg-white rounded-lg text-slate-500 hover:text-indigo-600 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {dealerMode === '2d' && (
            <div className="hidden lg:flex items-center bg-slate-100/90 border border-slate-200 rounded-xl p-1 shadow-2xs">
              <Calendar className="w-4 h-4 text-teal-600 ml-2 shrink-0" />
              <select
                value={lottery2D.activeRoundId}
                onChange={(e) => lottery2D.setActiveRoundId(e.target.value)}
                className="bg-transparent text-xs text-slate-800 font-semibold px-2 py-1 outline-none cursor-pointer"
              >
                {lottery2D.rounds.map((r) => (
                  <option key={r.id} value={r.id} className="bg-white text-slate-800">
                    {r.name} {r.status === 'settled' ? `✓ (${r.winningNumber})` : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={onOpenRoundManager}
                title="၂ လုံး ပွဲစဉ်အသစ်ဖွင့်ရန်"
                className="p-1 hover:bg-white rounded-lg text-slate-500 hover:text-teal-600 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {dealerMode === 'football' && (
            <div className="hidden lg:flex items-center bg-slate-100/90 border border-slate-200 rounded-xl p-1 shadow-2xs">
              <Calendar className="w-4 h-4 text-emerald-600 ml-2 shrink-0" />
              <input
                type="date"
                value={football.activeDate}
                onChange={(e) => football.setActiveDate(e.target.value)}
                className="bg-transparent text-xs text-slate-800 font-semibold px-2 py-1 outline-none cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Real-time Stats & Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          {/* Revenue */}
          <div className="bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-2xs">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">
              {isMyanmar ? 'စုစုပေါင်း ရောင်းရငွေ' : 'Total Revenue'}
            </span>
            <span className="font-bold text-emerald-600 text-sm font-mono">
              {formatAmount(revenue, currency)}
            </span>
          </div>

          {/* Net Outcome */}
          {isSettled ? (
            <div
              className={`border px-3 py-1.5 rounded-xl shadow-2xs ${
                isProfit ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                {isMyanmar ? 'အသားတင် အမြတ်/ရှုံး' : 'Net Outcome'}
              </span>
              <span
                className={`font-bold text-sm font-mono ${
                  isProfit ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {isProfit ? '+' : '-'}{formatAmount(Math.abs(netOutcome), currency)}
              </span>
            </div>
          ) : null}

          {/* Quick Action Icons */}
          <div className="flex items-center gap-1.5">
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

            {/* Financial Statements & Reports Button */}
            {onOpenStatements && (
              <button
                type="button"
                onClick={onOpenStatements}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-xs rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95"
                title="ကာလအလိုက် စာရင်းရှင်းတမ်းနှင့် အမြတ်/အရှုံး ကြည့်ရန်"
              >
                <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">{isMyanmar ? 'စာရင်းရှင်းတမ်း' : 'Statements'}</span>
              </button>
            )}

            {/* Excel Export */}
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl transition-all shadow-xs cursor-pointer active:scale-95"
              title="Excel စာရင်း အကုန်ထုတ်ယူမည်"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{isMyanmar ? 'Excel ထုတ်ရန်' : 'Export Excel'}</span>
            </button>

            {/* Settings with Lock Badge */}
            <button
              onClick={onOpenSettings}
              className="relative p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
              title="ဆက်တင် (Password ဖြင့် ကာကွယ်ထားပါသည်)"
            >
              <Settings className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 bg-indigo-600 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px] shadow-2xs">
                <Lock className="w-2.5 h-2.5" />
              </span>
            </button>

            {/* Help */}
            <button
              onClick={onOpenHelp}
              className="p-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
              title="အသုံးပြုနည်း လမ်းညွှန်ချက်"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mode-Specific Navigation Tabs */}
      <div className="bg-slate-50/80 border-t border-slate-200 px-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto no-scrollbar">
          {dealerMode === '3d' && (
            <nav className="flex space-x-1 sm:space-x-2 py-1.5">
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
            <nav className="flex space-x-1 sm:space-x-2 py-1.5">
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

              <button
                onClick={() => setActiveTab('limits')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'limits'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Sliders className="w-4 h-4" />
                <span>{isMyanmar ? 'ကန့်သတ်ချက် သတ်မှတ်ခြင်း' : 'Limits & Quotas'}</span>
              </button>
            </nav>
          )}

          {dealerMode === 'football' && (
            <nav className="flex space-x-1 sm:space-x-2 py-1.5">
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

          {/* Mobile Round Switcher */}
          <div className="lg:hidden py-1 pl-2">
            <button
              onClick={onOpenRoundManager}
              className="text-xs bg-white text-indigo-700 px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-1 shadow-2xs font-medium"
            >
              <Calendar className="w-3 h-3" />
              <span>{isMyanmar ? 'ပွဲစဉ်' : 'Round'}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
