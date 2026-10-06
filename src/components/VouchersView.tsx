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
  Eye
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { Voucher } from '../types';
import { formatAmount } from '../utils/lotteryUtils';

interface VouchersViewProps {
  onOpenPrintVoucher: (voucher: Voucher) => void;
}

export const VouchersView: React.FC<VouchersViewProps> = ({ onOpenPrintVoucher }) => {
  const {
    activeRound,
    settings,
    activeRoundVouchers,
    deleteVoucher,
    updateVoucher,
    exportToExcel
  } = useLottery();

  const isMyanmar = settings.language === 'my';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPaid, setFilterPaid] = useState<'all' | 'paid' | 'unpaid' | 'cancelled'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filtered Vouchers
  const displayVouchers = useMemo(() => {
    return activeRoundVouchers.filter(v => {
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
        const matchesBet = v.items.some(item => item.number.includes(q));
        return matchesName || matchesNo || matchesPhone || matchesBet;
      }
      return true;
    });
  }, [activeRoundVouchers, filterPaid, searchQuery]);

  // Copy raw voucher text for Viber/SMS
  const handleCopyVoucherText = (v: Voucher) => {
    const lines = v.items.map(i => `${i.number} = ${formatAmount(i.amount, settings.currency)}`).join('\n');
    const text = `🧾 ${settings.shopName}
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

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      
      {/* Top Search & Filter Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold border border-indigo-100">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {isMyanmar ? 'ဘောင်ချာနှင့် ပြေစာများ မှတ်တမ်း' : 'Vouchers & Sales Invoices'}
              </h2>
              <p className="text-xs text-slate-500">
                {isMyanmar ? 'ရောင်းချထားသော ဘောင်ချာများ ကြည့်ရှုခြင်း၊ ပရင့်ထုတ်ခြင်းနှင့် မျှဝေခြင်း' : 'View, print and share created customer slips'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{isMyanmar ? 'ဘောင်ချာများ Excel ထုတ်မည်' : 'Export Excel'}</span>
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isMyanmar ? 'ဘောင်ချာအမှတ်၊ ဝယ်သူအမည်၊ ဂဏန်းဖြင့်ရှာရန်' : 'Search by voucher no, customer, number...'}
              className="w-full bg-slate-50 focus:bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-500 transition-colors shadow-2xs"
            />
          </div>

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
              {isMyanmar ? 'ငွေမပေးရသေး (ကြွေးကျန်)' : 'Unpaid'}
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

        </div>
      </div>

      {/* Vouchers List Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayVouchers.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <Receipt className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">
              {isMyanmar ? 'ဘောင်ချာမှတ်တမ်း မရှိသေးပါ' : 'No vouchers found matching criteria'}
            </p>
          </div>
        ) : (
          displayVouchers.map((v) => {
            const isWinningVoucher = activeRound?.winningNumber && v.items.some(i => i.number === activeRound.winningNumber);

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
                          {v.isPaid ? 'ငွေပေးပြီး' : 'ကြွေးကျန်'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-900 font-semibold">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{v.customerName}</span>
                    </div>
                    {v.customerPhone && (
                      <span className="text-[11px] font-mono text-slate-500">
                        {v.customerPhone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Items Preview Chips */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <span>ထိုးဂဏန်းများ ({v.items.length} ခု)</span>
                    <span>ပမာဏ</span>
                  </div>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto no-scrollbar">
                    {v.items.map((item, idx) => {
                      const isHit = activeRound?.winningNumber === item.number;
                      return (
                        <div
                          key={idx}
                          className={`px-2 py-0.5 rounded text-xs font-mono font-bold flex items-center gap-1.5 ${
                            isHit
                              ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-300'
                              : 'bg-white text-slate-800 border border-slate-200 shadow-2xs'
                          }`}
                        >
                          <span>{item.number}</span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            ={item.amount}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Total & Discount */}
                <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-xs font-mono">
                  <div>
                    {v.discountAmount > 0 && (
                      <span className="text-[10px] text-amber-600 block">
                        လျှော့ငွေ: -{formatAmount(v.discountAmount, settings.currency)}
                      </span>
                    )}
                    <span className="text-slate-500 block text-[10px] font-sans">
                      အသားတင် ပေးချေငွေ:
                    </span>
                  </div>
                  <span className="text-base font-black text-emerald-700">
                    {formatAmount(v.netPayable, settings.currency)}
                  </span>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 font-sans">
                  <div className="flex items-center gap-1">
                    {/* View on screen button */}
                    <button
                      onClick={() => onOpenPrintVoucher(v)}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="ဘောင်ချာ အသေးစိတ် ကြည့်ရှုမည်"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{isMyanmar ? 'ကြည့်မည်' : 'View'}</span>
                    </button>

                    {/* Print Receipt Modal Button */}
                    <button
                      onClick={() => onOpenPrintVoucher(v)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      title="ဘောင်ချာ ပရင့်ထုတ်မည်"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{isMyanmar ? 'ပရင့်' : 'Print'}</span>
                    </button>

                    {/* Copy Text for Viber/SMS */}
                    <button
                      onClick={() => handleCopyVoucherText(v)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
                      title="Viber/SMS ပို့ရန် စာသားကူးမည်"
                    >
                      {copiedId === v.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Cancel / Delete */}
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
  );
};
