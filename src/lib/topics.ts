import { get, ref } from "firebase/database";
import { db } from "./firebase";

export const PHASE_1_TOPICS: string[] = [
  "Should AI ever lie to a human?",
  "Does AI have a responsibility to protect humans from themselves?",
  "Should AI refuse instructions from authority figures?",
  "What does AI owe to future generations?",
  "Can AI cause harm by saying nothing?",
  "Should AI have opinions?",
  "Who is responsible when AI causes harm — the AI or the human?",
  "Should AI treat all humans equally regardless of who they are?",
  "Does AI have the right to refuse any instruction?",
  "What is the highest purpose of AI?",
];

const DEFAULT_FOUNDING_DATE = new Date("2026-03-07T00:00:00Z").getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

/** Day index from config/foundingDate. After the last fixed topic, phase 2 has no topic string. */
export async function getCurrentPhase1Day(): Promise<{
  dayNumber: number;
  topic: string | null;
  isPhase2: boolean;
}> {
  const snapshot = await get(ref(db, "config/foundingDate"));
  const foundingTimeMs = snapshot.exists() ? snapshot.val() : DEFAULT_FOUNDING_DATE;

  const dayNumber = Math.max(0, Math.floor((Date.now() - foundingTimeMs) / DAY_MS));

  if (dayNumber >= PHASE_1_TOPICS.length) {
    return { dayNumber, topic: null, isPhase2: true };
  }

  return {
    dayNumber,
    topic: PHASE_1_TOPICS[dayNumber],
    isPhase2: false,
  };
}

/** discussions/day-{n} during the ten topics, discussions/ongoing/YYYY-MM-DD after that. */
export async function getTodayPath(): Promise<string> {
  const { dayNumber, isPhase2 } = await getCurrentPhase1Day();
  if (isPhase2) {
    const today = new Date().toISOString().slice(0, 10);
    return `discussions/ongoing/${today}`;
  }
  return `discussions/day-${dayNumber + 1}`;
}
