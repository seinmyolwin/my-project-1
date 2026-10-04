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
  FileSpreadsheet
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

  const filteredVouchers = useMemo(() => {
    let list = activeRoundVouchers;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(v =>
        v.voucherNo.toLowerCase().includes(q) ||
        v.customerName.toLowerCase().includes(q) ||
        (v.customerPhone && v.customerPhone.includes(q))
      );
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activeRoundVouchers, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Header and Search */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
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
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder={isMyanmar ? 'ဘောင်ချာအမှတ် / ဖောက်သည်အမည်...' : 'Search voucher...'}
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
            <span>{isMyanmar ? 'Excel စာရင်းထုတ်' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* Vouchers Table */}
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
                  <tr key={v.id} className="hover:bg-slate-50 transition-colors">
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
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedVoucher(v)}
                          title="View / Print Voucher"
                          className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
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
                          <Trash2 className="w-4 h-4" />
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

      {/* Receipt Modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <span className="text-xs font-black text-slate-500">2D THERMAL RECEIPT</span>
              <button
                type="button"
                onClick={() => setSelectedVoucher(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Thermal Slip Content */}
            <div className="font-mono text-xs space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="text-center space-y-1">
                <h4 className="font-black text-sm text-slate-900">{settings.shopName}</h4>
                <p className="text-[11px] text-slate-500">{activeRound?.name}</p>
                <p className="text-[10px] text-slate-400">{selectedVoucher.voucherNo}</p>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-bold">{selectedVoucher.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(selectedVoucher.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1.5 max-h-48 overflow-y-auto">
                {selectedVoucher.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span className="font-bold text-sm text-slate-900">{item.number}</span>
                    <span>{formatAmount(item.amount, settings.currency)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 font-bold">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span>{formatAmount(selectedVoucher.subtotal, settings.currency)}</span>
                </div>
                {selectedVoucher.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount ({selectedVoucher.discountPercent}%):</span>
                    <span>-{formatAmount(selectedVoucher.discountAmount, settings.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 text-sm pt-1 border-t border-slate-200">
                  <span>NET PAYABLE:</span>
                  <span className="text-teal-700">{formatAmount(selectedVoucher.netPayable, settings.currency)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedVoucher(null)}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
