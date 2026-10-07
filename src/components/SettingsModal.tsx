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
  Printer
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { printStatementReport } from '../utils/printUtils';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { BookieMode, TwoDNumberAggregate, NumberAggregate } from '../types';
import { formatAmount, getPermutations } from '../utils/lotteryUtils';
import { EnabledModes, saveEnabledModes, saveOwnerPin, verifyOwnerPin, getStoredOwnerPin } from '../utils/securityUtils';
import {
  exportSecureMasterBackup,
  restoreSecureMasterBackup,
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
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = '3d',
  enabledModes,
  onUpdateEnabledModes
}) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  const [activeTab, setActiveTab] = useState<'3d' | '2d' | 'football' | 'general' | 'backup' | 'statements' | 'excel'>(initialTab);
  const [subTab3D, setSubTab3D] = useState<'rates' | 'limits' | 'blocked'>('rates');
  const [subTab2D, setSubTab2D] = useState<'rates' | 'limits' | 'blocked'>('rates');

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  // Excel Export Handlers
  const handleExport3DExcel = () => {
    const data = lottery3D.vouchers.map((v, i) => ({
      'စဉ်': i + 1,
      'ဘောင်ချာအမှတ်': v.id,
      'ဝယ်သူအမည်': v.customerName,
      'ဖုန်း': v.customerPhone || '-',
      'စုစုပေါင်းထိုးငွေ': v.totalAmount,
      'ကော်မရှင်': v.commissionAmount,
      'ပေးငွေ': v.netAmount,
      'ရက်စွဲ': new Date(v.timestamp).toLocaleString()
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '3D Sales');
    XLSX.writeFile(wb, `3D_Sales_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExport2DExcel = () => {
    const data = lottery2D.vouchers.map((v, i) => ({
      'စဉ်': i + 1,
      'ဘောင်ချာအမှတ်': v.id,
      'ဝယ်သူအမည်': v.customerName,
      'ဖုန်း': v.customerPhone || '-',
      'စုစုပေါင်းထိုးငွေ': v.totalAmount,
      'ကော်မရှင်': v.commissionAmount,
      'ပေးငွေ': v.netAmount,
      'ရက်စွဲ': new Date(v.timestamp).toLocaleString()
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '2D Sales');
    XLSX.writeFile(wb, `2D_Sales_Ledger_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportFootballExcel = () => {
    const data = football.slips.map((s, i) => ({
      'စဉ်': i + 1,
      'ဘောင်ချာအမှတ်': s.id,
      'ဝယ်သူအမည်': s.customerName,
      'စုစုပေါင်းထိုးငွေ': s.totalStake,
      'အခြေအနေ': s.status,
      'ရက်စွဲ': new Date(s.timestamp).toLocaleString()
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Football Slips');
    XLSX.writeFile(wb, `Football_Slips_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
  const [statementPeriod, setStatementPeriod] = useState<'today' | 'five_days' | 'week' | 'month' | 'custom'>('week');
  const [statementMode, setStatementMode] = useState<'all' | '3d' | '2d' | 'football'>('all');
  const getDaysAgo = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  };
  const todayStr = new Date().toISOString().slice(0, 10);
  const fiveDaysAgoStr = getDaysAgo(4);
  const oneWeekAgoStr = getDaysAgo(6);
  const oneMonthAgoStr = getDaysAgo(29);
  const [stmtCustomStart, setStmtCustomStart] = useState(oneWeekAgoStr);
  const [stmtCustomEnd, setStmtCustomEnd] = useState(todayStr);

  const { stmtStartDate, stmtEndDate } = React.useMemo(() => {
    if (statementPeriod === 'today') return { stmtStartDate: todayStr, stmtEndDate: todayStr };
    if (statementPeriod === 'five_days') return { stmtStartDate: fiveDaysAgoStr, stmtEndDate: todayStr };
    if (statementPeriod === 'week') return { stmtStartDate: oneWeekAgoStr, stmtEndDate: todayStr };
    if (statementPeriod === 'month') return { stmtStartDate: oneMonthAgoStr, stmtEndDate: todayStr };
    return { stmtStartDate: stmtCustomStart, stmtEndDate: stmtCustomEnd };
  }, [statementPeriod, todayStr, fiveDaysAgoStr, oneWeekAgoStr, oneMonthAgoStr, stmtCustomStart, stmtCustomEnd]);

  // Aggregate Statement Records
  const stmtRecords = React.useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      mode: '3d' | '2d' | 'football';
      modeLabel: string;
      name: string;
      winningResult: string;
      turnover: number;
      payout: number;
      commission: number;
      netProfit: number;
      isProfit: boolean;
      winnersCount: number;
      vouchersCount: number;
      status: 'settled' | 'open';
    }> = [];

    // 1. 3D
    if (statementMode === 'all' || statementMode === '3d') {
      lottery3D.rounds.forEach((round) => {
        if (round.drawDate >= stmtStartDate && round.drawDate <= stmtEndDate) {
          const rVouchers = lottery3D.vouchers.filter(v => v.roundId === round.id && v.status !== 'cancelled');
          let turnover = 0;
          let payout = 0;
          let commission = 0;
          let winnersCount = 0;

          rVouchers.forEach(v => {
            turnover += v.netPayable || v.totalAmount;
            commission += v.totalCommission || v.commissionAmount || 0;
            v.items.forEach(it => {
              if (it.isWon) {
                payout += it.winningAmount || 0;
                winnersCount += 1;
              }
            });
          });

          const netProfit = turnover - payout + commission;
          list.push({
            id: `3d-${round.id}`,
            date: round.drawDate,
            mode: '3d',
            modeLabel: 'အိုးစည်လေး',
            name: round.name,
            winningResult: round.winningNumber || (round.status === 'settled' ? 'မပေါက်' : 'မထွက်သေး'),
            turnover,
            payout,
            commission,
            netProfit,
            isProfit: netProfit >= 0,
            winnersCount,
            vouchersCount: rVouchers.length,
            status: round.status
          });
        }
      });
    }

    // 2. 2D
    if (statementMode === 'all' || statementMode === '2d') {
      lottery2D.rounds.forEach((round) => {
        if (round.drawDate >= stmtStartDate && round.drawDate <= stmtEndDate) {
          const rVouchers = lottery2D.vouchers.filter(v => v.roundId === round.id && v.status !== 'cancelled');
          let turnover = 0;
          let payout = 0;
          let commission = 0;
          let winnersCount = 0;

          rVouchers.forEach(v => {
            turnover += v.netPayable || v.totalAmount;
            commission += v.totalCommission || v.commissionAmount || 0;
            v.items.forEach(it => {
              if (it.isWon) {
                payout += it.winningAmount || 0;
                winnersCount += 1;
              }
            });
          });

          const netProfit = turnover - payout + commission;
          list.push({
            id: `2d-${round.id}`,
            date: round.drawDate,
            mode: '2d',
            modeLabel: 'ဇီးကွက်',
            name: round.name,
            winningResult: round.winningNumber || (round.status === 'settled' ? 'မပေါက်' : 'မထွက်သေး'),
            turnover,
            payout,
            commission,
            netProfit,
            isProfit: netProfit >= 0,
            winnersCount,
            vouchersCount: rVouchers.length,
            status: round.status
          });
        }
      });
    }

    // 3. Football
    if (statementMode === 'all' || statementMode === 'football') {
      const slips = football.slips.filter(s => {
        const d = (s.createdAt || s.timestamp || '').slice(0, 10);
        return d >= stmtStartDate && d <= stmtEndDate && s.status !== 'cancelled';
      });

      if (slips.length > 0) {
        let turnover = 0;
        let payout = 0;
        let commission = 0;
        let winnersCount = 0;

        slips.forEach(s => {
          turnover += s.netPayable || s.totalStake;
          commission += s.commissionAmount || 0;
          if (s.status === 'won') {
            payout += s.payoutAmount || 0;
            winnersCount += 1;
          }
        });

        const netProfit = turnover - payout + commission;
        list.push({
          id: `fb-${stmtStartDate}-${stmtEndDate}`,
          date: stmtEndDate,
          mode: 'football',
          modeLabel: 'ပစ်တိုင်းထောင်',
          name: 'ပစ်တိုင်းထောင် မောင်း/ဘော်ဒီ ရှင်းတမ်း',
          winningResult: `${winnersCount} စလစ် ပေါက်`,
          turnover,
          payout,
          commission,
          netProfit,
          isProfit: netProfit >= 0,
          winnersCount,
          vouchersCount: slips.length,
          status: 'settled'
        });
      }
    }

    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [statementMode, stmtStartDate, stmtEndDate, lottery3D.rounds, lottery3D.vouchers, lottery2D.rounds, lottery2D.vouchers, football.slips]);

  // Grand Totals for Statements
  const stmtGrandTotals = React.useMemo(() => {
    let totalTurnover = 0;
    let totalPayout = 0;
    let totalCommission = 0;
    let totalVouchers = 0;
    let totalWinners = 0;

    stmtRecords.forEach(r => {
      totalTurnover += r.turnover;
      totalPayout += r.payout;
      totalCommission += r.commission;
      totalVouchers += r.vouchersCount;
      totalWinners += r.winnersCount;
    });

    const netProfit = totalTurnover - totalPayout + totalCommission;
    const profitMargin = totalTurnover > 0 ? ((netProfit / totalTurnover) * 100).toFixed(1) : '0';

    return {
      totalTurnover,
      totalPayout,
      totalCommission,
      netProfit,
      isProfit: netProfit >= 0,
      profitMargin,
      totalVouchers,
      totalWinners
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
      'ထိုးကြေး/ရောင်းရငွေ (ကျပ်)': r.turnover,
      'ပေးလျော်ငွေ (ကျပ်)': r.payout,
      'ကော်မရှင် (ကျပ်)': r.commission,
      'အသားတင် အမြတ်/အရှုံး (ကျပ်)': r.netProfit,
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
      'ထိုးကြေး/ရောင်းရငွေ (ကျပ်)': stmtGrandTotals.totalTurnover,
      'ပေးလျော်ငွေ (ကျပ်)': stmtGrandTotals.totalPayout,
      'ကော်မရှင် (ကျပ်)': stmtGrandTotals.totalCommission,
      'အသားတင် အမြတ်/အရှုံး (ကျပ်)': stmtGrandTotals.netProfit,
      'ပေါက်သူဦးရေ': stmtGrandTotals.totalWinners,
      'ဘောင်ချာစောင်ရေ': stmtGrandTotals.totalVouchers,
      'အခြေအနေ': stmtGrandTotals.isProfit ? 'အမြတ်' : 'အရှုံး'
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'စာရင်းရှင်းတမ်း');
    XLSX.writeFile(wb, `စာရင်းရှင်းတမ်း_${statementMode}_${stmtStartDate}_${stmtEndDate}.xlsx`);
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
  const [mult3D, setMult3D] = useState(String(lottery3D.settings.defaultMultiplier || 600));
  const [todd3D, setTodd3D] = useState(String(lottery3D.settings.defaultToddMultiplier || 100));
  const [comm3D, setComm3D] = useState(String(lottery3D.settings.defaultCommissionRate || 10));
  const [disc3D, setDisc3D] = useState(String(lottery3D.settings.defaultCustomerDiscount || 0));
  const [globalLimit3D, setGlobalLimit3D] = useState(String(lottery3D.settings.globalStockLimit || 100000));
  const [alertPct3D, setAlertPct3D] = useState(String(lottery3D.settings.lowStockAlertPercentage || 80));
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
  const [mult2D, setMult2D] = useState(String(lottery2D.settings.defaultMultiplier || 85));
  const [comm2D, setComm2D] = useState(String(lottery2D.settings.defaultCommissionRate || 12));
  const [disc2D, setDisc2D] = useState(String(lottery2D.settings.defaultCustomerDiscount || 0));
  const [globalLimit2D, setGlobalLimit2D] = useState(String(lottery2D.settings.globalStockLimit || 200000));
  const [footer2D, setFooter2D] = useState(lottery2D.settings.voucherFooterMessage || '');

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
  const [commFB, setCommFB] = useState(String(football.settings.defaultCommissionRate || 8));
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
      currency,
      defaultMultiplier: parseInt(mult3D, 10) || 600,
      defaultToddMultiplier: parseInt(todd3D, 10) || 100,
      defaultCommissionRate: parseInt(comm3D, 10) || 10,
      defaultCustomerDiscount: parseInt(disc3D, 10) || 0,
      globalStockLimit: parseInt(globalLimit3D, 10) || 100000,
      lowStockAlertPercentage: parseInt(alertPct3D, 10) || 80,
      voucherFooterMessage: footer3D.trim()
    });

    // 2. Save 2D
    lottery2D.updateSettings({
      appName: name2D.trim() || 'ရွှေမင်္ဂလာ',
      shopName: shop2D.trim(),
      shopPhone: phone2D.trim(),
      currency,
      defaultMultiplier: parseFloat(mult2D) || 85,
      defaultCommissionRate: parseFloat(comm2D) || 12,
      defaultCustomerDiscount: parseFloat(disc2D) || 0,
      globalStockLimit: parseFloat(globalLimit2D) || 200000,
      voucherFooterMessage: footer2D.trim()
    });

    // 3. Save Football
    football.updateSettings({
      appName: nameFB.trim() || 'ရွှေမင်္ဂလာ',
      shopName: shopFB.trim(),
      shopPhone: phoneFB.trim(),
      currency,
      defaultCommissionRate: parseFloat(commFB) || 8,
      defaultCustomerDiscount: parseFloat(discFB) || 0,
      maxPayoutPerTicket: parseFloat(maxPayoutFB) || 15000000,
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

  if (!isOpen) return null;

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

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100">
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
                        className="w-full bg-white border border-indigo-200 rounded-lg p-1.5 text-xs font-bold text-indigo-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                        ပတ်လည် ပေါက်ဆ:
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
                        className="w-full bg-white border border-indigo-200 rounded-lg p-1.5 text-xs font-bold text-indigo-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                        ကော်မရှင် (%):
                      </label>
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
                        className="w-full bg-white border border-indigo-200 rounded-lg p-1.5 text-xs font-bold text-indigo-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                        ဝယ်သူ လျှော့ပေး (%):
                      </label>
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
                        className="w-full bg-white border border-indigo-200 rounded-lg p-1.5 text-xs font-bold text-indigo-900 text-center"
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
                  ၂။ ဂဏန်းတစ်လုံးချင်း Limit ({Object.keys(lottery2D.limits).length})
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab2D('blocked')}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                    subTab2D === 'blocked' ? 'bg-white text-teal-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ၃။ ဒိုင်ကာဂဏန်းများ ({filteredBlocked2D.length})
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

                  <div className="grid grid-cols-3 gap-2 bg-teal-50/60 p-2.5 rounded-xl border border-teal-100">
                    <div>
                      <label className="block text-[11px] font-bold text-teal-950 mb-1">
                        ဇီးကွက် ပေါက်ဆ:
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
                        className="w-full bg-white border border-teal-200 rounded-lg p-1.5 text-xs font-bold text-teal-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-teal-950 mb-1">
                        ကော်မရှင် (%):
                      </label>
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
                        className="w-full bg-white border border-teal-200 rounded-lg p-1.5 text-xs font-bold text-teal-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-teal-950 mb-1">
                        ဝယ်သူ လျှော့ပေး (%):
                      </label>
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
                        className="w-full bg-white border border-teal-200 rounded-lg p-1.5 text-xs font-bold text-teal-900 text-center"
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

              <div className="grid grid-cols-3 gap-2 bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100">
                <div>
                  <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                    ကော်မရှင် (%):
                  </label>
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
                    className="w-full bg-white border border-emerald-200 rounded-lg p-1.5 text-xs font-bold text-emerald-900 text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                    ဝယ်သူ လျှော့ငွေ (%):
                  </label>
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
                    className="w-full bg-white border border-emerald-200 rounded-lg p-1.5 text-xs font-bold text-emerald-900 text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                    အမြင့်ဆုံး လျော်ကြေး:
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
                    className="w-full bg-white border border-emerald-200 rounded-lg p-1.5 text-xs font-bold text-emerald-900 text-center"
                  />
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
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 6: FINANCIAL STATEMENTS (စားရင်းရှင်းတမ်း) */}
          {/* ==================================================== */}
          {activeTab === 'statements' && (
            <div className="space-y-4">
              {/* Filter Controls: Period & Mode */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-500 mr-1">ကာလ:</span>
                    {[
                      { id: 'today', label: 'ဒီနေ့' },
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
                      { id: 'all', label: 'အားလုံး' },
                      { id: '3d', label: 'အိုးစည်လေး' },
                      { id: '2d', label: 'ဇီးကွက်' },
                      { id: 'football', label: 'ပစ်တိုင်းထောင်' }
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
                    {useLottery().settings.shopName || 'ရွှေမင်္ဂလာ'} - စာရင်းရှင်းတမ်း အစီရင်ခံစာ
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

                {/* Summary Stats Overview Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-slate-500 font-bold block uppercase">စုစုပေါင်း အရောင်းရငွေ</span>
                  <div className="text-base sm:text-lg font-black font-mono text-slate-900 mt-0.5">
                    {formatAmount(stmtGrandTotals.totalTurnover, currency)}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {stmtGrandTotals.totalVouchers} စောင်
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-rose-600 font-bold block uppercase">စုစုပေါင်း ပေးလျော်ငွေ</span>
                  <div className="text-base sm:text-lg font-black font-mono text-rose-700 mt-0.5">
                    {formatAmount(stmtGrandTotals.totalPayout, currency)}
                  </div>
                  <span className="text-[10px] text-rose-500 font-medium">
                    {stmtGrandTotals.totalWinners} ဦး ပေါက်
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-2xs">
                  <span className="text-[10px] text-indigo-600 font-bold block uppercase">စုစုပေါင်း ကော်မရှင်</span>
                  <div className="text-base sm:text-lg font-black font-mono text-indigo-700 mt-0.5">
                    +{formatAmount(stmtGrandTotals.totalCommission, currency)}
                  </div>
                  <span className="text-[10px] text-indigo-500 font-medium">
                    အသားတင် ရရှိ
                  </span>
                </div>

                <div className={`p-3 rounded-2xl border shadow-2xs ${
                  stmtGrandTotals.isProfit ? 'bg-emerald-50/80 border-emerald-200' : 'bg-rose-50/80 border-rose-200'
                }`}>
                  <span className="text-[10px] text-slate-600 font-bold block uppercase">အသားတင် အမြတ်/အရှုံး</span>
                  <div className={`text-base sm:text-lg font-black font-mono mt-0.5 ${
                    stmtGrandTotals.isProfit ? 'text-emerald-700' : 'text-rose-700'
                  }`}>
                    {stmtGrandTotals.isProfit ? '+' : '-'}{formatAmount(Math.abs(stmtGrandTotals.netProfit), currency)}
                  </div>
                  <span className={`text-[10px] font-bold ${
                    stmtGrandTotals.isProfit ? 'text-emerald-600' : 'text-rose-600'
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
                      <span>Excel ထုတ်</span>
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
                      <div key={r.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
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
                          <div className="text-[11px] text-slate-500 flex items-center gap-2">
                            <span>ပေါက်ဂဏန်း: <b className="font-mono text-amber-700">{r.winningResult}</b></span>
                            <span>•</span>
                            <span>အရောင်း: {formatAmount(r.turnover, currency)}</span>
                            <span>•</span>
                            <span>လျော်ကြေး: {formatAmount(r.payout, currency)}</span>
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <span className={`text-xs font-black block ${
                            r.isProfit ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {r.isProfit ? '+' : ''}{formatAmount(r.netProfit, currency)}
                          </span>
                          <span className="text-[10px] text-slate-400">
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
    </div>
  );
};
