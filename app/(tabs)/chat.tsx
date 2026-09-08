/** CHAT — one-to-one conversation: text, media, voice notes, reactions. */
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Avatar } from '../../src/components/primitives';
import { LoomiIllustration } from '../../src/components/illustrations/LoomiIllustration';
import { Icon } from '../../src/components/Icon';
import { ImageViewer } from '../../src/components/ImageViewer';
import { VoicePlayer, VoiceRecorder } from '../../src/components/voice';
import { captureMedia, pickMedia } from '../../src/components/mediaPicker';
import { toast } from '../../src/components/toast';
import { colors, radii, space, type, border, elevation } from '../../src/theme/tokens';
import { useSessionStore } from '../../src/state/session';
import { useChatStore } from '../../src/state/chat';
import { ensureLocalMedia } from '../../src/data/backend/mediaStorage';
import { formatTime } from '../../src/domain/datetime';
import type { Message } from '../../src/domain/types';

const REACTIONS = ['❤️', '😂', '🌿', '✨', '🥰'];

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const self = useSessionStore((s) => s.self);
  const partner = useSessionStore((s) => s.partner);
  const { messages, loading, error, sending, refresh, sendText, sendMedia, sendVoice, react, remove } = useChatStore();
  const [draft, setDraft] = useState('');
  const [recording, setRecording] = useState(false);
  const [reactionFor, setReactionFor] = useState<string | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const activeMessage = reactionFor ? messages.find((m) => m.id === reactionFor) ?? null : null;

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live partner messages arrive via the couple-scoped Realtime channel in
  // app/(tabs)/_layout.tsx, which pulls the `messages` table and calls
  // useChatStore.refresh() — this screen re-renders from that store, so no
  // separate subscription is needed here (one channel per couple).

  // On an `inverted` list the newest row is index 0 and sits at the visual
  // bottom, so revealing a just-sent message means scrolling to offset 0 —
  // NOT scrollToEnd(), which on an inverted list jumps to the OLDEST message
  // and is what made the conversation appear to "move upward" on send.
  const scrollToLatest = () => listRef.current?.scrollToOffset({ offset: 0, animated: true });

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    sendText(text).then(scrollToLatest).catch(() => setDraft(text));
  };

  if (!self || !partner) return null;

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.screenEdge, paddingBottom: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Avatar name={partner.name} size={36} />
        <Text style={{ ...type.headlineSm, color: colors.charcoal }}>{partner.name}</Text>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {error ? (
          <View style={styles.errorBox}>
            <Icon name="alert" size={16} color={colors.error} />
            <Text style={{ ...type.bodySm, color: colors.error, flex: 1 }}>{error}</Text>
            <Pressable onPress={refresh}><Text style={{ ...type.labelMd, color: colors.primary }}>Retry</Text></Pressable>
          </View>
        ) : null}
        <FlatList
          ref={listRef}
          data={messages}
          inverted={messages.length > 0}
          keyExtractor={(m) => m.id}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.emptyWrap}>
                <LoomiIllustration asset="chat-sitting-together" size={140} style={{ marginBottom: space.sm }} />
                <Text style={{ ...type.bodyMd, color: colors.inkVariant, textAlign: 'center' }}>
                  Say something lovely first — it starts here.
                </Text>
              </View>
            )
          }
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              selfId={self.id}
              partnerName={partner.name}
              onLongPress={() => setReactionFor(item.id)}
              onOpenImage={setViewerUri}
              onToggleReaction={(emoji) => {
                react(item.id, emoji);
                setReactionFor(null);
              }}
            />
          )}
          contentContainerStyle={{
            paddingHorizontal: space.screenEdge,
            paddingBottom: space.sm,
            flexGrow: 1,
            // Inverted space is visually flipped: 'flex-start' here pins a
            // short conversation to the on-screen bottom. When not inverted
            // (empty state) center the illustration instead.
            justifyContent: messages.length > 0 ? 'flex-start' : 'center',
          }}
        />

        {reactionFor ? (
          <View style={styles.reactionBar}>
            {REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => {
                  react(reactionFor, emoji);
                  setReactionFor(null);
                }}
                style={styles.reactionChip}
                accessibilityRole="button"
              >
                <Text style={{ fontSize: 20 }}>{emoji}</Text>
              </Pressable>
            ))}
            {activeMessage?.kind === 'text' && activeMessage.text ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Copy message"
                onPress={() => {
                  void Clipboard.setStringAsync(activeMessage.text ?? '');
                  setReactionFor(null);
                  toast('Copied', 'success');
                }}
                style={styles.reactionChip}
              >
                <Icon name="copy" size={18} color={colors.charcoal} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Delete message"
              onPress={() => {
                const id = reactionFor;
                setReactionFor(null);
                Alert.alert('Delete message?', 'This removes it for you.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => remove(id) },
                ]);
              }}
              style={styles.reactionChip}
            >
              <Icon name="trash2" size={18} color={colors.error} />
            </Pressable>
            <Pressable onPress={() => setReactionFor(null)} style={styles.reactionChip} accessibilityRole="button">
              <Icon name="close" size={18} color={colors.inkVariant} />
            </Pressable>
          </View>
        ) : null}

        <View style={[styles.composer, { paddingBottom: insets.bottom + space.dockHeight + space.md }]}>
          {recording ? (
            <VoiceRecorder
              onCancel={() => setRecording(false)}
              onFinished={(result) => {
                setRecording(false);
                if (result) sendVoice(result).catch(() => undefined);
              }}
            />
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add photo or video"
                onPress={async () => {
                  const picked = await pickMedia();
                  for (const m of picked) await sendMedia(m);
                }}
                style={styles.composeBtn}
              >
                <Icon name="image" size={20} color={colors.charcoal} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Take a photo"
                onPress={async () => {
                  const picked = await captureMedia();
                  if (picked) await sendMedia(picked);
                }}
                style={styles.composeBtn}
              >
                <Icon name="camera" size={20} color={colors.charcoal} />
              </Pressable>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={`Message ${partner.name}…`}
                placeholderTextColor={colors.outlineVariant}
                multiline
                style={styles.input}
              />
              {draft.trim() ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={send} style={[styles.sendBtn, sending && { opacity: 0.6 }]}>
                  <Icon name="send" size={18} color={colors.charcoal} />
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Record voice note"
                  onPress={() => setRecording(true)}
                  style={styles.micBtn}
                >
                  <Icon name="mic" size={18} color={colors.primary} />
                </Pressable>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      <ImageViewer uri={viewerUri} visible={!!viewerUri} onClose={() => setViewerUri(null)} />
    </View>
  );
}

/** Sent/pending/failed marker on the user's own messages, derived from the
 * row's local sync state (no extra network call). */
function DeliveryTick({ state }: { state: Message['sync'] }) {
  if (state === 'failed') return <Icon name="alert" size={11} color={colors.error} />;
  if (state === 'synced') return <Icon name="check" size={11} color="rgba(37,37,37,0.55)" />;
  return <Icon name="clock" size={11} color="rgba(37,37,37,0.4)" />;
}

function MessageBubble({
  message,
  selfId,
  partnerName,
  onLongPress,
  onOpenImage,
  onToggleReaction,
}: {
  message: Message;
  selfId: string;
  partnerName: string;
  onLongPress: () => void;
  onOpenImage: (uri: string) => void;
  onToggleReaction: (emoji: string) => void;
}) {
  const mine = message.authorId === selfId;
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [waveform, setWaveform] = useState<number[] | null>(message.waveform ?? null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (message.kind === 'voice' && !waveform && message.mediaId) {
        const { loadWaveform } = await import('../../src/data/media');
        const wf = await loadWaveform(message.mediaId);
        if (!cancelled) setWaveform(wf);
      }
      if ((message.kind === 'image' || message.kind === 'video') && message.mediaId) {
        // Resolves from the local cache, or downloads the partner's upload
        // from Storage on first view.
        const uri = await ensureLocalMedia(message.mediaId);
        if (!cancelled && uri) setMediaUri(uri);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [message, waveform]);

  const reactionEntries = Object.entries(message.reactions ?? {});

  return (
    <View style={[styles.bubbleRow, mine && { justifyContent: 'flex-end' }]}>
      {!mine ? (
        <View style={{ marginRight: space.xs, alignSelf: 'flex-end' }}>
          <Avatar name={partnerName} size={28} />
        </View>
      ) : null}
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={280}
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
          message.kind === 'image' || message.kind === 'video' ? { padding: 4 } : null,
        ]}
      >
        {message.kind === 'text' ? (
          <Text style={{ ...type.bodyMd, color: colors.ink }}>{message.text}</Text>
        ) : null}
        {message.kind === 'image' && mediaUri ? (
          <Pressable
            onPress={() => onOpenImage(mediaUri)}
            onLongPress={onLongPress}
            delayLongPress={280}
            accessibilityRole="imagebutton"
            accessibilityLabel="Open image full screen"
          >
            <Image source={{ uri: mediaUri }} style={{ width: 220, height: 220, borderRadius: radii.md }} contentFit="cover" transition={200} />
          </Pressable>
        ) : null}
        {message.kind === 'video' && mediaUri ? <VideoBubble uri={mediaUri} /> : null}
        {message.kind === 'voice' && message.mediaId ? (
          <View style={{ width: 210 }}>
            <VoiceBubble mediaId={message.mediaId} durationMs={message.durationMs} waveform={waveform} mine={mine} />
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={[styles.time, mine && { color: 'rgba(37,37,37,0.55)' }]}>{formatTime(message.sentAt)}</Text>
          {mine ? <DeliveryTick state={message.sync} /> : null}
        </View>
        {reactionEntries.length > 0 ? (
          <View style={styles.reactionSummary}>
            {reactionEntries.map(([emoji, users]) => (
              <Pressable key={emoji} onPress={() => onToggleReaction(emoji)}>
                <Text style={{ fontSize: 12 }}>
                  {emoji} {users.length}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function VideoBubble({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  return (
    <View style={{ borderRadius: radii.md, overflow: 'hidden' }}>
      <VideoView
        player={player}
        style={{ width: 220, height: 220 }}
        contentFit="cover"
        allowsFullscreen
      />
    </View>
  );
}

function VoiceBubble({ mediaId, durationMs, waveform, mine }: { mediaId: string; durationMs?: number; waveform: number[] | null; mine: boolean }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    ensureLocalMedia(mediaId).then((u) => {
      if (!cancelled && u) setUri(u);
    });
    return () => {
      cancelled = true;
    };
  }, [mediaId]);
  if (!uri) {
    return (
      <View style={{ paddingVertical: space.sm }}>
        <Text style={{ ...type.bodySm, color: colors.inkVariant }}>Voice note…</Text>
      </View>
    );
  }
  return <VoicePlayer uri={uri} durationMs={durationMs} waveform={waveform} mine={mine} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginHorizontal: space.screenEdge,
    marginBottom: space.sm,
    backgroundColor: colors.errorContainer,
    borderRadius: radii.md,
    padding: space.sm,
  },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space['2xl'] },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 4 },
  bubble: {
    maxWidth: '78%',
    borderRadius: radii.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.cardWhite,
    borderWidth: border.width,
    borderColor: border.color,
    ...elevation.badge,
  },
  bubbleMine: { borderBottomRightRadius: radii.sm, backgroundColor: colors.primaryContainer, borderColor: border.color },
  bubbleTheirs: { borderBottomLeftRadius: radii.sm, backgroundColor: colors.card },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: 4 },
  time: { ...type.labelCaps, color: colors.outlineVariant, fontSize: 9 },
  reactionSummary: { flexDirection: 'row', gap: 6, marginTop: 2 },
  reactionBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    backgroundColor: colors.cardWhite,
    marginHorizontal: space.screenEdge,
    borderRadius: radii.pill,
    borderWidth: border.width,
    borderColor: border.color,
    ...elevation.card,
    marginBottom: space.xs,
  },
  reactionChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
  composer: {
    paddingHorizontal: space.screenEdge,
    paddingTop: space.sm,
    gap: space.xs,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
  },
  composeBtn: {
    width: 44,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.cardWhite,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.badge,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    backgroundColor: colors.cardWhite,
    borderRadius: radii.pill,
    borderWidth: border.width,
    borderColor: border.color,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: colors.charcoal,
    ...type.bodyMd,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryContainer,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.badge,
  },
  micBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.tertiaryFixed,
    borderWidth: border.width,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.badge,
  },
});
