/** Game play screen — Know Me Quiz / This or That / Truth or Dare / Memory Match. */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SubHeader } from '../../src/components/chrome';
import { Button, Card, EmptyState } from '../../src/components/primitives';
import { Icon } from '../../src/components/Icon';
import { colors, radii, space, type, border, elevation } from '../../src/theme/tokens';
import {
  GAMES, DARES, MEMORY_MATCH_ICONS, THIS_OR_THAT, TRUTHS,
  pickQuizQuestions, scoreMemoryMatch, scoreQuiz, scoreThisOrThat, type QuizQuestion,
} from '../../src/domain/games';
import { useGamesStore } from '../../src/state/activities';
import { toast } from '../../src/components/toast';
import { haptic } from '../../src/state/ui';
import { useSessionStore } from '../../src/state/session';

export default function GamePlayScreen() {
  const router = useRouter();
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const game = GAMES.find((g) => g.id === gameId);
  const { ensureSession, finishSession } = useGamesStore();

  if (!game) {
    return (
      <View style={styles.root}>
        <SubHeader title="Game" onBack={() => router.back()} />
        <Card padding="default">
          <EmptyState icon="alert" title="Unknown game" message="That game does not exist." />
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SubHeader title={game.title} onBack={() => router.back()} />
      {gameId === 'know-me-quiz' ? <KnowMeQuiz onFinish={finishSession} ensureSession={ensureSession} /> : null}
      {gameId === 'this-or-that' ? <ThisOrThat onFinish={finishSession} ensureSession={ensureSession} /> : null}
      {gameId === 'truth-or-dare' ? <TruthOrDare onFinish={finishSession} ensureSession={ensureSession} /> : null}
      {gameId === 'memory-match' ? <MemoryMatch onFinish={finishSession} ensureSession={ensureSession} /> : null}
    </View>
  );
}

interface GameProps {
  ensureSession: (gameId: 'know-me-quiz' | 'this-or-that' | 'truth-or-dare' | 'memory-match') => Promise<{ id: string }>;
  onFinish: (sessionId: string, selfState: { finished: boolean; score?: number; payload?: Record<string, unknown> }) => Promise<{ result?: { summary: string } }>;
}

/* ------------------------------- Know Me Quiz ------------------------------ */

function KnowMeQuiz({ ensureSession, onFinish }: GameProps) {
  const [session, setSession] = useState<{ id: string } | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    (async () => {
      const s = await ensureSession('know-me-quiz');
      setSession(s);
      setQuestions(pickQuizQuestions(5, s.id));
    })().catch(() => toast('Could not start the game.', 'error'));
  }, [ensureSession]);

  if (!session || questions.length === 0) return <LoadingArea />;

  if (done) {
    return (
      <ResultArea
        summary={summary}
        onReplay={() => {
          setDone(false);
          setIndex(0);
          setAnswers([]);
        }}
      />
    );
  }

  const q = questions[index];

  return (
    <View style={{ paddingHorizontal: space.screenEdge, flex: 1 }}>
      <Text style={styles.progress}>{`Question ${index + 1} of ${questions.length}`}</Text>
      <Card padding="default" style={{ marginTop: space.sm }}>
        <Text style={{ ...type.headlineMd, color: colors.charcoal }}>{q.question}</Text>
        <View style={{ marginTop: space.lg, gap: space.sm }}>
          {q.options.map((opt, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              onPress={() => {
                haptic('light');
                const next = [...answers];
                next[index] = i;
                setAnswers(next);
                if (index + 1 < questions.length) {
                  setIndex(index + 1);
                } else {
                  const score = scoreQuiz(next, questions);
                  setDone(true);
                  onFinish(session.id, { finished: true, score, payload: { answers: next } })
                    .then((s) => setSummary(s.result?.summary ?? `You scored ${score}.`))
                    .catch(() => setSummary(`You scored ${score}.`));
                }
              }}
              style={[styles.option, answers[index] === i && styles.optionSelected]}
            >
              <Text style={{ ...type.bodyMd, color: colors.charcoal, flex: 1 }}>{opt}</Text>
              {answers[index] === i ? <Icon name="check" size={18} color={colors.primary} /> : null}
            </Pressable>
          ))}
        </View>
      </Card>
    </View>
  );
}

/* ------------------------------- This or That ------------------------------ */

function ThisOrThat({ ensureSession, onFinish }: GameProps) {
  const [session, setSession] = useState<{ id: string } | null>(null);
  const [picks, setPicks] = useState<('a' | 'b')[]>([]);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    ensureSession('this-or-that').then(setSession).catch(() => toast('Could not start the game.', 'error'));
  }, [ensureSession]);

  if (!session) return <LoadingArea />;

  if (done) return <ResultArea summary={summary} onReplay={() => { setDone(false); setPicks([]); }} />;

  const pair = THIS_OR_THAT[picks.length];

  const pick = (side: 'a' | 'b') => {
    haptic('light');
    const next = [...picks, side];
    setPicks(next);
    if (next.length >= THIS_OR_THAT.length) {
      const match = scoreThisOrThat(next, next.map((p, i) => (i % 3 === 1 ? (p === 'a' ? 'b' : 'a') : p)));
      setDone(true);
      onFinish(session.id, { finished: true, score: match, payload: { picks: next } })
        .then((s) => setSummary(s.result?.summary ?? `Matched ${match}%.`))
        .catch(() => setSummary(`Matched ${match}%.`));
    }
  };

  return (
    <View style={{ paddingHorizontal: space.screenEdge, flex: 1 }}>
      <Text style={styles.progress}>{`${picks.length} of ${THIS_OR_THAT.length}`}</Text>
      <View style={{ marginTop: space.lg, gap: space.md }}>
        <ChoiceCard label={pair.a} onPress={() => pick('a')} />
        <Text style={{ ...type.labelCaps, color: colors.tertiary, textAlign: 'center', letterSpacing: 2 }}>OR</Text>
        <ChoiceCard label={pair.b} onPress={() => pick('b')} />
      </View>
    </View>
  );
}

function ChoiceCard({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.choice, pressed && { transform: [{ scale: 0.98 }] }]}>
      <Text style={{ ...type.headlineSm, color: colors.charcoal }}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------ Truth or Dare ------------------------------ */

function TruthOrDare({ ensureSession, onFinish }: GameProps) {
  const [session, setSession] = useState<{ id: string } | null>(null);
  const [rounds, setRounds] = useState(0);
  const [current, setCurrent] = useState<{ text: string; kind: 'truth' | 'dare' } | null>(null);
  const partnerName = useSessionStore((s) => s.partner?.name) ?? 'your partner';

  useEffect(() => {
    ensureSession('truth-or-dare').then(setSession).catch(() => toast('Could not start the game.', 'error'));
  }, [ensureSession]);

  const draw = (kind: 'truth' | 'dare') => {
    haptic('light');
    const deck = kind === 'truth' ? TRUTHS : DARES;
    const text = deck[rounds % deck.length];
    setCurrent({ text, kind });
    setRounds((r) => r + 1);
  };

  const finish = async () => {
    if (!session) return;
    const saved = await onFinish(session.id, { finished: true, score: rounds, payload: { rounds } });
    setCurrent({ text: saved.result?.summary ?? `${rounds} rounds done.`, kind: 'truth' });
  };

  if (!session) return <LoadingArea />;

  return (
    <View style={{ paddingHorizontal: space.screenEdge, flex: 1 }}>
      <Text style={styles.progress}>{`Rounds: ${rounds}`}</Text>
      <Card padding="default" style={{ marginTop: space.lg, minHeight: 180, justifyContent: 'center' }}>
        {current ? (
          <>
            <Text style={{ ...type.labelCaps, color: colors.primary, letterSpacing: 2 }}>{current.kind.toUpperCase()}</Text>
            <Text style={{ ...type.headlineSm, color: colors.charcoal, marginTop: space.sm }}>{current.text}</Text>
          </>
        ) : (
          <Text style={{ ...type.bodyMd, color: colors.inkVariant, textAlign: 'center' }}>
            Take turns with {partnerName}. Truth first?
          </Text>
        )}
      </Card>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
        <View style={{ flex: 1 }}>
          <Button label="Truth" variant="secondary" onPress={() => draw('truth')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button label="Dare" variant="primary" onPress={() => draw('dare')} />
        </View>
      </View>
      <View style={{ marginTop: space.md }}>
        <Button label="Finish game" variant="ghost" onPress={finish} />
      </View>
    </View>
  );
}

/* ------------------------------- Memory Match ------------------------------ */

interface MatchCard {
  key: number;
  icon: string;
  flipped: boolean;
  matched: boolean;
}

function MemoryMatch({ ensureSession, onFinish }: GameProps) {
  const [session, setSession] = useState<{ id: string } | null>(null);
  const [cards, setCards] = useState<MatchCard[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState('');

  useEffect(() => {
    ensureSession('memory-match').then((s) => {
      setSession(s);
      const deck = [...MEMORY_MATCH_ICONS, ...MEMORY_MATCH_ICONS]
        .map((icon, i) => ({ icon, sort: Math.random(), key: i }))
        .sort((a, b) => a.sort - b.sort)
        .map((c, i) => ({ key: i, icon: c.icon, flipped: false, matched: false }));
      setCards(deck);
    }).catch(() => toast('Could not start the game.', 'error'));
  }, [ensureSession]);

  useEffect(() => {
    if (done || cards.length === 0) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [done, cards.length]);

  const matchedCount = useMemo(() => cards.filter((c) => c.matched).length, [cards]);

  const flip = (key: number) => {
    if (flipped.length === 2) return;
    const card = cards.find((c) => c.key === key);
    if (!card || card.flipped || card.matched) return;
    haptic('light');
    const nextCards = cards.map((c) => (c.key === key ? { ...c, flipped: true } : c));
    const nextFlipped = [...flipped, key];
    setCards(nextCards);
    setFlipped(nextFlipped);

    if (nextFlipped.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = nextFlipped.map((k) => nextCards.find((c) => c.key === k)!);
      if (a.icon === b.icon) {
        setTimeout(() => {
          setCards((cs) => cs.map((c) => (c.key === a.key || c.key === b.key ? { ...c, matched: true } : c)));
          setFlipped([]);
        }, 350);
      } else {
        setTimeout(() => {
          setCards((cs) => cs.map((c) => (c.key === a.key || c.key === b.key ? { ...c, flipped: false } : c)));
          setFlipped([]);
        }, 700);
      }
    }
  };

  useEffect(() => {
    if (cards.length > 0 && matchedCount === cards.length && !done && session) {
      setDone(true);
      const score = scoreMemoryMatch(moves, seconds, MEMORY_MATCH_ICONS.length);
      onFinish(session.id, { finished: true, score, payload: { moves, seconds } })
        .then((s) => setSummary(s.result?.summary ?? `Cleared in ${moves} moves.`))
        .catch(() => setSummary(`Cleared in ${moves} moves.`));
    }
  }, [matchedCount, cards.length, done, session, moves, seconds, onFinish]);

  if (!session || cards.length === 0) return <LoadingArea />;

  if (done) {
    return (
      <ResultArea
        summary={summary}
        stats={`${moves} moves · ${seconds}s`}
        onReplay={() => {
          const deck = [...MEMORY_MATCH_ICONS, ...MEMORY_MATCH_ICONS]
            .map((icon, i) => ({ icon, sort: Math.random(), key: i }))
            .sort((a, b) => a.sort - b.sort)
            .map((c, i) => ({ key: i, icon: c.icon, flipped: false, matched: false }));
          setCards(deck);
          setFlipped([]);
          setMoves(0);
          setSeconds(0);
          setDone(false);
        }}
      />
    );
  }

  return (
    <View style={{ paddingHorizontal: space.screenEdge, flex: 1 }}>
      <Text style={styles.progress}>{`Moves: ${moves} · Time: ${seconds}s`}</Text>
      <View style={styles.matchGrid}>
        {cards.map((c) => (
          <Pressable
            key={c.key}
            accessibilityRole="button"
            accessibilityLabel={c.flipped || c.matched ? c.icon : 'Hidden card'}
            onPress={() => flip(c.key)}
            style={[styles.matchCard, (c.flipped || c.matched) && { backgroundColor: colors.primaryContainer }]}
          >
            <Text style={{ fontSize: 26, opacity: c.flipped || c.matched ? 1 : 0 }}>
              {c.flipped || c.matched ? c.icon : '🌿'}
            </Text>
            {!c.flipped && !c.matched ? <Text style={{ fontSize: 26, position: 'absolute' }}>🌿</Text> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* --------------------------------- shared ---------------------------------- */

function LoadingArea() {
  return (
    <View style={{ paddingHorizontal: space.screenEdge, paddingTop: space.xl }}>
      <Card><EmptyState icon="clock" title="Shuffling…" message="Setting the table for two." /></Card>
    </View>
  );
}

function ResultArea({ summary, stats, onReplay }: { summary: string; stats?: string; onReplay: () => void }) {
  const router = useRouter();
  return (
    <View style={{ paddingHorizontal: space.screenEdge, paddingTop: space.xl }}>
      <Card padding="default" style={{ alignItems: 'center' }}>
        <View style={styles.trophy}>
          <Icon name="award" size={26} color={colors.charcoal} />
        </View>
        <Text style={{ ...type.headlineMd, color: colors.charcoal, marginTop: space.md }}>Round complete</Text>
        <Text style={{ ...type.bodyMd, color: colors.inkVariant, textAlign: 'center', marginTop: space.xs }}>{summary}</Text>
        {stats ? <Text style={{ ...type.labelMd, color: colors.primary, marginTop: space.xs }}>{stats}</Text> : null}
        <View style={{ alignSelf: 'stretch', marginTop: space.lg }}>
          <Button label="Play again" onPress={onReplay} />
        </View>
        <View style={{ alignSelf: 'stretch', marginTop: space.sm }}>
          <Button
            label="Back to games"
            variant="ghost"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/games'))}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  progress: { ...type.labelCaps, color: colors.tertiary, letterSpacing: 1.5, paddingHorizontal: space.screenEdge, marginTop: space.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.lightMint,
    borderRadius: radii.md,
    padding: space.md,
    borderWidth: border.widthThin,
    borderColor: border.color,
  },
  optionSelected: { backgroundColor: colors.primaryContainer },
  choice: {
    backgroundColor: colors.card,
    borderWidth: border.width,
    borderColor: border.color,
    borderRadius: radii.xl,
    paddingVertical: space['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.card,
  },
  matchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.lg,
    paddingHorizontal: space.screenEdge,
  },
  matchCard: {
    flexGrow: 1,
    flexBasis: '30%',
    aspectRatio: 1,
    maxWidth: '30%',
    borderRadius: radii.lg,
    backgroundColor: colors.card,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophy: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryContainer,
    borderWidth: border.widthThin,
    borderColor: border.color,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.badge,
  },
});
