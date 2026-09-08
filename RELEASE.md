# Loomi — Android release build

## App identity
| | |
|---|---|
| Display name | **Loomi** |
| Package name | **`com.loomi.app`** *(permanent — this is the Play Store app id, cannot change after first upload)* |
| Version name | `1.0.0` |
| Version code | `1` *(bump by +1 for every Play Store upload — Play rejects a re-used code)* |
| Backend | Clerk (auth, **dev instance** `pk_test_…`) + Supabase project `loomi` (`puncquwgzfxaytwkuznz`) |
| Config | `TwoFold/.env` — `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (all baked into the bundle at build time) |

## ⚠️ The signing keystore — DO NOT LOSE THIS
Release builds are signed with an **upload key** generated on 2026-09-08:

| | |
|---|---|
| Keystore file | `TwoFold/android/app/loomi-upload.keystore` |
| Store password | *(see `TwoFold/android/keystore.properties` — also printed in the build handoff)* |
| Key alias | `loomi-upload` |
| Key password | same as store password |
| Validity | 10 000 days |

`android/keystore.properties` and `*.keystore` are git-ignored on purpose.

**If this keystore or its password is lost, you can NEVER publish an update to `com.loomi.app` again** — you'd have to ship a brand-new app under a new package. Right now:
1. Copy `loomi-upload.keystore` **and** the password to a password manager / secure backup, off this machine.
2. When you create the Play Console app, enrol in **Play App Signing** (default) — then Google holds the real app-signing key and this file is "only" your upload key (still critical, but recoverable via Google support if lost).

## Build the AAB (Play Store upload) locally
Requires: JDK 21 (`C:\Program Files\Android\Android Studio\jbr`), Android SDK (`%LOCALAPPDATA%\Android\Sdk`), and `android/keystore.properties` + `android/app/loomi-upload.keystore` present.

```bash
cd "D:\couple app\TwoFold\android"
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
gradlew.bat :app:bundleRelease
```
Output: `android/app/build/outputs/bundle/release/app-release.aab`

For a directly-installable file (sideload / testing, **not** Play Store):
```bash
gradlew.bat :app:assembleRelease
```
Output: `android/app/build/outputs/apk/release/app-release.apk`

## Publishing to Google Play — checklist
1. **Google Play Console** developer account ($25 one-time) → *Create app* → package `com.loomi.app`.
2. Upload `app-release.aab` to an **Internal testing** track first.
3. **Data safety form** — declare what's collected: email (Clerk), user content (messages/photos/journal to Supabase), and *precise location* + *camera* + *microphone* (all opt-in, only when the user turns the feature on). Be accurate — this is the most common rejection reason for this kind of app.
4. **Privacy policy URL** — required (the app has accounts + location + media). Must be publicly hosted.
5. Store listing: short + full description, app icon (512×512), feature graphic (1024×500), ≥2 phone screenshots.
6. Content rating questionnaire, target audience, ads declaration (no ads).
7. `SCHEDULE_EXACT_ALARM` is in the manifest — Play may ask you to justify it or you can switch reminders to an inexact alarm.

## Regenerating native code
`npx expo prebuild --platform android --clean` **overwrites `android/`**, including `app/build.gradle`. The release-signing block in `build.gradle` (loads `keystore.properties`, adds `signingConfigs.release`) is a manual patch — re-apply it after any `prebuild --clean`. `keystore.properties` and the `.keystore` file are not touched by prebuild.

## What is NOT done yet
- Clerk is still a **development** instance (100-user cap, "development" watermark on verification emails). Create a Clerk **Production** instance and swap `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` before a real public launch.
- Privacy policy, store listing assets, screenshots.
