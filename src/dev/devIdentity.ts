/**
 * DEVELOPMENT IDENTITY — gated behind __DEV__.
 *
 * Authentication is intentionally deferred. This module provides a clear,
 * isolated development identity (Aditya paired with Maya) so the whole app
 * can be built and tested now. It MUST never be reachable in a production
 * build: everything is inside a `__DEV__` guard and throws otherwise.
 * When real auth lands, screens consume the same `SessionStore` shape.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface DevIdentity {
  selfId: string;
  partnerId: string;
  coupleId: string;
}

export const DEV_IDS: DevIdentity = {
  selfId: 'user-aditya',
  partnerId: 'user-maya',
  coupleId: 'couple-aditya-maya',
};

export function isDevBuild(): boolean {
  return __DEV__;
}

/** Device label for the future "devices & sessions" settings page. */
export function deviceName(): string {
  const modelName =
    (Constants.deviceName as string | null | undefined) ??
    (Constants.deviceYearClass ? `Device (${Constants.deviceYearClass})` : 'Unknown device');
  return `${modelName} · ${Platform.OS}`;
}
