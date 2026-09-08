/** SIGN IN — Clerk-backed, built with Loomi's own primitives (not Clerk's web UI). */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSignIn } from '@clerk/expo';
import { Button, Card, ErrorText, Input } from '../../src/components/primitives';
import { LoomiIllustration } from '../../src/components/illustrations/LoomiIllustration';
import { clerkErrorMessage } from '../../src/auth/clerkError';
import { GoogleAuthButton } from '../../src/auth/googleSSO';
import { colors, space, type } from '../../src/theme/tokens';

const POST_AUTH_ROUTE = '/(auth)/link-couple' as const;

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!signIn || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const { error: createError } = await signIn.password({ identifier: email.trim(), password });
      if (createError) {
        setError(clerkErrorMessage(createError));
        return;
      }
      if (signIn.status === 'complete') {
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) {
          setError(clerkErrorMessage(finalizeError));
          return;
        }
        // Leaving the auth stack. The (auth) group layout forwards a
        // signed-in + already-linked user straight to the app; a user with
        // no couple yet lands on link-couple, which is correct.
        router.replace(POST_AUTH_ROUTE);
      } else {
        setError('Additional verification is required for this account.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign in. Check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <LoomiIllustration asset="welcome-holding-hands" size={148} />
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to pick up where you and your person left off.</Text>
        </View>

        <Card padding="default">
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="password"
          />
          <Button label={submitting ? 'Signing in…' : 'Sign in'} onPress={submit} loading={submitting} disabled={!email || !password || !signIn} />
        </Card>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <GoogleAuthButton onSuccess={() => router.replace(POST_AUTH_ROUTE)} />

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>New to Loomi?</Text>
          <Text style={styles.footerLink} onPress={() => router.push('/(auth)/sign-up')}>
            Create an account
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.screenEdge, paddingTop: space['3xl'], flexGrow: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: space.xl, gap: space.xs },
  title: { ...type.headlineLg, color: colors.charcoal, marginTop: space.sm },
  subtitle: { ...type.bodyMd, color: colors.inkVariant, textAlign: 'center', paddingHorizontal: space.lg },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: space.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.outlineVariant },
  dividerText: { ...type.labelMd, color: colors.inkVariant },
  footerRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.lg },
  footerText: { ...type.bodyMd, color: colors.inkVariant },
  footerLink: { ...type.bodyMd, color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' },
});
