import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  Database,
  CheckCircle2,
  X,
  ShieldCheck,
  Lock,
  FolderDown,
  Share2,
  FileSpreadsheet,
  Layers,
  Sparkles
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import {
  getBackupFileName,
  exportSecureMasterBackup,
  restoreSecureMasterBackup,
  saveFileWithCustomLocation,
  shareFileDirectly,
  downloadFile
} from '../utils/backupUtils';
import { getStoredOwnerPin } from '../utils/securityUtils';

interface UnifiedBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UnifiedBackupModal: React.FC<UnifiedBackupModalProps> = ({ isOpen, onClose }) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  const appName = lottery3D.settings.appName || lottery2D.settings.appName || football.settings.appName || 'ရွှေမင်္ဂလာ';

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [includePinProtection, setIncludePinProtection] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  // Preview current filename format: <AppName>_<YYYY-MM-DD>_<HH-MM-SS>.rhmg
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
    } catch (err: any) {
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
    } catch (err) {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const currentPin = getStoredOwnerPin();

        const result = restoreSecureMasterBackup(content, currentPin);
        if (result.success) {
          showMsg(`${result.message}။ ဒေတာများ Update ပြုလုပ်ရန် ခေတ္တစောင့်ပါ...`);
          setTimeout(() => window.location.reload(), 1500);
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-5 shadow-2xl space-y-3.5 border border-slate-200 max-h-[92vh] flex flex-col justify-between overflow-hidden">
        
        {/* Header - Compact */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 leading-tight">
                ဒေတာဖိုင် သိမ်းဆည်း/ပြန်သွင်းခြင်း (Backup & Restore)
              </h3>
              <p className="text-[10px] text-slate-500">
                လုံခြုံစိတ်ချရသော Encrypted .rhmg ဖိုင်စနစ်
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

        {/* Scrollable / Compact Body */}
        <div className="space-y-3 overflow-y-auto pr-0.5 text-xs">
          {message && (
            <div
              className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
                message.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{message.text}</span>
            </div>
          )}

          {/* Filename Format & Security Info Card - Sleek */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-indigo-600" />
                ဖိုင်အမည် ပုံစံသတ်မှတ်ချက် (App_Date_Time):
              </span>
              <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded font-mono font-bold">
                .rhmg (Cipher)
              </span>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-mono text-indigo-950 font-bold truncate">
              {previewFilename}
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              * အိုးစည်လေး + ဇီးကွက် + ပစ်တိုင်းထောင် + Settings + Viber စာရင်းအားလုံး ၁၀၀% ပါဝင်ပါသည်။
            </p>
          </div>

          {/* Action 1: Export Buttons - Compact Grid */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-800 block">
              ၁။ ဒေတာဖိုင် အသစ်သိမ်းဆည်းရန်:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Custom Location Picker */}
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

              {/* Direct Download */}
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

            {/* Mobile Share Option */}
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

          {/* Action 2: Restore - Compact Box */}
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
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-3 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-indigo-50/20 group"
            >
              <Upload className="w-5 h-5 mx-auto text-slate-400 group-hover:text-indigo-600 transition-colors mb-1" />
              <div className="text-xs font-bold text-slate-800">
                .rhmg ဖိုင်အား ဤနေရာတွင် နှိပ်၍ ရွေးချယ်ပါ
              </div>
              <p className="text-[10px] text-slate-500">
                လျှို့ဝှက်ကုဒ်အား အလိုအလျောက် ဖြည်ချပြီး ဒေတာအားလုံး ပြန်သွင်းပေးမည်
              </p>
            </div>
          </div>
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
    </div>
  );
};
