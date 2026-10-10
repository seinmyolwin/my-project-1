import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Settings,
  Store,
  Database,
  RotateCcw,
  Trash2,
  Check,
  Save,
  Coins,
  Layers,
  Sparkles,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  Lock,
  Download,
  Upload,
  HardDrive,
  FileCheck2,
  Sliders,
  ShieldAlert,
  Search,
  Plus,
  Ban,
  Percent,
  TrendingUp,
  FolderDown,
  Share2,
  FileSpreadsheet,
  Printer,
  AlertCircle,
  Calendar
} from 'lucide-react';
import { verifyOwnerPassword } from '../utils/securityUtils';
import { useLottery } from '../context/LotteryContext';
import { printStatementReport } from '../utils/printUtils';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import {
  StatementRecord,
  generateStatementRecords,
  computeStatementGrandTotals,
  getStatementDateRange,
  StatementPeriodPreset
} from '../utils/statementUtils';
import { BookieMode, TwoDNumberAggregate, NumberAggregate, TwoDQuickActionButtonsConfig } from '../types';
import { DEFAULT_2D_ACTION_BUTTONS } from '../utils/storage';
import { formatAmount, getPermutations, evaluateWinnings } from '../utils/lotteryUtils';
import { evaluateTwoDWinnings } from '../utils/twoDLotteryUtils';
import { exportFootballDataToExcel } from '../utils/footballUtils';
import { EnabledModes, saveEnabledModes, saveOwnerPin, verifyOwnerPin, getStoredOwnerPin } from '../utils/securityUtils';
import {
  exportSecureMasterBackup,
  restoreSecureMasterBackup,
  exportPeriodVouchersBackup,
  saveFileWithCustomLocation,
  shareFileDirectly,
  downloadFile,
  getBackupFileName
} from '../utils/backupUtils';
import { useSwipeGesture } from '../hooks/useSwipeGesture';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: '3d' | '2d' | 'football' | 'general' | 'backup' | 'statements' | 'excel';
  enabledModes: EnabledModes;
  onUpdateEnabledModes: (modes: EnabledModes) => void;
  onOpenMasterStatement?: () => void;
}

const BUTTON_DEFINITIONS_2D: Array<{
  key: keyof TwoDQuickActionButtonsConfig;
  label: string;
  nameMyanmar: string;
  nameEnglish: string;
  desc: string;
  previewClass: string;
  icon?: React.ReactNode;
}> = [
  {
    key: 'straight',
    label: 'ဒဲ့',
    nameMyanmar: 'ဒဲ့ (တိုက်ရိုက်ထိုးကြေး)',
    nameEnglish: 'Straight / Direct',
    desc: 'ပတ်လည်မပါဘဲ တိုက်ရိုက်ဂဏန်းများအဖြစ် သွင်းမည်',
    previewClass: 'px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-black flex items-center gap-1 shadow-2xs shrink-0',
    icon: <Check className="w-3 h-3" />
  },
  {
    key: 'rumble',
    label: 'ပတ်လည်',
    nameMyanmar: 'ပတ်လည် (အာ / R)',
    nameEnglish: 'Rumble / Reversal',
    desc: '၂၄ ဆိုပါက ၂၄, ၄၂ နှစ်ကွက်လုံး ထည့်မည်',
    previewClass: 'px-2.5 py-1 bg-teal-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs shrink-0',
    icon: <RotateCcw className="w-3 h-3" />
  },
  {
    key: 'break',
    label: 'ရိတ်',
    nameMyanmar: 'ရိတ် (ဘရိတ်)',
    nameEnglish: 'Break Digit',
    desc: 'ပေါင်းလဒ် ဘရိတ် ၁၀ ကွက် ထုတ်ပေးသည်',
    previewClass: 'px-2.5 py-1 bg-sky-50 border border-sky-200 text-sky-800 rounded-lg text-xs font-bold shrink-0'
  },
  {
    key: 'includes',
    label: 'အပါ',
    nameMyanmar: 'အပါ (ဂဏန်းပါ)',
    nameEnglish: 'Includes Digit',
    desc: 'ရွေးချယ်ဂဏန်းပါသော ၁၉ ကွက် ထုတ်ပေးသည်',
    previewClass: 'px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs font-bold shrink-0'
  },
  {
    key: 'head',
    label: 'ထိပ်',
    nameMyanmar: 'ထိပ် (ထိပ်စီး)',
    nameEnglish: 'Head Digit',
    desc: 'ရှေ့ဂဏန်း ထိပ်စီး ၁၀ ကွက် ထုတ်ပေးသည်',
    previewClass: 'px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg text-xs font-bold shrink-0'
  },
  {
    key: 'tail',
    label: 'ပိတ်',
    nameMyanmar: 'ပိတ် (နောက်ပိတ်)',
    nameEnglish: 'Tail Digit',
    desc: 'နောက်ဂဏန်း နောက်ပိတ် ၁၀ ကွက် ထုတ်ပေးသည်',
    previewClass: 'px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-800 rounded-lg text-xs font-bold shrink-0'
  },
  {
    key: 'doubles',
    label: 'ပူး',
    nameMyanmar: 'ပူး (အပူး ၁၀ ကွက်)',
    nameEnglish: 'Doubles',
    desc: '၀၀ မှ ၉၉ အထိ အပူး ၁၀ ကွက် ထည့်သွင်းမည်',
    previewClass: 'px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold shrink-0'
  },
  {
    key: 'power',
    label: 'ပါဝါ',
    nameMyanmar: 'ပါဝါ (၁၀ ကွက်)',
    nameEnglish: 'Power Numbers',
    desc: '၀၅ မှ ၄၉ အထိ ပါဝါ ၁၀ ကွက် ထည့်သွင်းမည်',
    previewClass: 'px-2.5 py-1 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs font-bold shrink-0'
  },
  {
    key: 'natkhat',
    label: 'နက္ခတ်',
    nameMyanmar: 'နက္ခတ် (၁၀ ကွက်)',
    nameEnglish: 'Natkhat Numbers',
    desc: '၀၇ မှ ၅၈ အထိ နက္ခတ် ၁၀ ကွက် ထည့်သွင်းမည်',
    previewClass: 'px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold shrink-0'
  },
  {
    key: 'brothers',
    label: 'ညီကို',
    nameMyanmar: 'ညီကို (၂၀ ကွက်)',
    nameEnglish: 'Brothers Numbers',
    desc: '၀၁, ၁၂ မှ ၈၉ အထိ ညီကို ၂၀ ကွက် ထည့်သွင်းမည်',
    previewClass: 'px-2.5 py-1 bg-teal-50 border border-teal-200 text-teal-800 rounded-lg text-xs font-bold shrink-0'
  },
  {
    key: 'khway',
    label: 'ခွေ',
    nameMyanmar: 'ခွေ (ရိုးရိုးခွေ)',
    nameEnglish: 'Khway Straight',
    desc: 'ဥပမာ ၁၂၃၄ -> ၆ ကွက်၊ ၂၃၄၅၆ -> ၁၀ ကွက်',
    previewClass: 'px-2.5 py-1 bg-amber-500 text-white rounded-lg text-xs font-black shadow-xs shrink-0'
  },
  {
    key: 'khwayPuu',
    label: 'ခွေပူး',
    nameMyanmar: 'ခွေပူး (ခွေ + အပူး)',
    nameEnglish: 'Khway Puu',
    desc: 'ဥပမာ ၁၂၃၄ -> ၁၀ ကွက်၊ ၂၃၄၅၆ -> ၁၅ ကွက်',
    previewClass: 'px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-xs font-black shadow-xs shrink-0'
  },
  {
    key: 'khwayRumble',
    label: 'ခွေr',
    nameMyanmar: 'ခွေr (ခွေအာ လှည့်တွဲ)',
    nameEnglish: 'Khway Rumble',
    desc: 'ဥပမာ ၁၂၃၄ -> ၁၂ ကွက်၊ ၂၃၄၅၆ -> ၂၀ ကွက်',
    previewClass: 'px-2.5 py-1 bg-indigo-600 text-white rounded-lg text-xs font-black shadow-xs shrink-0'
  },
  {
    key: 'khwayPuuRumble',
    label: 'ခွေပူးr',
    nameMyanmar: 'ခွေပူးr (ခွေပူးအာ)',
    nameEnglish: 'Khway Puu Rumble',
    desc: 'ဥပမာ ၁၂၃၄ -> ၁၆ ကွက်၊ ၂၃၄၅၆ -> ၂၅ ကွက်',
    previewClass: 'px-2.5 py-1 bg-purple-600 text-white rounded-lg text-xs font-black shadow-xs shrink-0'
  }
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = '3d',
  enabledModes,
  onUpdateEnabledModes,
  onOpenMasterStatement
}) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  const [activeTab, setActiveTab] = useState<'3d' | '2d' | 'football' | 'general' | 'backup' | 'statements' | 'excel'>(initialTab);
  const [subTab3D, setSubTab3D] = useState<'rates' | 'limits' | 'blocked'>('rates');
  const [subTab2D, setSubTab2D] = useState<'rates' | 'limits' | 'blocked' | 'buttons'>('rates');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  // Excel Export Handlers
  const handleExport3DExcel = () => {
    const data = lottery3D.vouchers.map((v, i) => ({
      'စဉ်': i + 1,
      'ဘောင်ချာအမှတ်': v.voucherNo || v.id,
      'ဝယ်သူအမည်': v.customerName,
      'ဖုန်း': v.customerPhone || '-',
      'စုစုပေါင်းထိုးငွေ': v.subtotal,
      'ကော်မရှင်': v.discountAmount,
      'ပေးငွေ': v.netPayable,
      'ရက်စွဲ': new Date(v.createdAt).toLocaleString()
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '3D Sales');
    XLSX.writeFile(wb, `3D_Sales_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExport2DExcel = () => {
    const data = lottery2D.vouchers.map((v, i) => ({
      'စဉ်': i + 1,
      'ဘောင်ချာအမှတ်': v.voucherNo || v.id,
      'ဝယ်သူအမည်': v.customerName,
      'ဖုန်း': v.customerPhone || '-',
      'စုစုပေါင်းထိုးငွေ': v.subtotal,
      'ကော်မရှင်': v.discountAmount,
      'ပေးငွေ': v.netPayable,
      'ရက်စွဲ': new Date(v.createdAt).toLocaleString()
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '2D Sales');
    XLSX.writeFile(wb, `2D_Sales_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportFootballExcel = () => {
    exportFootballDataToExcel(
      football.activeDate,
      football.matches,
      football.slips,
      football.forwardSlips,
      football.summary,
      football.settings.shopName
    );
  };

  // 2D Master Ledger Matrix Export
  const handleExport2DLedgerMatrix = () => {
    const aggs = Object.values(lottery2D.aggregates) as TwoDNumberAggregate[];
    const data = aggs.map((a, i) => ({
      'စဉ်': i + 1,
      'ဂဏန်း': a.number,
      'စုစုပေါင်းအရောင်း (ကျပ်)': a.totalSold,
      'ဒိုင်လက်ကျန်ယူငွေ (ကျပ်)': a.retainedAmount,
      'ဒိုင်ကြီးဆီလွှဲငွေ (ကျပ်)': a.forwardedAmount,
      'ကန့်သတ်ငွေ (Limit)': a.limit,
      'ဒိုင်ကာ/အခြေအနေ': a.isBlocked ? 'ဒိုင်ကာ (Blocked)' : a.totalSold >= a.limit && a.limit > 0 ? 'ဘရိတ်ပြည့် (Full)' : 'ပုံမှန် (Safe)'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '2D Master Ledger');
    XLSX.writeFile(wb, `2D_Master_Ledger_Matrix_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // 3D Master Ledger Matrix Export
  const handleExport3DLedgerMatrix = () => {
    const aggs = Object.values(lottery3D.aggregates) as NumberAggregate[];
    const data = aggs.map((a, i) => ({
      'စဉ်': i + 1,
      'ဂဏန်း': a.number,
      'စုစုပေါင်းအရောင်း (ကျပ်)': a.totalSold,
      'ဒိုင်လက်ကျန်ယူငွေ (ကျပ်)': a.retainedAmount,
      'ဒိုင်ကြီးဆီလွှဲငွေ (ကျပ်)': a.forwardedAmount,
      'ကန့်သတ်ငွေ (Limit)': a.limit,
      'ဒိုင်ကာ/အခြေအနေ': a.isBlocked ? 'ဒိုင်ကာ (Blocked)' : a.totalSold >= a.limit && a.limit > 0 ? 'ဘရိတ်ပြည့် (Full)' : 'ပုံမှန် (Safe)'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '3D Master Ledger');
    XLSX.writeFile(wb, `3D_Master_Ledger_Matrix_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Financial Statements State & Calculations
  const [statementPeriod, setStatementPeriod] = useState<StatementPeriodPreset>('all');
  const [statementMode, setStatementMode] = useState<'all' | '3d' | '2d' | 'football'>('all');
  
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteRecord = () => {
    if (!selectedRecord) return;
    if (!verifyOwnerPassword(deletePassword)) {
      setDeleteError('လျှို့ဝှက်နံပါတ် (Password) မှားယွင်းနေပါသည်!');
      return;
    }
    const recordId = selectedRecord.id;
    const mode = selectedRecord.mode;
    try {
      if (mode === '3d') {
        const roundId = recordId.replace('3d-', '');
        if (roundId.startsWith('orphaned-')) {
          const orphanDate = roundId.replace('orphaned-', '');
          const toDelete = lottery3D.vouchers.filter(v => (v.createdAt || '').slice(0, 10) === orphanDate);
          toDelete.forEach(v => lottery3D.deleteVoucher(v.id));
        } else {
          lottery3D.deleteRound(roundId);
        }
      } else if (mode === '2d') {
        const roundId = recordId.replace('2d-', '');
        if (roundId.startsWith('orphaned-')) {
          const orphanDate = roundId.replace('orphaned-', '');
          const toDelete = lottery2D.vouchers.filter(v => (v.createdAt || '').slice(0, 10) === orphanDate);
          toDelete.forEach(v => lottery2D.deleteVoucher(v.id));
        } else {
          lottery2D.deleteRound(roundId);
        }
      } else if (mode === 'football') {
        const slipDate = recordId.replace('football-', '').replace('fb-', '');
        const slipsToDelete = football.slips.filter((s) => (s.createdAt || s.roundDate || '').slice(0, 10) === slipDate);
        slipsToDelete.forEach((s) => football.deleteSlip(s.id));
      }
      setSelectedRecord(null);
      setIsConfirmingDelete(false);
      setDeletePassword('');
      setDeleteError(null);
      alert('စာရင်းရှင်းတမ်းမှတ်တမ်းအား အပြီးတိုင် ဖျက်သိမ်းပြီးပါပြီ!');
    } catch (err) {
      console.error(err);
      alert('ဖျက်သိမ်းစဉ် ချို့ယွင်းချက်ရှိပါသည်');
    }
  };

  const getLocalISODate = (date: Date = new Date()): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getDaysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return getLocalISODate(d);
  };
  const todayStr = getLocalISODate();
  const threeDaysAgoStr = getDaysAgo(2);
  const fiveDaysAgoStr = getDaysAgo(4);
  const oneWeekAgoStr = getDaysAgo(6);
  const oneMonthAgoStr = getDaysAgo(29);
  const allTimeStartStr = '2020-01-01';
  const allTimeEndStr = '2099-12-31';

  const [stmtCustomStart, setStmtCustomStart] = useState(fiveDaysAgoStr);
  const [stmtCustomEnd, setStmtCustomEnd] = useState(todayStr);

  const { startDate: stmtStartDate, endDate: stmtEndDate } = React.useMemo(() => {
    return getStatementDateRange(statementPeriod as any, stmtCustomStart, stmtCustomEnd);
  }, [statementPeriod, stmtCustomStart, stmtCustomEnd]);

  // Aggregate Statement Records using Single Source of Truth
  const stmtRecords: StatementRecord[] = React.useMemo(() => {
    return generateStatementRecords(
      {
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
      },
      statementMode,
      stmtStartDate,
      stmtEndDate
    );
  }, [
    statementMode,
    stmtStartDate,
    stmtEndDate,
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
  ]);

  // Grand Totals for Statements using Single Source of Truth
  const stmtGrandTotals = React.useMemo(() => {
    const totals = computeStatementGrandTotals(stmtRecords);
    const profitMargin = totals.totalTurnover > 0 ? ((totals.totalNetProfit / totals.totalTurnover) * 100).toFixed(1) : '0.0';

    return {
      totalTurnover: totals.totalTurnover,
      totalForwarded: totals.totalForwarded,
      totalAgentCommission: totals.totalAgentCommission,
      netSales: totals.netSales,
      totalMasterPayout: totals.totalMasterPayout,
      totalForwardCommission: totals.totalForwardCommission,
      totalPayout: totals.totalPayout,
      retainedPayout: totals.retainedPayout,
      totalNetPaid: totals.totalNetPaid,
      netProfit: totals.totalNetProfit,
      isProfit: totals.isProfit,
      profitMargin,
      totalVouchers: totals.totalVouchers,
      totalWinners: totals.totalWinners
    };
  }, [stmtRecords]);

  // Export Statements to Excel
  const handleExportStatementsExcel = () => {
    const data = stmtRecords.map((r, i) => ({
      'စဉ်': i + 1,
      'ရက်စွဲ': r.date,
      'လုပ်ငန်းလိုင်း': r.modeLabel,
      'ပွဲစဉ်အမည်': r.name,
      'ပေါက်ဂဏန်း/ရလဒ်': r.winningResult,
      '၁။ မူလထိုးကြေး (ကျပ်)': r.turnover,
      '၂။ အထက်တင်ကြေး (ကျပ်)': r.totalForwarded,
      '၃။ အောက်လက်ကော်မရှင် (ကျပ်)': r.agentCommission,
      '၄။ အမှန်ရောင်းငွေ (ကျပ်)': r.netSales,
      '၅။ အထက်ပေါက်ကြေး (ကျပ်)': r.masterPayout,
      '၆။ အထက်ကော်မရှင်ခ (ကျပ်)': r.forwardCommission,
      '၇။ ပေးလျှော်ငွေ (ကျပ်)': r.totalPayout,
      '၈။ ဒိုင်အသားတင် အမြတ်/အရှုံး (ကျပ်)': (r.isProfit ? '+' : '-') + Math.abs(r.netProfit),
      'ပေါက်သူဦးရေ': r.winnersCount,
      'ဘောင်ချာစောင်ရေ': r.vouchersCount,
      'အခြေအနေ': r.status === 'settled' ? 'ရှင်းတမ်းပြီး' : 'ဖွင့်လှစ်ဆဲ'
    }));

    data.push({
      'စဉ်': 0 as any,
      'ရက်စွဲ': 'စုစုပေါင်း ချုပ်',
      'လုပ်ငန်းလိုင်း': '-',
      'ပွဲစဉ်အမည်': `${stmtStartDate} မှ ${stmtEndDate} အထိ`,
      'ပေါက်ဂဏန်း/ရလဒ်': '-',
      '၁။ မူလထိုးကြေး (ကျပ်)': stmtGrandTotals.totalTurnover,
      '၂။ အထက်တင်ကြေး (ကျပ်)': stmtGrandTotals.totalForwarded,
      '၃။ အောက်လက်ကော်မရှင် (ကျပ်)': stmtGrandTotals.totalAgentCommission,
      '၄။ အမှန်ရောင်းငွေ (ကျပ်)': stmtGrandTotals.netSales,
      '၅။ အထက်ပေါက်ကြေး (ကျပ်)': stmtGrandTotals.totalMasterPayout,
      '၆။ အထက်ကော်မရှင်ခ (ကျပ်)': stmtGrandTotals.totalForwardCommission,
      '၇။ ပေးလျှော်ငွေ (ကျပ်)': stmtGrandTotals.totalPayout,
      '၈။ ဒိုင်အသားတင် အမြတ်/အရှုံး (ကျပ်)': (stmtGrandTotals.isProfit ? '+' : '-') + Math.abs(stmtGrandTotals.netProfit),
      'ပေါက်သူဦးရေ': stmtGrandTotals.totalWinners,
      'ဘောင်ချာစောင်ရေ': stmtGrandTotals.totalVouchers,
      'အခြေအနေ': stmtGrandTotals.isProfit ? 'အမြတ်' : 'အရှုံး'
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'စာရင်းရှင်းတမ်း');
    XLSX.writeFile(wb, `စာရင်းရှင်းတမ်း_${statementMode}_${stmtStartDate}_${stmtEndDate}.xlsx`);
  };

  // Export All Vouchers for Selected Period to Excel
  const handleExportPeriodAllVouchersExcel = () => {
    const rows: any[] = [];
    let idx = 1;

    // 2D Vouchers
    if (statementMode === 'all' || statementMode === '2d') {
      lottery2D.vouchers
        .filter(v => {
          const d = (v.createdAt || '').slice(0, 10);
          return d >= stmtStartDate && d <= stmtEndDate;
        })
        .forEach(v => {
          const itemsStr = v.items?.map(it => `${it.number}=${it.amount}`).join(', ') || '-';
          rows.push({
            'စဉ်': idx++,
            'လုပ်ငန်း': 'ဇီးကွက် (2D)',
            'ဘောင်ချာအမှတ်': v.voucherNo || v.id,
            'ရက်စွဲ/အချိန်': v.createdAt ? new Date(v.createdAt).toLocaleString('en-GB') : '-',
            'ဝယ်သူအမည်': v.customerName || 'အထွေထွေ',
            'ဖုန်းနံပါတ်': v.customerPhone || '-',
            'ထိုးဂဏန်းများ': itemsStr,
            'မူလထိုးကြေး (ကျပ်)': v.subtotal ?? v.items?.reduce((s, it) => s + (it.amount || 0), 0) ?? 0,
            'အောက်လက်ကော်မရှင် (ကျပ်)': v.discountAmount || 0,
            'အမှန်ပေးငွေ (ကျပ်)': v.netPayable || 0,
            'ငွေရှင်းပြီးမှု': v.isPaid ? 'ရှင်းပြီး' : 'ကြွေးကျန်',
            'ပေါက်မဲ': v.items?.some(it => it.isWon) ? 'ပေါက်မဲရှိ' : '-'
          });
        });
    }

    // 3D Vouchers
    if (statementMode === 'all' || statementMode === '3d') {
      lottery3D.vouchers
        .filter(v => {
          const d = (v.createdAt || '').slice(0, 10);
          return d >= stmtStartDate && d <= stmtEndDate;
        })
        .forEach(v => {
          const itemsStr = v.items?.map(it => `${it.number}=${it.amount}${it.betType === 'rumble' ? 'R' : ''}`).join(', ') || '-';
          rows.push({
            'စဉ်': idx++,
            'လုပ်ငန်း': 'အိုးစည်လေး (3D)',
            'ဘောင်ချာအမှတ်': v.voucherNo || v.id,
            'ရက်စွဲ/အချိန်': v.createdAt ? new Date(v.createdAt).toLocaleString('en-GB') : '-',
            'ဝယ်သူအမည်': v.customerName || 'အထွေထွေ',
            'ဖုန်းနံပါတ်': v.customerPhone || '-',
            'ထိုးဂဏန်းများ': itemsStr,
            'မူလထိုးကြေး (ကျပ်)': v.subtotal ?? v.items?.reduce((s, it) => s + (it.amount || 0), 0) ?? 0,
            'အောက်လက်ကော်မရှင် (ကျပ်)': v.discountAmount || 0,
            'အမှန်ပေးငွေ (ကျပ်)': v.netPayable || 0,
            'ငွေရှင်းပြီးမှု': v.isPaid ? 'ရှင်းပြီး' : 'ကြွေးကျန်',
            'ပေါက်မဲ': v.items?.some(it => it.isWon) ? 'ပေါက်မဲရှိ' : '-'
          });
        });
    }

    // Football Slips
    if (statementMode === 'all' || statementMode === 'football') {
      football.slips
        .filter(s => {
          const d = s.roundDate || (s.createdAt || '').slice(0, 10);
          return d >= stmtStartDate && d <= stmtEndDate;
        })
        .forEach(s => {
          const itemsStr = s.selections?.map(sel => `${sel.matchSummary || sel.matchId} (${sel.choiceLabel})`).join(' | ') || '-';
          rows.push({
            'စဉ်': idx++,
            'လုပ်ငန်း': 'ပစ်တိုင်းထောင် (ဘောလုံး)',
            'ဘောင်ချာအမှတ်': s.slipNo || s.id,
            'ရက်စွဲ/အချိန်': s.createdAt ? new Date(s.createdAt).toLocaleString('en-GB') : '-',
            'ဝယ်သူအမည်': s.customerName || 'အထွေထွေ',
            'ဖုန်းနံပါတ်': s.customerPhone || '-',
            'ထိုးဂဏန်းများ': itemsStr,
            'မူလထိုးကြေး (ကျပ်)': s.stakeAmount || 0,
            'အောက်လက်ကော်မရှင် (ကျပ်)': s.discountAmount || 0,
            'အမှန်ပေးငွေ (ကျပ်)': s.netPayable || 0,
            'ငွေရှင်းပြီးမှု': s.status === 'settled' ? 'ရှင်းပြီး' : 'ဖွင့်လှစ်ဆဲ',
            'ပေါက်မဲ': s.outcome === 'won' || s.outcome === 'half_won' ? 'ပေါက်မဲရှိ' : '-'
          });
        });
    }

    if (rows.length === 0) {
      alert('ရွေးချယ်ထားသော ကာလအတွင်း ဘောင်ချာမှတ်တမ်း မရှိပါ');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ဘောင်ချာများ');
    XLSX.writeFile(wb, `ဘောင်ချာမှတ်တမ်းများ_${statementMode}_${stmtStartDate}_${stmtEndDate}.xlsx`);
  };

  // Tab 5 Period-based Voucher Archive State
  const [archivePeriod, setArchivePeriod] = useState<'week' | 'two_weeks' | 'month' | 'three_months' | 'custom' | 'all'>('month');
  const [archiveStart, setArchiveStart] = useState(getDaysAgo(29));
  const [archiveEnd, setArchiveEnd] = useState(todayStr);

  const { archiveStartDate, archiveEndDate, archiveLabel } = React.useMemo(() => {
    switch (archivePeriod) {
      case 'week':
        return { archiveStartDate: getDaysAgo(6), archiveEndDate: todayStr, archiveLabel: '၁ ပတ်စာ (၇ ရက်)' };
      case 'two_weeks':
        return { archiveStartDate: getDaysAgo(13), archiveEndDate: todayStr, archiveLabel: '၂ ပတ်စာ (၁၄ ရက်)' };
      case 'month':
        return { archiveStartDate: getDaysAgo(29), archiveEndDate: todayStr, archiveLabel: '၁ လစာ (၃၀ ရက်)' };
      case 'three_months':
        return { archiveStartDate: getDaysAgo(89), archiveEndDate: todayStr, archiveLabel: '၃ လစာ (၉၀ ရက်)' };
      case 'custom':
        return { archiveStartDate: archiveStart || getDaysAgo(29), archiveEndDate: archiveEnd || todayStr, archiveLabel: `စိတ်ကြိုက်ရက် (${archiveStart} မှ ${archiveEnd})` };
      case 'all':
      default:
        return { archiveStartDate: '2020-01-01', archiveEndDate: '2099-12-31', archiveLabel: 'ကာလအားလုံး (All Vouchers)' };
    }
  }, [archivePeriod, archiveStart, archiveEnd, todayStr]);

  const archive2DVouchers = React.useMemo(() => {
    return lottery2D.vouchers.filter(v => {
      const d = (v.createdAt || '').slice(0, 10);
      return d >= archiveStartDate && d <= archiveEndDate;
    });
  }, [lottery2D.vouchers, archiveStartDate, archiveEndDate]);

  const archive3DVouchers = React.useMemo(() => {
    return lottery3D.vouchers.filter(v => {
      const d = (v.createdAt || '').slice(0, 10);
      return d >= archiveStartDate && d <= archiveEndDate;
    });
  }, [lottery3D.vouchers, archiveStartDate, archiveEndDate]);

  const archiveFootballSlips = React.useMemo(() => {
    return football.slips.filter(s => {
      const d = s.roundDate || (s.createdAt || '').slice(0, 10);
      return d >= archiveStartDate && d <= archiveEndDate;
    });
  }, [football.slips, archiveStartDate, archiveEndDate]);

  const archiveTotalCount = archive2DVouchers.length + archive3DVouchers.length + archiveFootballSlips.length;

  const handleExportArchiveExcel = () => {
    if (archiveTotalCount === 0) {
      setBackupMsg({ type: 'error', text: 'ရွေးချယ်ထားသော ကာလအတွင်း ဘောင်ချာမှတ်တမ်း မရှိပါ' });
      return;
    }

    const rows: any[] = [];
    let idx = 1;

    // 2D
    archive2DVouchers.forEach(v => {
      const itemsStr = v.items?.map(it => `${it.number}=${it.amount}`).join(', ') || '-';
      rows.push({
        'စဉ်': idx++,
        'လုပ်ငန်း': 'ဇီးကွက် (2D)',
        'ဘောင်ချာအမှတ်': v.voucherNo || v.id,
        'ရက်စွဲ/အချိန်': v.createdAt ? new Date(v.createdAt).toLocaleString('en-GB') : '-',
        'ဝယ်သူအမည်': v.customerName || 'အထွေထွေ',
        'ဖုန်းနံပါတ်': v.customerPhone || '-',
        'ထိုးဂဏန်းများ': itemsStr,
        'မူလထိုးကြေး (ကျပ်)': v.subtotal ?? v.items?.reduce((s, it) => s + (it.amount || 0), 0) ?? 0,
        'အောက်လက်ကော်မရှင် (ကျပ်)': v.discountAmount || 0,
        'အမှန်ပေးငွေ (ကျပ်)': v.netPayable || 0,
        'ငွေရှင်းပြီးမှု': v.isPaid ? 'ရှင်းပြီး' : 'ကြွေးကျန်',
        'ပေါက်မဲ': v.items?.some(it => it.isWon) ? 'ပေါက်မဲရှိ' : '-'
      });
    });

    // 3D
    archive3DVouchers.forEach(v => {
      const itemsStr = v.items?.map(it => `${it.number}=${it.amount}${it.betType === 'rumble' ? 'R' : ''}`).join(', ') || '-';
      rows.push({
        'စဉ်': idx++,
        'လုပ်ငန်း': 'အိုးစည်လေး (3D)',
        'ဘောင်ချာအမှတ်': v.voucherNo || v.id,
        'ရက်စွဲ/အချိန်': v.createdAt ? new Date(v.createdAt).toLocaleString('en-GB') : '-',
        'ဝယ်သူအမည်': v.customerName || 'အထွေထွေ',
        'ဖုန်းနံပါတ်': v.customerPhone || '-',
        'ထိုးဂဏန်းများ': itemsStr,
        'မူလထိုးကြေး (ကျပ်)': v.subtotal ?? v.items?.reduce((s, it) => s + (it.amount || 0), 0) ?? 0,
        'အောက်လက်ကော်မရှင် (ကျပ်)': v.discountAmount || 0,
        'အမှန်ပေးငွေ (ကျပ်)': v.netPayable || 0,
        'ငွေရှင်းပြီးမှု': v.isPaid ? 'ရှင်းပြီး' : 'ကြွေးကျန်',
        'ပေါက်မဲ': v.items?.some(it => it.isWon) ? 'ပေါက်မဲရှိ' : '-'
      });
    });

    // Football
    archiveFootballSlips.forEach(s => {
      const itemsStr = s.selections?.map(sel => `${sel.matchSummary || sel.matchId} (${sel.choiceLabel})`).join(' | ') || '-';
      rows.push({
        'စဉ်': idx++,
        'လုပ်ငန်း': 'ပစ်တိုင်းထောင် (ဘောလုံး)',
        'ဘောင်ချာအမှတ်': s.slipNo || s.id,
        'ရက်စွဲ/အချိန်': s.createdAt ? new Date(s.createdAt).toLocaleString('en-GB') : '-',
        'ဝယ်သူအမည်': s.customerName || 'အထွေထွေ',
        'ဖုန်းနံပါတ်': s.customerPhone || '-',
        'ထိုးဂဏန်းများ': itemsStr,
        'မူလထိုးကြေး (ကျပ်)': s.stakeAmount || 0,
        'အောက်လက်ကော်မရှင် (ကျပ်)': s.discountAmount || 0,
        'အမှန်ပေးငွေ (ကျပ်)': s.netPayable || 0,
        'ငွေရှင်းပြီးမှု': s.status === 'settled' ? 'ရှင်းပြီး' : 'ဖွင့်လှစ်ဆဲ',
        'ပေါက်မဲ': s.outcome === 'won' || s.outcome === 'half_won' ? 'ပေါက်မဲရှိ' : '-'
      });
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ဘောင်ချာများ');
    const filename = `ဘောင်ချာမှတ်တမ်း_${archiveLabel.replace(/[/\\?%*:|"<>]/g, '_')}_${todayStr}.xlsx`;
    XLSX.writeFile(wb, filename);
    setBackupMsg({ type: 'success', text: `"${filename}" အား ဒေါင်းလုဒ်သိမ်းဆည်းပြီးပါပြီ` });
    setTimeout(() => setBackupMsg(null), 4000);
  };

  const handleExportArchiveRhmg = async () => {
    if (archiveTotalCount === 0) {
      setBackupMsg({ type: 'error', text: 'ရွေးချယ်ထားသော ကာလအတွင်း ဘောင်ချာမှတ်တမ်း မရှိပါ' });
      return;
    }
    const pin = getStoredOwnerPin();
    const encryptedContent = exportPeriodVouchersBackup(
      archive3DVouchers,
      archive2DVouchers,
      archiveFootballSlips,
      archiveLabel,
      pin
    );
    const appName = name3D || name2D || nameFB || 'ရွှေမင်္ဂလာ';
    const filename = `${appName}_ဘောင်ချာ_${archiveLabel.replace(/[/\\?%*:|"<>]/g, '_')}_${todayStr}.rhmg`;
    const res = await saveFileWithCustomLocation(encryptedContent, filename, 'text/plain;charset=utf-8');
    if (res.success) {
      setBackupMsg({ type: 'success', text: res.message });
    } else {
      setBackupMsg({ type: 'error', text: res.message });
    }
    setTimeout(() => setBackupMsg(null), 4000);
  };

  // Enabled Modes State
  const [localModes, setLocalModes] = useState<EnabledModes>(enabledModes);

  // Settings Tabs List for Swiping
  const settingsTabList: ('3d' | '2d' | 'football' | 'general' | 'backup' | 'statements' | 'excel')[] = [
    ...(localModes['3d'] ? ['3d' as const] : []),
    ...(localModes['2d'] ? ['2d' as const] : []),
    ...(localModes['football'] ? ['football' as const] : []),
    'general',
    'backup',
    'statements',
    'excel'
  ];

  const handleSettingsSwipeLeft = () => {
    const idx = settingsTabList.indexOf(activeTab);
    if (idx !== -1 && idx < settingsTabList.length - 1) {
      setActiveTab(settingsTabList[idx + 1]);
    }
  };

  const handleSettingsSwipeRight = () => {
    const idx = settingsTabList.indexOf(activeTab);
    if (idx > 0) {
      setActiveTab(settingsTabList[idx - 1]);
    }
  };

  const settingsSwipeHandlers = useSwipeGesture({
    onSwipeLeft: handleSettingsSwipeLeft,
    onSwipeRight: handleSettingsSwipeRight,
    threshold: 45
  });

  // Security PIN Change State
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [pinStatusMsg, setPinStatusMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // 3D Form State
  const [name3D, setName3D] = useState(lottery3D.settings.appName || 'ရွှေမင်္ဂလာ');
  const [shop3D, setShop3D] = useState(lottery3D.settings.shopName || '');
  const [phone3D, setPhone3D] = useState(lottery3D.settings.shopPhone || '');
  const [masterAgentName3D, setMasterAgentName3D] = useState(lottery3D.settings.defaultMasterAgentName || 'ကိုစိုးနိုင် (ဒိုင်ချုပ်ကြီး)');
  const [masterAgentPhone3D, setMasterAgentPhone3D] = useState(lottery3D.settings.defaultMasterAgentPhone || '09-970001111');
  const [mult3D, setMult3D] = useState(String(lottery3D.settings.defaultMultiplier ?? ''));
  const [todd3D, setTodd3D] = useState(String(lottery3D.settings.defaultToddMultiplier ?? ''));
  const [comm3D, setComm3D] = useState(String(lottery3D.settings.defaultCommissionRate ?? ''));
  const [disc3D, setDisc3D] = useState(String(lottery3D.settings.defaultCustomerDiscount ?? ''));
  const [globalLimit3D, setGlobalLimit3D] = useState(String(lottery3D.settings.globalStockLimit ?? ''));
  const [alertPct3D, setAlertPct3D] = useState(String(lottery3D.settings.lowStockAlertPercentage ?? ''));
  const [footer3D, setFooter3D] = useState(lottery3D.settings.voucherFooterMessage || '');

  // 3D Single Number Limit State
  const [numLimit3DInput, setNumLimit3DInput] = useState('');
  const [amtLimit3DInput, setAmtLimit3DInput] = useState('50000');
  const [isRumbleLimit3D, setIsRumbleLimit3D] = useState(false);
  const [searchLimit3D, setSearchLimit3D] = useState('');

  // 3D Blocked Numbers State
  const [blocked3DInput, setBlocked3DInput] = useState('');
  const [isRumbleBlocked3D, setIsRumbleBlocked3D] = useState(false);
  const [searchBlocked3D, setSearchBlocked3D] = useState('');

  // 2D Form State
  const [name2D, setName2D] = useState(lottery2D.settings.appName || 'ရွှေမင်္ဂလာ');
  const [shop2D, setShop2D] = useState(lottery2D.settings.shopName || '');
  const [phone2D, setPhone2D] = useState(lottery2D.settings.shopPhone || '');
  const [masterAgentName2D, setMasterAgentName2D] = useState(lottery2D.settings.defaultMasterAgentName || 'ကိုစိုးနိုင် (ဒိုင်ချုပ်ကြီး)');
  const [masterAgentPhone2D, setMasterAgentPhone2D] = useState(lottery2D.settings.defaultMasterAgentPhone || '09-970001111');
  const [mult2D, setMult2D] = useState(String(lottery2D.settings.defaultMultiplier ?? ''));
  const [comm2D, setComm2D] = useState(String(lottery2D.settings.defaultCommissionRate ?? ''));
  const [disc2D, setDisc2D] = useState(String(lottery2D.settings.defaultCustomerDiscount || 0));
  const [globalLimit2D, setGlobalLimit2D] = useState(String(lottery2D.settings.globalStockLimit || 200000));
  const [footer2D, setFooter2D] = useState(lottery2D.settings.voucherFooterMessage || '');
  const [actionButtons2D, setActionButtons2D] = useState<TwoDQuickActionButtonsConfig>(() => ({
    ...DEFAULT_2D_ACTION_BUTTONS,
    ...(lottery2D.settings.quickActionButtons || {})
  }));

  // 2D Single Number Limit State
  const [numLimit2DInput, setNumLimit2DInput] = useState('');
  const [amtLimit2DInput, setAmtLimit2DInput] = useState('50000');
  const [searchLimit2D, setSearchLimit2D] = useState('');

  // 2D Blocked Numbers State
  const [blocked2DInput, setBlocked2DInput] = useState('');
  const [searchBlocked2D, setSearchBlocked2D] = useState('');

  // Football Form State
  const [nameFB, setNameFB] = useState(football.settings.appName || 'ရွှေမင်္ဂလာ');
  const [shopFB, setShopFB] = useState(football.settings.shopName || '');
  const [phoneFB, setPhoneFB] = useState(football.settings.shopPhone || '');
  const [commFB, setCommFB] = useState(String(football.settings.defaultCommissionRate ?? ''));
  const [discFB, setDiscFB] = useState(String(football.settings.defaultCustomerDiscount || 0));
  const [maxPayoutFB, setMaxPayoutFB] = useState(String(football.settings.maxPayoutPerTicket || 15000000));
  const [footerFB, setFooterFB] = useState(football.settings.slipFooterMessage || '');

  // Global Currency
  const [currency, setCurrency] = useState(lottery3D.settings.currency || 'Ks');

  if (!isOpen) return null;

  // Save General Settings
  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Save 3D
    lottery3D.updateSettings({
      appName: name3D.trim() || 'ရွှေမင်္ဂလာ',
      shopName: shop3D.trim(),
      shopPhone: phone3D.trim(),
      defaultMasterAgentName: masterAgentName3D.trim() || undefined,
      defaultMasterAgentPhone: masterAgentPhone3D.trim() || undefined,
      currency,
      defaultMultiplier: !isNaN(parseInt(mult3D, 10)) ? parseInt(mult3D, 10) : lottery3D.settings.defaultMultiplier,
      defaultToddMultiplier: !isNaN(parseInt(todd3D, 10)) ? parseInt(todd3D, 10) : lottery3D.settings.defaultToddMultiplier,
      defaultCommissionRate: !isNaN(parseInt(comm3D, 10)) ? parseInt(comm3D, 10) : lottery3D.settings.defaultCommissionRate,
      defaultCustomerDiscount: !isNaN(parseInt(disc3D, 10)) ? parseInt(disc3D, 10) : lottery3D.settings.defaultCustomerDiscount,
      globalStockLimit: !isNaN(parseInt(globalLimit3D, 10)) ? parseInt(globalLimit3D, 10) : lottery3D.settings.globalStockLimit,
      lowStockAlertPercentage: !isNaN(parseInt(alertPct3D, 10)) ? parseInt(alertPct3D, 10) : lottery3D.settings.lowStockAlertPercentage,
      voucherFooterMessage: footer3D.trim()
    });

    // 2. Save 2D
    lottery2D.updateSettings({
      appName: name2D.trim() || 'ရွှေမင်္ဂလာ',
      shopName: shop2D.trim(),
      shopPhone: phone2D.trim(),
      defaultMasterAgentName: masterAgentName2D.trim() || undefined,
      defaultMasterAgentPhone: masterAgentPhone2D.trim() || undefined,
      currency,
      defaultMultiplier: !isNaN(parseFloat(mult2D)) ? parseFloat(mult2D) : lottery2D.settings.defaultMultiplier,
      defaultCommissionRate: !isNaN(parseFloat(comm2D)) ? parseFloat(comm2D) : lottery2D.settings.defaultCommissionRate,
      defaultCustomerDiscount: !isNaN(parseFloat(disc2D)) ? parseFloat(disc2D) : lottery2D.settings.defaultCustomerDiscount,
      globalStockLimit: !isNaN(parseFloat(globalLimit2D)) ? parseFloat(globalLimit2D) : 200000,
      voucherFooterMessage: footer2D.trim(),
      quickActionButtons: actionButtons2D
    });

    // 3. Save Football
    football.updateSettings({
      appName: nameFB.trim() || 'ရွှေမင်္ဂလာ',
      shopName: shopFB.trim(),
      shopPhone: phoneFB.trim(),
      currency,
      defaultCommissionRate: !isNaN(parseFloat(commFB)) ? parseFloat(commFB) : football.settings.defaultCommissionRate,
      defaultCustomerDiscount: !isNaN(parseFloat(discFB)) ? parseFloat(discFB) : football.settings.defaultCustomerDiscount,
      maxPayoutPerTicket: !isNaN(parseFloat(maxPayoutFB)) ? parseFloat(maxPayoutFB) : 15000000,
      slipFooterMessage: footerFB.trim()
    });

    // 4. Save Enabled Modes
    saveEnabledModes(localModes);
    onUpdateEnabledModes(localModes);

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  // Change Owner Password
  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinStatusMsg(null);

    if (!verifyOwnerPin(oldPin)) {
      setPinStatusMsg({ type: 'error', text: 'လက်ရှိ အသုံးပြုနေသော Password မှားယွင်းနေပါသည်' });
      return;
    }

    if (newPin.trim().length < 4) {
      setPinStatusMsg({ type: 'error', text: 'Password အသစ်သည် အနည်းဆုံး ၄ လုံး (စာလုံး သို့မဟုတ် ဂဏန်း) ဖြစ်ရပါမည်' });
      return;
    }

    if (newPin.trim() !== confirmNewPin.trim()) {
      setPinStatusMsg({ type: 'error', text: 'Password အသစ် နှစ်ကြိမ် ရိုက်ထည့်မှု တူညီခြင်း မရှိပါ' });
      return;
    }

    const saved = saveOwnerPin(newPin.trim());
    if (saved) {
      setPinStatusMsg({ type: 'success', text: 'ဆက်တင်ဝင်ရောက်ခွင့် သီးသန့် Password အသစ်အား အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ' });
      setOldPin('');
      setNewPin('');
      setConfirmNewPin('');
    } else {
      setPinStatusMsg({ type: 'error', text: 'Password သိမ်းဆည်းရာတွင် အမှားအယွင်း ရှိနေပါသည်' });
    }
  };

  // 3D Custom Limit Handlers
  const handleAdd3DLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numLimit3DInput.trim()) return;
    const lmt = parseInt(amtLimit3DInput, 10);
    if (isNaN(lmt) || lmt <= 0) return;

    const tokens = numLimit3DInput.trim().split(/[\s,]+/);
    const valid: string[] = [];
    tokens.forEach(tok => {
      const clean = tok.replace(/\D/g, '');
      if (clean.length === 3) {
        if (isRumbleLimit3D) {
          valid.push(...getPermutations(clean));
        } else {
          valid.push(clean);
        }
      }
    });

    if (valid.length > 0) {
      lottery3D.setBatchLimits(Array.from(new Set(valid)), lmt);
      setNumLimit3DInput('');
      setIsRumbleLimit3D(false);
    }
  };

  // 3D Blocked Numbers Handlers
  const handleAdd3DBlocked = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blocked3DInput.trim()) return;
    const tokens = blocked3DInput.trim().split(/[\s,]+/);
    const valid: string[] = [];
    tokens.forEach(tok => {
      const clean = tok.replace(/\D/g, '');
      if (clean.length === 3) {
        if (isRumbleBlocked3D) {
          valid.push(...getPermutations(clean));
        } else {
          valid.push(clean);
        }
      }
    });

    if (valid.length > 0) {
      lottery3D.setBatchBlocked(Array.from(new Set(valid)), true);
      setBlocked3DInput('');
      setIsRumbleBlocked3D(false);
    }
  };

  // 2D Custom Limit Handlers
  const handleAdd2DLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!numLimit2DInput.trim()) return;
    const lmt = parseInt(amtLimit2DInput, 10);
    if (isNaN(lmt) || lmt <= 0) return;

    const tokens = numLimit2DInput.trim().split(/[\s,]+/);
    const valid: string[] = [];
    tokens.forEach(tok => {
      const clean = tok.replace(/\D/g, '');
      if (clean.length === 2) {
        valid.push(clean);
      }
    });

    if (valid.length > 0) {
      lottery2D.setBatchLimits(Array.from(new Set(valid)), lmt);
      setNumLimit2DInput('');
    }
  };

  // 2D Blocked Numbers Handlers
  const handleAdd2DBlocked = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blocked2DInput.trim()) return;
    const tokens = blocked2DInput.trim().split(/[\s,]+/);
    const valid: string[] = [];
    tokens.forEach(tok => {
      const clean = tok.replace(/\D/g, '');
      if (clean.length === 2) {
        valid.push(clean);
      }
    });

    if (valid.length > 0) {
      lottery2D.setBatchBlocked(Array.from(new Set(valid)), true);
      setBlocked2DInput('');
    }
  };

  // Backup Export Handlers
  const handleExportBackup = async () => {
    const pin = getStoredOwnerPin();
    const armored = exportSecureMasterBackup(pin);
    const appName = name3D || name2D || nameFB || 'ရွှေမင်္ဂလာ';
    const filename = getBackupFileName(appName, 'rhmg');
    const res = await saveFileWithCustomLocation(armored, filename, 'text/plain;charset=utf-8');
    if (res.success) {
      setBackupMsg({ type: 'success', text: res.message });
    } else {
      setBackupMsg({ type: 'error', text: res.message });
    }
    setTimeout(() => setBackupMsg(null), 4000);
  };

  // Backup File Restore Handler
  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const currentPin = getStoredOwnerPin();
        const result = restoreSecureMasterBackup(content, currentPin);
        if (result.success) {
          setBackupMsg({ type: 'success', text: `${result.message}။ အက်ပ်အား Update ပြုလုပ်ရန် ခေတ္တစောင့်ပါ...` });
          setTimeout(() => window.location.reload(), 1500);
        } else {
          setBackupMsg({ type: 'error', text: result.message || 'ဖိုင်ဖတ်ရှုမှု မအောင်မြင်ပါ' });
        }
      } catch {
        setBackupMsg({ type: 'error', text: 'ဖိုင်ဖတ်ရှုရာတွင် အမှားအယွင်း ဖြစ်ပေါ်ပါသည်' });
      }
    };
    reader.readAsText(file);
    if (backupFileInputRef.current) backupFileInputRef.current.value = '';
  };

  // Filtered Lists for UI
  const filteredLimits3D = Object.entries(lottery3D.limits).filter(([num]) =>
    !searchLimit3D || num.includes(searchLimit3D)
  );
  const filteredBlocked3D = Object.keys(lottery3D.blockedNumbers).filter(
    (num) => lottery3D.blockedNumbers[num] && (!searchBlocked3D || num.includes(searchBlocked3D))
  );

  const filteredLimits2D = Object.entries(lottery2D.limits).filter(([num]) =>
    !searchLimit2D || num.includes(searchLimit2D)
  );
  const filteredBlocked2D = Object.keys(lottery2D.blockedNumbers).filter(
    (num) => lottery2D.blockedNumbers[num] && (!searchBlocked2D || num.includes(searchBlocked2D))
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col justify-between overflow-hidden">
        
        {/* Header - Compact */}
        <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center font-bold">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white leading-tight">
                ဆက်တင်နှင့် စာရင်းစည်းမျဉ်းများ စီမံခန့်ခွဲခြင်း
              </h3>
              <p className="text-[10px] text-slate-400">
                ကော်မရှင်၊ လျော်ကြေးအဆ၊ ဒိုင်ကာဂဏန်းများနှင့် Limit သတ်မှတ်ချက်များ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Tabs Navigation Bar - Compact Horizontal Scroll */}
        <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
          {localModes['3d'] && (
            <button
              type="button"
              onClick={() => setActiveTab('3d')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === '3d'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-indigo-300"></span>
              <span>အိုးစည်လေး</span>
            </button>
          )}

          {localModes['2d'] && (
            <button
              type="button"
              onClick={() => setActiveTab('2d')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === '2d'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-teal-300"></span>
              <span>ဇီးကွက်</span>
            </button>
          )}

          {localModes['football'] && (
            <button
              type="button"
              onClick={() => setActiveTab('football')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'football'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-300"></span>
              <span>ပစ်တိုင်းထောင်</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'general'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>လုံခြုံရေး PIN & လိုင်းများ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'backup'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-teal-400" />
            <span>ဖိုင်သိမ်းဆည်းမှု</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('statements')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'statements'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>စားရင်းရှင်းတမ်း</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('excel')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'excel'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-sky-400" />
            <span>Excel ထုတ်ရန်</span>
          </button>
        </div>

        {/* Modal Body - Scrollable Content with Mobile Swipe Gestures */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 text-xs" {...settingsSwipeHandlers}>
          
          {/* ==================================================== */}
          {/* TAB 1: 3D (အိုးစည်လေး) SETTINGS & LIMITS */}
          {/* ==================================================== */}
          {activeTab === '3d' && (
            <div className="space-y-3">
              {/* 3D Subtabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSubTab3D('rates')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                    subTab3D === 'rates' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ၁။ ကော်မရှင် & ပေါက်ဆ
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab3D('limits')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                    subTab3D === 'limits' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ၂။ ဂဏန်းတစ်လုံးချင်း Limit ({Object.keys(lottery3D.limits).length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab3D('blocked')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                    subTab3D === 'blocked' ? 'bg-white text-indigo-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ၃။ ဒိုင်ကာဂဏန်းများ ({filteredBlocked3D.length})
                </button>
              </div>

              {/* Subtab 1: Rates & Info */}
              {subTab3D === 'rates' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        ဆိုင်အမည်:
                      </label>
                      <input
                        type="text"
                        value={shop3D}
                        onChange={(e) => setShop3D(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="ရွှေမင်္ဂလာ (အိုးစည်လေး)"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        ဖုန်းနံပါတ်:
                      </label>
                      <input
                        type="text"
                        value={phone3D}
                        onChange={(e) => setPhone3D(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="09-xxxxxxx"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  {/* 3D Multipliers */}
                  <div className="grid grid-cols-2 gap-2 bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100">
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                        ဒဲ့ ပေါက်ဆ (အဆ):
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={mult3D}
                        onChange={(e) => setMult3D(e.target.value)}
                        onFocus={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        onClick={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        className="w-full bg-white border border-indigo-200 rounded-lg p-2 text-xs font-bold text-indigo-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                        ပတ်လည် (Todd) ပေါက်ဆ:
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={todd3D}
                        onChange={(e) => setTodd3D(e.target.value)}
                        onFocus={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        onClick={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        className="w-full bg-white border border-indigo-200 rounded-lg p-2 text-xs font-bold text-indigo-900 text-center"
                      />
                    </div>
                  </div>

                  {/* 3D Customizable Commissions: Lower (Agent / Customer) vs Upper (Master Bookie) */}
                  <div className="bg-gradient-to-r from-amber-50/70 to-purple-50/70 p-3 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-wide block">
                      ၃D ကော်မရှင်ခ သတ်မှတ်ချက်များ (အောက်လက် / အထက်)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* 1. အောက်လက်ကော်မရှင် (ကိုယ်က ပေးရမှာ) */}
                      <div className="bg-white p-2.5 rounded-xl border border-amber-200 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-amber-950 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                            အောက်လက်ကော်မရှင် (%):
                          </label>
                          <span className="text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                            ကိုယ်ကပေးရမှာ
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          ဖောက်သည်များ / အောက်လက်များအား နုတ်ပေးရမည့် ကော်မရှင် %
                        </p>
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={disc3D}
                            onChange={(e) => setDisc3D(e.target.value)}
                            onFocus={(e) => {
                              const target = e.currentTarget;
                              target.select();
                              setTimeout(() => target.select(), 20);
                            }}
                            onClick={(e) => {
                              const target = e.currentTarget;
                              target.select();
                              setTimeout(() => target.select(), 20);
                            }}
                            className="flex-1 bg-amber-50/30 border border-amber-300 focus:border-amber-500 rounded-lg p-1.5 text-xs font-black text-amber-950 text-center font-mono"
                          />
                          <span className="text-xs font-bold text-amber-900">%</span>
                        </div>
                      </div>

                      {/* 2. အထက်ကော်မရှင် (ကိုယ်ရမှာ) */}
                      <div className="bg-white p-2.5 rounded-xl border border-purple-200 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-purple-950 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
                            အထက်ကော်မရှင် (%):
                          </label>
                          <span className="text-[9px] bg-purple-100 text-purple-900 px-1.5 py-0.2 rounded font-bold">
                            ကိုယ်ရမှာ
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          ဒိုင်ကြီးထံ အထက်လွှဲတင်သည့်အခါ ဒိုင်ကြီးဆီမှ ကိုယ်ရမည့် %
                        </p>
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={comm3D}
                            onChange={(e) => setComm3D(e.target.value)}
                            onFocus={(e) => {
                              const target = e.currentTarget;
                              target.select();
                              setTimeout(() => target.select(), 20);
                            }}
                            onClick={(e) => {
                              const target = e.currentTarget;
                              target.select();
                              setTimeout(() => target.select(), 20);
                            }}
                            className="flex-1 bg-purple-50/30 border border-purple-300 focus:border-purple-500 rounded-lg p-1.5 text-xs font-black text-purple-950 text-center font-mono"
                          />
                          <span className="text-xs font-bold text-purple-900">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3D Master Agent Profile */}
                  <div className="bg-purple-50/50 p-2.5 rounded-xl border border-purple-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-purple-950 mb-1">
                        အထက်ဒိုင်ကြီး အမည် (Master Bookie Name):
                      </label>
                      <input
                        type="text"
                        value={masterAgentName3D}
                        onChange={(e) => setMasterAgentName3D(e.target.value)}
                        placeholder="ဒိုင်ကြီး အမည်"
                        className="w-full bg-white border border-purple-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-purple-950 mb-1">
                        ဒိုင်ကြီး ဖုန်းနံပါတ်:
                      </label>
                      <input
                        type="text"
                        value={masterAgentPhone3D}
                        onChange={(e) => setMasterAgentPhone3D(e.target.value)}
                        placeholder="09-xxxxxxxxx"
                        className="w-full bg-white border border-purple-300 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        မူလသတ်မှတ်ဘရိတ် (Global Limit):
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={globalLimit3D}
                        onChange={(e) => setGlobalLimit3D(e.target.value)}
                        onFocus={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        onClick={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        သတိပေးအဆင့် (Alert %):
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={alertPct3D}
                        onChange={(e) => setAlertPct3D(e.target.value)}
                        onFocus={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        onClick={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-900 text-center"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 2: Per-number Limit Manager */}
              {subTab3D === 'limits' && (
                <div className="space-y-2.5">
                  <form onSubmit={handleAdd3DLimit} className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-[10px] font-bold text-indigo-950 mb-1">
                        ဂဏန်း:
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={numLimit3DInput}
                        onChange={(e) => setNumLimit3DInput(e.target.value)}
                        onFocus={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        onClick={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        placeholder="123 သို့မဟုတ် 123, 456"
                        className="w-full bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold"
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-[10px] font-bold text-indigo-950 mb-1">
                        Limit ငွေ:
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={amtLimit3DInput}
                        onChange={(e) => setAmtLimit3DInput(e.target.value)}
                        onFocus={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        onClick={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        className="w-full bg-white border border-indigo-200 rounded-lg px-2 py-1 text-xs font-bold text-center"
                      />
                    </div>
                    <label className="flex items-center gap-1 text-[11px] font-bold text-indigo-900 cursor-pointer pb-1">
                      <input
                        type="checkbox"
                        checked={isRumbleLimit3D}
                        onChange={(e) => setIsRumbleLimit3D(e.target.checked)}
                        className="rounded"
                      />
                      <span>ပတ်လည် (R)</span>
                    </label>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs cursor-pointer"
                    >
                      Limit ထည့်မည်
                    </button>
                  </form>

                  {/* List */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">သီးသန့် သတ်မှတ်ထားသော ဂဏန်းများ:</span>
                      <input
                        type="text"
                        value={searchLimit3D}
                        onChange={(e) => setSearchLimit3D(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="ရှာဖွေရန်..."
                        className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[10px]"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                      {filteredLimits3D.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 text-[11px]">သီးသန့် Limit သတ်မှတ်ထားသော ဂဏန်းမရှိသေးပါ</div>
                      ) : (
                        filteredLimits3D.map(([num, lmt]) => (
                          <div key={num} className="px-3 py-1.5 flex items-center justify-between text-xs hover:bg-slate-50">
                            <span className="font-mono font-black text-indigo-950">{num}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-700">{formatAmount(Number(lmt), currency)}</span>
                              <button
                                type="button"
                                onClick={() => lottery3D.removeNumberLimit(num)}
                                className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 3: Blocked Numbers */}
              {subTab3D === 'blocked' && (
                <div className="space-y-2.5">
                  <form onSubmit={handleAdd3DBlocked} className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-100 flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-[10px] font-bold text-rose-950 mb-1">
                        ဒိုင်ကာမည့် ဂဏန်း:
                      </label>
                      <input
                        type="text"
                        value={blocked3DInput}
                        onChange={(e) => setBlocked3DInput(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="123 သို့မဟုတ် 123, 456"
                        className="w-full bg-white border border-rose-200 rounded-lg px-2 py-1 text-xs font-bold"
                      />
                    </div>
                    <label className="flex items-center gap-1 text-[11px] font-bold text-rose-900 cursor-pointer pb-1">
                      <input
                        type="checkbox"
                        checked={isRumbleBlocked3D}
                        onChange={(e) => setIsRumbleBlocked3D(e.target.checked)}
                        className="rounded"
                      />
                      <span>ပတ်လည် (R)</span>
                    </label>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs cursor-pointer"
                    >
                      ဒိုင်ကာ ပိတ်မည်
                    </button>
                  </form>

                  {/* Blocked List */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">ဒိုင်ကာထားသော ဂဏန်းများ:</span>
                      <input
                        type="text"
                        value={searchBlocked3D}
                        onChange={(e) => setSearchBlocked3D(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="ရှာဖွေရန်..."
                        className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[10px]"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 flex flex-wrap gap-1.5 bg-slate-50/50">
                      {filteredBlocked3D.length === 0 ? (
                        <div className="w-full text-center text-slate-400 text-[11px] py-2">ဒိုင်ကာဂဏန်း မရှိသေးပါ</div>
                      ) : (
                        filteredBlocked3D.map((num) => (
                          <span
                            key={num}
                            className="bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md font-mono font-black text-xs flex items-center gap-1"
                          >
                            <span>{num}</span>
                            <button
                              type="button"
                              onClick={() => lottery3D.toggleBlockNumber(num)}
                              className="text-rose-600 hover:text-rose-900 cursor-pointer"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2: 2D (ဇီးကွက်) SETTINGS & LIMITS */}
          {/* ==================================================== */}
          {activeTab === '2d' && (
            <div className="space-y-3">
              {/* 2D Subtabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSubTab2D('rates')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                    subTab2D === 'rates' ? 'bg-white text-teal-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ၁။ ကော်မရှင် & ပေါက်ဆ
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab2D('limits')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                    subTab2D === 'limits' ? 'bg-white text-teal-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ၂။ Limit ({Object.keys(lottery2D.limits).length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab2D('blocked')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                    subTab2D === 'blocked' ? 'bg-white text-teal-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ၃။ ဒိုင်ကာ ({filteredBlocked2D.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab2D('buttons')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                    subTab2D === 'buttons' ? 'bg-white text-teal-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ၄။ အမြန်သွင်းခလုတ်များ
                </button>
              </div>

              {/* 2D Rates */}
              {subTab2D === 'rates' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        ဆိုင်အမည်:
                      </label>
                      <input
                        type="text"
                        value={shop2D}
                        onChange={(e) => setShop2D(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="ရွှေမင်္ဂလာ (ဇီးကွက်)"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        ဖုန်းနံပါတ်:
                      </label>
                      <input
                        type="text"
                        value={phone2D}
                        onChange={(e) => setPhone2D(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="09-xxxxxxx"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  {/* 2D Multiplier */}
                  <div className="bg-teal-50/60 p-2.5 rounded-xl border border-teal-100">
                    <label className="block text-[11px] font-bold text-teal-950 mb-1">
                      ဇီးကွက် (2D) ပေါက်ဆ (အဆ):
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={mult2D}
                      onChange={(e) => setMult2D(e.target.value)}
                      onFocus={(e) => {
                        const target = e.currentTarget;
                        target.select();
                        setTimeout(() => target.select(), 20);
                      }}
                      onClick={(e) => {
                        const target = e.currentTarget;
                        target.select();
                        setTimeout(() => target.select(), 20);
                      }}
                      className="w-full bg-white border border-teal-200 rounded-lg p-2 text-xs font-bold text-teal-900 text-center"
                    />
                  </div>

                  {/* 2D Customizable Commissions: Lower (Agent / Customer) vs Upper (Master Bookie) */}
                  <div className="bg-gradient-to-r from-amber-50/70 to-purple-50/70 p-3 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-wide block">
                      ၂D ကော်မရှင်ခ သတ်မှတ်ချက်များ (အောက်လက် / အထက်)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* 1. အောက်လက်ကော်မရှင် (ကိုယ်က ပေးရမှာ) */}
                      <div className="bg-white p-2.5 rounded-xl border border-amber-200 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-amber-950 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                            အောက်လက်ကော်မရှင် (%):
                          </label>
                          <span className="text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                            ကိုယ်ကပေးရမှာ
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          ဖောက်သည်များ / အောက်လက်များအား နုတ်ပေးရမည့် ကော်မရှင် %
                        </p>
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={disc2D}
                            onChange={(e) => setDisc2D(e.target.value)}
                            onFocus={(e) => {
                              const target = e.currentTarget;
                              target.select();
                              setTimeout(() => target.select(), 20);
                            }}
                            onClick={(e) => {
                              const target = e.currentTarget;
                              target.select();
                              setTimeout(() => target.select(), 20);
                            }}
                            className="flex-1 bg-amber-50/30 border border-amber-300 focus:border-amber-500 rounded-lg p-1.5 text-xs font-black text-amber-950 text-center font-mono"
                          />
                          <span className="text-xs font-bold text-amber-900">%</span>
                        </div>
                      </div>

                      {/* 2. အထက်ကော်မရှင် (ကိုယ်ရမှာ) */}
                      <div className="bg-white p-2.5 rounded-xl border border-purple-200 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-black text-purple-950 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
                            အထက်ကော်မရှင် (%):
                          </label>
                          <span className="text-[9px] bg-purple-100 text-purple-900 px-1.5 py-0.2 rounded font-bold">
                            ကိုယ်ရမှာ
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">
                          ဒိုင်ကြီးထံ အထက်လွှဲတင်သည့်အခါ ဒိုင်ကြီးဆီမှ ကိုယ်ရမည့် %
                        </p>
                        <div className="flex items-center gap-1.5 pt-1">
                          <input
                            type="number"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={comm2D}
                            onChange={(e) => setComm2D(e.target.value)}
                            onFocus={(e) => {
                              const target = e.currentTarget;
                              target.select();
                              setTimeout(() => target.select(), 20);
                            }}
                            onClick={(e) => {
                              const target = e.currentTarget;
                              target.select();
                              setTimeout(() => target.select(), 20);
                            }}
                            className="flex-1 bg-purple-50/30 border border-purple-300 focus:border-purple-500 rounded-lg p-1.5 text-xs font-black text-purple-950 text-center font-mono"
                          />
                          <span className="text-xs font-bold text-purple-900">%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2D Master Agent Profile */}
                  <div className="bg-teal-50/50 p-2.5 rounded-xl border border-teal-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-teal-950 mb-1">
                        အထက်ဒိုင်ကြီး အမည် (Master Bookie Name):
                      </label>
                      <input
                        type="text"
                        value={masterAgentName2D}
                        onChange={(e) => setMasterAgentName2D(e.target.value)}
                        placeholder="ဒိုင်ကြီး အမည်"
                        className="w-full bg-white border border-teal-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-teal-950 mb-1">
                        ဒိုင်ကြီး ဖုန်းနံပါတ်:
                      </label>
                      <input
                        type="text"
                        value={masterAgentPhone2D}
                        onChange={(e) => setMasterAgentPhone2D(e.target.value)}
                        placeholder="09-xxxxxxxxx"
                        className="w-full bg-white border border-teal-300 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      ဇီးကွက် မူလသတ်မှတ်ဘရိတ် (Global Stock Limit):
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={globalLimit2D}
                      onChange={(e) => setGlobalLimit2D(e.target.value)}
                      onFocus={(e) => {
                        const target = e.currentTarget;
                        target.select();
                        setTimeout(() => target.select(), 20);
                      }}
                      onClick={(e) => {
                        const target = e.currentTarget;
                        target.select();
                        setTimeout(() => target.select(), 20);
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>
              )}

              {/* 2D Limits */}
              {subTab2D === 'limits' && (
                <div className="space-y-2.5">
                  <form onSubmit={handleAdd2DLimit} className="bg-teal-50/60 p-2.5 rounded-xl border border-teal-100 flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-[10px] font-bold text-teal-950 mb-1">
                        ဂဏန်း (00 မှ 99):
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={numLimit2DInput}
                        onChange={(e) => setNumLimit2DInput(e.target.value)}
                        onFocus={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        onClick={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        placeholder="05 သို့မဟုတ် 05, 50"
                        className="w-full bg-white border border-teal-200 rounded-lg px-2 py-1 text-xs font-bold"
                      />
                    </div>
                    <div className="w-28">
                      <label className="block text-[10px] font-bold text-teal-950 mb-1">
                        Limit ငွေ:
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={amtLimit2DInput}
                        onChange={(e) => setAmtLimit2DInput(e.target.value)}
                        onFocus={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        onClick={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        className="w-full bg-white border border-teal-200 rounded-lg px-2 py-1 text-xs font-bold text-center"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs cursor-pointer"
                    >
                      Limit ထည့်မည်
                    </button>
                  </form>

                  {/* List */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">သီးသန့် သတ်မှတ်ထားသော ဂဏန်းများ:</span>
                      <input
                        type="text"
                        value={searchLimit2D}
                        onChange={(e) => setSearchLimit2D(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="ရှာဖွေရန်..."
                        className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[10px]"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                      {filteredLimits2D.length === 0 ? (
                        <div className="p-3 text-center text-slate-400 text-[11px]">သီးသန့် Limit မရှိသေးပါ</div>
                      ) : (
                        filteredLimits2D.map(([num, lmt]) => (
                          <div key={num} className="px-3 py-1.5 flex items-center justify-between text-xs hover:bg-slate-50">
                            <span className="font-mono font-black text-teal-950">{num}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-700">{formatAmount(Number(lmt), currency)}</span>
                              <button
                                type="button"
                                onClick={() => lottery2D.removeNumberLimit(num)}
                                className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 2D Blocked */}
              {subTab2D === 'blocked' && (
                <div className="space-y-2.5">
                  <form onSubmit={handleAdd2DBlocked} className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-100 flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-[10px] font-bold text-rose-950 mb-1">
                        ဒိုင်ကာမည့် ဂဏန်း:
                      </label>
                      <input
                        type="text"
                        value={blocked2DInput}
                        onChange={(e) => setBlocked2DInput(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="05 သို့မဟုတ် 05, 50"
                        className="w-full bg-white border border-rose-200 rounded-lg px-2 py-1 text-xs font-bold"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs cursor-pointer"
                    >
                      ဒိုင်ကာ ပိတ်မည်
                    </button>
                  </form>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700">ဒိုင်ကာထားသော ဂဏန်းများ:</span>
                      <input
                        type="text"
                        value={searchBlocked2D}
                        onChange={(e) => setSearchBlocked2D(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder="ရှာဖွေရန်..."
                        className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-[10px]"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 flex flex-wrap gap-1.5 bg-slate-50/50">
                      {filteredBlocked2D.length === 0 ? (
                        <div className="w-full text-center text-slate-400 text-[11px] py-2">ဒိုင်ကာဂဏန်း မရှိသေးပါ</div>
                      ) : (
                        filteredBlocked2D.map((num) => (
                          <span
                            key={num}
                            className="bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-md font-mono font-black text-xs flex items-center gap-1"
                          >
                            <span>{num}</span>
                            <button
                              type="button"
                              onClick={() => lottery2D.toggleBlockNumber(num)}
                              className="text-rose-600 hover:text-rose-900 cursor-pointer"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 2D Quick Action Buttons Configuration */}
              {subTab2D === 'buttons' && (
                <div className="space-y-3">
                  <div className="bg-teal-50/70 border border-teal-200/80 rounded-xl p-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5 pb-2.5 border-b border-teal-200/60">
                      <div>
                        <h4 className="text-xs font-black text-teal-950 flex items-center gap-1.5">
                          <Sliders className="w-4 h-4 text-teal-600" />
                          <span>2D အမြန်စာရင်းသွင်း ခလုတ်များ စီမံခြင်း</span>
                        </h4>
                        <p className="text-[11px] text-teal-800/80 mt-0.5">
                          ဖွင့်ထားသော ခလုတ်များသာ အမြန်စာရင်းသွင်း (Quick Entry) တွင် ပေါ်ပြီး အလုပ်လုပ်ပါမည်။ ပိတ်ထားသော ခလုတ်များသည် မျက်နှာပြင်တွင် မပေါ်ဘဲ နေရာမယူပါ။
                        </p>
                      </div>

                      {/* Quick Bulk Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const allOn: TwoDQuickActionButtonsConfig = {
                              straight: true,
                              rumble: true,
                              break: true,
                              includes: true,
                              head: true,
                              tail: true,
                              doubles: true,
                              power: true,
                              natkhat: true,
                              brothers: true,
                              khway: true,
                              khwayPuu: true,
                              khwayRumble: true,
                              khwayPuuRumble: true
                            };
                            setActionButtons2D(allOn);
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-teal-50 border border-teal-300 text-teal-900 rounded-lg text-[11px] font-bold shadow-2xs cursor-pointer transition-all active:scale-95"
                        >
                          အားလုံးဖွင့်မည်
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const allOff: TwoDQuickActionButtonsConfig = {
                              straight: false,
                              rumble: false,
                              break: false,
                              includes: false,
                              head: false,
                              tail: false,
                              doubles: false,
                              power: false,
                              natkhat: false,
                              brothers: false,
                              khway: false,
                              khwayPuu: false,
                              khwayRumble: false,
                              khwayPuuRumble: false
                            };
                            setActionButtons2D(allOff);
                          }}
                          className="px-2.5 py-1 bg-white hover:bg-rose-50 border border-rose-300 text-rose-800 rounded-lg text-[11px] font-bold shadow-2xs cursor-pointer transition-all active:scale-95"
                        >
                          အားလုံးပိတ်မည်
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionButtons2D({ ...DEFAULT_2D_ACTION_BUTTONS });
                          }}
                          className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-[11px] font-bold shadow-2xs cursor-pointer transition-all active:scale-95"
                        >
                          မူလအတိုင်း
                        </button>
                      </div>
                    </div>

                    {/* Button Grid with Previews and Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto pr-1">
                      {BUTTON_DEFINITIONS_2D.map((btn) => {
                        const isEnabled = actionButtons2D[btn.key];
                        return (
                          <label
                            key={btn.key}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all select-none ${
                              isEnabled
                                ? 'bg-white border-teal-300/80 shadow-2xs'
                                : 'bg-slate-50/70 border-slate-200 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/* Preview Badge of Button */}
                              <div className={btn.previewClass}>
                                {btn.icon && <span className="shrink-0">{btn.icon}</span>}
                                <span>{btn.label}</span>
                              </div>

                              {/* Title and Description */}
                              <div className="min-w-0">
                                <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                                  <span>{btn.nameMyanmar}</span>
                                  <span className="text-[10px] font-mono text-slate-500 font-normal">({btn.nameEnglish})</span>
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {btn.desc}
                                </div>
                              </div>
                            </div>

                            {/* Toggle Switch */}
                            <div className="shrink-0 flex items-center">
                              <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={(e) => {
                                  setActionButtons2D(prev => ({
                                    ...prev,
                                    [btn.key]: e.target.checked
                                  }));
                                }}
                                className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                              />
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 3: FOOTBALL (ပစ်တိုင်းထောင်) SETTINGS */}
          {/* ==================================================== */}
          {activeTab === 'football' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    ဆိုင်အမည်:
                  </label>
                  <input
                    type="text"
                    value={shopFB}
                    onChange={(e) => setShopFB(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="ရွှေမင်္ဂလာ (ပစ်တိုင်းထောင်)"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    ဖုန်းနံပါတ်:
                  </label>
                  <input
                    type="text"
                    value={phoneFB}
                    onChange={(e) => setPhoneFB(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="09-xxxxxxx"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Football Max Payout */}
              <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
                <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                  တစ်စောင် အမြင့်ဆုံး လျော်ကြေးငွေ (Max Payout Per Slip):
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={maxPayoutFB}
                  onChange={(e) => setMaxPayoutFB(e.target.value)}
                  onFocus={(e) => {
                    const target = e.currentTarget;
                    target.select();
                    setTimeout(() => target.select(), 20);
                  }}
                  onClick={(e) => {
                    const target = e.currentTarget;
                    target.select();
                    setTimeout(() => target.select(), 20);
                  }}
                  className="w-full bg-white border border-emerald-200 rounded-lg p-2 text-xs font-bold text-emerald-900 text-center font-mono"
                />
              </div>

              {/* Football Customizable Commissions: Lower (Agent / Customer) vs Upper (Master Bookie) */}
              <div className="bg-gradient-to-r from-amber-50/70 to-purple-50/70 p-3 rounded-2xl border border-slate-200 space-y-2">
                <span className="text-[11px] font-black text-slate-800 uppercase tracking-wide block">
                  ဘောလုံး (ပစ်တိုင်းထောင်) ကော်မရှင်ခ သတ်မှတ်ချက်များ (အောက်လက် / အထက်)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* 1. အောက်လက်ကော်မရှင် (ကိုယ်က ပေးရမှာ) */}
                  <div className="bg-white p-2.5 rounded-xl border border-amber-200 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-amber-950 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                        အောက်လက်ကော်မရှင် (%):
                      </label>
                      <span className="text-[9px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">
                        ကိုယ်ကပေးရမှာ
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      ဖောက်သည်များ / အောက်လက်များအား နုတ်ပေးရမည့် ကော်မရှင် %
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={discFB}
                        onChange={(e) => setDiscFB(e.target.value)}
                        onFocus={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        onClick={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        className="flex-1 bg-amber-50/30 border border-amber-300 focus:border-amber-500 rounded-lg p-1.5 text-xs font-black text-amber-950 text-center font-mono"
                      />
                      <span className="text-xs font-bold text-amber-900">%</span>
                    </div>
                  </div>

                  {/* 2. အထက်ကော်မရှင် (ကိုယ်ရမှာ) */}
                  <div className="bg-white p-2.5 rounded-xl border border-purple-200 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-purple-950 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
                        အထက်ကော်မရှင် (%):
                      </label>
                      <span className="text-[9px] bg-purple-100 text-purple-900 px-1.5 py-0.2 rounded font-bold">
                        ကိုယ်ရမှာ
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      ဒိုင်ကြီးထံ အထက်လွှဲတင်သည့်အခါ ဒိုင်ကြီးဆီမှ ကိုယ်ရမည့် %
                    </p>
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={commFB}
                        onChange={(e) => setCommFB(e.target.value)}
                        onFocus={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        onClick={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        className="flex-1 bg-purple-50/30 border border-purple-300 focus:border-purple-500 rounded-lg p-1.5 text-xs font-black text-purple-950 text-center font-mono"
                      />
                      <span className="text-xs font-bold text-purple-900">%</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  စလစ် အောက်ခြေ မှတ်ချက် (Footer message):
                </label>
                <input
                  type="text"
                  value={footerFB}
                  onChange={(e) => setFooterFB(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="လာဘ်လာဘ ရွှင်လန်းပါစေ။ ကျေးဇူးတင်ပါသည်။"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs text-slate-900"
                />
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 4: GENERAL & SECURITY */}
          {/* ==================================================== */}
          {activeTab === 'general' && (
            <div className="space-y-3">
              {/* Business Modes Master Switch */}
              <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 space-y-2">
                <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-xs">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>လုပ်ငန်းလိုင်းများ မာစတာ စဝစ်ချ် (Enable / Disable):</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                    localModes['3d'] ? 'bg-white border-indigo-500 font-bold text-indigo-950' : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}>
                    <span className="text-xs">အိုးစည်လေး</span>
                    <input
                      type="checkbox"
                      checked={localModes['3d']}
                      onChange={(e) => setLocalModes(prev => ({ ...prev, '3d': e.target.checked }))}
                    />
                  </label>

                  <label className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                    localModes['2d'] ? 'bg-white border-teal-500 font-bold text-teal-950' : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}>
                    <span className="text-xs">ဇီးကွက်</span>
                    <input
                      type="checkbox"
                      checked={localModes['2d']}
                      onChange={(e) => setLocalModes(prev => ({ ...prev, '2d': e.target.checked }))}
                    />
                  </label>

                  <label className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                    localModes['football'] ? 'bg-white border-emerald-500 font-bold text-emerald-950' : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}>
                    <span className="text-xs">ပစ်တိုင်းထောင်</span>
                    <input
                      type="checkbox"
                      checked={localModes['football']}
                      onChange={(e) => setLocalModes(prev => ({ ...prev, 'football': e.target.checked }))}
                    />
                  </label>
                </div>
              </div>

              {/* Currency Selector */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ငွေကြေး သတ်မှတ်ချက် (Currency):
                </label>
                <div className="flex items-center gap-2">
                  {['Ks', 'THB', 'USD'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCurrency(c)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        currency === c ? 'bg-slate-900 text-white shadow-2xs' : 'bg-white border border-slate-200 text-slate-700'
                      }`}
                    >
                      {c === 'Ks' ? 'ကျပ် (MMK)' : c === 'THB' ? 'ဘတ် (THB)' : 'ဒေါ်လာ (USD)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Change Owner Password Form */}
              <form onSubmit={handleChangePin} className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-black block">ဆက်တင်ဝင်ရောက်ခွင့် သီးသန့် Password ပြောင်းလဲသတ်မှတ်ခြင်း</span>
                    <span className="text-[10px] text-slate-400 block">ပေါက်ဆ၊ လျော်ကြေးနှင့် ကော်မရှင်များ မလိုလားအပ်ဘဲ အပြင်မခံရစေရန် သီးသန့် Password ထားရှိပါ</span>
                  </div>
                </div>

                {pinStatusMsg && (
                  <div className={`p-2.5 rounded-xl text-[11px] font-bold ${
                    pinStatusMsg.type === 'error' ? 'bg-rose-900/80 text-rose-200 border border-rose-700' : 'bg-emerald-900/80 text-emerald-200 border border-emerald-700'
                  }`}>
                    {pinStatusMsg.text}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-bold">လက်ရှိ Password:</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={20}
                      value={oldPin}
                      onChange={(e) => setOldPin(e.target.value)}
                      onFocus={(e) => {
                        const target = e.currentTarget;
                        target.select();
                        setTimeout(() => target.select(), 20);
                      }}
                      onClick={(e) => {
                        const target = e.currentTarget;
                        target.select();
                        setTimeout(() => target.select(), 20);
                      }}
                      placeholder="လက်ရှိ Password"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-xs text-center font-mono font-bold text-white outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-bold">Password အသစ်:</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={20}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      onFocus={(e) => {
                        const target = e.currentTarget;
                        target.select();
                        setTimeout(() => target.select(), 20);
                      }}
                      onClick={(e) => {
                        const target = e.currentTarget;
                        target.select();
                        setTimeout(() => target.select(), 20);
                      }}
                      placeholder="အနည်းဆုံး ၄ လုံး"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-xs text-center font-mono font-bold text-white outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-bold">အတည်ပြုပါ:</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={20}
                      value={confirmNewPin}
                      onChange={(e) => setConfirmNewPin(e.target.value)}
                      onFocus={(e) => {
                        const target = e.currentTarget;
                        target.select();
                        setTimeout(() => target.select(), 20);
                      }}
                      onClick={(e) => {
                        const target = e.currentTarget;
                        target.select();
                        setTimeout(() => target.select(), 20);
                      }}
                      placeholder="အတည်ပြုပါ"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-xs text-center font-mono font-bold text-white outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={!oldPin || newPin.trim().length < 4}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    Password အသစ်သိမ်းမည်
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 5: BACKUP & RESTORE */}
          {/* ==================================================== */}
          {activeTab === 'backup' && (
            <div className="space-y-3">
              {backupMsg && (
                <div className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  backupMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{backupMsg.text}</span>
                </div>
              )}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <span className="text-xs font-black text-slate-900 block">၁။ Master Encrypted Backup (.rhmg) ဖိုင်သိမ်းဆည်းရန်</span>
                <p className="text-[11px] text-slate-500">
                  အိုးစည်လေး + ဇီးကွက် + ပစ်တိုင်းထောင် + ဆက်တင် + Viber စာရင်းအားလုံး ပါဝင်ပါသည်။
                </p>
                <button
                  type="button"
                  onClick={handleExportBackup}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-98"
                >
                  <FolderDown className="w-4 h-4" />
                  <span>ဖုန်းထဲတွင် နေရာရွေးပြီး သိမ်းမည် (.rhmg)</span>
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <span className="text-xs font-black text-slate-900 block">၂။ သိမ်းထားသောဖိုင်မှ ဒေတာပြန်သွင်းရန် (Restore)</span>
                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept=".rhmg,.json,.txt"
                  onChange={handleFileRestore}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => backupFileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-98"
                >
                  <Upload className="w-4 h-4" />
                  <span>ဖိုင်ရွေးချယ်ပြီး ပြန်သွင်းမည်</span>
                </button>
              </div>

              {/* 3. Period-based Voucher Retention & Export */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                <div>
                  <span className="text-xs font-black text-slate-900 block">
                    ၃။ ကာလအလိုက် ဘောင်ချာများ စိတ်ကြိုက်ရွေးချယ် သိမ်းဆည်းခြင်း (၁ လစာ / ၁ ပတ်စာ / စိတ်ကြိုက်)
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    လိုချင်သော ရက်စွဲကာလကို ရွေးပြီး ဘောင်ချာမှတ်တမ်းများအား Excel သို့မဟုတ် လုံခြုံသော Backup Archive (.rhmg) ဖိုင်အဖြစ် သီးသန့်ထုတ်ယူသိမ်းဆည်းနိုင်ပါသည်။
                  </p>
                </div>

                {/* Period Selector Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'week', label: '၁ ပတ်စာ (၇ ရက်)' },
                    { id: 'two_weeks', label: '၂ ပတ်စာ (၁၄ ရက်)' },
                    { id: 'month', label: '၁ လစာ (၃၀ ရက်)' },
                    { id: 'three_months', label: '၃ လစာ (၉၀ ရက်)' },
                    { id: 'custom', label: 'စိတ်ကြိုက်ရက်' },
                    { id: 'all', label: 'ကာလအားလုံး' }
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setArchivePeriod(p.id as any)}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        archivePeriod === p.id
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Custom Date Pickers */}
                {archivePeriod === 'custom' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 font-bold">မှ:</span>
                      <input
                        type="date"
                        value={archiveStart}
                        onChange={(e) => setArchiveStart(e.target.value)}
                        className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 font-bold">ထိ:</span>
                      <input
                        type="date"
                        value={archiveEnd}
                        onChange={(e) => setArchiveEnd(e.target.value)}
                        className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>
                )}

                {/* Voucher Count Summary */}
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                    <span className="text-teal-700">၂D: {archive2DVouchers.length} စောင်</span>
                    <span>•</span>
                    <span className="text-indigo-700">၃D: {archive3DVouchers.length} စောင်</span>
                    <span>•</span>
                    <span className="text-emerald-700">ဘောလုံး: {archiveFootballSlips.length} စောင်</span>
                  </div>
                  <span className="font-black text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                    စုစုပေါင်း: {archiveTotalCount} စောင်
                  </span>
                </div>

                {/* Download Actions */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button
                    type="button"
                    onClick={handleExportArchiveExcel}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Excel (.xlsx) ဖြင့် သိမ်းဆည်းမည်</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportArchiveRhmg}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                  >
                    <FolderDown className="w-4 h-4" />
                    <span>ဖုန်းထဲတွင် နေရာရွေးပြီး သိမ်းမည် (.rhmg)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 6: FINANCIAL STATEMENTS (စားရင်းရှင်းတမ်း) */}
          {/* ==================================================== */}
          {activeTab === 'statements' && (
            <div className="space-y-4">
              {/* Master Consolidated 3-Business Statement Header Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 rounded-2xl border border-indigo-900/40 shadow-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-400/30 flex items-center justify-center font-bold shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-black text-white leading-tight flex items-center gap-2 flex-wrap">
                      <span>လုပ်ငန်းသုံးခုလုံး စုစည်းချုပ် စာရင်းရှင်းတမ်း (Master Consolidated)</span>
                      <span className="text-[10px] px-2 py-0.5 bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 rounded-full font-bold">
                        3D + 2D + Football စုစည်းချုပ်
                      </span>
                    </h4>
                    <p className="text-[10px] text-slate-300 mt-0.5">
                      အိုးစည်လေး၊ ဇီးကွက် နှင့် ပစ်တိုင်းထောင် လုပ်ငန်း ၃ ခုလုံး၏ စုစုပေါင်း အရောင်းထိုးကြေး၊ အောက်လက်ကော်မရှင်၊ အမှန်ရောင်းငွေ၊ ပေးလျော်ငွေ နှင့် ဒိုင်ချုပ်အသားတင် အမြတ်/အရှုံး
                    </p>
                  </div>
                </div>
                {onOpenMasterStatement && (
                  <button
                    type="button"
                    onClick={onOpenMasterStatement}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0 whitespace-nowrap active:scale-95"
                    title="လုပ်ငန်းသုံးခုလုံး ပေါင်းချုပ် စာရင်းရှင်းတမ်း အပြည့်အစုံကို ဇယားကြီးဖြင့် ကြည့်မည်"
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-white" />
                    <span className="hidden sm:inline">ဇယားအပြည့် ဖွင့်မည်</span>
                  </button>
                )}
              </div>

              {/* Filter Controls: Period & Mode */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-500 mr-1">ကာလ:</span>
                    {[
                      { id: 'all', label: 'အားလုံး' },
                      { id: 'today', label: 'ဒီနေ့ (၁ ရက်)' },
                      { id: 'two_days', label: '၂ ရက်စာ' },
                      { id: 'three_days', label: '၃ ရက်စာ' },
                      { id: 'five_days', label: '၅ ရက်စာ' },
                      { id: 'week', label: '၁ ပတ်စာ' },
                      { id: 'month', label: '၁ လစာ' },
                      { id: 'custom', label: 'စိတ်ကြိုက်' }
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setStatementPeriod(p.id as any)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          statementPeriod === p.id
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-500 mr-1">လိုင်း:</span>
                    {[
                      { id: 'all', label: '★ လုပ်ငန်း ၃ ခုလုံး ပေါင်းချုပ်' },
                      { id: '3d', label: 'အိုးစည်လေး (3D)' },
                      { id: '2d', label: 'ဇီးကွက် (2D)' },
                      { id: 'football', label: 'ပစ်တိုင်းထောင် (ဘောလုံး)' }
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setStatementMode(m.id as any)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          statementMode === m.id
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {statementPeriod === 'custom' && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 font-bold">မှ:</span>
                      <input
                        type="date"
                        value={stmtCustomStart}
                        onChange={(e) => setStmtCustomStart(e.target.value)}
                        className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500 font-bold">ထိ:</span>
                      <input
                        type="date"
                        value={stmtCustomEnd}
                        onChange={(e) => setStmtCustomEnd(e.target.value)}
                        className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div id="printable-statement" className="space-y-4">
                {/* Print-only Statement Header Banner */}
                <div className="hidden print:block border-b-2 border-slate-900 pb-3 mb-4 text-center">
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                    {lottery3D.settings.shopName || 'ရွှေမင်္ဂလာ'} - စာရင်းရှင်းတမ်း အစီရင်ခံစာ
                  </h2>
                  <p className="text-xs text-slate-600 font-bold mt-1">
                    {statementPeriod === 'today' ? 'ဒီနေ့ စာရင်းရှင်းတမ်း' :
                     statementPeriod === 'five_days' ? '၅ ရက်စာ စာရင်းရှင်းတမ်း' :
                     statementPeriod === 'week' ? '၁ ပတ်စာ စာရင်းရှင်းတမ်း' :
                     statementPeriod === 'month' ? '၁ လစာ စာရင်းရှင်းတမ်း' : 'ရက်ရွေး စာရင်းရှင်းတမ်း'} 
                    {' '}({stmtStartDate} မှ {stmtEndDate} အထိ)
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    အမျိုးအစား: {statementMode === 'all' ? 'လုပ်ငန်းအားလုံးချုပ်' : statementMode === '3d' ? 'အိုးစည်လေး (3D)' : statementMode === '2d' ? 'ဇီးကွက် (2D)' : 'ပစ်တိုင်းထောင် (ဘောလုံး)'}
                  </p>
                </div>

                {/* Summary Stats Overview Cards matching Exact 8-Step Formula */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {/* 1. Gross Turnover */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[9px] font-bold text-slate-500 block mb-0.5 uppercase">၁။ မူလထိုးကြေး</span>
                    <div className="text-sm font-black text-slate-900 font-mono">
                      {formatAmount(stmtGrandTotals.totalTurnover, currency)}
                    </div>
                    <span className="text-[9px] text-slate-400 block font-medium">
                      {stmtGrandTotals.totalVouchers} စောင်
                    </span>
                  </div>

                  {/* 2. Total Forwarded */}
                  <div className="bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-200 shadow-2xs">
                    <span className="text-[9px] font-bold text-indigo-900 block mb-0.5 uppercase">၂။ အထက်တင်ကြေး</span>
                    <div className="text-sm font-black text-indigo-950 font-mono">
                      {formatAmount(stmtGrandTotals.totalForwarded, currency)}
                    </div>
                    <span className="text-[9px] text-indigo-600 block font-medium">
                      ဒိုင်ကြီးဆီ လွှဲငွေ
                    </span>
                  </div>

                  {/* 3. Agent Commission */}
                  <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-200 shadow-2xs">
                    <span className="text-[9px] font-bold text-amber-900 block mb-0.5 uppercase">၃။ အောက်လက်ကော်</span>
                    <div className="text-sm font-black text-amber-900 font-mono">
                      -{formatAmount(stmtGrandTotals.totalAgentCommission, currency)}
                    </div>
                    <span className="text-[9px] text-amber-700 block font-medium">
                      နုတ်ပေးငွေ
                    </span>
                  </div>

                  {/* 4. Net Sales */}
                  <div className="bg-sky-50 p-2.5 rounded-xl border border-sky-200 shadow-2xs">
                    <span className="text-[9px] font-bold text-sky-900 block mb-0.5 uppercase">၄။ အမှန်ရောင်းငွေ</span>
                    <div className="text-sm font-black text-sky-950 font-mono">
                      {formatAmount(stmtGrandTotals.netSales, currency)}
                    </div>
                    <span className="text-[9px] text-sky-700 block font-medium">
                      ဒိုင်လက်ကျန်ရောင်းငွေ
                    </span>
                  </div>

                  {/* 5. Master Payout */}
                  <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 shadow-2xs">
                    <span className="text-[9px] font-bold text-emerald-900 block mb-0.5 uppercase">၅။ အထက်ပေါက်ကြေး</span>
                    <div className="text-sm font-black text-emerald-900 font-mono">
                      +{formatAmount(stmtGrandTotals.totalMasterPayout, currency)}
                    </div>
                    <span className="text-[9px] text-emerald-700 block font-medium">
                      ဒိုင်ကြီး ပြန်လျော်ငွေ
                    </span>
                  </div>

                  {/* 6. Forward Commission */}
                  <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-200 shadow-2xs">
                    <span className="text-[9px] font-bold text-purple-900 block mb-0.5 uppercase">၆။ အထက်ကော်မရှင်</span>
                    <div className="text-sm font-black text-purple-900 font-mono">
                      +{formatAmount(stmtGrandTotals.totalForwardCommission, currency)}
                    </div>
                    <span className="text-[9px] text-purple-700 block font-medium">
                      ကိုယ်ရမည့် ကော်မရှင်
                    </span>
                  </div>

                  {/* 7. Total Payout */}
                  <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 shadow-2xs">
                    <span className="text-[9px] font-bold text-rose-800 block mb-0.5 uppercase">၇။ ပေးလျှော်ငွေ</span>
                    <div className="text-sm font-black text-rose-800 font-mono">
                      -{formatAmount(stmtGrandTotals.totalPayout, currency)}
                    </div>
                    <span className="text-[9px] text-rose-600 block font-medium">
                      ပေါက်သူ {stmtGrandTotals.totalWinners} ဦး
                    </span>
                  </div>

                  {/* 8. Net Profit / Loss */}
                  <div className={`p-2.5 rounded-xl border shadow-2xs ${
                    stmtGrandTotals.isProfit ? 'bg-teal-50 border-teal-300' : 'bg-rose-100 border-rose-300'
                  }`}>
                    <span className={`text-[9px] font-bold block mb-0.5 uppercase ${
                      stmtGrandTotals.isProfit ? 'text-teal-900' : 'text-rose-900'
                    }`}>
                      ၈။ အသားတင် {stmtGrandTotals.isProfit ? 'အမြတ်' : 'အရှုံး'}
                    </span>
                    <div className={`text-sm font-black font-mono ${
                      stmtGrandTotals.isProfit ? 'text-teal-800' : 'text-rose-800'
                    }`}>
                      {stmtGrandTotals.isProfit ? '+' : '-'}{formatAmount(Math.abs(stmtGrandTotals.netProfit), currency)}
                    </div>
                    <span className={`text-[9px] font-bold block ${
                      stmtGrandTotals.isProfit ? 'text-teal-700' : 'text-rose-700'
                    }`}>
                      {stmtGrandTotals.isProfit ? 'မြတ်' : 'ရှုံး'} ({stmtGrandTotals.profitMargin}%)
                    </span>
                  </div>
                </div>

              {/* Records List Table */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="bg-slate-900 text-white px-3.5 py-2 flex items-center justify-between">
                  <span className="text-xs font-bold">
                    ပွဲစဉ်အလိုက် အသေးစိတ် စာရင်းရှင်းတမ်း ({stmtRecords.length} ခု)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleExportStatementsExcel}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>ရှင်းတမ်း Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportPeriodAllVouchersExcel}
                      className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      title="ရွေးချယ်ထားသော ကာလအတွင်း ဘောင်ချာများ အားလုံးအား Excel ဖြင့် ထုတ်ယူမည်"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>ဘောင်ချာများ Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => printStatementReport('printable-statement', 'ရွှေမင်္ဂလာ စာရင်းရှင်းတမ်း အစီရင်ခံစာ')}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      title="ပရင့်ထုတ်ရန် သို့မဟုတ် PDF အဖြစ် သိမ်းဆည်းရန်"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>ပရင့် / PDF</span>
                    </button>
                  </div>
                </div>

                {stmtRecords.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 space-y-1">
                    <CheckCircle2 className="w-7 h-7 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">ရွေးချယ်ထားသော ကာလအတွင်း ရှင်းတမ်းမှတ်တမ်း မရှိပါ</p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {stmtRecords.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRecord(r)}
                        className="p-3 flex items-center justify-between hover:bg-indigo-50/50 transition-colors cursor-pointer group"
                        title="အသေးစိတ်စာရင်းကြည့်ရန် သို့မဟုတ် ဖျက်ရန် နှိပ်ပါ"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 text-[10px] font-black rounded ${
                              r.mode === '3d'
                                ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                                : r.mode === '2d'
                                ? 'bg-teal-100 text-teal-900 border border-teal-200'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            }`}>
                              {r.modeLabel}
                            </span>
                            <span className="font-bold text-slate-900">{r.name}</span>
                            <span className="text-[11px] font-mono text-slate-500">({r.date})</span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                            <span>ပေါက်ဂဏန်း: <b className="font-mono text-amber-700">{r.winningResult}</b></span>
                            <span>•</span>
                            <span>ထိုးကြေး: {formatAmount(r.turnover, currency)}</span>
                            <span>•</span>
                            <span>အမှန်ရောင်း: {formatAmount(r.netSales, currency)}</span>
                            <span>•</span>
                            <span>လျော်ကြေး: {formatAmount(r.payout, currency)}</span>
                            {r.forwardCommission > 0 && (
                              <>
                                <span>•</span>
                                <span>လွှဲကော်: +{formatAmount(r.forwardCommission, currency)}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <span className={`text-xs font-black px-2 py-0.5 rounded-lg border inline-block ${
                            r.isProfit 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}>
                            {r.isProfit ? '+' : '-'}{formatAmount(Math.abs(r.netProfit), currency)}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {r.status === 'settled' ? 'ရှင်းတမ်းပြီး ✓' : 'ဖွင့်လှစ်ဆဲ'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 7: EXCEL EXPORT (EXCEL ထုတ်ရန်) */}
          {/* ==================================================== */}
          {activeTab === 'excel' && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 space-y-2">
                <h4 className="text-xs font-black text-sky-950 uppercase flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-sky-600" />
                  <span>ရုံးသုံးအတွက် Excel ဖိုင် (.xlsx) ထုတ်ယူရန် နေရာ</span>
                </h4>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  အရောင်းဘောင်ချာများ၊ ဂဏန်းအချုပ်စာရင်းဇယား (Master Ledger) များနှင့် ရှင်းတမ်းများကို Excel ဖိုင်အဖြစ် တိုက်ရိုက် ထုတ်ယူသိမ်းဆည်းနိုင်ပါသည်။
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 2D Sales Vouchers */}
                <button
                  type="button"
                  onClick={handleExport2DExcel}
                  className="p-3.5 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-2xl flex items-center gap-3 transition-all cursor-pointer shadow-2xs text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">ဇီးကွက် (2D) အရောင်းဘောင်ချာများ</span>
                    <span className="text-[11px] text-slate-500">2D ဘောင်ချာစောင်ရေ {lottery2D.vouchers.length} စောင် စာရင်း</span>
                  </div>
                </button>

                {/* 2D Master Ledger Matrix */}
                <button
                  type="button"
                  onClick={handleExport2DLedgerMatrix}
                  className="p-3.5 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-2xl flex items-center gap-3 transition-all cursor-pointer shadow-2xs text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">ဇီးကွက် (00-99) ဂဏန်းအချုပ်စာရင်း</span>
                    <span className="text-[11px] text-slate-500">ဂဏန်း ၁၀၀ လုံး ရောင်းရငွေ၊ Limit နှင့် ဒိုင်လွှဲငွေ</span>
                  </div>
                </button>

                {/* 3D Sales Vouchers */}
                <button
                  type="button"
                  onClick={handleExport3DExcel}
                  className="p-3.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3 transition-all cursor-pointer shadow-2xs text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">အိုးစည်လေး (3D) အရောင်းဘောင်ချာများ</span>
                    <span className="text-[11px] text-slate-500">3D ဘောင်ချာစောင်ရေ {lottery3D.vouchers.length} စောင် စာရင်း</span>
                  </div>
                </button>

                {/* 3D Master Ledger Matrix */}
                <button
                  type="button"
                  onClick={handleExport3DLedgerMatrix}
                  className="p-3.5 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3 transition-all cursor-pointer shadow-2xs text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">အိုးစည်လေး (000-999) ဂဏန်းအချုပ်စာရင်း</span>
                    <span className="text-[11px] text-slate-500">ဂဏန်း ၁,၀၀၀ လုံး ရောင်းရငွေနှင့် အန္တရာယ်ခွဲခြမ်းမှု</span>
                  </div>
                </button>

                {/* Football Slips */}
                <button
                  type="button"
                  onClick={handleExportFootballExcel}
                  className="p-3.5 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl flex items-center gap-3 transition-all cursor-pointer shadow-2xs text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">ပစ်တိုင်းထောင် (Football) စလစ်များ</span>
                    <span className="text-[11px] text-slate-500">ဘောလုံးမောင်း/ဘော်ဒီ ထိုးငွေနှင့် ရလဒ်များ</span>
                  </div>
                </button>

                {/* Combined Financial Statements */}
                <button
                  type="button"
                  onClick={handleExportStatementsExcel}
                  className="p-3.5 bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-2xl flex items-center gap-3 transition-all cursor-pointer shadow-2xs text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">ကာလချုပ် စာရင်းရှင်းတမ်း Excel</span>
                    <span className="text-[11px] text-slate-500">အရောင်း၊ လျော်ကြေးနှင့် အသားတင် အမြတ်/အရှုံး</span>
                  </div>
                </button>

                {/* Period Filtered All Vouchers Excel Button */}
                <button
                  type="button"
                  onClick={handleExportPeriodAllVouchersExcel}
                  className="p-3.5 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-2xl flex items-center gap-3 transition-all cursor-pointer shadow-2xs text-left group sm:col-span-2"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shrink-0 group-hover:scale-105 transition-transform">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">
                      ကာလအလိုက် ဘောင်ချာများ အားလုံး စုစည်း Excel ထုတ်ယူမည်
                    </span>
                    <span className="text-[11px] text-slate-500">
                      ရွေးချယ်ထားသော ကာလ ({stmtStartDate} မှ {stmtEndDate}) အတွင်း 2D, 3D, Football ဘောင်ချာများ အကုန်လုံး အသေးစိတ် ထုတ်ယူမည်
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer - Save All Buttons */}
        <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-medium">
            {savedSuccess ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ
              </span>
            ) : (
              <span>* အပြောင်းအလဲများကို အတည်ပြုသိမ်းဆည်းပါ</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
            >
              ပိတ်မည်
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              <span>အားလုံး သိမ်းဆည်းမည်</span>
            </button>
          </div>
        </div>

      </div>

      {/* Selected Statement Record Inspector Dialog */}
      {selectedRecord && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 text-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col justify-between animate-in fade-in zoom-in-95 duration-150">
            {/* Detail Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span className="font-black text-sm">{selectedRecord.name} (အသေးစိတ်ကြည့်ရှုခြင်း)</span>
              </div>
              <button
                onClick={() => { setSelectedRecord(null); setIsConfirmingDelete(false); setDeletePassword(''); setDeleteError(null); }}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {/* Detail Content */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Metrics summary */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">၁။ ထိုးကြေး</span>
                  <span className="text-sm font-black font-mono text-slate-900">{formatAmount(selectedRecord.turnover, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-800 font-bold block uppercase">၂။ အောက်လက်ကော်မရှင်</span>
                  <span className="text-sm font-black font-mono text-amber-800">-{formatAmount(selectedRecord.agentCommission, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-rose-600 font-bold block uppercase">၃။ ပေးလျော်ငွေ</span>
                  <span className="text-sm font-black font-mono text-rose-700">{formatAmount(selectedRecord.payout, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-indigo-600 font-bold block uppercase">၄။ ဒိုင်ကြီးလွှဲကော်မရှင်</span>
                  <span className="text-sm font-black font-mono text-indigo-700">+{formatAmount(selectedRecord.forwardCommission, currency)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">၅။ အသားတင်ရလဒ်</span>
                  <span className={`text-sm font-black font-mono px-1.5 py-0.5 rounded ${
                    selectedRecord.isProfit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {selectedRecord.isProfit ? '+' : '-'}{formatAmount(Math.abs(selectedRecord.netProfit), currency)}
                  </span>
                </div>
              </div>

              {/* Vouchers lists */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800">အရောင်းဘောင်ချာများ စာရင်း ({selectedRecord.vouchersCount} စောင်)</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-slate-100 font-sans font-medium">
                  {(() => {
                    const is3D = selectedRecord.mode === '3d';
                    const is2D = selectedRecord.mode === '2d';
                    const roundId = selectedRecord.rawRoundId || selectedRecord.id.replace(/^(3d|2d|football|fb)-/, '');

                    let vouchersToDisplay: any[] = [];
                    if (is2D) {
                      vouchersToDisplay = lottery2D.vouchers.filter(v => 
                        (v.roundId === roundId || (!v.roundId && (v.createdAt || '').slice(0, 10) === selectedRecord.date)) &&
                        v.status !== 'cancelled'
                      );
                    } else if (is3D) {
                      vouchersToDisplay = lottery3D.vouchers.filter(v => 
                        (v.roundId === roundId || (!v.roundId && (v.createdAt || '').slice(0, 10) === selectedRecord.date)) &&
                        v.status !== 'cancelled'
                      );
                    } else {
                      vouchersToDisplay = football.slips.filter(s => (s.createdAt || s.roundDate || '').slice(0, 10) === selectedRecord.date && s.status !== 'cancelled');
                    }

                    if (vouchersToDisplay.length === 0) {
                      return <p className="p-4 text-center text-slate-400">ဘောင်ချာမှတ်တမ်း မရှိပါ</p>;
                    }

                    return vouchersToDisplay.map((v: any, index: number) => {
                      const itemsStr = v.items ? v.items.map((it: any) => `${it.number}=${it.amount}`).join(', ') : '-';
                      const hasWonItem = v.items ? v.items.some((it: any) => it.isWon || it.number === selectedRecord.winningResult) : false;

                      return (
                        <div key={index} className="p-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between text-[11px]">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold font-mono text-slate-900">{v.voucherNo || v.slipNo}</span>
                              <span className="text-slate-600 font-medium">({v.customerName})</span>
                              {hasWonItem && (
                                <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 font-black text-[9px] rounded-md">
                                  ★ ပေါက်မဲ
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate max-w-xs">
                              {itemsStr}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold font-mono text-slate-900 block">{formatAmount(v.netPayable || v.subtotal || v.stakeAmount, currency)}</span>
                            <span className={`text-[10px] ${v.isPaid ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                              {v.isPaid ? 'ရှင်းပြီး ✓' : 'ကြွေးကျန်'}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* PIN-Protected Deletion Area */}
              <div className="border-t border-slate-200 pt-3.5 space-y-3">
                {!isConfirmingDelete ? (
                  <div className="flex items-center justify-between gap-3 bg-rose-50 border border-rose-200 rounded-xl p-3">
                    <div>
                      <h5 className="font-black text-rose-950 text-xs">ဤရှင်းတမ်းမှတ်တမ်းအား ဖျက်သိမ်းလိုပါသလား။</h5>
                      <p className="text-[10px] text-rose-800 leading-tight">ဖျက်သိမ်းပြီးပါက ဤပွဲစဉ်/ရက်စွဲ၏ အရောင်း၊ အလျော်၊ ဘောင်ချာများအားလုံး အပြီးတိုင် ပျက်သွားမည်ဖြစ်သည်။</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(true)}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-2xs shrink-0 active:scale-95"
                    >
                      ဖျက်မည်
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center gap-2 text-slate-800 font-bold">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      <span>အပြီးတိုင် ဖျက်သိမ်းရန် ဆက်တင်လျှို့ဝှက်နံပါတ် (Password) လိုအပ်ပါသည်</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        placeholder="လျှို့ဝှက်နံပါတ် ရိုက်ထည့်ပါ"
                        value={deletePassword}
                        onChange={(e) => { setDeletePassword(e.target.value); setDeleteError(null); }}
                        className="flex-1 bg-white border border-slate-300 focus:border-rose-500 rounded-xl px-3 py-2 outline-none font-bold text-slate-900 shadow-2xs font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleDeleteRecord}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl cursor-pointer shadow-xs active:scale-95 transition-all"
                      >
                        အတည်ပြုဖျက်မည်
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsConfirmingDelete(false); setDeletePassword(''); setDeleteError(null); }}
                        className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer"
                      >
                        မဖျက်တော့ပါ
                      </button>
                    </div>

                    {deleteError && (
                      <p className="text-xs text-rose-600 font-bold animate-pulse flex items-center gap-1">
                        ⚠️ {deleteError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => { setSelectedRecord(null); setIsConfirmingDelete(false); setDeletePassword(''); setDeleteError(null); }}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer"
              >
                ပိတ်မည်
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
