/**
 * Icon set — Feather (via @expo/vector-icons, bundled with expo) provides the
 * closest aesthetic match to Iconly's rounded, light line style per the
 * approved design's icon direction. Keep usage consistent: 24 for nav, 20-22
 * for card icons, 14-16 inline.
 *
 * `Icon` accepts EITHER a raw Feather glyph name (e.g. "chevron-left") OR one
 * of our domain aliases below (e.g. "back", "trash2", "alert"). Unknown names
 * fall back to a neutral glyph and warn in dev, so a typo never crashes a screen.
 */
import { Feather } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

export type FeatherName = ComponentProps<typeof Feather>['name'];

/** Domain concepts / loose aliases → Feather glyphs (single source of truth). */
export const glyphs = {
  home: 'home',
  together: 'heart',
  chat: 'message-circle',
  memories: 'book-open',
  profile: 'user',
  location: 'map-pin',
  orbit: 'navigation',
  question: 'help-circle',
  spark: 'zap',
  fire: 'zap',
  quiz: 'help-circle',
  compare: 'shuffle',
  grid: 'grid',
  mic: 'mic',
  play: 'play',
  pause: 'pause',
  lock: 'lock',
  unlock: 'unlock',
  shield: 'shield',
  check: 'check-circle',
  plus: 'plus',
  calendar: 'calendar',
  clock: 'clock',
  settings: 'settings',
  bell: 'bell',
  back: 'chevron-left',
  forward: 'chevron-right',
  camera: 'camera',
  image: 'image',
  video: 'video',
  trash: 'trash-2',
  trash2: 'trash-2',
  edit: 'edit-2',
  close: 'x',
  send: 'send',
  heart: 'heart',
  star: 'star',
  search: 'search',
  sync: 'refresh-cw',
  refresh: 'refresh-cw',
  user: 'user',
  users: 'users',
  gift: 'gift',
  cake: 'gift',
  flag: 'flag',
  list: 'list',
  book: 'book-open',
  moon: 'moon',
  sun: 'sun',
  coffee: 'coffee',
  film: 'film',
  target: 'target',
  eye: 'eye',
  eyeOff: 'eye-off',
  key: 'key',
  fingerprint: 'unlock',
  info: 'info',
  alert: 'alert-circle',
  trophy: 'award',
  award: 'award',
  more: 'more-horizontal',
  message: 'message-circle',
  smile: 'smile',
  map: 'map',
  wallet: 'credit-card',
  crosshair: 'crosshair',
} satisfies Record<string, FeatherName>;

export type GlyphKey = keyof typeof glyphs;

/** Any value callers may pass for `name` — a Feather glyph or a domain alias. */
export type IconName = FeatherName | GlyphKey;

const FEATHER_GLYPHS = Feather.glyphMap as Record<string, number>;

export function resolveIcon(name: string): FeatherName {
  if (name in glyphs) return glyphs[name as GlyphKey];
  if (name in FEATHER_GLYPHS) return name as FeatherName;
  if (__DEV__) console.warn(`[Icon] unknown icon "${name}" — falling back to "circle"`);
  return 'circle';
}

export interface IconProps {
  name: IconName | (string & {});
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color }: IconProps) {
  return <Feather name={resolveIcon(name)} size={size} color={color} />;
}
