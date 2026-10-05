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
import { formatAmount, convertMyanmarToEnglishDigits, getPermutations } from '../utils/lotteryUtils';
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
  mode?: '3d' | '2d' | 'auto';
}

export const ImageSlipScannerModal: React.FC<ImageSlipScannerModalProps> = ({
  isOpen,
  onClose,
  onAddBetsToCart,
  onDirectCreateVoucher,
  mode = 'auto'
}) => {
  const targetMode: '3d' | '2d' | 'auto' = (mode === '2d' || mode === '3d') ? mode : 'auto';
  const {
    settings,
    aggregates,
    limits,
    blockedNumbers,
    activeRound,
    isNumberBlocked
  } = useLottery();

  const isMyanmar = settings.language === 'my';

  // Input source mode: photo scan vs direct chat text paste
  const [inputTab, setInputTab] = useState<'photo' | 'text'>('photo');
  const [directPasteText, setDirectPasteText] = useState<string>('');

  // Image source state (default natural colorful mode for crisp Viber/Telegram screenshots)
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(0);
  const [brightness, setBrightness] = useState<number>(0);
  const [enableThreshold, setEnableThreshold] = useState<boolean>(false);
  const [isGrayscale, setIsGrayscale] = useState<boolean>(false);

  // Scanning & OCR state
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStatusText, setScanStatusText] = useState<string>('');
  const [rawOcrText, setRawOcrText] = useState<string>('');
  const [showRawText, setShowRawText] = useState<boolean>(false);
  const [isEditingRawText, setIsEditingRawText] = useState<boolean>(false);

  // Parsed Output State
  const [detectedCustomerName, setDetectedCustomerName] = useState<string>('အထွေထွေ (Photo / Chat Entry)');
  const [detectedCustomerPhone, setDetectedCustomerPhone] = useState<string>('');
  const [extractedRows, setExtractedRows] = useState<ExtractedBetRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [manualNumber, setManualNumber] = useState<string>('');
  const [manualAmount, setManualAmount] = useState<string>('1000');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Real Live Camera Stream state
  const [isLiveCameraActive, setIsLiveCameraActive] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopLiveCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLiveCameraActive(false);
    setCameraError(null);
  }, []);

  const startLiveCamera = async (facing: 'environment' | 'user' = 'environment') => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      streamRef.current = stream;
      setCameraFacingMode(facing);
      setIsLiveCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => console.error('Video play error:', e));
      }
    } catch (err: any) {
      console.warn('getUserMedia error, falling back to camera input:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError(isMyanmar ? 'ကင်မရာ အသုံးပြုခွင့် (Camera Permission) ကို Browser တွင် Allow ပေးပါ' : 'Camera permission was denied in browser');
      } else {
        setCameraError(isMyanmar ? 'ကင်မရာ ချိတ်ဆက်မရပါ (ဖိုင်ရွေးချယ်မှုကို အသုံးပြုနိုင်ပါသည်)' : 'Camera not accessible');
      }
      cameraInputRef.current?.click();
    }
  };

  const capturePhotoFromCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    stopLiveCamera();
    loadImage(dataUrl);
  };

  const switchCameraFacingMode = () => {
    const nextFacing = cameraFacingMode === 'environment' ? 'user' : 'environment';
    startLiveCamera(nextFacing);
  };

  // Connect video element when live camera turns active
  useEffect(() => {
    if (isLiveCameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch((e) => console.error('Video play error:', e));
    }
  }, [isLiveCameraActive]);

  // Clean up stream on modal close or unmount
  useEffect(() => {
    if (!isOpen) {
      stopLiveCamera();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, stopLiveCamera]);

  // Reset state when opened or closed
  useEffect(() => {
    if (!isOpen) {
      stopLiveCamera();
      setImageSrc(null);
      setExtractedRows([]);
      setRawOcrText('');
      setScanProgress(0);
      setIsScanning(false);
      setRotation(0);
    }
  }, [isOpen, stopLiveCamera]);

  // Handle Clipboard Paste for instant image or chat text pasting (Ctrl + V)
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
                loadImage(event.target.result as string, true);
              }
            };
            reader.readAsDataURL(blob);
          }
          return;
        }
      }

      // If text pasted while on direct text tab
      const text = e.clipboardData?.getData('text');
      if (text && inputTab === 'text') {
        setDirectPasteText(text);
        handleParseDirectText(text);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, inputTab]);

  if (!isOpen) return null;

  // Process parsed items into ExtractedBetRow
  const processParsedItems = (items: any[]) => {
    let idCounter = 1;
    const geminiRows: ExtractedBetRow[] = [];

    items.forEach((item: any) => {
      const targetLen = mode === '2d' ? 2 : mode === '3d' ? 3 : (String(item.number || '').length <= 2 ? 2 : 3);
      const num = convertMyanmarToEnglishDigits(String(item.number || '')).replace(/[^0-9]/g, '').slice(0, targetLen);
      const amt = parseInt(convertMyanmarToEnglishDigits(String(item.amount || '0')), 10) || 0;
      const isR = !!item.isRumble;
      const isValidLen = mode === '2d' ? num.length === 2 : mode === '3d' ? num.length === 3 : (num.length === 2 || num.length === 3);

      if (isValidLen && amt > 0) {
        if (isR && num.length === 3) {
          const perms = getPermutations(num);
          perms.forEach((p, idx) => {
            geminiRows.push({
              id: `gemini-${Date.now()}-${idCounter++}`,
              number: p,
              amount: amt,
              isRumble: true,
              originalRaw: `${num} R (${perms.length} ခွေ - ${idx + 1})`,
              isValid: true
            });
          });
        } else if (isR && num.length === 2) {
          const rev = num.split('').reverse().join('');
          geminiRows.push({
            id: `gemini-${Date.now()}-${idCounter++}`,
            number: num,
            amount: amt,
            isRumble: false,
            originalRaw: `${num}=${amt}`,
            isValid: true
          });
          if (rev !== num) {
            geminiRows.push({
              id: `gemini-${Date.now()}-${idCounter++}`,
              number: rev,
              amount: amt,
              isRumble: true,
              originalRaw: `${rev}=${amt} (R)`,
              isValid: true
            });
          }
        } else {
          geminiRows.push({
            id: `gemini-${Date.now()}-${idCounter++}`,
            number: num,
            amount: amt,
            isRumble: false,
            originalRaw: item.originalRaw || `${num}=${amt}`,
            isValid: true
          });
        }
      }
    });

    setExtractedRows(geminiRows);
    setScanProgress(100);
  };

  // Start OCR & Smart Parse via Gemini AI Vision API (with offline Tesseract fallback)
  const handleStartOCR = async (customSrc?: string) => {
    const targetSrc = customSrc || imageSrc;
    if (!targetSrc) return;

    setIsScanning(true);
    setScanProgress(15);
    setScanStatusText(isMyanmar ? 'Viber/Telegram ဓါတ်ပုံအား Gemini AI ဖြင့် ဖတ်ယူနေပါသည်...' : 'Analyzing Viber/Telegram slip with Gemini AI...');

    try {
      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.onload = async () => {
        const isRotated = rotation === 90 || rotation === 270;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = isRotated ? img.naturalHeight || 1200 : img.naturalWidth || 1200;
        tempCanvas.height = isRotated ? img.naturalWidth || 1200 : img.naturalHeight || 1200;

        const ctx = tempCanvas.getContext('2d');
        if (!ctx) {
          setIsScanning(false);
          return;
        }

        ctx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

        // If user explicitly applied filters (for faint paper receipts), apply preprocessCanvas.
        // Otherwise, send crisp original color canvas so Gemini reads Viber/Telegram colored chat bubbles!
        const needsPreprocessing = contrast !== 0 || brightness !== 0 || enableThreshold || isGrayscale;
        const finalCanvas = needsPreprocessing
          ? preprocessCanvas(tempCanvas, { contrast, brightness, threshold: enableThreshold, grayscale: isGrayscale })
          : tempCanvas;

        const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.90);

        try {
          setScanProgress(45);
          setScanStatusText(isMyanmar ? 'ဓါတ်ပုံထဲမှ စာသားနှင့် ဂဏန်းများကို ခွဲထုတ်နေပါသည်...' : 'Extracting text, customer info, and bets...');
          
          const res = await fetch('/api/ocr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: dataUrl, mimeType: 'image/jpeg', mode })
          });

          if (!res.ok) {
            throw new Error('Server OCR failed');
          }

          setScanProgress(85);
          const data = await res.json();

          if (data.rawText) {
            setRawOcrText(data.rawText);
          }

          if (data.customerName && data.customerName !== 'အထွေထွေ (Photo Entry)' && data.customerName !== 'အထွေထွေ (Photo / Chat Entry)') {
            setDetectedCustomerName(data.customerName);
          }
          if (data.customerPhone) {
            setDetectedCustomerPhone(data.customerPhone);
          }

          if (data.items && Array.isArray(data.items) && data.items.length > 0) {
            processParsedItems(data.items);
            setIsScanning(false);
            return;
          }

          // If Gemini extracted text but items array is empty, try local parser on rawText
          if (data.rawText) {
            const localParsed = parseSlipImageText(data.rawText, targetMode);
            if (localParsed.extractedItems.length > 0) {
              setExtractedRows(localParsed.extractedItems);
              setWarnings(localParsed.warnings);
              setScanProgress(100);
              setIsScanning(false);
              return;
            }
          }

          throw new Error('No items detected by Gemini');
        } catch (apiErr) {
          console.warn('Gemini OCR fallback to offline Tesseract:', apiErr);
          setScanProgress(30);
          setScanStatusText(isMyanmar ? 'အော့ဖ်လိုင်း Tesseract ဖြင့် ဖတ်ယူနေပါသည်...' : 'Falling back to offline OCR...');

          const tesseractCanvas = preprocessCanvas(tempCanvas, {
            contrast: contrast || 40,
            brightness: brightness || 10,
            threshold: true,
            grayscale: true
          });

          const text = await performOfflineOCR(tesseractCanvas, (pct, status) => {
            setScanProgress(30 + Math.round(pct * 0.7));
            setScanStatusText(status);
          });

          setRawOcrText(text);
          const parsed: ParseImageResult = parseSlipImageText(text, targetMode);

          if (parsed.customerName) {
            setDetectedCustomerName(parsed.customerName);
          }
          if (parsed.customerPhone) {
            setDetectedCustomerPhone(parsed.customerPhone);
          }

          setExtractedRows(parsed.extractedItems);
          setWarnings(parsed.warnings);
          setIsScanning(false);
        }
      };

      img.src = targetSrc;
    } catch (err) {
      console.error('Scan Error:', err);
      setIsScanning(false);
    }
  };

  // Load image into canvas and auto-enhance & auto-scan
  const loadImage = (src: string, autoScan = true) => {
    stopLiveCamera();
    setImageSrc(src);
    setRotation(0);
    setExtractedRows([]);
    setRawOcrText('');
    if (autoScan) {
      setTimeout(() => {
        handleStartOCR(src);
      }, 80);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        loadImage(event.target.result as string, true);
      }
    };
    reader.readAsDataURL(file);
  };

  // Direct Text Parser for Viber / Telegram / SMS chat messages
  const handleParseDirectText = async (customText?: string) => {
    const textToParse = customText !== undefined ? customText : directPasteText;
    if (!textToParse.trim()) return;

    setIsScanning(true);
    setScanProgress(30);
    setScanStatusText(isMyanmar ? 'မက်ဆေ့ခ်ျစာသားများအား ခွဲထုတ်နေပါသည်...' : 'Extracting bets from chat text...');

    try {
      const res = await fetch('/api/parse-chat-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToParse, mode: targetMode })
      });

      if (res.ok) {
        const data = await res.json();
        setRawOcrText(data.rawText || textToParse);
        if (data.customerName) setDetectedCustomerName(data.customerName);
        if (data.customerPhone) setDetectedCustomerPhone(data.customerPhone);

        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          processParsedItems(data.items);
          setIsScanning(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Chat text parse API fallback to local:', e);
    }

    // Offline / Regex fallback
    setRawOcrText(textToParse);
    const parsed = parseSlipImageText(textToParse, targetMode);
    if (parsed.customerName && parsed.customerName !== 'အထွေထွေ (Photo / Chat Entry)') {
      setDetectedCustomerName(parsed.customerName);
    }
    if (parsed.customerPhone) {
      setDetectedCustomerPhone(parsed.customerPhone);
    }
    setExtractedRows(parsed.extractedItems);
    setWarnings(parsed.warnings);
    setIsScanning(false);
  };

  // Re-extract bets when user edits the raw OCR text
  const handleReExtractFromRawText = async () => {
    if (!rawOcrText.trim()) return;
    await handleParseDirectText(rawOcrText);
    setIsEditingRawText(false);
  };

  // Clipboard Paste Helper Button
  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imgType = item.types.find((t) => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            const reader = new FileReader();
            reader.onload = (e) => {
              if (e.target?.result) {
                loadImage(e.target.result as string, true);
              }
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }

      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setInputTab('text');
          setDirectPasteText(text);
          handleParseDirectText(text);
        }
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
  };

  // Row update handlers
  const handleUpdateRow = (id: string, field: 'number' | 'amount' | 'isRumble', val: any) => {
    setExtractedRows(prev =>
      prev.map(row => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: val };
        if (field === 'number') {
          const maxL = mode === '2d' ? 2 : 3;
          updated.number = convertMyanmarToEnglishDigits(String(val)).replace(/[^0-9]/g, '').slice(0, maxL);
          updated.isValid = mode === '2d' ? updated.number.length === 2 : mode === '3d' ? updated.number.length === 3 : (updated.number.length === 2 || updated.number.length === 3);
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
    const reqLen = mode === '2d' ? 2 : 3;
    const isValidManual = mode === 'auto' ? (manualNumber.length === 2 || manualNumber.length === 3) : manualNumber.length === reqLen;
    if (!manualNumber || !isValidManual) return;
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
    const isLenValid = (len: number) => {
      if (mode === '2d') return len === 2;
      if (mode === '3d') return len === 3;
      return len === 2 || len === 3;
    };
    const rawValid = extractedRows.filter(r => r.isValid && isLenValid(r.number.length) && r.amount > 0);
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
      detectedCustomerName.trim() || 'အထွေထွေ (Photo / Chat Entry)',
      detectedCustomerPhone.trim()
    );
    onClose();
  };

  const renderExtractedRowsTable = () => (
    <div className="space-y-4">
      {/* Customer Details Box */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-2xs">
        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-indigo-600" />
          <span>{isMyanmar ? 'စလစ် / မက်ဆေ့ခ်ျတွင် တွေ့ရှိသော ဝယ်သူ အချက်အလက်' : 'Customer Detected'}</span>
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
              onFocus={(e) => {
                const target = e.currentTarget;
                target.select();
                setTimeout(() => target.select(), 20);
              }}
              onClick={(e) => {
                const target = e.currentTarget;
                target.select();
                setTimeout(() => target.select(), 20);
              }}
              placeholder="အမည် ရိုက်ထည့်ပါ"
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500 block">
              {isMyanmar ? 'ဖုန်းနံပါတ်' : 'Phone'}
            </label>
            <input
              type="tel"
              inputMode="tel"
              pattern="[0-9+]*"
              value={detectedCustomerPhone}
              onChange={(e) => setDetectedCustomerPhone(e.target.value)}
              onFocus={(e) => {
                const target = e.currentTarget;
                target.select();
                setTimeout(() => target.select(), 20);
              }}
              onClick={(e) => {
                const target = e.currentTarget;
                target.select();
                setTimeout(() => target.select(), 20);
              }}
              placeholder="09-xxxxxxx"
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-indigo-500 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Extracted Raw Text Display (The scanned text from Viber/Telegram photo) */}
      {rawOcrText && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
              <span>{isMyanmar ? '📝 ဓါတ်ပုံထဲမှ စကင်ဖတ်ရရှိသော စာသားများ' : 'Scanned Text from Photo'}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditingRawText(!isEditingRawText)}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer underline"
              >
                {isEditingRawText ? (isMyanmar ? 'ပြီးပါပြီ' : 'Done') : (isMyanmar ? '✏️ စာသားပြင်မည်' : 'Edit Text')}
              </button>
              <button
                type="button"
                onClick={handleReExtractFromRawText}
                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[11px] font-bold cursor-pointer flex items-center gap-1 transition-colors shadow-2xs"
                title="ပြင်ဆင်ထားသော စာသားမှ ဂဏန်းများကို ပြန်လည်ခွဲထုတ်ရန်"
              >
                <RefreshCw className="w-3 h-3" />
                <span>{isMyanmar ? 'စာရင်းပြန်ခွဲထုတ်မည်' : 'Re-extract'}</span>
              </button>
            </div>
          </div>

          {isEditingRawText ? (
            <textarea
              value={rawOcrText}
              onChange={(e) => setRawOcrText(e.target.value)}
              rows={4}
              placeholder="ဓါတ်ပုံထဲမှ စာသားများ..."
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-2.5 max-h-24 overflow-y-auto font-mono text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed shadow-inner">
              {rawOcrText}
            </div>
          )}
          <p className="text-[10px] text-slate-400">
            {isMyanmar ? '💡 စာသားထဲတွင် အချက်အလက်ပြင်လိုပါက "စာသားပြင်မည်" ဖြင့် ပြင်ဆင်ပြီး "စာရင်းပြန်ခွဲထုတ်မည်" ကို နှိပ်ပါ' : 'You can edit the text and click Re-extract to update bets'}
          </p>
        </div>
      )}

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

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="p-2 mx-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {warnings.map((w, idx) => (
                <div key={idx}>{w}</div>
              ))}
            </div>
          </div>
        )}

        {/* Rows List */}
        <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 p-2">
          {extractedRows.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs space-y-1">
              <p>{isMyanmar ? 'ဂဏန်းစာရင်းများ မတွေ့ရှိသေးပါ' : 'No numbers detected yet'}</p>
              <p className="text-[11px] text-slate-400">
                {isMyanmar
                  ? 'ဓါတ်ပုံတင်ပြီး "Scan Now" သို့မဟုတ် စာသားကူးထည့်ပြီး "စာရင်းခွဲထုတ်မည်" ကို နှိပ်ပါ'
                  : 'Upload a photo or paste text to extract bets'}
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
                      maxLength={mode === '2d' ? 2 : 3}
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
                        inputMode="numeric"
                        pattern="[0-9]*"
                        step="100"
                        min="100"
                        value={row.amount}
                        onChange={(e) => handleUpdateRow(row.id, 'amount', e.target.value)}
                        onFocus={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
                        onClick={(e) => {
                          const target = e.currentTarget;
                          target.select();
                          setTimeout(() => target.select(), 20);
                        }}
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
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={mode === '2d' ? 2 : 3}
            value={manualNumber}
            onChange={(e) => setManualNumber(e.target.value.replace(/[^0-9]/g, '').slice(0, mode === '2d' ? 2 : 3))}
            onFocus={(e) => {
              const target = e.currentTarget;
              target.select();
              setTimeout(() => target.select(), 20);
            }}
            onClick={(e) => {
              const target = e.currentTarget;
              target.select();
              setTimeout(() => target.select(), 20);
            }}
            placeholder={mode === '2d' ? '00' : '000'}
            className="w-16 px-2 py-1 text-center font-mono font-bold rounded border border-slate-200 bg-white"
          />
          <input
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            step="100"
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            onFocus={(e) => {
              const target = e.currentTarget;
              target.select();
              setTimeout(() => target.select(), 20);
            }}
            onClick={(e) => {
              const target = e.currentTarget;
              target.select();
              setTimeout(() => target.select(), 20);
            }}
            placeholder="1000"
            className="w-20 px-2 py-1 text-right font-mono font-bold rounded border border-slate-200 bg-white text-emerald-700"
          />
          <button
            type="button"
            onClick={handleAddManualRow}
            disabled={mode === '2d' ? manualNumber.length !== 2 : mode === '3d' ? manualNumber.length !== 3 : (manualNumber.length < 2 || manualNumber.length > 3)}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-lg cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

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
                  {isMyanmar ? 'Viber / Telegram စကရင်ရှော့ခ်နှင့် ဓါတ်ပုံ စကင်ဖတ်စနစ်' : 'Viber / Telegram & Photo Slip OCR Scanner'}
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-indigo-600" />
                  Gemini AI Vision + Offline OCR
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {isMyanmar
                  ? 'Viber/Telegram မက်ဆေ့ခ်ျ Screenshot ဓါတ်ပုံများ (သို့မဟုတ်) စလစ်ဓါတ်ပုံထဲမှ စာသားများကို scan ဖတ်ပြီး ဂဏန်းနှင့် ထိုးကြေးများကို အလိုအလျောက် စာရင်းသွင်းပေးပါသည်'
                  : 'Scan Viber/Telegram chat screenshots or photos to automatically extract numbers and amounts'}
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

        {/* Input Mode Selector: Photo / Screenshot vs Direct Viber / Telegram Text */}
        <div className="px-4 sm:px-6 pt-2 pb-0 flex items-center gap-2 border-b border-slate-200 bg-slate-50/75 shrink-0">
          <button
            type="button"
            onClick={() => setInputTab('photo')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
              inputTab === 'photo'
                ? 'bg-white text-indigo-600 border-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{isMyanmar ? '📷 Viber / Telegram ဓါတ်ပုံ (Photo OCR)' : 'Photo / Screenshot Scan'}</span>
          </button>

          <button
            type="button"
            onClick={() => setInputTab('text')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 cursor-pointer border-b-2 ${
              inputTab === 'text'
                ? 'bg-white text-indigo-600 border-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>{isMyanmar ? '💬 Viber / Telegram စာသား တိုက်ရိုက်ကူးထည့်မည်' : 'Paste Viber / Telegram Text'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {inputTab === 'text' ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>{isMyanmar ? 'Viber / Telegram / SMS မှ စာသားများ ကူးထည့်ပါ' : 'Paste Chat Text'}</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    {isMyanmar
                      ? 'Viber သို့မဟုတ် Telegram မက်ဆေ့ခ်ျထဲမှ စာသားကို Copy ယူပြီး ဤနေရာတွင် Paste ချလိုက်ပါ (AI စနစ်ဖြင့် ဂဏန်းနှင့် ထိုးကြေးများကို အလိုအလျောက် ခွဲထုတ်ပေးပါမည်)'
                      : 'Paste copied messages from Viber or Telegram to instantly extract numbers and amounts'}
                  </p>
                </div>
              </div>

              <textarea
                value={directPasteText}
                onChange={(e) => setDirectPasteText(e.target.value)}
                rows={6}
                placeholder={
                  mode === '2d'
                    ? `ဥပမာ-\nဦးကျော် 09-798889900\n24=1000\n42=500\n24R 500\nအပူး 1000\n5 ဘရိတ် 2000`
                    : `ဥပမာ-\nကိုအောင် 09-123456789\n123=1000\n456-500\n789 R 200\n999=2000`
                }
                className="w-full p-3 font-mono text-xs sm:text-sm rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-3 py-1.5 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-bold cursor-pointer transition-colors border border-indigo-200 shadow-2xs"
                  >
                    📋 {isMyanmar ? 'Clipboard မှ စာသား ကူးထည့်မည်' : 'Paste from Clipboard'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectPasteText('')}
                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-rose-600 font-semibold cursor-pointer"
                  >
                    {isMyanmar ? 'စာသား ရှင်းမည်' : 'Clear Text'}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleParseDirectText()}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs flex items-center gap-2 transition-transform active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isMyanmar ? 'စာရင်း ခွဲထုတ်ဖတ်ယူမည် (Extract Bets)' : 'Extract Bets'}</span>
                </button>
              </div>
            </div>
          ) : (
          /* Top Stage: Photo Upload / Live Camera Capture Controls */
          !imageSrc ? (
            isLiveCameraActive ? (
              /* Live Camera Stream Viewfinder */
              <div className="bg-slate-950 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center gap-4 relative overflow-hidden border border-slate-800 shadow-xl">
                <div className="relative w-full max-w-lg mx-auto overflow-hidden rounded-2xl bg-black border border-slate-800 flex items-center justify-center aspect-[4/3] sm:aspect-[16/9]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Corner Alignment Guides for Slip Framing */}
                  <div className="absolute inset-5 sm:inset-7 border-2 border-emerald-400/70 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                    <div className="flex justify-between">
                      <span className="w-5 h-5 border-t-3 border-l-3 border-emerald-400"></span>
                      <span className="w-5 h-5 border-t-3 border-r-3 border-emerald-400"></span>
                    </div>
                    <div className="text-center">
                      <span className="px-3 py-1 bg-black/75 text-emerald-300 text-xs font-black rounded-full backdrop-blur-xs border border-emerald-500/30">
                        {isMyanmar ? 'စလစ် သို့မဟုတ် စာရွက်ကို ဘောင်အတွင်း ချိန်ပါ' : 'Align slip inside frame'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="w-5 h-5 border-b-3 border-l-3 border-emerald-400"></span>
                      <span className="w-5 h-5 border-b-3 border-r-3 border-emerald-400"></span>
                    </div>
                  </div>
                </div>

                {/* Live Camera Controls */}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={stopLiveCamera}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    {isMyanmar ? 'ပိတ်မည်' : 'Close Camera'}
                  </button>

                  {/* Shutter / Capture Button */}
                  <button
                    type="button"
                    onClick={capturePhotoFromCamera}
                    className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg flex items-center gap-2 transition-transform active:scale-95 cursor-pointer ring-4 ring-emerald-500/20"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{isMyanmar ? 'ဓါတ်ပုံရိုက်ယူမည် (Capture)' : 'Capture Photo'}</span>
                  </button>

                  {/* Switch Camera Button (Front/Back) */}
                  <button
                    type="button"
                    onClick={switchCameraFacingMode}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors cursor-pointer"
                    title="ကင်မရာ ရှေ့/နောက် ပြောင်းမည်"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/70 hover:bg-indigo-50/20 rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shadow-xs">
                  <ImageIcon className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h4 className="text-base font-bold text-slate-900">
                    {isMyanmar ? 'Viber / Telegram စကရင်ရှော့ခ် သို့မဟုတ် စလစ်ဓါတ်ပုံ တင်သွင်းရန်' : 'Upload or Capture Viber/Telegram Slip Photo'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {isMyanmar
                      ? 'Viber, Telegram မက်ဆေ့ခ်ျ Screenshot ဓါတ်ပုံ သို့မဟုတ် ဖုန်းကင်မရာဖြင့် ရိုက်ထားသော ဓါတ်ပုံများကို တင်သွင်းပါက စာသားများကို scan ဖတ်ပြီး ဂဏန်းနှင့်ထိုးကြေးများကို အလိုအလျောက် စာရင်းသွင်းပေးပါမည်'
                      : 'Take a photo with camera, upload a Viber/Telegram screenshot, or paste from clipboard'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  {/* Live Camera Capture Trigger */}
                  <button
                    type="button"
                    onClick={() => startLiveCamera('environment')}
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

                  {/* Clipboard Paste Trigger */}
                  <button
                    type="button"
                    onClick={handlePasteFromClipboard}
                    className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs rounded-xl shadow-2xs flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <span>📋 {isMyanmar ? 'Clipboard မှ Paste ထည့်မည်' : 'Paste from Clipboard'}</span>
                  </button>
                </div>

                {cameraError && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 max-w-md text-left">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}

                <div className="pt-2 text-[11px] text-slate-500 flex items-center gap-1.5 font-mono">
                  <span>💡 အကြံပြုချက်: Viber သို့မဟုတ် Telegram မက်ဆေ့ခ်ျ Screenshot ကို တင်သွင်းလိုက်ရုံဖြင့် အလိုအလျောက် scan ဖတ်ပေးမည်ဖြစ်ပါသည်</span>
                </div>
              </div>
            )
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
                <div className="lg:col-span-7">
                  {renderExtractedRowsTable()}
                </div>
              </div>
            )
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
