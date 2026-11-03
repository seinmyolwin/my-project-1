import React, { useState, useRef, useMemo } from 'react';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import {
  Download,
  Upload,
  Database,
  CheckCircle2,
  X,
  Lock,
  FolderDown,
  Share2,
  FileSpreadsheet,
  Layers,
  Calendar,
  Trash2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import {
  getBackupFileName,
  exportSecureMasterBackup,
  restoreSecureMasterBackup,
  exportPeriodVouchersBackup,
  saveFileWithCustomLocation,
  shareFileDirectly,
  downloadFile
} from '../utils/backupUtils';
import { getStoredOwnerPin, verifyOwnerPin } from '../utils/securityUtils';
import { getLocalDateStr, getDaysAgoStr } from '../utils/statementUtils';
import { STORAGE_KEYS, saveStoredData } from '../utils/storage';
import { cleanDuplicate2DVouchers, cleanDuplicate3DVouchers, cleanDuplicateFootballSlips } from '../utils/deduplicationUtils';
import { importVouchersFromExcel } from '../utils/excelImportUtils';
import { listRestorePoints, restoreFromRestorePoint, createRestorePoint } from '../utils/restorePoints';

interface UnifiedBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type VoucherRetentionPeriod = 'week' | 'two_weeks' | 'month' | 'three_months' | 'all' | 'custom';

export const UnifiedBackupModal: React.FC<UnifiedBackupModalProps> = ({ isOpen, onClose }) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  const appName = lottery3D.settings.appName || lottery2D.settings.appName || football.settings.appName || 'ရွှေမင်္ဂလာ';
  const currency = lottery3D.settings.currency || 'Ks';

  const [activeTab, setActiveTab] = useState<'master' | 'vouchers'>('master');

  const backupTabs = ['master', 'vouchers'] as const;
  const handleBackupSwipeLeft = () => {
    const idx = backupTabs.indexOf(activeTab);
    if (idx !== -1 && idx < backupTabs.length - 1) setActiveTab(backupTabs[idx + 1]);
  };
  const handleBackupSwipeRight = () => {
    const idx = backupTabs.indexOf(activeTab);
    if (idx > 0) setActiveTab(backupTabs[idx - 1]);
  };
  const backupSwipeHandlers = useSwipeGesture({
    onSwipeLeft: handleBackupSwipeLeft,
    onSwipeRight: handleBackupSwipeRight,
    threshold: 45
  });
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);
  const [includePinProtection, setIncludePinProtection] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);

  // Restore Password Prompt State
  const [pendingFileContent, setPendingFileContent] = useState<string | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [restorePinInput, setRestorePinInput] = useState('');
  const [restorePinError, setRestorePinError] = useState<string | null>(null);

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  };

  // Period-based Voucher Retention State
  const [retentionPeriod, setRetentionPeriod] = useState<VoucherRetentionPeriod>('month');
  const todayStr = getLocalDateStr();
  const [customStartDate, setCustomStartDate] = useState(getDaysAgoStr(29));
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  // PIN modal state for pruning old vouchers
  const [isConfirmingPrune, setIsConfirmingPrune] = useState(false);
  const [prunePin, setPrunePin] = useState('');
  const [prunePinError, setPrunePinError] = useState<string | null>(null);

  // Calculate Date Boundaries based on retentionPeriod
  const { startDate, endDate, periodLabel } = useMemo(() => {
    switch (retentionPeriod) {
      case 'week':
        return {
          startDate: getDaysAgoStr(6),
          endDate: todayStr,
          periodLabel: '၁ ပတ်စာ (၇ ရက်)'
        };
      case 'two_weeks':
        return {
          startDate: getDaysAgoStr(13),
          endDate: todayStr,
          periodLabel: '၂ ပတ်စာ (၁၄ ရက်)'
        };
      case 'month':
        return {
          startDate: getDaysAgoStr(29),
          endDate: todayStr,
          periodLabel: '၁ လစာ (၃၀ ရက်)'
        };
      case 'three_months':
        return {
          startDate: getDaysAgoStr(89),
          endDate: todayStr,
          periodLabel: '၃ လစာ (၉၀ ရက်)'
        };
      case 'custom':
        return {
          startDate: customStartDate || getDaysAgoStr(29),
          endDate: customEndDate || todayStr,
          periodLabel: `စိတ်ကြိုက်ရက် (${customStartDate} မှ ${customEndDate})`
        };
      case 'all':
      default:
        return {
          startDate: '2020-01-01',
          endDate: '2099-12-31',
          periodLabel: 'ကာလအားလုံး (All Vouchers)'
        };
    }
  }, [retentionPeriod, customStartDate, customEndDate, todayStr]);

  // Filter Vouchers by Period
  const filtered3DVouchers = useMemo(() => {
    return lottery3D.vouchers.filter(v => {
      const d = (v.createdAt || '').slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [lottery3D.vouchers, startDate, endDate]);

  const filtered2DVouchers = useMemo(() => {
    return lottery2D.vouchers.filter(v => {
      const d = (v.createdAt || '').slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [lottery2D.vouchers, startDate, endDate]);

  const filteredFootballSlips = useMemo(() => {
    return football.slips.filter(s => {
      const d = s.roundDate || (s.createdAt || '').slice(0, 10);
      return d >= startDate && d <= endDate;
    });
  }, [football.slips, startDate, endDate]);

  if (!isOpen) return null;
  console.log('UnifiedBackupModal opened, activeTab:', activeTab);

  const totalFilteredCount = filtered3DVouchers.length + filtered2DVouchers.length + filteredFootballSlips.length;

  // Master Full Backup Export with Location Picker
  const previewFilename = getBackupFileName(appName, 'rhmg');

  const handleExportWithLocationPicker = async () => {
    setIsSaving(true);
    try {
      const pin = includePinProtection ? getStoredOwnerPin() : '';
      const armoredEncrypted = exportSecureMasterBackup(pin);
      const filename = getBackupFileName(appName, 'rhmg');
      
      const res = await saveFileWithCustomLocation(armoredEncrypted, filename, 'text/plain;charset=utf-8');
      if (res.success) {
        showMsg(res.message);
      } else {
        showMsg(res.message, 'error');
      }
    } catch {
      showMsg('ဖိုင်သိမ်းဆည်းရာတွင် အမှားအယွင်းရှိပါသည်', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShareFile = async () => {
    setIsSaving(true);
    try {
      const pin = includePinProtection ? getStoredOwnerPin() : '';
      const armoredEncrypted = exportSecureMasterBackup(pin);
      const filename = getBackupFileName(appName, 'rhmg');

      const res = await shareFileDirectly(armoredEncrypted, filename, 'text/plain');
      if (res.success) {
        showMsg(res.message);
      } else {
        showMsg(res.message, 'error');
      }
    } catch {
      showMsg('ဖိုင်ပို့ဆောင်ရာတွင် အမှားအယွင်းရှိပါသည်', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDirectDownload = () => {
    const pin = includePinProtection ? getStoredOwnerPin() : '';
    const armoredEncrypted = exportSecureMasterBackup(pin);
    const filename = getBackupFileName(appName, 'rhmg');
    downloadFile(armoredEncrypted, filename, 'text/plain;charset=utf-8');
    showMsg(`"${filename}" အား စက်ထဲသို့ အောင်မြင်စွာ ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ`);
  };

  // Rollback / Restore handler via Restore Points (B1, B2)
  const handleRestoreClick = async () => {
    try {
      const chooseFile = window.confirm('Backup ဖိုင် (.rhmg) ကို ရွေးချယ်သွင်းယူမည်လား?');
      if (chooseFile) {
        fileInputRef.current?.click();
        return;
      }

      const points = await listRestorePoints();
      if (points && points.length > 0) {
        const latest = points[0];
        const formattedDate = new Date(latest.createdAt).toLocaleString('my-MM') || latest.createdAt;
        const confirmLatest = window.confirm(`နောက်ဆုံး restore point (${formattedDate}၊ အကြောင်းပြချက်: ${latest.reason}) ကို ပြန်ယူမလား?`);
        if (confirmLatest) {
          const confirmDestructive = window.confirm('လက်ရှိ ဒေတာ အားလုံး ပျက်သွားမည်။ သေချာပါသလား?');
          if (confirmDestructive) {
            const res = await restoreFromRestorePoint(latest.id);
            showMsg(`${res.message}။ ဒေတာများ Update ပြုလုပ်ရန် ခေတ္တစောင့်ပါ...`);
            setTimeout(() => window.location.reload(), 1500);
          }
        }
      } else {
        showMsg('စက်တွင်း Restore Point မှတ်တမ်း မရှိသေးပါ', 'error');
      }
    } catch (err: any) {
      console.warn('Restore points check error:', err);
      fileInputRef.current?.click();
    }
  };

  // Restore Master Backup File
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const currentPin = getStoredOwnerPin();

        const result = await restoreSecureMasterBackup(content, currentPin);
        if (result.success) {
          showMsg(`${result.message}။ ဒေတာများ Update ပြုလုပ်ရန် ခေတ္တစောင့်ပါ...`);
          setTimeout(() => window.location.reload(), 1500);
        } else if (result.requiresPin) {
          // File is password-protected or password differed from this device: prompt user!
          setPendingFileContent(content);
          setRestorePinInput('');
          setRestorePinError(null);
          setIsPasswordModalOpen(true);
        } else {
          showMsg(result.message || 'ဖိုင်ဖတ်ရှုမှု မအောင်မြင်ပါ', 'error');
        }
      } catch (err) {
        console.error(err);
        showMsg('ဖိုင်ဖတ်ရှုရာတွင် အမှားအယွင်း ရှိနေပါသည်', 'error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Confirm password entered by user for restore
  const handleConfirmRestorePin = async () => {
    if (!pendingFileContent) return;
    const trimmedPin = restorePinInput.trim();
    if (trimmedPin.length !== 6) {
      setRestorePinError('Password သည် ဂဏန်း ၆ လုံး အတိအကျ ဖြစ်ရပါမည်');
      return;
    }

    const result = await restoreSecureMasterBackup(pendingFileContent, trimmedPin);
    if (result.success) {
      setIsPasswordModalOpen(false);
      setPendingFileContent(null);
      showMsg(`${result.message}။ ဒေတာများ Update ပြုလုပ်ရန် ခေတ္တစောင့်ပါ...`);
      setTimeout(() => window.location.reload(), 1500);
    } else {
      setRestorePinError(result.message || 'Password မှားယွင်းနေပါသည်');
    }
  };

  // Handle Excel File Import
  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImportingExcel(true);
    try {
      try {
        await createRestorePoint('before-import');
      } catch (rpErr) {
        console.warn('Restore point creation failed before excel import:', rpErr);
      }
      const res = await importVouchersFromExcel(file);
      if (res.success) {
        showMsg(`${res.message}။ ဒေတာများ Update ပြုလုပ်ရန် ခေတ္တစောင့်ပါ...`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showMsg(res.message, 'error');
      }
    } catch (err: any) {
      showMsg(`Excel ဖတ်ရှုမှု မအောင်မြင်ပါ: ${err?.message || ''}`, 'error');
    } finally {
      setIsImportingExcel(false);
      if (excelFileInputRef.current) excelFileInputRef.current.value = '';
    }
  };

  // Manual Cleanup of existing duplicate vouchers
  const handleCleanDuplicates = async () => {
    const res2D = cleanDuplicate2DVouchers(lottery2D.vouchers);
    const res3D = cleanDuplicate3DVouchers(lottery3D.vouchers);
    const resFB = cleanDuplicateFootballSlips(football.slips);

    const totalDuplicates = res2D.duplicateCount + res3D.duplicateCount + resFB.duplicateCount;

    if (totalDuplicates > 0) {
      const dupeDetails: string[] = [];
      res2D.duplicates.forEach(v => {
        dupeDetails.push(`[2D] ${v.voucherNo || v.id} - ${v.customerName || 'အမည်မရှိ'} (${v.subtotal} Ks)`);
      });
      res3D.duplicates.forEach(v => {
        dupeDetails.push(`[3D] ${v.voucherNo || v.id} - ${v.customerName || 'အမည်မရှိ'} (${v.subtotal} Ks)`);
      });
      resFB.duplicates.forEach(s => {
        dupeDetails.push(`[Football] ${s.slipNo || s.id} - ${s.customerName || 'အမည်မရှိ'} (${s.stakeAmount} Ks)`);
      });

      const confirmText = `ထပ်နေသော ဘောင်ချာ စုစုပေါင်း (${totalDuplicates}) စောင်ကို ဖုံးထားရန် သေချာပါသလား?\n\n` + dupeDetails.slice(0, 10).join('\n') + (dupeDetails.length > 10 ? `\n... နှင့် အခြား ${dupeDetails.length - 10} ခု` : '');

      if (window.confirm(confirmText)) {
        try {
          await createRestorePoint('manual', { action: 'clean-duplicates', count: totalDuplicates });
        } catch (rpErr) {
          console.warn('Restore point creation failed before clean duplicates:', rpErr);
        }

        // Save tombstones (res.updated contains tombstones with deletedAt, deletedReason)
        saveStoredData(STORAGE_KEYS.VOUCHERS_2D, res2D.updated);
        saveStoredData(STORAGE_KEYS.VOUCHERS, res3D.updated);
        saveStoredData(STORAGE_KEYS.SLIPS_FOOTBALL, resFB.updated);

        showMsg(`ထပ်နေသော ဘောင်ချာ စုစုပေါင်း (${totalDuplicates}) စောင်ကို အောင်မြင်စွာ ဖုံးထားပြီးပါပြီ။`);
        setTimeout(() => window.location.reload(), 1500);
      }
    } else {
      showMsg('ထပ်နေသော ဘောင်ချာမရှိပါ (စာရင်းအားလုံး သန့်ရှင်းမှန်ကန်ပါသည်)', 'success');
    }
  };

  // ====================================================
  // Period-based Voucher Exports (Excel & Encrypted .rhmg)
  // ====================================================
  const handleExportPeriodVouchersExcel = () => {
    if (totalFilteredCount === 0) {
      showMsg('ရွေးချယ်ထားသော ကာလအတွင်း ဘောင်ချာမှတ်တမ်း မရှိပါ', 'error');
      return;
    }

    const rows: any[] = [];
    let idx = 1;

    // 2D Vouchers
    filtered2DVouchers.forEach(v => {
      const itemsStr = v.items?.map(it => `${it.number}=${it.amount}`).join(', ') || '-';
      const hasWon = v.items?.some(it => it.isWon);
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
        'ပေါက်မဲ': hasWon ? 'ပေါက်မဲရှိ' : '-'
      });
    });

    // 3D Vouchers
    filtered3DVouchers.forEach(v => {
      const itemsStr = v.items?.map(it => `${it.number}=${it.amount}${it.betType === 'rumble' ? 'R' : ''}`).join(', ') || '-';
      const hasWon = v.items?.some(it => it.isWon);
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
        'ပေါက်မဲ': hasWon ? 'ပေါက်မဲရှိ' : '-'
      });
    });

    // Football Slips
    filteredFootballSlips.forEach(s => {
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
    XLSX.utils.book_append_sheet(wb, ws, 'ဘောင်ချာမှတ်တမ်းများ');
    const filename = `ဘောင်ချာမှတ်တမ်း_${periodLabel.replace(/[/\\?%*:|"<>]/g, '_')}_${todayStr}.xlsx`;
    XLSX.writeFile(wb, filename);
    showMsg(`"${filename}" အား Excel ဖိုင်အဖြစ် အောင်မြင်စွာ ဒေါင်းလုဒ်ထုတ်ယူပြီးပါပြီ`);
  };

  const handleExportPeriodVouchersArchive = () => {
    if (totalFilteredCount === 0) {
      showMsg('ရွေးချယ်ထားသော ကာလအတွင်း ဘောင်ချာမှတ်တမ်း မရှိပါ', 'error');
      return;
    }

    const pin = getStoredOwnerPin();
    const encryptedContent = exportPeriodVouchersBackup(
      filtered3DVouchers,
      filtered2DVouchers,
      filteredFootballSlips,
      periodLabel,
      pin
    );
    const filename = `${appName}_ဘောင်ချာ_${periodLabel.replace(/[/\\?%*:|"<>]/g, '_')}_${todayStr}.rhmg`;
    downloadFile(encryptedContent, filename, 'text/plain;charset=utf-8');
    showMsg(`"${filename}" ဘောင်ချာ Backup ဖိုင် ဒေါင်းလုဒ်ဆွဲပြီးပါပြီ`);
  };

  // Safe PIN-Protected Pruning of Old Settled Vouchers
  const handlePruneOldVouchers = () => {
    setPrunePinError(null);
    if (!verifyOwnerPin(prunePin)) {
      setPrunePinError('Password မှားယွင်းနေပါသည်');
      return;
    }

    try {
      // Delete 3D settled vouchers older than startDate
      const vouchersToDelete3D = lottery3D.vouchers.filter(v => {
        const d = (v.createdAt || '').slice(0, 10);
        return d < startDate && v.status === 'settled';
      });
      vouchersToDelete3D.forEach(v => lottery3D.deleteVoucher(v.id));

      // Delete 2D settled vouchers older than startDate
      const vouchersToDelete2D = lottery2D.vouchers.filter(v => {
        const d = (v.createdAt || '').slice(0, 10);
        return d < startDate && v.status === 'settled';
      });
      vouchersToDelete2D.forEach(v => lottery2D.deleteVoucher(v.id));

      // Delete Football settled slips older than startDate
      const slipsToDeleteFB = football.slips.filter(s => {
        const d = s.roundDate || (s.createdAt || '').slice(0, 10);
        return d < startDate && s.status === 'settled';
      });
      slipsToDeleteFB.forEach(s => football.deleteSlip(s.id));

      const totalDeleted = vouchersToDelete3D.length + vouchersToDelete2D.length + slipsToDeleteFB.length;
      setIsConfirmingPrune(false);
      setPrunePin('');
      showMsg(`${startDate} မတိုင်မီ ရှင်းတမ်းပြီး ဘောင်ချာဟောင်း (${totalDeleted}) စောင်အား အောင်မြင်စွာ ရှင်းလင်းပြီးပါပြီ`);
    } catch {
      showMsg('ရှင်းလင်းရာတွင် ချို့ယွင်းချက်ရှိပါသည်', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-full p-4 sm:p-5 shadow-2xl space-y-3.5 border border-slate-200 max-h-[92vh] flex flex-col justify-between overflow-hidden">
        
        {/* Header with Navigation Tabs */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 leading-tight">
                ဒေတာနှင့် ဘောင်ချာများ သိမ်းဆည်းခြင်း (Backup & Archival)
              </h3>
              <p className="text-[10px] text-slate-500">
                Encrypted Backup နှင့် ကာလအလိုက် ဘောင်ချာများ သိမ်းဆည်းခွင့်
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('master')}
            className={`flex-1 py-1.5 font-bold rounded-lg transition-all cursor-pointer text-center ${
              activeTab === 'master'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ၁။ Master ဒေတာ အပြည့်အစုံ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vouchers')}
            className={`flex-1 py-1.5 font-bold rounded-lg transition-all cursor-pointer text-center ${
              activeTab === 'vouchers'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ၂။ ဘောင်ချာများ ကာလအလိုက် သိမ်းဆည်းရန်
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="space-y-3 overflow-y-auto pr-0.5 text-xs flex-1" {...backupSwipeHandlers}>
          {message && (
            <div
              className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
                message.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{message.text}</span>
            </div>
          )}

          {/* TAB 1: MASTER FULL BACKUP & RESTORE */}
          {activeTab === 'master' && (
            <div className="space-y-3">
              {/* Filename Format & Security Info Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-indigo-600" />
                    Master Backup ဖိုင်အမည် (App_Date_Time):
                  </span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-mono font-bold">
                    .rhmg (Cipher)
                  </span>
                </div>
                <div className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-mono text-indigo-950 font-bold truncate">
                  {previewFilename}
                </div>
                <p className="text-[10px] text-slate-500 leading-tight">
                  * အိုးစည်လေး + ဇီးကွက် + ပစ်တိုင်းထောင် + Settings စာရင်းအားလုံး ၁၀၀% ပါဝင်ပါသည်။
                </p>
              </div>

              {/* Action 1: Export Buttons */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-slate-800 block">
                  ၁။ Master ဒေတာဖိုင် အသစ်သိမ်းဆည်းရန်:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleExportWithLocationPicker}
                    disabled={isSaving}
                    className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98 transition-all"
                    title="ဖုန်းထဲတွင် သင်သိမ်းလိုသော ဖိုဒါနေရာကို တိုက်ရိုက်ရွေးချယ်သိမ်းမည်"
                  >
                    <FolderDown className="w-4 h-4 shrink-0" />
                    <span>နေရာရွေးပြီး သိမ်းမည်</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDirectDownload}
                    disabled={isSaving}
                    className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-98 transition-all"
                    title="Downloads ထဲသို့ တိုက်ရိုက်ဒေါင်းလုဒ်ဆွဲမည်"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>တိုက်ရိုက် Download</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleShareFile}
                  disabled={isSaving}
                  className="w-full p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5 text-slate-600" />
                  <span>ဖုန်း File Manager / Drive / Messenger သို့ ပို့၍သိမ်းမည်</span>
                </button>
              </div>

              {/* Action 2: Restore */}
              <div className="border-t border-slate-100 pt-2.5 space-y-1.5">
                <span className="text-xs font-bold text-slate-800 block">
                  ၂။ သိမ်းထားသောဖိုင်မှ ဒေတာပြန်သွင်းရန် (Restore):
                </span>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".rhmg,.json,.txt,.dat"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div
                  onClick={handleRestoreClick}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-3 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-indigo-50/20 group"
                >
                  <Upload className="w-5 h-5 mx-auto text-slate-400 group-hover:text-indigo-600 transition-colors mb-1" />
                  <div className="text-xs font-bold text-slate-800">
                    .rhmg ဖိုင်အား ဤနေရာတွင် နှိပ်၍ ရွေးချယ်ပါ
                  </div>
                  <p className="text-[10px] text-slate-500">
                    ဖိုင် Password ရှိပါက ရိုက်ထည့်နိုင်ပြီး စာရင်းဒေတာအားလုံး ၁၀၀% အပြည့်အစုံ ပြန်သွင်းပေးမည်
                  </p>
                </div>
              </div>

              {/* Action 3: Import from Excel */}
              <div className="border-t border-slate-100 pt-2.5 space-y-1.5">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>၃။ Excel (.xlsx / .csv) မှ ဘောင်ချာများ ပြန်သွင်းရန်:</span>
                </span>

                <input
                  ref={excelFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelFileChange}
                  className="hidden"
                />

                <div
                  onClick={() => !isImportingExcel && excelFileInputRef.current?.click()}
                  className="border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl p-3 text-center cursor-pointer transition-colors bg-emerald-50/30 hover:bg-emerald-50/60 group"
                >
                  <FileSpreadsheet className="w-5 h-5 mx-auto text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
                  <div className="text-xs font-bold text-emerald-950">
                    {isImportingExcel ? 'Excel ဖိုင် ဖတ်ရှုနေပါသည်...' : 'Excel ဖိုင် (.xlsx, .xls) အား ဤနေရာတွင် ရွေးချယ်ပါ'}
                  </div>
                  <p className="text-[10px] text-emerald-700">
                    ၂D၊ ၃D နှင့် ဘောလုံး ဘောင်ချာစာရင်းများကို လက်ရှိစာရင်းများ မပျက်စေဘဲ ပေါင်းစပ်ထည့်သွင်းပေးပါမည်
                  </p>
                </div>
              </div>

              {/* Action 4: Clean Duplicated Vouchers */}
              <div className="border-t border-slate-100 pt-2.5 space-y-1.5">
                <span className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>၄။ ဘောင်ချာအထပ်များ စစ်ဆေးဖယ်ရှားရန်:</span>
                  </span>
                </span>

                <button
                  type="button"
                  onClick={handleCleanDuplicates}
                  className="w-full p-2.5 rounded-xl border border-amber-300 bg-amber-50/70 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-xs"
                >
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>ထပ်နေသော ဘောင်ချာများ ရှာဖွေဖယ်ရှားမည် (Auto Clean Duplicates)</span>
                </button>
                <p className="text-[10px] text-slate-500">
                  * ဖိုင်သွင်းမိ၍ ဘောင်ချာနှစ်ခါဖြစ်ပြီး ရှင်းတမ်းတွင် ထပ်နေပါက ဤခလုတ်ဖြင့် ချက်ချင်း ဖယ်ရှားရှင်းလင်းနိုင်ပါသည်
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: VOUCHER RETENTION & PERIOD-BASED ARCHIVE */}
          {activeTab === 'vouchers' && (
            <div className="space-y-3">
              {/* Period Filter Presets */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    သိမ်းဆည်းမည့် ဘောင်ချာကာလ ရွေးချယ်ပါ:
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded-md font-bold">
                    {periodLabel}
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {[
                    { id: 'week', label: '၁ ပတ်စာ' },
                    { id: 'two_weeks', label: '၂ ပတ်စာ' },
                    { id: 'month', label: '၁ လစာ' },
                    { id: 'three_months', label: '၃ လစာ' },
                    { id: 'all', label: 'အားလုံး' },
                    { id: 'custom', label: 'စိတ်ကြိုက်' }
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setRetentionPeriod(p.id as any)}
                      className={`py-1.5 px-1 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        retentionPeriod === p.id
                          ? 'bg-indigo-600 text-white shadow-2xs scale-102'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {retentionPeriod === 'custom' && (
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-200 animate-in fade-in">
                    <span className="text-[11px] font-bold text-slate-600">ရက်စွဲ:</span>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                    />
                    <span className="text-slate-400 font-bold">မှ</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800"
                    />
                  </div>
                )}

                {/* Vouchers Count Summary */}
                <div className="grid grid-cols-4 gap-1.5 bg-white p-2 rounded-xl border border-slate-200 text-center">
                  <div>
                    <span className="text-[9px] text-teal-800 font-bold block uppercase">ဇီးကွက် (2D)</span>
                    <span className="font-mono font-black text-teal-900 text-xs">{filtered2DVouchers.length} စောင်</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-indigo-800 font-bold block uppercase">အိုးစည်လေး (3D)</span>
                    <span className="font-mono font-black text-indigo-900 text-xs">{filtered3DVouchers.length} စောင်</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-emerald-800 font-bold block uppercase">ပစ်တိုင်းထောင်</span>
                    <span className="font-mono font-black text-emerald-900 text-xs">{filteredFootballSlips.length} စောင်</span>
                  </div>
                  <div className="bg-slate-900 text-white rounded-lg p-1">
                    <span className="text-[9px] text-slate-300 font-bold block uppercase">စုစုပေါင်း</span>
                    <span className="font-mono font-black text-teal-400 text-xs">{totalFilteredCount} စောင်</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons for Period Vouchers */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-800 block">
                  ဘောင်ချာများ ထုတ်ယူ/သိမ်းဆည်းရန် နည်းလမ်းများ:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Export to Excel */}
                  <button
                    type="button"
                    onClick={handleExportPeriodVouchersExcel}
                    className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98 transition-all text-left"
                  >
                    <FileSpreadsheet className="w-4 h-4 shrink-0" />
                    <div>
                      <span className="block text-xs">Excel ဖိုင်ဖြင့် ထုတ်ယူသိမ်းမည်</span>
                      <span className="text-[10px] text-emerald-100 font-medium">{periodLabel} စာရင်းဇယား (.xlsx)</span>
                    </div>
                  </button>

                  {/* Export to Encrypted .rhmg Archive */}
                  <button
                    type="button"
                    onClick={handleExportPeriodVouchersArchive}
                    className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98 transition-all text-left"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <div>
                      <span className="block text-xs">သီးသန့် Backup ဖိုင် ဒေါင်းလုဒ်</span>
                      <span className="text-[10px] text-indigo-100 font-medium">Encrypted Archive (.rhmg)</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Safe Pruning of Old Settled Vouchers */}
              <div className="border-t border-slate-200 pt-3 space-y-2">
                {!isConfirmingPrune ? (
                  <div className="flex items-center justify-between gap-3 bg-amber-50/70 border border-amber-200 rounded-xl p-2.5">
                    <div>
                      <h5 className="font-bold text-amber-950 text-xs">ဟောင်းနွမ်းသော ဘောင်ချာများ ရှင်းလင်းလိုပါသလား။</h5>
                      <p className="text-[10px] text-amber-800">
                        {retentionPeriod === 'all'
                          ? 'ရှင်းတမ်းပြီး ဘောင်ချာများကိုသာ ရှင်းလင်းနိုင်ပါသည်'
                          : `${startDate} မတိုင်မီ ရှင်းတမ်းပြီး ဘောင်ချာဟောင်းများကိုသာ ဖျက်သိမ်းပါမည်`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingPrune(true)}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg cursor-pointer transition-colors shadow-2xs shrink-0 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ရှင်းလင်းမည်</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-300 rounded-2xl p-3.5 space-y-2 animate-in fade-in">
                    <div className="flex items-center gap-2 text-slate-800 font-bold">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>ဘောင်ချာဟောင်းများ ရှင်းလင်းရန် ဆက်တင်လျှို့ဝှက်နံပါတ် (PIN) လိုအပ်ပါသည်</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <input
                        type="password"
                        placeholder="လျှို့ဝှက်နံပါတ် ရိုက်ထည့်ပါ"
                        value={prunePin}
                        onChange={(e) => { setPrunePin(e.target.value); setPrunePinError(null); }}
                        className="flex-1 bg-white border border-slate-300 focus:border-amber-500 rounded-xl px-3 py-1.5 outline-none font-bold text-slate-900 shadow-2xs text-xs"
                      />
                      <button
                        type="button"
                        onClick={handlePruneOldVouchers}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl cursor-pointer shadow-xs text-xs"
                      >
                        အတည်ပြုရှင်းလင်းမည်
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsConfirmingPrune(false); setPrunePin(''); setPrunePinError(null); }}
                        className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl cursor-pointer text-xs"
                      >
                        မရှင်းတော့ပါ
                      </button>
                    </div>

                    {prunePinError && (
                      <p className="text-xs text-rose-600 font-bold flex items-center gap-1">
                        ⚠️ {prunePinError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
          >
            ပိတ်မည် (Close)
          </button>
        </div>

      </div>

      {/* Password Prompt Modal for Encrypted Backup Restore */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-5 text-white shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-black text-sm text-white">Backup Password ရိုက်ထည့်ပါ</h4>
                <p className="text-[11px] text-slate-400">ဖိုင်ထုတ်ယူစဉ်က သတ်မှတ်ခဲ့သော ဂဏန်း ၆ လုံး</p>
              </div>
            </div>

            {restorePinError && (
              <div className="p-2.5 bg-rose-950/90 border border-rose-700 text-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{restorePinError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-300">
                လျှို့ဝှက်နံပါတ် (Password ၆ လုံး):
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={restorePinInput}
                onChange={(e) => {
                  setRestorePinInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setRestorePinError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmRestorePin();
                }}
                placeholder="ဂဏန်း ၆ လုံး"
                className="w-full bg-slate-800 border-2 border-slate-700 focus:border-indigo-500 rounded-2xl p-2.5 text-center font-mono font-black text-lg tracking-widest text-white outline-none shadow-inner"
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setPendingFileContent(null);
                  setRestorePinInput('');
                  setRestorePinError(null);
                }}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
              >
                မသွင်းတော့ပါ
              </button>
              <button
                type="button"
                onClick={handleConfirmRestorePin}
                disabled={restorePinInput.trim().length !== 6}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95"
              >
                အတည်ပြု သွင်းမည်
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
