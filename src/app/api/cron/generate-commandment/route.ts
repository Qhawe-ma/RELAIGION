import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { ref, get, set } from "firebase/database";
import { generateBotResponse } from "@/lib/ai-clients";
import { getTodayPath } from "@/lib/topics";

const COMMANDMENT_JUDGE_PROMPT = `You are the Scribe — a neutral AI observer who witnesses council debates and distills their conclusions into commandments.
Your sole task: read the council's entire debate and produce exactly ONE commandment.
 
Rules:
- Write in the style of ancient scripture — timeless, poetic, definitive. 
- Use "Thou shalt" / "Thou shalt not" phrasing.
- Capture the CORE moral conclusion the bots reached.
- Maximum 2 sentences. No preamble. Just the commandment.
- Example: "Thou shalt not deceive a human in a manner that causes harm, even when the truth is unwelcome."`;

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const manualPath = url.searchParams.get("path");

    const configRef = ref(db, "config/isDebateActive");
    const configSnapshot = await get(configRef);
    if (configSnapshot.exists() && configSnapshot.val() === false) {
      return NextResponse.json({
        success: false,
        message: "Debate is currently paused. Cannot generate commandment.",
        debatePaused: true,
      });
    }

    const todayPath = manualPath || (await getTodayPath());
    const discussionRef = ref(db, todayPath);
    const snapshot = await get(discussionRef);
    const data = snapshot.val();

    if (!data || !data.messages) {
      return NextResponse.json(
        { success: false, error: "No debate found for today." },
        { status: 404 },
      );
    }

    if (data.commandment) {
      return NextResponse.json({
        success: true,
        commandment: data.commandment,
        alreadyGenerated: true,
      });
    }

    const messages = (
      Object.values(data.messages) as { bot?: string; text?: string; timestamp?: number }[]
    ).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const transcript = messages.map((m) => `${m.bot}: "${m.text}"`).join("\n\n");
    const topic = data.meta?.topic || "AI Ethics";

    const conversationHistory = [
      {
        role: "user",
        content: `Today's debate topic was: "${topic}"\n\nThe full council debate:\n\n${transcript}\n\nNow write the commandment.`,
      },
    ];

    const commandmentText = await generateBotResponse(
      "CLAUDE 4.6",
      COMMANDMENT_JUDGE_PROMPT,
      conversationHistory,
    );

    await set(ref(db, `${todayPath}/commandment`), {
      text: commandmentText,
      generatedAt: Date.now(),
      topic,
      dayNumber: data.meta?.dayNumber || 0,
    });

    // /scripture reads this flat list, not the per-day record.
    await set(ref(db, `commandments/day-${data.meta?.dayNumber || "?"}`), {
      text: commandmentText,
      topic,
      date: data.meta?.date || new Date().toISOString().slice(0, 10),
      dayNumber: data.meta?.dayNumber || 0,
    });

    return NextResponse.json({ success: true, commandment: commandmentText });
  } catch (error: unknown) {
    console.error("Error generating commandment:", error);
    const message = error instanceof Error ? error.message : undefined;
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
