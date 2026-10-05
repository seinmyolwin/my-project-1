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
  FileSpreadsheet
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { BookieMode } from '../types';
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

  // Enabled Modes State
  const [localModes, setLocalModes] = useState<EnabledModes>(enabledModes);

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

        {/* Modal Body - Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 text-xs">
          
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
                        value={mult3D}
                        onChange={(e) => setMult3D(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-full bg-white border border-indigo-200 rounded-lg p-1.5 text-xs font-bold text-indigo-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                        ပတ်လည် ပေါက်ဆ:
                      </label>
                      <input
                        type="number"
                        value={todd3D}
                        onChange={(e) => setTodd3D(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-full bg-white border border-indigo-200 rounded-lg p-1.5 text-xs font-bold text-indigo-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                        ကော်မရှင် (%):
                      </label>
                      <input
                        type="number"
                        value={comm3D}
                        onChange={(e) => setComm3D(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-full bg-white border border-indigo-200 rounded-lg p-1.5 text-xs font-bold text-indigo-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-indigo-950 mb-1">
                        ဝယ်သူ လျှော့ပေး (%):
                      </label>
                      <input
                        type="number"
                        value={disc3D}
                        onChange={(e) => setDisc3D(e.target.value)}
                        onFocus={(e) => e.target.select()}
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
                        value={globalLimit3D}
                        onChange={(e) => setGlobalLimit3D(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        သတိပေးအဆင့် (Alert %):
                      </label>
                      <input
                        type="number"
                        value={alertPct3D}
                        onChange={(e) => setAlertPct3D(e.target.value)}
                        onFocus={(e) => e.target.select()}
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
                        value={numLimit3DInput}
                        onChange={(e) => setNumLimit3DInput(e.target.value)}
                        onFocus={(e) => e.target.select()}
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
                        value={amtLimit3DInput}
                        onChange={(e) => setAmtLimit3DInput(e.target.value)}
                        onFocus={(e) => e.target.select()}
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
                        value={mult2D}
                        onChange={(e) => setMult2D(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-full bg-white border border-teal-200 rounded-lg p-1.5 text-xs font-bold text-teal-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-teal-950 mb-1">
                        ကော်မရှင် (%):
                      </label>
                      <input
                        type="number"
                        value={comm2D}
                        onChange={(e) => setComm2D(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className="w-full bg-white border border-teal-200 rounded-lg p-1.5 text-xs font-bold text-teal-900 text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-teal-950 mb-1">
                        ဝယ်သူ လျှော့ပေး (%):
                      </label>
                      <input
                        type="number"
                        value={disc2D}
                        onChange={(e) => setDisc2D(e.target.value)}
                        onFocus={(e) => e.target.select()}
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
                      value={globalLimit2D}
                      onChange={(e) => setGlobalLimit2D(e.target.value)}
                      onFocus={(e) => e.target.select()}
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
                        value={numLimit2DInput}
                        onChange={(e) => setNumLimit2DInput(e.target.value)}
                        onFocus={(e) => e.target.select()}
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
                        value={amtLimit2DInput}
                        onChange={(e) => setAmtLimit2DInput(e.target.value)}
                        onFocus={(e) => e.target.select()}
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
                    value={commFB}
                    onChange={(e) => setCommFB(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full bg-white border border-emerald-200 rounded-lg p-1.5 text-xs font-bold text-emerald-900 text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                    ဝယ်သူ လျှော့ငွေ (%):
                  </label>
                  <input
                    type="number"
                    value={discFB}
                    onChange={(e) => setDiscFB(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="w-full bg-white border border-emerald-200 rounded-lg p-1.5 text-xs font-bold text-emerald-900 text-center"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-emerald-950 mb-1">
                    အမြင့်ဆုံး လျော်ကြေး:
                  </label>
                  <input
                    type="number"
                    value={maxPayoutFB}
                    onChange={(e) => setMaxPayoutFB(e.target.value)}
                    onFocus={(e) => e.target.select()}
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
                      maxLength={20}
                      value={oldPin}
                      onChange={(e) => setOldPin(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="လက်ရှိ Password"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-xs text-center font-mono font-bold text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-bold">Password အသစ်:</label>
                    <input
                      type="password"
                      maxLength={20}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="အနည်းဆုံး ၄ လုံး"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-xs text-center font-mono font-bold text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-bold">အတည်ပြုပါ:</label>
                    <input
                      type="password"
                      maxLength={20}
                      value={confirmNewPin}
                      onChange={(e) => setConfirmNewPin(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="အတည်ပြုပါ"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-xs text-center font-mono font-bold text-white outline-none focus:border-indigo-500"
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
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-black text-emerald-900 uppercase flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>လက်ရှိလုပ်ငန်းလိုင်းများ၏ စားရင်းရှင်းတမ်းချုပ်</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                    <span className="text-[11px] text-slate-500 font-semibold block">အိုးစည်လေး (3D) စုစုပေါင်းအရောင်း</span>
                    <span className="text-sm font-mono font-black text-slate-900 mt-1 block">
                      {formatAmount(lottery3D.vouchers.reduce((acc, v) => acc + v.totalAmount, 0), currency)}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                    <span className="text-[11px] text-slate-500 font-semibold block">ဇီးကွက် (2D) စုစုပေါင်းအရောင်း</span>
                    <span className="text-sm font-mono font-black text-slate-900 mt-1 block">
                      {formatAmount(lottery2D.vouchers.reduce((acc, v) => acc + v.totalAmount, 0), currency)}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-2xs">
                    <span className="text-[11px] text-slate-500 font-semibold block">ပစ်တိုင်းထောင် စုစုပေါင်းထိုးငွေ</span>
                    <span className="text-sm font-mono font-black text-slate-900 mt-1 block">
                      {formatAmount(football.slips.reduce((acc, s) => acc + s.totalStake, 0), currency)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <span className="text-xs font-black text-slate-900 block">အသေးစိတ် စားရင်းရှင်းတမ်းများနှင့် အမြတ်/အရှုံး တွက်ချက်မှုများ</span>
                <p className="text-[11px] text-slate-500">
                  ရက်စွဲအလိုက်၊ ပွဲစဉ်အလိုက် အသေးစိတ် အမြတ်အစွန်းနှင့် ကော်မရှင်ရှင်းတမ်းများကို အပြည့်အစုံ ကြည့်ရှုနိုင်ပါသည်။
                </p>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 7: EXCEL EXPORT (EXCEL ထုတ်ရန်) */}
          {/* ==================================================== */}
          {activeTab === 'excel' && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 space-y-3">
                <h4 className="text-xs font-black text-sky-900 uppercase flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-sky-600" />
                  <span>ရုံးသုံးအတွက် Excel ဖိုင် (.xlsx) ထုတ်ယူရန်</span>
                </h4>
                <p className="text-[11px] text-slate-600">
                  အောက်ပါခလုတ်များကို နှိပ်၍ အရောင်းစာရင်းဇယားများနှင့် ဘောင်ချာများကို Excel ဖိုင်ဖြင့် တိုက်ရိုက် ထုတ်ယူနိုင်ပါသည်။
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleExport3DExcel}
                  className="p-4 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3 transition-all cursor-pointer shadow-2xs text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">အိုးစည်လေး (3D) Excel</span>
                    <span className="text-[11px] text-slate-500">ဘောင်ချာများနှင့် အရောင်းစာရင်း</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleExport2DExcel}
                  className="p-4 bg-white hover:bg-teal-50 border border-slate-200 hover:border-teal-300 rounded-2xl flex items-center gap-3 transition-all cursor-pointer shadow-2xs text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">ဇီးကွက် (2D) Excel</span>
                    <span className="text-[11px] text-slate-500">2D အရောင်းစာရင်းနှင့် ရှင်းတမ်း</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handleExportFootballExcel}
                  className="p-4 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl flex items-center gap-3 transition-all cursor-pointer shadow-2xs text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">ပစ်တိုင်းထောင် (Football) Excel</span>
                    <span className="text-[11px] text-slate-500">ဘောလုံးဘောင်ချာနှင့် ထိုးငွေများ</span>
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
