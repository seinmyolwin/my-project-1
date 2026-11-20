import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Users, Building2, Percent } from 'lucide-react';
import {
  COMMISSION_UPDATED_EVENT,
  CommissionBusinessMode,
  ScopedCommissionRates,
  getCustomerCommissionRatesByMode,
  setCustomerCommissionRates,
  getUplineCommissionRatesByMode,
  setUplineCommissionRates
} from '../utils/commissionUtils';

interface SavedMasterAgent {
  name: string;
  phone?: string;
  commissionRate?: number;
  commissionRatesByMode?: Partial<Record<CommissionBusinessMode, number>>;
}

const BUSINESS_TABS: Array<{ id: CommissionBusinessMode; label: string }> = [
  { id: '2d', label: 'ဇီးကွက် (2D)' },
  { id: '3d', label: 'အိုးစည်လေး (3D)' },
  { id: 'football', label: 'ပစ်တိုင်းထောင်' }
];

export const CustomerCommissionManager: React.FC = () => {
  const [activeBusiness, setActiveBusiness] = useState<CommissionBusinessMode>('3d');
  const [activeTab, setActiveTab] = useState<'downline' | 'upline'>('downline');
  const [downlineRatesByMode, setDownlineRatesByMode] = useState<ScopedCommissionRates>({
    '2d': {},
    '3d': {},
    'football': {}
  });
  const [uplineRatesByMode, setUplineRatesByMode] = useState<ScopedCommissionRates>({
    '2d': {},
    '3d': {},
    'football': {}
  });
  const [savedMasterAgents, setSavedMasterAgents] = useState<SavedMasterAgent[]>([]);
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');

  const loadAll = () => {
    setDownlineRatesByMode(getCustomerCommissionRatesByMode());
    setUplineRatesByMode(getUplineCommissionRatesByMode());
    try {
      const raw = localStorage.getItem('shwe_master_agents_list');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setSavedMasterAgents(parsed);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadAll();
    const onUpdated = () => loadAll();
    window.addEventListener(COMMISSION_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(COMMISSION_UPDATED_EVENT, onUpdated);
  }, []);

  const downlineRates = downlineRatesByMode[activeBusiness] || {};
  const uplineRates = uplineRatesByMode[activeBusiness] || {};
  const currentMap = activeTab === 'downline' ? downlineRates : uplineRates;

  const handleAdd = () => {
    const trimmedName = name.trim();
    const parsedRate = parseFloat(rate);
    if (!trimmedName || isNaN(parsedRate) || parsedRate < 0) return;
    const clamped = Math.min(100, parsedRate);

    if (activeTab === 'downline') {
      const updated = { ...downlineRates, [trimmedName]: clamped };
      setCustomerCommissionRates(updated, activeBusiness);
      setDownlineRatesByMode((prev) => ({ ...prev, [activeBusiness]: updated }));
    } else {
      const updated = { ...uplineRates, [trimmedName]: clamped };
      setUplineCommissionRates(updated, activeBusiness);
      setUplineRatesByMode((prev) => ({ ...prev, [activeBusiness]: updated }));
    }
    setName('');
    setRate('');
  };

  const handleUpdateInline = (targetName: string, rawVal: string) => {
    const parsed = parseFloat(rawVal);
    const val = isNaN(parsed) || parsed < 0 ? 0 : Math.min(100, parsed);
    if (activeTab === 'downline') {
      const updated = { ...downlineRates, [targetName]: val };
      setCustomerCommissionRates(updated, activeBusiness);
      setDownlineRatesByMode((prev) => ({ ...prev, [activeBusiness]: updated }));
    } else {
      const updated = { ...uplineRates, [targetName]: val };
      setUplineCommissionRates(updated, activeBusiness);
      setUplineRatesByMode((prev) => ({ ...prev, [activeBusiness]: updated }));
    }
  };

  const handleRemove = (targetName: string) => {
    if (activeTab === 'downline') {
      const updated = { ...downlineRates };
      delete updated[targetName];
      setCustomerCommissionRates(updated, activeBusiness);
      setDownlineRatesByMode((prev) => ({ ...prev, [activeBusiness]: updated }));
    } else {
      const updated = { ...uplineRates };
      delete updated[targetName];
      setUplineCommissionRates(updated, activeBusiness);
      setUplineRatesByMode((prev) => ({ ...prev, [activeBusiness]: updated }));
    }
  };

  const unaddedMasterAgents = useMemo(() => {
    return savedMasterAgents.filter(
      (a) => a.name && uplineRates[a.name.trim()] === undefined
    );
  }, [savedMasterAgents, uplineRates]);

  const handleQuickAddMasterAgent = (agent: SavedMasterAgent) => {
    const trimmed = agent.name.trim();
    if (!trimmed) return;
    const modeRate = agent.commissionRatesByMode?.[activeBusiness];
    const defaultRate =
      typeof modeRate === 'number' && modeRate >= 0
        ? modeRate
        : typeof agent.commissionRate === 'number' && agent.commissionRate >= 0
        ? agent.commissionRate
        : 12;
    const updated = { ...uplineRates, [trimmed]: defaultRate };
    setUplineCommissionRates(updated, activeBusiness);
    setUplineRatesByMode((prev) => ({ ...prev, [activeBusiness]: updated }));
  };

  const isDownline = activeTab === 'downline';
  const activeBusinessLabel = BUSINESS_TABS.find((b) => b.id === activeBusiness)?.label || '';

  return (
    <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-3">
      {/* Header + Downline/Upline Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
            isDownline ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'
          }`}>
            <Percent className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900">
              ထိုးသားကော် / အထက်ဒိုင်ကော် သတ်မှတ်ချက်
            </h3>
            <p className="text-[10px] text-slate-500">
              {isDownline
                ? `${activeBusinessLabel} — ထိုးသား / အောက်လက်ဒိုင်ငယ် တစ်ဦးချင်း ကော်မရှင်နှုန်း`
                : `${activeBusinessLabel} — အထက်ဒိုင်ကြီး တစ်ဦးချင်း ကော်မရှင်နှုန်း`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => { setActiveTab('downline'); setName(''); setRate(''); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer ${
              isDownline
                ? 'bg-amber-500 text-slate-950 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3 h-3" />
            <span>ထိုးသားကော် ({Object.keys(downlineRates).length})</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('upline'); setName(''); setRate(''); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer ${
              !isDownline
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3 h-3" />
            <span>အထက်ဒိုင်ကော် ({Object.keys(uplineRates).length})</span>
          </button>
        </div>
      </div>

      {/* Business Mode Switcher (Strictly isolates 2D, 3D, Football rates) */}
      <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
        {BUSINESS_TABS.map((tab) => {
          const isActive = activeBusiness === tab.id;
          const count = Object.keys(
            (isDownline ? downlineRatesByMode[tab.id] : uplineRatesByMode[tab.id]) || {}
          ).length;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveBusiness(tab.id); setName(''); setRate(''); }}
              className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-all cursor-pointer flex items-center justify-center gap-1 ${
                isActive
                  ? tab.id === '2d'
                    ? 'bg-teal-700 text-white shadow-2xs'
                    : tab.id === '3d'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span className="truncate">{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Saved Master Agents Quick-Add Chips (Upline tab only) */}
      {!isDownline && unaddedMasterAgents.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 bg-indigo-50/70 border border-indigo-200 rounded-xl px-2.5 py-2 text-[11px]">
          <span className="font-bold text-indigo-900">မှတ်ထားသော ဒိုင်များ:</span>
          {unaddedMasterAgents.map((agent) => {
            const displayRate = agent.commissionRatesByMode?.[activeBusiness] ?? agent.commissionRate;
            return (
              <button
                key={agent.name}
                type="button"
                onClick={() => handleQuickAddMasterAgent(agent)}
                className="px-2 py-0.5 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3 h-3 text-indigo-600" />
                <span>{agent.name}</span>
                {typeof displayRate === 'number' && (
                  <span className="font-mono text-indigo-600">({displayRate}%)</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Add Form */}
      <div className="flex gap-2">
        <input
          type="text"
          className="border border-slate-300 focus:border-indigo-500 rounded-xl px-2.5 py-1.5 flex-1 text-xs font-bold text-slate-900 outline-none bg-slate-50 focus:bg-white"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
          placeholder={
            isDownline
              ? `${activeBusinessLabel} — ထိုးသား / ဒိုင်ငယ် အမည်`
              : `${activeBusinessLabel} — အထက်ဒိုင်ကြီး အမည်`
          }
        />
        <div className="relative flex items-center">
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            className="border border-slate-300 focus:border-indigo-500 rounded-xl px-2.5 py-1.5 pr-6 w-20 text-xs font-mono font-black text-right text-slate-900 outline-none bg-slate-50 focus:bg-white"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
            placeholder="12"
          />
          <span className="absolute right-2 text-[10px] font-bold text-slate-400 pointer-events-none">%</span>
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className={`px-3 py-1.5 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
            isDownline ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          <Plus size={15} />
          <span>ထည့်</span>
        </button>
      </div>

      {/* Existing Entries */}
      <div className="space-y-1.5 max-h-56 overflow-y-auto">
        {Object.entries(currentMap).length === 0 ? (
          <div className="text-center py-4 text-[11px] text-slate-400 font-bold bg-slate-50 rounded-xl border border-dashed border-slate-200">
            {isDownline
              ? `${activeBusinessLabel} အတွက် ထိုးသားကော် သီးသန့် သတ်မှတ်ထားသူ မရှိသေးပါ`
              : `${activeBusinessLabel} အတွက် အထက်ဒိုင်ကော် သီးသန့် သတ်မှတ်ထားသူ မရှိသေးပါ (Settings ပုံသေနှုန်းဖြင့် တွက်ပါမည်)`}
          </div>
        ) : (
          Object.entries(currentMap).map(([entryName, entryRate]) => (
            <div
              key={`${activeBusiness}-${entryName}`}
              className="flex justify-between items-center bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs gap-2"
            >
              <span className="font-bold text-slate-800 truncate">{entryName}</span>
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative flex items-center">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={entryRate}
                    onChange={(e) => handleUpdateInline(entryName, e.target.value)}
                    className="w-16 bg-white border border-slate-300 focus:border-indigo-500 rounded-lg px-2 py-1 pr-5 text-xs font-mono font-black text-right text-slate-900 outline-none"
                  />
                  <span className="absolute right-1.5 text-[10px] font-bold text-slate-400 pointer-events-none">%</span>
                </div>
                <button
                  type="button"
                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                  onClick={() => handleRemove(entryName)}
                  title="ဖျက်မည်"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
