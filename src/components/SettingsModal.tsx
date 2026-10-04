import React, { useState } from 'react';
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
  FileCheck2
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { BookieMode } from '../types';

import { EnabledModes, saveEnabledModes, saveOwnerPin, verifyOwnerPin, getStoredOwnerPin } from '../utils/securityUtils';
import { exportSecureMasterBackup, restoreSecureMasterBackup, downloadFile, getBackupFileName } from '../utils/backupUtils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: '3d' | '2d' | 'football' | 'general' | 'backup';
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

  const [activeTab, setActiveTab] = useState<'3d' | '2d' | 'football' | 'general' | 'backup'>(initialTab);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [backupMsg, setBackupMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const backupFileInputRef = React.useRef<HTMLInputElement>(null);

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
  const [address3D, setAddress3D] = useState(lottery3D.settings.shopAddress || '');
  const [mult3D, setMult3D] = useState(String(lottery3D.settings.defaultMultiplier || 600));
  const [todd3D, setTodd3D] = useState(String(lottery3D.settings.defaultToddMultiplier || 100));
  const [comm3D, setComm3D] = useState(String(lottery3D.settings.defaultCommissionRate || 10));
  const [disc3D, setDisc3D] = useState(String(lottery3D.settings.defaultCustomerDiscount || 0));
  const [footer3D, setFooter3D] = useState(lottery3D.settings.voucherFooterMessage || '');

  // 2D Form State
  const [name2D, setName2D] = useState(lottery2D.settings.appName || 'ရွှေမင်္ဂလာ');
  const [shop2D, setShop2D] = useState(lottery2D.settings.shopName || '');
  const [phone2D, setPhone2D] = useState(lottery2D.settings.shopPhone || '');
  const [address2D, setAddress2D] = useState(lottery2D.settings.shopAddress || '');
  const [mult2D, setMult2D] = useState(String(lottery2D.settings.defaultMultiplier || 85));
  const [comm2D, setComm2D] = useState(String(lottery2D.settings.defaultCommissionRate || 12));
  const [disc2D, setDisc2D] = useState(String(lottery2D.settings.defaultCustomerDiscount || 0));
  const [limit2D, setLimit2D] = useState(String(lottery2D.settings.globalStockLimit || 200000));
  const [footer2D, setFooter2D] = useState(lottery2D.settings.voucherFooterMessage || '');

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

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Save 3D
    lottery3D.updateSettings({
      appName: name3D.trim() || '3D Ledger Pro',
      shopName: shop3D.trim(),
      shopPhone: phone3D.trim(),
      shopAddress: address3D.trim(),
      currency,
      defaultMultiplier: parseInt(mult3D, 10) || 600,
      defaultToddMultiplier: parseInt(todd3D, 10) || 100,
      defaultCommissionRate: parseInt(comm3D, 10) || 10,
      defaultCustomerDiscount: parseInt(disc3D, 10) || 0,
      voucherFooterMessage: footer3D.trim()
    });

    // 2. Save 2D
    lottery2D.updateSettings({
      appName: name2D.trim() || '2D Ledger Pro',
      shopName: shop2D.trim(),
      shopPhone: phone2D.trim(),
      shopAddress: address2D.trim(),
      currency,
      defaultMultiplier: parseFloat(mult2D) || 85,
      defaultCommissionRate: parseFloat(comm2D) || 12,
      defaultCustomerDiscount: parseFloat(disc2D) || 0,
      globalStockLimit: parseFloat(limit2D) || 200000,
      voucherFooterMessage: footer2D.trim()
    });

    // 3. Save Football
    football.updateSettings({
      appName: nameFB.trim() || 'Football Ledger Pro',
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center font-bold border border-slate-700">
              <Settings className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                အက်ပ် အပြင်အဆင်နှင့် စာရင်းခေါင်းစဉ်များ စီမံခန့်ခွဲခြင်း
              </h3>
              <p className="text-xs text-slate-400">
                အိုးစည်လေး၊ ဇီးကွက် နှင့် ပစ်တိုင်းထောင် အသီးသီးအတွက် အမည်၊ ပေါက်ဆ၊ ကော်မရှင်များ သီးခြား ပြင်ဆင်နိုင်ပါသည်
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2 flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('3d')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === '3d'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>အိုးစည်လေး (3D)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('2d')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === '2d'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>ဇီးကွက် (2D)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('football')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'football'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>ပစ်တိုင်းထောင် (Football)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'general'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <span>အထွေထွေ (General)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'backup'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>ဖိုင်သိမ်း/ပြန်သွင်း (Backup)</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveAll} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB: 3D Settings */}
          {activeTab === '3d' && (
            <div className="space-y-4">
              <div className="bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100 space-y-3">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                  <Store className="w-4 h-4 text-indigo-600" />
                  <span>အိုးစည်လေး စာရင်းခေါင်းစဉ်နှင့် အချက်အလက် (Line 1 Profile)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      အက်ပ်ခေါင်းစဉ်အမည်:
                    </label>
                    <input
                      type="text"
                      value={name3D}
                      onChange={(e) => setName3D(e.target.value)}
                      placeholder="ရွှေမင်္ဂလာ စီမံခန့်ခွဲမှုစနစ်"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ဆိုင်ခွဲ / ဌာနအမည်:
                    </label>
                    <input
                      type="text"
                      value={shop3D}
                      onChange={(e) => setShop3D(e.target.value)}
                      placeholder="ရွှေမင်္ဂလာ စာရင်းဌာန"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ဆက်သွယ်ရန်ဖုန်း:
                    </label>
                    <input
                      type="text"
                      value={phone3D}
                      onChange={(e) => setPhone3D(e.target.value)}
                      placeholder="09-xxxxxxx"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      လိပ်စာ (ပြေစာတွင် ပြသရန်):
                    </label>
                    <input
                      type="text"
                      value={address3D}
                      onChange={(e) => setAddress3D(e.target.value)}
                      placeholder="ရန်ကုန်မြို့ / မန္တလေးမြို့"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">အိုးစည်လေး အလျော်ဆနှင့် ကော်မရှင် သတ်မှတ်ချက်များ:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      တည့်အဆ (ဆ)
                    </label>
                    <input
                      type="number"
                      value={mult3D}
                      onChange={(e) => setMult3D(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      ပတ်လည်အဆ (ဆ)
                    </label>
                    <input
                      type="number"
                      value={todd3D}
                      onChange={(e) => setTodd3D(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      ဒိုင်ကော်မရှင် (%)
                    </label>
                    <input
                      type="number"
                      value={comm3D}
                      onChange={(e) => setComm3D(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      ဖောက်သည်လျော့ (%)
                    </label>
                    <input
                      type="number"
                      value={disc3D}
                      onChange={(e) => setDisc3D(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    ပြေစာအောက်ခြေ မှတ်ချက်:
                  </label>
                  <input
                    type="text"
                    value={footer3D}
                    onChange={(e) => setFooter3D(e.target.value)}
                    placeholder="လာဘ်လာဘ ရွှင်လန်းပါစေ။ ကျေးဇူးတင်ပါသည်။"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: 2D Settings */}
          {activeTab === '2d' && (
            <div className="space-y-4">
              <div className="bg-teal-50/60 p-4 rounded-2xl border border-teal-100 space-y-3">
                <div className="flex items-center gap-2 text-teal-900 font-bold text-xs">
                  <Store className="w-4 h-4 text-teal-600" />
                  <span>ဇီးကွက် စာရင်းခေါင်းစဉ်နှင့် အချက်အလက် (Line 2 Profile)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      အက်ပ်ခေါင်းစဉ်အမည်:
                    </label>
                    <input
                      type="text"
                      value={name2D}
                      onChange={(e) => setName2D(e.target.value)}
                      placeholder="ရွှေမင်္ဂလာ စီမံခန့်ခွဲမှုစနစ်"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-teal-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ဆိုင်ခွဲ / ဌာနအမည်:
                    </label>
                    <input
                      type="text"
                      value={shop2D}
                      onChange={(e) => setShop2D(e.target.value)}
                      placeholder="ရွှေမင်္ဂလာ စာရင်းဌာန"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ဆက်သွယ်ရန်ဖုန်း:
                    </label>
                    <input
                      type="text"
                      value={phone2D}
                      onChange={(e) => setPhone2D(e.target.value)}
                      placeholder="09-xxxxxxx"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-500 shadow-2xs"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      လိပ်စာ (ပြေစာတွင် ပြသရန်):
                    </label>
                    <input
                      type="text"
                      value={address2D}
                      onChange={(e) => setAddress2D(e.target.value)}
                      placeholder="ရန်ကုန်မြို့ / မန္တလေးမြို့"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-500 shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">ဇီးကွက် အလျော်ဆနှင့် သတ်မှတ်ချက်များ:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      အလျော်ဆ (ဆ)
                    </label>
                    <input
                      type="number"
                      value={mult2D}
                      onChange={(e) => setMult2D(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      ဒိုင်ကော်မရှင် (%)
                    </label>
                    <input
                      type="number"
                      value={comm2D}
                      onChange={(e) => setComm2D(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      ဖောက်သည်လျော့ (%)
                    </label>
                    <input
                      type="number"
                      value={disc2D}
                      onChange={(e) => setDisc2D(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      ပုံသေကန့်သတ်ကြေး (Ks)
                    </label>
                    <input
                      type="number"
                      value={limit2D}
                      onChange={(e) => setLimit2D(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    ပြေစာအောက်ခြေ မှတ်ချက်:
                  </label>
                  <input
                    type="text"
                    value={footer2D}
                    onChange={(e) => setFooter2D(e.target.value)}
                    placeholder="လာဘ်လာဘ ရွှင်လန်းပါစေ။ ကျေးဇူးတင်ပါသည်။"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: Football Settings */}
          {activeTab === 'football' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100 space-y-3">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                  <Store className="w-4 h-4 text-emerald-600" />
                  <span>ပစ်တိုင်းထောင် စာရင်းခေါင်းစဉ်နှင့် အချက်အလက် (Line 3 Profile)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      အက်ပ်ခေါင်းစဉ်အမည်:
                    </label>
                    <input
                      type="text"
                      value={nameFB}
                      onChange={(e) => setNameFB(e.target.value)}
                      placeholder="ရွှေမင်္ဂလာ စီမံခန့်ခွဲမှုစနစ်"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ဆိုင်ခွဲ / ဌာနအမည်:
                    </label>
                    <input
                      type="text"
                      value={shopFB}
                      onChange={(e) => setShopFB(e.target.value)}
                      placeholder="ရွှေမင်္ဂလာ စာရင်းဌာန"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      ဆက်သွယ်ရန်ဖုန်း:
                    </label>
                    <input
                      type="text"
                      value={phoneFB}
                      onChange={(e) => setPhoneFB(e.target.value)}
                      placeholder="09-xxxxxxx"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-500 shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">ပစ်တိုင်းထောင် သတ်မှတ်ချက်များ:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      ဒိုင်ကော်မရှင် (%)
                    </label>
                    <input
                      type="number"
                      value={commFB}
                      onChange={(e) => setCommFB(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      ဖောက်သည်လျော့ (%)
                    </label>
                    <input
                      type="number"
                      value={discFB}
                      onChange={(e) => setDiscFB(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      အမြင့်ဆုံးလျော်ငွေကန့်သတ် (Ks)
                    </label>
                    <input
                      type="number"
                      value={maxPayoutFB}
                      onChange={(e) => setMaxPayoutFB(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    ပြေစာအောက်ခြေ မှတ်ချက်:
                  </label>
                  <input
                    type="text"
                    value={footerFB}
                    onChange={(e) => setFooterFB(e.target.value)}
                    placeholder="လာဘ်လာဘ ရွှင်လန်းပါစေ။ ကျေးဇူးတင်ပါသည်။"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              
              {/* Business Modes Master Switch */}
              <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 space-y-3">
                <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>လုပ်ငန်းအမျိုးအစားများ မာစတာ စဝစ်ချ် (Enable / Disable Businesses)</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  ပိုင်ရှင် မလုပ်ကိုင်သော လုပ်ငန်းများကို ပိတ်ထားပါက အက်ပ်မီနူးတွင် လုံးဝ ပေါ်လာတော့မည် မဟုတ်ပါ။
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    localModes['3d'] ? 'bg-white border-indigo-500 font-bold text-indigo-950 shadow-2xs' : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}>
                    <div className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={localModes['3d']}
                        onChange={(e) => {
                          const next = { ...localModes, '3d': e.target.checked };
                          if (next['3d'] || next['2d'] || next['football']) setLocalModes(next);
                        }}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>အိုးစည်လေး (3D)</span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    localModes['2d'] ? 'bg-white border-teal-500 font-bold text-teal-950 shadow-2xs' : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}>
                    <div className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={localModes['2d']}
                        onChange={(e) => {
                          const next = { ...localModes, '2d': e.target.checked };
                          if (next['3d'] || next['2d'] || next['football']) setLocalModes(next);
                        }}
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span>ဇီးကွက် (2D)</span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    localModes['football'] ? 'bg-white border-emerald-500 font-bold text-emerald-950 shadow-2xs' : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}>
                    <div className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={localModes['football']}
                        onChange={(e) => {
                          const next = { ...localModes, 'football': e.target.checked };
                          if (next['3d'] || next['2d'] || next['football']) setLocalModes(next);
                        }}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>ပစ်တိုင်းထောင် (FB)</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Change Owner PIN Code */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                  <KeyRound className="w-4 h-4 text-indigo-600" />
                  <span>ပိုင်ရှင် လုံခြုံရေး PIN Code ပြောင်းလဲရန် (ဂဏန်း ၆ လုံး)</span>
                </div>

                {pinStatusMsg && (
                  <div className={`p-2.5 rounded-xl text-xs font-bold ${
                    pinStatusMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}>
                    {pinStatusMsg.text}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      ယခင် PIN မူလ:
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={oldPin}
                      onChange={(e) => setOldPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      onFocus={(e) => e.target.select()}
                      placeholder="••••••"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-mono text-center font-bold text-slate-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      PIN အသစ် (၆ လုံး):
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      onFocus={(e) => e.target.select()}
                      placeholder="••••••"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-mono text-center font-bold text-slate-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      PIN အသစ် အတည်ပြုပါ:
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={confirmNewPin}
                      onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      onFocus={(e) => e.target.select()}
                      placeholder="••••••"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-sm font-mono text-center font-bold text-slate-900 outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPinStatusMsg(null);
                      if (!verifyOwnerPin(oldPin)) {
                        setPinStatusMsg({ type: 'error', text: 'ယခင် PIN မူလ မှားယွင်းနေပါသည်!' });
                        return;
                      }
                      if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
                        setPinStatusMsg({ type: 'error', text: 'PIN အသစ်သည် ဂဏန်း ၆ လုံး တိတိကျကျ ဖြစ်ရပါမည်' });
                        return;
                      }
                      if (newPin !== confirmNewPin) {
                        setPinStatusMsg({ type: 'error', text: 'PIN အသစ်နှစ်ခု တူညီမှုမရှိပါ!' });
                        return;
                      }
                      if (saveOwnerPin(newPin)) {
                        setPinStatusMsg({ type: 'success', text: 'PIN အသစ်အား အောင်မြင်စွာ ပြောင်းလဲပြီးပါပြီ' });
                        setOldPin('');
                        setNewPin('');
                        setConfirmNewPin('');
                      }
                    }}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs cursor-pointer"
                  >
                    PIN အသစ် ပြောင်းမည်
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">အထွေထွေ ငွေကြေးသတ်မှတ်ချက်:</span>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ငွေကြေး သင်္ကေတ (Currency Symbol):
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none"
                  >
                    <option value="Ks">Ks (ကျပ်ငွေ)</option>
                    <option value="MMK">MMK</option>
                    <option value="THB">THB (ဘတ်)</option>
                    <option value="$">USD ($)</option>
                  </select>
                </div>
              </div>

              {/* Reset Data options */}
              <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-bold text-rose-900 block">ဒေတာ အစမှပြန်စတင်ခြင်း (Reset):</span>
                <p className="text-[11px] text-rose-700">
                  စမ်းသပ်ဒေတာများ ပြန်ဖြည့်သွင်းလိုပါက သို့မဟုတ် စာရင်းအသစ် စတင်လိုပါက အသုံးပြုနိုင်ပါသည်။
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('၃ လုံး နမူနာဒေတာများ ပြန်လည်ဖြည့်သွင်းလိုပါသလား?')) {
                        lottery3D.resetToSampleData();
                        onClose();
                      }
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-indigo-700 text-xs rounded-xl font-bold cursor-pointer shadow-2xs"
                  >
                    ၃ လုံး နမူနာဒေတာ ပြန်ဖြည့်မည်
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('၂ လုံး နမူနာဒေတာများ ပြန်လည်ဖြည့်သွင်းလိုပါသလား?')) {
                        lottery2D.resetToSampleData();
                        onClose();
                      }
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-teal-700 text-xs rounded-xl font-bold cursor-pointer shadow-2xs"
                  >
                    ၂ လုံး နမူနာဒေတာ ပြန်ဖြည့်မည်
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('ဘောလုံး နမူနာဒေတာများ ပြန်လည်ဖြည့်သွင်းလိုပါသလား?')) {
                        football.resetToSampleData();
                        onClose();
                      }
                    }}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-emerald-700 text-xs rounded-xl font-bold cursor-pointer shadow-2xs"
                  >
                    ဘောလုံး နမူနာဒေတာ ပြန်ဖြည့်မည်
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: Backup & Restore */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              
              {backupMsg && (
                <div
                  className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
                    backupMsg.type === 'error'
                      ? 'bg-rose-50 text-rose-800 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{backupMsg.text}</span>
                </div>
              )}

              {/* Encryption Security Badge */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-950 font-bold text-xs">
                  <Lock className="w-4 h-4 text-indigo-600" />
                  <span>သီးသန့် လျှို့ဝှက်ကုဒ်သုံး ဒေတာသိမ်းဆည်းမှု (Encrypted Cipher Backup)</span>
                </div>
                <p className="text-[11px] text-indigo-900 leading-relaxed">
                  ဤအက်ပ်မှ ထုတ်ယူသော ဒေတာဖိုင်အား လူတိုင်းဖတ်ရှု၍ မရနိုင်ပါ။ <b>ရွှေမင်္ဂလာ</b> စာရင်းစနစ်ဖြင့်သာ စစ်ဆေးအတည်ပြုပြီး ၁၀၀% ဒေတာအားလုံး ပြန်လည်သွင်းယူနိုင်ပါမည်။
                </p>
              </div>

              {/* Export Button */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">
                  ၁။ Master Backup ဖိုင် ထုတ်ယူသိမ်းဆည်းရန်:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const pin = getStoredOwnerPin();
                    const encrypted = exportSecureMasterBackup(pin);
                    const filename = getBackupFileName('shwemingalar_encrypted_backup', 'rhmg');
                    downloadFile(encrypted, filename);
                    setBackupMsg({
                      type: 'success',
                      text: 'အိုးစည်လေး + ဇီးကွက် + ပစ်တိုင်းထောင် + ဆက်တင် အားလုံးပါဝင်သော Encrypted Master Backup ဖိုင် ထုတ်ယူပြီးပါပြီ'
                    });
                  }}
                  className="w-full p-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-left transition-all cursor-pointer flex items-center justify-between shadow-md active:scale-98"
                >
                  <div>
                    <span className="font-black text-xs block">Encrypted Backup ဖိုင် ထုတ်ယူမည် (.rhmg)</span>
                    <span className="text-[11px] text-slate-300">
                      ၃ လုံး၊ ၂ လုံး၊ ဘောလုံး၊ ဆက်တင်၊ Viber ဒေတာ အပြည့်အစုံ
                    </span>
                  </div>
                  <Download className="w-5 h-5 text-indigo-400 shrink-0" />
                </button>
              </div>

              {/* Restore Section */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-xs font-bold text-slate-800 block">
                  ၂။ သိမ်းဆည်းထားသော ဖိုင်မှ ပြန်လည်သွင်းယူရန် (Restore from .rhmg / .json):
                </span>

                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept=".rhmg,.json,.txt,.dat"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const content = event.target?.result as string;
                      const pin = getStoredOwnerPin();
                      const res = restoreSecureMasterBackup(content, pin);
                      if (res.success) {
                        setBackupMsg({ type: 'success', text: `${res.message}။ အက်ပ်အား Refresh လုပ်ပါမည်...` });
                        setTimeout(() => window.location.reload(), 1500);
                      } else {
                        setBackupMsg({ type: 'error', text: res.message || 'ဖိုင်ဖတ်ရှုမှု မအောင်မြင်ပါ' });
                      }
                    };
                    reader.readAsText(file);
                    if (backupFileInputRef.current) backupFileInputRef.current.value = '';
                  }}
                  className="hidden"
                />

                <div
                  onClick={() => backupFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-5 text-center cursor-pointer transition-colors space-y-2 bg-white group"
                >
                  <Upload className="w-7 h-7 mx-auto text-slate-400 group-hover:text-indigo-600 transition-colors" />
                  <div className="text-xs font-bold text-slate-800">
                    သိမ်းဆည်းထားသော .rhmg ဖိုင်အား ဤနေရာတွင် နှိပ်၍ ရွေးချယ်ပါ
                  </div>
                  <p className="text-[11px] text-slate-500">
                    စနစ်မှ လျှို့ဝှက်ကုဒ်အား အလိုအလျောက် ဖြည်ချပြီး ဒေတာအားလုံး ပြန်လည်သွင်းပေးပါမည်
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* Action Footer */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              ပိတ်မည်
            </button>

            <button
              type="submit"
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>သိမ်းဆည်းပြီးပါပြီ</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>သိမ်းဆည်းမည် (Save Settings)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
