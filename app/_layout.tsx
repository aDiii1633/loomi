import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { ClerkProvider, useAuth, useUser } from '@clerk/expo';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
} from '@expo-google-fonts/manrope';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { colors } from '../src/theme/tokens';
import { ToastHost } from '../src/components/chrome';
import { useSessionStore } from '../src/state/session';
import { useSettingsStore } from '../src/state/settings';
import { bootstrapApp } from '../src/dev/bootstrap';
import { clerkTokenCache } from '../src/auth/tokenCache';
import { isDevBypass } from '../src/auth/devBypass';
import { registerClerkTokenGetter, isSupabaseConfigured } from '../src/data/backend/supabaseClient';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const CLERK_LOAD_TIMEOUT_MS = 8000;
const BOOT_WORK_TIMEOUT_MS = 8000;

function boot(stage: string, detail?: unknown): void {
  // Dev-only startup trace. Never logs env values, tokens, or keys.
  if (__DEV__) console.log(`[BOOT] ${stage}`, detail ?? '');
}

/** Shown instead of an infinite/blank splash whenever boot cannot proceed.
 * Always hides the native splash on mount so the failure is visible rather
 * than looking identical to "stuck on the icon". */
function BootBlockedScreen({ title, message }: { title: string; message: string }) {
  useEffect(() => {
    boot('SPLASH_HIDE (error)');
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  return (
    <View style={styles.bootScreen}>
      <Text style={styles.bootTitle}>{title}</Text>
      <Text style={styles.bootMessage}>{message}</Text>
      {__DEV__ ? (
        <Text style={styles.bootDiagnostic}>
          {`Clerk key detected: ${CLERK_PUBLISHABLE_KEY ? 'YES' : 'NO'}\nSupabase configured: ${isSupabaseConfigured() ? 'YES' : 'NO'}`}
        </Text>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  if (!CLERK_PUBLISHABLE_KEY) {
    boot('CLERK_KEY_MISSING');
    // Never bypass Clerk to fake a working app: show a visible, legible
    // configuration screen instead of throwing (which just leaves the
    // native splash on screen with nothing rendered) or hanging forever.
    return (
      <BootBlockedScreen
        title="Loomi can't start"
        message={
          __DEV__
            ? 'Clerk configuration is missing.\n\nAdd EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to .env, then restart Expo.'
            : 'This build is missing required configuration. Please contact support.'
        }
      />
    );
  }
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={clerkTokenCache}>
      <RootLayoutNav />
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    padding: 24,
  },
  bootTitle: { fontSize: 20, fontWeight: '700', color: '#252525', marginBottom: 12, textAlign: 'center' },
  bootMessage: { fontSize: 15, color: '#252525', textAlign: 'center', lineHeight: 22 },
  bootDiagnostic: { marginTop: 24, fontSize: 12, color: '#8a8a8a', textAlign: 'center' },
});

/** Races a promise against a timeout so a stuck dependency degrades instead
 * of hanging the boot sequence forever. Resolves (not rejects) on timeout —
 * callers treat "timed out" the same as "failed" and move on regardless.
 * Clears the timer once the real promise wins so a fast, healthy resolve
 * doesn't leave an orphaned setTimeout to fire a false "TIMEOUT" log line
 * 8 seconds later — that dangling timer, not a duplicate boot, was the
 * actual cause of every TIMEOUT log observed during verification. */
function withTimeout(promise: Promise<unknown>, ms: number, label: string): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      boot(`TIMEOUT (${label})`);
      resolve();
    }, ms);
    promise.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      }
    );
  });
}

function RootLayoutNav() {
  const { isLoaded: authLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const hydrateSession = useSessionStore((s) => s.hydrate);
  const setSelfFromClerk = useSessionStore((s) => s.setSelfFromClerk);
  const refreshCouple = useSessionStore((s) => s.refreshCouple);
  const signOutLocal = useSessionStore((s) => s.signOutLocal);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const [booted, setBooted] = React.useState(false);
  const [clerkTimedOut, setClerkTimedOut] = React.useState(false);

  useEffect(() => {
    registerClerkTokenGetter(() => getToken());
  }, [getToken]);

  // If Clerk's own SDK never resolves `isLoaded` (e.g. it can't reach its
  // network endpoint and hangs), don't let the app sit on a blank screen
  // forever — surface it after a bounded wait instead.
  useEffect(() => {
    if (authLoaded) return;
    const t = setTimeout(() => {
      boot('CLERK_LOAD_TIMEOUT');
      setClerkTimedOut(true);
    }, CLERK_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [authLoaded]);

  useEffect(() => {
    boot(authLoaded ? 'CLERK_LOADED' : 'CLERK_MOUNT');
  }, [authLoaded]);

  // __DEV__-only shortcut so local development keeps the rich seeded demo
  // couple (Aditya & Maya) without requiring a real Clerk sign-in every
  // reload. This is NEVER reachable in a release build: `__DEV__` is false
  // there, so `devBypass` is always false and Clerk is the only path in.
  const devBypass = authLoaded && !isSignedIn && isDevBypass();

  useEffect(() => {
    if (!authLoaded) return;
    let cancelled = false;
    (async () => {
      boot('SQLITE_START');
      // Bounded: SQLite init/seed or settings hydration hanging must not
      // block the app from ever reaching a screen.
      await withTimeout(
        bootstrapApp().catch((e) => {
          boot('BOOT_ERROR (bootstrapApp)', e instanceof Error ? e.message : e);
        }),
        BOOT_WORK_TIMEOUT_MS,
        'bootstrapApp'
      );
      boot('SQLITE_READY');

      boot('SESSION_HYDRATE_START');
      if (devBypass) {
        hydrateSession();
      } else if (isSignedIn && user) {
        const name = user.firstName ?? user.username ?? 'You';
        setSelfFromClerk({ clerkUserId: user.id, name });
        // Backend couple lookup: bootstraps the public.users row (idempotent
        // upsert keyed by the Clerk subject) and loads the active couple if
        // one exists. Bounded so a slow/unreachable backend can't hold the
        // app on the splash forever — the router then falls back to the
        // connection screen, which retries the lookup when used.
        boot('COUPLE_LOOKUP_START');
        await withTimeout(
          refreshCouple().catch((e) => {
            boot('BOOT_ERROR (refreshCouple)', e instanceof Error ? e.message : e);
          }),
          BOOT_WORK_TIMEOUT_MS,
          'refreshCouple'
        );
        boot('COUPLE_LOOKUP_DONE');
      }
      // NOTE: no `signOutLocal()` here. This effect re-runs whenever Clerk's
      // `user` object first appears (which happens mid-sign-up, before the
      // session is active), and wiping the local DB / stores at that moment
      // corrupted the in-progress sign-up. Local teardown now lives in a
      // dedicated effect that only fires on a real signed-in -> signed-out
      // transition (see below).
      boot('SESSION_HYDRATE_DONE');

      await withTimeout(hydrateSettings(), BOOT_WORK_TIMEOUT_MS, 'hydrateSettings');
      if (!cancelled) setBooted(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoaded, isSignedIn, user?.id, devBypass]);

  useEffect(() => {
    if (fontsLoaded && booted) {
      boot('SPLASH_HIDE');
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, booted]);

  // Local teardown on a genuine sign-out only. `prevSignedIn` starts null so
  // the very first settle (null -> true or null -> false) never counts as a
  // transition; only an actual true -> false wipes the on-device couple cache.
  const prevSignedIn = React.useRef<boolean | null>(null);
  useEffect(() => {
    if (!authLoaded) return;
    const now = isSignedIn ?? false;
    if (prevSignedIn.current === true && now === false) {
      boot('SIGN_OUT_TRANSITION');
      signOutLocal();
    }
    prevSignedIn.current = now;
  }, [authLoaded, isSignedIn, signOutLocal]);

  if (clerkTimedOut) {
    return (
      <BootBlockedScreen
        title="Loomi can't start"
        message="Couldn't reach the authentication service. Check your connection and reopen the app."
      />
    );
  }

  if (!authLoaded || !fontsLoaded || !booted) return null;

  boot('FIRST_SCREEN');

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaProvider>
        {/* No `backgroundColor` here: the app is edge-to-edge on Android
            (app.json `edgeToEdgeEnabled`), where setting the status-bar
            colour is a no-op and RN logs a warning every render. The bar
            sits over the screen's own background instead. */}
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.surface },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="vault" options={{ animation: 'fade' }} />
          <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        </Stack>
        {/* Auth gating is NOT done here. A <Redirect> mounted at the root
            re-runs its useFocusEffect on every re-render of this component,
            and Clerk auth-state churn during multi-step sign-in / sign-up
            made it fire `router.replace('/(auth)/sign-in')` mid-flow,
            throwing the user off the verification step. Each route group
            guards itself instead: app/(auth)/_layout.tsx and
            app/(tabs)/_layout.tsx. */}
        <ToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
