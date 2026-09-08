/** The approved mood vocabulary. Small, warm, and designed (not random). */
export interface MoodDef {
  emoji: string;
  label: string;
}

export const MOODS: MoodDef[] = [
  { emoji: '😊', label: 'Content' },
  { emoji: '🌿', label: 'Calm' },
  { emoji: '✨', label: 'Grateful' },
  { emoji: '🥰', label: 'Loved' },
  { emoji: '🔥', label: 'Energized' },
  { emoji: '🍵', label: 'Cozy' },
  { emoji: '🌧️', label: 'Low' },
  { emoji: '😮‍💨', label: 'Stressed' },
  { emoji: '😴', label: 'Tired' },
  { emoji: '🤒', label: 'Unwell' },
  { emoji: '😤', label: 'Frustrated' },
  { emoji: '🫂', label: 'Needing a hug' },
];

export function moodByEmoji(emoji: string): MoodDef | undefined {
  return MOODS.find((m) => m.emoji === emoji);
}
