/**
 * Loomi design tokens — "Neo-Chubby Brutalism" design system.
 * Palette and structural language extracted from the Stitch reference ZIP.
 * Warm canvas, solid charcoal borders, hard offset shadows, chubby radii,
 * Plus Jakarta Sans headings, Manrope body text.
 */

export const colors = {
  // Canvas — warm, paper-like
  surface: '#FFF8E8',
  surfaceDim: '#DCD9D9',
  surfaceBright: '#FFF8E8',

  // Containers & cards
  card: '#FCFAF4',
  cardWhite: '#FFFFFF',
  surfaceContainerLow: '#F6F3F2',
  surfaceContainer: '#F0EDED',
  surfaceContainerHigh: '#EAE7E7',
  surfaceContainerHighest: '#E4E2E1',

  // Ink
  ink: '#1B1C1C',
  inkVariant: '#3F493F',
  deepForest: '#1B1C1C',
  deepForestContrast: '#1B1C1C',
  inverseOnSurface: '#F3F0EF',
  inverseSurface: '#303030',

  // Charcoal — the signature structural color for borders and shadows
  charcoal: '#252525',

  // Brand — green
  primary: '#006D34',
  primaryContainer: '#5FBF78',
  onPrimaryContainer: '#004B21',
  primaryFixed: '#96F8AB',
  primaryFixedDim: '#7ADB91',
  onPrimary: '#FFFFFF',
  inversePrimary: '#7ADB91',

  // Deep greens for emphasis
  deepGreen: '#214D3B',
  forest: '#17372C',
  softSage: '#DCEEDC',
  lightMint: '#EEF7EE',

  // Secondary — rose/pink
  secondary: '#894D53',
  secondaryContainer: '#FFB2B8',
  secondaryFixed: '#FFDADB',
  secondaryFixedDim: '#FFB2B8',
  onSecondaryContainer: '#7B4248',
  onSecondaryFixed: '#370C13',

  // Tertiary — yellow/gold
  tertiary: '#705D00',
  tertiaryContainer: '#C5AA44',
  tertiaryFixed: '#FFE175',
  tertiaryFixedDim: '#E1C55C',
  onTertiaryFixed: '#221B00',
  onTertiaryContainer: '#4D3F00',

  // Contextual pastels — color-blocked section fills
  rose: '#F3A8AE',
  softPink: '#FAD5D8',
  sunnyYellow: '#F3D66B',
  softLavender: '#CFC4F6',
  powderBlue: '#B9DDF4',
  peach: '#F2B78E',

  // Neutrals / muted
  outline: '#6F7A6E',
  outlineVariant: '#BECABC',

  // Semantic
  error: '#BA1A1A',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#93000A',
  onError: '#FFFFFF',

  // Overlays
  scrim: 'rgba(28, 22, 20, 0.45)',

  // Legacy aliases for smooth migration (screens that still reference old names)
  pastelMintSubtle: '#EEF7EE',
  mintBorder: '#BECABC',
  emeraldActive: '#5FBF78',
  secondaryInk: '#3F493F',
  accent: '#894D53',
  onTertiaryFixed_legacy: '#221B00',
} as const;

/**
 * Plus Jakarta Sans for headings/labels, Manrope for body.
 * Android/iOS need explicit fontFamily per weight — no synthesis.
 */
export const fontWeightFamily = {
  // Manrope
  'manrope-400': 'Manrope_400Regular',
  'manrope-500': 'Manrope_500Medium',
  'manrope-600': 'Manrope_600SemiBold',
  'manrope-700': 'Manrope_700Bold',
  // Plus Jakarta Sans
  'jakarta-600': 'PlusJakartaSans_600SemiBold',
  'jakarta-700': 'PlusJakartaSans_700Bold',
  'jakarta-800': 'PlusJakartaSans_800ExtraBold',
  // Legacy compatibility (old code that does fontWeightFamily['700'] etc)
  '400': 'Manrope_400Regular',
  '500': 'Manrope_500Medium',
  '600': 'Manrope_600SemiBold',
  '700': 'Manrope_700Bold',
} as const;

/** Typography scale. Headings/labels = Plus Jakarta Sans, body = Manrope. */
export const type = {
  // Display / Hero — Plus Jakarta Sans 800
  displayLg: { fontSize: 40, lineHeight: 48, letterSpacing: -1.2, fontWeight: '800' as const, fontFamily: fontWeightFamily['jakarta-800'] },
  displayLgMobile: { fontSize: 32, lineHeight: 38, letterSpacing: -0.64, fontWeight: '800' as const, fontFamily: fontWeightFamily['jakarta-800'] },

  // Headlines — Plus Jakarta Sans 800/700
  headlineLg: { fontSize: 28, lineHeight: 36, letterSpacing: -0.56, fontWeight: '800' as const, fontFamily: fontWeightFamily['jakarta-800'] },
  headlineMd: { fontSize: 22, lineHeight: 28, letterSpacing: -0.22, fontWeight: '700' as const, fontFamily: fontWeightFamily['jakarta-700'] },
  headlineSm: { fontSize: 18, lineHeight: 24, letterSpacing: -0.18, fontWeight: '700' as const, fontFamily: fontWeightFamily['jakarta-700'] },

  // Body — Manrope 500/400
  bodyLg: { fontSize: 16, lineHeight: 24, letterSpacing: 0, fontWeight: '500' as const, fontFamily: fontWeightFamily['manrope-500'] },
  bodyMd: { fontSize: 14, lineHeight: 20, letterSpacing: 0, fontWeight: '500' as const, fontFamily: fontWeightFamily['manrope-500'] },
  bodySm: { fontSize: 12, lineHeight: 18, letterSpacing: 0, fontWeight: '500' as const, fontFamily: fontWeightFamily['manrope-500'] },

  // Labels — Plus Jakarta Sans 700/800
  labelLg: { fontSize: 14, lineHeight: 18, letterSpacing: 0.14, fontWeight: '700' as const, fontFamily: fontWeightFamily['jakarta-700'] },
  labelMd: { fontSize: 12, lineHeight: 16, letterSpacing: 0.24, fontWeight: '700' as const, fontFamily: fontWeightFamily['jakarta-700'] },
  labelCaps: { fontSize: 10, lineHeight: 14, letterSpacing: 0.4, fontWeight: '800' as const, fontFamily: fontWeightFamily['jakarta-800'] },
} as const;

/** 8pt base grid with 4pt subdivision. */
export const space = {
  '2xs': 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 56,
  screenEdge: 20,
  cardPaddingCompact: 14,
  cardPadding: 20,
  dockHeight: 72,
  safeBottomNav: 88,
} as const;

export const radii = {
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  '2xl': 28,
  pill: 9999,
} as const;

/** Neo-brutalist border constants. */
export const border = {
  width: 2,
  widthThin: 1.5,
  color: '#252525',
} as const;

/**
 * Hard offset shadows — NO blur, NO ambient diffusion.
 * These are applied with border.color as shadowColor + shadowOpacity 1 + shadowRadius 0.
 * On Android, only `elevation` works for shadows, so we pair both systems.
 */
export const elevation = {
  card: {
    shadowColor: border.color,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 3, height: 3 },
    elevation: 3,
  },
  raised: {
    shadowColor: border.color,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 5,
  },
  badge: {
    shadowColor: border.color,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 2, height: 2 },
    elevation: 2,
  },
  dock: {
    shadowColor: border.color,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  modal: {
    shadowColor: border.color,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 6, height: 6 },
    elevation: 10,
  },
  pressed: {
    shadowColor: border.color,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 1, height: 1 },
    elevation: 1,
  },
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  header: {
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
} as const;

export const motion = {
  fast: 150,
  base: 220,
  slow: 320,
  spring: { stiffness: 100, damping: 20, mass: 1 },
  springSoft: { stiffness: 80, damping: 22, mass: 1 },
} as const;

export const layout = {
  maxWidth: 480,
  touchTarget: 48,
  primaryButtonHeight: 52,
} as const;

export type Tokens = typeof colors;
