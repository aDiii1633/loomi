/** DAILY QUESTION — illustration-led, clear progress stages, animated reveal. */
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, EmptyState, ErrorText, Input, SkeletonCard } from '../src/components/primitives';
import { SubHeader } from '../src/components/chrome';
import { Mascot } from '../src/components/illustrations/Mascot';
import { FadeSlideIn } from '../src/components/motion/FadeSlideIn';
import { Icon } from '../src/components/Icon';
import { colors, border, elevation, space, type } from '../src/theme/tokens';
import { useConnectionStore } from '../src/state/connection';
import { useSessionStore } from '../src/state/session';
import { formatDayLabel } from '../src/domain/datetime';
import { validateText } from '../src/domain/validation';
import { toast } from '../src/components/toast';
import { haptic } from '../src/state/ui';
import { track } from '../src/services/analytics';

export default function QuestionScreen() {
  const router = useRouter();
  const self = useSessionStore((s) => s.self);
  const partner = useSessionStore((s) => s.partner);
  const { today, loading, error, submitAnswer, refresh } = useConnectionStore();
  const [draft, setDraft] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    track('daily_question_opened');
  }, []);

  if (!self || !partner) return null;

  const submit = async () => {
    const v = validateText(draft, 'question');
    if (!v.ok) {
      setFieldError(v.message);
      return;
    }
    setSubmitting(true);
    try {
      await submitAnswer(draft);
      setDraft('');
      haptic('success');
      toast('Your answer is sealed', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not submit your answer.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <SubHeader title="Daily Question" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {error ? <ErrorText>{error}</ErrorText> : null}
          {loading && !today ? (
            <SkeletonCard height={280} />
          ) : today ? (
            <>
              <View style={styles.illustrationWrap}>
                <Mascot variant="pao" mood={today.revealed ? 'celebrating' : 'happy'} size={92} />
              </View>

              <Text style={styles.dayLabel}>{formatDayLabel(today.dayISO)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Icon name="help-circle" size={14} color={colors.tertiary} />
                <Text style={styles.capsule}>{today.question.category.toUpperCase()}</Text>
              </View>
              <Text style={styles.questionText}>{today.question.text}</Text>

              <QuestionStepper
                selfAnswered={!!today.selfAnswer}
                partnerAnswered={!!today.partnerAnswer}
                revealed={today.revealed}
                partnerName={partner.name}
              />

              {/* Minimal answer control */}
              {!today.selfAnswer ? (
                <Card style={{ marginTop: space.lg }} padding="default">
                  <Input
                    label={`Your answer (visible to ${partner.name} only after they answer)`}
                    value={draft}
                    onChangeText={(t) => {
                      setDraft(t);
                      setFieldError(null);
                    }}
                    placeholder="Write honestly, write softly…"
                    multiline
                    error={fieldError ?? undefined}
                  />
                  <Button label={submitting ? 'Sealing…' : 'Seal my answer'} onPress={submit} loading={submitting} />
                </Card>
              ) : (
                <FadeSlideIn style={{ marginTop: space.lg }}>
                  {today.revealed ? (
                    <View style={{ gap: space.sm }}>
                      <AnswerReveal name={self.name} text={today.selfAnswer.text} tone="self" />
                      {today.partnerAnswer ? (
                        <AnswerReveal name={partner.name} text={today.partnerAnswer.text} tone="partner" />
                      ) : null}
                    </View>
                  ) : (
                    <Card>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                        <View style={styles.sealIcon}>
                          <Icon name={today.partnerAnswer ? 'unlock' : 'lock'} size={18} color={colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ ...type.labelLg, color: colors.charcoal }}>
                            {today.partnerAnswer ? `${partner.name} has answered too` : 'Sealed'}
                          </Text>
                          <Text style={{ ...type.bodySm, color: colors.inkVariant }}>
                            {today.partnerAnswer
                              ? 'Unlocking for both of you…'
                              : `Unlocks the moment ${partner.name} answers.`}
                          </Text>
                        </View>
                      </View>
                    </Card>
                  )}
                </FadeSlideIn>
              )}
            </>
          ) : (
            <Card>
              <EmptyState icon="help-circle" illustration="question-holding-card" title="No question yet" message="Your next question arrives tomorrow morning." />
            </Card>
          )}
          <View style={{ marginTop: space.md }}>
            <Button label="Refresh" variant="ghost" icon="refresh-cw" onPress={refresh} />
          </View>
          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Visual 3-stage progress: your answer → partner's answer → revealed. */
function QuestionStepper({
  selfAnswered,
  partnerAnswered,
  revealed,
  partnerName,
}: {
  selfAnswered: boolean;
  partnerAnswered: boolean;
  revealed: boolean;
  partnerName: string;
}) {
  const steps: { label: string; done: boolean }[] = [
    { label: 'You', done: selfAnswered },
    { label: partnerName, done: partnerAnswered },
    { label: 'Revealed', done: revealed },
  ];
  return (
    <View style={styles.stepperRow}>
      {steps.map((s, i) => (
        <React.Fragment key={s.label}>
          <View style={styles.stepItem}>
            <View style={[styles.stepDot, s.done && styles.stepDotDone]}>
              {s.done ? <Icon name="check" size={12} color={colors.charcoal} /> : null}
            </View>
            <Text style={[styles.stepLabel, s.done && { color: colors.charcoal }]} numberOfLines={1}>
              {s.label}
            </Text>
          </View>
          {i < steps.length - 1 ? (
            <View style={[styles.stepLine, steps[i + 1].done && styles.stepLineDone]} />
          ) : null}
        </React.Fragment>
      ))}
    </View>
  );
}

function AnswerReveal({ name, text, tone }: { name: string; text: string; tone: 'self' | 'partner' }) {
  return (
    <Card style={tone === 'self' ? { backgroundColor: colors.lightMint } : undefined}>
      <Text style={styles.authorLabel}>{name.toUpperCase()}</Text>
      <Text style={{ ...type.bodyMd, color: colors.charcoal, marginTop: 4 }}>{text}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: space.screenEdge, paddingBottom: 60 },
  illustrationWrap: { alignItems: 'center', paddingVertical: space.sm },
  dayLabel: { ...type.labelCaps, color: colors.tertiary, letterSpacing: 1.5, textAlign: 'center' },
  capsule: { ...type.labelCaps, color: colors.primary, letterSpacing: 1.2 },
  questionText: { ...type.headlineLg, color: colors.charcoal, marginTop: space.sm },
  authorLabel: { ...type.labelCaps, color: colors.tertiary },
  sealIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightMint,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.badge,
  },
  stepperRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: space.xl },
  stepItem: { alignItems: 'center', width: 64 },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.cardWhite,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: { backgroundColor: colors.primaryContainer, borderColor: border.color },
  stepLabel: { ...type.labelMd, color: colors.inkVariant, marginTop: 4, textAlign: 'center' },
  stepLine: { flex: 1, height: 3, backgroundColor: colors.surfaceContainerHigh, marginTop: 12, borderRadius: 1.5 },
  stepLineDone: { backgroundColor: colors.primaryContainer },
});
