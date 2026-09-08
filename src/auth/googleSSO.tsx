/**
 * "Continue with Google" — a REAL Clerk OAuth flow for Expo.
 *
 * Uses the current, non-deprecated `useSSO()` hook from `@clerk/expo`
 * (`useOAuth` is deprecated; no JWT-template / accessToken-template code is
 * involved). The Clerk *publishable* key is the only Clerk credential in the
 * app — no secret key is referenced here or anywhere in the client.
 *
 * REQUIRES EXTERNAL CONFIGURATION (cannot be done from code):
 *   1. Clerk Dashboard → SSO Connections → enable Google (either Clerk's
 *      shared dev credentials, or a Google Cloud OAuth client for prod).
 *   2. Google Cloud console → Authorized redirect URI must include the
 *      Clerk frontend API callback Clerk shows in that dialog.
 * Until (1) is done the button will surface a Clerk error like
 * "oauth_google is not enabled" — it is wired correctly, just not turned on.
 */
import React, { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useSSO } from '@clerk/expo';
import { Button } from '../components/primitives';
import { toast } from '../components/toast';
import { clerkErrorMessage } from './clerkError';

// Dismisses the web browser when the auth flow redirects back to the app.
// Safe to call at module scope; required by expo-web-browser for OAuth.
WebBrowser.maybeCompleteAuthSession();

/** Android performs noticeably better if the Custom Tab is warmed up before
 * the user taps. Cools down on unmount so we don't hold the tab process. */
function useWarmUpBrowser(): void {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

export function GoogleAuthButton({
  onSuccess,
  label = 'Continue with Google',
}: {
  /** Called once the Clerk session is active. Navigate from here. */
  onSuccess: () => void;
  label?: string;
}) {
  useWarmUpBrowser();
  const { startSSOFlow } = useSSO();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { createdSessionId, setActive, authSessionResult } = await startSSOFlow({
        strategy: 'oauth_google',
        // Deep link back into the app after the browser round-trip. On a
        // standalone build this is twofold://sso-callback; Expo Go uses its
        // own proxy URL automatically.
        redirectUrl: Linking.createURL('sso-callback'),
      });

      // User closed the browser without finishing — not an error.
      if (authSessionResult?.type === 'cancel' || authSessionResult?.type === 'dismiss') {
        return;
      }

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        onSuccess();
        return;
      }

      // A session wasn't created and the flow wasn't cancelled: the account
      // needs another step (e.g. MFA) that this minimal flow doesn't drive.
      toast('Could not finish Google sign-in. Try email instead.', 'error');
    } catch (e) {
      toast(clerkErrorMessage(e, 'Google sign-in failed. Please try again.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      label={busy ? 'Opening Google…' : label}
      variant="secondary"
      icon="mail"
      onPress={onPress}
      loading={busy}
    />
  );
}
