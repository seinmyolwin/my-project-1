/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Standalone dedicated modal for viewing and managing copied raw bet texts (မူရင်းစာသားများ)
 * Isolated purely for reference, inspection, and verification.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileText,
  Trash2,
  Copy,
  Check,
  Search,
  Calendar,
  Layers,
  Clock,
  User,
  Plus,
  AlertCircle,
  Filter,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import {
  RawBetClip,
  getRawClips,
  saveRawClip,
  deleteRawClip,
  deleteRawClipsByRound,
  clearAllRawClips
} from '../utils/rawClipsUtils';
import { formatAmount } from '../utils/lotteryUtils';

interface RawTextClipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRoundName3D?: string;
  activeRoundName2D?: string;
  currentDealerMode?: '3d' | '2d' | 'football';
}

export const RawTextClipsModal: React.FC<RawTextClipsModalProps> = ({
  isOpen,
  onClose,
  activeRoundName3D,
  activeRoundName2D,
  currentDealerMode = '3d'
}) => {
  const [clips, setClips] = useState<RawBetClip[]>(() => getRawClips());
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | '3d' | '2d' | 'football'>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [roundFilter, setRoundFilter] = useState<string>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Manual Add New Raw Text Form State
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [manualCategory, setManualCategory] = useState<'3d' | '2d' | 'football'>(currentDealerMode);
  const [manualVoucherNo, setManualVoucherNo] = useState('');
  const [manualCustomer, setManualCustomer] = useState('');
  const [manualText, setManualText] = useState('');

  // Sync clips on update events
  useEffect(() => {
    const handleUpdate = () => {
      setClips(getRawClips());
    };
    window.addEventListener('shwe_raw_clips_updated', handleUpdate);
    return () => window.removeEventListener('shwe_raw_clips_updated', handleUpdate);
  }, []);

  // Refresh when opened
  useEffect(() => {
    if (isOpen) {
      setClips(getRawClips());
    }
  }, [isOpen]);

  // Extract unique dates, rounds, and customers for filtering
  const availableDates = Array.from(new Set(clips.map(c => c.date))).sort().reverse();
  const availableRounds = Array.from(new Set(clips.map(c => c.roundName))).filter(Boolean);
  const availableCustomers = Array.from(new Set(clips.map(c => c.customerName))).filter(Boolean).sort();

  // Filtered clips
  const filteredClips = clips.filter(c => {
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
    if (dateFilter !== 'all' && c.date !== dateFilter) return false;
    if (roundFilter !== 'all' && c.roundName !== roundFilter) return false;
    if (customerFilter !== 'all' && c.customerName !== customerFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchText = c.rawText.toLowerCase().includes(q);
      const matchVoucher = c.voucherNumber.toLowerCase().includes(q);
      const matchCustomer = (c.customerName || '').toLowerCase().includes(q);
      const matchRound = c.roundName.toLowerCase().includes(q);
      if (!matchText && !matchVoucher && !matchCustomer && !matchRound) return false;
    }
    return true;
  });

  const totalFilteredAmount = filteredClips.reduce((sum, c) => sum + (c.totalAmountPreview || 0), 0);

  // Group clips by Customer Name, sorted chronologically by timestamp within each customer
  const groupedByCustomer = useMemo(() => {
    const groups: Record<string, RawBetClip[]> = {};
    // Sort all filtered clips chronologically by timestamp (oldest to newest or newest to oldest as requested)
    const sorted = [...filteredClips].sort((a, b) => a.timestamp - b.timestamp);
    
    sorted.forEach(clip => {
      const cust = (clip.customerName && clip.customerName.trim() !== '') ? clip.customerName.trim() : 'အထွေထွေဝယ်သူ (General)';
      if (!groups[cust]) groups[cust] = [];
      groups[cust].push(clip);
    });
    
    // Sort customer keys alphabetically
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'my'));
  }, [filteredClips]);

  if (!isOpen) return null;

  const handleCopy = (clip: RawBetClip) => {
    navigator.clipboard.writeText(clip.rawText);
    setCopiedId(clip.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('ဤမူရင်းစာသားမှတ်တမ်းကို ဖျက်ပစ်ရန် သေချာပါသလား?')) {
      deleteRawClip(id);
      setClips(getRawClips());
    }
  };

  const handleClearAll = () => {
    if (window.confirm('သိမ်းဆည်းထားသော မူရင်းစာသားမှတ်တမ်း အားလုံးကို အပြီးတိုင် ဖျက်ပစ်ရန် သေချာပါသလား?\n(ဒိုင်စာရင်းနှင့် ဘောင်ချာများအပေါ် သက်ရောက်မှု မရှိပါ)')) {
      clearAllRawClips();
      setClips([]);
    }
  };

  const handleSaveManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim()) return;

    const lines = manualText.split('\n').filter(l => l.trim().length > 0);
    const roundName = manualCategory === '3d'
      ? (activeRoundName3D || '3D ပွဲစဉ်')
      : manualCategory === '2d'
      ? (activeRoundName2D || '2D ပွဲစဉ်')
      : 'ပစ်တိုင်းထောင်';

    saveRawClip({
      category: manualCategory,
      roundId: `manual-${manualCategory}`,
      roundName: roundName,
      date: new Date().toLocaleDateString('en-CA'),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      voucherNumber: manualVoucherNo.trim() || `ဘောင်ချာ (${clips.length + 1})`,
      customerName: manualCustomer.trim() || 'အထွေထွေ',
      rawText: manualText.trim(),
      itemCount: lines.length,
      source: 'direct_paste'
    });

    setManualText('');
    setManualCustomer('');
    setManualVoucherNo('');
    setIsAddingNew(false);
    setClips(getRawClips());
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-3 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-white px-4 py-3 flex items-center justify-between border-b border-amber-900/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold shadow-xs">
              <FileText className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black tracking-tight text-amber-100">
                  မူရင်းစာသား သိမ်းဆည်းရာနေရာ (Raw Texts Archive)
                </h3>
                <span className="bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full font-mono">
                  {clips.length} စောင်
                </span>
              </div>
              <p className="text-[11px] text-amber-200/80">
                ထိုးသားအမည်အလိုက် ခွဲခြားပြီး အချိန်အလိုက် ရှေ့နောက်စီစဉ်ထားသော မူရင်းစာသားမှတ်တမ်းများ
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingNew ? 'ပိတ်မည်' : 'စာသားထည့်မည်'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notice Info & Filters Bar */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Filter */}
            <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
              {(['all', '3d', '2d', 'football'] as const).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat === 'all' && 'အားလုံး'}
                  {cat === '3d' && '3D'}
                  {cat === '2d' && '2D'}
                  {cat === 'football' && 'FB'}
                </button>
              ))}
            </div>

            {/* Date Filter */}
            {availableDates.length > 0 && (
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-xl px-2 py-1 shadow-2xs"
              >
                <option value="all">ရက်စွဲအားလုံး ({availableDates.length})</option>
                {availableDates.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}

            {/* Customer Filter */}
            {availableCustomers.length > 0 && (
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-xl px-2 py-1 shadow-2xs"
              >
                <option value="all">ထိုးသားအားလုံး ({availableCustomers.length})</option>
                {availableCustomers.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-slate-600 text-[11px] font-bold font-mono">
              စုစုပေါင်း: <span className="text-emerald-700 font-black">{formatAmount(totalFilteredAmount, 'Ks')}</span> ({filteredClips.length} စောင်)
            </div>
            {clips.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[10px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer hover:underline"
              >
                <Trash2 className="w-3 h-3" />
                <span>အားလုံးဖျက်မည်</span>
              </button>
            )}
          </div>
        </div>

        {/* Manual Add New Form Drawer */}
        {isAddingNew && (
          <form onSubmit={handleSaveManual} className="bg-amber-50/70 border-b border-amber-200 p-3 space-y-2 shrink-0">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">အမျိုးအစား</label>
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs font-bold text-slate-900"
                >
                  <option value="3d">အိုးစည်လေး (3D)</option>
                  <option value="2d">ဇီးကွက် (2D)</option>
                  <option value="football">ပစ်တိုင်းထောင် (Football)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">ဘောင်ချာအမှတ်</label>
                <input
                  type="text"
                  value={manualVoucherNo}
                  onChange={(e) => setManualVoucherNo(e.target.value)}
                  placeholder="ဥပမာ - V-001"
                  className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">ထိုးသားအမည်</label>
                <input
                  type="text"
                  value={manualCustomer}
                  onChange={(e) => setManualCustomer(e.target.value)}
                  placeholder="ဥပမာ - ကိုကျော်ဇေယျ"
                  className="w-full bg-white border border-slate-300 rounded-xl px-2 py-1 text-xs text-slate-900"
                />
              </div>

              <div className="flex items-end gap-1">
                <button
                  type="submit"
                  className="flex-1 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  သိမ်းမည်
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  ပိတ်
                </button>
              </div>
            </div>

            <div>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="မူရင်းစာသားများကို ဤနေရာတွင် ကူးထည့်ပါ..."
                rows={2}
                required
                className="w-full bg-white border border-amber-300 rounded-xl p-2 text-xs font-mono text-slate-900"
              />
            </div>
          </form>
        )}

        {/* Compact Content Body: Grouped by Customer Name & Sorted Chronologically */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 bg-slate-50/50 space-y-3">
          {filteredClips.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-slate-400 space-y-2 max-w-sm mx-auto shadow-2xs">
              <FileText className="w-10 h-10 mx-auto text-slate-300" />
              <h4 className="text-xs font-bold text-slate-700">မူရင်းစာသားမှတ်တမ်းများ မရှိသေးပါ</h4>
              <p className="text-[11px] text-slate-500">
                ထိုးသားအမည်အလိုက် အလိုအလျောက် ခွဲခြားသိမ်းဆည်းပေးမည် ဖြစ်ပါသည်။
              </p>
            </div>
          ) : (
            groupedByCustomer.map(([customerName, customerClips]) => (
              <div key={customerName} className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-2xs space-y-2.5">
                {/* Customer Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs border border-indigo-200">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="text-xs font-black text-slate-900">
                      {customerName}
                    </h4>
                    <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full font-mono">
                      {customerClips.length} စောင်
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 font-mono">
                    အချိန်အလိုက် ရှေ့နောက်စီစဉ်ပြီး
                  </div>
                </div>

                {/* Vouchers Grid (Compact, Screen-fitting, No giant gaps) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
                  {customerClips.map((clip, idx) => (
                    <div
                      key={clip.id}
                      className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-2.5 space-y-2 hover:border-amber-400/80 transition-all flex flex-col justify-between"
                    >
                      {/* Top Row: Voucher Badge, Time, Category */}
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 font-bold">
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-900 border border-amber-300/60 rounded-lg text-[10px] font-black font-mono">
                            {clip.voucherNumber || `ဘောင်ချာ #${idx + 1}`}
                          </span>
                          <span className="text-slate-500 font-mono text-[10px] flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {clip.date} • {clip.time || new Date(clip.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({clip.roundName})
                          </span>
                          <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase ${
                            clip.category === '3d' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            clip.category === '2d' ? 'bg-teal-50 text-teal-700 border border-teal-200' :
                            'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {clip.category.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Raw Text Pre Box (Compact height) */}
                      <pre className="bg-slate-900 text-emerald-300 font-mono text-[11px] p-2 rounded-lg max-h-24 overflow-y-auto whitespace-pre-wrap leading-tight shadow-inner select-all border border-slate-800">
                        {clip.rawText}
                      </pre>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopy(clip)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                            copiedId === clip.id
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-2xs'
                          }`}
                        >
                          {copiedId === clip.id ? (
                            <>
                              <Check className="w-3 h-3 text-white" />
                              <span>ကူးယူပြီး</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>စာသားကူးမည်</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(clip.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="ဖျက်မည်"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
