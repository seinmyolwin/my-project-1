import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Search,
  Printer,
  Trash2,
  CheckCircle2,
  Calendar,
  Phone,
  User,
  X,
  Share2,
  FileSpreadsheet,
  Eye,
  Copy,
  Check,
  Trophy,
  Layers
} from 'lucide-react';
import { useTwoDLottery } from '../../context/TwoDLotteryContext';
import { TwoDVoucher } from '../../types';
import { formatAmount } from '../../utils/lotteryUtils';

export const TwoDVouchersView: React.FC = () => {
  const {
    settings,
    activeRound,
    activeRoundVouchers,
    deleteVoucher,
    exportToExcel
  } = useTwoDLottery();

  const isMyanmar = settings.language === 'my';

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState<TwoDVoucher | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredVouchers = useMemo(() => {
    let list = activeRoundVouchers;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(v =>
        v.voucherNo.toLowerCase().includes(q) ||
        v.customerName.toLowerCase().includes(q) ||
        (v.customerPhone && v.customerPhone.includes(q)) ||
        v.items.some(it => it.number.includes(q))
      );
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activeRoundVouchers, searchTerm]);

  // Copy text for Viber
  const handleCopySlipText = (v: TwoDVoucher) => {
    const lines = v.items
      .map(i => `${i.number} = ${formatAmount(i.amount, settings.currency)}`)
      .join('\n');

    const text = `🧾 ${settings.shopName || 'ဇီးကွက်'}
ဘောင်ချာအမှတ်: ${v.voucherNo}
ပွဲစဉ်: ${activeRound?.name || '-'}
ရက်စွဲ: ${new Date(v.createdAt).toLocaleString('en-GB')}
ဝယ်သူ: ${v.customerName} ${v.customerPhone ? `(${v.customerPhone})` : ''}
--------------------------------
${lines}
--------------------------------
စုစုပေါင်း: ${formatAmount(v.subtotal, settings.currency)}
${v.discountAmount > 0 ? `လျှော့ငွေ (${v.discountPercent}%): -${formatAmount(v.discountAmount, settings.currency)}\n` : ''}အသားတင် ကျသင့်ငွေ: ${formatAmount(v.netPayable, settings.currency)}

${settings.voucherFooterMessage || 'ကံကောင်းပါစေ - ကျေးဇူးတင်ပါသည်'}`;

    navigator.clipboard.writeText(text);
    setCopiedId(v.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Header and Search */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-teal-600" />
            <span>{isMyanmar ? 'ဇီးကွက် အရောင်းဘောင်ချာများ စာရင်း' : 'Sales Vouchers'}</span>
            <span className="px-2.5 py-0.5 bg-teal-100 text-teal-800 text-xs font-black rounded-full">
              {filteredVouchers.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            {activeRound?.name} ({activeRound?.session === 'morning' ? 'မနက် ၁၂:၀၁' : 'ညနေ ၀၄:၃၀'})
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder={isMyanmar ? 'ဘောင်ချာအမှတ် / ဖောက်သည် / ဂဏန်း...' : 'Search voucher or number...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-3 text-xs rounded-xl border border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-200 bg-slate-50"
            />
          </div>

          <button
            type="button"
            onClick={exportToExcel}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>{isMyanmar ? 'Excel ထုတ်' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* Vouchers List / Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredVouchers.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Receipt className="w-10 h-10 mx-auto stroke-1" />
            <p className="text-sm font-medium">
              {isMyanmar ? 'ဘောင်ချာမှတ်တမ်း မရှိသေးပါ' : 'No vouchers found.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">ဘောင်ချာအမှတ်</th>
                  <th className="p-3.5">ထိုးသူအမည်</th>
                  <th className="p-3.5">ဖုန်းနံပါတ်</th>
                  <th className="p-3.5 text-center">ဂဏန်းအရေအတွက်</th>
                  <th className="p-3.5 text-right">စုစုပေါင်းငွေ</th>
                  <th className="p-3.5 text-right">ကျသင့်ငွေ</th>
                  <th className="p-3.5">အချိန်</th>
                  <th className="p-3.5 text-center">လုပ်ဆောင်ချက်</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredVouchers.map(v => (
                  <tr
                    key={v.id}
                    onClick={() => setSelectedVoucher(v)}
                    className="hover:bg-teal-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="p-3.5 font-bold text-teal-700">{v.voucherNo}</td>
                    <td className="p-3.5 font-sans font-bold text-slate-900">{v.customerName}</td>
                    <td className="p-3.5 text-slate-500 font-sans">{v.customerPhone || '-'}</td>
                    <td className="p-3.5 text-center font-bold">
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md text-slate-700">
                        {v.items.length} ကွက်
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-700">
                      {formatAmount(v.subtotal, settings.currency)}
                    </td>
                    <td className="p-3.5 text-right font-black text-slate-900 text-sm">
                      {formatAmount(v.netPayable, settings.currency)}
                    </td>
                    <td className="p-3.5 text-slate-400 font-sans text-[11px]">
                      {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {/* 1. View on screen */}
                        <button
                          type="button"
                          onClick={() => setSelectedVoucher(v)}
                          title={isMyanmar ? 'ပြေစာ အသေးစိတ် ကြည့်ရှုမည်' : 'View Voucher Slip'}
                          className="px-2.5 py-1 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isMyanmar ? 'ကြည့်မည်' : 'View'}</span>
                        </button>

                        {/* 2. Copy for Viber */}
                        <button
                          type="button"
                          onClick={() => handleCopySlipText(v)}
                          title="Viber ပို့ရန် စာသားကူးမည်"
                          className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        >
                          {copiedId === v.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        {/* 3. Delete */}
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(isMyanmar ? 'ဤဘောင်ချာကို ဖျက်ပစ်ရန် သေချာပါသလား?' : 'Delete this voucher?')) {
                              deleteVoucher(v.id);
                            }
                          }}
                          title="Delete Voucher"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* On-Screen Detailed Voucher Viewer Modal (No printing required!) */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Top Header */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-bold">
                  {isMyanmar ? 'ပြေစာမှတ်တမ်း အသေးစိတ်' : 'Voucher Details'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVoucher(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Slip On-Screen Card View */}
            <div className="p-4 sm:p-5 space-y-4">
              {/* Slip Header Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">ဘောင်ချာအမှတ်</span>
                    <span className="font-mono font-black text-sm text-teal-700">{selectedVoucher.voucherNo}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-bold block">ရက်စွဲ/အချိန်</span>
                    <span className="text-[11px] text-slate-700 font-bold">
                      {new Date(selectedVoucher.createdAt).toLocaleString('en-GB')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-600">ထိုးသူ:</span>
                    <span className="font-bold text-slate-900">{selectedVoucher.customerName}</span>
                  </div>
                  {selectedVoucher.customerPhone && (
                    <div className="flex items-center gap-1 text-slate-500 text-[11px]">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{selectedVoucher.customerPhone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Numbers Grid (Scrollable on Screen) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                  <span>ထိုးထားသော ဂဏန်းများ ({selectedVoucher.items.length} ကွက်)</span>
                  <span>ထိုးကြေးငွေ</span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 max-h-56 overflow-y-auto space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    {selectedVoucher.items.map((item, idx) => {
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
                            <span className="font-black text-base text-slate-950">{item.number}</span>
                            {item.isRumble && (
                              <span className="text-[9px] bg-teal-100 text-teal-800 font-bold px-1 rounded">
                                R
                              </span>
                            )}
                            {isHit && (
                              <Trophy className="w-3 h-3 text-amber-600" />
                            )}
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

              {/* Total Calculation Card */}
              <div className="bg-teal-50/80 border border-teal-200 rounded-2xl p-3.5 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>စုစုပေါင်း ထိုးကြေး:</span>
                  <span className="font-bold text-slate-800">{formatAmount(selectedVoucher.subtotal, settings.currency)}</span>
                </div>
                {selectedVoucher.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>ကော်မရှင် / လျှော့ငွေ ({selectedVoucher.discountPercent}%):</span>
                    <span>-{formatAmount(selectedVoucher.discountAmount, settings.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-950 pt-1.5 border-t border-teal-200">
                  <span>အသားတင် ပေးချေငွေ:</span>
                  <span className="text-teal-800 font-black text-base">{formatAmount(selectedVoucher.netPayable, settings.currency)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                {/* Copy for Viber */}
                <button
                  type="button"
                  onClick={() => handleCopySlipText(selectedVoucher)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 border border-slate-300 transition-colors cursor-pointer"
                >
                  {copiedId === selectedVoucher.id ? (
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

                {/* Optional Print */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>ပရင့်ထုတ်</span>
                </button>

                {/* Close */}
                <button
                  type="button"
                  onClick={() => setSelectedVoucher(null)}
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
