import React from 'react';
import { Redirect, Stack } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { colors } from '../../src/theme/tokens';

/**
 * Auth group guard. A signed-in user who is ALSO linked to a couple has no
 * business in this group — send them to the app. A signed-in user with no
 * couple stays here (the link-couple screen lives in this group). Everyone
 * else (signed out) stays here too.
 *
 * The redirect only ever fires on the stable "fully onboarded" condition, so
 * it cannot fight the multi-step sign-in / sign-up flow the way a root-level
 * redirect did.
 */
export default function AuthLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  // Enter the app as soon as the account has a name + gender. Connecting a
  // partner is NOT a gate any more — it happens inside Home, with every other
  // feature shown locked until it's done. profile-setup still renders here
  // while those fields are missing (sign-in / sign-up route to it first).
  const profileComplete = !!user?.firstName && !!user?.unsafeMetadata?.gender;
  if (isLoaded && isSignedIn && profileComplete) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
        animation: 'fade',
      }}
    >
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="link-couple" />
    </Stack>
  );
}
