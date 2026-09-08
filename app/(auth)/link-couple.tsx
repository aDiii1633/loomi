/**
 * Shown to an authenticated Clerk user who has no linked couple yet.
 * Deliberately does NOT fabricate a partner/couple — per the architecture
 * decision, a signed-in user with no couple sees an honest state, not a
 * silently-injected demo identity (that was the whole bug we fixed earlier).
 */
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useClerk } from '@clerk/expo';
import { Button, Card, ErrorText, Input } from '../../src/components/primitives';
import { toast } from '../../src/components/toast';
import { LoomiIllustration } from '../../src/components/illustrations/LoomiIllustration';
import { colors, space, type } from '../../src/theme/tokens';
import { getSupabase, isSupabaseConfigured } from '../../src/data/backend/supabaseClient';
import {
  acceptCoupleInvite,
  bootstrapCurrentUser,
  createCouple,
  createCoupleInvite,
} from '../../src/data/backend/couples';
import { useSessionStore } from '../../src/state/session';

export default function LinkCoupleScreen() {
  const { signOut } = useClerk();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const refreshCouple = useSessionStore((s) => s.refreshCouple);
  const selfName = useSessionStore((s) => s.self?.name);

  /** Guarantees the caller's public.users row exists before any couple RPC
   * (create_couple / accept_couple_invite raise "no profile yet" otherwise).
   * The row is normally created by the root layout's background couple
   * lookup, but a fast tap can beat it — so every action re-runs this
   * idempotent bootstrap first. */
  const ensureProfile = async () => {
    await bootstrapCurrentUser(selfName || 'You');
  };
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myInvite, setMyInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [connected, setConnected] = useState(false);
  const pendingCoupleId = useRef<string | null>(null);

  const backendReady = isSupabaseConfigured();

  // Prefill the join field when the app was opened from a shared invite link
  // (twofold://link-couple?code=ABCD1234). Runs once when a code is present.
  useEffect(() => {
    const incoming = typeof params.code === 'string' ? params.code.trim().toUpperCase() : '';
    if (incoming) setJoinCode((prev) => prev || incoming);
  }, [params.code]);

  const copyCode = async () => {
    if (!myInvite) return;
    await Clipboard.setStringAsync(myInvite.code);
    toast('Invite code copied', 'success');
  };

  const shareInvite = async () => {
    if (!myInvite) return;
    // A real deep link into this screen with the code prefilled. On a
    // standalone build this resolves to twofold://link-couple?code=...;
    // the plain code in the text is the always-works fallback.
    const link = Linking.createURL('link-couple', { queryParams: { code: myInvite.code } });
    try {
      await Share.share({
        message:
          `Join me on Loomi 💛\n\nInvite code: ${myInvite.code}\n` +
          `Open the app, sign up, and paste the code to link our space.\n${link}`,
      });
    } catch {
      // User dismissed the share sheet — not an error.
    }
  };

  // Make sure the caller's public.users row exists before any RPC that needs
  // it (create_couple raises "no profile yet" otherwise). Idempotent.
  useEffect(() => {
    if (!backendReady) return;
    refreshCouple().catch(() => undefined);
  }, [backendReady, refreshCouple]);

  // While waiting on our own invite, listen for the partner accepting it.
  // Realtime respects the same couples_select_member RLS policy as any
  // other read, so this cannot observe another couple's row.
  useEffect(() => {
    if (!myInvite || !pendingCoupleId.current || !backendReady) return;
    const coupleId = pendingCoupleId.current;
    const channel = getSupabase()
      .channel(`couple-link:${coupleId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'couples', filter: `id=eq.${coupleId}` },
        (payload) => {
          if ((payload.new as { status?: string })?.status === 'active') {
            // Pull the full real snapshot (partner profile included) the
            // moment the backend confirms the couple is active.
            refreshCouple()
              .then(() => setConnected(true))
              .catch(() => setConnected(true));
          }
        }
      )
      .subscribe();
    return () => {
      getSupabase().removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myInvite, backendReady]);

  const handleCreateInvite = async () => {
    setError(null);
    setBusy(true);
    try {
      await ensureProfile();
      const couple = await createCouple();
      const invite = await createCoupleInvite(couple.id);
      pendingCoupleId.current = couple.id;
      setMyInvite({ code: invite.code, expiresAt: invite.expires_at });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create an invite right now.');
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    const raw = joinCode.trim();
    if (!raw) return;
    setError(null);
    setBusy(true);
    try {
      await ensureProfile();
      await acceptCoupleInvite(raw.toUpperCase());
      // Load the real couple + partner profile into the session before
      // leaving this screen, so Home renders actual data, not placeholders.
      await refreshCouple();
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code did not work — check it and try again.');
    } finally {
      setBusy(false);
    }
  };

  if (connected) {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <LoomiIllustration asset="celebrate-jumping" size={180} />
            <Text style={styles.title}>You&apos;re connected! ❤️</Text>
            <Text style={styles.subtitle}>Your little world starts here.</Text>
          </View>
          <Button label="Continue" onPress={() => router.replace('/(tabs)')} style={{ marginTop: space.lg }} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <LoomiIllustration asset="invite-pao-invites-ly" size={140} />
          <Text style={styles.title}>You&apos;re signed in!</Text>
          <Text style={styles.subtitle}>
            Loomi is built for two. Create an invite for your person, or enter the code they sent you.
          </Text>
        </View>

        {!backendReady ? (
          <Card padding="default" tone="yellow">
            <Text style={{ ...type.labelLg, color: colors.charcoal }}>Partner linking isn&apos;t connected yet</Text>
            <Text style={{ ...type.bodySm, color: colors.inkVariant, marginTop: 4 }}>
              The backend that links two accounts into a couple hasn&apos;t been deployed yet. This is not a bug — it&apos;s
              being built. Nothing fake is shown here in the meantime.
            </Text>
          </Card>
        ) : (
          <>
            {error ? <ErrorText>{error}</ErrorText> : null}

            <Card padding="default" style={{ marginTop: space.md }}>
              <Text style={{ ...type.labelLg, color: colors.charcoal }}>Invite your person</Text>
              {myInvite ? (
                <>
                  <Text style={styles.codeText}>{myInvite.code}</Text>
                  <Text style={{ ...type.bodySm, color: colors.inkVariant }}>
                    Expires {new Date(myInvite.expiresAt).toLocaleString()} · one-time use.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
                    <Button label="Copy code" variant="secondary" onPress={copyCode} style={{ flex: 1 }} />
                    <Button label="Share invite" onPress={shareInvite} style={{ flex: 1 }} />
                  </View>
                </>
              ) : (
                <Button label={busy ? 'Creating…' : 'Generate invite code'} onPress={handleCreateInvite} loading={busy} style={{ marginTop: space.sm }} />
              )}
            </Card>

            <Card padding="default" style={{ marginTop: space.md }}>
              <Text style={{ ...type.labelLg, color: colors.charcoal }}>Have a code already?</Text>
              <Input label="Invite code" value={joinCode} onChangeText={setJoinCode} placeholder="ABCD1234" autoCapitalize="characters" />
              <Button label={busy ? 'Joining…' : 'Join couple'} onPress={handleJoin} loading={busy} disabled={!joinCode.trim()} />
            </Card>
          </>
        )}

        <Button label="Sign out" variant="ghost" onPress={() => signOut()} style={{ marginTop: space.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.screenEdge, paddingTop: space['3xl'] },
  hero: { alignItems: 'center', marginBottom: space.lg, gap: space.xs },
  title: { ...type.headlineLg, color: colors.charcoal, marginTop: space.sm },
  subtitle: { ...type.bodyMd, color: colors.inkVariant, textAlign: 'center', paddingHorizontal: space.md },
  codeText: { ...type.displayLgMobile, color: colors.charcoal, letterSpacing: 4, marginTop: space.sm },
});
