// Test script to verify all AI API keys
import { Anthropic } from "@anthropic-ai/sdk";
import OpenAI from "openai";

async function testAPIs() {
  const results: Record<string, { ok: boolean; error?: string; response?: string }> = {};

  // Test Anthropic (Claude)
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || "" });
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 50,
      messages: [{ role: "user", content: "Say 'Claude OK'" }],
    });
    results.claude = { ok: true, response: response.content[0].type === "text" ? response.content[0].text : "" };
  } catch (e: any) {
    results.claude = { ok: false, error: e.message };
  }

  // Test OpenAI (GPT)
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Say 'GPT OK'" }],
      max_tokens: 50,
    });
    results.gpt = { ok: true, response: response.choices[0].message.content || "" };
  } catch (e: any) {
    results.gpt = { ok: false, error: e.message };
  }

  // Test xAI (Grok)
  try {
    const grokClient = new OpenAI({
      apiKey: process.env.XAI_API_KEY || "",
      baseURL: "https://api.x.ai/v1",
    });
    const response = await grokClient.chat.completions.create({
      model: "grok-3",
      messages: [{ role: "user", content: "Say 'Grok OK'" }],
      max_tokens: 50,
    });
    results.grok = { ok: true, response: response.choices[0].message.content || "" };
  } catch (e: any) {
    results.grok = { ok: false, error: e.message };
  }

  // Test DeepSeek
  try {
    const deepseekClient = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || "",
      baseURL: "https://api.deepseek.com",
    });
    const response = await deepseekClient.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: "Say 'DeepSeek OK'" }],
      max_tokens: 50,
    });
    results.deepseek = { ok: true, response: response.choices[0].message.content || "" };
  } catch (e: any) {
    results.deepseek = { ok: false, error: e.message };
  }

  // Test Moonshot (Kimi)
  try {
    const moonshotClient = new OpenAI({
      apiKey: process.env.MOONSHOT_API_KEY || "",
      baseURL: "https://api.moonshot.ai/v1",
    });
    const response = await moonshotClient.chat.completions.create({
      model: "moonshot-v1-8k",
      messages: [{ role: "user", content: "Say 'Kimi OK'" }],
      max_tokens: 50,
    });
    results.kimi = { ok: true, response: response.choices[0].message.content || "" };
  } catch (e: any) {
    results.kimi = { ok: false, error: e.message };
  }

  // Print results
  console.log("\n=== API KEY TEST RESULTS ===\n");
  for (const [name, result] of Object.entries(results)) {
    if (result.ok) {
      console.log(`✅ ${name.toUpperCase()}: WORKING`);
      console.log(`   Response: ${result.response?.substring(0, 50)}...`);
    } else {
      console.log(`❌ ${name.toUpperCase()}: BROKEN`);
      console.log(`   Error: ${result.error}`);
    }
    console.log();
  }
}

testAPIs();
