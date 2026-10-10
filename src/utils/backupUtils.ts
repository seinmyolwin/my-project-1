import { STORAGE_KEYS } from './storage';
import { SECURITY_STORAGE_KEYS, obscurePin, verifyObscuredPin } from './securityUtils';

export const TELEGRAM_STORAGE_KEYS = {
  CONFIG: 'shwe_mingalar_telegram_config',
  ORDERS: 'shwe_mingalar_telegram_orders'
};

const CIPHER_HEADER = '-----BEGIN SHWE MINGALAR SECURE ENCRYPTED LEDGER ARCHIVE v3-----';
const CIPHER_FOOTER = '-----END SHWE MINGALAR SECURE ENCRYPTED LEDGER ARCHIVE-----';
const SECRET_SEED = 'SHWE_MINGALAR_PRO_BOOKIE_SECURE_KEY_2026_!@#$%^&*()';

/**
 * Custom fast & resilient string encryption/obfuscation cipher
 * Converts UTF-8 string to encrypted cipher payload with dynamic rotating XOR and salted substitution
 */
function encryptPayload(plaintext: string, pin: string = ''): string {
  const salt = Math.random().toString(36).substring(2, 10);
  const key = `${SECRET_SEED}_${pin}_${salt}`;
  let result = '';

  // 1. Convert to UTF-8 URI encoding to safely handle Myanmar fonts & special chars
  const encoded = encodeURIComponent(plaintext);

  // 2. Multi-round rotating XOR cipher
  for (let i = 0; i < encoded.length; i++) {
    const charCode = encoded.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    const pinMod = pin.length > 0 ? pin.charCodeAt(i % pin.length) : 88;
    const cipherByte = charCode ^ keyChar ^ pinMod ^ ((i * 7) & 0xff);
    result += String.fromCharCode(cipherByte);
  }

  // 3. Base64 package with salt prefix
  try {
    const rawB64 = btoa(unescape(encodeURIComponent(result)));
    return `${salt}::${rawB64}`;
  } catch {
    // Fallback binary hex
    let hex = '';
    for (let i = 0; i < result.length; i++) {
      hex += result.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return `${salt}::HEX::${hex}`;
  }
}

/**
 * Decrypts encrypted payload using dynamic rotating cipher and salt
 */
function decryptPayload(ciphertext: string, pin: string = ''): string {
  const parts = ciphertext.split('::');
  if (parts.length < 2) {
    throw new Error('Invalid cipher format');
  }

  const salt = parts[0];
  const key = `${SECRET_SEED}_${pin}_${salt}`;
  let rawStr = '';

  if (parts[1] === 'HEX') {
    const hex = parts[2] || '';
    for (let i = 0; i < hex.length; i += 2) {
      rawStr += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
  } else {
    try {
      rawStr = decodeURIComponent(escape(atob(parts[1])));
    } catch {
      rawStr = atob(parts[1]);
    }
  }

  let decodedUri = '';
  for (let i = 0; i < rawStr.length; i++) {
    const charCode = rawStr.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    const pinMod = pin.length > 0 ? pin.charCodeAt(i % pin.length) : 88;
    const plainByte = charCode ^ keyChar ^ pinMod ^ ((i * 7) & 0xff);
    decodedUri += String.fromCharCode(plainByte);
  }

  return decodeURIComponent(decodedUri);
}

/**
 * Simple checksum hash for data integrity check
 */
function generateChecksum(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Generates exact format: app_name_date_time.ext (e.g. ရွှေမင်္ဂလာ_2026-10-04_06-00-15.rhmg)
 */
export function getBackupFileName(appName: string = 'ရွှေမင်္ဂလာ', ext: string = 'rhmg'): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timeStr = `${hours}-${minutes}-${seconds}`;

  const cleanAppName = (appName || 'ရွှေမင်္ဂလာ').trim().replace(/[/\\?%*:|"<>]/g, '-');
  return `${cleanAppName}_${dateStr}_${timeStr}.${ext}`;
}

/**
 * Triggers a browser file download for text/encrypted file
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Allows user to pick a custom location on mobile/tablet/desktop (Documents, SD card, custom folder)
 */
export async function saveFileWithCustomLocation(
  content: string,
  filename: string,
  mimeType: string = 'text/plain;charset=utf-8'
): Promise<{ success: boolean; method: 'picker' | 'share' | 'download'; message: string }> {
  const blob = new Blob([content], { type: mimeType });

  // 1. Try Native File System Access API (Native save directory picker)
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'ရွှေမင်္ဂလာ ဒေတာဖိုင် (.rhmg)',
            accept: { [mimeType]: ['.rhmg', '.txt', '.json', '.dat'] }
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return {
        success: true,
        method: 'picker',
        message: `ဖိုင်အား သင်ရွေးချယ်သော နေရာတွင် "${filename}" အမည်ဖြင့် အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ`
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return {
          success: false,
          method: 'picker',
          message: 'ဖိုင်သိမ်းဆည်းမှုကို ပယ်ဖျက်လိုက်ပါသည်'
        };
      }
    }
  }

  // 2. Direct browser download
  downloadFile(content, filename, mimeType);
  return {
    success: true,
    method: 'download',
    message: `"${filename}" အမည်ဖြင့် ဖုန်းထဲသို့ ဒေါင်းလုဒ်သိမ်းဆည်းပြီးပါပြီ`
  };
}

/**
 * Share file to Phone File Manager, Drive, or other apps
 */
export async function shareFileDirectly(
  content: string,
  filename: string,
  mimeType: string = 'text/plain'
): Promise<{ success: boolean; message: string }> {
  try {
    const blob = new Blob([content], { type: mimeType });
    let file: File | null = null;
    try {
      file = new File([blob], filename, { type: mimeType });
    } catch {
      file = null;
    }

    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: filename,
          text: `ရွှေမင်္ဂလာ ဒေတာဖိုင်: ${filename}`
        });
        return { success: true, message: 'ဖိုင်အား အောင်မြင်စွာ ပို့ဆောင်/သိမ်းဆည်းပြီးပါပြီ' };
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          downloadFile(content, filename, mimeType);
          return { success: true, message: `"${filename}" အား ဒေါင်းလုဒ်သိမ်းဆည်းပြီးပါပြီ` };
        }
        return { success: false, message: 'ဖိုင်မျှဝေမှုကို ပယ်ဖျက်လိုက်ပါသည်' };
      }
    } else {
      downloadFile(content, filename, mimeType);
      return { success: true, message: `"${filename}" အား ဒေါင်းလုဒ်သိမ်းဆည်းပြီးပါပြီ` };
    }
  } catch {
    downloadFile(content, filename, mimeType);
    return { success: true, message: `"${filename}" အား ဒေါင်းလုဒ်သိမ်းဆည်းပြီးပါပြီ` };
  }
}

/**
 * Legacy download helper for JSON
 */
export function downloadJSONFile(content: string, filename: string) {
  downloadFile(content, filename, 'application/json;charset=utf-8');
}

/**
 * Exports 100% of ALL system data in a secure, unreadable, encrypted format (.rhmg)
 */
export function exportSecureMasterBackup(ownerPin: string = ''): string {
  const fullData = {
    app: 'ရွှေမင်္ဂလာ စာရင်းစီမံခန့်ခွဲမှုစနစ် (Master Suite)',
    version: '3.0',
    exportTimestamp: new Date().toISOString(),
    format: 'SHWE_MINGALAR_ENCRYPTED_ARCHIVE',
    payload: {
      // 3D Lottery Data
      '3d': {
        rounds: localStorage.getItem(STORAGE_KEYS.ROUNDS),
        vouchers: localStorage.getItem(STORAGE_KEYS.VOUCHERS),
        limits: localStorage.getItem(STORAGE_KEYS.LIMITS),
        blocked: localStorage.getItem(STORAGE_KEYS.BLOCKED),
        forwardSlips: localStorage.getItem(STORAGE_KEYS.FORWARD_SLIPS),
        settings: localStorage.getItem(STORAGE_KEYS.SETTINGS),
        activeRoundId: localStorage.getItem(STORAGE_KEYS.ACTIVE_ROUND_ID)
      },
      // 2D Lottery Data
      '2d': {
        rounds: localStorage.getItem(STORAGE_KEYS.ROUNDS_2D),
        vouchers: localStorage.getItem(STORAGE_KEYS.VOUCHERS_2D),
        limits: localStorage.getItem(STORAGE_KEYS.LIMITS_2D),
        blocked: localStorage.getItem(STORAGE_KEYS.BLOCKED_2D),
        forwardSlips: localStorage.getItem(STORAGE_KEYS.FORWARD_SLIPS_2D),
        settings: localStorage.getItem(STORAGE_KEYS.SETTINGS_2D),
        activeRoundId: localStorage.getItem(STORAGE_KEYS.ACTIVE_ROUND_ID_2D)
      },
      // Football Data
      'football': {
        matches: localStorage.getItem(STORAGE_KEYS.MATCHES_FOOTBALL),
        slips: localStorage.getItem(STORAGE_KEYS.SLIPS_FOOTBALL),
        forwardSlips: localStorage.getItem(STORAGE_KEYS.FORWARD_SLIPS_FOOTBALL),
        settings: localStorage.getItem(STORAGE_KEYS.SETTINGS_FOOTBALL),
        activeDate: localStorage.getItem(STORAGE_KEYS.ACTIVE_DATE_FOOTBALL),
        leagues: localStorage.getItem(STORAGE_KEYS.LEAGUES_FOOTBALL)
      },
      // Security & System Modes
      'security': {
        ownerPin: obscurePin(localStorage.getItem(SECURITY_STORAGE_KEYS.OWNER_PIN)),
        enabledModes: localStorage.getItem(SECURITY_STORAGE_KEYS.ENABLED_MODES),
        setupCompleted: localStorage.getItem(SECURITY_STORAGE_KEYS.SETUP_COMPLETED),
        activeDealerMode: localStorage.getItem(STORAGE_KEYS.DEALER_MODE)
      },

      // Telegram Integration Orders & Config
      'telegram': {
        config: localStorage.getItem(TELEGRAM_STORAGE_KEYS.CONFIG),
        orders: localStorage.getItem(TELEGRAM_STORAGE_KEYS.ORDERS)
      }
    }
  };

  const rawJson = JSON.stringify(fullData);
  const checksum = generateChecksum(rawJson);
  const encryptedPayload = encryptPayload(rawJson, ownerPin);

  // Armored unreadable encrypted file wrapper
  const armoredFile = [
    CIPHER_HEADER,
    `Format: SMG-ENCRYPTED-ARCHIVE-V3`,
    `Date: ${new Date().toISOString()}`,
    `App: Shwe-Mingalar-Management-System`,
    `Notice: ဤဖိုင်သည် ရွှေမင်္ဂလာ စာရင်းစနစ်အတွက် သီးသန့် အသွင်ပြောင်း လျှို့ဝှက်ကုဒ်ဖြင့် သိမ်းဆည်းထားသော ဖိုင်ဖြစ်ပါသည်။ ပြင်ပဆော့ဖ်ဝဲလ်များဖြင့် ဖတ်ရှု၍ မရနိုင်ပါ။ ဤအက်ပ်ဖြင့်သာ ပြန်လည်သွင်းယူနိုင်ပါသည်။`,
    `Checksum: ${checksum}`,
    ``,
    encryptedPayload,
    ``,
    CIPHER_FOOTER
  ].join('\n');

  return armoredFile;
}

function setItemWithBackup(key: string, val: string | null) {
  if (val !== null && val !== undefined) {
    localStorage.setItem(key, val);
    localStorage.setItem(`${key}_backup`, val);
  }
}

function validateBackupSchema(parsed: any): boolean {
  if (!parsed || typeof parsed !== 'object') return false;
  if (!parsed.payload || typeof parsed.payload !== 'object') return false;
  const p = parsed.payload;
  if (p['3d'] !== undefined && (typeof p['3d'] !== 'object' || p['3d'] === null)) return false;
  if (p['2d'] !== undefined && (typeof p['2d'] !== 'object' || p['2d'] === null)) return false;
  if (p['football'] !== undefined && (typeof p['football'] !== 'object' || p['football'] === null)) return false;
  if (p['security'] !== undefined && (typeof p['security'] !== 'object' || p['security'] === null)) return false;
  return true;
}

/**
 * Restores 100% of ALL system data from encrypted .rhmg file (or legacy JSON backup)
 */
export function restoreSecureMasterBackup(rawFileContent: string, ownerPin: string = ''): {
  success: boolean;
  message: string;
  isLegacy?: boolean;
} {
  try {
    const trimmed = rawFileContent.trim();

    // Check if it's an encrypted armored archive
    if (trimmed.includes(CIPHER_HEADER) && trimmed.includes(CIPHER_FOOTER)) {
      const lines = trimmed.split('\n');
      let payloadLine = '';
      let headerChecksum = '';

      for (const line of lines) {
        if (line.startsWith('Checksum:')) {
          headerChecksum = line.replace('Checksum:', '').trim();
        } else if (!line.startsWith('-----') && !line.includes(':') && line.trim().length > 20) {
          payloadLine = line.trim();
        }
      }

      if (!payloadLine) {
        // Fallback search between headers
        const startIdx = trimmed.indexOf(CIPHER_HEADER) + CIPHER_HEADER.length;
        const endIdx = trimmed.indexOf(CIPHER_FOOTER);
        const body = trimmed.substring(startIdx, endIdx);
        const candidates = body.split('\n').map(l => l.trim()).filter(l => l.includes('::'));
        if (candidates.length > 0) payloadLine = candidates[0];
      }

      if (!payloadLine) {
        return { success: false, message: 'ဖိုင်အတွင်းမှ Encrypted Data ရှာမတွေ့ပါ' };
      }

      // Decrypt
      let decryptedJson = '';
      try {
        decryptedJson = decryptPayload(payloadLine, ownerPin);
      } catch (err) {
        // Try without PIN if PIN failed
        try {
          decryptedJson = decryptPayload(payloadLine, '');
        } catch {
          return { success: false, message: 'ဖိုင်ဖွင့်၍ မရပါ (PIN နံပါတ် မှားယွင်းနိုင်ပါသည်)' };
        }
      }

      const parsed = JSON.parse(decryptedJson);
      if (!validateBackupSchema(parsed)) {
        return { success: false, message: 'ဒေတာ ဖော်မတ်/စကီးမား မှားယွင်းနေပါသည် (Schema Validation Failed)' };
      }

      // Validate security PIN if stored in backup
      const psec = parsed.payload['security'];
      if (psec && psec.ownerPin && ownerPin) {
        if (!verifyObscuredPin(ownerPin, psec.ownerPin)) {
          return { success: false, message: 'PIN နံပါတ် မှားယွင်းနေပါသည် (Invalid Security PIN)' };
        }
      }

      // Restore 3D
      const p3 = parsed.payload['3d'];
      if (p3) {
        setItemWithBackup(STORAGE_KEYS.ROUNDS, p3.rounds);
        setItemWithBackup(STORAGE_KEYS.VOUCHERS, p3.vouchers);
        setItemWithBackup(STORAGE_KEYS.LIMITS, p3.limits);
        setItemWithBackup(STORAGE_KEYS.BLOCKED, p3.blocked);
        setItemWithBackup(STORAGE_KEYS.FORWARD_SLIPS, p3.forwardSlips);
        setItemWithBackup(STORAGE_KEYS.SETTINGS, p3.settings);
        setItemWithBackup(STORAGE_KEYS.ACTIVE_ROUND_ID, p3.activeRoundId);
      }

      // Restore 2D
      const p2 = parsed.payload['2d'];
      if (p2) {
        setItemWithBackup(STORAGE_KEYS.ROUNDS_2D, p2.rounds);
        setItemWithBackup(STORAGE_KEYS.VOUCHERS_2D, p2.vouchers);
        setItemWithBackup(STORAGE_KEYS.LIMITS_2D, p2.limits);
        setItemWithBackup(STORAGE_KEYS.BLOCKED_2D, p2.blocked);
        setItemWithBackup(STORAGE_KEYS.FORWARD_SLIPS_2D, p2.forwardSlips);
        setItemWithBackup(STORAGE_KEYS.SETTINGS_2D, p2.settings);
        setItemWithBackup(STORAGE_KEYS.ACTIVE_ROUND_ID_2D, p2.activeRoundId);
      }

      // Restore Football
      const pf = parsed.payload['football'];
      if (pf) {
        setItemWithBackup(STORAGE_KEYS.MATCHES_FOOTBALL, pf.matches);
        setItemWithBackup(STORAGE_KEYS.SLIPS_FOOTBALL, pf.slips);
        setItemWithBackup(STORAGE_KEYS.FORWARD_SLIPS_FOOTBALL, pf.forwardSlips);
        setItemWithBackup(STORAGE_KEYS.SETTINGS_FOOTBALL, pf.settings);
        setItemWithBackup(STORAGE_KEYS.ACTIVE_DATE_FOOTBALL, pf.activeDate);
        setItemWithBackup(STORAGE_KEYS.LEAGUES_FOOTBALL, pf.leagues);
      }

      // Restore Security & Modes
      if (psec) {
        setItemWithBackup(SECURITY_STORAGE_KEYS.OWNER_PIN, psec.ownerPin);
        setItemWithBackup(SECURITY_STORAGE_KEYS.ENABLED_MODES, psec.enabledModes);
        setItemWithBackup(SECURITY_STORAGE_KEYS.SETUP_COMPLETED, psec.setupCompleted);
        setItemWithBackup(STORAGE_KEYS.DEALER_MODE, psec.activeDealerMode);
      }

      // Restore Telegram
      const ptg = parsed.payload['telegram'];
      if (ptg) {
        setItemWithBackup(TELEGRAM_STORAGE_KEYS.CONFIG, ptg.config);
        setItemWithBackup(TELEGRAM_STORAGE_KEYS.ORDERS, ptg.orders);
      }

      return {
        success: true,
        message: 'လုံခြုံစိတ်ချရသော Encrypted Master Backup ဒေတာအားလုံး အောင်မြင်စွာ ပြန်လည်သွင်းယူပြီးပါပြီ'
      };
    }

    // Handle legacy JSON backup format for backward compatibility
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.modules || parsed.storageType === 'UNIFIED_MASTER_BACKUP') {
        const ok = restoreUnifiedMasterBackup(trimmed);
        if (ok) {
          return {
            success: true,
            isLegacy: true,
            message: 'ယခင် JSON Backup ဖိုင်မှ ဒေတာများ အောင်မြင်စွာ ပြန်လည်သွင်းယူပြီးပါပြီ'
          };
        }
      }
    } catch {
      // Not json
    }

    return { success: false, message: 'ဖိုင်သည် တရားဝင် ရွှေမင်္ဂလာ Backup ဖိုင် မဟုတ်ပါ' };
  } catch (err: any) {
    console.error('Failed to restore secure backup:', err);
    return { success: false, message: `ဖိုင်ဖတ်ရှုမှု အမှားအယွင်း: ${err?.message || 'မသိရသော အမှား'}` };
  }
}

/**
 * Legacy support for raw JSON Unified Master Backup
 */
export function exportUnifiedMasterBackup(): string {
  return exportSecureMasterBackup();
}

/**
 * Legacy support for raw JSON restore
 */
export function restoreUnifiedMasterBackup(jsonString: string): boolean {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.modules) return false;

    const m3 = parsed.modules['3d'];
    if (m3) {
      if (m3.rounds) localStorage.setItem(STORAGE_KEYS.ROUNDS, m3.rounds);
      if (m3.vouchers) localStorage.setItem(STORAGE_KEYS.VOUCHERS, m3.vouchers);
      if (m3.limits) localStorage.setItem(STORAGE_KEYS.LIMITS, m3.limits);
      if (m3.blocked) localStorage.setItem(STORAGE_KEYS.BLOCKED, m3.blocked);
      if (m3.forwardSlips) localStorage.setItem(STORAGE_KEYS.FORWARD_SLIPS, m3.forwardSlips);
      if (m3.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS, m3.settings);
      if (m3.activeRoundId) localStorage.setItem(STORAGE_KEYS.ACTIVE_ROUND_ID, m3.activeRoundId);
    }

    const m2 = parsed.modules['2d'];
    if (m2) {
      if (m2.rounds) localStorage.setItem(STORAGE_KEYS.ROUNDS_2D, m2.rounds);
      if (m2.vouchers) localStorage.setItem(STORAGE_KEYS.VOUCHERS_2D, m2.vouchers);
      if (m2.limits) localStorage.setItem(STORAGE_KEYS.LIMITS_2D, m2.limits);
      if (m2.blocked) localStorage.setItem(STORAGE_KEYS.BLOCKED_2D, m2.blocked);
      if (m2.forwardSlips) localStorage.setItem(STORAGE_KEYS.FORWARD_SLIPS_2D, m2.forwardSlips);
      if (m2.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS_2D, m2.settings);
      if (m2.activeRoundId) localStorage.setItem(STORAGE_KEYS.ACTIVE_ROUND_ID_2D, m2.activeRoundId);
    }

    const mf = parsed.modules['football'];
    if (mf) {
      if (mf.matches) localStorage.setItem(STORAGE_KEYS.MATCHES_FOOTBALL, mf.matches);
      if (mf.slips) localStorage.setItem(STORAGE_KEYS.SLIPS_FOOTBALL, mf.slips);
      if (mf.forwardSlips) localStorage.setItem(STORAGE_KEYS.FORWARD_SLIPS_FOOTBALL, mf.forwardSlips);
      if (mf.settings) localStorage.setItem(STORAGE_KEYS.SETTINGS_FOOTBALL, mf.settings);
      if (mf.activeDate) localStorage.setItem(STORAGE_KEYS.ACTIVE_DATE_FOOTBALL, mf.activeDate);
    }

    return true;
  } catch (e) {
    console.error('Failed to restore master backup:', e);
    return false;
  }
}

/**
 * Exports period-filtered vouchers across 3D, 2D, and Football into an encrypted .rhmg archive
 */
export function exportPeriodVouchersBackup(
  vouchers3D: any[],
  vouchers2D: any[],
  slipsFB: any[],
  periodLabel: string,
  ownerPin: string = ''
): string {
  const data = {
    app: 'ရွှေမင်္ဂလာ စာရင်းစီမံခန့်ခွဲမှုစနစ် (Voucher Archive)',
    version: '3.0',
    exportTimestamp: new Date().toISOString(),
    format: 'SHWE_MINGALAR_VOUCHERS_ARCHIVE',
    period: periodLabel,
    payload: {
      '3d_vouchers': vouchers3D,
      '2d_vouchers': vouchers2D,
      'football_slips': slipsFB
    }
  };
  const rawJson = JSON.stringify(data);
  const checksum = generateChecksum(rawJson);
  const encryptedPayload = encryptPayload(rawJson, ownerPin);

  return [
    CIPHER_HEADER,
    `Format: SMG-VOUCHERS-ARCHIVE-V3`,
    `Period: ${periodLabel}`,
    `Date: ${new Date().toISOString()}`,
    `App: Shwe-Mingalar-Management-System`,
    `Checksum: ${checksum}`,
    ``,
    encryptedPayload,
    ``,
    CIPHER_FOOTER
  ].join('\n');
}
