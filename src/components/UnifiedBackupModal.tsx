import React, { useState, useRef } from 'react';
import {
  Download,
  Upload,
  Database,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FolderDown,
  X,
  ShieldCheck,
  HardDrive
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import {
  downloadJSONFile,
  getBackupFileName,
  exportUnifiedMasterBackup,
  restoreUnifiedMasterBackup
} from '../utils/backupUtils';

interface UnifiedBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UnifiedBackupModal: React.FC<UnifiedBackupModalProps> = ({ isOpen, onClose }) => {
  const { exportJSONBackup: export3D, importJSONBackup: import3D } = useLottery();
  const { exportJSONBackup: export2D, importJSONBackup: import2D } = useTwoDLottery();
  const { exportJSONBackup: exportFB, importJSONBackup: importFB } = useFootball();

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importTarget, setImportTarget] = useState<'auto' | '3d' | '2d' | 'football' | 'master'>('auto');

  if (!isOpen) return null;

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleExport3D = () => {
    const json = export3D();
    const filename = getBackupFileName('lottery_3d_backup');
    downloadJSONFile(json, filename);
    showMsg('အိုးစည်လေး (3D) ဒေတာဖိုင်အား သီးသန့်သိမ်းဆည်းပြီးပါပြီ');
  };

  const handleExport2D = () => {
    const json = export2D();
    const filename = getBackupFileName('lottery_2d_backup');
    downloadJSONFile(json, filename);
    showMsg('ဇီးကွက် (2D) ဒေတာဖိုင်အား သီးသန့်သိမ်းဆည်းပြီးပါပြီ');
  };

  const handleExportFootball = () => {
    const json = exportFB();
    const filename = getBackupFileName('football_betting_backup');
    downloadJSONFile(json, filename);
    showMsg('ပစ်တိုင်းထောင် (Football) ဒေတာဖိုင်အား သီးသန့်သိမ်းဆည်းပြီးပါပြီ');
  };

  const handleExportMaster = () => {
    const json = exportUnifiedMasterBackup();
    const filename = getBackupFileName('master_unified_ledger_all');
    downloadJSONFile(json, filename);
    showMsg('အိုးစည်လေး + ဇီးကွက် + ပစ်တိုင်းထောင် အားလုံးပါဝင်သော Master Backup အား သိမ်းဆည်းပြီးပါပြီ');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // Auto detection or target based
        if (parsed.storageType === '3D_LOTTERY_ISOLATED' || importTarget === '3d') {
          const ok = import3D(content);
          if (ok) {
            showMsg('၃ လုံး (3D) ဒေတာများ အောင်မြင်စွာ ပြန်လည်သွင်းယူပြီးပါပြီ');
            return;
          }
        }

        if (parsed.storageType === '2D_LOTTERY_ISOLATED' || importTarget === '2d') {
          const ok = import2D(content);
          if (ok) {
            showMsg('၂ လုံး (2D) ဒေတာများ အောင်မြင်စွာ ပြန်လည်သွင်းယူပြီးပါပြီ');
            return;
          }
        }

        if (parsed.storageType === 'FOOTBALL_BETTING_ISOLATED' || importTarget === 'football') {
          const ok = importFB(content);
          if (ok) {
            showMsg('ဘောလုံး (Football) ဒေတာများ အောင်မြင်စွာ ပြန်လည်သွင်းယူပြီးပါပြီ');
            return;
          }
        }

        if (parsed.storageType === 'UNIFIED_MASTER_BACKUP' || importTarget === 'master' || parsed.modules) {
          const ok = restoreUnifiedMasterBackup(content);
          if (ok) {
            showMsg('Master Backup ဒေတာအားလုံး ပြန်လည်သွင်းယူပြီးပါပြီ။ App အား Refresh လုပ်ပါမည်');
            setTimeout(() => window.location.reload(), 1500);
            return;
          }
        }

        // Fallback trial
        if (import3D(content)) {
          showMsg('၃ လုံး ဒေတာ ပြန်လည်သွင်းယူပြီးပါပြီ');
        } else {
          showMsg('ဖိုင်ဖတ်ရှုမှု မအောင်မြင်ပါ', 'error');
        }
      } catch (err) {
        console.error(err);
        showMsg('ဖိုင်မှားယွင်းနေပါသည်', 'error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                လယ်ဂျာ သီးသန့် ဖိုင်သိမ်းဆည်းမှု (Data Backup & Restore)
              </h3>
              <p className="text-xs text-slate-500">
                ၃ လုံး၊ ၂ လုံး၊ ဘောလုံး လယ်ဂျာတစ်ခုချင်းစီအား သီးခြားလမ်းကြောင်းဖြင့် သိမ်းဆည်းနိုင်ပါသည်
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {message && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
              message.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message.text}</span>
          </div>
        )}

        {/* Export Buttons Section */}
        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-700 block">
            ဒေတာဖိုင် သီးခြား ထုတ်ယူသိမ်းဆည်းရန် (Backup Export):
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 3D Export */}
            <button
              type="button"
              onClick={handleExport3D}
              className="p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/60 text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-xs text-indigo-900 block">၃ လုံး (3D Ledger) ဖိုင်</span>
                <span className="text-[10px] text-indigo-700">lottery_3d_backup_*.json</span>
              </div>
              <Download className="w-4 h-4 text-indigo-700 shrink-0" />
            </button>

            {/* 2D Export */}
            <button
              type="button"
              onClick={handleExport2D}
              className="p-3.5 rounded-2xl border border-teal-200 bg-teal-50/50 hover:bg-teal-100/60 text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-xs text-teal-900 block">၂ လုံး (2D Ledger) ဖိုင်</span>
                <span className="text-[10px] text-teal-700">lottery_2d_backup_*.json</span>
              </div>
              <Download className="w-4 h-4 text-teal-700 shrink-0" />
            </button>

            {/* Football Export */}
            <button
              type="button"
              onClick={handleExportFootball}
              className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/60 text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-xs text-emerald-900 block">ဘောလုံး (Football) ဖိုင်</span>
                <span className="text-[10px] text-emerald-700">football_betting_backup_*.json</span>
              </div>
              <Download className="w-4 h-4 text-emerald-700 shrink-0" />
            </button>

            {/* Master Unified Export */}
            <button
              type="button"
              onClick={handleExportMaster}
              className="p-3.5 rounded-2xl border border-slate-300 bg-slate-900 hover:bg-slate-800 text-white text-left transition-all cursor-pointer flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-xs block">Master Backup (အားလုံးပေါင်း)</span>
                <span className="text-[10px] text-slate-300">3D + 2D + Football All-in-One</span>
              </div>
              <Download className="w-4 h-4 text-slate-300 shrink-0" />
            </button>
          </div>
        </div>

        {/* Restore Section */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <span className="text-xs font-bold text-slate-700 block">
            သိမ်းဆည်းထားသော ဖိုင်မှ ပြန်လည်သွင်းယူရန် (Restore from JSON):
          </span>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-6 text-center cursor-pointer transition-colors space-y-2 bg-slate-50/50"
          >
            <Upload className="w-7 h-7 mx-auto text-slate-400" />
            <div className="text-xs font-bold text-slate-800">
              သိမ်းဆည်းထားသော .json ဖိုင်အား ဤနေရာတွင် နှိပ်၍ ရွေးချယ်ပါ
            </div>
            <p className="text-[11px] text-slate-400">
              စနစ်မှ မည်သည့်လယ်ဂျာဖိုင်ဖြစ်သည်ကို အလိုအလျောက် ခွဲခြားသိရှိပါမည်
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
          >
            ပိတ်မည်
          </button>
        </div>
      </div>
    </div>
  );
};
