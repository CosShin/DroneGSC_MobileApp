import * as SecureStore from 'expo-secure-store';

const SIGNING_KEY_ID = 'anitech-gcs.mavlink-signing-key.v1';
const HEX_KEY = /^[0-9a-fA-F]{64}$/;

export function parseSigningKeyHex(value: string) {
  const normalized = value.replace(/\s+/g, '');
  if (!HEX_KEY.test(normalized)) throw new Error('MAVLINK_SIGNING_KEY_MUST_BE_64_HEX_CHARACTERS');
  return Uint8Array.from({ length: 32 }, (_, index) => Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16));
}

export async function storeMavlinkSigningKey(value: string) {
  const normalized = value.replace(/\s+/g, '').toUpperCase();
  parseSigningKeyHex(normalized);
  await SecureStore.setItemAsync(SIGNING_KEY_ID, normalized, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadMavlinkSigningKey() {
  const value = await SecureStore.getItemAsync(SIGNING_KEY_ID);
  return value ? parseSigningKeyHex(value) : null;
}

export async function deleteMavlinkSigningKey() {
  await SecureStore.deleteItemAsync(SIGNING_KEY_ID);
}

