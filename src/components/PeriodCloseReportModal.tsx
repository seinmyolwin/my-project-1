import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Lock,
  Unlock,
  Calendar,
  Printer,
  Copy,
  Check,
  FileSpreadsheet,
  Users,
  Shield,
  AlertTriangle,
  CheckCircle2,
  History,
  Eye,
  ArrowLeft,
  Star
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { BookieMode, PeriodClosing, PeriodCloseReportSnapshot } from '../types';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { usePeriod } from '../context/PeriodContext';
import { formatAmount } from '../utils/lotteryUtils';
import { getLocalDateString } from '../utils/moneyUtils';
import { printStatementReport } from '../utils/printUtils';
import { verifyOwnerPassword } from '../utils/securityUtils';
import { getDaysAgoStr, getLocalDateStr } from '../utils/statementUtils';
import { COMMISSION_UPDATED_EVENT } from '../utils/commissionUtils';
import {
  bookieModeToGameType,
  buildPeriodCloseReport,
  formatPeriodCloseReportText,
  get2DWorkWeekRange,
  getBusinessLabel,
  getDefaultPeriodRangeForMode
} from '../utils/periodCloseReportUtils';

interface PeriodCloseReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: 'all' | '3d' | '2d' | 'football';
  statementStartDate?: string;
  statementEndDate?: string;
}

export const PeriodCloseReportModal: React.FC<PeriodCloseReportModalProps> = ({
  isOpen,
  onClose,
  initialMode,
  statementStartDate,
  statementEndDate
}) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();
  const periodCtx = usePeriod();

  const isModeLocked = initialMode !== 'all';
  const [selectedMode, setSelectedMode] = useState<BookieMode>(
    initialMode === 'all' ? '2d' : initialMode
  );
  const activeMode: BookieMode = isModeLocked ? (initialMode as BookieMode) : selectedMode;
  const activeGame = bookieModeToGameType(activeMode);

  const [activeTab, setActiveTab] = useState<'preview' | 'history'>('preview');
  const [viewingClosing, setViewingClosing] = useState<PeriodClosing | null>(null);

  // Date boundaries for new period close preview
  const defaultRange = useMemo(
    () => getDefaultPeriodRangeForMode(activeMode, statementStartDate, statementEndDate),
    [activeMode, statementStartDate, statementEndDate]
  );
  const [startDate, setStartDate] = useState<string>(defaultRange.startDate);
  const [endDate, setEndDate] = useState<string>(defaultRange.endDate);

  const [commissionRevision, setCommissionRevision] = useState(0);
  const [copiedText, setCopiedText] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Inline PIN confirmation modal for Closing Period
  const [isPinConfirmOpen, setIsPinConfirmOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [isSubmittingClose, setIsSubmittingClose] = useState(false);

  // Inline PIN confirmation modal for Reopening Period
  const [reopenTarget, setReopenTarget] = useState<PeriodClosing | null>(null);
  const [reopenPin, setReopenPin] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [reopenError, setReopenError] = useState<string | null>(null);

  useEffect(() => {
    const onCommUpdated = () => setCommissionRevision((r) => r + 1);
    window.addEventListener(COMMISSION_UPDATED_EVENT, onCommUpdated);
    return () => window.removeEventListener(COMMISSION_UPDATED_EVENT, onCommUpdated);
  }, []);

  // Reset state when modal opens or initialMode changes
  useEffect(() => {
    if (isOpen) {
      const targetMode: BookieMode = initialMode === 'all' ? '2d' : initialMode;
      setSelectedMode(targetMode);
      const rng = getDefaultPeriodRangeForMode(targetMode, statementStartDate, statementEndDate);
      setStartDate(rng.startDate);
      setEndDate(rng.endDate);
      setActiveTab('preview');
      setViewingClosing(null);
      setToastMsg(null);
      setIsPinConfirmOpen(false);
      setPinInput('');
      setPinError(null);
      setReopenTarget(null);
    }
  }, [isOpen, initialMode, statementStartDate, statementEndDate]);

  // When switching business tabs in 'all' mode, refresh sensible date range for that business
  const handleSelectBusinessMode = (m: BookieMode) => {
    setSelectedMode(m);
    const rng = getDefaultPeriodRangeForMode(m, statementStartDate, statementEndDate);
    setStartDate(rng.startDate);
    setEndDate(rng.endDate);
    setViewingClosing(null);
    setToastMsg(null);
  };

  const currency =
    activeMode === '2d'
      ? lottery2D.settings.currency || 'Ks'
      : activeMode === '3d'
      ? lottery3D.settings.currency || 'Ks'
      : football.settings?.currency || 'Ks';

  const dataSources = useMemo(
    () => ({
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
    }),
    [
      lottery2D.rounds,
      lottery2D.vouchers,
      lottery2D.forwardSlips,
      lottery2D.settings,
      lottery3D.rounds,
      lottery3D.vouchers,
      lottery3D.forwardSlips,
      lottery3D.settings,
      football.slips,
      football.forwardSlips,
      football.settings
    ]
  );

  // Live report for current preview date range
  const previewReport: PeriodCloseReportSnapshot = useMemo(() => {
    const safeStart = startDate <= endDate ? startDate : endDate;
    const safeEnd = startDate <= endDate ? endDate : startDate;
    return buildPeriodCloseReport(dataSources, activeMode, safeStart, safeEnd, currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSources, activeMode, startDate, endDate, currency, commissionRevision]);

  // Closed periods strictly scoped to active business
  const businessClosings = useMemo(() => {
    return periodCtx.periodClosings
      .filter((pc) => pc.game === activeGame)
      .slice()
      .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || b.closedAt.localeCompare(a.closedAt));
  }, [periodCtx.periodClosings, activeGame]);

  // Check if current preview range is already closed or overlaps an existing closed period for this game
  const matchingExistingClosing = useMemo(() => {
    const safeStart = startDate <= endDate ? startDate : endDate;
    const safeEnd = startDate <= endDate ? endDate : startDate;
    return businessClosings.find(
      (pc) => pc.periodStart === safeStart && pc.periodEnd === safeEnd
    );
  }, [businessClosings, startDate, endDate]);

  const overlappingClosing = useMemo(() => {
    const safeStart = startDate <= endDate ? startDate : endDate;
    const safeEnd = startDate <= endDate ? endDate : startDate;
    return businessClosings.find(
      (pc) => !(safeEnd < pc.periodStart || safeStart > pc.periodEnd)
    );
  }, [businessClosings, startDate, endDate]);

  // Report currently displayed on screen (either an archived closed period or the live preview)
  const displayedReport: PeriodCloseReportSnapshot = useMemo(() => {
    if (viewingClosing) {
      if (viewingClosing.reportSnapshot) {
        return viewingClosing.reportSnapshot;
      }
      // Fallback reconstruction for legacy closings created prior to reportSnapshot
      return buildPeriodCloseReport(
        dataSources,
        activeMode,
        viewingClosing.periodStart,
        viewingClosing.periodEnd,
        currency
      );
    }
    return previewReport;
  }, [viewingClosing, previewReport, dataSources, activeMode, currency]);

  const activeClosedRecord = viewingClosing || matchingExistingClosing || null;

  const handleOpenPinConfirm = () => {
    setToastMsg(null);
    const safeStart = startDate <= endDate ? startDate : endDate;
    const safeEnd = startDate <= endDate ? endDate : startDate;
    const todayStr = getLocalDateString();

    if (!safeStart || !safeEnd) {
      setToastMsg({ type: 'error', text: 'စတင်ရက်နှင့် ပြီးဆုံးရက် မှန်ကန်စွာ ရွေးချယ်ပါ' });
      return;
    }
    if (safeEnd > todayStr) {
      setToastMsg({ type: 'error', text: 'အနာဂတ်ရက်စွဲ မကုန်ဆုံးသေးသဖြင့် ကာလပိတ်၍ မရသေးပါ' });
      return;
    }
    if (overlappingClosing) {
      setToastMsg({
        type: 'error',
        text: `ဤရက်စွဲအပိုင်းအခြားသည် ပိတ်ပြီးသားကာလ (${overlappingClosing.periodStart} ~ ${overlappingClosing.periodEnd}) နှင့် ထပ်နေပါသည်`
      });
      return;
    }
    setPinInput('');
    setPinError(null);
    setIsPinConfirmOpen(true);
  };

  const handleConfirmClosePeriod = async () => {
    if (!pinInput.trim() || !verifyOwnerPassword(pinInput.trim())) {
      setPinError('Owner PIN (၆ လုံး) မှားယွင်းနေပါသည်');
      return;
    }

    setIsSubmittingClose(true);
    setPinError(null);
    try {
      const g = previewReport.grandTotals;
      const closed = await periodCtx.closePeriod({
        game: activeGame,
        periodStart: previewReport.periodStart,
        periodEnd: previewReport.periodEnd,
        totals: {
          sales: g.totalSales,
          payout: g.totalPayout,
          profit: g.netProfit,
          commission: g.totalCustomerCommission,
          forwarded: g.totalForwarded,
          forwardCommission: g.totalForwardCommission,
          masterPayout: g.totalMasterPayout,
          totalReceivable: g.totalReceivable,
          totalPayable: g.totalPayable
        },
        reportSnapshot: previewReport
      });
      setIsPinConfirmOpen(false);
      setPinInput('');
      setViewingClosing(closed);
      setToastMsg({
        type: 'success',
        text: `${previewReport.businessLabel} (${previewReport.periodStart} ~ ${previewReport.periodEnd}) ကာလပိတ်သိမ်းပြီးပါပြီ ✓`
      });
    } catch (err: any) {
      setPinError(err?.message || 'ကာလပိတ်သိမ်းရာတွင် အမှားဖြစ်ပွားပါသည်');
    } finally {
      setIsSubmittingClose(false);
    }
  };

  const handleConfirmReopen = async () => {
    if (!reopenTarget) return;
    if (!reopenPin.trim() || !verifyOwnerPassword(reopenPin.trim())) {
      setReopenError('Owner PIN မမှန်ကန်ပါ');
      return;
    }
    if (!reopenReason.trim()) {
      setReopenError('ပြန်ဖွင့်ရသည့် အကြောင်းပြချက် ထည့်သွင်းပါ');
      return;
    }
    try {
      await periodCtx.reopenPeriod(reopenTarget.id, reopenPin.trim(), reopenReason.trim());
      if (viewingClosing?.id === reopenTarget.id) {
        setViewingClosing(null);
      }
      setReopenTarget(null);
      setReopenPin('');
      setReopenReason('');
      setReopenError(null);
      setToastMsg({ type: 'success', text: 'ကာလအား ပြန်လည်ဖွင့်လှစ်ပြီးပါပြီ ✓' });
    } catch (err: any) {
      setReopenError(err?.message || 'ပြန်ဖွင့်၍ မရပါ');
    }
  };

  const handleCopyReport = () => {
    const text = formatPeriodCloseReportText(displayedReport, activeClosedRecord?.closedAt);
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handlePrintReport = () => {
    printStatementReport(
      'printable-period-close-report',
      `${displayedReport.businessLabel} - ကာလပိတ် ရှင်းတမ်း (${displayedReport.periodStart} မှ ${displayedReport.periodEnd})`
    );
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Grand Summary & Person Summary
    const summaryRows: any[] = [];
    displayedReport.customers.forEach((c, idx) => {
      summaryRows.push({
        'အမျိုးအစား': 'ထိုးသား/ဒိုင်ငယ်',
        'စဉ်': idx + 1,
        'အမည်': c.name,
        'ထိုး/တင်ကြေး': c.totalStake,
        'ကော်မရှင်': c.totalCommission,
        'ပေါက်ကြေး': c.totalPayout,
        'ရရန်': c.netBalance >= 0 ? c.netBalance : 0,
        'ပေးရန်': c.netBalance < 0 ? Math.abs(c.netBalance) : 0
      });
    });
    displayedReport.uplines.forEach((u, idx) => {
      summaryRows.push({
        'အမျိုးအစား': 'အထက်ဒိုင်',
        'စဉ်': idx + 1,
        'အမည်': u.name,
        'ထိုး/တင်ကြေး': u.totalStake,
        'ကော်မရှင်': u.totalCommission,
        'ပေါက်ကြေး': u.totalPayout,
        'ရရန်': u.netBalance < 0 ? Math.abs(u.netBalance) : 0,
        'ပေးရန်': u.netBalance >= 0 ? u.netBalance : 0
      });
    });

    const g = displayedReport.grandTotals;
    summaryRows.push({
      'အမျိုးအစား': 'စာရင်းချုပ် စုစုပေါင်း',
      'စဉ်': '-',
      'အမည်': `${displayedReport.periodStart} ~ ${displayedReport.periodEnd}`,
      'ထိုး/တင်ကြေး': g.totalSales,
      'ကော်မရှင်': g.totalCustomerCommission,
      'ပေါက်ကြေး': g.totalPayout,
      'ရရန်': g.totalReceivable,
      'ပေးရန်': g.totalPayable
    });
    summaryRows.push({
      'အမျိုးအစား': 'အမြတ်/အရှုံး စုစုပေါင်း',
      'စဉ်': '-',
      'အမည်': g.netProfit >= 0 ? 'အမြတ်' : 'အရှုံး',
      'ထိုး/တင်ကြေး': '',
      'ကော်မရှင်': '',
      'ပေါက်ကြေး': '',
      'ရရန်': g.netProfit >= 0 ? g.netProfit : 0,
      'ပေးရန်': g.netProfit < 0 ? Math.abs(g.netProfit) : 0
    });

    const ws1 = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, ws1, 'စာရင်းချုပ်');

    // Sheet 2: Day-by-Day Round Lines
    const detailRows: any[] = [];
    displayedReport.customers.forEach((c) => {
      c.rounds.forEach((r) => {
        detailRows.push({
          'အမျိုးအစား': 'ထိုးသား/ဒိုင်ငယ်',
          'အမည်': c.name,
          'ရက်စွဲ': r.date,
          'ပွဲစဉ်': r.roundLabel,
          'ထွက်ဂဏန်း/ရလဒ်': r.winningResult || '-',
          'ထိုး/တင်ကြေး': r.stake,
          'ကော်မရှင်': r.commission,
          'ပေါက်ကြေး': r.payout,
          'ရရန်': r.netBalance >= 0 ? r.netBalance : 0,
          'ပေးရန်': r.netBalance < 0 ? Math.abs(r.netBalance) : 0
        });
      });
    });
    displayedReport.uplines.forEach((u) => {
      u.rounds.forEach((r) => {
        detailRows.push({
          'အမျိုးအစား': 'အထက်ဒိုင်',
          'အမည်': u.name,
          'ရက်စွဲ': r.date,
          'ပွဲစဉ်': r.roundLabel,
          'ထွက်ဂဏန်း/ရလဒ်': r.winningResult || '-',
          'ထိုး/တင်ကြေး': r.stake,
          'ကော်မရှင်': r.commission,
          'ပေါက်ကြေး': r.payout,
          'ရရန်': r.netBalance < 0 ? Math.abs(r.netBalance) : 0,
          'ပေးရန်': r.netBalance >= 0 ? r.netBalance : 0
        });
      });
    });
    if (detailRows.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, ws2, 'တနေ့ချင်းအသေးစိတ်');
    }

    XLSX.writeFile(
      wb,
      `ကာလပိတ်_${displayedReport.game}_${displayedReport.periodStart}_${displayedReport.periodEnd}.xlsx`
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 max-h-[94vh] flex flex-col justify-between overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-5 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black text-white truncate">
                {getBusinessLabel(activeMode)} — ကာလပိတ် စာရင်းချုပ်
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                ထိုးသားတစ်ဦးချင်း၊ အထက်ဒိုင်တစ်ဦးချင်း ပေါင်းစည်းရှင်းတမ်းနှင့် ပိတ်ပြီးသားမှတ်တမ်း
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('preview');
                  setViewingClosing(null);
                }}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  activeTab === 'preview' && !viewingClosing
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>ကာလပိတ်ရန်</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  activeTab === 'history' || viewingClosing
                    ? 'bg-amber-500 text-slate-950 font-black'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>မှတ်တမ်း ({businessClosings.length})</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Business Mode Switcher (Only visible when opened from Master 'all' Settings view) */}
        {!isModeLocked && (
          <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center gap-2 flex-wrap shrink-0">
            <span className="text-[11px] font-bold text-slate-600">လုပ်ငန်းရွေးရန် (သီးသန့်စီ):</span>
            {(['2d', '3d', 'football'] as BookieMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleSelectBusinessMode(m)}
                className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                  activeMode === m
                    ? m === '2d'
                      ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                      : m === '3d'
                      ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                      : 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {getBusinessLabel(m)}
              </button>
            ))}
          </div>
        )}

        {/* Toast / Feedback Banner */}
        {toastMsg && (
          <div
            className={`px-4 py-2 text-xs font-bold flex items-center justify-between border-b shrink-0 ${
              toastMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {toastMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{toastMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMsg(null)}
              className="text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Main Scrollable Body */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50">
          {activeTab === 'history' && !viewingClosing ? (
            /* CLOSED PERIODS ARCHIVE LIST */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-amber-600" />
                  <span>{getBusinessLabel(activeMode)} — ပိတ်ပြီးသား ကာလမှတ်တမ်းများ</span>
                </h3>
                <span className="text-[11px] font-bold text-slate-500">
                  စုစုပေါင်း {businessClosings.length} ကြိမ်
                </span>
              </div>

              {businessClosings.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
                  <Lock className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-500">
                    {getBusinessLabel(activeMode)} အတွက် ပိတ်သိမ်းထားသော ကာလမှတ်တမ်း မရှိသေးပါ
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                  >
                    ကာလအသစ် ပိတ်ရန်သွားမည်
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {businessClosings.map((pc) => {
                    const isTampered = periodCtx.tamperedPeriodIds.includes(pc.id);
                    const totalRec = pc.totals?.totalReceivable ?? pc.reportSnapshot?.grandTotals.totalReceivable;
                    const totalPay = pc.totals?.totalPayable ?? pc.reportSnapshot?.grandTotals.totalPayable;
                    return (
                      <div
                        key={pc.id}
                        className={`bg-white border rounded-2xl p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isTampered ? 'border-rose-300 bg-rose-50/40' : 'border-slate-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-sm text-slate-900">
                              {pc.periodStart} မှ {pc.periodEnd}
                            </span>
                            {isTampered ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-black">
                                ⚠️ ဒေတာပြောင်းလဲမှုတွေ့ရှိ
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black">
                                ✓ ပိတ်သိမ်းပြီး
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-bold">
                            ပိတ်သိမ်းချိန်: {new Date(pc.closedAt).toLocaleString('en-GB')}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono pt-0.5">
                            {typeof totalRec === 'number' && (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                                ရရန်: {formatAmount(totalRec, currency)}
                              </span>
                            )}
                            {typeof totalPay === 'number' && (
                              <span className="px-2 py-0.5 rounded-lg bg-rose-50 text-rose-800 font-bold border border-rose-200">
                                ပေးရန်: {formatAmount(totalPay, currency)}
                              </span>
                            )}
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-bold">
                              ထိုးကြေး: {formatAmount(pc.totals?.sales || 0, currency)}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 font-bold">
                              ပေါက်ကြေး: {formatAmount(pc.totals?.payout || 0, currency)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-lg font-black ${
                                (pc.totals?.profit || 0) >= 0
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-rose-600 text-white'
                              }`}
                            >
                              {(pc.totals?.profit || 0) >= 0 ? 'အမြတ်: +' : 'အရှုံး: -'}
                              {formatAmount(Math.abs(pc.totals?.profit || 0), currency)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setViewingClosing(pc)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>ရှင်းတမ်းကြည့်မည်</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReopenTarget(pc);
                              setReopenPin('');
                              setReopenReason('');
                              setReopenError(null);
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                            title="PIN ဖြင့် ကာလပြန်ဖွင့်ရန်"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>ပြန်ဖွင့်</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* COMBINED STATEMENT VIEWER (LIVE PREVIEW OR ARCHIVED CLOSED PERIOD) */
            <div className="space-y-4">
              {viewingClosing ? (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                    <button
                      type="button"
                      onClick={() => {
                        setViewingClosing(null);
                        setActiveTab('history');
                      }}
                      className="px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 rounded-xl text-slate-800 flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>မှတ်တမ်းသို့</span>
                    </button>
                    <span>
                      ပိတ်သိမ်းပြီးသား ကာလမှတ်တမ်း ({viewingClosing.periodStart} ~ {viewingClosing.periodEnd})
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-amber-800 font-bold">
                    ပိတ်ချိန်: {new Date(viewingClosing.closedAt).toLocaleString('en-GB')}
                  </span>
                </div>
              ) : (
                /* Date Selector & Quick Presets Bar */
                <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-3 shadow-2xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        စတင်မည့်ရက် (Start Date)
                      </label>
                      <div className="relative">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500/30 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        ပြီးဆုံးမည့်ရက် (End Date)
                      </label>
                      <div className="relative">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500/30 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Range Buttons tailored per business */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="font-bold text-slate-500 mr-1">အမြန်ရွေးရန်:</span>
                      {activeMode === '2d' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const r = get2DWorkWeekRange(0);
                              setStartDate(r.startDate);
                              setEndDate(r.endDate);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 font-bold cursor-pointer"
                          >
                            လက်ရှိ/ပြီးခဲ့သည့် ၅ ရက် (လာ-ကြာ)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const r = get2DWorkWeekRange(1);
                              setStartDate(r.startDate);
                              setEndDate(r.endDate);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold cursor-pointer"
                          >
                            အရှေ့ ၁ ပတ် (လာ-ကြာ)
                          </button>
                        </>
                      ) : activeMode === '3d' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setStartDate(getDaysAgoStr(14));
                              setEndDate(getLocalDateStr());
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold cursor-pointer"
                          >
                            ၁၅ ရက်စာ
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStartDate(getDaysAgoStr(29));
                              setEndDate(getLocalDateStr());
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold cursor-pointer"
                          >
                            ၃၀ ရက်စာ
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setStartDate(getDaysAgoStr(4));
                              setEndDate(getLocalDateStr());
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold cursor-pointer"
                          >
                            ၅ ရက်စာ
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStartDate(getDaysAgoStr(6));
                              setEndDate(getLocalDateStr());
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold cursor-pointer"
                          >
                            ၇ ရက်စာ (၁ ပတ်)
                          </button>
                        </>
                      )}
                      {statementStartDate &&
                        statementEndDate &&
                        statementStartDate !== '2020-01-01' &&
                        statementEndDate !== '2099-12-31' && (
                          <button
                            type="button"
                            onClick={() => {
                              setStartDate(statementStartDate);
                              setEndDate(statementEndDate);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold cursor-pointer"
                          >
                            စာရင်းရှင်းတမ်းမှ ရက်စွဲ
                          </button>
                        )}
                    </div>

                    {overlappingClosing && (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black">
                        ✓ ပိတ်သိမ်းပြီးသားကာလ ({overlappingClosing.periodStart} ~ {overlappingClosing.periodEnd})
                      </span>
                    )}
                  </div>

                  {displayedReport.unsettledRoundsCount > 0 && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 text-[11px] font-bold text-amber-900 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        သတိပြုရန်: ဤကာလအတွင်း ပေါက်ဂဏန်း/ရလဒ် မထည့်ရသေးသော ပွဲစဉ် {displayedReport.unsettledRoundsCount} ခု ရှိနေပါသည်။ ပိတ်သိမ်းမီ ရလဒ်များ စစ်ဆေးပါ။
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Traditional Paper Slip Combined Period Report Card (Matching PeriodSettlementModal style) */}
              <div
                id="printable-period-close-report"
                className="bg-amber-50/90 border-2 border-amber-900/30 rounded-2xl p-4 sm:p-5 shadow-sm max-w-2xl mx-auto space-y-5 font-mono text-slate-900"
              >
                {/* Slip Header */}
                <div className="text-center border-b-2 border-dashed border-amber-900/30 pb-3 space-y-1">
                  <div className="text-sm sm:text-base font-black text-slate-900 font-sans">
                    {displayedReport.businessLabel} — ကာလပိတ် စာရင်းချုပ် ရှင်းတမ်း
                  </div>
                  <div className="text-xs font-bold text-slate-700">
                    ကာလ: {displayedReport.periodStart} မှ {displayedReport.periodEnd} အထိ
                  </div>
                  <div className="flex items-center justify-center gap-2 text-[11px] font-sans text-slate-500">
                    <span>ပွဲစဉ် {displayedReport.grandTotals.roundsCount} ခု</span>
                    <span>•</span>
                    <span>ဘောင်ချာ {displayedReport.grandTotals.vouchersCount} စောင်</span>
                    {activeClosedRecord && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-700 font-black">✓ ပိတ်သိမ်းပြီး</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Section 1: Downline Customers */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-dashed border-amber-900/30 pb-1.5">
                    <span className="text-xs font-black text-teal-900 font-sans flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-teal-700" />
                      <span>၁။ ထိုးသား / ဒိုင်ငယ် တစ်ဦးချင်းစီ စာရင်း ({displayedReport.customers.length} ဦး)</span>
                    </span>
                  </div>

                  {displayedReport.customers.length === 0 ? (
                    <div className="text-xs text-slate-500 font-sans py-3 text-center">
                      သတ်မှတ်ကာလအတွင်း ထိုးသားစာရင်း မရှိပါ
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {displayedReport.customers.map((cust, cIdx) => {
                        const isRec = cust.netBalance >= 0;
                        return (
                          <div
                            key={cust.name}
                            className="bg-white/85 border border-amber-900/20 rounded-xl overflow-hidden shadow-2xs"
                          >
                            {/* Person Header */}
                            <div className="px-3 py-2 bg-amber-100/70 border-b border-amber-900/15 flex items-center justify-between gap-2">
                              <span className="font-sans font-black text-xs sm:text-sm text-slate-900">
                                {cIdx + 1}. {cust.name}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-black ${
                                  isRec
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : 'bg-rose-100 text-rose-900 border border-rose-300'
                                }`}
                              >
                                {isRec ? 'ရရန်: ' : 'ပေးရန်: '}
                                {formatAmount(Math.abs(cust.netBalance), displayedReport.currency)}
                              </span>
                            </div>

                            {/* Concise Day-by-Day / Round-by-Round Table */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-[11px] border-collapse">
                                <thead>
                                  <tr className="bg-slate-50/90 text-slate-600 font-sans border-b border-slate-200">
                                    <th className="py-1.5 px-2.5 text-left">ရက်စွဲ / ပွဲစဉ်</th>
                                    <th className="py-1.5 px-2 text-right">ထိုးကြေး</th>
                                    <th className="py-1.5 px-2 text-right">ကော်</th>
                                    <th className="py-1.5 px-2 text-right">ပေါက်</th>
                                    <th className="py-1.5 px-2.5 text-right">ရရန်/ပေးရန်</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {cust.rounds.map((r) => (
                                    <tr key={r.key} className={r.payout > 0 ? 'bg-amber-50/50' : ''}>
                                      <td className="py-1.5 px-2.5 text-slate-800 font-sans">
                                        <div className="flex items-center gap-1 flex-wrap">
                                          {r.payout > 0 && (
                                            <Star className="w-3 h-3 fill-amber-400 text-amber-500 inline shrink-0" />
                                          )}
                                          <span className="font-mono font-bold">{r.date}</span>
                                          <span className="text-slate-600 font-bold">{r.roundLabel}</span>
                                          {r.winningResult && (
                                            <span className="text-[10px] px-1.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-mono font-black">
                                              {r.winningResult}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-bold text-slate-800">
                                        {formatAmount(r.stake, '')}
                                      </td>
                                      <td className="py-1.5 px-2 text-right text-sky-700 font-bold">
                                        {formatAmount(r.commission, '')}
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-bold text-amber-700">
                                        {r.payout > 0 ? formatAmount(r.payout, '') : '-'}
                                      </td>
                                      <td
                                        className={`py-1.5 px-2.5 text-right font-black ${
                                          r.netBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'
                                        }`}
                                      >
                                        {r.netBalance >= 0 ? 'ရ ' : 'ပေး '}
                                        {formatAmount(Math.abs(r.netBalance), '')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-slate-100/80 border-t border-slate-300 font-black text-slate-900">
                                    <td className="py-1.5 px-2.5 font-sans">စုစုပေါင်း</td>
                                    <td className="py-1.5 px-2 text-right">{formatAmount(cust.totalStake, '')}</td>
                                    <td className="py-1.5 px-2 text-right text-sky-800">
                                      {formatAmount(cust.totalCommission, '')}
                                    </td>
                                    <td className="py-1.5 px-2 text-right text-amber-800">
                                      {formatAmount(cust.totalPayout, '')}
                                    </td>
                                    <td
                                      className={`py-1.5 px-2.5 text-right ${
                                        isRec ? 'text-emerald-800' : 'text-rose-800'
                                      }`}
                                    >
                                      {isRec ? 'ရရန် ' : 'ပေးရန် '}
                                      {formatAmount(Math.abs(cust.netBalance), '')}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Section 2: Upline Master Agents */}
                {displayedReport.uplines.length > 0 && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between border-b border-dashed border-amber-900/30 pb-1.5">
                      <span className="text-xs font-black text-indigo-900 font-sans flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-indigo-700" />
                        <span>၂။ အထက်တင် ဒိုင်တစ်ဦးချင်းစီ စာရင်း ({displayedReport.uplines.length} ဦး)</span>
                      </span>
                    </div>

                    <div className="space-y-3">
                      {displayedReport.uplines.map((up, uIdx) => {
                        // For upline: netBalance >= 0 means we pay upline (ပေးရန်); < 0 means upline pays us (ရရန်)
                        const weOweUpline = up.netBalance >= 0;
                        return (
                          <div
                            key={up.name}
                            className="bg-white/85 border border-indigo-900/20 rounded-xl overflow-hidden shadow-2xs"
                          >
                            <div className="px-3 py-2 bg-indigo-50/90 border-b border-indigo-900/15 flex items-center justify-between gap-2">
                              <span className="font-sans font-black text-xs sm:text-sm text-slate-900">
                                {uIdx + 1}. {up.name}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-black ${
                                  weOweUpline
                                    ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                    : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                }`}
                              >
                                {weOweUpline ? 'အထက်ဒိုင်သို့ ပေးရန်: ' : 'အထက်ဒိုင်မှ ရရန်: '}
                                {formatAmount(Math.abs(up.netBalance), displayedReport.currency)}
                              </span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-[11px] border-collapse">
                                <thead>
                                  <tr className="bg-slate-50/90 text-slate-600 font-sans border-b border-slate-200">
                                    <th className="py-1.5 px-2.5 text-left">ရက်စွဲ / ပွဲစဉ်</th>
                                    <th className="py-1.5 px-2 text-right">တင်ကြေး</th>
                                    <th className="py-1.5 px-2 text-right">ကော်</th>
                                    <th className="py-1.5 px-2 text-right">ပေါက်</th>
                                    <th className="py-1.5 px-2.5 text-right">ပေးရန်/ရရန်</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {up.rounds.map((r) => (
                                    <tr key={r.key} className={r.payout > 0 ? 'bg-amber-50/50' : ''}>
                                      <td className="py-1.5 px-2.5 text-slate-800 font-sans">
                                        <div className="flex items-center gap-1 flex-wrap">
                                          {r.payout > 0 && (
                                            <Star className="w-3 h-3 fill-amber-400 text-amber-500 inline shrink-0" />
                                          )}
                                          <span className="font-mono font-bold">{r.date}</span>
                                          <span className="text-slate-600 font-bold">{r.roundLabel}</span>
                                          {r.winningResult && (
                                            <span className="text-[10px] px-1.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-mono font-black">
                                              {r.winningResult}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-bold text-slate-800">
                                        {formatAmount(r.stake, '')}
                                      </td>
                                      <td className="py-1.5 px-2 text-right text-sky-700 font-bold">
                                        {formatAmount(r.commission, '')}
                                      </td>
                                      <td className="py-1.5 px-2 text-right font-bold text-amber-700">
                                        {r.payout > 0 ? formatAmount(r.payout, '') : '-'}
                                      </td>
                                      <td
                                        className={`py-1.5 px-2.5 text-right font-black ${
                                          r.netBalance >= 0 ? 'text-rose-700' : 'text-emerald-700'
                                        }`}
                                      >
                                        {r.netBalance >= 0 ? 'ပေး ' : 'ရ '}
                                        {formatAmount(Math.abs(r.netBalance), '')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="bg-slate-100/80 border-t border-slate-300 font-black text-slate-900">
                                    <td className="py-1.5 px-2.5 font-sans">စုစုပေါင်း</td>
                                    <td className="py-1.5 px-2 text-right">{formatAmount(up.totalStake, '')}</td>
                                    <td className="py-1.5 px-2 text-right text-sky-800">
                                      {formatAmount(up.totalCommission, '')}
                                    </td>
                                    <td className="py-1.5 px-2 text-right text-amber-800">
                                      {formatAmount(up.totalPayout, '')}
                                    </td>
                                    <td
                                      className={`py-1.5 px-2.5 text-right ${
                                        weOweUpline ? 'text-rose-800' : 'text-emerald-800'
                                      }`}
                                    >
                                      {weOweUpline ? 'ပေးရန် ' : 'ရရန် '}
                                      {formatAmount(Math.abs(up.netBalance), '')}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Section 3: Bottom Grand Totals Summary (Matching Traditional Paper Slip Card) */}
                <div className="border-t-2 border-dashed border-amber-900/35 pt-4 space-y-2 text-xs">
                  <div className="text-xs font-black text-slate-800 font-sans uppercase tracking-wide pb-1">
                    စာရင်းချုပ် စုစုပေါင်း (Grand Totals)
                  </div>

                  <div className="flex items-center justify-between font-black text-emerald-800">
                    <span className="font-sans">ရရန်စုစုပေါင်း:</span>
                    <span>{formatAmount(displayedReport.grandTotals.totalReceivable, displayedReport.currency)}</span>
                  </div>

                  <div className="flex items-center justify-between font-black text-rose-700 border-b border-dashed border-slate-300 pb-2">
                    <span className="font-sans">ပေးရန်စုစုပေါင်း:</span>
                    <span>{formatAmount(displayedReport.grandTotals.totalPayable, displayedReport.currency)}</span>
                  </div>

                  <div className="flex items-center justify-between font-bold text-slate-800 pt-0.5">
                    <span className="font-sans">ထိုးကြေးစုစုပေါင်း:</span>
                    <span>{formatAmount(displayedReport.grandTotals.totalSales, displayedReport.currency)}</span>
                  </div>

                  <div className="flex items-center justify-between font-bold text-amber-800 border-b border-dashed border-slate-300 pb-2">
                    <span className="font-sans">ပေါက်ကြေးစုစုပေါင်း:</span>
                    <span>{formatAmount(displayedReport.grandTotals.totalPayout, displayedReport.currency)}</span>
                  </div>

                  {(displayedReport.grandTotals.totalCustomerCommission > 0 ||
                    displayedReport.grandTotals.totalForwarded > 0) && (
                    <div className="text-[10px] text-slate-500 font-sans flex flex-wrap items-center justify-between gap-1 pb-1">
                      <span>
                        အောက်လက်ကော်: {formatAmount(displayedReport.grandTotals.totalCustomerCommission, displayedReport.currency)}
                      </span>
                      {displayedReport.grandTotals.totalForwarded > 0 && (
                        <span>
                          အထက်တင်: {formatAmount(displayedReport.grandTotals.totalForwarded, displayedReport.currency)} | ကော်:{' '}
                          {formatAmount(displayedReport.grandTotals.totalForwardCommission, displayedReport.currency)} | ပေါက်:{' '}
                          {formatAmount(displayedReport.grandTotals.totalMasterPayout, displayedReport.currency)}
                        </span>
                      )}
                    </div>
                  )}

                  <div
                    className={`p-3.5 rounded-xl border-2 flex items-center justify-between text-sm font-black ${
                      displayedReport.grandTotals.netProfit >= 0
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900'
                        : 'bg-rose-50 border-rose-500 text-rose-900'
                    }`}
                  >
                    <span className="font-sans">
                      {displayedReport.grandTotals.netProfit >= 0
                        ? 'အမြတ် / အရှုံး စုစုပေါင်း (အမြတ်):'
                        : 'အမြတ် / အရှုံး စုစုပေါင်း (အရှုံး):'}
                    </span>
                    <span className="font-mono text-base font-black">
                      {displayedReport.grandTotals.netProfit >= 0 ? '+' : '-'}
                      {formatAmount(Math.abs(displayedReport.grandTotals.netProfit), displayedReport.currency)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-100 px-4 sm:px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-xs font-bold text-slate-600">
            {displayedReport.businessLabel}:{' '}
            <span className="font-mono text-slate-900 font-black">
              {displayedReport.periodStart} ~ {displayedReport.periodEnd}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(activeTab === 'preview' || viewingClosing) && (
              <>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel ထုတ်</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>ပရင့် / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyReport}
                  className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedText ? 'ကူးယူပြီး ✓' : 'စာသားကူးရန်'}</span>
                </button>
                {!viewingClosing && !overlappingClosing && (
                  <button
                    type="button"
                    onClick={handleOpenPinConfirm}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>ကာလပိတ်သိမ်းမည်</span>
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              ပိတ်မည်
            </button>
          </div>
        </div>
      </div>

      {/* Inline Owner PIN Confirmation Modal for Closing Period */}
      {isPinConfirmOpen && (
        <div className="fixed inset-0 z-[90] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-rose-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm">
                <Lock className="w-4 h-4 text-rose-300" />
                <span>{previewReport.businessLabel} — ကာလပိတ် အတည်ပြုရန်</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPinConfirmOpen(false)}
                className="text-rose-200 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1 text-slate-800">
                <div className="font-black text-slate-900">
                  ကာလ: {previewReport.periodStart} မှ {previewReport.periodEnd} အထိ
                </div>
                <div className="flex justify-between">
                  <span>ရရန်စုစုပေါင်း:</span>
                  <span className="font-mono font-black text-emerald-700">
                    {formatAmount(previewReport.grandTotals.totalReceivable, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>ပေးရန်စုစုပေါင်း:</span>
                  <span className="font-mono font-black text-rose-700">
                    {formatAmount(previewReport.grandTotals.totalPayable, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>ထိုးကြေးစုစုပေါင်း:</span>
                  <span className="font-mono font-bold">
                    {formatAmount(previewReport.grandTotals.totalSales, currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>ပေါက်ကြေးစုစုပေါင်း:</span>
                  <span className="font-mono font-bold">
                    {formatAmount(previewReport.grandTotals.totalPayout, currency)}
                  </span>
                </div>
                <div className="flex justify-between pt-1 border-t border-amber-200 font-black">
                  <span>အမြတ်/အရှုံး စုစုပေါင်း:</span>
                  <span
                    className={`font-mono ${
                      previewReport.grandTotals.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {previewReport.grandTotals.netProfit >= 0 ? '+' : '-'}
                    {formatAmount(Math.abs(previewReport.grandTotals.netProfit), currency)}
                  </span>
                </div>
              </div>

              <p className="text-rose-700 font-bold bg-rose-50 border border-rose-200 rounded-xl p-2.5">
                ⚠️ ကာလပိတ်သိမ်းပြီးပါက ဤရက်စွဲအတွင်းရှိ ဘောင်ချာများနှင့် ပွဲစဉ်များကို ပြင်ဆင်/ဖျက်သိမ်း၍ မရတော့ပါ။
              </p>

              <div className="space-y-1">
                <label className="block font-bold text-slate-700">
                  Owner PIN (၆ လုံး) ရိုက်ထည့်ပါ:
                </label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    setPinError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmClosePeriod();
                  }}
                  autoFocus
                  placeholder="PIN ရိုက်ထည့်ပါ"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-rose-500 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 outline-none"
                />
              </div>

              {pinError && (
                <p className="text-xs font-bold text-rose-600">⚠️ {pinError}</p>
              )}
            </div>

            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPinConfirmOpen(false)}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                မလုပ်တော့ပါ
              </button>
              <button
                type="button"
                disabled={isSubmittingClose}
                onClick={handleConfirmClosePeriod}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black rounded-xl cursor-pointer shadow-xs"
              >
                {isSubmittingClose ? 'ပိတ်နေပါသည်...' : 'အတည်ပြု ကာလပိတ်မည်'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Owner PIN Confirmation Modal for Reopening Closed Period */}
      {reopenTarget && (
        <div className="fixed inset-0 z-[90] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm">
                <Unlock className="w-4 h-4 text-amber-400" />
                <span>ပိတ်ပြီးသားကာလ ပြန်ဖွင့်ရန်</span>
              </div>
              <button
                type="button"
                onClick={() => setReopenTarget(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="font-bold text-slate-700">
                ကာလ: <span className="font-mono text-slate-900">{reopenTarget.periodStart} ~ {reopenTarget.periodEnd}</span>
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-700">ပြန်ဖွင့်ရသည့် အကြောင်းပြချက်:</label>
                <input
                  type="text"
                  value={reopenReason}
                  onChange={(e) => {
                    setReopenReason(e.target.value);
                    setReopenError(null);
                  }}
                  placeholder="ဥပမာ - ဘောင်ချာတစ်စောင် ပြင်ဆင်ရန်"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold text-slate-900 outline-none focus:border-amber-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-bold text-slate-700">Owner PIN (၆ လုံး):</label>
                <input
                  type="password"
                  value={reopenPin}
                  onChange={(e) => {
                    setReopenPin(e.target.value);
                    setReopenError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirmReopen();
                  }}
                  placeholder="PIN ရိုက်ထည့်ပါ"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 outline-none focus:border-amber-500"
                />
              </div>
              {reopenError && (
                <p className="text-xs font-bold text-rose-600">⚠️ {reopenError}</p>
              )}
            </div>

            <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setReopenTarget(null)}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                မလုပ်တော့ပါ
              </button>
              <button
                type="button"
                onClick={handleConfirmReopen}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black rounded-xl cursor-pointer shadow-xs"
              >
                အတည်ပြု ပြန်ဖွင့်မည်
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
