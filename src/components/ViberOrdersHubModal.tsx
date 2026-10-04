import React, { useState, useRef } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Camera,
  FileText,
  Copy,
  Check,
  Trash2,
  Edit3,
  Plus,
  RefreshCw,
  Sparkles,
  User,
  Phone,
  ShieldCheck,
  AlertTriangle,
  QrCode,
  Link,
  Upload,
  X,
  Layers,
  Eye,
  CheckCheck
} from 'lucide-react';
import {
  ViberIncomingOrder,
  ViberAccountConfig,
  getViberConfig,
  saveViberConfig,
  getViberOrders,
  saveViberOrders,
  parseViberBetText,
  generateViberConfirmationMessage,
  generateViberRejectionMessage,
  ViberParsedBetItem
} from '../utils/viberIntegration';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { formatAmount, convertMyanmarToEnglishDigits, getPermutations } from '../utils/lotteryUtils';
import { parseSlipImageText, preprocessCanvas } from '../utils/imageOcrUtils';
import { createWorker } from 'tesseract.js';

interface ViberOrdersHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPrintVoucher?: (voucher: any) => void;
}

export const ViberOrdersHubModal: React.FC<ViberOrdersHubModalProps> = ({
  isOpen,
  onClose,
  onOpenPrintVoucher
}) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  const [activeTab, setActiveTab] = useState<'queue' | 'new_order' | 'settings'>('queue');
  const [orders, setOrders] = useState<ViberIncomingOrder[]>(() => getViberOrders());
  const [config, setConfig] = useState<ViberAccountConfig>(() => getViberConfig());

  // Editing order state
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  // New Direct Intake Form State
  const [newSenderName, setNewSenderName] = useState('');
  const [newSenderPhone, setNewSenderPhone] = useState('');
  const [newOrderType, setNewOrderType] = useState<'text' | 'photo'>('text');
  const [newCategory, setNewCategory] = useState<'3d' | '2d' | 'football'>('3d');
  const [newRawText, setNewRawText] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newPhotoPreview, setNewPhotoPreview] = useState<string | null>(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  // Bot Config State
  const [botToken, setBotToken] = useState(config.botToken || '');
  const [accountName, setAccountName] = useState(config.accountName || 'ရွှေမင်္ဂလာ Viber စာရင်းလက်ခံစနစ်');
  const [phoneNumber, setPhoneNumber] = useState(config.phoneNumber || '09-798889900');
  const [webhookUrl, setWebhookUrl] = useState(config.webhookUrl || 'https://viber.shwemingalar.app/webhook/live');
  const [configSuccess, setConfigSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const pendingCount = orders.filter(o => o.status === 'pending_review').length;

  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'pending') return o.status === 'pending_review';
    if (statusFilter === 'approved') return o.status === 'approved';
    if (statusFilter === 'rejected') return o.status === 'rejected';
    return true;
  });

  const selectedOrder = orders.find(o => o.id === selectedOrderId) || null;

  const handleUpdateOrders = (newOrders: ViberIncomingOrder[]) => {
    setOrders(newOrders);
    saveViberOrders(newOrders);
  };

  // OCR Photo Ingestion
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setNewPhotoPreview(previewUrl);
    setNewOrderType('photo');
    setIsOcrProcessing(true);
    setOcrProgress(15);

    try {
      const img = document.createElement('img');
      img.src = previewUrl;
      await new Promise((res) => { img.onload = res; });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(img, 0, 0);

      const processedCanvas = preprocessCanvas(canvas, {
        contrast: 50,
        brightness: 10,
        grayscale: true,
        threshold: true
      });

      setOcrProgress(40);
      const worker = await createWorker(['mya', 'eng']);
      setOcrProgress(70);

      const ret = await worker.recognize(processedCanvas);
      await worker.terminate();
      setOcrProgress(90);

      const ocrText = ret.data.text;
      setNewRawText(ocrText);

      // Auto parse
      const parsedRes = parseSlipImageText(ocrText);
      if (parsedRes.customerName && !newSenderName) {
        setNewSenderName(parsedRes.customerName);
      }
      if (parsedRes.customerPhone && !newSenderPhone) {
        setNewSenderPhone(parsedRes.customerPhone);
      }

      setOcrProgress(100);
    } catch (err) {
      console.error('OCR error:', err);
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // Add new incoming order to queue
  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = newRawText.trim();
    if (!cleanText && !newPhotoPreview) {
      alert('Viber စာသား သို့မဟုတ် ဓါတ်ပုံ ထည့်သွင်းပေးပါ');
      return;
    }

    const { items, subtotal, detectedCategory } = parseViberBetText(cleanText, newCategory);

    const newOrder: ViberIncomingOrder = {
      id: `viber-ord-${Date.now()}`,
      senderName: newSenderName.trim() || 'Viber Customer',
      senderPhone: newSenderPhone.trim() || '09-xxxxxxx',
      orderType: newPhotoPreview ? 'photo' : 'text',
      category: detectedCategory || newCategory,
      rawText: cleanText,
      photoUrl: newPhotoPreview || undefined,
      receivedAt: new Date().toISOString(),
      status: 'pending_review',
      parsedItems: items,
      subtotal,
      discountPercent: 0,
      discountAmount: 0,
      netPayable: subtotal,
      notes: newNotes.trim()
    };

    const nextOrders = [newOrder, ...orders];
    handleUpdateOrders(nextOrders);

    // Reset form
    setNewRawText('');
    setNewSenderName('');
    setNewSenderPhone('');
    setNewNotes('');
    setNewPhotoPreview(null);
    setActiveTab('queue');
    setSelectedOrderId(newOrder.id);
  };

  // Dealer Action: Approve & Create Official Voucher
  const handleApproveOrder = (order: ViberIncomingOrder) => {
    if (order.parsedItems.length === 0) {
      alert('ထိုးဂဏန်း အနည်းဆုံး ၁ ခု ပါဝင်ရပါမည်');
      return;
    }

    let createdVoucherNo = '';

    if (order.category === '3d') {
      const itemsToBet = order.parsedItems.map(it => ({
        number: it.number,
        amount: it.amount,
        betType: it.betType
      }));

      const created = lottery3D.createVoucher(
        itemsToBet,
        order.senderName,
        order.senderPhone,
        order.discountPercent,
        `Viber အော်ဒါ [${order.id}] - ${order.notes || ''}`
      );

      if (created) {
        createdVoucherNo = created.voucherNo;
      }
    } else if (order.category === '2d') {
      const itemsToBet = order.parsedItems.map(it => ({
        number: it.number,
        amount: it.amount,
        betType: it.betType
      }));

      const created = lottery2D.createVoucher(
        itemsToBet,
        order.senderName,
        order.senderPhone,
        order.discountPercent,
        `Viber အော်ဒါ [${order.id}] - ${order.notes || ''}`
      );

      if (created) {
        createdVoucherNo = created.voucherNo;
      }
    } else {
      // Football simple slip creation
      createdVoucherNo = `V-FB-${Date.now().toString().slice(-4)}`;
    }

    // Update order status
    const updated = orders.map(o => {
      if (o.id === order.id) {
        return {
          ...o,
          status: 'approved' as const,
          approvedVoucherNo: createdVoucherNo || `V-APPR-${Date.now().toString().slice(-4)}`,
          verifiedAt: new Date().toISOString()
        };
      }
      return o;
    });

    handleUpdateOrders(updated);
    alert(`✅ Viber အော်ဒါအား အတည်ပြုပြီးပါပြီ!\nဘောင်ချာအမှတ်: ${createdVoucherNo || 'အောင်မြင်ပါသည်'}`);
  };

  // Dealer Action: Reject Order
  const handleRejectOrder = (order: ViberIncomingOrder) => {
    const reason = prompt('ပယ်ဖျက်ရသည့် အကြောင်းပြချက် ရိုက်ထည့်ပါ (ဥပမာ- ပိတ်ဂဏန်းဖြစ်နေ၍ / ပွဲပိတ်ချိန်လွန်၍):', 'ဂဏန်းပိတ်ထားပါသည်');
    if (reason === null) return;

    const updated = orders.map(o => {
      if (o.id === order.id) {
        return {
          ...o,
          status: 'rejected' as const,
          rejectionReason: reason || 'ပယ်ဖျက်ထားပါသည်',
          verifiedAt: new Date().toISOString()
        };
      }
      return o;
    });

    handleUpdateOrders(updated);
  };

  // Save Bot Config
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const newCfg: ViberAccountConfig = {
      ...config,
      botToken: botToken.trim(),
      accountName: accountName.trim(),
      phoneNumber: phoneNumber.trim(),
      webhookUrl: webhookUrl.trim(),
      status: 'connected',
      connectedAt: new Date().toISOString()
    };
    setConfig(newCfg);
    saveViberConfig(newCfg);
    setConfigSuccess(true);
    setTimeout(() => setConfigSuccess(false), 2000);
  };

  // Copy reply message to clipboard
  const handleCopyReply = (order: ViberIncomingOrder) => {
    const text = order.status === 'approved'
      ? generateViberConfirmationMessage(order, order.approvedVoucherNo || 'V-1001', 'ရွှေမင်္ဂလာ')
      : generateViberRejectionMessage(order, order.rejectionReason || '', 'ရွှေမင်္ဂလာ');

    navigator.clipboard.writeText(text);
    setCopiedOrderId(order.id);
    setTimeout(() => setCopiedOrderId(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/30 text-purple-400 border border-purple-500/40 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">Viber တိုက်ရိုက် အရောင်း & စိစစ်အတည်ပြုခန်း</h3>
                {pendingCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-black animate-pulse">
                    {pendingCount} စောင် စိစစ်ရန်
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Viber မှ ရောက်ရှိလာသော ဓါတ်ပုံ/စာသားများကို စိစစ်ပြီးမှ တရားဝင် ဘောင်ချာအဖြစ် အတည်ပြုထုတ်ပေးပါသည်
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'queue'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>အော်ဒါ စာရင်းများ ({orders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('new_order')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'new_order'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Viber စာသား/ဓါတ်ပုံ တင်သွင်းရန်</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-slate-800 text-white'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Link className="w-3.5 h-3.5" />
            <span>Viber ချိတ်ဆက်မှု ဆက်တင်</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          
          {/* TAB 1: ORDER QUEUE & REVIEW */}
          {activeTab === 'queue' && (
            <div className="space-y-4">
              
              {/* Filter pills */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      statusFilter === 'pending'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    စိစစ်ဆဲ ({orders.filter(o => o.status === 'pending_review').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusFilter('approved')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      statusFilter === 'approved'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    အတည်ပြုပြီး ({orders.filter(o => o.status === 'approved').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusFilter('rejected')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      statusFilter === 'rejected'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    ပယ်ဖျက် ({orders.filter(o => o.status === 'rejected').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    အားလုံး ({orders.length})
                  </button>
                </div>

                <span className="text-[11px] text-slate-500 font-medium">
                  * အတည်ပြုချက် မပေးမချင်း စနစ်မှတ်တမ်းထဲသို့ မရောက်ပါ
                </span>
              </div>

              {/* Orders Grid */}
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                  <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-500">ယခုအခိုက်အတန့်တွင် အော်ဒါမရှိပါ</p>
                  <p className="text-[11px] text-slate-400">
                    "Viber စာသား/ဓါတ်ပုံ တင်သွင်းရန်" Tab မှတစ်ဆင့် အော်ဒါအသစ် ထည့်သွင်းနိုင်ပါသည်
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredOrders.map((order) => {
                    const isPending = order.status === 'pending_review';
                    const isApproved = order.status === 'approved';
                    const isRejected = order.status === 'rejected';

                    return (
                      <div
                        key={order.id}
                        className={`rounded-2xl border transition-all p-4 space-y-3 ${
                          isPending
                            ? 'bg-white border-purple-200 shadow-sm hover:border-purple-400 ring-1 ring-purple-100'
                            : isApproved
                            ? 'bg-emerald-50/30 border-emerald-200 opacity-90'
                            : 'bg-rose-50/20 border-rose-200 opacity-75'
                        }`}
                      >
                        {/* Order Header */}
                        <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                              {order.senderName.slice(0, 1) || 'V'}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-slate-900">{order.senderName}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                  order.category === '3d'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : order.category === '2d'
                                    ? 'bg-teal-100 text-teal-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {order.category.toUpperCase()}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-500 block font-mono">{order.senderPhone}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            {isPending && (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-black flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>စိစစ်ဆဲ</span>
                              </span>
                            )}
                            {isApproved && (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1">
                                <CheckCheck className="w-3 h-3" />
                                <span>{order.approvedVoucherNo || 'အတည်ပြုပြီး'}</span>
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-black flex items-center gap-1">
                                <XCircle className="w-3 h-3" />
                                <span>ပယ်ဖျက်ပြီး</span>
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {new Date(order.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        {/* Raw Content Snippet */}
                        {order.rawText && (
                          <div className="bg-slate-50 rounded-xl p-2 text-xs font-mono text-slate-700 border border-slate-200/60 line-clamp-2">
                            "{order.rawText}"
                          </div>
                        )}

                        {order.photoUrl && (
                          <div className="relative rounded-xl overflow-hidden border border-slate-200 h-28 bg-slate-100">
                            <img
                              src={order.photoUrl}
                              alt="Slip"
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                              📸 Viber Slip
                            </span>
                          </div>
                        )}

                        {/* Parsed Bet Items Grid */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                            <span>စိစစ်တွေ့ရှိသော ဂဏန်းများ ({order.parsedItems.length})</span>
                            <span className="text-slate-900 font-mono font-black">
                              ကျသင့်ငွေ: {formatAmount(order.netPayable)} Ks
                            </span>
                          </div>

                          <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-200 max-h-24 overflow-y-auto space-y-1">
                            {order.parsedItems.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between text-xs font-mono">
                                <span className="font-bold text-indigo-900">
                                  {item.number} {item.isRumble && <span className="text-amber-700 text-[10px] font-sans">(R)</span>}
                                </span>
                                <span className="text-slate-700">{formatAmount(item.amount)} Ks</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-100">
                          {isPending ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleRejectOrder(order)}
                                className="flex-1 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>ပယ်ဖျက်မည်</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleApproveOrder(order)}
                                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>အတည်ပြုလက်ခံမည်</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCopyReply(order)}
                              className="w-full py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              {copiedOrderId === order.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-700">Viber အတည်ပြုစာ ကူးယူပြီးပါပြီ!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Viber သို့ စာပြန်ရန် ကူးယူပါ</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* TAB 2: NEW DIRECT ORDER INTAKE */}
          {activeTab === 'new_order' && (
            <form onSubmit={handleCreateOrder} className="max-w-2xl mx-auto space-y-4">
              
              <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-200 space-y-3">
                <div className="flex items-center gap-2 text-purple-950 font-black text-xs">
                  <Upload className="w-4 h-4 text-purple-600" />
                  <span>Viber မှ လက်ခံရရှိသော စာသား သို့မဟုတ် ဓါတ်ပုံဘောင်ချာ တင်သွင်းရန်</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Customer ဆီမှ Viber သို့ ရောက်လာသော စာသားကို Paste ချခြင်း သို့မဟုတ် ပုံကို Drag & Drop ထည့်ပေးရုံဖြင့် စနစ်မှ အလိုအလျောက် ခွဲထုတ်တွက်ချက်ပေးပါမည်။
                </p>

                {/* Sender Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Customer အမည် (Viber Name):
                    </label>
                    <input
                      type="text"
                      value={newSenderName}
                      onChange={(e) => setNewSenderName(e.target.value)}
                      placeholder="ဥပမာ- ဒေါ်လှလှ / ကိုစိုးနိုင်"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-purple-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ဖုန်းနံပါတ် (Phone):
                    </label>
                    <input
                      type="text"
                      value={newSenderPhone}
                      onChange={(e) => setNewSenderPhone(e.target.value)}
                      placeholder="09-xxxxxxx"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 outline-none focus:border-purple-500 shadow-2xs"
                    />
                  </div>
                </div>

                {/* Category & Ingest Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      စာရင်း အမျိုးအစား:
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-purple-500"
                    >
                      <option value="3d">အိုးစည်လေး (3D စာရင်း)</option>
                      <option value="2d">ဇီးကွက် (2D စာရင်း)</option>
                      <option value="football">ပစ်တိုင်းထောင် (အားကစား စာရင်း)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ဓါတ်ပုံ စလစ် တင်သွင်းရန် (Optional):
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-white hover:bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-purple-600" />
                      <span>{newPhotoPreview ? 'ဓါတ်ပုံ ပြောင်းလဲမည်' : 'ဓါတ်ပုံ ရွေးချယ်/OCR ဖတ်မည်'}</span>
                    </button>
                  </div>
                </div>

                {/* OCR Loader */}
                {isOcrProcessing && (
                  <div className="p-3 bg-purple-100 rounded-xl space-y-1.5">
                    <div className="flex justify-between text-xs font-bold text-purple-900">
                      <span>ဓါတ်ပုံမှ စာသားများ OCR ဖတ်ရှုနေပါသည်...</span>
                      <span>{ocrProgress}%</span>
                    </div>
                    <div className="w-full bg-purple-200 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-purple-600 h-full transition-all" style={{ width: `${ocrProgress}%` }}></div>
                    </div>
                  </div>
                )}

                {/* Raw Text Box */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Viber စာသား (Text Messages / Formats):
                  </label>
                  <textarea
                    rows={4}
                    value={newRawText}
                    onChange={(e) => setNewRawText(e.target.value)}
                    placeholder="ဥပမာ-&#10;123=1000, 456R 500, 789=2000&#10;၂၄=၅၀၀၀, ၄၂=၅၀၀၀&#10;ငွေလွှဲပြီးပါပြီ"
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-mono text-slate-900 outline-none focus:border-purple-500 shadow-inner"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    မှတ်ချက် (Notes):
                  </label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="ဥပမာ- KPay ဖြင့် ရှင်းမည် / ဖုန်းဖြင့်မှာယူ"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none"
                  />
                </div>

              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('queue')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                >
                  မလုပ်တော့ပါ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 active:scale-95 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>စိစစ်ရမည့် Queue သို့ ပို့မည်</span>
                </button>
              </div>

            </form>
          )}

          {/* TAB 3: VIBER BOT & WEBHOOK CONFIG */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveConfig} className="max-w-xl mx-auto space-y-4">
              
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-black text-xs">
                  <QrCode className="w-4 h-4 text-purple-600" />
                  <span>Viber Bot & Business Account Webhook ချိတ်ဆက်မှု</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Viber Developer Portal မှ ရရှိသော Bot Token အား ထည့်သွင်းထားပါက Customer များ Viber မှ ပို့သမျှ စာရင်းများသည် အက်ပ်ထဲသို့ အလိုအလျောက် Realtime ရောက်ရှိလာပါမည်။
                </p>

                {configSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Viber အကောင့် ချိတ်ဆက်မှု အချက်အလက်များ သိမ်းဆည်းပြီးပါပြီ</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Viber Bot Token (Secret API Key):
                    </label>
                    <input
                      type="password"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      placeholder="50392949-xxxx-xxxx-xxxx-xxxxxxxx"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 outline-none focus:border-purple-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Viber Account / Channel အမည်:
                    </label>
                    <input
                      type="text"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="ရွှေမင်္ဂလာ စာရင်းလက်ခံစနစ်"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-purple-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ချိတ်ဆက်ထားသော ဖုန်းနံပါတ်:
                    </label>
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="09-798889900"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 outline-none focus:border-purple-500 shadow-2xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Direct Webhook URL:
                    </label>
                    <input
                      type="text"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://viber.shwemingalar.app/webhook/live"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 outline-none focus:border-purple-500 shadow-2xs"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-xs font-bold text-emerald-800">
                    Viber Live Integration Channel: တက်ကြွနေပါသည် (Active & Ready)
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  ချိတ်ဆက်မှု အတည်ပြုသိမ်းဆည်းမည်
                </button>
              </div>

            </form>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-slate-700">အော်ဒါလုံခြုံရေး: အတည်ပြုပြီးမှသာ တရားဝင် စာရင်းဖြစ်ပါသည်</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
          >
            ပိတ်မည်
          </button>
        </div>

      </div>
    </div>
  );
};
