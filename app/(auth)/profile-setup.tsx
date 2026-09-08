/**
 * BASIC DETAILS — shown once, right after a Clerk session becomes active
 * (email OR Google), when the profile is missing a name or a gender.
 *
 * "Never ask again unnecessarily": the screen forwards straight to
 * link-couple the moment both fields already exist, so a returning user
 * never sees it. Values are written to the Clerk user object
 * (firstName + unsafeMetadata.gender) — self-declared, non-sensitive, and
 * client-writable, so no server round-trip or migration is required for the
 * feature to work end to end. (An optional Supabase `users.gender` column is
 * provided as migration 0004 for later analytics/personalisation.)
 */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/expo';
import { Button, Card, ErrorText, Input } from '../../src/components/primitives';
import { LoomiIllustration } from '../../src/components/illustrations/LoomiIllustration';
import { clerkErrorMessage } from '../../src/auth/clerkError';
import { validateText } from '../../src/domain/validation';
import { useSessionStore } from '../../src/state/session';
import { border, colors, radii, space, type } from '../../src/theme/tokens';

const NEXT_ROUTE = '/(auth)/link-couple' as const;

const GENDERS = [
  { key: 'female', label: 'Female' },
  { key: 'male', label: 'Male' },
  { key: 'other', label: 'Other' },
  { key: 'unspecified', label: 'Prefer not to say' },
] as const;
type GenderKey = (typeof GENDERS)[number]['key'];

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const setSelfFromClerk = useSessionStore((s) => s.setSelfFromClerk);

  const existingGender = (user?.unsafeMetadata?.gender as GenderKey | undefined) ?? undefined;
  const [name, setName] = useState(user?.firstName ?? '');
  const [gender, setGender] = useState<GenderKey | undefined>(existingGender);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Already complete → skip this screen entirely.
  useEffect(() => {
    if (isLoaded && user && user.firstName && user.unsafeMetadata?.gender) {
      router.replace(NEXT_ROUTE);
    }
  }, [isLoaded, user, router]);

  if (!isLoaded || !user) return null;

  const save = async () => {
    setError(null);
    const nameCheck = validateText(name, 'profileName', { fieldName: 'Your name' });
    if (!nameCheck.ok) {
      setError(nameCheck.message);
      return;
    }
    if (!gender) {
      setError('Pick one so we can set up your space.');
      return;
    }
    setSaving(true);
    try {
      await user.update({
        firstName: name.trim(),
        unsafeMetadata: { ...(user.unsafeMetadata ?? {}), gender },
      });
      // Keep the in-memory session identity in step so link-couple / Home
      // render the real name immediately (Clerk's `user.id` is unchanged, so
      // the root layout effect won't re-run on its own).
      setSelfFromClerk({ clerkUserId: user.id, name: name.trim() });
      router.replace(NEXT_ROUTE);
    } catch (e) {
      setError(clerkErrorMessage(e, 'Could not save your details. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <LoomiIllustration asset="welcome-holding-hands" size={140} />
          <Text style={styles.title}>A couple of basics</Text>
          <Text style={styles.subtitle}>Just so Loomi feels like yours. You can change these later in Settings.</Text>
        </View>

        <Card padding="default">
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Input label="Your name" value={name} onChangeText={setName} placeholder="First name" autoComplete="name" />

          <Text style={styles.fieldLabel}>Gender</Text>
          <View style={styles.chips}>
            {GENDERS.map((g) => {
              const selected = gender === g.key;
              return (
                <Pressable
                  key={g.key}
                  onPress={() => setGender(g.key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.chip, selected && styles.chipOn]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextOn]}>{g.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Button
            label={saving ? 'Saving…' : 'Enter Loomi'}
            onPress={save}
            loading={saving}
            disabled={!name.trim() || !gender}
          />
        </Card>
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
  fieldLabel: { ...type.labelMd, color: colors.inkVariant, marginTop: space.sm, marginBottom: space.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginBottom: space.md },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radii.pill,
    borderWidth: border.width,
    borderColor: border.color,
    backgroundColor: colors.cardWhite,
  },
  chipOn: { backgroundColor: colors.primaryContainer },
  chipText: { ...type.labelMd, color: colors.charcoal },
  chipTextOn: { color: colors.charcoal, fontFamily: 'PlusJakartaSans_700Bold' },
});
