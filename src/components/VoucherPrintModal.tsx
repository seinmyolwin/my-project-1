import React, { useRef } from 'react';
import {
  X,
  Printer,
  Copy,
  Check,
  Share2,
  Receipt,
  Download,
  Calendar,
  User,
  Phone
} from 'lucide-react';
import { Voucher } from '../types';
import { useLottery } from '../context/LotteryContext';
import { formatAmount } from '../utils/lotteryUtils';

interface VoucherPrintModalProps {
  voucher: Voucher | null;
  onClose: () => void;
}

export const VoucherPrintModal: React.FC<VoucherPrintModalProps> = ({ voucher, onClose }) => {
  const { settings, activeRound } = useLottery();
  const [copied, setCopied] = React.useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  if (!voucher) return null;

  const isMyanmar = settings.language === 'my';

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const lines = voucher.items
      .map(i => `${i.number} = ${formatAmount(i.amount, settings.currency)}`)
      .join('\n');

    const text = `🧾 ${settings.shopName}
ဘောင်ချာအမှတ်: ${voucher.voucherNo}
ပွဲစဉ်: ${activeRound?.name || '-'}
ရက်စွဲ: ${new Date(voucher.createdAt).toLocaleString()}
ဝယ်သူ: ${voucher.customerName} ${voucher.customerPhone ? `(${voucher.customerPhone})` : ''}
--------------------------------
${lines}
--------------------------------
စုစုပေါင်း: ${formatAmount(voucher.subtotal, settings.currency)}
${voucher.discountAmount > 0 ? `လျှော့ငွေ (${voucher.discountPercent}%): -${formatAmount(voucher.discountAmount, settings.currency)}\n` : ''}အသားတင် ကျသင့်ငွေ: ${formatAmount(voucher.netPayable, settings.currency)}
ငွေပေးချေမှု: ${voucher.isPaid ? 'ငွေပေးချေပြီး' : 'ကြွေးကျန်'}

${settings.voucherFooterMessage || 'ကျေးဇူးတင်ပါသည်'}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-slate-50 px-4 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">
              {isMyanmar ? 'ဘောင်ချာ ပရင့်ထုတ်ယူရန်' : 'Print / Share Voucher'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Printable Thermal Receipt Container */}
        <div className="p-4 sm:p-6 bg-slate-50/50 flex justify-center">
          <div
            ref={printRef}
            id="printable-voucher"
            className="w-full max-w-[340px] bg-white text-slate-900 p-5 rounded-xl shadow-xs font-mono text-xs space-y-3.5 border border-slate-200"
          >
            {/* Shop Header */}
            <div className="text-center space-y-0.5 border-b border-dashed border-slate-300 pb-3">
              <h2 className="font-bold text-base tracking-tight font-sans text-slate-950">
                {settings.shopName}
              </h2>
              {settings.shopPhone && (
                <p className="text-[11px] text-slate-600 font-sans">
                  ဖုန်း: {settings.shopPhone}
                </p>
              )}
              {settings.shopAddress && (
                <p className="text-[10px] text-slate-500 font-sans">
                  {settings.shopAddress}
                </p>
              )}
              <div className="pt-1">
                <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-800 rounded text-[10px] font-bold">
                  အိုးစည်လေး အရောင်းပြေစာ
                </span>
              </div>
            </div>

            {/* Voucher Metadata */}
            <div className="space-y-1 text-[11px] text-slate-700 border-b border-dashed border-slate-300 pb-2.5">
              <div className="flex justify-between">
                <span className="text-slate-500">ဘောင်ချာအမှတ်:</span>
                <span className="font-bold text-slate-950">{voucher.voucherNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ရက်စွဲ:</span>
                <span>{new Date(voucher.createdAt).toLocaleString('en-GB')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ဝယ်သူအမည်:</span>
                <span className="font-bold text-slate-900 font-sans">{voucher.customerName}</span>
              </div>
              {voucher.customerPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-500">ဖုန်း:</span>
                  <span>{voucher.customerPhone}</span>
                </div>
              )}
              {activeRound && (
                <div className="flex justify-between">
                  <span className="text-slate-500">ပွဲစဉ်:</span>
                  <span className="font-sans">{activeRound.name}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="space-y-1.5 border-b border-dashed border-slate-300 pb-3">
              <div className="flex justify-between font-bold text-[11px] text-slate-900 border-b border-slate-200 pb-1">
                <span>ဂဏန်း</span>
                <span>ထိုးကြေးငွေ</span>
              </div>

              <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                {voucher.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="font-bold tracking-widest text-slate-900">
                      {item.number} {item.betType === 'rumble' ? '(R)' : ''}
                    </span>
                    <span className="font-bold">
                      {formatAmount(item.amount, settings.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>စုစုပေါင်း:</span>
                <span>{formatAmount(voucher.subtotal, settings.currency)}</span>
              </div>
              {voucher.discountAmount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>လျှော့ငွေ ({voucher.discountPercent}%):</span>
                  <span>-{formatAmount(voucher.discountAmount, settings.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm text-slate-950 pt-1 border-t border-slate-300">
                <span>ကျသင့်ငွေ စုစုပေါင်း:</span>
                <span>{formatAmount(voucher.netPayable, settings.currency)}</span>
              </div>
            </div>

            {/* Barcode Mock Visual & Footer Notice */}
            <div className="text-center pt-2 space-y-1.5 border-t border-dashed border-slate-300">
              <div className="h-6 bg-slate-900 flex items-center justify-center text-white text-[9px] tracking-widest uppercase rounded">
                |||| | |||||| || ||||| |||||
              </div>
              <p className="text-[10px] text-slate-500 font-sans leading-tight">
                {settings.voucherFooterMessage || 'ဘောင်ချာအား ပေါက်ဂဏန်းထွက်သည်အထိ သိမ်းဆည်းထားပါ'}
              </p>
            </div>

          </div>
        </div>

        {/* Modal Actions */}
        <div className="bg-slate-50 px-4 py-3 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            onClick={handleCopyText}
            className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
            <span>{copied ? 'စာသား ကူးပြီးပါပြီ' : 'Viber/SMS စာသားကူးမည်'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{isMyanmar ? 'ပရင့်ထုတ်မည် (Print)' : 'Print Voucher'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
