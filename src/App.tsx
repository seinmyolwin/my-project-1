/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { LogOut } from 'lucide-react';
import { LotteryProvider, useLottery } from './context/LotteryContext';
import { TwoDLotteryProvider, useTwoDLottery } from './context/TwoDLotteryContext';
import { FootballProvider, useFootball } from './context/FootballContext';
import { Header } from './components/Header';
import { BookieMode, Voucher, TwoDVoucher, FootballSlip } from './types';

// 3D Components
import { QuickSaleEntry } from './components/QuickSaleEntry';
import { LiveLedgerView } from './components/LiveLedgerView';
import { WinningPayoutView } from './components/WinningPayoutView';
import { VouchersView } from './components/VouchersView';
import { AnalyticsView } from './components/AnalyticsView';
import { VoucherPrintModal } from './components/VoucherPrintModal';
import { ForwardSlipsModal } from './components/ForwardSlipsModal';
import { LimitManagerModal } from './components/LimitManagerModal';
import { RoundManagerModal } from './components/RoundManagerModal';

// 2D Components
import { TwoDQuickSaleEntry } from './components/twoD/TwoDQuickSaleEntry';
import { TwoDLiveLedgerView } from './components/twoD/TwoDLiveLedgerView';
import { TwoDWinningPayoutView } from './components/twoD/TwoDWinningPayoutView';
import { TwoDVouchersView } from './components/twoD/TwoDVouchersView';
import { TwoDLimitsManager } from './components/twoD/TwoDLimitsManager';
import { TwoDVoucherPrintModal } from './components/twoD/TwoDVoucherPrintModal';
import { TwoDForwardModal } from './components/twoD/TwoDForwardModal';
import { TwoDRoundManagerModal } from './components/twoD/TwoDRoundManagerModal';

// Football Components
import { FootballFixturesView } from './components/football/FootballFixturesView';
import { FootballSlipEntryView } from './components/football/FootballSlipEntryView';
import { FootballSlipsListView } from './components/football/FootballSlipsListView';

// Shared Modals
import { UnifiedBackupModal } from './components/UnifiedBackupModal';
import { NotificationsModal } from './components/NotificationsModal';
import { SettingsModal } from './components/SettingsModal';
import { HelpModal } from './components/HelpModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PreviousResultsModal } from './components/PreviousResultsModal';
import { QuickTitleModal } from './components/QuickTitleModal';
import { QuickResultsBanner } from './components/QuickResultsBanner';
import { ViberOrdersHubModal } from './components/ViberOrdersHubModal';

// Security & Setup Modals
import { FirstTimePinSetupModal } from './components/FirstTimePinSetupModal';
import { PinPromptModal } from './components/PinPromptModal';
import { getStoredEnabledModes, isFirstTimePinSetup, EnabledModes } from './utils/securityUtils';
import { useDoubleBackToExit } from './hooks/useDoubleBackToExit';

function AppContent() {
  const { settings: settings3D } = useLottery();
  const { settings: settings2D } = useTwoDLottery();
  const { settings: settingsFB } = useFootball();

  // Active Dealer Mode ('3d' | '2d' | 'football')
  const [dealerMode, setDealerModeState] = useState<BookieMode>(() => {
    try {
      const saved = localStorage.getItem('active_bookie_mode');
      if (saved === '2d' || saved === 'football' || saved === '3d') {
        return saved as BookieMode;
      }
    } catch {
      // fallback
    }
    return '3d';
  });

  const setDealerMode = (mode: BookieMode) => {
    setDealerModeState(mode);
    try {
      localStorage.setItem('active_bookie_mode', mode);
    } catch {
      // ignore
    }
  };

  // Mode-Specific Active Tabs
  const [activeTab3D, setActiveTab3D] = useState<'sales' | 'ledger' | 'winning' | 'vouchers' | 'analytics'>('sales');
  const [activeTab2D, setActiveTab2D] = useState<'sales' | 'ledger' | 'winning' | 'vouchers' | 'limits'>('sales');
  const [activeTabFB, setActiveTabFB] = useState<'fixtures' | 'slip_entry' | 'slips_list'>('fixtures');

  // Security & Business Switch State
  const [enabledModes, setEnabledModes] = useState<EnabledModes>(() => getStoredEnabledModes());
  const [isFirstTimeSetupOpen, setIsFirstTimeSetupOpen] = useState(() => isFirstTimePinSetup());
  const [isPinPromptOpen, setIsPinPromptOpen] = useState(false);

  // Ensure current dealer mode is enabled
  useEffect(() => {
    if (!enabledModes[dealerMode]) {
      if (enabledModes['3d']) setDealerMode('3d');
      else if (enabledModes['2d']) setDealerMode('2d');
      else if (enabledModes['football']) setDealerMode('football');
    }
  }, [enabledModes, dealerMode]);
  const [printingVoucher3D, setPrintingVoucher3D] = useState<Voucher | null>(null);
  const [printingVoucher2D, setPrintingVoucher2D] = useState<TwoDVoucher | null>(null);

  const [isForwardModal3DOpen, setIsForwardModal3DOpen] = useState(false);
  const [forwardInitialData3D, setForwardInitialData3D] = useState<{ num?: string; amt?: number }>({});

  const [isForwardModal2DOpen, setIsForwardModal2DOpen] = useState(false);
  const [forwardInitialData2D, setForwardInitialData2D] = useState<{ num?: string; amt?: number }>({});

  const [isLimitsModal3DOpen, setIsLimitsModal3DOpen] = useState(false);
  const [limitInitialNumber3D, setLimitInitialNumber3D] = useState<string | undefined>(undefined);

  const [isRoundManager3DOpen, setIsRoundManager3DOpen] = useState(false);
  const [isRoundManager2DOpen, setIsRoundManager2DOpen] = useState(false);

  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isPreviousResultsOpen, setIsPreviousResultsOpen] = useState(false);
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [isViberHubOpen, setIsViberHubOpen] = useState(false);

  // Check if any modal is active
  const hasActiveModal =
    !!printingVoucher3D ||
    !!printingVoucher2D ||
    isSettingsOpen ||
    isPinPromptOpen ||
    isNotificationsOpen ||
    isRoundManager3DOpen ||
    isRoundManager2DOpen ||
    isLimitsModal3DOpen ||
    isForwardModal3DOpen ||
    isForwardModal2DOpen ||
    isBackupModalOpen ||
    isHelpOpen ||
    isPreviousResultsOpen ||
    isTitleModalOpen ||
    isViberHubOpen;

  const closeActiveModal = useCallback(() => {
    if (printingVoucher3D) setPrintingVoucher3D(null);
    else if (printingVoucher2D) setPrintingVoucher2D(null);
    else if (isViberHubOpen) setIsViberHubOpen(false);
    else if (isSettingsOpen) setIsSettingsOpen(false);
    else if (isPinPromptOpen) setIsPinPromptOpen(false);
    else if (isNotificationsOpen) setIsNotificationsOpen(false);
    else if (isRoundManager3DOpen) setIsRoundManager3DOpen(false);
    else if (isRoundManager2DOpen) setIsRoundManager2DOpen(false);
    else if (isLimitsModal3DOpen) setIsLimitsModal3DOpen(false);
    else if (isForwardModal3DOpen) setIsForwardModal3DOpen(false);
    else if (isForwardModal2DOpen) setIsForwardModal2DOpen(false);
    else if (isBackupModalOpen) setIsBackupModalOpen(false);
    else if (isHelpOpen) setIsHelpOpen(false);
    else if (isPreviousResultsOpen) setIsPreviousResultsOpen(false);
    else if (isTitleModalOpen) setIsTitleModalOpen(false);
  }, [
    printingVoucher3D,
    printingVoucher2D,
    isViberHubOpen,
    isSettingsOpen,
    isPinPromptOpen,
    isNotificationsOpen,
    isRoundManager3DOpen,
    isRoundManager2DOpen,
    isLimitsModal3DOpen,
    isForwardModal3DOpen,
    isForwardModal2DOpen,
    isBackupModalOpen,
    isHelpOpen,
    isPreviousResultsOpen,
    isTitleModalOpen
  ]);

  const isSubTab =
    (dealerMode === '3d' && activeTab3D !== 'sales') ||
    (dealerMode === '2d' && activeTab2D !== 'sales') ||
    (dealerMode === 'football' && activeTabFB !== 'fixtures');

  const goToMainTab = useCallback(() => {
    if (dealerMode === '3d') setActiveTab3D('sales');
    else if (dealerMode === '2d') setActiveTab2D('sales');
    else if (dealerMode === 'football') setActiveTabFB('fixtures');
  }, [dealerMode]);

  // Handle hardware / browser back button navigation & 2-second double press exit
  const { showExitToast } = useDoubleBackToExit({
    hasActiveModal,
    closeActiveModal,
    isSubTab,
    goToMainTab
  });

  // Sync document title with active mode
  useEffect(() => {
    if (dealerMode === '3d') {
      const title = settings3D.appName || settings3D.shopName || 'ရွှေမင်္ဂလာ';
      document.title = `${title} - အိုးစည်လေး စာရင်းစနစ် (3D)`;
    } else if (dealerMode === '2d') {
      const title = settings2D.appName || settings2D.shopName || 'ရွှေမင်္ဂလာ';
      document.title = `${title} - ဇီးကွက် စာရင်းစနစ် (2D)`;
    } else {
      const title = settingsFB.appName || settingsFB.shopName || 'ရွှေမင်္ဂလာ';
      document.title = `${title} - ပစ်တိုင်းထောင် စာရင်းစနစ် (Football)`;
    }
  }, [dealerMode, settings3D, settings2D, settingsFB]);

  // Current active tab based on active mode
  const currentActiveTab =
    dealerMode === '3d'
      ? activeTab3D
      : dealerMode === '2d'
      ? activeTab2D
      : activeTabFB;

  const handleSetTab = (tab: string) => {
    if (dealerMode === '3d') setActiveTab3D(tab as any);
    else if (dealerMode === '2d') setActiveTab2D(tab as any);
    else setActiveTabFB(tab as any);
  };

  const handleOpenRoundManager = () => {
    if (dealerMode === '3d') setIsRoundManager3DOpen(true);
    else if (dealerMode === '2d') setIsRoundManager2DOpen(true);
  };

  const handleOpenForwardModal = (num?: string, amt?: number) => {
    if (dealerMode === '3d') {
      setForwardInitialData3D({ num, amt });
      setIsForwardModal3DOpen(true);
    } else if (dealerMode === '2d') {
      setForwardInitialData2D({ num, amt });
      setIsForwardModal2DOpen(true);
    }
  };

  const handleOpenLimitsModal = (num?: string) => {
    if (dealerMode === '3d') {
      setLimitInitialNumber3D(num);
      setIsLimitsModal3DOpen(true);
    } else if (dealerMode === '2d') {
      setActiveTab2D('limits');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Universal Multi-Bookie Header */}
      <Header
        dealerMode={dealerMode}
        setDealerMode={setDealerMode}
        activeTab={currentActiveTab}
        setActiveTab={handleSetTab}
        enabledModes={enabledModes}
        onOpenSettings={() => setIsPinPromptOpen(true)}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        onOpenRoundManager={handleOpenRoundManager}
        onOpenLimitsManager={() => handleOpenLimitsModal()}
        onOpenForwardModal={() => handleOpenForwardModal()}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenPreviousResults={() => setIsPreviousResultsOpen(true)}
        onOpenTitleModal={() => setIsTitleModalOpen(true)}
        onOpenViberHub={() => setIsViberHubOpen(true)}
      />

      {/* Main View Area */}
      <main className="pb-10 pt-1.5">
        {/* Prominent Quick Results Banner */}
        <div className="max-w-7xl mx-auto px-2 sm:px-4 mb-2">
          <QuickResultsBanner
            mode={dealerMode}
            onOpenHistory={() => setIsPreviousResultsOpen(true)}
          />
        </div>

        {/* ======================= 3D LOTTERY VIEWS ======================= */}
        {dealerMode === '3d' && (
          <>
            {activeTab3D === 'sales' && (
              <QuickSaleEntry onVoucherCreated={(v) => setPrintingVoucher3D(v)} />
            )}

            {activeTab3D === 'ledger' && (
              <LiveLedgerView
                onOpenForwardModal={handleOpenForwardModal}
                onOpenLimitsManager={handleOpenLimitsModal}
              />
            )}

            {activeTab3D === 'winning' && (
              <WinningPayoutView />
            )}

            {activeTab3D === 'vouchers' && (
              <VouchersView onOpenPrintVoucher={(v) => setPrintingVoucher3D(v)} />
            )}

            {activeTab3D === 'analytics' && (
              <AnalyticsView onOpenForwardModal={handleOpenForwardModal} />
            )}
          </>
        )}

        {/* ======================= 2D LOTTERY VIEWS ======================= */}
        {dealerMode === '2d' && (
          <>
            {activeTab2D === 'sales' && (
              <TwoDQuickSaleEntry onVoucherCreated={(v) => setPrintingVoucher2D(v)} />
            )}

            {activeTab2D === 'ledger' && (
              <TwoDLiveLedgerView
                onOpenForwardModal={handleOpenForwardModal}
                onOpenLimitsManager={() => setActiveTab2D('limits')}
              />
            )}

            {activeTab2D === 'winning' && (
              <TwoDWinningPayoutView />
            )}

            {activeTab2D === 'vouchers' && (
              <TwoDVouchersView onOpenPrintVoucher={(v) => setPrintingVoucher2D(v)} />
            )}

            {activeTab2D === 'limits' && (
              <TwoDLimitsManager />
            )}
          </>
        )}

        {/* ======================= FOOTBALL BETTING VIEWS ======================= */}
        {dealerMode === 'football' && (
          <>
            {activeTabFB === 'fixtures' && (
              <FootballFixturesView />
            )}

            {activeTabFB === 'slip_entry' && (
              <FootballSlipEntryView
                onSlipCreated={() => setActiveTabFB('slips_list')}
              />
            )}

            {activeTabFB === 'slips_list' && (
              <FootballSlipsListView />
            )}
          </>
        )}
      </main>

      {/* ======================= MODALS & DRAWERS ======================= */}

      {/* 3D Modals */}
      <VoucherPrintModal
        voucher={printingVoucher3D}
        onClose={() => setPrintingVoucher3D(null)}
      />

      <ForwardSlipsModal
        isOpen={isForwardModal3DOpen}
        onClose={() => {
          setIsForwardModal3DOpen(false);
          setForwardInitialData3D({});
        }}
        initialNumber={forwardInitialData3D.num}
        initialAmount={forwardInitialData3D.amt}
      />

      <LimitManagerModal
        isOpen={isLimitsModal3DOpen}
        onClose={() => {
          setIsLimitsModal3DOpen(false);
          setLimitInitialNumber3D(undefined);
        }}
        initialNumber={limitInitialNumber3D}
      />

      <RoundManagerModal
        isOpen={isRoundManager3DOpen}
        onClose={() => setIsRoundManager3DOpen(false)}
      />

      {/* 2D Modals */}
      <TwoDVoucherPrintModal
        voucher={printingVoucher2D}
        onClose={() => setPrintingVoucher2D(null)}
      />

      <TwoDForwardModal
        isOpen={isForwardModal2DOpen}
        onClose={() => {
          setIsForwardModal2DOpen(false);
          setForwardInitialData2D({});
        }}
        initialNumber={forwardInitialData2D.num}
        initialAmount={forwardInitialData2D.amt}
      />

      <TwoDRoundManagerModal
        isOpen={isRoundManager2DOpen}
        onClose={() => setIsRoundManager2DOpen(false)}
      />

      {/* Unified Backup & Restore Modal */}
      <UnifiedBackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
      />

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onOpenForwardModal={handleOpenForwardModal}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        initialTab={dealerMode}
        enabledModes={enabledModes}
        onUpdateEnabledModes={(modes) => setEnabledModes(modes)}
      />

      {/* First-Time PIN & Business Setup Modal */}
      <FirstTimePinSetupModal
        isOpen={isFirstTimeSetupOpen}
        onCompleted={(modes) => {
          setEnabledModes(modes);
          setIsFirstTimeSetupOpen(false);
        }}
      />

      {/* Security PIN Prompt Modal */}
      <PinPromptModal
        isOpen={isPinPromptOpen}
        onClose={() => setIsPinPromptOpen(false)}
        onSuccess={() => {
          setIsPinPromptOpen(false);
          setIsSettingsOpen(true);
        }}
      />

      {/* Quick Title & Branding Customization Modal */}
      <QuickTitleModal
        isOpen={isTitleModalOpen}
        onClose={() => setIsTitleModalOpen(false)}
        activeMode={dealerMode}
      />

      {/* Previous Results & Winning Numbers Modal */}
      <PreviousResultsModal
        isOpen={isPreviousResultsOpen}
        onClose={() => setIsPreviousResultsOpen(false)}
        mode={dealerMode}
        onSelectRound3D={() => {
          setActiveTab3D('ledger');
        }}
        onSelectRound2D={() => {
          setActiveTab2D('ledger');
        }}
        onGoToWinningPayouts3D={() => {
          setActiveTab3D('payouts');
        }}
        onGoToWinningPayouts2D={() => {
          setActiveTab2D('payouts');
        }}
        onGoToFootballSlips={() => {
          setActiveTabFB('slips');
        }}
      />

      {/* Viber Orders & Direct Ingest Review Hub Modal */}
      <ViberOrdersHubModal
        isOpen={isViberHubOpen}
        onClose={() => setIsViberHubOpen(false)}
        onOpenPrintVoucher={(v) => {
          if (dealerMode === '2d') setPrintingVoucher2D(v);
          else setPrintingVoucher3D(v);
        }}
      />

      {/* Help Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* Offline Status Badge */}
      <OfflineIndicator />

      {/* Double Back Exit Toast Banner for Mobile/Tablet */}
      {showExitToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white px-5 py-3 rounded-2xl border border-slate-700 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
            <LogOut className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-black block">အက်ပ်မှ ထွက်ရန်</span>
            <span className="text-[11px] text-slate-300">
              နောက်သို့ (Back) ၂ စက္ကန့်အတွင်း အမြန် ၂ ချက် နှိပ်ပါ
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <LotteryProvider>
      <TwoDLotteryProvider>
        <FootballProvider>
          <AppContent />
        </FootballProvider>
      </TwoDLotteryProvider>
    </LotteryProvider>
  );
}
