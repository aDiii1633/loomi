/**
 * Clerk's session token cache, backed by expo-secure-store (iOS Keychain /
 * Android Keystore) per Clerk's documented Expo integration. This is the
 * ONLY place a Clerk session token touches disk on-device, and it goes
 * through platform-secure storage, never AsyncStorage/plain SQLite.
 */
import * as SecureStore from 'expo-secure-store';
import type { TokenCache } from '@clerk/expo';

export const clerkTokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // SecureStore can fail on some devices/emulators without a secure
      // enclave; Clerk falls back to re-authenticating rather than crashing.
    }
  },
};
