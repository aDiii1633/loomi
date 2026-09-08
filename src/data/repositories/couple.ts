import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccessibilityInfo } from 'react-native';
import { DEV_IDS } from '../../dev/devIdentity';
import { daysTogether } from '../../domain/datetime';
import type { AppSettings, Couple, User } from '../../domain/types';
import { ANNIVERSARY_ISO } from '../seed';

const SETTINGS_KEY = 'twofold.settings.v1';

export const DEFAULT_SETTINGS: AppSettings = {
  appearance: 'light',
  notificationsEnabled: true,
  dailyQuestionReminder: true,
  hapticsEnabled: true,
  locationSharing: false,
  reducedMotion: false,
};

export function getSelf(): User {
  return { id: DEV_IDS.selfId, name: 'Aditya', isSelf: true };
}

export function getPartner(): User {
  return { id: DEV_IDS.partnerId, name: 'Maya', isSelf: false };
}

export function getCouple(): Couple {
  return {
    id: DEV_IDS.coupleId,
    partnerAId: DEV_IDS.selfId,
    partnerBId: DEV_IDS.partnerId,
    anniversaryISO: ANNIVERSARY_ISO,
    level: sanctuaryLevel(ANNIVERSARY_ISO),
    isLinked: true,
  };
}

/** "Sanctuary" levels: 1 per 250 days together, capped sanely. */
export function sanctuaryLevel(anniversaryISO: string, now = Date.now()): number {
  return Math.min(9, 1 + Math.floor(daysTogether(anniversaryISO, now) / 250));
}

/* ------------------------------- settings -------------------------------- */

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      // First run only: respect the OS-level "reduce motion" accessibility
      // preference as the starting default. Never re-applied once the user
      // has their own saved settings — their choice always wins after that.
      const osReducedMotion = await AccessibilityInfo.isReduceMotionEnabled().catch(() => false);
      return { ...DEFAULT_SETTINGS, reducedMotion: osReducedMotion };
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
