/**
 * Device Identifier Utility
 * Generates and persists a unique device ID and provides a short code for voucher prefixes.
 */
import { generateUUID } from './restorePoints';

const DEVICE_ID_KEY = 'device_id_v1';

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export function getDeviceShortCode(): string {
  const id = getDeviceId();
  return id.slice(0, 4).toUpperCase();
}
