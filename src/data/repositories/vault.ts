/**
 * Private Vault security boundary.
 *
 * - The PIN is stored ONLY in expo-secure-store (Keychain / Keystore), as a
 *   salted SHA-256 hash — never in app state, never in the DB.
 * - Biometric unlock uses expo-local-authentication when the device supports it.
 * - Vault content reads/writes go through here so a future server can replace
 *   this boundary with authenticated server-side access control without
 *   touching UI code.
 */
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';
import type { VaultConfig } from '../../domain/types';

const VAULT_CONFIG_KEY = 'twofold.vault.config.v1';

export async function isVaultConfigured(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(VAULT_CONFIG_KEY);
  return !!raw;
}

export async function configureVault(pin: string): Promise<void> {
  const salt = Crypto.randomUUID();
  const pinHash = await hashPin(pin, salt);
  const config: VaultConfig = {
    pinHash,
    salt,
    biometricEnabled: await biometricsAvailable(),
    createdAt: Date.now(),
  };
  await SecureStore.setItemAsync(VAULT_CONFIG_KEY, JSON.stringify(config));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const config = await readConfig();
  if (!config) return false;
  const candidate = await hashPin(pin, config.salt);
  return candidate === config.pinHash;
}

export async function biometricsAvailable(): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return hasHardware && enrolled;
}

export async function unlockWithBiometrics(): Promise<boolean> {
  const config = await readConfig();
  if (!config?.biometricEnabled) return false;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock your Private Vault',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
  });
  return result.success;
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  const config = await readConfig();
  if (!config) return;
  await SecureStore.setItemAsync(VAULT_CONFIG_KEY, JSON.stringify({ ...config, biometricEnabled: enabled }));
}

export async function changePin(currentPin: string, newPin: string): Promise<boolean> {
  if (!(await verifyPin(currentPin))) return false;
  const config = await readConfig();
  if (!config) return false;
  const salt = Crypto.randomUUID();
  const pinHash = await hashPin(newPin, salt);
  await SecureStore.setItemAsync(VAULT_CONFIG_KEY, JSON.stringify({ ...config, salt, pinHash }));
  return true;
}

async function readConfig(): Promise<VaultConfig | null> {
  const raw = await SecureStore.getItemAsync(VAULT_CONFIG_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VaultConfig;
  } catch {
    return null;
  }
}

async function hashPin(pin: string, salt: string): Promise<string> {
  // Key-stretching loop: 5,000 rounds of salted SHA-256. For a 4-8 digit PIN
  // against an on-device attacker with SecureStore (Keystore) protection,
  // this keeps casual extraction impractical without a native KDF plugin.
  let digest = `${salt}:${pin}`;
  for (let i = 0; i < 5000; i++) {
    digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, digest);
  }
  return digest;
}
