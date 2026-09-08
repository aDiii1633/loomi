# Loomi Design System — "Neo-Chubby Brutalism"

Status: **IMPLEMENTED** (tokens, primitives, navigation chrome, screen migration) · **NOT IMPLEMENTED** (dark mode wiring) · **NOT VERIFIED this pass** (device QA — see Verification below)

This supersedes the previous "Plant Child" system (which itself superseded
"Luminous Sanctuary"). Source of truth for every value below is
`src/theme/tokens.ts` — never hardcode a color, radius, spacing, border, or
shadow outside that file.

## Provenance

- **Visual source of truth**: the extracted reference ZIP at
  `../stitch_between_us_couple_companion` (templates 1–5 +
  `together_hub_progressive_disclosure`). The palette, hard-shadow language,
  chubby radii, and typography pairing were extracted from its screens.
  Note: `luminous_sanctuary/DESIGN.md` inside the ZIP is an *older* token set
  and is explicitly superseded.
- **Functionality source of truth**: the existing Loomi codebase. No
  feature, store, repository, or navigation destination was added, removed,
  or renamed for this redesign.

## Core language

- **Canvas**: warm paper `surface #FFF8E8`; cards `#FCFAF4` / white.
- **Structure**: solid charcoal `#252525` borders — `border.width` (2) for
  cards/buttons/dock, `border.widthThin` (1.5) for chips/badges/icons-wells.
- **Shadows**: hard offset, zero blur (`elevation.card` 3/3, `raised` 4/4,
  `badge` 2/2, `dock` 0/4, `modal` 6/6, `pressed` 1/1). Press interactions
  translate the element into its shadow (`translateX/Y 1–2px`).
- **Radii**: chubby — `sm 8 / md 16 / lg 20 / xl 24 / 2xl 28 / pill`.
- **Typography**: Plus Jakarta Sans 600/700/800 for headings & labels,
  Manrope 400–700 for body. Both are loaded in `app/_layout.tsx` and wired
  through `type.*` tokens (this fixed the old "font never applied" gap).
- **Color blocking**: contextual pastels (`softPink`, `tertiaryFixed`,
  `softSage`, `powderBlue`, `peach`, `softLavender`, `primaryContainer`)
  fill whole cards/sections, always bordered + hard-shadowed.

## Component system

- `src/theme/tokens.ts` — colors, type scale, space, radii, border,
  elevation, motion, layout.
- `src/components/primitives.tsx` — `Button` (primary/secondary/ghost/rose/
  yellow), `Chip` (7 tones), `Card` (10 tones), `Avatar`, `Input`,
  `ProgressBar`, `EmptyState` (with Pao & Ly mascot), `SkeletonCard`,
  `ErrorText`, `Badge`.
- `src/components/chrome.tsx` — `SubHeader`, `FloatingTabDock` (replaces the
  default tab bar), `BottomSheet`, `ToastHost` (toasts + confirm modal),
  `useSafeTopInset`.
- `src/components/illustrations/Mascot.tsx` — Pao & Ly, used on empty states
  and hero moments.

## Screen migration status

| Status | Screens |
|---|---|
| On primitives (1–3 legacy alias token names may remain — values already map to the current palette) | Challenges, Timeline, Vault, Settings, Location, Goals, Bucket, Dates, Game detail, Reminders, Question, Memory detail |
| Fully rebuilt in-system this pass (legacy aliases removed, hand-rolled styling moved onto the border/shadow language) | Chat, Streak, Mood, Memories, Profile, Games catalog |

Remaining cosmetic notes: a few screens intentionally use raw `#FFFFFF` on
forest-toned labels for contrast; `colors.deepForest`/`forest` are used for
ink-on-pastel emphasis by design.

## Dark mode — NOT IMPLEMENTED (honest status)

The current token file is light-only and every screen builds its
`StyleSheet.create` at module scope, so the palette is baked in at import
time. Real dark mode therefore needs a dynamic-theming refactor:

1. Add a designed dark palette to `tokens.ts` (warm charcoal canvas, same
   charcoal borders/hard shadows, desaturated pastels — *not* an inversion).
2. Introduce a `ThemeProvider` / `useColors()` and convert module-scope
   styles to palette-aware factories across all screens.
3. Add the Appearance toggle in Settings (the `AppSettings.appearance`
   field already exists and persists).

This was deliberately **not** attempted blind: it touches every screen and
cannot be verified safely without a working shell (see below).

## Verification

- Previous pass: `npm run typecheck` / `npm run lint` / `npm test` (29/29)
  all green, verified on OPPO CPH2527.
- **This pass (alias cleanup + chat/streak/mood/memories/profile/games
  polish): NOT VERIFIED** — the dev machine's Git Bash shell began failing
  all process spawns (cygwin fork errors), so `typecheck`/`lint`/`test` and
  on-device screenshots could not be run. Changes are style-only (colors,
  borders, shadows, radii — no logic touched), but they must be re-verified
  with the standard suite + device walkthrough before calling them PASS.
