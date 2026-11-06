import { STORAGE_KEYS } from './storage';
import { SECURITY_STORAGE_KEYS, obscurePin, verifyObscuredPin, revealObscuredPin } from './securityUtils';
import { createRestorePoint } from './restorePoints';

export const TELEGRAM_STORAGE_KEYS = {
  CONFIG: 'shwe_mingalar_telegram_config',
  ORDERS: 'shwe_mingalar_telegram_orders'
};

import { encryptBackupV2, decryptBackupV2, isV2Payload } from './cryptoBackup';
import { exportPayloadV2Full, restoreV2Flow } from './backupSyncV2';

/** Removes customer phone numbers and bot tokens from any backup data (recursive, JSON strings included). */
const scrubForBackup = (value: any): any => {
  if (typeof value === 'string') {
    const t = value.trim();
    if ((t.startsWith('{') || t.startsWith('[')) && t.length > 1) {
      try { return JSON.stringify(scrubForBackup(JSON.parse(t))); } catch { return value; }
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(scrubForBackup);
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const k of Object.keys(value)) {
      if (k === 'customerPhone' || k === 'botToken') continue;
      out[k] = scrubForBackup(value[k]);
    }
    return out;
  }
  return value;
};

const CIPHER_HEADER = '-----BEGIN SHWE MINGALAR SECURE ENCRYPTED LEDGER ARCHIVE v3-----';
const CIPHER_FOOTER = '-----END SHWE MINGALAR SECURE ENCRYPTED LEDGER ARCHIVE-----';
const SECRET_SEED = 'SHWE_MINGALAR_PRO_BOOKIE_SECURE_KEY_2026_!@#$%^&*()';

function getStorageItemSafe(key: string): string | null {
  try {
    const primary = localStorage.getItem(key);
    if (primary !== null && primary !== undefined && primary !== '') {
      return primary;
    }
    const backup = localStorage.getItem(`${key}_backup`);
    if (backup !== null && backup !== undefined && backup !== '') {
      return backup;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * READ-ONLY legacy reader (old XOR archives). Never used for export.
 * Decrypts encrypted payload using dynamic rotating cipher and salt
 */
function decryptLegacyPayload(ciphertext: string, pin: string = ''): string {
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

  // One-time offer of an automatic-backup folder (uses the user gesture of this export)
  try {
    const { getAutoBackupFolder, storeAutoBackupFolder } = await import('./backupSyncV2');
    if ('showDirectoryPicker' in window && !(await getAutoBackupFolder())) {
      if (window.confirm('အလိုအလျောက် backup (ကာလပိတ်ချိန်) သိမ်းမည့် ဖိုင်တွဲ ရွေးမလား?')) {
        const dir = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
        await storeAutoBackupFolder(dir);
      }
    }
  } catch {
    // folder offer is optional
  }

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
export async function exportSecureMasterBackup(ownerPin: string = ''): Promise<string> {
  const fullData = {
    app: 'ရွှေမင်္ဂလာ စာရင်းစီမံခန့်ခွဲမှုစနစ် (Master Suite)',
    version: '3.0',
    exportTimestamp: new Date().toISOString(),
    format: 'SHWE_MINGALAR_ENCRYPTED_ARCHIVE',
    payload: {
      // 3D Lottery Data
      '3d': {
        rounds: getStorageItemSafe(STORAGE_KEYS.ROUNDS),
        vouchers: getStorageItemSafe(STORAGE_KEYS.VOUCHERS),
        limits: getStorageItemSafe(STORAGE_KEYS.LIMITS),
        blocked: getStorageItemSafe(STORAGE_KEYS.BLOCKED),
        forwardSlips: getStorageItemSafe(STORAGE_KEYS.FORWARD_SLIPS),
        settings: getStorageItemSafe(STORAGE_KEYS.SETTINGS),
        activeRoundId: getStorageItemSafe(STORAGE_KEYS.ACTIVE_ROUND_ID)
      },
      // 2D Lottery Data
      '2d': {
        rounds: getStorageItemSafe(STORAGE_KEYS.ROUNDS_2D),
        vouchers: getStorageItemSafe(STORAGE_KEYS.VOUCHERS_2D),
        limits: getStorageItemSafe(STORAGE_KEYS.LIMITS_2D),
        blocked: getStorageItemSafe(STORAGE_KEYS.BLOCKED_2D),
        forwardSlips: getStorageItemSafe(STORAGE_KEYS.FORWARD_SLIPS_2D),
        settings: getStorageItemSafe(STORAGE_KEYS.SETTINGS_2D),
        activeRoundId: getStorageItemSafe(STORAGE_KEYS.ACTIVE_ROUND_ID_2D)
      },
      // Football Data
      'football': {
        matches: getStorageItemSafe(STORAGE_KEYS.MATCHES_FOOTBALL),
        slips: getStorageItemSafe(STORAGE_KEYS.SLIPS_FOOTBALL),
        forwardSlips: getStorageItemSafe(STORAGE_KEYS.FORWARD_SLIPS_FOOTBALL),
        settings: getStorageItemSafe(STORAGE_KEYS.SETTINGS_FOOTBALL),
        activeDate: getStorageItemSafe(STORAGE_KEYS.ACTIVE_DATE_FOOTBALL),
        leagues: getStorageItemSafe(STORAGE_KEYS.LEAGUES_FOOTBALL)
      },
      // Security & System Modes
      'security': {
        ownerPin: obscurePin(getStorageItemSafe(SECURITY_STORAGE_KEYS.OWNER_PASSWORD) || getStorageItemSafe(SECURITY_STORAGE_KEYS.OWNER_PIN)),
        enabledModes: getStorageItemSafe(SECURITY_STORAGE_KEYS.ENABLED_MODES),
        setupCompleted: getStorageItemSafe(SECURITY_STORAGE_KEYS.SETUP_COMPLETED),
        activeDealerMode: getStorageItemSafe(STORAGE_KEYS.DEALER_MODE)
      },

      // Telegram Integration Orders & Config
      'telegram': {
        config: getStorageItemSafe(TELEGRAM_STORAGE_KEYS.CONFIG),
        orders: getStorageItemSafe(TELEGRAM_STORAGE_KEYS.ORDERS)
      },

      // Auxiliary Shared Data
      'auxiliary': {
        masterAgents: getStorageItemSafe('shwe_master_agents_list'),
        customerCommissions: getStorageItemSafe('shwe_customer_commissions_v1'),
        deletedRounds2D: getStorageItemSafe('2d_ledger_deleted_rounds_v1'),
        rawTextClips: getStorageItemSafe('shwe_mingalar_copied_raw_texts')
      }
    }
  };

  const { encrypted: encryptedPayload, checksum } = await exportPayloadV2Full(ownerPin);
  void fullData;

  // Armored encrypted file wrapper (v2)
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
  if (parsed.version !== '3.0') return false;
  if (!parsed.payload || typeof parsed.payload !== 'object') return false;
  const p = parsed.payload;
  if (p['3d'] !== undefined && (typeof p['3d'] !== 'object' || p['3d'] === null)) return false;
  if (p['2d'] !== undefined && (typeof p['2d'] !== 'object' || p['2d'] === null)) return false;
  if (p['football'] !== undefined && (typeof p['football'] !== 'object' || p['football'] === null)) return false;
  if (p['security'] !== undefined && (typeof p['security'] !== 'object' || p['security'] === null)) return false;
  return true;
}

export interface RestoreResult {
  success: boolean;
  message: string;
  isLegacy?: boolean;
  requiresPin?: boolean;
  counts?: {
    '2d': number;
    '3d': number;
    'football': number;
  };
}

/**
 * Restores 100% of ALL system data from encrypted .rhmg file (or legacy JSON backup)
 * Prompts cleanly for PIN if password-protected, never drops vouchers, and ensures safe restore.
 */
export async function restoreSecureMasterBackup(rawFileContent: string, ownerPin: string = ''): Promise<RestoreResult> {
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
        const startIdx = trimmed.indexOf(CIPHER_HEADER) + CIPHER_HEADER.length;
        const endIdx = trimmed.indexOf(CIPHER_FOOTER);
        const body = trimmed.substring(startIdx, endIdx);
        const candidates = body.split('\n').map(l => l.trim()).filter(l => l.includes('::'));
        if (candidates.length > 0) payloadLine = candidates[0];
      }

      if (!payloadLine) {
        return { success: false, message: 'ဖိုင်အတွင်းမှ Encrypted Data ရှာမတွေ့ပါ' };
      }

      let decryptedJson = '';
      let decryptionSuccess = false;

      if (isV2Payload(payloadLine)) {
        try {
          const test = await decryptBackupV2(payloadLine, ownerPin || 'NO_PIN');
          if (generateChecksum(test) === headerChecksum) {
            decryptedJson = test;
            decryptionSuccess = true;
          }
        } catch {
          // wrong passphrase or altered file
        }
      } else {
        // Legacy archive (read-only compatibility)
        if (ownerPin) {
          try {
            const test = decryptLegacyPayload(payloadLine, ownerPin);
            if (generateChecksum(test) === headerChecksum) {
              decryptedJson = test;
              decryptionSuccess = true;
            }
          } catch {
            // ignore
          }
        }
        if (!decryptionSuccess) {
          try {
            const test = decryptLegacyPayload(payloadLine, '');
            if (generateChecksum(test) === headerChecksum) {
              decryptedJson = test;
              decryptionSuccess = true;
            }
          } catch {
            // ignore
          }
        }
      }

      // 3. If still not decrypted, prompt user for PIN
      if (!decryptionSuccess) {
        return {
          success: false,
          requiresPin: true,
          message: ownerPin
            ? 'ရိုက်ထည့်ထားသော Password မှားယွင်းနေပါသည်! Backup ဖိုင် ထုတ်ယူစဉ်က သတ်မှတ်ခဲ့သော Password (ဂဏန်း ၆ လုံး) အား ပြန်လည်စစ်ဆေးပါ'
            : 'ဤ Backup ဖိုင်သည် Password ဖြင့် လုံခြုံစွာ ကာကွယ်ထားပါသည်! ကျေးဇူးပြု၍ ဖိုင်၏ Password (ဂဏန်း ၆ လုံး) ရိုက်ထည့်ပေးပါ'
        };
      }

      const parsed = JSON.parse(decryptedJson);
      if (parsed && parsed.manifest && parsed.manifest.schemaVersion === 2) {
        return await restoreV2Flow(decryptedJson, ownerPin);
      }
      if (!validateBackupSchema(parsed)) {
        return { success: false, message: 'ဒေတာ ဖော်မတ်/စကီးမား မှားယွင်းနေပါသည် (Schema Validation Failed)' };
      }

      // 2. Mandatory Restore Point before overwrite
      try {
        await createRestorePoint('before-import');
      } catch (rpErr) {
        console.error('[Restore] Failed to create before-import restore point:', rpErr);
      }
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const snapshotData: Record<string, string | null> = {};
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k) snapshotData[k] = localStorage.getItem(k);
          }
          localStorage.setItem(`pre_restore_snapshot_${Date.now()}`, JSON.stringify(snapshotData));
        }
      } catch (snapErr) {
        console.warn('Pre-restore snapshot warning:', snapErr);
      }

      let count3D = 0;
      let count2D = 0;
      let countFB = 0;
      let totalDuplicatesCleaned = 0;

      // Restore 3D (Clean duplicate vouchers!)
      const p3 = parsed.payload['3d'];
      if (p3) {
        if (p3.vouchers) {
          try {
            const vArr = JSON.parse(p3.vouchers);
            if (Array.isArray(vArr)) {
              count3D = vArr.length;
            }
          } catch {
            // ignore
          }
        }

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
        if (p2.vouchers) {
          try {
            const vArr = JSON.parse(p2.vouchers);
            if (Array.isArray(vArr)) {
              count2D = vArr.length;
            }
          } catch {
            // ignore
          }
        }

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
        if (pf.slips) {
          try {
            const sArr = JSON.parse(pf.slips);
            if (Array.isArray(sArr)) {
              countFB = sArr.length;
            }
          } catch {
            // ignore
          }
        }

        setItemWithBackup(STORAGE_KEYS.MATCHES_FOOTBALL, pf.matches);
        setItemWithBackup(STORAGE_KEYS.SLIPS_FOOTBALL, pf.slips);
        setItemWithBackup(STORAGE_KEYS.FORWARD_SLIPS_FOOTBALL, pf.forwardSlips);
        setItemWithBackup(STORAGE_KEYS.SETTINGS_FOOTBALL, pf.settings);
        setItemWithBackup(STORAGE_KEYS.ACTIVE_DATE_FOOTBALL, pf.activeDate);
        setItemWithBackup(STORAGE_KEYS.LEAGUES_FOOTBALL, pf.leagues);
      }

      // Restore Security & Modes cleanly without corrupting password
      const psec = parsed.payload['security'];
      if (psec) {
        const revealed = revealObscuredPin(psec.ownerPin);
        if (revealed && /^\d{6}$/.test(revealed)) {
          setItemWithBackup(SECURITY_STORAGE_KEYS.OWNER_PASSWORD, revealed);
          setItemWithBackup(SECURITY_STORAGE_KEYS.OWNER_PIN, revealed);
          setItemWithBackup(SECURITY_STORAGE_KEYS.SETUP_COMPLETED, 'true');
        } else if (ownerPin && /^\d{6}$/.test(ownerPin.trim())) {
          setItemWithBackup(SECURITY_STORAGE_KEYS.OWNER_PASSWORD, ownerPin.trim());
          setItemWithBackup(SECURITY_STORAGE_KEYS.OWNER_PIN, ownerPin.trim());
          setItemWithBackup(SECURITY_STORAGE_KEYS.SETUP_COMPLETED, 'true');
        }
        if (psec.enabledModes) {
          setItemWithBackup(SECURITY_STORAGE_KEYS.ENABLED_MODES, psec.enabledModes);
        }
        if (psec.activeDealerMode) {
          setItemWithBackup(STORAGE_KEYS.DEALER_MODE, psec.activeDealerMode);
        }
      }

      // Restore Telegram
      const ptg = parsed.payload['telegram'];
      if (ptg) {
        setItemWithBackup(TELEGRAM_STORAGE_KEYS.CONFIG, ptg.config);
        setItemWithBackup(TELEGRAM_STORAGE_KEYS.ORDERS, ptg.orders);
      }

      // Restore Auxiliary Data
      const paux = parsed.payload['auxiliary'];
      if (paux) {
        setItemWithBackup('shwe_master_agents_list', paux.masterAgents);
        setItemWithBackup('shwe_customer_commissions_v1', paux.customerCommissions);
        setItemWithBackup('2d_ledger_deleted_rounds_v1', paux.deletedRounds2D);
        setItemWithBackup('shwe_mingalar_copied_raw_texts', paux.rawTextClips);
      }

      const totalVouchersRestored = count2D + count3D + countFB;

      return {
        success: true,
        message: `လုံခြုံစိတ်ချရသော Encrypted Master Backup ဒေတာအားလုံး အောင်မြင်စွာ ပြန်လည်သွင်းယူပြီးပါပြီ (စုစုပေါင်း ဘောင်ချာ ${totalVouchersRestored} စောင် ပါဝင်ပါသည်)`,
        counts: {
          '2d': count2D,
          '3d': count3D,
          'football': countFB
        }
      };
    }

    // Handle legacy JSON backup format for backward compatibility
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.modules || parsed.storageType === 'UNIFIED_MASTER_BACKUP') {
        const ok = await restoreUnifiedMasterBackup(trimmed);
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
export async function exportUnifiedMasterBackup(): Promise<string> {
  return exportSecureMasterBackup();
}

/**
 * Legacy support for raw JSON restore
 */
export async function restoreUnifiedMasterBackup(jsonString: string): Promise<boolean> {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.modules) return false;

    // Mandatory restore point before restoring legacy backup
    try {
      await createRestorePoint('before-import');
    } catch (rpErr) {
      console.error('[Restore] Failed to create before-import restore point:', rpErr);
    }

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
export async function exportPeriodVouchersBackup(
  vouchers3D: any[],
  vouchers2D: any[],
  slipsFB: any[],
  periodLabel: string,
  ownerPin: string = ''
): Promise<string> {
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
  const rawJson = JSON.stringify(scrubForBackup(data));
  const checksum = generateChecksum(rawJson);
  const encryptedPayload = await encryptBackupV2(rawJson, ownerPin || 'NO_PIN');

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
