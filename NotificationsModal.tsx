import React from 'react';
import {
  X,
  Bell,
  AlertTriangle,
  Lock,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  Info
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { formatAmount } from '../utils/lotteryUtils';
import { BookieMode } from '../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenForwardModal: (num?: string, amount?: number) => void;
  dealerMode?: BookieMode;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  onOpenForwardModal,
  dealerMode = '3d'
}) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();

  const settings = dealerMode === '3d' ? lottery3D.settings : dealerMode === '2d' ? lottery2D.settings : lottery3D.settings;
  const lowStockAlerts = dealerMode === '3d' ? lottery3D.lowStockAlerts : dealerMode === '2d' ? lottery2D.lowStockAlerts : [];
  const aggregates = dealerMode === '3d' ? lottery3D.aggregates : dealerMode === '2d' ? lottery2D.aggregates : {};

  if (!isOpen) return null;

  const isMyanmar = settings.language === 'my';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold border border-rose-200">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isMyanmar ? 'အကန့်အသတ် သတိပေးချက်များ (Stock & Risk Alerts)' : 'Low Stock & Limit Push Alerts'}
              </h3>
              <p className="text-xs text-slate-500">
                {isMyanmar ? 'ဘရိတ်ပြည့်လုနီးပါး သို့မဟုတ် ပိတ်ထားသော ဂဏန်းများ' : 'Numbers approaching stock limits or blocked'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-3 max-h-[70vh] overflow-y-auto">
          {lowStockAlerts.length === 0 ? (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <ShieldCheck className="w-12 h-12 text-emerald-600 mx-auto" />
              <p className="text-sm font-bold text-slate-900">
                {isMyanmar ? 'သတိပေးချက် မရှိပါ' : 'All Clear! No Active Alerts'}
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                {isMyanmar ? 'ဂဏန်းအားလုံး ဘရိတ်အတွင်းတွင် ပုံမှန်ရောင်းချနိုင်နေပါသည်' : 'All bet numbers are currently well within safe thresholds.'}
              </p>
            </div>
          ) : (
            lowStockAlerts.map((alert) => {
              const agg = aggregates[alert.number];
              const isDanger = alert.type === 'limit_reached' || alert.type === 'blocked';

              return (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs shadow-2xs ${
                    isDanger
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-lg px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-900 tracking-wider shadow-2xs">
                      {alert.number}
                    </span>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 font-bold">
                        {alert.type === 'blocked' ? (
                          <>
                            <Lock className="w-3.5 h-3.5 text-rose-600" />
                            <span>ဂဏန်း ပိတ်ထားပါသည် (Blocked)</span>
                          </>
                        ) : alert.type === 'limit_reached' ? (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span>ဘရိတ် ပြည့်သွားပါပြီ ({alert.percentage}%)</span>
                          </>
                        ) : (
                          <>
                            <Info className="w-3.5 h-3.5 text-amber-600" />
                            <span>ဘရိတ်နီးနေပါသည် ({alert.percentage}%)</span>
                          </>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-600 block font-mono">
                        ရောင်းပြီး: {formatAmount(alert.soldAmount, settings.currency)} / ဘရိတ်: {formatAmount(alert.limit, settings.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Quick Action: Forward off excess */}
                  <button
                    onClick={() => {
                      onClose();
                      onOpenForwardModal(alert.number, Math.max(0, alert.soldAmount - alert.limit));
                    }}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold flex items-center gap-1 text-[11px] shrink-0 transition-colors shadow-2xs cursor-pointer"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>အပေါ်တင်မည်</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            ပိတ်မည်
          </button>
        </div>

      </div>
    </div>
  );
};
