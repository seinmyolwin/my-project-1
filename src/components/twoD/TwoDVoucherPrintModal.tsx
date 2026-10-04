import React, { useRef, useState } from 'react';
import {
  X,
  Printer,
  Copy,
  Check,
  Share2,
  Receipt,
  Calendar,
  User,
  Phone
} from 'lucide-react';
import { TwoDVoucher } from '../../types';
import { useTwoDLottery } from '../../context/TwoDLotteryContext';
import { formatAmount } from '../../utils/lotteryUtils';

interface TwoDVoucherPrintModalProps {
  voucher: TwoDVoucher | null;
  onClose: () => void;
}

export const TwoDVoucherPrintModal: React.FC<TwoDVoucherPrintModalProps> = ({ voucher, onClose }) => {
  const { settings, activeRound } = useTwoDLottery();
  const [copied, setCopied] = useState(false);
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

    const text = `🧾 ${settings.shopName} (၂ လုံး မှတ်တမ်း)
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

${settings.voucherFooterMessage || 'ကံကောင်းပါစေ - ကျေးဇူးတင်ပါသည်'}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-200">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-teal-600" />
            <h3 className="text-base font-black text-slate-900">
              {isMyanmar ? '၂ လုံး အရောင်းဘောင်ချာ' : '2D Voucher Slip'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Slip */}
        <div
          ref={printRef}
          className="bg-slate-50 border border-slate-200 rounded-2xl p-4 font-mono text-xs space-y-3 print:border-none print:p-0"
        >
          <div className="text-center space-y-0.5">
            <h4 className="font-black text-base text-slate-900">{settings.shopName}</h4>
            <p className="text-[11px] text-slate-500 font-bold">၂ လုံး ထီ အရောင်းပြေစာ</p>
            {settings.shopPhone && <p className="text-[10px] text-slate-400">{settings.shopPhone}</p>}
            <p className="text-[10px] text-slate-400 mt-1">{voucher.voucherNo}</p>
          </div>

          <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>ပွဲစဉ်:</span>
              <span className="font-bold">{activeRound?.name || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span>ရက်စွဲ:</span>
              <span>{new Date(voucher.createdAt).toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between">
              <span>ဝယ်သူ:</span>
              <span className="font-bold">{voucher.customerName}</span>
            </div>
          </div>

          {/* Numbers list */}
          <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 max-h-48 overflow-y-auto">
            {voucher.items.map((it, idx) => (
              <div key={idx} className="flex justify-between">
                <span className="font-bold text-slate-900">{it.number}</span>
                <span>{formatAmount(it.amount, settings.currency)}</span>
              </div>
            ))}
          </div>

          {/* Financial summary */}
          <div className="border-t border-dashed border-slate-300 pt-2 space-y-1 font-bold">
            <div className="flex justify-between text-slate-600">
              <span>စုစုပေါင်း:</span>
              <span>{formatAmount(voucher.subtotal, settings.currency)}</span>
            </div>
            {voucher.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>လျှော့ငွေ ({voucher.discountPercent}%):</span>
                <span>-{formatAmount(voucher.discountAmount, settings.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-900 text-sm pt-1 border-t border-slate-200">
              <span>ကျသင့်ငွေ:</span>
              <span className="text-teal-700">{formatAmount(voucher.netPayable, settings.currency)}</span>
            </div>
          </div>

          <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-dashed border-slate-300">
            {settings.voucherFooterMessage || 'ကံကောင်းပါစေ - ကျေးဇူးတင်ပါသည်'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCopyText}
            className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'ကူးယူပြီး' : 'Viber/SMS Copy'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
        </div>
      </div>
    </div>
  );
};
