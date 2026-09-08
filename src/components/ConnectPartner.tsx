/**
 * The partner-connection flow, shown INSIDE Home for a signed-in user who
 * has no couple yet (Loomi is usable-but-locked until this completes).
 *
 * - Generate an invite -> shows the code, a "Copy code" button, a "Copy link"
 *   button, and Share.
 * - Or paste the partner's code and connect.
 * - Listens for the partner accepting our invite (couple-scoped realtime).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { Button, Card, ErrorText, Input } from './primitives';
import { LoomiIllustration } from './illustrations/LoomiIllustration';
import { toast } from './toast';
import { border, colors, radii, space, type } from '../theme/tokens';
import { getSupabase, isSupabaseConfigured } from '../data/backend/supabaseClient';
import {
  acceptCoupleInvite,
  bootstrapCurrentUser,
  createCouple,
  createCoupleInvite,
} from '../data/backend/couples';
import { useSessionStore } from '../state/session';

function inviteLink(code: string): string {
  return Linking.createURL('link-couple', { queryParams: { code } });
}

export function ConnectPartner({ onConnected }: { onConnected?: () => void }) {
  const params = useLocalSearchParams<{ code?: string }>();
  const refreshCouple = useSessionStore((s) => s.refreshCouple);
  const selfName = useSessionStore((s) => s.self?.name);

  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState<null | 'create' | 'join'>(null);
  const [error, setError] = useState<string | null>(null);
  const [myInvite, setMyInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [connected, setConnected] = useState(false);
  const pendingCoupleId = useRef<string | null>(null);
  const backendReady = isSupabaseConfigured();

  const ensureProfile = async () => {
    await bootstrapCurrentUser(selfName || 'You');
  };

  // Prefill from a shared invite link (twofold://link-couple?code=ABCD1234).
  useEffect(() => {
    const incoming = typeof params.code === 'string' ? params.code.trim().toUpperCase() : '';
    if (incoming) setJoinCode((prev) => prev || incoming);
  }, [params.code]);

  useEffect(() => {
    if (!backendReady) return;
    refreshCouple().catch(() => undefined);
  }, [backendReady, refreshCouple]);

  // Wait for the partner to accept OUR invite.
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
            refreshCouple().finally(() => {
              setConnected(true);
              onConnected?.();
            });
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
    setBusy('create');
    try {
      await ensureProfile();
      const couple = await createCouple();
      const invite = await createCoupleInvite(couple.id);
      pendingCoupleId.current = couple.id;
      setMyInvite({ code: invite.code, expiresAt: invite.expires_at });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create an invite right now.');
    } finally {
      setBusy(null);
    }
  };

  const copyCode = async () => {
    if (!myInvite) return;
    await Clipboard.setStringAsync(myInvite.code);
    toast('Code copied', 'success');
  };

  const copyLink = async () => {
    if (!myInvite) return;
    await Clipboard.setStringAsync(inviteLink(myInvite.code));
    toast('Invite link copied', 'success');
  };

  const shareInvite = async () => {
    if (!myInvite) return;
    try {
      await Share.share({
        message:
          `Join me on Loomi 💛\n\nInvite code: ${myInvite.code}\n` +
          `Open the app, sign up, and paste the code — or tap:\n${inviteLink(myInvite.code)}`,
      });
    } catch {
      /* dismissed */
    }
  };

  const handleJoin = async () => {
    const raw = joinCode.trim();
    if (!raw) return;
    setError(null);
    setBusy('join');
    try {
      await ensureProfile();
      await acceptCoupleInvite(raw.toUpperCase());
      await refreshCouple();
      setConnected(true);
      onConnected?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That code did not work — check it and try again.');
    } finally {
      setBusy(null);
    }
  };

  if (connected) {
    return (
      <View style={styles.wrap}>
        <View style={styles.hero}>
          <LoomiIllustration asset="celebrate-jumping" size={172} />
          <Text style={styles.title}>You&apos;re connected! ❤️</Text>
          <Text style={styles.subtitle}>Your shared space is unlocked.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <LoomiIllustration asset="invite-pao-invites-ly" size={132} />
        <Text style={styles.title}>Connect with your person</Text>
        <Text style={styles.subtitle}>
          Loomi is built for two. Everything unlocks the moment you&apos;re linked.
        </Text>
      </View>

      {!backendReady ? (
        <Card padding="default" tone="yellow">
          <Text style={{ ...type.labelLg, color: colors.charcoal }}>Not connected to the backend</Text>
          <Text style={{ ...type.bodySm, color: colors.inkVariant, marginTop: 4 }}>
            Partner linking needs the backend configured.
          </Text>
        </Card>
      ) : (
        <>
          {error ? <ErrorText>{error}</ErrorText> : null}

          <Card padding="default" style={{ marginTop: space.md }}>
            <Text style={{ ...type.labelLg, color: colors.charcoal }}>Invite your person</Text>
            {myInvite ? (
              <>
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{myInvite.code}</Text>
                </View>
                <Text style={{ ...type.bodySm, color: colors.inkVariant, marginBottom: space.sm }}>
                  Expires {new Date(myInvite.expiresAt).toLocaleDateString()} · one-time use.
                </Text>
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <Button label="Copy code" variant="secondary" icon="copy" onPress={copyCode} style={{ flex: 1 }} />
                  <Button label="Copy link" variant="secondary" icon="link" onPress={copyLink} style={{ flex: 1 }} />
                </View>
                <Button label="Share invite" icon="send" onPress={shareInvite} style={{ marginTop: space.sm }} />
              </>
            ) : (
              <Button
                label={busy === 'create' ? 'Creating…' : 'Generate invite code'}
                onPress={handleCreateInvite}
                loading={busy === 'create'}
                style={{ marginTop: space.sm }}
              />
            )}
          </Card>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Card padding="default">
            <Text style={{ ...type.labelLg, color: colors.charcoal }}>Have their code?</Text>
            <Input
              label="Invite code"
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              placeholder="ABCD1234"
              autoCapitalize="characters"
            />
            <Button
              label={busy === 'join' ? 'Connecting…' : 'Connect'}
              onPress={handleJoin}
              loading={busy === 'join'}
              disabled={!joinCode.trim()}
            />
          </Card>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.screenEdge, paddingTop: space.lg },
  hero: { alignItems: 'center', marginBottom: space.md, gap: space.xs },
  title: { ...type.headlineLg, color: colors.charcoal, marginTop: space.sm, textAlign: 'center' },
  subtitle: { ...type.bodyMd, color: colors.inkVariant, textAlign: 'center', paddingHorizontal: space.md },
  codeBox: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: colors.lightMint,
    borderRadius: radii.lg,
    borderWidth: border.width,
    borderColor: border.color,
    paddingVertical: space.md,
    marginTop: space.sm,
    marginBottom: space.xs,
  },
  codeText: { ...type.displayLgMobile, color: colors.charcoal, letterSpacing: 6 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: space.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.outlineVariant },
  dividerText: { ...type.labelMd, color: colors.inkVariant },
});
