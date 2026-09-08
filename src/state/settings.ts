/**
 * Settings + location state. Location sharing is strictly opt-in and the
 * permission flow is explicit. The realtime partner location is abstracted —
 * dev builds show a seeded "last known" snapshot; a future backend will feed
 * the same shape.
 */
import { create } from 'zustand';
import * as Location from 'expo-location';
import type { AppSettings, LocationPermissionState, LocationState } from '../domain/types';
import { loadSettings, saveSettings } from '../data/repositories/couple';
import { dayISO, formatTime } from '../domain/datetime';
import { pushLocal, makeNotificationId } from '../data/repositories/notifications';
import { useSessionStore } from './session';
import { haptic } from './ui';

interface SettingsState {
  loaded: boolean;
  settings: AppSettings;
  hydrate: () => Promise<void>;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  loaded: false,
  settings: {
    appearance: 'light',
    notificationsEnabled: true,
    dailyQuestionReminder: true,
    hapticsEnabled: true,
    locationSharing: false,
    reducedMotion: false,
  },
  hydrate: async () => {
    const settings = await loadSettings();
    set({ settings, loaded: true });
  },
  update: async (key, value) => {
    const next = { ...get().settings, [key]: value };
    set({ settings: next });
    if (key === 'hapticsEnabled') haptic('light');
    await saveSettings(next);
  },
}));

interface LocationStoreState {
  permission: LocationPermissionState;
  state: LocationState;
  loading: boolean;
  refresh: () => Promise<void>;
  requestPermission: () => Promise<void>;
  setSharing: (enabled: boolean) => Promise<void>;
  updateOwnLocation: () => Promise<void>;
}

/** Dev-only seeded partner snapshot, for the __DEV__ demo couple only. A real
 * user must never see fabricated partner location — this returns null in
 * any production build, where a real backend sync will populate it. */
function partnerSnapshot(): LocationState['partner'] {
  if (!__DEV__) return null;
  return { distanceKm: 1.2, label: 'Bandra', syncedAtISO: new Date().toISOString() };
}

/** Real reverse-geocoded place label for the caller's own fix. Falls back to
 * a coordinate string when geocoding is unavailable — never a made-up
 * neighborhood name. */
async function reverseGeocodeLabel(lat: number, lon: number): Promise<string> {
  try {
    const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    const p = places[0];
    if (!p) return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
    const parts = [p.city ?? p.district ?? p.subregion, p.region].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
  } catch {
    return `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
  }
}

function mapPermission(status: Location.PermissionStatus, canAskAgain: boolean): LocationPermissionState {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return canAskAgain ? 'requested' : 'denied';
  return 'not_requested';
}

export const useLocationStore = create<LocationStoreState>((set, get) => ({
  permission: 'not_requested',
  state: { permission: 'not_requested', sharingEnabled: false, self: null, partner: partnerSnapshot() },
  loading: false,
  refresh: async () => {
    const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
    const permission = mapPermission(status, canAskAgain);
    set({ permission, state: { ...get().state, permission } });
  },
  requestPermission: async () => {
    set({ loading: true });
    try {
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      const permission = mapPermission(status, canAskAgain);
      set({ permission, loading: false, state: { ...get().state, permission } });
    } catch {
      set({ loading: false, permission: 'unavailable' });
    }
  },
  setSharing: async (enabled) => {
    const settings = useSettingsStore.getState().settings;
    await useSettingsStore.getState().update('locationSharing', enabled);
    set((s) => ({ state: { ...s.state, sharingEnabled: enabled } }));
    void settings;
    if (enabled) {
      await get().updateOwnLocation();
      const partnerName = useSessionStore.getState().partner?.name;
      await pushLocal({
        id: makeNotificationId(),
        kind: 'partner_activity',
        title: 'Location sharing on',
        body: partnerName ? `${partnerName} can now see your last known spot.` : 'Your partner can now see your last known spot.',
        createdAt: Date.now(),
        route: '/location',
      });
    }
  },
  updateOwnLocation: async () => {
    if (get().permission !== 'granted') return;
    set({ loading: true });
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const label = await reverseGeocodeLabel(pos.coords.latitude, pos.coords.longitude);
      set({
        loading: false,
        state: {
          ...get().state,
          sharingEnabled: true,
          self: {
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            label,
            atISO: `${dayISO()} ${formatTime(pos.timestamp)}`,
          },
          partner: partnerSnapshot(),
        },
      });
    } catch {
      set({ loading: false, permission: 'unavailable' });
    }
  },
}));
