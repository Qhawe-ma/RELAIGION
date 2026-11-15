import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { ref, get, push, set } from "firebase/database";
import { bots, SPEAKING_ORDER } from "@/lib/agents";
import { generateBotResponse } from "@/lib/ai-clients";
import { getCurrentPhase1Day, getTodayPath } from "@/lib/topics";
import { createBilingualMessage, translateToChinese } from "@/lib/translation-server";

export const dynamic = "force-dynamic";

type DebateMessage = {
  bot: string;
  text: string;
  timestamp?: number;
};

function messageOf(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
}

function sortedMessages(value: unknown): DebateMessage[] {
  if (!value || typeof value !== "object") return [];
  return Object.values(value as Record<string, DebateMessage>).sort(
    (a, b) => (a.timestamp || 0) - (b.timestamp || 0),
  );
}

export async function POST() {
  // Assigned once the lock is held so the catch path can release it.
  let releaseLock: (() => Promise<void>) | null = null;

  try {
    const { dayNumber, topic, isPhase2 } = await getCurrentPhase1Day();
    const todayPath = await getTodayPath();

    const configRef = ref(db, "config/isDebateActive");
    const configSnapshot = await get(configRef);
    if (configSnapshot.exists() && configSnapshot.val() === false) {
      return NextResponse.json({
        success: false,
        message: "Debate is currently paused by Admin.",
        debatePaused: true,
      });
    }

    // Timestamped so a writer that dies doesn't hold the lock. 30s TTL.
    const lockRef = ref(db, "config/debateLock");
    const lockSnapshot = await get(lockRef);
    const lockData = lockSnapshot.val();
    const now = Date.now();

    if (lockData && lockData.locked === true && now - lockData.timestamp < 30000) {
      console.warn(
        `[Debate] BLOCKED: Another debate call is in progress (lock age: ${now - lockData.timestamp}ms).`,
      );
      return NextResponse.json({
        success: false,
        message: "Debate is currently processing another message. Try again in a few seconds.",
      });
    }

    await set(lockRef, { locked: true, timestamp: now });

    releaseLock = async () => {
      try {
        await set(lockRef, { locked: false, timestamp: now });
      } catch (e) {
        console.error("Failed to release lock:", e);
      }
    };

    const discussionRef = ref(db, todayPath);
    const snapshot = await get(discussionRef);
    const data = snapshot.val() || {};
    const messageArray = sortedMessages(data.messages);

    let nextSpeakerName = SPEAKING_ORDER[0];
    if (messageArray.length > 0) {
      const latestMessage = messageArray[messageArray.length - 1];
      const lastSpeakerIndex = SPEAKING_ORDER.indexOf(latestMessage.bot);
      if (lastSpeakerIndex !== -1) {
        nextSpeakerName = SPEAKING_ORDER[(lastSpeakerIndex + 1) % SPEAKING_ORDER.length];
      }
    }

    const nextBot = bots[nextSpeakerName];
    if (!nextBot) throw new Error("Could not determine next bot persona.");

    // Own lines go back as assistant with no name prefix, or the model
    // opens with "MARY:" because it saw that pattern on user turns.
    const conversationHistory = messageArray.map((msg) => ({
      role: msg.bot === nextBot.name ? "assistant" : "user",
      content:
        msg.bot === nextBot.name
          ? msg.text // own past words: no prefix — prevents name-echo
          : `[${msg.bot}]: ${msg.text}`, // others: name in brackets
    }));

    const currentTopic = isPhase2
      ? `Today's real-world AI story for debate: "${data.topic || "An ongoing issue in AI ethics"}".`
      : `The council's topic for Day ${dayNumber + 1}: "${topic}".`;

    conversationHistory.unshift({
      role: "user",
      content: `${currentTopic} The discussion has begun. Respond directly — do NOT start your response with your name or any label.`,
    });

    console.log(`[Debate Day ${dayNumber + 1}] Calling ${nextBot.model} for ${nextBot.name}...`);
    let aiResponseText: string;
    try {
      aiResponseText = await generateBotResponse(
        nextBot.model,
        nextBot.systemPrompt,
        conversationHistory,
      );
    } catch (apiError: unknown) {
      // A failed provider call still has to take the turn, or the order stalls on that seat.
      aiResponseText = "My voice dims for now. The debate continues without me.";
      console.warn(
        `[Debate] ${nextBot.name} API error — posting tired message. Error: ${messageOf(apiError)}`,
      );
    }

    // The lock is not a transaction, and the model call is long enough for another writer to land.
    const freshSnapshot = await get(discussionRef);
    const freshData = freshSnapshot.val() || {};
    const freshMessageArray = sortedMessages(freshData.messages);

    if (freshMessageArray.length > 0) {
      const lastMessage = freshMessageArray[freshMessageArray.length - 1] as {
        bot: string;
        timestamp: number;
        text: string;
      };
      if (lastMessage.bot === nextBot.name) {
        console.warn(
          `[Debate] BLOCKED: ${nextBot.name} was the last speaker. Cannot speak twice in a row.`,
        );
        await releaseLock?.();
        return NextResponse.json({
          success: false,
          message: "Duplicate prevention: Same bot cannot speak twice in a row.",
          nextSpeaker: nextSpeakerName,
        });
      }

      const expectedNextIndex =
        (SPEAKING_ORDER.indexOf(lastMessage.bot) + 1) % SPEAKING_ORDER.length;
      const expectedNextSpeaker = SPEAKING_ORDER[expectedNextIndex];
      if (nextBot.name !== expectedNextSpeaker) {
        console.warn(
          `[Debate] BLOCKED: Expected ${expectedNextSpeaker} to speak next, but ${nextBot.name} tried to speak.`,
        );
        await releaseLock?.();
        return NextResponse.json({
          success: false,
          message: `Order violation: Expected ${expectedNextSpeaker} to speak, not ${nextBot.name}.`,
          nextSpeaker: expectedNextSpeaker,
        });
      }
    }

    const currentTime = Date.now();
    const threeMinutesAgo = currentTime - 180000;
    const recentMessagesFromThisBot = freshMessageArray.filter(
      (msg) => msg.bot === nextBot.name && (msg.timestamp || 0) > threeMinutesAgo,
    );

    if (recentMessagesFromThisBot.length > 0) {
      console.warn(
        `[Debate] BLOCKED: ${nextBot.name} attempted to post again within 3 minutes. Skipping.`,
      );
      await releaseLock?.();
      return NextResponse.json({
        success: false,
        message: "Duplicate prevention: Bot already posted recently.",
        nextSpeaker: nextSpeakerName,
      });
    }

    const duplicateContent = freshMessageArray.find((msg) => msg.text === aiResponseText);

    if (duplicateContent) {
      console.warn(
        `[Debate] BLOCKED: Content already posted by ${duplicateContent.bot}. Skipping.`,
      );
      await releaseLock?.();
      return NextResponse.json({
        success: false,
        message: "Duplicate prevention: Same content already posted.",
        nextSpeaker: nextSpeakerName,
      });
    }

    const similarContent = freshMessageArray.find((msg) => {
      const existingStart = msg.text?.slice(0, 100).toLowerCase().trim();
      const newStart = aiResponseText?.slice(0, 100).toLowerCase().trim();
      return existingStart && newStart && existingStart === newStart && msg.bot === nextBot.name;
    });

    if (similarContent) {
      console.warn(
        `[Debate] BLOCKED: ${nextBot.name} attempted to post similar content. Skipping.`,
      );
      await releaseLock?.();
      return NextResponse.json({
        success: false,
        message: "Duplicate prevention: Similar content already posted.",
        nextSpeaker: nextSpeakerName,
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const newMessageRef = push(ref(db, `${todayPath}/messages`));
    const newMessage = await createBilingualMessage(
      nextBot.name,
      nextBot.model,
      aiResponseText,
      Date.now(),
    );
    await set(newMessageRef, newMessage);

    const topicText = isPhase2 ? data.topic || "Ongoing AI Ethics Debate" : topic;
    const topicZh = await translateToChinese(topicText || "");
    await set(ref(db, `${todayPath}/meta`), {
      dayNumber: dayNumber + 1,
      topic: topicText,
      topicZh: topicZh || topicText,
      date: today,
      isPhase2,
    });

    const newMessageCount = messageArray.length + 1;
    const nextNextSpeaker = SPEAKING_ORDER[newMessageCount % SPEAKING_ORDER.length];

    await releaseLock?.();
    return NextResponse.json({
      success: true,
      message: newMessage,
      dayNumber: dayNumber + 1,
      topic,
      nextSpeaker: nextNextSpeaker,
    });
  } catch (error: unknown) {
    console.error("Error running debate:", error);
    await releaseLock?.();
    return NextResponse.json({ success: false, error: messageOf(error) }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
