/** SIGN UP — Clerk-backed with mandatory email verification before session activation. */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSignUp } from '@clerk/expo';
import { Button, Card, ErrorText, Input } from '../../src/components/primitives';
import { LoomiIllustration } from '../../src/components/illustrations/LoomiIllustration';
import { clerkErrorMessage } from '../../src/auth/clerkError';
import { MIN_PASSWORD_LENGTH, validatePassword } from '../../src/domain/validation';
import { colors, space, type } from '../../src/theme/tokens';

/** After the Clerk session is live, leave the auth stack. The (auth) group
 * layout forwards signed-in + already-linked users straight to the app; a
 * brand-new account lands on link-couple, which is exactly right. */
const POST_AUTH_ROUTE = '/(auth)/link-couple' as const;

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useSignUp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const finishSignedIn = async () => {
    const { error: finalizeError } = await signUp!.finalize();
    if (finalizeError) {
      setError(clerkErrorMessage(finalizeError));
      return;
    }
    router.replace(POST_AUTH_ROUTE);
  };

  const submitSignUp = async () => {
    if (!signUp || submitting) return;
    setError(null);
    const pw = validatePassword(password);
    if (!pw.ok) {
      setError(pw.message);
      return;
    }
    setSubmitting(true);
    try {
      const { error: passwordError } = await signUp.password({
        emailAddress: email.trim(),
        password,
        firstName: name.trim() || undefined,
      });
      if (passwordError) {
        setError(clerkErrorMessage(passwordError));
        return;
      }
      // Some Clerk instances don't require email verification — the sign-up
      // is already done and we can finalize straight away.
      if (signUp.status === 'complete') {
        await finishSignedIn();
        return;
      }
      const { error: sendError } = await signUp.verifications.sendEmailCode();
      if (sendError) {
        setError(clerkErrorMessage(sendError));
        return;
      }
      setPendingVerification(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const submitVerification = async () => {
    if (!signUp || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (verifyError) {
        setError(clerkErrorMessage(verifyError));
        return;
      }
      if (signUp.status === 'complete') {
        await finishSignedIn();
      } else {
        setError('That code did not complete verification. Double-check and try again.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That verification code is invalid or expired.');
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingVerification) {
    return (
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <LoomiIllustration asset="welcome-holding-hands" size={148} />
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.subtitle}>We sent a verification code to {email}. Enter it below.</Text>
          </View>
          <Card padding="default">
            {error ? <ErrorText>{error}</ErrorText> : null}
            <Input
              label="Verification code"
              value={code}
              onChangeText={setCode}
              placeholder="123456"
              keyboardType="number-pad"
              autoComplete="one-time-code"
            />
            <Button label={submitting ? 'Verifying…' : 'Verify and continue'} onPress={submitVerification} loading={submitting} disabled={!code || !signUp} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <LoomiIllustration asset="welcome-holding-hands" size={148} />
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>One account, then invite your person to link up.</Text>
        </View>

        <Card padding="default">
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Input label="Your name" value={name} onChangeText={setName} placeholder="Aditya" autoComplete="name" />
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
            placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
            secureTextEntry
            autoComplete="new-password"
          />
          <Button label={submitting ? 'Creating account…' : 'Create account'} onPress={submitSignUp} loading={submitting} disabled={!email || password.length < MIN_PASSWORD_LENGTH || !signUp} />
        </Card>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <Text style={styles.footerLink} onPress={() => router.push('/(auth)/sign-in')}>
            Sign in
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
  footerRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.lg },
  footerText: { ...type.bodyMd, color: colors.inkVariant },
  footerLink: { ...type.bodyMd, color: colors.primary, fontFamily: 'PlusJakartaSans_700Bold' },
});
