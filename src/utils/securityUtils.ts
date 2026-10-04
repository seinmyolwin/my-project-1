export interface EnabledModes {
  '3d': boolean;
  '2d': boolean;
  'football': boolean;
}

export const SECURITY_STORAGE_KEYS = {
  OWNER_PIN: 'rhmg_owner_pin_code_v1',
  ENABLED_MODES: 'rhmg_enabled_modes_v1',
  SETUP_COMPLETED: 'rhmg_pin_setup_completed_v1'
};

export const DEFAULT_PIN = '123456';

export const DEFAULT_ENABLED_MODES: EnabledModes = {
  '3d': true,
  '2d': true,
  'football': true
};

export function getStoredOwnerPin(): string {
  try {
    const pin = localStorage.getItem(SECURITY_STORAGE_KEYS.OWNER_PIN);
    return pin || DEFAULT_PIN;
  } catch {
    return DEFAULT_PIN;
  }
}

export function saveOwnerPin(newPin: string): boolean {
  if (!newPin || newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
    return false;
  }
  try {
    localStorage.setItem(SECURITY_STORAGE_KEYS.OWNER_PIN, newPin);
    localStorage.setItem(SECURITY_STORAGE_KEYS.SETUP_COMPLETED, 'true');
    return true;
  } catch {
    return false;
  }
}

export function verifyOwnerPin(inputPin: string): boolean {
  const currentPin = getStoredOwnerPin();
  return inputPin === currentPin;
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
