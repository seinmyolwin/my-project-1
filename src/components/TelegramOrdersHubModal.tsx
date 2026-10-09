import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Camera,
  FileText,
  Copy,
  Check,
  Trash2,
  Plus,
  RefreshCw,
  Sparkles,
  User,
  Phone,
  ShieldCheck,
  X,
  Layers,
  Zap,
  MessageCircle,
  Bot,
  Link2,
  Globe,
  ExternalLink
} from 'lucide-react';
import {
  TelegramIncomingOrder,
  TelegramAccountConfig,
  getTelegramConfig,
  saveTelegramConfig,
  syncTelegramConfig,
  getTelegramOrders,
  saveTelegramOrders,
  fetchTelegramOrdersFromServer,
  updateTelegramOrderOnServer,
  deleteTelegramOrderOnServer,
  sendTelegramMessage,
  generateTelegramConfirmationMessage,
  testTelegramConnection,
  registerTelegramWebhook,
  clearTelegramToken,
  ConnectionStatus
} from '../utils/telegramIntegration';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { formatAmount, convertMyanmarToEnglishDigits, getPermutations, parseQuickBetText } from '../utils/lotteryUtils';
import { preprocessCanvas, performOfflineOCR, parseSlipImageText } from '../utils/imageOcrUtils';
import { BetItem, VoucherItem, TwoDVoucherItem, FootballBetSelection, FootballBetType } from '../types';
import { safeRound } from '../utils/moneyUtils';

interface TelegramOrdersHubModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TelegramOrdersHubModal: React.FC<TelegramOrdersHubModalProps> = ({ isOpen, onClose }) => {
  const lottery3D = useLottery();
  const lottery2D = useTwoDLottery();
  const football = useFootball();

  const [activeTab, setActiveTab] = useState<'queue' | 'new_order' | 'settings'>('queue');
  const [orders, setOrders] = useState<TelegramIncomingOrder[]>(() => getTelegramOrders());
  const [config, setConfig] = useState<TelegramAccountConfig>(() => getTelegramConfig());

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
  const [channelId, setChannelId] = useState(config.channelId || '@shwemingalar_channel');
  const [accountName, setAccountName] = useState(config.accountName || 'ရွှေမင်္ဂလာ Telegram စာရင်းလက်ခံဘော့');
  const [webhookUrl, setWebhookUrl] = useState(() => {
    if (config.webhookUrl && !config.webhookUrl.includes('telegram.shwemingalar.app')) {
      return config.webhookUrl;
    }
    if (typeof window !== 'undefined' && window.location.origin) {
      return `${window.location.origin}/api/telegram/webhook`;
    }
    return '';
  });
  const [configSuccess, setConfigSuccess] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [webhookActionMsg, setWebhookActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    syncTelegramConfig().then(cfg => {
      if (cfg) {
        setConfig(cfg);
        if (cfg.webhookUrl && !cfg.webhookUrl.includes('telegram.shwemingalar.app')) {
          setWebhookUrl(cfg.webhookUrl);
        } else if (typeof window !== 'undefined' && window.location.origin) {
          setWebhookUrl(`${window.location.origin}/api/telegram/webhook`);
        }
        if (cfg.channelId) setChannelId(cfg.channelId);
        if (cfg.accountName) setAccountName(cfg.accountName);
      }
    });
    fetchTelegramOrdersFromServer().then(ordList => {
      if (ordList && ordList.length > 0) {
        setOrders(ordList);
      }
    });
  }, []);

  if (!isOpen) return null;

  const pendingCount = orders.filter(o => o.status === 'pending_review').length;

  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'pending') return o.status === 'pending_review';
    if (statusFilter === 'approved') return o.status === 'approved';
    if (statusFilter === 'rejected') return o.status === 'rejected';
    return true;
  });

  const selectedOrder = orders.find(o => o.id === selectedOrderId) || null;

  const handleUpdateOrders = (newOrders: TelegramIncomingOrder[]) => {
    setOrders(newOrders);
    saveTelegramOrders(newOrders);
  };

  // OCR Photo Ingestion via Gemini AI Vision OCR
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setNewPhotoPreview(previewUrl);
    setNewOrderType('photo');
    setIsOcrProcessing(true);
    setOcrProgress(20);

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
        contrast: 40,
        brightness: 10,
        grayscale: true,
        threshold: false
      });

      setOcrProgress(40);
      const text = await performOfflineOCR(processedCanvas, (pct) => {
        setOcrProgress(40 + Math.round(pct * 0.5));
      });
      setOcrProgress(90);
      setNewRawText(text);

      const parsed = parseSlipImageText(text, newCategory === 'football' ? 'auto' : newCategory);
      if (parsed.customerName && parsed.customerName !== 'အထွေထွေ (Photo / Chat Entry)' && parsed.customerName !== 'အထွေထွေ (Photo Entry)') {
        setNewSenderName(parsed.customerName);
      }
      if (parsed.customerPhone) {
        setNewSenderPhone(parsed.customerPhone);
      }

      if (parsed.extractedItems && parsed.extractedItems.length > 0) {
        const linesStr = parsed.extractedItems.map(it => `${it.number}=${it.amount}${it.isRumble ? 'R' : ''}`).join('\n');
        setNewRawText(linesStr);
      }

      setOcrProgress(100);
      setIsOcrProcessing(false);
    } catch (err) {
      console.error('Telegram Photo OCR Error:', err);
      setIsOcrProcessing(false);
      alert('ဓါတ်ပုံမှ စာသားဖတ်ယူရာတွင် အခက်အခဲရှိပါသည်။ ကျေးဇူးပြု၍ စာသားဖြင့် ပြန်လည်ရိုက်ထည့်ပါ');
    }
  };

  // Submit New Order to Queue
  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRawText.trim() && !newPhotoPreview) return;

    const { items } = parseQuickBetText(newRawText);
    const parsedItems = items.map(it => ({
      number: it.number,
      amount: it.amount,
      isRumble: it.isRumble,
      originalRaw: it.originalInput || `${it.number}=${it.amount}`
    }));

    const totalAmount = parsedItems.reduce((acc, it) => acc + it.amount, 0);

    const newOrder: TelegramIncomingOrder = {
      id: `tg-${Date.now()}`,
      senderName: newSenderName.trim() || 'Telegram ဝယ်သူ',
      senderPhone: newSenderPhone.trim(),
      orderType: newOrderType,
      category: newCategory,
      rawText: newRawText,
      photoUrl: newPhotoPreview || undefined,
      parsedItems,
      totalAmount,
      status: 'pending_review',
      timestamp: Date.now(),
      notes: newNotes.trim()
    };

    handleUpdateOrders([newOrder, ...orders]);
    setNewSenderName('');
    setNewSenderPhone('');
    setNewRawText('');
    setNewPhotoPreview(null);
    setNewNotes('');
    setActiveTab('queue');
  };

  // Approve Order into Active Voucher
  const handleApproveOrder = (order: TelegramIncomingOrder) => {
    const betItems: BetItem[] = order.parsedItems.map((pi, idx) => ({
      id: `tg-bet-${Date.now()}-${idx}`,
      number: pi.number,
      amount: pi.amount,
      isRumble: pi.isRumble,
      originalInput: pi.originalRaw
    }));

    if (order.category === '3d') {
      const voucherItems: VoucherItem[] = order.parsedItems.map(pi => ({
        number: pi.number,
        amount: pi.amount,
        betType: pi.isRumble ? 'rumble' : 'straight'
      }));
      const subtotal = voucherItems.reduce((s, it) => s + it.amount, 0);
      lottery3D.addVoucher({
        roundId: lottery3D.activeRoundId,
        customerName: order.senderName,
        customerPhone: order.senderPhone,
        items: voucherItems,
        subtotal,
        discountPercent: 0,
        discountAmount: 0,
        netPayable: subtotal,
        isPaid: true,
        status: 'active',
        notes: `[Telegram Bot] ${order.notes || ''}`
      });
    } else if (order.category === '2d') {
      const voucherItems: TwoDVoucherItem[] = order.parsedItems.map(pi => ({
        number: pi.number,
        amount: pi.amount,
        betType: pi.isRumble ? 'rumble' : 'straight'
      }));
      const subtotal = voucherItems.reduce((s, it) => s + it.amount, 0);
      lottery2D.addVoucher({
        roundId: lottery2D.activeRoundId,
        customerName: order.senderName,
        customerPhone: order.senderPhone,
        items: voucherItems,
        subtotal,
        discountPercent: 0,
        discountAmount: 0,
        netPayable: subtotal,
        isPaid: true,
        status: 'active',
        notes: `[Telegram Bot] ${order.notes || ''}`
      });
    } else {
      // Football bets
      const availableMatches = football.matches.filter(m => m.status === 'upcoming' || m.status === 'live');
      if (availableMatches.length === 0) {
        alert(football.settings.language === 'my' ? 'လတ်တလော ထိုးနိုင်သော ဘောလုံးပွဲစဉ် မရှိသေးပါ' : 'No available football matches');
        return;
      }
      let hasInvalidOdds = false;
      const selections: FootballBetSelection[] = betItems.map((b, idx) => {
        const found = availableMatches.find(m =>
          (b.originalInput && (m.homeTeam.toLowerCase().includes(b.originalInput.toLowerCase()) || m.awayTeam.toLowerCase().includes(b.originalInput.toLowerCase())))
        ) || availableMatches[idx % availableMatches.length];

        if (!found || !found.bodyOdds || found.bodyOdds <= 0) {
          hasInvalidOdds = true;
        }

        const matchId = found ? found.id : `match-order-${Date.now()}-${idx}`;
        const matchSummary = found ? `${found.homeTeam} vs ${found.awayTeam}` : 'Special Match';
        const league = found ? found.league : 'Football League';
        const odds = found ? found.bodyOdds : 0;
        const betType: FootballBetType = 'body_home';
        const choiceLabel = found ? `${found.homeTeam} (Body)` : 'Home Body';
        const lineDescription = found ? `အကြော ${found.handicapValue}` : 'အကြော 0=0';

        return {
          matchId,
          matchSummary,
          league,
          betType,
          choiceLabel,
          lineDescription,
          odds,
          outcome: 'pending'
        };
      });

      if (hasInvalidOdds || selections.some(s => !s.odds || s.odds <= 0)) {
        alert(football.settings.language === 'my' ? 'Settings သို့မဟုတ် ပွဲစဉ်များတွင် ရေကြေး (Odds) ကို ဦးစွာ သတ်မှတ်ပါ' : 'Please configure valid odds in settings or matches first');
        return;
      }

      const totalStake = betItems.reduce((sum, b) => sum + (b.amount || 0), 0) || order.totalAmount || 5000;
      const combinedOdds = selections.reduce((acc, s) => acc * s.odds, 1.0);
      const potentialPayout = safeRound(totalStake * combinedOdds);
      const isMaung = selections.length > 1;

      football.addSlip({
        roundDate: football.activeDate,
        customerName: order.senderName || 'Telegram User',
        customerPhone: order.senderPhone,
        slipType: isMaung ? 'maung' : 'body_single',
        teamCount: selections.length,
        selections,
        stakeAmount: totalStake,
        discountPercent: 0,
        discountAmount: 0,
        netPayable: totalStake,
        combinedOdds,
        potentialPayout,
        status: 'active',
        notes: `[Telegram Bot] ${order.notes || ''}`
      });
    }

    const updated = orders.map(o => o.id === order.id ? { ...o, status: 'approved' as const } : o);
    handleUpdateOrders(updated);

    // Sync status with backend
    updateTelegramOrderOnServer(order.id, { status: 'approved' });

    // Send confirmation message to Telegram user if chatId exists
    if (order.chatId) {
      sendTelegramMessage(
        order.chatId,
        generateTelegramConfirmationMessage(order.senderName, order.totalAmount)
      ).catch(() => {});
    }
  };

  const handleRejectOrder = (orderId: string) => {
    const updated = orders.map(o => o.id === orderId ? { ...o, status: 'rejected' as const } : o);
    handleUpdateOrders(updated);

    // Sync status with backend
    updateTelegramOrderOnServer(orderId, { status: 'rejected' });
  };

  const handleDeleteOrder = (orderId: string) => {
    const updated = orders.filter(o => o.id !== orderId);
    handleUpdateOrders(updated);
    if (selectedOrderId === orderId) setSelectedOrderId(null);

    // Sync deletion with backend
    deleteTelegramOrderOnServer(orderId);
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    const result = await testTelegramConnection(botToken.trim(), webhookUrl.trim());
    setIsTestingConnection(false);

    const updatedConfig: TelegramAccountConfig = {
      botToken: botToken.trim(),
      channelId: channelId.trim(),
      accountName: accountName.trim(),
      webhookUrl: webhookUrl.trim(),
      status: result.status,
      statusMessage: result.message,
      connectedAt: result.status === 'connected' ? new Date().toISOString() : undefined
    };
    setConfig(updatedConfig);
    saveTelegramConfig(updatedConfig);
  };

  const handleAutoDetectWebhook = () => {
    // Current browser origin (tablet / mobile / PC)
    const origin = window.location.origin;
    const detected = `${origin}/api/telegram/webhook`;
    setWebhookUrl(detected);
    setWebhookActionMsg({
      type: 'success',
      text: `လက်ရှိ App URL အား အလိုအလျောက် ရယူထည့်သွင်းပေးပြီးပါပြီ: ${detected}`
    });
    setTimeout(() => setWebhookActionMsg(null), 4000);
  };

  const handleCopyWebhook = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleRegisterWebhookWithTelegram = async () => {
    if (!botToken.trim() && !config.hasServerToken) {
      setWebhookActionMsg({
        type: 'error',
        text: 'ကျေးဇူးပြု၍ Telegram Bot Token ကို အရင်ဖြည့်သွင်းပေးပါခင်ဗျာ'
      });
      setTimeout(() => setWebhookActionMsg(null), 4000);
      return;
    }

    if (!webhookUrl.trim() || !webhookUrl.startsWith('https://')) {
      setWebhookActionMsg({
        type: 'error',
        text: 'Webhook URL သည် https:// ဖြင့် စတင်ရပါမည် (HTTP မရပါ)'
      });
      setTimeout(() => setWebhookActionMsg(null), 4000);
      return;
    }

    // Save config first to ensure token is synced on server
    setIsRegisteringWebhook(true);
    setWebhookActionMsg(null);

    // First save settings to server
    const currentConf: TelegramAccountConfig = {
      botToken: botToken.trim(),
      channelId: channelId.trim(),
      accountName: accountName.trim(),
      webhookUrl: webhookUrl.trim(),
      status: config.status,
      statusMessage: config.statusMessage
    };
    saveTelegramConfig(currentConf);

    // Call set-webhook API
    const res = await registerTelegramWebhook(webhookUrl.trim());
    setIsRegisteringWebhook(false);

    if (res.ok) {
      setWebhookActionMsg({
        type: 'success',
        text: '✓ Telegram Bot Server သို့ Webhook အောင်မြင်စွာ ချိတ်ဆက်မှတ်ပုံတင်ပြီးပါပြီ! ယခု Telegram Bot မှ ပို့သော စာရင်းများ တိုက်ရိုက် ရောက်ရှိပါမည်။'
      });
      // Re-test connection to update status pill
      handleTestConnection();
    } else {
      setWebhookActionMsg({
        type: 'error',
        text: `✕ Webhook ချိတ်ဆက်မှု မအောင်မြင်ပါ: ${res.message}`
      });
    }
    setTimeout(() => setWebhookActionMsg(null), 6000);
  };

  const handleClearToken = async () => {
    if (window.confirm('Telegram Bot Token ကို ဖျက်ပစ်ပြီး Disconnect လုပ်ရန် သေချာပါသလား?')) {
      await clearTelegramToken();
      setBotToken('');
      setConfig(prev => ({
        ...prev,
        botToken: '',
        webhookUrl: '',
        status: 'disconnected',
        statusMessage: 'Telegram Bot Token ဖျက်ပြီးပါပြီ (Disconnected)',
        hasServerToken: false
      }));
      setWebhookActionMsg({
        type: 'success',
        text: '✓ Telegram Bot Token ကို အောင်မြင်စွာ ဖျက်ပြီးပါပြီ။'
      });
      setTimeout(() => setWebhookActionMsg(null), 4000);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!botToken.trim() || !webhookUrl.trim()) {
      const newConfig: TelegramAccountConfig = {
        botToken: botToken.trim(),
        channelId: channelId.trim(),
        accountName: accountName.trim(),
        webhookUrl: webhookUrl.trim(),
        status: 'disconnected',
        statusMessage: 'API Token သို့မဟုတ် Webhook Endpoint မရှိသေးပါ'
      };
      setConfig(newConfig);
      saveTelegramConfig(newConfig);
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 2500);
      return;
    }

    setIsTestingConnection(true);
    const result = await testTelegramConnection(botToken.trim(), webhookUrl.trim());
    setIsTestingConnection(false);

    const newConfig: TelegramAccountConfig = {
      botToken: botToken.trim(),
      channelId: channelId.trim(),
      accountName: accountName.trim(),
      webhookUrl: webhookUrl.trim(),
      status: result.status,
      statusMessage: result.message,
      connectedAt: result.status === 'connected' ? new Date().toISOString() : undefined
    };
    setConfig(newConfig);
    saveTelegramConfig(newConfig);
    setConfigSuccess(true);
    setTimeout(() => setConfigSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/30 text-sky-400 flex items-center justify-center font-bold">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight">
                  Telegram Bot & အမှာစာ လက်ခံစနစ်
                </h3>
                {pendingCount > 0 && (
                  <span className="bg-sky-500 text-white font-mono text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                    စောင့်ဆိုင်းဆဲ {pendingCount}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Telegram မှ ဝင်ရောက်လာသော ထိုးကြေးအမှာစာများကို အလိုအလျောက်လက်ခံ၍ ဒိုင်စာရင်းသို့ ချိတ်ဆက်ပါ
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

        {/* Subtab Navigation */}
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>အမှာစာများ စာရင်း ({orders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('new_order')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'new_order'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>အမှာစာ အသစ်သွင်းရန် (Simulate/Paste)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Telegram Bot ဆက်တင်များ</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50">
          
          {/* TAB 1: QUEUE */}
          {activeTab === 'queue' && (
            <div className="space-y-4">
              {/* Filter bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="text-slate-500">အခြေအနေ:</span>
                  {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setStatusFilter(f)}
                      className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                        statusFilter === f
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {f === 'all' && 'အားလုံး'}
                      {f === 'pending' && `စောင့်ဆိုင်းဆဲ (${orders.filter(o => o.status === 'pending_review').length})`}
                      {f === 'approved' && 'အတည်ပြုပြီး'}
                      {f === 'rejected' && 'ပယ်ဖျက်ပြီး'}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setOrders(getTelegramOrders())}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              {/* Orders List */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6 space-y-3">
                  {filteredOrders.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 space-y-2">
                      <MessageCircle className="w-10 h-10 mx-auto text-slate-300" />
                      <p className="text-sm font-semibold">အမှာစာများ မရှိသေးပါ</p>
                    </div>
                  ) : (
                    filteredOrders.map(order => {
                      const isSelected = order.id === selectedOrderId;
                      return (
                        <div
                          key={order.id}
                          onClick={() => setSelectedOrderId(order.id)}
                          className={`bg-white border rounded-2xl p-4 space-y-3 cursor-pointer transition-all shadow-2xs ${
                            isSelected
                              ? 'border-sky-500 ring-2 ring-sky-100'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 font-bold flex items-center justify-center text-xs">
                                TG
                              </span>
                              <div>
                                <h4 className="text-xs font-bold text-slate-900">{order.senderName}</h4>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {new Date(order.timestamp).toLocaleString()} • {order.senderPhone || 'ဖုန်းမပါ'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                                order.category === '3d' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                                order.category === '2d' ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                                'bg-emerald-50 text-emerald-700 border border-emerald-100'
                              }`}>
                                {order.category.toUpperCase()}
                              </span>

                              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                                order.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                                order.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                                'bg-amber-100 text-amber-800 animate-pulse'
                              }`}>
                                {order.status === 'approved' ? 'အတည်ပြုပြီး' : order.status === 'rejected' ? 'ပယ်ဖျက်ပြီး' : 'စောင့်ဆိုင်းဆဲ'}
                              </span>
                            </div>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs font-mono text-slate-800 line-clamp-2">
                            {order.rawText || '(ဓါတ်ပုံအမှာစာ)'}
                          </div>

                          <div className="flex items-center justify-between pt-1 text-xs">
                            <span className="font-mono font-bold text-slate-600">
                              စုစုပေါင်း: <strong className="text-emerald-700">{formatAmount(order.totalAmount, 'Ks')}</strong>
                            </span>

                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {order.status === 'pending_review' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveOrder(order)}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-1 cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>လက်ခံမည်</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRejectOrder(order.id)}
                                    className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 cursor-pointer"
                                  >
                                    ပယ်ချ
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteOrder(order.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Selected Order Details Preview */}
                <div className="md:col-span-6">
                  {selectedOrder ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs sticky top-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-sky-600" />
                          <h4 className="text-sm font-bold text-slate-900">{selectedOrder.senderName}</h4>
                        </div>
                        <span className="text-xs font-mono text-slate-500">ID: {selectedOrder.id}</span>
                      </div>

                      {selectedOrder.photoUrl && (
                        <div className="rounded-xl overflow-hidden border border-slate-200 max-h-48 bg-slate-950 flex items-center justify-center">
                          <img src={selectedOrder.photoUrl} alt="Slip" className="max-h-48 object-contain" />
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">အမှာစာ စာသား / ဂဏန်းများ:</label>
                        <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 whitespace-pre-wrap max-h-36 overflow-y-auto">
                          {selectedOrder.rawText}
                        </pre>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">ခွဲထုတ်ထားသော ဂဏန်းစာရင်း:</label>
                        <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl">
                          {selectedOrder.parsedItems.map((pi, idx) => (
                            <div key={idx} className="flex items-center justify-between px-3 py-1.5 text-xs font-mono">
                              <span className="font-bold text-slate-900">{pi.number} {pi.isRumble ? '(ပတ်လည်)' : '(တည့်)'}</span>
                              <span className="font-bold text-emerald-700">{formatAmount(pi.amount, 'Ks')}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">စုစုပေါင်းတန်ဖိုး:</span>
                        <span className="text-sm font-mono font-black text-emerald-700">
                          {formatAmount(selectedOrder.totalAmount, 'Ks')}
                        </span>
                      </div>

                      {selectedOrder.status === 'pending_review' && (
                        <div className="flex items-center gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => handleApproveOrder(selectedOrder)}
                            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>အတည်ပြု၍ ဒိုင်စာရင်းသို့ ထည့်မည်</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-12 text-center text-slate-400 space-y-2">
                      <Layers className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="text-xs font-semibold">အသေးစိတ်ကြည့်ရန် ဘယ်ဘက်မှ အမှာစာ တစ်ခုကို ရွေးချယ်ပါ</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: NEW ORDER (SIMULATE / OCR) */}
          {activeTab === 'new_order' && (
            <form onSubmit={handleCreateOrder} className="bg-white border border-slate-200 rounded-2xl p-5 max-w-2xl mx-auto space-y-4 shadow-xs">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Plus className="w-4 h-4 text-sky-600" />
                <span>Telegram မှ အမှာစာအသစ် လက်ခံခြင်း (Simulate / OCR)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ဝယ်သူအမည်</label>
                  <input
                    type="text"
                    value={newSenderName}
                    onChange={(e) => setNewSenderName(e.target.value)}
                    placeholder="ဥပမာ - ကိုကျော်ဇေယျ"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ဖုန်းနံပါတ်</label>
                  <input
                    type="text"
                    value={newSenderPhone}
                    onChange={(e) => setNewSenderPhone(e.target.value)}
                    placeholder="09-xxxxxxxxx"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">လုပ်ငန်းလိုင်း (Category)</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  >
                    <option value="3d">အိုးစည်လေး (3D)</option>
                    <option value="2d">ဇီးကွက် (2D)</option>
                    <option value="football">ပစ်တိုင်းထောင် (Football)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">အမှာစာ အမျိုးအစား</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewOrderType('text')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        newOrderType === 'text' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      စာသား (Text)
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                        newOrderType === 'photo' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-700 border-slate-300'
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5 inline mr-1" /> စလစ်ပုံ (OCR)
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </div>
                </div>
              </div>

              {newPhotoPreview && (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950 p-2 text-center">
                  <img src={newPhotoPreview} alt="Preview" className="max-h-36 mx-auto object-contain rounded" />
                  {isOcrProcessing && (
                    <div className="absolute inset-0 bg-sky-950/80 flex items-center justify-center text-white text-xs font-bold gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Gemini AI ဖြင့် ဓါတ်ပုံစကင်ဖတ်နေပါသည် ({ocrProgress}%)...</span>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ထိုးကြေးစာရင်း (သို့မဟုတ် OCR ဖတ်ရရှိသော စာသား)</label>
                <textarea
                  value={newRawText}
                  onChange={(e) => setNewRawText(convertMyanmarToEnglishDigits(e.target.value))}
                  placeholder={`123=1000\n456=500\n789R=1000`}
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">မှတ်ချက်</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Telegram Bot မှ ဝင်ရောက်လာသည်"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer"
                >
                  အမှာစာ တင်သွင်းမည် (Add to Queue)
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: SETTINGS */}
          {activeTab === 'settings' && (
            <form onSubmit={handleSaveConfig} className="bg-white border border-slate-200 rounded-2xl p-6 max-w-2xl mx-auto space-y-4 shadow-xs">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Bot className="w-4 h-4 text-sky-600" />
                <span>Telegram Bot API & Webhook ဆက်တင်များ</span>
              </h4>

              {configSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-bold">
                  ✓ Telegram ဆက်တင်များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bot Name / Account Name</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">Telegram Bot Token (FatherBot Token)</label>
                  {(config.hasServerToken || botToken || config.status === 'connected') && (
                    <button
                      type="button"
                      onClick={handleClearToken}
                      className="text-[11px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 cursor-pointer hover:underline"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Token ဖျက်မည် (Clear / Disconnect)</span>
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder={config.hasServerToken ? "•••••••••••••••• (လက်ရှိ Token ရှိသည် - ဖျက်လိုပါက 'Token ဖျက်မည်' ကိုနှိပ်ပါ)" : "123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Telegram Channel / Group ID (@username or chat_id)</label>
                <input
                  type="text"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  placeholder="@shwemingalar_channel"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                />
              </div>

              <div className="bg-sky-50/70 border border-sky-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-black text-sky-950 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-sky-600" />
                      <span>App Webhook URL Endpoint (တက်ဘလက် / ဖုန်း ချိတ်ဆက်ရန်)</span>
                    </label>
                    <p className="text-[11px] text-sky-800/80 font-medium mt-0.5">
                      Telegram Bot ဆီက စာများကို ဆရာ့ တက်ဘလက် App သို့ အလိုအလျောက် ပို့ပေးမည့် လိပ်စာ
                    </p>
                  </div>

                  {/* 1-Click Auto-Detect Button */}
                  <button
                    type="button"
                    onClick={handleAutoDetectWebhook}
                    className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>လက်ရှိ App URL အလိုအလျောက် ရယူမည် (Auto-Detect)</span>
                  </button>
                </div>

                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://.../api/telegram/webhook"
                    className="w-full bg-white border border-sky-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={handleCopyWebhook}
                    title="URL ကူးယူမည်"
                    className="px-3 py-2 bg-white hover:bg-sky-100 text-sky-900 border border-sky-300 rounded-xl text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                  >
                    {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWebhook ? 'ကူးပြီး' : 'Copy'}</span>
                  </button>
                </div>

                {/* 1-Click Telegram Registration Button */}
                <div className="pt-2 border-t border-sky-200/60 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-600 font-medium">
                    Webhook URL ကို Telegram Server နှင့် တိုက်ရိုက်မှတ်ပုံတင်ရန် နှိပ်ပါ:
                  </div>
                  <button
                    type="button"
                    onClick={handleRegisterWebhookWithTelegram}
                    disabled={isRegisteringWebhook}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Zap className={`w-3.5 h-3.5 ${isRegisteringWebhook ? 'animate-bounce' : ''}`} />
                    <span>{isRegisteringWebhook ? 'Telegram သို့ ချိတ်ဆက်နေပါသည်...' : 'Telegram သို့ Webhook တိုက်ရိုက် ချိတ်ဆက်မည် (1-Click)'}</span>
                  </button>
                </div>

                {webhookActionMsg && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                      webhookActionMsg.type === 'success'
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-rose-100 text-rose-900 border border-rose-300'
                    }`}
                  >
                    {webhookActionMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{webhookActionMsg.text}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {config.status === 'connected' && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>Connected (ချိတ်ဆက်ပြီး)</span>
                      </span>
                    )}
                    {config.status === 'disconnected' && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold border border-slate-300">
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                        <span>Disconnected (မချိတ်ဆက်ရသေးပါ)</span>
                      </span>
                    )}
                    {config.status === 'connecting' && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 text-xs font-bold border border-amber-300">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting (စမ်းသပ်နေသည်...)</span>
                      </span>
                    )}
                    {config.status === 'error' && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 text-xs font-bold border border-rose-300">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Error (အမှားအယွင်းရှိသည်)</span>
                      </span>
                    )}
                    {config.status === 'timeout' && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800 text-xs font-bold border border-orange-300">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Timeout (အချိန်လွန်သွားသည်)</span>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
                    <span>{isTestingConnection ? 'စမ်းသပ်နေဆဲ...' : 'ချိတ်ဆက်မှု စမ်းသပ်မည်'}</span>
                  </button>
                </div>

                {config.statusMessage && (
                  <p className="text-[11px] font-medium text-slate-600 mt-2 font-mono">
                    {config.statusMessage}
                  </p>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isTestingConnection}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  {isTestingConnection ? 'စမ်းသပ်စစ်ဆေးနေပါသည်...' : 'ဆက်တင်များ သိမ်းဆည်းမည်'}
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};
