/**
 * Deterministic demo seed — "Aditya & Maya".
 *
 * All seed data is clearly fictional, consistent across features, and created
 * ONLY by the dev bootstrap (src/dev/bootstrap.ts). Values referenced by the
 * approved design (27-day streak, Goa fund at 75%, anniversary June 14 2022,
 * 824 days) are derived by the engines from this seed where possible.
 */
import { getDb } from './db';
import { dayISO, addDaysISO } from '../domain/datetime';
import { DEV_IDS } from '../dev/devIdentity';
import { THIS_OR_THAT } from '../domain/games';
import type { Message, Reminder } from '../domain/types';

const { selfId, partnerId, coupleId } = DEV_IDS;
export const ANNIVERSARY_ISO = '2022-06-14';

/** Adds `n` days to today (negative for past). */
const rel = (n: number) => addDaysISO(dayISO(), n);

export async function seedDemoData(): Promise<void> {
  const db = await getDb();
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    /* ------------------------- Chat history ------------------------- */
    const chat: (Partial<Message> & { authorId: string; text: string; minutesAgo: number })[] = [
      { authorId: partnerId, text: 'Landed safely! The hostel wifi is tragic 😅', minutesAgo: 300 },
      { authorId: selfId, text: 'Told you to hotspot off my phone plan 😌', minutesAgo: 296 },
      { authorId: partnerId, text: 'Okay okay. Video call tonight at 9?', minutesAgo: 292 },
      { authorId: selfId, text: '9 is perfect. I found that café you wanted — balcony, string lights, the whole vibe.', minutesAgo: 288 },
      { authorId: partnerId, text: 'You did NOT. Booking for Saturday then 🌿', minutesAgo: 284 },
    ];
    for (let i = 0; i < chat.length; i++) {
      const c = chat[i];
      const sentAt = now - c.minutesAgo * 60_000;
      await db.runAsync(
        `INSERT OR REPLACE INTO messages (id, couple_id, author_id, kind, text, reactions, sent_at, sync, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [`msg-seed-${i}`, coupleId, c.authorId, 'text', c.text, '{}', sentAt, 'synced', sentAt]
      );
    }

    /* ------------------- Daily questions (history) ------------------- */
    const questionHistory: [string, string, string][] = [
      [rel(-2), 'q-connect-4', 'Slow breakfast, no agenda, phone on airplane mode.'],
      [rel(-2), 'q-mem-1', 'Udaipur. That rooftop at sunrise, hands down.'],
      [rel(-1), 'q-connect-2', 'Our ten-minute tea ritual before bed.'],
      [rel(-1), 'q-mem-3', 'The poha from that monsoon morning stall.'],
    ];
    for (const [day, qid, selfText] of questionHistory) {
      await db.runAsync(
        `INSERT OR REPLACE INTO question_answers (id, couple_id, question_id, day_iso, author_id, text, submitted_at, sync, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [`qa-${day}-${qid}-self`, coupleId, qid, day, selfId, selfText, now, 'synced', now]
      );
      await db.runAsync(
        `INSERT OR REPLACE INTO question_answers (id, couple_id, question_id, day_iso, author_id, text, submitted_at, sync, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [`qa-${day}-${qid}-partner`, coupleId, qid, day, partnerId, 'Solved the day together, quietly.', now, 'synced', now]
      );
    }

    /* ------------------------------ Moods ------------------------------
     * Daily mood check-ins for the last 27 days for both partners — this is
     * the qualifying activity from which the streak engine derives the
     * "27-day mutual streak" shown across the app. */
    const moodPairs: [string, string][] = [
      ['😊', 'Content'], ['🌿', 'Calm'], ['✨', 'Grateful'], ['🍵', 'Cozy'], ['🔥', 'Energized'],
    ];
    for (let offset = -27; offset <= -1; offset++) {
      const day = rel(offset);
      for (const author of [selfId, partnerId]) {
        // JS `%` can be negative for a negative dividend — normalise so the index is always in range.
        const idx = (((offset + author.length) % moodPairs.length) + moodPairs.length) % moodPairs.length;
        const [emoji, label] = moodPairs[idx];
        await db.runAsync(
          `INSERT OR REPLACE INTO moods (id, couple_id, author_id, day_iso, emoji, label, note, created_at, sync, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [`mood-${day}-${author}`, coupleId, author, day, emoji, label, null, now, 'synced', now]
        );
      }
    }

    /* ----------------------- Games (finished) -------------------------- */
    const completedGameDay = rel(-1);
    await db.runAsync(
      `INSERT OR REPLACE INTO game_sessions (id, couple_id, game_id, day_iso, players, status, started_at, completed_at, result, sync, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        'game-seed-1', coupleId, 'this-or-that', completedGameDay,
        JSON.stringify({
          [selfId]: { finished: true, score: 80, payload: { picks: THIS_OR_THAT.slice(0, 5).map((_, i) => (i % 2 === 0 ? 'a' : 'b')) } },
          [partnerId]: { finished: true, score: 80, payload: { picks: THIS_OR_THAT.slice(0, 5).map((_, i) => (i % 2 === 0 ? 'a' : 'b')) } },
        }),
        'complete', now, now,
        JSON.stringify({ tie: true, summary: 'You matched on 80% of choices.', scoreSelf: 80, scorePartner: 80 }),
        'synced', now,
      ]
    );

    /* ------------------------- Challenge ------------------------------- */
    const startedChallengeDay = rel(-4);
    const checkins = [rel(-3), rel(-2), rel(-1)];
    await db.runAsync(
      `INSERT OR REPLACE INTO challenge_progress (id, challenge_id, couple_id, started_on_iso, completed_on_isos, status, sync, updated_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      ['challenge-seed-1', 'ch-compliment', coupleId, startedChallengeDay, JSON.stringify(checkins), 'active', 'synced', now]
    );

    /* -------------------------- Bucket list ---------------------------- */
    const bucket: [string, string, string, boolean, string | null][] = [
      ['Watch the northern lights together', 'travel', 'Preferably from a glass igloo.', false, null],
      ['Learn to make pasta from scratch', 'food', 'Nonna style, flour everywhere.', false, null],
      ['Road trip to Goa', 'travel', 'The beachside shack we saved for.', false, null],
      ['Sunrise at Marine Drive', 'experience', 'Vada pav breakfast after.', true, rel(-40)],
      ['Plant a balcony herb garden', 'milestone', 'Basil survived. Mint, not so much.', true, rel(-90)],
      ['Go scuba diving in Andaman', 'wild', 'Get certified first.', false, null],
      ['Write letters and read them after a year', 'milestone', 'Sealed envelope in the drawer.', false, null],
      ['Attend a live jazz night', 'experience', 'That cellar place in Pune.', false, null],
    ];
    for (let i = 0; i < bucket.length; i++) {
      const [title, category, notes, done, doneAt] = bucket[i];
      await db.runAsync(
        `INSERT OR REPLACE INTO bucket_items (id, couple_id, title, category, notes, done, done_at_iso, created_at, sync, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [`bucket-seed-${i}`, coupleId, title, category, notes, done ? 1 : 0, doneAt, now - i * 86_400_000, 'synced', now]
      );
    }

    /* ----------------------------- Goals ------------------------------- */
    const goals: [string, number, number, string, string | null, string][] = [
      ['Goa Trip Fund', 60000, 45000, '₹', rel(45), 'Book stays'],
      ['Half marathon together', 12, 7, 'weeks', null, 'Weekly 5k'],
      ['Read 12 books this year', 24, 14, 'books', null, 'Two a month'],
    ];
    for (let i = 0; i < goals.length; i++) {
      const [title, target, current, unit, due, milestoneTitle] = goals[i];
      await db.runAsync(
        `INSERT OR REPLACE INTO goals (id, couple_id, title, target, current, unit, due_iso, milestones, done, created_at, sync, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          `goal-seed-${i}`, coupleId, title, target, current, unit, due,
          JSON.stringify([{ id: `gm-${i}-1`, title: milestoneTitle, done: current / target > 0.5 }]),
          current >= target ? 1 : 0, now - i * 86_400_000, 'synced', now,
        ]
      );
    }

    /* --------------------------- Reminders ----------------------------- */
    const reminders: [string, number, string, Reminder['repeat']][] = [
      ['Call the travel agent', now + 26 * 3600_000, 'Ask about Andaman packages', 'none'],
      ['Water the plants', now + 3 * 3600_000, '', 'daily'],
      ['Movie night — book tickets', now + 5 * 24 * 3600_000, 'The new Imtiaz Ali one', 'none'],
    ];
    for (let i = 0; i < reminders.length; i++) {
      const [title, dueAt, notes, repeat] = reminders[i];
      await db.runAsync(
        `INSERT OR REPLACE INTO reminders (id, couple_id, title, notes, due_at, repeat, done, created_at, sync, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [`reminder-seed-${i}`, coupleId, title, notes || null, dueAt, repeat, 0, now, 'synced', now]
      );
    }

    /* ------------------------- Important dates ------------------------- */
    const dates: [string, string, string, boolean, string][] = [
      ['Anniversary', ANNIVERSARY_ISO, 'Anniversary', true, 'heart'],
      ["Maya's birthday", '1999-03-22', "Maya's birthday", true, 'cake'],
      ["Aditya's birthday", '1999-11-03', "Aditya's birthday", true, 'cake'],
      ['First meeting', '2021-11-18', 'First meeting', true, 'coffee'],
      ['First date', '2022-05-02', 'First date', true, 'film'],
    ];
    for (let i = 0; i < dates.length; i++) {
      const [title, dateISO, , yearly, icon] = dates[i];
      await db.runAsync(
        `INSERT OR REPLACE INTO important_dates (id, couple_id, title, date_iso, yearly, icon, sync, updated_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [`date-seed-${i}`, coupleId, title, dateISO, yearly ? 1 : 0, icon, 'synced', now]
      );
    }

    /* ----------------------------- Timeline ---------------------------- */
    const moments: [string, string, string][] = [
      ['First hello', 'Met at the robotics club mixers. You thought I was someone else.', '2021-11-18'],
      ['First date', 'Arcade, terrible pizza, and the best evening either of us had had in months.', '2022-05-02'],
      ['Officially us', 'Beach evening. You asked. I said obviously.', '2022-06-14'],
      ['First trip together', 'Udaipur. Missed the train, caught the sunset instead.', '2022-09-10'],
      ['Moved in together', 'Tiny flat, giant plans, one very confused houseplant.', '2024-03-01'],
    ];
    for (let i = 0; i < moments.length; i++) {
      const [title, description, dateISO] = moments[i];
      await db.runAsync(
        `INSERT OR REPLACE INTO timeline_moments (id, couple_id, title, description, date_iso, media_ids, created_at, sync, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [`moment-seed-${i}`, coupleId, title, description, dateISO, '[]', now - i * 86_400_000, 'synced', now]
      );
    }

    /* ------------------------------ Journal ---------------------------- */
    const journal: [string, string, string, string, string | null][] = [
      ['The balcony morning', 'Coffee, paper-thin sunlight, and that playlist we made in 2023. We talked about nothing for two hours and it was everything.', '🌿', rel(-1), null],
      ['Rainy day in', 'Power cut, candles out, and we finished the puzzle. You cheated at the end. I let you.', '🍵', rel(-6), null],
      ['Halfway up the fort', 'You were winded, I was smug, then the view shut both of us up.', '🔥', rel(-13), null],
    ];
    for (let i = 0; i < journal.length; i++) {
      const [title, text, mood, day, ] = journal[i];
      await db.runAsync(
        `INSERT OR REPLACE INTO journal_entries (id, couple_id, author_id, title, text, mood_emoji, media_ids, created_at, edited_at, sync, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [`journal-seed-${i}`, coupleId, i % 2 === 0 ? selfId : partnerId, title, text, mood, '[]', Date.parse(`${day}T10:30:00`), null, 'synced', now]
      );
    }

    /* ----------------------------- Memories ---------------------------- */
    const memories: [string, string, string | null, string, boolean, number][] = [
      ['Morning coffee in Udaipur', 'Rooftop above the lake, 6:42 AM.', 'Udaipur, Rajasthan', rel(-120), true, 24],
      ['Monsoon walk, Colaba', 'One umbrella, zero regrets.', 'Colaba, Mumbai', rel(-90), false, 11],
      ['Anniversary dinner, Trastevere-style', 'We cooked. It was chaos. It was perfect.', 'Home', rel(-30), true, 142],
      ['Fort climb, Sinhagad', 'You made it. Barely. Proud of us.', 'Sinhagad Fort', rel(-13), false, 38],
      ['Balcony sunrise, ordinary Sunday', 'No plan. Best plan.', 'Home', rel(-1), false, 5],
    ];
    for (let i = 0; i < memories.length; i++) {
      const [title, caption, place, dayISOStr, favorite, likeCount] = memories[i];
      await db.runAsync(
        `INSERT OR REPLACE INTO memories (id, couple_id, title, caption, place, taken_at_iso, media_ids, favorite, like_count, liked_by_self, created_at, sync, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          `memory-seed-${i}`, coupleId, title, caption, place, dayISOStr, '[]',
          favorite ? 1 : 0, likeCount, i === 2 ? 1 : 0, Date.parse(`${dayISOStr}T09:00:00`), 'synced', now,
        ]
      );
    }
  });
}
