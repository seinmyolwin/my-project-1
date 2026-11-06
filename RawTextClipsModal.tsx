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

  if (!isOpen) return null;

  // Extract unique dates and rounds for filtering
  const availableDates = Array.from(new Set(clips.map(c => c.date))).sort().reverse();
  const availableRounds = Array.from(new Set(clips.map(c => c.roundName))).filter(Boolean);

  // Filtered clips
  const filteredClips = clips.filter(c => {
    if (categoryFilter !== 'all' && c.category !== categoryFilter) return false;
    if (dateFilter !== 'all' && c.date !== dateFilter) return false;
    if (roundFilter !== 'all' && c.roundName !== roundFilter) return false;
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

  // Group clips by Date -> Round
  const groupedClips = filteredClips.reduce<Record<string, Record<string, RawBetClip[]>>>((acc, clip) => {
    const d = clip.date || 'အခြားရက်စွဲ';
    const r = clip.roundName || 'အထွေထွေပွဲစဉ်';
    if (!acc[d]) acc[d] = {};
    if (!acc[d][r]) acc[d][r] = [];
    acc[d][r].push(clip);
    return acc;
  }, {});

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
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-white px-5 py-4 flex items-center justify-between border-b border-amber-900/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-bold shadow-xs">
              <FileText className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-amber-100">
                  မူရင်းစာသား သိမ်းဆည်းရာနေရာ (Raw Texts Archive)
                </h3>
                <span className="bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full font-mono">
                  {clips.length} စောင်
                </span>
              </div>
              <p className="text-xs text-amber-200/80 mt-0.5">
                နေ့စွဲ၊ ပွဲစဉ်နှင့် ဘောင်ချာအလိုက် ကူးထည့်ထားသော မူရင်းစာသားများကို သီးသန့်စစ်ဆေးကြည့်ရှုနိုင်ပြီး ဖျက်နိုင်ပါသည်
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddingNew(!isAddingNew)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddingNew ? 'ပိတ်မည်' : 'စာသားကူးထည့်သိမ်းမည်'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice Info Banner */}
        <div className="bg-amber-50/90 border-b border-amber-200/80 px-5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="font-semibold">
              မှတ်ချက်: ဤနေရာသည် ကူးယူထည့်သွင်းထားသော မူရင်းစာသားများကို သီးသန့်သိမ်းဆည်းထားရုံသာဖြစ်ပြီး ဒိုင်စာရင်းနှင့် မည်သည့် တွက်ချက်မှုမှ မသက်ရောက်ပါ။
            </span>
          </div>
          {clips.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer hover:underline"
            >
              <Trash2 className="w-3 h-3" />
              <span>မူရင်းစာသားအားလုံး ဖျက်မည် (Clear All)</span>
            </button>
          )}
        </div>

        {/* Manual Add New Form Drawer */}
        {isAddingNew && (
          <form onSubmit={handleSaveManual} className="bg-amber-50/50 border-b border-amber-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-amber-600" />
                <span>မူရင်းစာသားအသစ် သီးသန့် ကူးထည့်သိမ်းဆည်းခြင်း</span>
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">အမျိုးအစား (Category)</label>
                <select
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-900"
                >
                  <option value="3d">အိုးစည်လေး (3D)</option>
                  <option value="2d">ဇီးကွက် (2D)</option>
                  <option value="football">ပစ်တိုင်းထောင် (Football)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">ဘောင်ချာအမှတ် / အမည်</label>
                <input
                  type="text"
                  value={manualVoucherNo}
                  onChange={(e) => setManualVoucherNo(e.target.value)}
                  placeholder={`ဥပမာ - ဘောင်ချာ (${clips.length + 1})`}
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">ဝယ်သူအမည်</label>
                <input
                  type="text"
                  value={manualCustomer}
                  onChange={(e) => setManualCustomer(e.target.value)}
                  placeholder="ဥပမာ - ကိုကျော်ဇေယျ"
                  className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">ကူးလာသော မူရင်းစာသား (Paste Raw Text)</label>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder={`123=1000\n456=500\n789R=1000\nသို့မဟုတ် telegram / Telegram မက်ဆေ့စာသား`}
                rows={3}
                required
                className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-xs font-mono text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                မသိမ်းတော့ပါ
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                သိမ်းဆည်းမည်
              </button>
            </div>
          </form>
        )}

        {/* Filter & Search Bar */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Filter */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              {(['all', '3d', '2d', 'football'] as const).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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

            {/* Date Filter Dropdown */}
            {availableDates.length > 0 && (
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-2.5 py-1.5 shadow-2xs"
              >
                <option value="all">ရက်စွဲအားလုံး ({availableDates.length})</option>
                {availableDates.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}

            {/* Round Filter Dropdown */}
            {availableRounds.length > 0 && (
              <select
                value={roundFilter}
                onChange={(e) => setRoundFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl px-2.5 py-1.5 shadow-2xs"
              >
                <option value="all">ပွဲစဉ်အားလုံး ({availableRounds.length})</option>
                {availableRounds.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ရှာဖွေရန် (ဘောင်ချာ၊ ဝယ်သူ၊ ဂဏန်း)..."
              className="w-full bg-white border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 shadow-2xs"
            />
          </div>
        </div>

        {/* Content Body: Grouped by Date & Round */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50 space-y-6">
          {filteredClips.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 space-y-3 max-w-md mx-auto shadow-2xs">
              <FileText className="w-12 h-12 mx-auto text-slate-300" />
              <h4 className="text-sm font-bold text-slate-700">မူရင်းစာသားမှတ်တမ်းများ မရှိသေးပါ</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                ထိုးကြေးများ ထည့်သွင်းရာတွင် ကူးထည့်ထားသော မူရင်းစာသားများကို နေ့စွဲ၊ ပွဲစဉ်နှင့် ဘောင်ချာအလိုက် ဤနေရာတွင် အလိုအလျောက် သီးသန့်သိမ်းဆည်းပေးမည် ဖြစ်ပါသည်။
              </p>
              <button
                type="button"
                onClick={() => setIsAddingNew(true)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer mt-2"
              >
                <Plus className="w-4 h-4" />
                <span>စာသားကူးထည့် စမ်းသပ်သိမ်းဆည်းမည်</span>
              </button>
            </div>
          ) : (
            Object.entries(groupedClips).map(([date, rounds]) => (
              <div key={date} className="space-y-4">
                {/* Date Header */}
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <Calendar className="w-4 h-4 text-amber-700" />
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    ရက်စွဲ: {date}
                  </h4>
                  <span className="text-[11px] font-mono text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-md font-bold">
                    {Object.values(rounds).reduce((s, arr) => s + arr.length, 0)} စောင်
                  </span>
                </div>

                {/* Rounds inside Date */}
                {Object.entries(rounds).map(([roundName, roundClips]) => (
                  <div key={roundName} className="space-y-3 pl-1 sm:pl-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-sky-600" />
                        <span className="text-xs font-bold text-slate-700 font-mono">
                          ပွဲစဉ်: {roundName}
                        </span>
                        <span className="bg-sky-100 text-sky-800 text-[10px] font-black px-1.5 py-0.2 rounded-md">
                          {roundClips.length} ဘောင်ချာ
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`[${roundName}] ပွဲစဉ်မှ မူရင်းစာသားမှတ်တမ်း (${roundClips.length}) စောင်လုံးကို ဖျက်ရန် သေချာပါသလား?`)) {
                            roundClips.forEach(c => deleteRawClip(c.id));
                            setClips(getRawClips());
                          }
                        }}
                        className="text-[11px] text-slate-400 hover:text-rose-600 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        title="ဤပွဲစဉ်မှ စာသားအားလုံးဖျက်မည်"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>ပွဲစဉ်အလိုက် ဖျက်မည်</span>
                      </button>
                    </div>

                    {/* Vouchers Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {roundClips.map((clip, index) => (
                        <div
                          key={clip.id}
                          className="bg-white border border-slate-200 hover:border-amber-400/80 rounded-2xl p-4 shadow-2xs space-y-3 transition-all"
                        >
                          {/* Card Header: Voucher Info */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-900 border border-amber-300/60 rounded-xl text-xs font-black">
                                {clip.voucherNumber || `ဘောင်ချာ #${index + 1}`}
                              </span>
                              <div>
                                <div className="text-xs font-bold text-slate-900 flex items-center gap-1">
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span>{clip.customerName || 'အထွေထွေ'}</span>
                                  {clip.customerPhone && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      ({clip.customerPhone})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>{clip.time || new Date(clip.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                  <span>•</span>
                                  <span>{clip.itemCount || 0} ကွက်</span>
                                </div>
                              </div>
                            </div>

                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                              clip.category === '3d' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                              clip.category === '2d' ? 'bg-teal-50 text-teal-700 border border-teal-200' :
                              'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {clip.category.toUpperCase()}
                            </span>
                          </div>

                          {/* Raw Text Content Box */}
                          <div className="relative group">
                            <pre className="bg-slate-900 text-emerald-300 font-mono text-xs p-3 rounded-xl max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner select-all border border-slate-800">
                              {clip.rawText}
                            </pre>
                          </div>

                          {/* Card Footer: Action Buttons */}
                          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleCopy(clip)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                copiedId === clip.id
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {copiedId === clip.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-white" />
                                  <span>ကူးယူပြီး (Copied)</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>စာသားကူးမည်</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(clip.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="ဖျက်မည်"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};
