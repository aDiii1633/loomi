/**
 * The dev-only auth bypass, in one place so every layout agrees on it.
 *
 * `true` ONLY in a development build (`__DEV__`) that has not opted into the
 * real auth flow via `EXPO_PUBLIC_FORCE_AUTH=1`. A release build always gets
 * `false` here (`__DEV__` is stripped to `false`), so Clerk is the only way
 * in for real users — this can never weaken production auth.
 *
 * When active, the app boots straight into the seeded demo couple
 * (Aditya & Maya) so local development doesn't require a sign-in on every
 * reload.
 */
export function isDevBypass(): boolean {
  return __DEV__ && process.env.EXPO_PUBLIC_FORCE_AUTH !== '1';
}
