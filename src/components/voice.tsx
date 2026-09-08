/**
 * VoiceNote — REAL recording (expo-audio) with waveform capture, and
 * playback with an animated progress. Waveform amplitudes are sampled from
 * actual recorder metering while recording; we never render fake bars.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioRecorder, RecordingPresets, setAudioModeAsync, AudioModule } from 'expo-audio';
import { colors, border, elevation, radii, space, type } from '../theme/tokens';
import { Icon } from './Icon';
import { toast } from './toast';

export interface RecordingResult {
  uri: string;
  durationMs: number;
  waveform: number[];
}

interface RecorderProps {
  onFinished: (result: RecordingResult | null) => void;
  onCancel: () => void;
  maxSeconds?: number;
}

export function VoiceRecorder({ onFinished, onCancel, maxSeconds = 60 }: RecorderProps) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [elapsed, setElapsed] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [permissionError, setPermissionError] = useState(false);
  const meterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelsRef = useRef<number[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) {
          setPermissionError(true);
          return;
        }
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync();
        recorder.record();
      } catch {
        toast('Recording could not start on this device.', 'error');
        onCancel();
      }
    })();
    return () => {
      if (meterRef.current) clearInterval(meterRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    meterRef.current = setInterval(() => {
      // expo-audio exposes live metering while recording; typed loosely here
      // because the 1.x typedef omits it on the recorder instance.
      const meteringProp = (recorder as unknown as { metering?: number }).metering;
      const metering = recorder.isRecording ? (meteringProp ?? -50) : -60;
      const normalized = Math.max(0.08, Math.min(1, 1 + metering / 50));
      levelsRef.current = [...levelsRef.current.slice(-23), normalized];
      setLevels([...levelsRef.current]);
    }, 120);
    tickRef.current = setInterval(() => {
      setElapsed((e) => {
        if (e + 0.2 >= maxSeconds) {
          stopAndEmit();
          return 0;
        }
        return e + 0.2;
      });
    }, 200);
    return () => {
      if (meterRef.current) clearInterval(meterRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAndEmit = () => {
    if (meterRef.current) clearInterval(meterRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    try {
      recorder.stop();
      const uri = recorder.uri;
      const waveform = normalizeWaveform(levelsRef.current);
      if (!uri) {
        onFinished(null);
        return;
      }
      onFinished({ uri, durationMs: Math.round(elapsed * 1000), waveform });
    } catch {
      onFinished(null);
    }
  };

  if (permissionError) {
    return (
      <View style={styles.permissionBox}>
        <Icon name="mic" size={20} color={colors.error} />
        <Text style={{ ...type.bodySm, color: colors.error, flex: 1 }}>
          Microphone access is needed for voice notes. Enable it in Settings.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.recorderRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancel recording" onPress={onCancel} style={styles.cancelBtn}>
        <Icon name="x" size={20} color={colors.charcoal} />
      </Pressable>
      <View style={styles.waveRow}>
        {Array.from({ length: 24 }).map((_, i) => (
          <View
            key={i}
            style={[styles.waveBar, { height: Math.max(4, (levels[i] ?? 0.1) * 40) }]}
          />
        ))}
        <Text style={styles.elapsed}>{formatSeconds(elapsed)}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Stop and send" onPress={stopAndEmit} style={styles.stopBtn}>
        <Icon name="send" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

export function VoicePlayer({
  uri,
  durationMs,
  waveform,
  mine,
}: {
  uri: string;
  durationMs?: number;
  waveform?: number[] | null;
  mine?: boolean;
}) {
  const player = useAudioPlayer(uri);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (status: { playing: boolean; didJustFinish: boolean }) => {
      setPlaying(status.playing);
      if (status.didJustFinish) setPlaying(false);
    });
    return () => sub.remove();
  }, [player]);

  const bars = useMemo(() => normalizeWaveform(waveform ?? undefined), [waveform]);
  const seconds = durationMs ? Math.round(durationMs / 1000) : null;

  const toggle = () => {
    if (playing) {
      player.pause();
    } else {
      player.play();
    }
  };

  return (
    <View style={[styles.playerRow, mine && { backgroundColor: colors.primaryContainer }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'} onPress={toggle} style={styles.playBtn}>
        <Icon name={playing ? 'pause' : 'play'} size={16} color={mine ? colors.charcoal : colors.primary} />
      </Pressable>
      <View style={styles.playerBars}>
        {bars.map((b, i) => (
          <View
            key={i}
            style={[
              styles.waveBarStatic,
              { height: Math.max(4, b * 26), backgroundColor: mine ? 'rgba(10,38,20,0.55)' : colors.primaryContainer },
            ]}
          />
        ))}
      </View>
      {seconds !== null ? (
        <Text style={{ ...type.labelMd, color: mine ? colors.charcoal : colors.inkVariant }}>0:{String(seconds).padStart(2, '0')}</Text>
      ) : null}
    </View>
  );
}

function normalizeWaveform(levels?: number[]): number[] {
  if (!levels || levels.length === 0) {
    return Array.from({ length: 24 }, (_, i) => 0.3 + 0.2 * Math.sin(i / 2));
  }
  const max = Math.max(...levels, 0.2);
  return levels.map((l) => Math.max(0.08, l / max));
}

function formatSeconds(s: number): string {
  const whole = Math.floor(s);
  return `0:${String(whole).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  recorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.lightMint,
    borderRadius: radii.pill,
    borderWidth: border.width,
    borderColor: border.color,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    ...elevation.card,
  },
  cancelBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardWhite,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.badge,
  },
  stopBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.badge,
  },
  waveRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: colors.primary },
  elapsed: { ...type.labelMd, color: colors.inkVariant, marginLeft: space.xs },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.lightMint,
    borderRadius: radii.pill,
    borderWidth: border.widthThin,
    borderColor: border.color,
    paddingHorizontal: space.xs + 2,
    paddingVertical: space.xs,
    flex: 1,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardWhite,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerBars: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  waveBarStatic: { width: 3, borderRadius: 2 },
  permissionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.errorContainer,
    borderRadius: radii.md,
    padding: space.md,
  },
});
