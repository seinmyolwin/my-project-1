import React, { useState, useRef, useEffect } from 'react';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
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
  ExternalLink,
  Eye,
  EyeOff,
  AlertTriangle,
  Info,
  HelpCircle,
  Radio
} from 'lucide-react';
import {
  TelegramIncomingOrder,
  TelegramAccountConfig,
  TelegramBotInfo,
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
  deleteTelegramWebhook,
  cleanTelegramToken,
  isValidTokenFormat,
  ConnectionStatus,
  getShopId,
  setShopId
} from '../utils/telegramIntegration';
import { useLottery } from '../context/LotteryContext';
import { useTwoDLottery } from '../context/TwoDLotteryContext';
import { useFootball } from '../context/FootballContext';
import { formatAmount, convertMyanmarToEnglishDigits, getPermutations, parseQuickBetText } from '../utils/lotteryUtils';
import { generateSubmissionFingerprint, isDuplicateSubmission } from '../utils/transactionUtils';
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

  const telegramTabs = ['queue', 'new_order', 'settings'] as const;
  const handleTelegramSwipeLeft = () => {
    const idx = telegramTabs.indexOf(activeTab);
    if (idx !== -1 && idx < telegramTabs.length - 1) setActiveTab(telegramTabs[idx + 1]);
  };
  const handleTelegramSwipeRight = () => {
    const idx = telegramTabs.indexOf(activeTab);
    if (idx > 0) setActiveTab(telegramTabs[idx - 1]);
  };
  const telegramSwipeHandlers = useSwipeGesture({
    onSwipeLeft: handleTelegramSwipeLeft,
    onSwipeRight: handleTelegramSwipeRight,
    threshold: 45
  });
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
  const [currentShopId, setCurrentShopId] = useState(() => getShopId());
  const [botToken, setBotToken] = useState(() => config.botToken || '');
  const [channelId, setChannelId] = useState(config.channelId || '');
  const [accountName, setAccountName] = useState(config.accountName || '');
  const [webhookUrl, setWebhookUrl] = useState(() => {
    if (config.webhookUrl && !config.webhookUrl.includes('telegram.shwemingalar.app')) {
      return config.webhookUrl;
    }
    if (typeof window !== 'undefined' && window.location.origin) {
      const activeShop = getShopId();
      return `${window.location.origin}/api/telegram/webhook/${activeShop}`;
    }
    return '';
  });
  const [configSuccess, setConfigSuccess] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [isRestoringPolling, setIsRestoringPolling] = useState(false);
  const [webhookActionMsg, setWebhookActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testDiagnostics, setTestDiagnostics] = useState<{
    status?: ConnectionStatus;
    message?: string;
    bot?: TelegramBotInfo;
    errorType?: string;
    details?: string;
  } | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [showBotToken, setShowBotToken] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [receptionMode, setReceptionMode] = useState<'polling' | 'webhook'>('polling');

  // Interactive Voucher Review & Edit Entry State
  const [isVoucherEntryMode, setIsVoucherEntryMode] = useState(false);
  const [voucherCustomerName, setVoucherCustomerName] = useState('');
  const [voucherCategory, setVoucherCategory] = useState<'3d' | '2d' | 'football'>('3d');
  const [voucherItems, setVoucherItems] = useState<{ number: string; amount: number; isRumble: boolean; originalRaw: string }[]>([]);
  const [voucherDiscountPercent, setVoucherDiscountPercent] = useState(0);
  const [addNumInput, setAddNumInput] = useState('');
  const [addAmtInput, setAddAmtInput] = useState('');
  const [addRumbleInput, setAddRumbleInput] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleStartVoucherEntry = (order: TelegramIncomingOrder) => {
    setSelectedOrderId(order.id);
    setVoucherCustomerName(order.senderName || 'Telegram User');
    setVoucherCategory(order.category);
    setVoucherItems(order.parsedItems.map(pi => ({ ...pi })));
    setVoucherDiscountPercent(0);
    setAddNumInput('');
    setAddAmtInput('');
    setAddRumbleInput(false);
    setIsVoucherEntryMode(true);
  };

  const handleAddItemToVoucher = () => {
    if (!addNumInput.trim()) return;
    const amount = parseInt(addAmtInput, 10);
    if (isNaN(amount) || amount <= 0) return;

    setVoucherItems(prev => [
      ...prev,
      {
        number: addNumInput.trim(),
        amount,
        isRumble: addRumbleInput,
        originalRaw: `${addNumInput.trim()}=${amount}${addRumbleInput ? 'R' : ''}`
      }
    ]);
    setAddNumInput('');
    setAddAmtInput('');
    setAddRumbleInput(false);
  };

  const handleRemoveVoucherItem = (index: number) => {
    setVoucherItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateVoucherItem = (index: number, field: 'number' | 'amount' | 'isRumble', val: any) => {
    setVoucherItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      return { ...item, [field]: val };
    }));
  };

  const handleConfirmEditedVoucher = (order: TelegramIncomingOrder) => {
    const validItems = voucherItems.filter(it => it.number && it.amount > 0);
    if (validItems.length === 0) {
      alert('⚠️ အနည်းဆုံး ဂဏန်း (၁) ကွက်နှင့် ထိုးကြေး ပမာဏ ဖြည့်သွင်းရပါမည်');
      return;
    }

    const subtotal = validItems.reduce((acc, it) => acc + (it.amount || 0), 0);
    const discountAmount = safeRound((subtotal * (voucherDiscountPercent || 0)) / 100);
    const netPayable = Math.max(0, subtotal - discountAmount);

    if (voucherCategory === '3d') {
      const items: VoucherItem[] = validItems.map(pi => ({
        number: pi.number,
        amount: pi.amount,
        betType: pi.isRumble ? 'rumble' : 'straight'
      }));
      lottery3D.addVoucher({
        roundId: lottery3D.activeRoundId,
        customerName: voucherCustomerName.trim() || order.senderName,
        items,
        subtotal,
        discountPercent: voucherDiscountPercent || 0,
        discountAmount,
        netPayable,
        isPaid: true,
        status: 'active',
        notes: `[Telegram Bot] ${order.notes || ''}`
      });
    } else if (voucherCategory === '2d') {
      const items: TwoDVoucherItem[] = validItems.map(pi => ({
        number: pi.number,
        amount: pi.amount,
        betType: pi.isRumble ? 'rumble' : 'straight'
      }));
      lottery2D.addVoucher({
        roundId: lottery2D.activeRoundId,
        customerName: voucherCustomerName.trim() || order.senderName,
        items,
        subtotal,
        discountPercent: voucherDiscountPercent || 0,
        discountAmount,
        netPayable,
        isPaid: true,
        status: 'active',
        notes: `[Telegram Bot] ${order.notes || ''}`
      });
    } else {
      const availableMatches = football.matches.filter(m => m.status === 'upcoming' || m.status === 'live');
      if (availableMatches.length === 0) {
        alert(football.settings.language === 'my' ? 'လတ်တလော ထိုးနိုင်သော ဘောလုံးပွဲစဉ် မရှိသေးပါ' : 'No available football matches');
        return;
      }
      const selections: FootballBetSelection[] = validItems.map((b, idx) => {
        const found = availableMatches.find(m =>
          (b.originalRaw && (m.homeTeam.toLowerCase().includes(b.originalRaw.toLowerCase()) || m.awayTeam.toLowerCase().includes(b.originalRaw.toLowerCase())))
        ) || availableMatches[idx % availableMatches.length];

        return {
          matchId: found ? found.id : `match-order-${Date.now()}-${idx}`,
          matchSummary: found ? `${found.homeTeam} vs ${found.awayTeam}` : 'Special Match',
          league: found ? found.league : 'Football League',
          betType: 'body_home',
          choiceLabel: found ? `${found.homeTeam} (Body)` : 'Home Body',
          lineDescription: found ? `အကြော ${found.handicapValue}` : 'အကြော 0=0',
          odds: found ? found.bodyOdds : 1.0,
          outcome: 'pending'
        };
      });

      const combinedOdds = selections.reduce((acc, s) => acc * s.odds, 1.0);
      const potentialPayout = safeRound(netPayable * combinedOdds);

      football.addSlip({
        roundDate: football.activeDate,
        customerName: voucherCustomerName.trim() || order.senderName,
        slipType: selections.length > 1 ? 'maung' : 'body_single',
        teamCount: selections.length,
        selections,
        stakeAmount: subtotal,
        discountPercent: voucherDiscountPercent || 0,
        discountAmount,
        netPayable,
        combinedOdds,
        potentialPayout,
        status: 'active',
        notes: `[Telegram Bot] ${order.notes || ''}`
      });
    }

    const updated = orders.map(o => o.id === order.id ? { ...o, status: 'approved' as const } : o);
    handleUpdateOrders(updated);
    updateTelegramOrderOnServer(order.id, { status: 'approved' });

    if (order.chatId) {
      sendTelegramMessage(
        order.chatId,
        generateTelegramConfirmationMessage(voucherCustomerName.trim() || order.senderName, netPayable)
      ).catch(() => {});
    }

    setIsVoucherEntryMode(false);
    alert(`✅ မင်္ဂလာပါ! ဘောင်ချာအား စစ်ဆေး/ပြင်ဆင်ပြီး ဒိုင်စာရင်းသို့ အတည်ပြု ထည့်သွင်းပြီးပါပြီ! (အသားတင်: ${formatAmount(netPayable, 'Ks')})`);
  };

  useEffect(() => {
    const pollData = async () => {
      const cfg = await syncTelegramConfig();
      if (cfg) {
        setConfig(cfg);
        if (cfg.webhookUrl && !cfg.webhookUrl.includes('telegram.shwemingalar.app')) {
          setWebhookUrl(cfg.webhookUrl);
        } else if (typeof window !== 'undefined' && window.location.origin) {
          const activeShop = getShopId();
          setWebhookUrl(activeShop && activeShop !== 'default'
            ? `${window.location.origin}/api/telegram/webhook/${activeShop}`
            : `${window.location.origin}/api/telegram/webhook`
          );
        }
        if (cfg.channelId) setChannelId(cfg.channelId);
        if (cfg.accountName) setAccountName(cfg.accountName);
        if (cfg.botToken && !botToken) {
          setBotToken(cfg.botToken);
        }
      }
      const ordList = await fetchTelegramOrdersFromServer();
      if (ordList !== null) {
        setOrders(prev => {
          const map = new Map<string, TelegramIncomingOrder>();
          ordList.forEach(o => map.set(o.id, o));
          prev.forEach(p => {
            if (!map.has(p.id)) {
              map.set(p.id, p);
            } else {
              const existing = map.get(p.id)!;
              if (p.status !== 'pending_review' && existing.status === 'pending_review') {
                map.set(p.id, { ...existing, status: p.status, notes: p.notes || existing.notes });
              }
            }
          });
          const merged = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
          saveTelegramOrders(merged);
          return merged;
        });
      }
    };

    pollData();
    const interval = setInterval(pollData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const ordList = await fetchTelegramOrdersFromServer();
      if (ordList !== null) {
        setOrders(prev => {
          const map = new Map<string, TelegramIncomingOrder>();
          ordList.forEach(o => map.set(o.id, o));
          prev.forEach(p => {
            if (!map.has(p.id)) {
              map.set(p.id, p);
            } else {
              const existing = map.get(p.id)!;
              if (p.status !== 'pending_review' && existing.status === 'pending_review') {
                map.set(p.id, { ...existing, status: p.status, notes: p.notes || existing.notes });
              }
            }
          });
          const merged = Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
          saveTelegramOrders(merged);
          return merged;
        });
      } else {
        setOrders(getTelegramOrders());
      }
      const cfg = await syncTelegramConfig();
      if (cfg) {
        setConfig(cfg);
        if (cfg.webhookUrl && !cfg.webhookUrl.includes('telegram.shwemingalar.app')) {
          setWebhookUrl(cfg.webhookUrl);
        }
        if (cfg.channelId) setChannelId(cfg.channelId);
        if (cfg.accountName) setAccountName(cfg.accountName);
      }
    } catch (err) {
      console.error('Failed to refresh orders from server:', err);
      setOrders(getTelegramOrders());
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

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
      senderPhone: undefined,
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

  const handleApproveOrder = (order: TelegramIncomingOrder) => {
    if (order.status === 'approved') {
      alert('⚠️ ဤအမှာစာအား ယခင်ကပင် ဒိုင်စာရင်းသို့ အတည်ပြုပြီးဖြစ်ပါသည် (Duplicate approval blocked)');
      return;
    }
    const fp = generateSubmissionFingerprint('TG_APPROVE', { id: order.id, raw: order.rawText, total: order.totalAmount });
    if (isDuplicateSubmission(fp, 4000)) {
      alert('⚠️ ခေတ္တစောင့်ပါ၊ ဤအမှာစာကို ယခုလေးတင် အတည်ပြုပြီးဖြစ်ပါသည်');
      return;
    }

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
    updateTelegramOrderOnServer(order.id, { status: 'approved' });

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
    updateTelegramOrderOnServer(orderId, { status: 'rejected' });
  };

  const handleDeleteOrder = (orderId: string) => {
    const updated = orders.filter(o => o.id !== orderId);
    handleUpdateOrders(updated);
    if (selectedOrderId === orderId) setSelectedOrderId(null);
    deleteTelegramOrderOnServer(orderId);
  };

  const handleTestConnection = async () => {
    let rawInput = botToken.trim() || config.botToken || '';
    const nameCandidate = accountName.trim();
    const channelCandidate = channelId.trim();

    if (!isValidTokenFormat(cleanTelegramToken(rawInput))) {
      if (isValidTokenFormat(cleanTelegramToken(nameCandidate))) {
        rawInput = nameCandidate;
        setBotToken(cleanTelegramToken(nameCandidate));
        setAccountName(botToken.trim().startsWith('@') ? botToken.trim() : '');
      } else if (isValidTokenFormat(cleanTelegramToken(channelCandidate))) {
        rawInput = channelCandidate;
        setBotToken(cleanTelegramToken(channelCandidate));
        setChannelId('');
      }
    }

    const cleaned = cleanTelegramToken(rawInput);

    if (!cleaned && !config.hasServerToken) {
      setTestDiagnostics({
        status: 'disconnected',
        message: 'Telegram Bot Token ထည့်သွင်းထားခြင်း မရှိသေးပါ'
      });
      return;
    }

    if (cleaned && (cleaned.startsWith('@') || (!cleaned.includes(':') && cleaned.length > 0))) {
      setTestDiagnostics({
        status: 'error',
        errorType: 'format_username',
        message: '⚠️ ထည့်သွင်းထားသည်မှာ Bot Username (@name) ဖြစ်နေပါသည်။ BotFather မှ ပေးသော နံပါတ်နှင့်စသည့် Token (ဥပမာ 123456789:ABCdef...) ကို ထည့်သွင်းပေးပါ'
      });
      return;
    }

    if (cleaned && !isValidTokenFormat(cleaned)) {
      setTestDiagnostics({
        status: 'error',
        errorType: 'format_invalid',
        message: '⚠️ Bot Token ပုံစံ မမှန်ကန်ပါ။ ရှေ့တွင် Bot ID ဂဏန်း ၇ လုံးမှ ၁၂ လုံးနှင့် colon (:) ပါဝင်ရပါမည်'
      });
      return;
    }

    setIsTestingConnection(true);
    setTestDiagnostics(null);

    const result = await testTelegramConnection(cleaned || '', webhookUrl.trim() || undefined);
    setIsTestingConnection(false);

    setTestDiagnostics({
      status: result.status,
      message: result.message,
      bot: result.bot,
      errorType: result.errorType,
      details: result.details
    });

    if (result.status === 'connected') {
      const finalToken = cleaned || config.botToken || '';
      const updatedConfig: TelegramAccountConfig = {
        botToken: finalToken,
        channelId: channelId.trim(),
        accountName: accountName.trim() || (result.bot ? `@${result.bot.username || result.bot.firstName}` : ''),
        webhookUrl: webhookUrl.trim(),
        status: 'connected',
        statusMessage: result.message,
        connectedAt: new Date().toISOString(),
        hasServerToken: true,
        botInfo: result.bot
      };
      if (finalToken) setBotToken(finalToken);
      if (result.bot && !accountName.trim()) {
        setAccountName(`@${result.bot.username || result.bot.firstName}`);
      }
      setConfig(updatedConfig);
      saveTelegramConfig(updatedConfig);
    } else {
      setConfig(prev => ({
        ...prev,
        status: result.status,
        statusMessage: result.message
      }));
    }
  };

  const handleRestorePolling = async () => {
    setIsRestoringPolling(true);
    const res = await deleteTelegramWebhook();
    setIsRestoringPolling(false);

    if (res.ok) {
      setWebhookActionMsg({
        type: 'success',
        text: '✓ Webhook အား ဖျက်သိမ်းပြီး တိုက်ရိုက် Auto-Polling စနစ်ကို အောင်မြင်စွာ ပြန်လည်အသက်သွင်းလိုက်ပါပြီ!'
      });
      setWebhookUrl('');
      handleTestConnection();
    } else {
      setWebhookActionMsg({
        type: 'error',
        text: `✕ Webhook ဖျက်သိမ်းမှု မအောင်မြင်ပါ: ${res.message}`
      });
    }
    setTimeout(() => setWebhookActionMsg(null), 6000);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        const cleaned = cleanTelegramToken(clipText);
        setBotToken(cleaned || clipText.trim());
      }
    } catch {}
  };

  const handleAutoDetectWebhook = () => {
    const origin = window.location.origin;
    const activeShop = getShopId();
    const detected = activeShop && activeShop !== 'default'
      ? `${origin}/api/telegram/webhook/${activeShop}`
      : `${origin}/api/telegram/webhook`;
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
    const tokenToUse = cleanTelegramToken(botToken.trim() || config.botToken || '');
    if (!tokenToUse && !config.hasServerToken) {
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
        text: 'Webhook URL သည် https:// ဖြင့် စတင်ရပါမည်'
      });
      setTimeout(() => setWebhookActionMsg(null), 4000);
      return;
    }

    setIsRegisteringWebhook(true);
    setWebhookActionMsg(null);

    const currentConf: TelegramAccountConfig = {
      botToken: tokenToUse,
      channelId: channelId.trim(),
      accountName: accountName.trim(),
      webhookUrl: webhookUrl.trim(),
      status: config.status,
      statusMessage: config.statusMessage
    };
    saveTelegramConfig(currentConf);

    const res = await registerTelegramWebhook(webhookUrl.trim());
    setIsRegisteringWebhook(false);

    if (res.ok) {
      setWebhookActionMsg({
        type: 'success',
        text: '✓ Telegram Bot Server သို့ Webhook အောင်မြင်စွာ ချိတ်ဆက်မှတ်ပုံတင်ပြီးပါပြီ!'
      });
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
      setTestDiagnostics(null);
      setConfig({
        botToken: '',
        channelId: '',
        accountName: '',
        webhookUrl: '',
        status: 'disconnected',
        statusMessage: 'Telegram Bot Token ဖျက်ပြီးပါပြီ',
        hasServerToken: false
      });
      setWebhookActionMsg({
        type: 'success',
        text: '✓ Telegram Bot Token ကို အောင်မြင်စွာ ဖျက်ပြီးပါပြီ။'
      });
      setTimeout(() => setWebhookActionMsg(null), 4000);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();

    let rawInput = botToken.trim() || config.botToken || '';
    const nameCandidate = accountName.trim();
    const channelCandidate = channelId.trim();

    if (!isValidTokenFormat(cleanTelegramToken(rawInput))) {
      if (isValidTokenFormat(cleanTelegramToken(nameCandidate))) {
        rawInput = nameCandidate;
        setBotToken(cleanTelegramToken(nameCandidate));
        setAccountName(botToken.trim().startsWith('@') ? botToken.trim() : '');
      } else if (isValidTokenFormat(cleanTelegramToken(channelCandidate))) {
        rawInput = channelCandidate;
        setBotToken(cleanTelegramToken(channelCandidate));
        setChannelId('');
      }
    }

    const cleaned = cleanTelegramToken(rawInput);

    if (!cleaned && !config.hasServerToken) {
      const newConfig: TelegramAccountConfig = {
        botToken: '',
        channelId: channelId.trim(),
        accountName: accountName.trim(),
        webhookUrl: webhookUrl.trim(),
        status: 'disconnected',
        statusMessage: 'Telegram Bot Token ထည့်သွင်းထားခြင်း မရှိသေးပါ'
      };
      setConfig(newConfig);
      saveTelegramConfig(newConfig);
      setConfigSuccess(true);
      setTimeout(() => setConfigSuccess(false), 2500);
      return;
    }

    if (cleaned) {
      setIsTestingConnection(true);
      const result = await testTelegramConnection(cleaned, webhookUrl.trim() || undefined);
      setIsTestingConnection(false);

      const newConfig: TelegramAccountConfig = {
        botToken: cleaned,
        channelId: channelId.trim(),
        accountName: accountName.trim() || (result.bot ? `@${result.bot.username || result.bot.firstName}` : ''),
        webhookUrl: webhookUrl.trim(),
        status: result.status,
        statusMessage: result.message,
        connectedAt: result.status === 'connected' ? new Date().toISOString() : undefined,
        hasServerToken: result.status === 'connected',
        botInfo: result.bot
      };
      setConfig(newConfig);
      saveTelegramConfig(newConfig);
      setTestDiagnostics({
        status: result.status,
        message: result.message,
        bot: result.bot,
        errorType: result.errorType,
        details: result.details
      });
    } else {
      const newConfig: TelegramAccountConfig = {
        ...config,
        channelId: channelId.trim(),
        accountName: accountName.trim(),
        webhookUrl: webhookUrl.trim()
      };
      setConfig(newConfig);
      saveTelegramConfig(newConfig);
    }

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
              activeTab === 'queue' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>အမှာစာများ စာရင်း ({orders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('new_order')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'new_order' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>အမှာစာ အသစ်သွင်းရန် (Simulate/Paste)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'settings' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>Telegram Bot ဆက်တင်များ</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50" {...telegramSwipeHandlers}>
          
          {/* TAB 1: QUEUE */}
          {activeTab === 'queue' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="text-slate-500">အခြေအနေ:</span>
                  {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setStatusFilter(f)}
                      className={`px-3 py-1.5 rounded-xl transition-colors cursor-pointer ${
                        statusFilter === f ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-600' : ''}`} />
                  <span>{isRefreshing ? 'ရယူနေဆဲ...' : 'Refresh'}</span>
                </button>
              </div>

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
                            isSelected ? 'border-sky-500 ring-2 ring-sky-100' : 'border-slate-200 hover:border-slate-300'
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
                                  {new Date(order.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>

                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                              order.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                              order.status === 'rejected' ? 'bg-rose-100 text-rose-800' :
                              'bg-amber-100 text-amber-800 animate-pulse'
                            }`}>
                              {order.status === 'approved' ? 'အတည်ပြုပြီး' : order.status === 'rejected' ? 'ပယ်ဖျက်ပြီး' : 'စောင့်ဆိုင်းဆဲ'}
                            </span>
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
                                    onClick={() => handleStartVoucherEntry(order)}
                                    className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                                  >
                                    ဘောင်ချာသွင်းမည်
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveOrder(order)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                                  >
                                    လက်ခံမည်
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

                <div className="md:col-span-6">
                  {selectedOrder ? (
                    isVoucherEntryMode ? (
                      <div className="bg-white border-2 border-sky-400 rounded-2xl p-4 space-y-3.5 shadow-md sticky top-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                          <h4 className="text-xs font-black text-slate-900">📝 ဘောင်ချာ စာရင်းသွင်း စစ်ဆေးခြင်း</h4>
                          <button type="button" onClick={() => setIsVoucherEntryMode(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer">
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-1.5 max-h-48 overflow-y-auto border border-slate-200 p-2 rounded-xl bg-slate-50/50">
                          {voucherItems.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 bg-white p-1.5 rounded-lg border border-slate-200 text-xs">
                              <input
                                type="text"
                                value={item.number}
                                onChange={(e) => handleUpdateVoucherItem(idx, 'number', e.target.value)}
                                className="w-16 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 font-mono font-bold text-center"
                              />
                              <input
                                type="number"
                                value={item.amount || ''}
                                onChange={(e) => handleUpdateVoucherItem(idx, 'amount', parseInt(e.target.value, 10) || 0)}
                                className="w-24 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 font-mono font-bold text-emerald-700 text-right"
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateVoucherItem(idx, 'isRumble', !item.isRumble)}
                                className={`px-2 py-1 rounded font-bold text-[10px] cursor-pointer ${
                                  item.isRumble ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                                }`}
                              >
                                {item.isRumble ? 'R (ပတ်)' : 'တည့်'}
                              </button>
                              <button type="button" onClick={() => handleRemoveVoucherItem(idx)} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleConfirmEditedVoucher(selectedOrder)}
                            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
                          >
                            ✅ စစ်ဆေးပြီး အတည်ပြုမည် (Confirm Voucher)
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs sticky top-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                          <h4 className="text-sm font-bold text-slate-900">{selectedOrder.senderName}</h4>
                          <span className="text-xs font-mono text-slate-500">ID: {selectedOrder.id}</span>
                        </div>

                        <pre className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 whitespace-pre-wrap max-h-36 overflow-y-auto">
                          {selectedOrder.rawText}
                        </pre>

                        {selectedOrder.status === 'pending_review' && (
                          <div className="flex flex-col gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => handleStartVoucherEntry(selectedOrder)}
                              className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs rounded-xl cursor-pointer"
                            >
                              📝 ဘောင်ချာ စာရင်းသွင်းမည်
                            </button>
                          </div>
                        )}
                      </div>
                    )
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

          {/* TAB 2: NEW ORDER */}
          {activeTab === 'new_order' && (
            <form onSubmit={handleCreateOrder} className="bg-white border border-slate-200 rounded-2xl p-5 max-w-2xl mx-auto space-y-4 shadow-xs">
              <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                Telegram မှ အမှာစာအသစ် လက်ခံခြင်း (Simulate / OCR)
              </h4>

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
                <label className="block text-xs font-bold text-slate-700 mb-1">ထိုးကြေးစာရင်း</label>
                <textarea
                  value={newRawText}
                  onChange={(e) => setNewRawText(convertMyanmarToEnglishDigits(e.target.value))}
                  placeholder={`123=1000\n456=500`}
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs font-mono text-slate-900"
                />
              </div>

              <div className="flex justify-end pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                >
                  အမှာစာ တင်သွင်းမည် (Add to Queue)
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <form onSubmit={handleSaveConfig} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 space-y-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-sky-600" />
                    <h4 className="text-sm font-black text-slate-900">Telegram Bot API & Webhook ဆက်တင်များ</h4>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    config.status === 'connected' ? 'bg-emerald-100 text-emerald-800' :
                    config.status === 'error' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {config.status === 'connected' ? `✓ Connected ${config.accountName || ''}` : config.status === 'error' ? '✕ Error' : 'Disconnected'}
                  </span>
                </div>

                {configSuccess && (
                  <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>✓ Telegram ဆက်တင်များကို အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။</span>
                  </div>
                )}

                {webhookActionMsg && (
                  <div className={`p-3 rounded-xl text-xs font-bold border flex items-center gap-2 ${
                    webhookActionMsg.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}>
                    {webhookActionMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                    <span>{webhookActionMsg.text}</span>
                  </div>
                )}

                {testDiagnostics && (
                  <div className={`p-3.5 rounded-xl text-xs space-y-1.5 border ${
                    testDiagnostics.status === 'connected' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}>
                    <div className="font-bold flex items-center gap-1.5">
                      {testDiagnostics.status === 'connected' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                      <span>{testDiagnostics.message}</span>
                    </div>
                    {testDiagnostics.details && <p className="text-[11px] font-mono opacity-90">{testDiagnostics.details}</p>}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">Telegram Bot Token (@BotFather)</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowBotToken(!showBotToken)}
                          className="text-[11px] text-sky-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {showBotToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{showBotToken ? 'ဝှက်မည်' : 'ပြမည်'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handlePasteFromClipboard}
                          className="text-[11px] text-slate-600 hover:underline font-bold cursor-pointer"
                        >
                          Paste
                        </button>
                      </div>
                    </div>
                    <input
                      type={showBotToken ? "text" : "password"}
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700">Webhook URL (Vercel Serverless Endpoint)</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleAutoDetectWebhook}
                          className="text-[11px] text-sky-600 hover:underline font-bold cursor-pointer"
                        >
                          Auto-Detect
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyWebhook}
                          className="text-[11px] text-slate-600 hover:underline font-bold cursor-pointer"
                        >
                          {copiedWebhook ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://your-domain.vercel.app/api/telegram/webhook/shop_1"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={isTestingConnection}
                      className="px-3.5 py-2 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin text-sky-600' : ''}`} />
                      <span>{isTestingConnection ? 'စစ်ဆေးနေပါသည်...' : 'Bot Token စစ်ဆေးမည် (Test)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRegisterWebhookWithTelegram}
                      disabled={isRegisteringWebhook}
                      className="px-3.5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>{isRegisteringWebhook ? 'ချိတ်ဆက်နေပါသည်...' : 'Webhook မှတ်ပုံတင်မည်'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRestorePolling}
                      disabled={isRestoringPolling}
                      className="px-3.5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>Auto-Polling သို့ ပြန်ပြောင်းမည်</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {config.hasServerToken && (
                      <button
                        type="button"
                        onClick={handleClearToken}
                        className="px-3 py-2 text-rose-600 hover:bg-rose-50 font-bold text-xs rounded-xl cursor-pointer"
                      >
                        Disconnect
                      </button>
                    )}
                    <button
                      type="submit"
                      className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl cursor-pointer"
                    >
                      သိမ်းဆည်းမည် (Save)
                    </button>
                  </div>
                </div>
              </form>

              {/* Group Chat & Privacy Guide */}
              <div className="bg-sky-50/60 border border-sky-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2 text-sky-900 font-black text-xs">
                  <ShieldCheck className="w-4 h-4 text-sky-600" />
                  <span>Telegram Group Chats မှ အမှာစာများ အလိုအလျောက် လက်ခံရန် လမ်းညွှန်ချက်</span>
                </div>
                <ul className="text-xs text-slate-700 space-y-2 list-disc pl-5 font-medium leading-relaxed">
                  <li>
                    <strong>Bot ကို Telegram Group သို့ ထည့်သွင်းပါ:</strong> ထိုးကြေးအမှာစာများ ပို့ဆောင်မည့် Telegram Group ထဲသို့ မိမိ၏ Bot ကို Add လုပ်ပေးပါခင်ဗျာ။
                  </li>
                  <li>
                    <strong>Group Privacy ဖြုတ်ရန် (သို့မဟုတ်) Bot ကို Admin ပေးရန်:</strong>
                    <br />
                    Telegram privacy စည်းမျဉ်းအရ Bot သည် Group ထဲမှ စာများကို ဖတ်ယူနိုင်ရန်အတွက် <code>@BotFather</code> ထံ သွားရောက်၍ <code>/mybots</code> &gt; Bot ရွေးချယ်ပါ &gt; <strong>Bot Settings</strong> &gt; <strong>Group Privacy</strong> &gt; <strong>Turn off</strong> ပြုလုပ်ပေးပါ (သို့မဟုတ် Group ထဲတွင် Bot ကို Admin အဖြစ် ခန့်အပ်ပေးပါ)။
                  </li>
                  <li>
                    <strong>မက်ဆေ့ခ်ျ ပုံစံ:</strong> Group သို့မဟုတ် Private Chat တွင် အဖွဲ့ဝင်များ ရိုက်ပို့သော စာများ (ဥပမာ <code>123=1000</code> သို့မဟုတ် ဓါတ်ပုံအမှာစာများ) သည် Webhook / Polling မှတစ်ဆင့် Dashboard ထံ တိုက်ရိုက် ရောက်ရှိလာမည်ဖြစ်ပါသည်။
                  </li>
                </ul>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
