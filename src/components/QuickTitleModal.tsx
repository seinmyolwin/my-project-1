import React, { useState } from 'react';
import { X, Check, Store } from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { BookieMode } from '../types';

interface QuickTitleModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMode: BookieMode;
}

export const QuickTitleModal: React.FC<QuickTitleModalProps> = ({ isOpen, onClose, activeMode }) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  const [selectedMode, setSelectedMode] = useState<BookieMode>(activeMode);

  // Shop names form state (App name is strictly fixed as 'ရွှေမင်္ဂလာ' and not editable)
  const [shop3D, setShop3D] = useState(lottery3D.settings.shopName || '');
  const [shop2D, setShop2D] = useState(lottery2D.settings.shopName || '');
  const [shopFB, setShopFB] = useState(football.settings.shopName || '');

  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    // Save 3D (Keep appName strictly as 'ရွှေမင်္ဂလာ')
    lottery3D.updateSettings({
      appName: 'ရွှေမင်္ဂလာ',
      shopName: shop3D.trim()
    });

    // Save 2D (Keep appName strictly as 'ရွှေမင်္ဂလာ')
    lottery2D.updateSettings({
      appName: 'ရွှေမင်္ဂလာ',
      shopName: shop2D.trim()
    });

    // Save Football (Keep appName strictly as 'ရွှေမင်္ဂလာ')
    football.updateSettings({
      appName: 'ရွှေမင်္ဂလာ',
      shopName: shopFB.trim()
    });

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-400 flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">
                ဆိုင်အမည် ပြင်ဆင်ခြင်း
              </h3>
              <p className="text-xs text-slate-400">
                လုပ်ငန်းအသီးသီးအတွက် ဆိုင်အမည်ကို ပြင်ဆင်သတ်မှတ်နိုင်ပါသည်
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

        {/* Mode Selector Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 p-2 flex items-center justify-around gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setSelectedMode('3d')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedMode === '3d'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <span>အိုးစည်လေး</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedMode('2d')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedMode === '2d'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <span>ဇီးကွက်</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedMode('football')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              selectedMode === 'football'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <span>ပစ်တိုင်းထောင်</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Active Mode Form Field */}
          {selectedMode === '3d' && (
            <div className="space-y-3 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
              <label className="block text-xs font-bold text-slate-700">
                အိုးစည်လေး လုပ်ငန်း ဆိုင်အမည်:
              </label>
              <input
                type="text"
                value={shop3D}
                onChange={(e) => setShop3D(e.target.value)}
                placeholder="ဆိုင်အမည် ရိုက်ထည့်ပါ"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          )}

          {selectedMode === '2d' && (
            <div className="space-y-3 bg-teal-50/50 p-4 rounded-2xl border border-teal-100">
              <label className="block text-xs font-bold text-slate-700">
                ဇီးကွက် လုပ်ငန်း ဆိုင်အမည်:
              </label>
              <input
                type="text"
                value={shop2D}
                onChange={(e) => setShop2D(e.target.value)}
                placeholder="ဆိုင်အမည် ရိုက်ထည့်ပါ"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
          )}

          {selectedMode === 'football' && (
            <div className="space-y-3 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
              <label className="block text-xs font-bold text-slate-700">
                ပစ်တိုင်းထောင် လုပ်ငန်း ဆိုင်အမည်:
              </label>
              <input
                type="text"
                value={shopFB}
                onChange={(e) => setShopFB(e.target.value)}
                placeholder="ဆိုင်အမည် ရိုက်ထည့်ပါ"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              မလုပ်တော့ပါ
            </button>

            <button
              type="submit"
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>သိမ်းဆည်းပြီးပါပြီ</span>
                </>
              ) : (
                <span>သိမ်းဆည်းမည်</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
