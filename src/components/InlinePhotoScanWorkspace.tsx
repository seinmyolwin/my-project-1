import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Camera,
  Upload,
  RotateCw,
  Sliders,
  Sparkles,
  Trash2,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Crop,
  FileText,
  User,
  X,
  ArrowDownToLine,
  ClipboardPaste
} from 'lucide-react';
import { convertMyanmarToEnglishDigits, parseQuickBetText, formatAmount } from '../utils/lotteryUtils';
import { parseTwoDBatchInput } from '../utils/twoDLotteryUtils';
import { preprocessCanvas, performOfflineOCR, parseSlipImageText } from '../utils/imageOcrUtils';

export interface ScanCropBox {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  w: number; // normalized 0..1
  h: number; // normalized 0..1
}

interface InlinePhotoScanWorkspaceProps {
  isOpen: boolean;
  onClose: () => void;
  mode: '2d' | '3d';
  isMyanmar: boolean;
  currency: string;
  defaultAmount?: number;
  activeImageSrc: string | null;
  onImageChange: (src: string | null) => void;
  rawText: string;
  onRawTextChange: (text: string) => void;
  detectedCustomerName: string;
  onDetectedCustomerNameChange: (name: string) => void;
  onApplyParsedText: (text: string, fullImageSrc: string | null, detectedCustomerName?: string) => void;
  onApplyCustomerNameToVoucher?: (name: string) => void;
  scanTriggerNonce?: number;
}

const FULL_CROP_BOX: ScanCropBox = { x: 0.02, y: 0.02, w: 0.96, h: 0.96 };

type DragInteraction =
  | {
      type: 'move';
      startX: number;
      startY: number;
      startBox: ScanCropBox;
    }
  | {
      type: 'nw' | 'ne' | 'sw' | 'se';
      startX: number;
      startY: number;
      startBox: ScanCropBox;
    };

export const InlinePhotoScanWorkspace: React.FC<InlinePhotoScanWorkspaceProps> = ({
  isOpen,
  onClose,
  mode,
  isMyanmar,
  currency,
  defaultAmount = 0,
  activeImageSrc,
  onImageChange,
  rawText,
  onRawTextChange,
  detectedCustomerName,
  onDetectedCustomerNameChange,
  onApplyParsedText,
  onApplyCustomerNameToVoucher,
  scanTriggerNonce = 0
}) => {
  const [cropBox, setCropBox] = useState<ScanCropBox>(FULL_CROP_BOX);
  const [useCropBox, setUseCropBox] = useState<boolean>(true);
  const [contrastBoost, setContrastBoost] = useState<boolean>(false);
  const [isGrayscale, setIsGrayscale] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(0);
  const [scanStatusText, setScanStatusText] = useState<string>('');
  const [scanError, setScanError] = useState<string | null>(null);

  // Live Camera state
  const [isLiveCameraActive, setIsLiveCameraActive] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const imageStageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragRef = useRef<DragInteraction | null>(null);
  const lastAutoScannedRef = useRef<string | null>(null);

  const accent = mode === '2d' ? 'teal' : 'indigo';

  const stopLiveCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsLiveCameraActive(false);
    setCameraError(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopLiveCamera();
    }
    return () => {
      stopLiveCamera();
    };
  }, [isOpen, stopLiveCamera]);

  useEffect(() => {
    if (isLiveCameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isLiveCameraActive]);

  // Pointer drag / resize listeners for movable scan box
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      const stage = imageStageRef.current;
      if (!drag || !stage) return;

      const rect = stage.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;
      const b = drag.startBox;
      const minSize = 0.08;

      if (drag.type === 'move') {
        const nextX = Math.max(0, Math.min(1 - b.w, b.x + dx));
        const nextY = Math.max(0, Math.min(1 - b.h, b.y + dy));
        setCropBox({ ...b, x: nextX, y: nextY });
      } else {
        let left = b.x;
        let top = b.y;
        let right = b.x + b.w;
        let bottom = b.y + b.h;

        if (drag.type === 'nw' || drag.type === 'sw') {
          left = Math.max(0, Math.min(right - minSize, b.x + dx));
        }
        if (drag.type === 'ne' || drag.type === 'se') {
          right = Math.min(1, Math.max(left + minSize, b.x + b.w + dx));
        }
        if (drag.type === 'nw' || drag.type === 'ne') {
          top = Math.max(0, Math.min(bottom - minSize, b.y + dy));
        }
        if (drag.type === 'sw' || drag.type === 'se') {
          bottom = Math.min(1, Math.max(top + minSize, b.y + b.h + dy));
        }

        setCropBox({
          x: left,
          y: top,
          w: right - left,
          h: bottom - top
        });
      }
    };

    const handlePointerUp = () => {
      dragRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  const beginDrag = (e: React.PointerEvent, type: DragInteraction['type']) => {
    e.preventDefault();
    e.stopPropagation();
    setUseCropBox(true);
    dragRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      startBox: { ...cropBox }
    };
  };

  // Crop selected region (or full image) to a high-res JPEG canvas for OCR
  const buildCroppedCanvas = useCallback(
    async (src: string, crop: ScanCropBox | null): Promise<HTMLCanvasElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const nw = img.naturalWidth || 1200;
          const nh = img.naturalHeight || 1200;

          const sx = crop ? Math.max(0, Math.round(crop.x * nw)) : 0;
          const sy = crop ? Math.max(0, Math.round(crop.y * nh)) : 0;
          const sw = crop ? Math.max(20, Math.round(crop.w * nw)) : nw;
          const sh = crop ? Math.max(20, Math.round(crop.h * nh)) : nh;

          const clampedW = Math.max(1, Math.min(sw, nw - sx));
          const clampedH = Math.max(1, Math.min(sh, nh - sy));

          const maxDim = 1600;
          let targetW = clampedW;
          let targetH = clampedH;
          if (targetW > maxDim || targetH > maxDim) {
            if (targetW > targetH) {
              targetH = Math.max(1, Math.round((targetH * maxDim) / targetW));
              targetW = maxDim;
            } else {
              targetW = Math.max(1, Math.round((targetW * maxDim) / targetH));
              targetH = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context unavailable'));
            return;
          }
          ctx.drawImage(img, sx, sy, clampedW, clampedH, 0, 0, targetW, targetH);

          if (contrastBoost || isGrayscale) {
            const processed = preprocessCanvas(canvas, {
              contrast: contrastBoost ? 45 : 0,
              brightness: contrastBoost ? 8 : 0,
              threshold: false,
              grayscale: isGrayscale
            });
            resolve(processed);
          } else {
            resolve(canvas);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image for scanning'));
        img.src = src;
      });
    },
    [contrastBoost, isGrayscale]
  );

  const runOcrScan = useCallback(
    async (options: { src?: string; fullImage?: boolean; append?: boolean } = {}) => {
      const targetSrc = options.src || activeImageSrc;
      if (!targetSrc) return;

      setIsScanning(true);
      setScanError(null);
      setScanProgress(15);
      setScanStatusText(
        isMyanmar
          ? 'လက်ရေးနှင့် ဂဏန်း/ထိုးကြေးများကို ဖတ်ယူနေပါသည်...'
          : 'Reading handwriting, digits & stakes...'
      );

      try {
        const effectiveCrop = options.fullImage || !useCropBox ? null : cropBox;
        const canvas = await buildCroppedCanvas(targetSrc, effectiveCrop);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

        setScanProgress(45);
        setScanStatusText(
          isMyanmar
            ? 'စာသားကူးပုံစံ ထုတ်ပေးနေပါသည်...'
            : 'Extracting clean copied text...'
        );

        const sessionToken = sessionStorage.getItem('rhmg_server_session_token');
        const res = await fetch('/api/ocr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {})
          },
          body: JSON.stringify({
            image: dataUrl,
            mimeType: 'image/jpeg',
            mode
          })
        });

        if (!res.ok) {
          const rawErrText = await res.text().catch(() => '');
          let parsedErrMsg = '';
          try {
            const errPayload = JSON.parse(rawErrText);
            parsedErrMsg = errPayload?.error || '';
          } catch {
            if (rawErrText && !rawErrText.trim().startsWith('<')) {
              parsedErrMsg = rawErrText.trim().slice(0, 200);
            }
          }
          throw new Error(parsedErrMsg || `OCR service returned ${res.status}`);
        }

        const data = await res.json();
        if (data?.error) {
          throw new Error(String(data.error));
        }
        setScanProgress(90);

        let formattedRaw = convertMyanmarToEnglishDigits(String(data.rawText || '')).trim();
        if (!formattedRaw && Array.isArray(data.items) && data.items.length > 0) {
          formattedRaw = data.items
            .map((it: any) => it.originalRaw || `${it.number}=${it.amount}${it.isRumble ? 'R' : ''}`)
            .join('\n');
        }

        if (formattedRaw) {
          if (options.append && rawText.trim()) {
            onRawTextChange(`${rawText.trim()}\n${formattedRaw}`);
          } else {
            onRawTextChange(formattedRaw);
          }
        } else {
          setScanError(
            isMyanmar
              ? 'ရွေးထားသော နေရာတွင် ဂဏန်းနှင့် ထိုးကြေး ရှာမတွေ့ပါ — ဘောင်ကို ရွှေ့၍ ထပ်စမ်းကြည့်ပါ'
              : 'No betting numbers/amounts detected in selected area'
          );
        }

        if (
          data.customerName &&
          typeof data.customerName === 'string' &&
          data.customerName.trim() &&
          !data.customerName.includes('အထွေထွေ')
        ) {
          onDetectedCustomerNameChange(data.customerName.trim());
        }

        setScanProgress(100);
        setIsScanning(false);
      } catch (err: any) {
        console.warn('Server OCR error:', err);
        // Only fall back to offline Tesseract when browser is offline / network unreachable
        if (!navigator.onLine || err?.message?.includes('Failed to fetch')) {
          try {
            setScanStatusText(isMyanmar ? 'အော့ဖ်လိုင်း OCR ဖြင့် ဖတ်ယူနေပါသည်...' : 'Running offline OCR...');
            const effectiveCrop = options.fullImage || !useCropBox ? null : cropBox;
            const rawCanvas = await buildCroppedCanvas(targetSrc, effectiveCrop);
            const tesseractCanvas = preprocessCanvas(rawCanvas, {
              contrast: 40,
              brightness: 10,
              threshold: true,
              grayscale: true
            });
            const ocrText = await performOfflineOCR(tesseractCanvas, (pct, msg) => {
              setScanProgress(30 + Math.round(pct * 0.7));
              setScanStatusText(msg);
            });
            const parsed = parseSlipImageText(ocrText, mode);
            const cleanLines = parsed.extractedItems.length > 0
              ? parsed.extractedItems.map((it) => it.originalRaw || `${it.number}=${it.amount}`).join('\n')
              : convertMyanmarToEnglishDigits(ocrText).trim();
            if (cleanLines) {
              onRawTextChange(options.append && rawText.trim() ? `${rawText.trim()}\n${cleanLines}` : cleanLines);
            }
            setIsScanning(false);
            return;
          } catch (offlineErr: any) {
            setScanError(offlineErr?.message || err?.message || 'OCR failed');
          }
        } else {
          setScanError(err?.message || (isMyanmar ? 'စကင်ဖတ်ရာတွင် အမှားဖြစ်နေပါသည်' : 'OCR scan failed'));
        }
        setIsScanning(false);
      }
    },
    [
      activeImageSrc,
      buildCroppedCanvas,
      cropBox,
      isMyanmar,
      mode,
      onDetectedCustomerNameChange,
      onRawTextChange,
      rawText,
      useCropBox
    ]
  );

  // Auto-scan automatically when a brand-new photo arrives (e.g. via upload, camera, or parent Ctrl+V)
  useEffect(() => {
    if (!isOpen || !activeImageSrc) {
      if (!activeImageSrc) lastAutoScannedRef.current = null;
      return;
    }
    const signature = `${activeImageSrc.slice(0, 120)}:${activeImageSrc.length}:${scanTriggerNonce}`;
    if (lastAutoScannedRef.current !== signature) {
      lastAutoScannedRef.current = signature;
      setCropBox(FULL_CROP_BOX);
      setUseCropBox(true);
      setIsCollapsed(false);
      runOcrScan({ src: activeImageSrc, fullImage: true, append: false });
    }
  }, [isOpen, activeImageSrc, scanTriggerNonce, runOcrScan]);

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        stopLiveCamera();
        onImageChange(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRotate90 = () => {
    if (!activeImageSrc) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight || 800;
      canvas.height = img.naturalWidth || 800;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const rotated = canvas.toDataURL('image/jpeg', 0.92);
      setCropBox(FULL_CROP_BOX);
      lastAutoScannedRef.current = `${rotated.slice(0, 120)}:${rotated.length}:${scanTriggerNonce}`;
      onImageChange(rotated);
    };
    img.src = activeImageSrc;
  };

  const startLiveCamera = async (facing: 'environment' | 'user' = 'environment') => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      cameraInputRef.current?.click();
      return;
    }
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      streamRef.current = stream;
      setCameraFacingMode(facing);
      setIsLiveCameraActive(true);
    } catch {
      setCameraError(isMyanmar ? 'ကင်မရာ ဖွင့်မရပါ — ဖိုင်ရွေးချယ်မှုကို သုံးပါ' : 'Camera unavailable');
      cameraInputRef.current?.click();
    }
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    stopLiveCamera();
    onImageChange(dataUrl);
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imgType = item.types.find((t) => t.startsWith('image/'));
          if (imgType) {
            const blob = await item.getType(imgType);
            const reader = new FileReader();
            reader.onload = (ev) => {
              if (ev.target?.result) {
                stopLiveCamera();
                onImageChange(ev.target.result as string);
              }
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
      if (navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          onRawTextChange(convertMyanmarToEnglishDigits(clipText.trim()));
        }
      }
    } catch {
      setScanError(isMyanmar ? 'Clipboard မှ ဖတ်မရပါ (Ctrl+V နှိပ်၍ ကူးထည့်နိုင်ပါသည်)' : 'Use Ctrl+V to paste image');
    }
  };

  // Live preview of what the standard batch parser extracts from the user's edited rawText
  const liveParsePreview = useMemo(() => {
    const clean = rawText.trim();
    if (!clean) {
      return { count: 0, total: 0, warnings: [] as string[] };
    }
    if (mode === '2d') {
      const res = parseTwoDBatchInput(clean, defaultAmount);
      const list = Array.isArray(res) ? res : (res as any).items || [];
      const warnings = (res as any).warnings || [];
      const total = list.reduce((s: number, it: any) => s + (it.amount || 0), 0);
      return { count: list.length, total, warnings };
    }
    const { items, errors } = parseQuickBetText(clean);
    const total = items.reduce((s, it) => s + (it.amount || 0), 0);
    return { count: items.length, total, warnings: errors };
  }, [rawText, mode, defaultAmount]);

  if (!isOpen) return null;

  const accentBorder = accent === 'teal' ? 'border-teal-300' : 'border-indigo-300';
  const accentHeaderBg =
    accent === 'teal'
      ? 'bg-gradient-to-r from-teal-900 via-slate-900 to-teal-900 border-b border-teal-700/50'
      : 'bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-b border-indigo-700/50';
  const accentBtn =
    accent === 'teal'
      ? 'bg-teal-600 hover:bg-teal-700 text-white'
      : 'bg-indigo-600 hover:bg-indigo-700 text-white';

  return (
    <div className={`bg-white border-2 ${accentBorder} rounded-2xl shadow-md overflow-hidden animate-in fade-in duration-200`}>
      {/* Compact Workspace Header */}
      <div className={`${accentHeaderBg} text-white px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2`}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
            <Camera className="w-4 h-4 text-emerald-300" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black tracking-tight flex items-center gap-2">
              <span>{isMyanmar ? 'ဓာတ်ပုံ စကင်ဖတ် & စာသားပြင်ဆင်မှု' : 'Photo Scan & Raw Text Workspace'}</span>
              {activeImageSrc && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 text-[10px] font-bold">
                  {isMyanmar ? 'မူရင်းဓာတ်ပုံ ပြသနေသည်' : 'Photo Active'}
                </span>
              )}
            </h3>
            <p className="text-[10px] text-slate-300">
              {isMyanmar
                ? 'ဓာတ်ပုံပေါ်မှ ဘောင်ကို ရွှေ့၍ စကင်ဖတ်ပါ -> စာသားပြင်ပြီး ဘောင်ချာထည့်ပါ (ဘောင်ချာအတည်ပြုမှ Archive ထဲသိမ်းမည်)'
                : 'Move scan frame, edit extracted text, add to voucher (archived on confirmation)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {activeImageSrc && (
            <button
              type="button"
              onClick={() => setIsCollapsed((c) => !c)}
              className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              {isCollapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
              <span>{isCollapsed ? 'ပုံပြန်ချဲ့မည်' : 'ချုံ့ထားမည်'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/15 cursor-pointer"
            title="ပိတ်မည်"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Collapsed Mini Reference Strip */}
      {isCollapsed && activeImageSrc ? (
        <div className="p-2.5 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={activeImageSrc}
              alt="Slip Thumbnail"
              onClick={() => setIsCollapsed(false)}
              className="w-12 h-12 rounded-lg object-cover border border-slate-300 cursor-pointer"
            />
            <div className="text-xs min-w-0">
              <div className="font-bold text-slate-900">မူရင်းဓာတ်ပုံ ချိတ်ဆက်ထားသည်</div>
              <div className="text-[11px] text-slate-500 truncate">
                {rawText ? `${rawText.split('\n').filter(Boolean).length} လိုင်း (ဘောင်ချာအတည်ပြုပါက Archive ထဲသိမ်းမည်)` : 'စာရင်းသွင်းပြီး ဘောင်ချာထုတ်ယူပါ'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${accentBtn}`}
          >
            ပုံနှင့်စာသား ပြန်ကြည့်မည်
          </button>
        </div>
      ) : (
        <div className="p-3 sm:p-4 bg-slate-50/70">
          {!activeImageSrc && !isLiveCameraActive ? (
            /* Upload / Camera / Paste Drop Strip */
            <div className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-white rounded-xl p-5 text-center space-y-3">
              <div className="text-xs sm:text-sm font-bold text-slate-800">
                {isMyanmar
                  ? 'စလစ်ဓာတ်ပုံ (သို့မဟုတ်) လက်ရေးစာရွက် / Viber, Telegram ပုံ ထည့်သွင်းပါ'
                  : 'Upload, Capture, or Paste Photo Slip (Ctrl+V)'}
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer ${accentBtn}`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>ပုံရွေးချယ်မည်</span>
                </button>
                <button
                  type="button"
                  onClick={() => startLiveCamera('environment')}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>ကင်မရာဖြင့် ရိုက်မည်</span>
                </button>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Paste ထည့်မည် (Ctrl+V)</span>
                </button>
              </div>
              {cameraError && (
                <p className="text-xs text-rose-600 font-semibold">{cameraError}</p>
              )}
            </div>
          ) : isLiveCameraActive ? (
            /* Live Camera Inline Capture */
            <div className="bg-slate-950 rounded-xl p-3 space-y-3">
              <div className="relative max-w-lg mx-auto aspect-[4/3] bg-black rounded-xl overflow-hidden border border-slate-800">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={stopLiveCamera}
                  className="px-3 py-1.5 bg-slate-800 text-slate-200 rounded-lg text-xs font-bold cursor-pointer"
                >
                  ပိတ်မည်
                </button>
                <button
                  type="button"
                  onClick={captureFromCamera}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>ဓာတ်ပုံရိုက်ယူမည်</span>
                </button>
                <button
                  type="button"
                  onClick={() => startLiveCamera(cameraFacingMode === 'environment' ? 'user' : 'environment')}
                  className="p-2 bg-slate-800 text-slate-200 rounded-lg cursor-pointer"
                  title="ကင်မရာ ရှေ့/နောက် ပြောင်းမည်"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Active Photo (with Movable/Resizable Crop Box) + Side-by-Side Editable Raw Text */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              {/* LEFT: Original Photo & Interactive Scan Selection Box */}
              <div className="lg:col-span-6 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                  <span className="font-bold text-slate-800 flex items-center gap-1">
                    <Crop className="w-3.5 h-3.5 text-emerald-600" />
                    <span>
                      {useCropBox
                        ? 'ဘောင်ကို ဆွဲရွှေ့/ချုံ့ချဲ့ပြီး လိုချင်သည့်နေရာ ဖတ်နိုင်ပါသည်'
                        : 'တစ်ပုံလုံး စကင်ဖတ်မည့် ပုံစံ'}
                    </span>
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setCropBox(FULL_CROP_BOX);
                        setUseCropBox((v) => !v);
                      }}
                      className={`px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer ${
                        useCropBox
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {useCropBox ? 'ဘောင်ရွှေ့စနစ်: ဖွင့်' : 'တစ်ပုံလုံး'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCropBox(FULL_CROP_BOX);
                        setUseCropBox(true);
                      }}
                      className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 cursor-pointer"
                      title="ဘောင်ပြန်ညှိမည်"
                    >
                      Reset ဘောင်
                    </button>
                  </div>
                </div>

                {/* Photo Stage */}
                <div className="bg-slate-900 rounded-xl p-2 flex items-center justify-center relative min-h-[240px] max-h-[460px] overflow-hidden shadow-inner">
                  <div
                    ref={imageStageRef}
                    className="relative inline-block select-none touch-none max-w-full"
                  >
                    <img
                      src={activeImageSrc!}
                      alt="Original Slip"
                      draggable={false}
                      style={{
                        filter: `${isGrayscale ? 'grayscale(100%)' : ''} ${contrastBoost ? 'contrast(135%) brightness(105%)' : ''}`.trim()
                      }}
                      className="max-h-[420px] w-auto max-w-full object-contain rounded block pointer-events-none"
                    />

                    {/* Movable & Resizable Scan Frame */}
                    {useCropBox && (
                      <>
                        {/* Dimmed outer curtains */}
                        <div
                          className="absolute left-0 right-0 top-0 bg-slate-950/55 pointer-events-none"
                          style={{ height: `${cropBox.y * 100}%` }}
                        />
                        <div
                          className="absolute left-0 right-0 bottom-0 bg-slate-950/55 pointer-events-none"
                          style={{ height: `${Math.max(0, (1 - (cropBox.y + cropBox.h)) * 100)}%` }}
                        />
                        <div
                          className="absolute left-0 bg-slate-950/55 pointer-events-none"
                          style={{
                            top: `${cropBox.y * 100}%`,
                            height: `${cropBox.h * 100}%`,
                            width: `${cropBox.x * 100}%`
                          }}
                        />
                        <div
                          className="absolute right-0 bg-slate-950/55 pointer-events-none"
                          style={{
                            top: `${cropBox.y * 100}%`,
                            height: `${cropBox.h * 100}%`,
                            width: `${Math.max(0, (1 - (cropBox.x + cropBox.w)) * 100)}%`
                          }}
                        />

                        {/* Draggable Crop Box */}
                        <div
                          onPointerDown={(e) => beginDrag(e, 'move')}
                          style={{
                            left: `${cropBox.x * 100}%`,
                            top: `${cropBox.y * 100}%`,
                            width: `${cropBox.w * 100}%`,
                            height: `${cropBox.h * 100}%`
                          }}
                          className="absolute border-2 border-emerald-400 cursor-move shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
                        >
                          <div className="absolute top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-emerald-600/90 text-white text-[9px] font-bold rounded pointer-events-none whitespace-nowrap shadow">
                            ဖတ်မည့်နေရာ (ဆွဲရွှေ့ပါ)
                          </div>

                          {/* 4 Corner Resize Handles */}
                          <div
                            onPointerDown={(e) => beginDrag(e, 'nw')}
                            className="absolute -top-2 -left-2 w-4 h-4 bg-emerald-400 border-2 border-white rounded-sm cursor-nwse-resize shadow"
                          />
                          <div
                            onPointerDown={(e) => beginDrag(e, 'ne')}
                            className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-400 border-2 border-white rounded-sm cursor-nesw-resize shadow"
                          />
                          <div
                            onPointerDown={(e) => beginDrag(e, 'sw')}
                            className="absolute -bottom-2 -left-2 w-4 h-4 bg-emerald-400 border-2 border-white rounded-sm cursor-nesw-resize shadow"
                          />
                          <div
                            onPointerDown={(e) => beginDrag(e, 'se')}
                            className="absolute -bottom-2 -right-2 w-4 h-4 bg-emerald-400 border-2 border-white rounded-sm cursor-nwse-resize shadow"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Scanning Overlay */}
                  {isScanning && (
                    <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-white text-center space-y-2 z-10">
                      <div className="w-8 h-8 border-4 border-emerald-400 border-t-white rounded-full animate-spin" />
                      <span className="text-xs font-bold">{scanStatusText || 'ဖတ်ယူနေပါသည်...'}</span>
                      <div className="w-40 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-emerald-400 h-full transition-all duration-300" style={{ width: `${scanProgress}%` }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Image Controls & Scan Trigger Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={handleRotate90}
                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                      title="၉၀ ဒီဂရီ လှည့်မည်"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>လှည့်</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setContrastBoost((b) => !b)}
                      className={`px-2 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                        contrastBoost
                          ? 'bg-amber-100 border-amber-300 text-amber-900'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <Sliders className="w-3 h-3" />
                      <span>စာကြည်</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsGrayscale((g) => !g)}
                      className={`px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                        isGrayscale
                          ? 'bg-slate-800 border-slate-800 text-white'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      B&amp;W
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 cursor-pointer"
                    >
                      ပုံလဲ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onImageChange(null);
                        setScanError(null);
                      }}
                      className="p-1 bg-white hover:bg-rose-50 border border-slate-200 rounded-lg text-rose-600 cursor-pointer"
                      title="ဓာတ်ပုံ ဖယ်ရှားမည်"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {rawText.trim() && (
                      <button
                        type="button"
                        disabled={isScanning}
                        onClick={() => runOcrScan({ append: true })}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer"
                        title="ရွေးထားသည့် ဘောင်ထဲမှ ဂဏန်းများကို လက်ရှိစာသားအောက်တွင် ထပ်ပေါင်းထည့်မည်"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>ဖတ်ပြီး ထပ်ပေါင်း</span>
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isScanning}
                      onClick={() => runOcrScan({ append: false })}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer disabled:opacity-50 ${accentBtn}`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>{useCropBox ? 'ရွေးထားသည့်နေရာ ဖတ်မည်' : 'တစ်ပုံလုံး ဖတ်မည်'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* RIGHT: Editable Copied-Text Editor + Live Parser Preview + Apply to Slip */}
              <div className="lg:col-span-6 space-y-2.5 flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-600" />
                    <span>စာသားကူးလာတဲ့ပုံစံ (မှားနေလျှင် ဤနေရာတွင် ပြင်ဆင်ပါ)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => onRawTextChange('')}
                    className="text-[11px] font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
                  >
                    စာသားရှင်းမည်
                  </button>
                </div>

                {/* Detected Customer row */}
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-600 shrink-0">ထိုးသား:</span>
                  <input
                    type="text"
                    value={detectedCustomerName}
                    onChange={(e) => onDetectedCustomerNameChange(e.target.value)}
                    placeholder="အမည် (တွေ့ရှိလျှင် အလိုအလျောက်ဖြည့်ပေးမည်)"
                    className="flex-1 text-xs font-bold text-slate-900 bg-transparent outline-none"
                  />
                  {detectedCustomerName.trim() && onApplyCustomerNameToVoucher && (
                    <button
                      type="button"
                      onClick={() => onApplyCustomerNameToVoucher(detectedCustomerName.trim())}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md text-[10px] font-bold cursor-pointer shrink-0"
                    >
                      အမည်ထည့်
                    </button>
                  )}
                </div>

                {scanError && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl px-3 py-2 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{scanError}</span>
                  </div>
                )}

                {/* Editable Raw Textarea */}
                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => onRawTextChange(convertMyanmarToEnglishDigits(e.target.value))}
                  placeholder={
                    mode === '2d'
                      ? `ဥပမာ-\n52=57=58=50=59=500\n52=7000r3000\n42 R 500\n44 2000\n4ပါ 200`
                      : `ဥပမာ-\n123=1000\n456 R 500\n789=1000/200`
                  }
                  className="w-full bg-white border-2 border-slate-300 focus:border-indigo-500 rounded-xl p-3 font-mono text-xs sm:text-sm text-slate-900 leading-relaxed shadow-2xs outline-none"
                />

                {/* Live Parse Preview Summary */}
                <div className="bg-white border border-slate-200 rounded-xl p-2.5 space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <CheckCircle2 className={`w-3.5 h-3.5 ${liveParsePreview.count > 0 ? 'text-emerald-600' : 'text-slate-300'}`} />
                      <span>ဖတ်ယူရရှိမည့် အကွက်:</span>
                      <span className="font-mono font-black text-slate-900">{liveParsePreview.count} ကွက်</span>
                    </span>
                    <span className="font-mono font-black text-emerald-700">
                      {formatAmount(liveParsePreview.total, currency)}
                    </span>
                  </div>

                  {liveParsePreview.warnings.length > 0 && (
                    <div className="bg-amber-50 border border-amber-300 rounded-lg p-2 text-[11px] font-bold text-amber-900 space-y-1 max-h-28 overflow-y-auto">
                      {liveParsePreview.warnings.map((w: string, i: number) => (
                        <div key={i} className="flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Parsed Bets to Active Voucher Button */}
                <button
                  type="button"
                  disabled={!rawText.trim() || liveParsePreview.count === 0}
                  onClick={() => onApplyParsedText(rawText, activeImageSrc, detectedCustomerName.trim() || undefined)}
                  className={`w-full py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed active:scale-[0.99] ${accentBtn}`}
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>ဂဏန်းနဲ့ထိုးကြေးယူနည်းအတိုင်း ဘောင်ချာထဲထည့်မည် ({liveParsePreview.count} ကွက်)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden inputs for file/camera selection */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFilePicked}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFilePicked}
        className="hidden"
      />
    </div>
  );
};
