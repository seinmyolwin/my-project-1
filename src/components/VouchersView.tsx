import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Search,
  Printer,
  Trash2,
  CheckCircle2,
  Clock,
  User,
  Share2,
  FileSpreadsheet,
  Copy,
  Check,
  Calendar,
  XCircle,
  Eye,
  Send,
  ShieldAlert,
  Phone,
  X,
  Trophy
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { Voucher, ForwardSlip } from '../types';
import { formatAmount } from '../utils/lotteryUtils';

interface VouchersViewProps {
  onOpenPrintVoucher: (voucher: Voucher) => void;
}

export const VouchersView: React.FC<VouchersViewProps> = ({ onOpenPrintVoucher }) => {
  const {
    activeRound,
    settings,
    activeRoundVouchers,
    activeRoundForwardSlips,
    deleteVoucher,
    deleteForwardSlip,
    updateVoucher,
    exportToExcel
  } = useLottery();

  const isMyanmar = settings.language === 'my';

  // Category filter: All vs Customer Vouchers vs Master Agent Forward Slips
  const [activeCategory, setActiveCategory] = useState<'all' | 'customer' | 'forward'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid' | 'cancelled'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedForwardSlip, setSelectedForwardSlip] = useState<ForwardSlip | null>(null);

  // Filtered Customer Vouchers
  const displayVouchers = useMemo(() => {
    return activeRoundVouchers.filter((v) => {
      // Payment filter
      if (filterPaid === 'paid' && (!v.isPaid || v.status === 'cancelled')) return false;
      if (filterPaid === 'unpaid' && (v.isPaid || v.status === 'cancelled')) return false;
      if (filterPaid === 'cancelled' && v.status !== 'cancelled') return false;
      if (filterPaid !== 'cancelled' && v.status === 'cancelled') return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = v.customerName.toLowerCase().includes(q);
        const matchesNo = v.voucherNo.toLowerCase().includes(q);
        const matchesPhone = v.customerPhone?.toLowerCase().includes(q);
        const matchesBet = v.items.some((item) => item.number.includes(q));
        return matchesName || matchesNo || matchesPhone || matchesBet;
      }
      return true;
    });
  }, [activeRoundVouchers, filterPaid, searchQuery]);

  // Filtered Forward Slips
  const displayForwardSlips = useMemo(() => {
    return activeRoundForwardSlips.filter((s) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesAgent = s.masterAgentName.toLowerCase().includes(q);
        const matchesNo = s.slipNo.toLowerCase().includes(q);
        const matchesPhone = s.masterAgentPhone?.toLowerCase().includes(q);
        const matchesBet = s.items.some((item) => item.number.includes(q));
        return matchesAgent || matchesNo || matchesPhone || matchesBet;
      }
      return true;
    });
  }, [activeRoundForwardSlips, searchQuery]);

  // Copy raw customer voucher text for Viber/SMS
  const handleCopyVoucherText = (v: Voucher) => {
    const lines = v.items.map((i) => `${i.number} = ${formatAmount(i.amount, settings.currency)}`).join('\n');
    const text = `🧾 ${settings.shopName} (အိုးစည်လေး 3D)
ဘောင်ချာအမှတ်: ${v.voucherNo}
ရက်စွဲ: ${new Date(v.createdAt).toLocaleDateString()}
ဝယ်သူ: ${v.customerName}
------------------------
${lines}
------------------------
စုစုပေါင်း: ${formatAmount(v.subtotal, settings.currency)}
လျှော့ငွေ: ${formatAmount(v.discountAmount, settings.currency)}
အသားတင်ပေးချေငွေ: ${formatAmount(v.netPayable, settings.currency)}

${settings.voucherFooterMessage || 'ကျေးဇူးတင်ပါသည်'}`;

    navigator.clipboard.writeText(text);
    setCopiedId(v.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Copy raw Master Agent forward slip text
  const handleCopyForwardSlipText = (s: ForwardSlip) => {
    const lines = s.items.map((it) => `${it.number} = ${formatAmount(it.amount, settings.currency)}`).join('\n');
    const text = `【3D ဒိုင်လွှဲစလစ်: ${s.slipNo}】
ပွဲစဉ်: ${activeRound?.name || '-'}
ရက်စွဲ: ${new Date(s.createdAt).toLocaleString('en-GB')}
ဒိုင်ချုပ်ကြီး: ${s.masterAgentName} ${s.masterAgentPhone ? `(${s.masterAgentPhone})` : ''}
------------------------
${lines}
------------------------
စုစုပေါင်း လွှဲငွေ: ${formatAmount(s.totalAmount, settings.currency)}
ကော်မရှင် (${s.commissionRate}%): +${formatAmount(s.commissionAmount, settings.currency)}
ဒိုင်သို့ အမှန်ပေးချေငွေ: ${formatAmount(s.netPaid, settings.currency)}
${s.notes ? `မှတ်ချက်: ${s.notes}\n` : ''}`;

    navigator.clipboard.writeText(text);
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalCustomerCount = activeRoundVouchers.length;
  const totalForwardCount = activeRoundForwardSlips.length;

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Top Search & Filter Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border border-indigo-100">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {isMyanmar ? 'အိုးစည်လေး ပြေစာနှင့် ဘောင်ချာမှတ်တမ်းများ' : '3D Vouchers & Forward Slips'}
              </h2>
              <p className="text-xs text-slate-500">
                {isMyanmar
                  ? 'ရောင်းချထားသော ဘောင်ချာများနှင့် ဒိုင်ကြီးဆီတင်သော စလစ်များ ခွဲခြားကြည့်ရှုခြင်း'
                  : 'Customer vouchers and master agent forward slips'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isMyanmar ? 'Excel ထုတ်မည်' : 'Export Excel'}</span>
            </button>
          </div>
        </div>

        {/* View Selection Tabs (ခွဲကြည့်ရန် All vs Customer Vouchers vs Master Agent Forward Slips) */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-slate-900 text-white shadow-xs ring-2 ring-slate-800'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>{isMyanmar ? 'အားလုံး ပေါင်းကြည့်မည်' : 'All Records'}</span>
            <span className="px-1.5 py-0.2 bg-white/20 rounded-md text-[10px] font-mono">
              {totalCustomerCount + totalForwardCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('customer')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeCategory === 'customer'
                ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-400/40'
                : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200/60'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{isMyanmar ? 'ထိုးသူ/ဝယ်သူ ဘောင်ချာများ' : 'Customer Vouchers'}</span>
            <span className="px-1.5 py-0.2 bg-indigo-800/30 text-indigo-100 rounded-md text-[10px] font-mono">
              {totalCustomerCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('forward')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeCategory === 'forward'
                ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400/40'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isMyanmar ? 'ဒိုင်ကြီးဆီတင်သော စလစ်များ (သီးသန့်)' : 'Master Agent Forward Slips'}</span>
            <span className="px-1.5 py-0.2 bg-amber-800/30 text-amber-100 rounded-md text-[10px] font-mono">
              {totalForwardCount}
            </span>
          </button>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-1">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeCategory === 'forward'
                  ? (isMyanmar ? 'ဒိုင်လွှဲစလစ်နံပါတ်၊ ဒိုင်ချုပ်၊ ဂဏန်းဖြင့်ရှာရန်' : 'Search forward slip...')
                  : (isMyanmar ? 'ဘောင်ချာအမှတ်၊ ဝယ်သူအမည်၊ ဂဏန်းဖြင့်ရှာရန်' : 'Search by voucher no, customer, number...')
              }
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 transition-colors shadow-2xs"
            />
          </div>

          {activeCategory !== 'forward' && (
            <div className="md:col-span-7 flex flex-wrap gap-1.5 justify-start md:justify-end">
              <button
                onClick={() => setFilterPaid('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  filterPaid === 'all'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {isMyanmar ? 'အားလုံး' : 'All Slips'}
              </button>

              <button
                onClick={() => setFilterPaid('paid')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  filterPaid === 'paid'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                {isMyanmar ? 'ငွေပေးချေပြီး' : 'Paid'}
              </button>

              <button
                onClick={() => setFilterPaid('unpaid')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  filterPaid === 'unpaid'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                {isMyanmar ? 'ငွေမပေးရသေး' : 'Unpaid'}
              </button>

              <button
                onClick={() => setFilterPaid('cancelled')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  filterPaid === 'cancelled'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                {isMyanmar ? 'ပယ်ဖျက်ပြီး' : 'Cancelled'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. MASTER AGENT FORWARD SLIPS SECTION (ဒိုင်ကြီးဆီတင်သော စလစ်များ) */}
      {/* ========================================================================= */}
      {(activeCategory === 'all' || activeCategory === 'forward') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span>{isMyanmar ? 'ဒိုင်ကြီးဆီ ပြန်တင်ထားသော 3D ပြေစာစလစ်များ' : 'Forwarded Slips to Master Agent'}</span>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-xs font-black rounded-full">
                {displayForwardSlips.length}
              </span>
            </h3>
          </div>

          {displayForwardSlips.length === 0 ? (
            <div className="py-8 text-center text-slate-400 bg-white border border-slate-200 rounded-2xl shadow-xs">
              <Send className="w-8 h-8 mx-auto text-slate-300 mb-1" />
              <p className="text-xs font-semibold">
                {isMyanmar ? 'ဒိုင်ကြီးဆီ တင်ထားသော 3D ဘောင်ချာ မရှိသေးပါ' : 'No 3D forward slips recorded'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayForwardSlips.map((s) => (
                <div
                  key={s.id}
                  className="bg-white border border-amber-200/90 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 hover:border-amber-400 transition-all cursor-pointer group"
                  onClick={() => setSelectedForwardSlip(s)}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-1.5">
                        <Send className="w-3.5 h-3.5 text-amber-600" />
                        <span className="font-mono font-black text-amber-800 text-sm">{s.slipNo}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-bold text-slate-900 text-xs">{s.masterAgentName}</span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 font-bold text-[10px] border border-amber-200">
                        {s.items.length} လုံး
                      </span>
                    </div>
                  </div>

                  {/* Numbers Preview */}
                  <div className="bg-amber-50/40 border border-amber-100 rounded-xl p-2.5 max-h-24 overflow-y-auto">
                    <div className="flex flex-wrap gap-1.5">
                      {s.items.map((item, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-white border border-amber-200 rounded text-[11px] font-mono font-bold text-slate-800"
                        >
                          {item.number} = {formatAmount(item.amount, settings.currency)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">လွှဲငွေစုစုပေါင်း</span>
                      <span className="text-sm font-black text-slate-950 font-mono">
                        {formatAmount(s.totalAmount, settings.currency)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-emerald-600 block">ကော်မရှင်: +{formatAmount(s.commissionAmount, settings.currency)}</span>
                      <span className="text-xs font-black text-indigo-700 font-mono">
                        အမှန်: {formatAmount(s.netPaid, settings.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div
                    className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 font-sans"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedForwardSlip(s)}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        title="စလစ် အသေးစိတ် ကြည့်မည်"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isMyanmar ? 'ကြည့်မည်' : 'View'}</span>
                      </button>

                      <button
                        onClick={() => handleCopyForwardSlipText(s)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                        title="Viber ပို့ရန် စာသားကူးမည်"
                      >
                        {copiedId === s.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        if (window.confirm(isMyanmar ? 'ဤဒိုင်ကြီးလွှဲစလစ်ကို ဖျက်ပစ်ရန် သေချာပါသလား?' : 'Delete this forward slip?')) {
                          deleteForwardSlip(s.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="ဖျက်မည်"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CUSTOMER SALES VOUCHERS SECTION (ဝယ်သူ အရောင်းဘောင်ချာများ) */}
      {/* ========================================================================= */}
      {(activeCategory === 'all' || activeCategory === 'customer') && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-indigo-600" />
              <span>{isMyanmar ? 'ထိုးသူ ဝယ်သူများ၏ အရောင်းဘောင်ချာများ' : 'Customer Sales Vouchers'}</span>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 text-xs font-black rounded-full">
                {displayVouchers.length}
              </span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayVouchers.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-xs">
                <Receipt className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">
                  {isMyanmar ? 'ဘောင်ချာမှတ်တမ်း မရှိသေးပါ' : 'No vouchers found matching criteria'}
                </p>
              </div>
            ) : (
              displayVouchers.map((v) => {
                const isWinningVoucher =
                  activeRound?.winningNumber && v.items.some((i) => i.number === activeRound.winningNumber);

                return (
                  <div
                    key={v.id}
                    className={`bg-white border rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3 transition-all hover:border-slate-300 ${
                      isWinningVoucher
                        ? 'border-amber-400 bg-amber-50/50 ring-1 ring-amber-300'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Header: Voucher No & Customer */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="font-mono font-black text-indigo-700 text-sm tracking-wider">
                          {v.voucherNo}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-500">
                            {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {v.status === 'cancelled' ? (
                            <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                              ပယ်ဖျက်
                            </span>
                          ) : (
                            <button
                              onClick={() => updateVoucher(v.id, { isPaid: !v.isPaid })}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-colors ${
                                v.isPaid
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                              }`}
                            >
                              {v.isPaid ? 'ပေးချေပြီး' : 'ကြွေးကျန်'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {v.customerName}
                        </span>
                        <span className="text-xs text-slate-500">
                          {v.items.length} ကွက်
                        </span>
                      </div>
                    </div>

                    {/* Items List Preview */}
                    <div className="bg-slate-50 rounded-xl p-2.5 max-h-24 overflow-y-auto space-y-1 border border-slate-100 font-mono text-xs">
                      {v.items.map((item, idx) => {
                        const isWin = activeRound?.winningNumber === item.number;
                        return (
                          <div
                            key={idx}
                            className={`flex justify-between items-center px-1.5 py-0.5 rounded ${
                              isWin ? 'bg-amber-200 font-black text-slate-950' : 'text-slate-700'
                            }`}
                          >
                            <span className="font-bold">
                              {item.number} {item.betType === 'rumble' && <span className="text-[10px] text-teal-600">R</span>}
                            </span>
                            <span>{formatAmount(item.amount, settings.currency)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Total & Payable */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between font-mono">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase font-sans">
                          အသားတင် ပေးချေငွေ:
                        </span>
                        <span className="text-base font-black text-emerald-700">
                          {formatAmount(v.netPayable, settings.currency)}
                        </span>
                      </div>
                    </div>

                    {/* Card Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 font-sans">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onOpenPrintVoucher(v)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="ဘောင်ချာ အသေးစိတ် ကြည့်ရှုမည်"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isMyanmar ? 'ကြည့်မည်' : 'View'}</span>
                        </button>

                        <button
                          onClick={() => onOpenPrintVoucher(v)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                          title="ဘောင်ချာ ပရင့်ထုတ်မည်"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{isMyanmar ? 'ပရင့်' : 'Print'}</span>
                        </button>

                        <button
                          onClick={() => handleCopyVoucherText(v)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
                          title="Viber/SMS ပို့ရန် စာသားကူးမည်"
                        >
                          {copiedId === v.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {v.status !== 'cancelled' ? (
                          <button
                            onClick={() => updateVoucher(v.id, { status: 'cancelled' })}
                            className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                            title="ဘောင်ချာ ပယ်ဖျက်မည်"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => deleteVoucher(v.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="စာရင်းမှ လုံးဝဖျက်မည်"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 3D Forward Slip Detail Modal */}
      {selectedForwardSlip && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-white px-5 py-3.5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold">
                  {isMyanmar ? '3D ဒိုင်ကြီးလွှဲစလစ် အသေးစိတ်' : '3D Forward Slip Details'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedForwardSlip(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div className="bg-amber-50/70 border border-amber-100 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">လွှဲစလစ်အမှတ်</span>
                    <span className="font-mono font-black text-sm text-amber-900">{selectedForwardSlip.slipNo}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-bold block">ရက်စွဲ/အချိန်</span>
                    <span className="text-[11px] text-slate-700 font-bold">
                      {new Date(selectedForwardSlip.createdAt).toLocaleString('en-GB')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-slate-600">ဒိုင်ချုပ်:</span>
                    <span className="font-bold text-slate-900">{selectedForwardSlip.masterAgentName}</span>
                  </div>
                  {selectedForwardSlip.masterAgentPhone && (
                    <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{selectedForwardSlip.masterAgentPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Numbers Grid */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                  <span>ဒိုင်ကြီးဆီ လွှဲတင်သည့် 3D ဂဏန်းများ ({selectedForwardSlip.items.length} လုံး)</span>
                  <span>လွှဲငွေ</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 max-h-56 overflow-y-auto space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    {selectedForwardSlip.items.map((item, idx) => {
                      const isHit = activeRound?.winningNumber === item.number;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl border text-xs font-mono transition-all ${
                            isHit
                              ? 'bg-amber-100 border-amber-300 text-slate-950 font-black ring-2 ring-amber-400 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-black text-base text-amber-900">{item.number}</span>
                            {isHit && <Trophy className="w-3 h-3 text-amber-600" />}
                          </div>
                          <span className="font-bold text-slate-700">
                            {formatAmount(item.amount, settings.currency)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3.5 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>စုစုပေါင်း လွှဲတင်ငွေ:</span>
                  <span className="font-bold text-slate-900">{formatAmount(selectedForwardSlip.totalAmount, settings.currency)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>ကော်မရှင် ရငွေ ({selectedForwardSlip.commissionRate}%):</span>
                  <span>+{formatAmount(selectedForwardSlip.commissionAmount, settings.currency)}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-slate-950 pt-1.5 border-t border-amber-200">
                  <span>ဒိုင်သို့ အမှန်ပေးငွေ:</span>
                  <span className="text-amber-900 font-black text-base">{formatAmount(selectedForwardSlip.netPaid, settings.currency)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleCopyForwardSlipText(selectedForwardSlip)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-slate-300 transition-colors cursor-pointer"
                >
                  {copiedId === selectedForwardSlip.id ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-700">ကူးယူပြီးပါပြီ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-slate-600" />
                      <span>Viber စာသားကူးမည်</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>ပရင့်ထုတ်</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedForwardSlip(null)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  ပိတ်မည်
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
