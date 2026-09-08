# Loomi

A private space for two people — one place to talk, remember, play, plan and grow
together. No feed, no followers, no strangers.

| | |
|---|---|
| **App** | Expo SDK 54 · React Native · expo-router · Zustand |
| **Auth** | Clerk (email + Google SSO) |
| **Backend** | Supabase (PostgreSQL · Row Level Security · Realtime · Storage) |
| **Local cache** | SQLite (offline-first, cloud-synced) |
| **Package** | `com.loomi.app` |

## Layout

```
.
├── app/            expo-router routes (screens, layouts, auth group, tab group)
├── src/
│   ├── auth/       Clerk token cache, Google SSO, error mapping
│   ├── components/ shared UI (primitives, illustrations, chrome, motion)
│   ├── data/       SQLite layer, repositories, Supabase client + sync + realtime
│   ├── domain/     pure logic (streak/question engines, validation, datetime, geo)
│   └── state/      Zustand stores (session, chat, life, rewards, settings, …)
├── android/        native project (release signing via android/keystore.properties)
├── assets/         fonts, icons, Pao & Ly illustrations
├── __tests__/      Jest (domain logic)
└── website/        static marketing site (deploys to Vercel from this folder)
```

The Supabase schema and migrations live in a separate `pairly-backend/` workspace.

## Develop

```bash
npm install
npx expo start           # Metro + dev client
npm run typecheck        # tsc --noEmit
npm run lint             # expo lint
npm test                 # jest
```

Create a `.env` (git-ignored) with the public keys:

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

Only publishable / anon keys belong in the client — never a Clerk secret key or a
Supabase service-role key.

## Build (Android release)

```bash
# EAS (recommended)
eas build -p android --profile production

# or local, with Android SDK + JDK 17+ on PATH
cd android && ./gradlew :app:bundleRelease   # -> app/build/outputs/bundle/release/app-release.aab
```

## Website

```bash
cd website
npx serve .              # http://localhost:3000
```

Deployed on Vercel with the project **root directory set to `website/`** (it is a
plain static site — no build step).
