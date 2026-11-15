// Lingva is a public Google-Translate proxy. No key. On failure the English text is stored as-is.

const LINGVA_API_URL = "https://lingva.ml/api/v1";

export async function translateToChinese(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return "";

  try {
    const encoded = encodeURIComponent(text);
    const response = await fetch(`${LINGVA_API_URL}/en/zh/${encoded}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error("Translation API error:", response.status, response.statusText);
      return text;
    }

    const data = await response.json();
    return data.translation || text;
  } catch (error) {
    console.error("Translation failed:", error);
    return text;
  }
}

export async function createBilingualMessage(
  bot: string,
  model: string,
  text: string,
  timestamp: number,
) {
  const textZh = await translateToChinese(text);

  return {
    bot,
    model,
    text,
    textZh,
    timestamp,
  };
}
