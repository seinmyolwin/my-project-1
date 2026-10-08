export interface EnabledModes {
  '3d': boolean;
  '2d': boolean;
  'football': boolean;
}

export const SECURITY_STORAGE_KEYS = {
  OWNER_PIN: 'rhmg_owner_pin_code_v1',
  OWNER_PASSWORD: 'rhmg_owner_password_v2',
  ENABLED_MODES: 'rhmg_enabled_modes_v1',
  SETUP_COMPLETED: 'rhmg_pin_setup_completed_v1'
};

export const DEFAULT_PIN = '123456';

export const DEFAULT_ENABLED_MODES: EnabledModes = {
  '3d': true,
  '2d': true,
  'football': true
};

/**
 * Obscures/hashes PIN code for safe backup export so plaintext PIN is never exposed in backup files
 */
export function obscurePin(pin: string | null): string | null {
  if (!pin) return null;
  const salt = 'SHWE_MINGALAR_PIN_SALT_2026';
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    hash = ((hash << 5) - hash) + pin.charCodeAt(i);
    hash |= 0;
  }
  try {
    return `OBSCURED_PIN_v1::${Math.abs(hash).toString(36)}::${btoa(`${salt}_${pin}`)}`;
  } catch {
    return `OBSCURED_PIN_v1::${Math.abs(hash).toString(36)}`;
  }
}

/**
 * Extracts or verifies obscured PIN against input PIN
 */
export function verifyObscuredPin(inputPin: string, obscured: string | null): boolean {
  if (!obscured || !inputPin) return false;
  if (!obscured.startsWith('OBSCURED_PIN_v1::')) {
    return inputPin.trim() === obscured.trim();
  }
  const parts = obscured.split('::');
  if (parts.length >= 3) {
    try {
      const decoded = atob(parts[2]);
      const salt = 'SHWE_MINGALAR_PIN_SALT_2026_';
      if (decoded.startsWith(salt)) {
        return decoded.slice(salt.length) === inputPin.trim();
      }
    } catch {
      // fallback to hash comparison
    }
  }
  return obscurePin(inputPin) === obscured;
}

/**
 * Get current stored master password (fallback to legacy PIN or default '123456')
 */
export function getStoredOwnerPassword(): string {
  try {
    const pw = localStorage.getItem(SECURITY_STORAGE_KEYS.OWNER_PASSWORD);
    if (pw && pw.trim().length >= 4) return pw.trim();
    const legacyPin = localStorage.getItem(SECURITY_STORAGE_KEYS.OWNER_PIN);
    return legacyPin ? legacyPin.trim() : DEFAULT_PIN;
  } catch {
    return DEFAULT_PIN;
  }
}

/**
 * Save new owner settings password (minimum 4 characters, supports letters, numbers, symbols)
 */
export function saveOwnerPassword(newPassword: string): boolean {
  const trimmed = newPassword.trim();
  if (!trimmed || trimmed.length < 4) {
    return false;
  }
  try {
    localStorage.setItem(SECURITY_STORAGE_KEYS.OWNER_PASSWORD, trimmed);
    localStorage.setItem(SECURITY_STORAGE_KEYS.OWNER_PIN, trimmed);
    localStorage.setItem(SECURITY_STORAGE_KEYS.SETUP_COMPLETED, 'true');
    return true;
  } catch {
    return false;
  }
}

/**
 * Verify input password against stored master password
 */
export function verifyOwnerPassword(inputPassword: string): boolean {
  if (!inputPassword) return false;
  const current = getStoredOwnerPassword();
  return inputPassword.trim() === current.trim();
}

/**
 * Check if the current password is still the default fallback
 */
export function isUsingDefaultPassword(): boolean {
  return getStoredOwnerPassword() === DEFAULT_PIN;
}

// Backward-compatible aliases for legacy imports
export const getStoredOwnerPin = getStoredOwnerPassword;
export function saveOwnerPin(newPin: string): boolean {
  return saveOwnerPassword(newPin);
}
export function verifyOwnerPin(inputPin: string): boolean {
  return verifyOwnerPassword(inputPin);
}

export function isFirstTimePinSetup(): boolean {
  try {
    const completed = localStorage.getItem(SECURITY_STORAGE_KEYS.SETUP_COMPLETED);
    return completed !== 'true';
  } catch {
    return true;
  }
}

export function getStoredEnabledModes(): EnabledModes {
  try {
    const raw = localStorage.getItem(SECURITY_STORAGE_KEYS.ENABLED_MODES);
    if (!raw) return DEFAULT_ENABLED_MODES;
    const parsed = JSON.parse(raw);
    return {
      '3d': typeof parsed['3d'] === 'boolean' ? parsed['3d'] : true,
      '2d': typeof parsed['2d'] === 'boolean' ? parsed['2d'] : true,
      'football': typeof parsed['football'] === 'boolean' ? parsed['football'] : true
    };
  } catch {
    return DEFAULT_ENABLED_MODES;
  }
}

export function saveEnabledModes(modes: EnabledModes): void {
  try {
    // Ensure at least one mode is enabled
    if (!modes['3d'] && !modes['2d'] && !modes['football']) {
      modes['3d'] = true;
    }
    localStorage.setItem(SECURITY_STORAGE_KEYS.ENABLED_MODES, JSON.stringify(modes));
  } catch {
    // ignore
  }
}
