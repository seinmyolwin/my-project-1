import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Camera,
  Upload,
  Image as ImageIcon,
  RotateCw,
  Sliders,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Plus,
  ArrowRight,
  User,
  Phone,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  Zap,
  Ban
} from 'lucide-react';
import { useLottery } from '../context/LotteryContext';
import { formatAmount, convertMyanmarToEnglishDigits } from '../utils/lotteryUtils';
import {
  preprocessCanvas,
  parseSlipImageText,
  performOfflineOCR,
  ExtractedBetRow,
  ParseImageResult
} from '../utils/imageOcrUtils';
import { BetItem, Voucher } from '../types';

interface ImageSlipScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBetsToCart: (items: BetItem[], customerName: string, customerPhone: string) => void;
  onDirectCreateVoucher?: (items: BetItem[], customerName: string, customerPhone: string) => void;
}

export const ImageSlipScannerModal: React.FC<ImageSlipScannerModalProps> = ({
  isOpen,
  onClose,
  onAddBetsToCart,
  onDirectCreateVoucher
}) => {
  const {
    settings,
    aggregates,
    limits,
    blockedNumbers,
    activeRound,
    isNumberBlocked
  } = useLottery();

  const isMyanmar = settings.language === 'my';

  // Image source state
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(40);
  const [brightness, setBrightness] = useState<number>(10);
  const [enableThreshold, setEnableThreshold] = useState<boolean>(false);
  const [isGrayscale, setIsGrayscale] = useState<boolean>(true);

  // Scanning & OCR state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStatusText, setScanStatusText] = useState<string>('');
  const [rawOcrText, setRawOcrText] = useState<string>('');
  const [showRawText, setShowRawText] = useState<boolean>(false);

  // Parsed Output State
  const [detectedCustomerName, setDetectedCustomerName] = useState<string>('အထွေထွေ (Photo Entry)');
  const [detectedCustomerPhone, setDetectedCustomerPhone] = useState<string>('');
  const [extractedRows, setExtractedRows] = useState<ExtractedBetRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [manualNumber, setManualNumber] = useState<string>('');
  const [manualAmount, setManualAmount] = useState<string>('1000');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Reset state when opened or closed
  useEffect(() => {
    if (!isOpen) {
      setImageSrc(null);
      setExtractedRows([]);
      setRawOcrText('');
      setScanProgress(0);
      setIsScanning(false);
      setRotation(0);
    }
  }, [isOpen]);

  // Handle Clipboard Paste for instant image pasting (Ctrl + V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                loadImage(event.target.result as string);
              }
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  if (!isOpen) return null;

  // Load image into canvas and auto-enhance
  const loadImage = (src: string) => {
    setImageSrc(src);
    setRotation(0);
    setExtractedRows([]);
    setRawOcrText('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        loadImage(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Render & pre-process image onto HTMLCanvasElement
  const prepareCanvas = (): HTMLCanvasElement | null => {
    if (!imageSrc) return null;

    const img = document.createElement('img');
    img.src = imageSrc;

    const tempCanvas = document.createElement('canvas');
    const isRotated = rotation === 90 || rotation === 270;
    tempCanvas.width = isRotated ? img.naturalHeight || img.height : img.naturalWidth || img.width;
    tempCanvas.height = isRotated ? img.naturalWidth || img.width : img.naturalHeight || img.height;

    const ctx = tempCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    // Apply pre-processing filters (contrast, grayscale, threshold)
    return preprocessCanvas(tempCanvas, {
      contrast,
      brightness,
      threshold: enableThreshold,
      grayscale: isGrayscale
    });
  };

  // Start OCR & Smart Parse
  const handleStartOCR = async () => {
    if (!imageSrc) return;

    setIsScanning(true);
    setScanProgress(5);
    setScanStatusText(isMyanmar ? 'ပုံရိပ်အား စစ်ဆေးနေပါသည်...' : 'Processing image...');

    try {
      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        const isRotated = rotation === 90 || rotation === 270;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = isRotated ? img.naturalHeight || 800 : img.naturalWidth || 800;
        tempCanvas.height = isRotated ? img.naturalWidth || 800 : img.naturalHeight || 800;

        const ctx = tempCanvas.getContext('2d');
        if (!ctx) {
          setIsScanning(false);
          return;
        }

        ctx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

        const processed = preprocessCanvas(tempCanvas, {
          contrast,
          brightness,
          threshold: enableThreshold,
          grayscale: isGrayscale
        });

        try {
          const text = await performOfflineOCR(processed, (pct, status) => {
            setScanProgress(pct);
            setScanStatusText(status);
          });

          setRawOcrText(text);
          const parsed: ParseImageResult = parseSlipImageText(text);

          if (parsed.customerName) {
            setDetectedCustomerName(parsed.customerName);
          }
          if (parsed.customerPhone) {
            setDetectedCustomerPhone(parsed.customerPhone);
          }

          setExtractedRows(parsed.extractedItems);
          setWarnings(parsed.warnings);
          setIsScanning(false);
        } catch (err) {
          console.error('OCR Error:', err);
          setIsScanning(false);
          setScanStatusText('OCR ဖတ်ယူရာတွင် အခက်အခဲရှိပါသည်။ ကျေးဇူးပြု၍ စာသားများ ရှင်းလင်းစွာပါသော ပုံကို ရွေးချယ်ပေးပါ');
        }
      };

      img.src = imageSrc;
    } catch (err) {
      console.error('Scan Error:', err);
      setIsScanning(false);
    }
  };

  // Row update handlers
  const handleUpdateRow = (id: string, field: 'number' | 'amount' | 'isRumble', val: any) => {
    setExtractedRows(prev =>
      prev.map(row => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: val };
        if (field === 'number') {
          updated.number = convertMyanmarToEnglishDigits(String(val)).replace(/[^0-9]/g, '').slice(0, 3);
          updated.isValid = updated.number.length === 3;
        }
        if (field === 'amount') {
          const cleanAmt = convertMyanmarToEnglishDigits(String(val)).replace(/[^0-9]/g, '');
          updated.amount = Math.max(0, parseInt(cleanAmt, 10) || 0);
        }
        return updated;
      })
    );
  };

  const handleDeleteRow = (id: string) => {
    setExtractedRows(prev => prev.filter(r => r.id !== id));
  };

  const handleAddManualRow = () => {
    if (!manualNumber || manualNumber.length !== 3) return;
    const amt = parseInt(manualAmount, 10) || 1000;
    const newRow: ExtractedBetRow = {
      id: `manual-${Date.now()}`,
      number: manualNumber,
      amount: amt,
      isRumble: false,
      originalRaw: `${manualNumber}=${amt}`,
      isValid: true
    };
    setExtractedRows(prev => [...prev, newRow]);
    setManualNumber('');
  };

  // Calculated totals
  const totalAmount = extractedRows.reduce((acc, row) => acc + (row.isValid ? row.amount : 0), 0);
  const validRowsCount = extractedRows.filter(r => r.isValid).length;

  // Confirm and Send to Cart / Quick Sale Entry
  const handleConfirmAddToCart = () => {
    const rawValid = extractedRows.filter(r => r.isValid && r.number.length === 3 && r.amount > 0);
    const blockedFound = rawValid.filter(r => isNumberBlocked(r.number));
    const nonBlocked = rawValid.filter(r => !isNumberBlocked(r.number));

    if (blockedFound.length > 0) {
      const blockedList = Array.from(new Set(blockedFound.map(r => r.number))).join(', ');
      alert(`⚠️ သတိပေးချက်: စလစ်ထဲမှ ဒိုင်ကာဂဏန်းအဖြစ် သတ်မှတ်ထားသော [${blockedList}] များသည် ထိုးကြေးတက်လာစေကာမူ လုံးဝလက်မခံပါသဖြင့် အလိုအလျောက် ပယ်ဖျက်ထားပါသည်`);
    }

    const validItems: BetItem[] = nonBlocked.map(r => ({
      id: `ocr-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      number: r.number,
      amount: r.amount,
      isRumble: r.isRumble,
      originalInput: r.originalRaw || r.number
    }));

    if (validItems.length === 0) {
      if (blockedFound.length > 0) {
        alert('စလစ်ထဲရှိ ဂဏန်းအားလုံးသည် ဒိုင်ကာဂဏန်းများဖြစ်သဖြင့် အရောင်းစာရင်းထဲ မထည့်သွင်းပါ');
      }
      return;
    }

    onAddBetsToCart(
      validItems,
      detectedCustomerName.trim() || 'အထွေထွေ (Photo Entry)',
      detectedCustomerPhone.trim()
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-50 px-4 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center font-bold">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  {isMyanmar ? 'ဓါတ်ပုံ / စလစ် စကင်ဖတ်၍ အရောင်းစာရင်းသွင်းခြင်း' : 'Photo / Receipt Slip Smart Scanner'}
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  100% Offline OCR (အင်တာနက်မလိုပါ)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isMyanmar
                  ? 'လက်ရေးစလစ်၊ Viber/Telegram Screenshot ဓါတ်ပုံများကို ဖတ်ယူပြီး ဂဏန်းနှင့် ထိုးကြေးများကို အလိုအလျောက် ခွဲထုတ်ပေးပါသည်'
                  : 'Capture or upload slips to instantly extract 3D numbers, amounts, and customer info'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Top Stage: Photo Upload / Capture Controls */}
          {!imageSrc ? (
            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/20 rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shadow-xs">
                <ImageIcon className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">
                  {isMyanmar ? 'စလစ်ဓါတ်ပုံ တင်သွင်းရန် သို့မဟုတ် ဓါတ်ပုံရိုက်ရန်' : 'Upload or Capture Slip Photo'}
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {isMyanmar
                    ? 'ကင်မရာဖြင့် ဓါတ်ပုံရိုက်နိုင်သည် သို့မဟုတ် ဖုန်း/ကွန်ပျူတာထဲမှ ပုံရွေးချယ်ပါ (Ctrl+V ဖြင့်လည်း ပုံကူးထည့်နိုင်ပါသည်)'
                    : 'Take a photo with your device camera or pick from gallery (or paste with Ctrl+V)'}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {/* Camera Capture Input */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-transform active:scale-95 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>{isMyanmar ? 'ကင်မရာဖြင့် ဓါတ်ပုံရိုက်မည်' : 'Take Photo (Camera)'}</span>
                </button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* File Picker */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-2xs flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-indigo-600" />
                  <span>{isMyanmar ? 'ဖိုင်/ပုံ ရွေးချယ်မည် (Browse)' : 'Browse Files'}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="pt-2 text-[11px] text-slate-500 flex items-center gap-1.5 font-mono">
                <span>💡 အကြံပြုချက်: ဓါတ်ပုံအား ရှင်းလင်းစွာ ရိုက်ကူးပေးပါက ပိုမိုတိကျစွာ ဖတ်ယူနိုင်ပါသည်</span>
              </div>
            </div>
          ) : (
            /* Image Preview & Pre-processing Toolbar */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* Left Column: Image Canvas & Visual Controls */}
              <div className="lg:col-span-5 space-y-3">
                <div className="bg-slate-900 rounded-2xl p-2 relative overflow-hidden flex items-center justify-center min-h-[260px] max-h-[380px] shadow-inner">
                  <img
                    src={imageSrc}
                    alt="Slip Preview"
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      filter: `${isGrayscale ? 'grayscale(100%)' : ''} contrast(${100 + contrast}%) brightness(${100 + brightness}%)`
                    }}
                    className="max-h-[360px] w-auto object-contain rounded-lg transition-all duration-200"
                  />

                  {/* Scanning Overlay Animation */}
                  {isScanning && (
                    <div className="absolute inset-0 bg-indigo-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-white text-center space-y-3">
                      <div className="w-10 h-10 border-4 border-indigo-400 border-t-white rounded-full animate-spin"></div>
                      <div className="space-y-1">
                        <span className="font-bold text-sm">{scanStatusText || 'ဖတ်ယူနေပါသည်...'}</span>
                        <div className="w-48 bg-slate-800 rounded-full h-2 overflow-hidden mx-auto">
                          <div
                            className="bg-indigo-400 h-full transition-all duration-300"
                            style={{ width: `${scanProgress}%` }}
                          />
                        </div>
                        <span className="text-xs text-indigo-200 font-mono">{scanProgress}%</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Preprocessing & Rotation Controls */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3 text-xs shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{isMyanmar ? 'ပုံရိပ်ကြည်လင်မှု ချိန်ညှိရန် (Enhance)' : 'Image Filters'}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setRotation((r) => (r + 90) % 360)}
                        className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="လှည့်မည် (Rotate)"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>{rotation}°</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setImageSrc(null);
                          setExtractedRows([]);
                        }}
                        className="px-2 py-1 bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 rounded-lg font-semibold flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="ပုံအသစ်လဲမည်"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>ပုံအသစ်လဲမည်</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter Sliders */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                        အလင်းအမှောင် (Contrast): {contrast}
                      </label>
                      <input
                        type="range"
                        min="-20"
                        max="100"
                        value={contrast}
                        onChange={(e) => setContrast(parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 block mb-1">
                        အဖြူအမည်း (Grayscale)
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsGrayscale(!isGrayscale)}
                        className={`w-full py-1 rounded-lg font-bold border transition-colors cursor-pointer ${
                          isGrayscale
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {isGrayscale ? 'အဖြူအမည်း ဖွင့်ထားသည်' : 'မူရင်းရောင်စုံ'}
                      </button>
                    </div>
                  </div>

                  {/* Start Scan Button */}
                  <button
                    type="button"
                    onClick={handleStartOCR}
                    disabled={isScanning}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                  >
                    {isScanning ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-amber-300" />
                    )}
                    <span>
                      {extractedRows.length > 0
                        ? isMyanmar ? 'ပြန်လည် စကင်ဖတ်မည် (Re-scan)' : 'Re-scan Photo'
                        : isMyanmar ? 'ဓါတ်ပုံထဲမှ ဂဏန်းများ စကင်ဖတ်မည် (Scan Now)' : 'Scan & Extract Bets'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Right Column: Parsed Results, Customer Info & Staged Review Table */}
              <div className="lg:col-span-7 space-y-4">
                
                {/* Customer Details Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{isMyanmar ? 'စလစ်တွင် တွေ့ရှိသော ဝယ်သူ/ထိုးသူ အချက်အလက်' : 'Customer Detected'}</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500 block">
                        {isMyanmar ? 'ဝယ်သူအမည်' : 'Customer Name'}
                      </label>
                      <input
                        type="text"
                        value={detectedCustomerName}
                        onChange={(e) => setDetectedCustomerName(e.target.value)}
                        placeholder="အမည် ရိုက်ထည့်ပါ"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500 block">
                        {isMyanmar ? 'ဖုန်းနံပါတ်' : 'Phone'}
                      </label>
                      <input
                        type="text"
                        value={detectedCustomerPhone}
                        onChange={(e) => setDetectedCustomerPhone(e.target.value)}
                        placeholder="09-xxxxxxx"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Extracted Numbers Table */}
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs space-y-2">
                  <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold text-slate-900">
                        {isMyanmar ? 'ဖတ်ယူတွေ့ရှိသော ဂဏန်းများနှင့် ထိုးကြေးများ' : 'Detected Numbers & Amounts'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-mono font-bold">
                        {validRowsCount} လုံး
                      </span>
                    </div>

                    <span className="text-xs font-mono font-bold text-emerald-700">
                      {isMyanmar ? 'စုစုပေါင်း: ' : 'Total: '}
                      {formatAmount(totalAmount, settings.currency)}
                    </span>
                  </div>

                  {/* Rows List */}
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 p-2">
                    {extractedRows.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs space-y-1">
                        <p>{isMyanmar ? 'ဂဏန်းစာရင်းများ မတွေ့ရှိသေးပါ' : 'No numbers detected yet'}</p>
                        <p className="text-[11px] text-slate-400">
                          {isMyanmar ? 'ဘယ်ဘက်ရှိ "Scan Now" ခလုတ်ကို နှိပ်ပေးပါ' : 'Click "Scan Now" to extract numbers'}
                        </p>
                      </div>
                    ) : (
                      extractedRows.map((row, idx) => {
                        const isBlocked = !!blockedNumbers[row.number];
                        const limit = limits[row.number] !== undefined ? limits[row.number] : settings.globalStockLimit;
                        const currentSold = aggregates[row.number]?.totalSold || 0;
                        const isOverLimit = limit > 0 && (currentSold + row.amount) > limit;

                        return (
                          <div
                            key={row.id}
                            className={`flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg text-xs transition-colors ${
                              isBlocked
                                ? 'bg-rose-50 border border-rose-200'
                                : isOverLimit
                                ? 'bg-amber-50 border border-amber-200'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-400 text-[11px] w-5 text-right">
                                {idx + 1}.
                              </span>

                              {/* Number input */}
                              <input
                                type="text"
                                maxLength={3}
                                value={row.number}
                                onChange={(e) => handleUpdateRow(row.id, 'number', e.target.value)}
                                onFocus={(e) => e.target.select()}
                                className={`w-16 px-2 py-1 text-center font-mono font-black text-sm rounded border ${
                                  row.isValid
                                    ? 'border-slate-300 text-indigo-950 bg-white'
                                    : 'border-rose-400 text-rose-700 bg-rose-50'
                                }`}
                              />

                              {/* Rumble / Straight Badge */}
                              <button
                                type="button"
                                onClick={() => handleUpdateRow(row.id, 'isRumble', !row.isRumble)}
                                className={`px-2 py-1 rounded text-[10px] font-bold font-mono border transition-colors cursor-pointer ${
                                  row.isRumble
                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                }`}
                                title="ပတ်လည် (R) အဖြစ် ပြောင်းရန်"
                              >
                                {row.isRumble ? 'R (ပတ်)' : 'တည့်'}
                              </button>

                              {/* Warning indicators */}
                              {isBlocked && (
                                <span className="text-[10px] bg-rose-600 text-white font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow-2xs">
                                  <Ban className="w-3 h-3" />
                                  ဒိုင်ကာ (လက်မခံပါ)
                                </span>
                              )}
                              {isOverLimit && !isBlocked && (
                                <span className="text-[10px] bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded">
                                  ဘရိတ်ပြည့်!
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Amount Input */}
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="100"
                                  min="100"
                                  value={row.amount}
                                  onChange={(e) => handleUpdateRow(row.id, 'amount', e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  className="w-24 px-2 py-1 text-right font-mono font-bold text-xs rounded border border-slate-300 bg-white text-emerald-700"
                                />
                                <span className="text-[11px] text-slate-400">{settings.currency}</span>
                              </div>

                              {/* Delete button */}
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                                title="ဖျက်မည်"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add Missing Row Bar */}
                  <div className="bg-slate-50 p-2 border-t border-slate-100 flex items-center gap-2 text-xs">
                    <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                      {isMyanmar ? '+ လိုအပ်သော ဂဏန်းထပ်ဖြည့်ရန်:' : '+ Add row:'}
                    </span>
                    <input
                      type="text"
                      maxLength={3}
                      value={manualNumber}
                      onChange={(e) => setManualNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                      placeholder="000"
                      className="w-16 px-2 py-1 text-center font-mono font-bold rounded border border-slate-200 bg-white"
                    />
                    <input
                      type="number"
                      step="100"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(e.target.value)}
                      placeholder="1000"
                      className="w-20 px-2 py-1 text-right font-mono font-bold rounded border border-slate-200 bg-white text-emerald-700"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualRow}
                      disabled={manualNumber.length !== 3}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-lg cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Raw OCR Text Debug Toggle */}
                {rawOcrText && (
                  <div className="text-[11px]">
                    <button
                      type="button"
                      onClick={() => setShowRawText(!showRawText)}
                      className="text-indigo-600 hover:underline font-semibold"
                    >
                      {showRawText ? '▲ OCR မူရင်းစာသား ဝှက်မည်' : '▼ OCR မူရင်းစာသား ကြည့်မည်'}
                    </button>
                    {showRawText && (
                      <pre className="bg-slate-100 p-2 rounded-lg mt-1 text-[10px] text-slate-700 font-mono max-h-24 overflow-y-auto whitespace-pre-wrap">
                        {rawOcrText}
                      </pre>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer with Actions */}
        <div className="bg-slate-50 px-4 sm:px-6 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            {extractedRows.length > 0 && (
              <span>
                စုစုပေါင်း <b>{validRowsCount}</b> လုံး (တန်ဖိုး: <b className="text-emerald-700 font-mono">{formatAmount(totalAmount, settings.currency)}</b>)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              {isMyanmar ? 'ပိတ်မည်' : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={handleConfirmAddToCart}
              disabled={validRowsCount === 0}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isMyanmar ? 'အရောင်းစာရင်းထဲသို့ ပေါင်းထည့်မည်' : 'Add to Sales Cart'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
