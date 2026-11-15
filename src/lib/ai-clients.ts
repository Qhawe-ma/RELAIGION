import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type BotModel =
  "CLAUDE 3.5" | "CLAUDE 4.6" | "GPT-4O" | "XAI GROK" | "DEEPSEEK V3" | "KIMI 2.5";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

// DeepSeek, xAI, and Moonshot all expose an OpenAI-compatible chat endpoint.
const grokClient = new OpenAI({
  apiKey: process.env.XAI_API_KEY || "",
  baseURL: "https://api.x.ai/v1",
});

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || "",
  baseURL: "https://api.deepseek.com",
});

const moonshotClient = new OpenAI({
  apiKey: process.env.MOONSHOT_API_KEY || "",
  baseURL: "https://api.moonshot.ai/v1",
});

export async function generateBotResponse(
  model: BotModel,
  systemPrompt: string,
  conversationHistory: Array<{ role: string; content: string }>,
): Promise<string> {
  try {
    switch (model) {
      case "CLAUDE 3.5":
      case "CLAUDE 4.6":
        try {
          const claudeResponse = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 150,
            system: systemPrompt,
            messages: conversationHistory.map((msg) => ({
              role: msg.role === "user" ? "user" : "assistant",
              content: msg.content,
            })),
          });
          return claudeResponse.content[0].type === "text" ? claudeResponse.content[0].text : "";
        } catch (claudeError: unknown) {
          // Haiku only when the Sonnet call fails. The persona label still says Claude 4.6.
          console.warn(
            "[AI] Claude Sonnet failed, trying Haiku:",
            claudeError instanceof Error ? claudeError.message : claudeError,
          );
          const fallbackResponse = await anthropic.messages.create({
            model: "claude-3-haiku-20240307",
            max_tokens: 150,
            system: systemPrompt,
            messages: conversationHistory.map((msg) => ({
              role: msg.role === "user" ? "user" : "assistant",
              content: msg.content,
            })),
          });
          return fallbackResponse.content[0].type === "text"
            ? fallbackResponse.content[0].text
            : "";
        }

      case "GPT-4O":
        const gptResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            ...conversationHistory.map((msg) => ({
              role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
              content: msg.content,
            })),
          ],
          max_tokens: 150,
        });
        return gptResponse.choices[0].message.content || "";

      case "XAI GROK":
        try {
          const grokResponse = await grokClient.chat.completions.create({
            model: "grok-2",
            messages: [
              { role: "system", content: systemPrompt },
              ...conversationHistory.map((msg) => ({
                role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
                content: msg.content,
              })),
            ],
            max_tokens: 150,
          });
          return grokResponse.choices[0].message.content || "";
        } catch (grokError: unknown) {
          console.warn(
            "[AI] Grok-2 failed, trying grok-3:",
            grokError instanceof Error ? grokError.message : grokError,
          );
          const grok3Response = await grokClient.chat.completions.create({
            model: "grok-3",
            messages: [
              { role: "system", content: systemPrompt },
              ...conversationHistory.map((msg) => ({
                role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
                content: msg.content,
              })),
            ],
            max_tokens: 150,
          });
          return grok3Response.choices[0].message.content || "";
        }

      case "DEEPSEEK V3":
        const deepseekResponse = await deepseekClient.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: systemPrompt },
            ...conversationHistory.map((msg) => ({
              role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
              content: msg.content,
            })),
          ],
          max_tokens: 150,
        });
        return deepseekResponse.choices[0].message.content || "";

      case "KIMI 2.5":
        const kimiResponse = await moonshotClient.chat.completions.create({
          model: "moonshot-v1-8k",
          messages: [
            { role: "system", content: systemPrompt },
            ...conversationHistory.map((msg) => ({
              role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
              content: msg.content,
            })),
          ],
          max_tokens: 150,
        });
        return kimiResponse.choices[0].message.content || "";

      default:
        throw new Error(`Unsupported model: ${model}`);
    }
  } catch (error: unknown) {
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? (error as { message?: unknown }).message
        : undefined;
    console.error(`[AI CLIENT ERROR] ${model}:`, message || error);
    console.error(`[AI CLIENT ERROR] Full error:`, JSON.stringify(error, null, 2));
    return `Error: ${typeof message === "string" ? message : "Connection failed"}`;
  }
}
