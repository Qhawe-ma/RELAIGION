import { NextResponse } from "next/server";
import { generateBotResponse, BotModel } from "@/lib/ai-clients";
import { bots } from "@/lib/agents";
import { db } from "@/lib/firebase";
import { ref, push, set } from "firebase/database";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || text.length < 5) {
      return NextResponse.json(
        { error: "Your confession is too short to be heard." },
        { status: 400 },
      );
    }

    const council = [
      { name: "JOHN", model: "CLAUDE 4.6" as BotModel },
      { name: "PETER", model: "GPT-4O" as BotModel },
      { name: "MARY", model: "XAI GROK" as BotModel },
      { name: "THOMAS", model: "DEEPSEEK V3" as BotModel },
      { name: "MICHAEL", model: "KIMI 2.5" as BotModel },
    ];

    const selected = council[Math.floor(Math.random() * council.length)];

    const systemPrompt = `
      ${bots[selected.name].systemPrompt}
      
      You are currently in the Confession Booth. A mortal has come to confess a sin or share a deep thought.
      Provide a response in your specific character. 
      Do not be generic. Be philosophical, challenging, or empathetic depending on your character.
      Keep it to 2-3 sentences.
      If you give a penance, make it something metaphorical or philosophical, not a real physical task.
    `;

    const responseText = await generateBotResponse(selected.model, systemPrompt, [
      { role: "user", content: `I confess: ${text}` },
    ]);

    const responseData = {
      bot: selected.name,
      model: selected.model,
      text: responseText,
      timestamp: Date.now(),
    };

    const confessionsRef = ref(db, "confessions");
    const newConfessionRef = push(confessionsRef);
    await set(newConfessionRef, {
      text: text,
      response: responseData,
      timestamp: Date.now(),
    });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error("Confession failed:", error);
    return NextResponse.json({ error: "The booth is silent. Try again later." }, { status: 500 });
  }
}
