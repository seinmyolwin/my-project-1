import React from 'react';
import { WifiOff, ShieldCheck } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xl animate-in fade-in duration-200">
      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
      <WifiOff className="w-4 h-4 text-amber-400" />
      <span>Offline Mode — ဒေတာများကို ဖုန်း/စက်ထဲတွင် လုံခြုံစွာ အပြည့်အဝ သုံးနိုင်ပါသည် (No Internet Needed)</span>
    </div>
  );
};
