// Server-side translation utility - runs when AI messages are created
// Uses Lingva Translate API (free, no key needed)

const LINGVA_API_URL = "https://lingva.ml/api/v1";

/**
 * Translates English text to Chinese using Lingva Translate API
 * Runs server-side when AI messages are created
 */
export async function translateToChinese(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return "";

  try {
    const encoded = encodeURIComponent(text);
    const response = await fetch(`${LINGVA_API_URL}/en/zh/${encoded}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.error("Translation API error:", response.status, response.statusText);
      return text; // Fallback to original text
    }

    const data = await response.json();
    return data.translation || text;
  } catch (error) {
    console.error("Translation failed:", error);
    return text; // Fallback to original text on error
  }
}

/**
 * Creates a message object with both English and Chinese text
 */
export async function createBilingualMessage(
  bot: string,
  model: string,
  text: string,
  timestamp: number
) {
  const textZh = await translateToChinese(text);

  return {
    bot,
    model,
    text,      // English (original)
    textZh,    // Chinese translation from API
    timestamp,
  };
}
