import config from "../config.js";

interface ExpenseRow {
  date: string | null;
  category: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  total: number;
}

interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterChoice {
  message: {
    content: string;
  };
}

interface OpenRouterResponse {
  choices: OpenRouterChoice[];
}

/**
 * Send messy construction expense text to an LLM via OpenRouter and get back
 * structured expense rows.
 */
export async function parseExpenses(
  text: string,
  categories: string[],
): Promise<ExpenseRow[]> {
  const systemPrompt =
    "You are a construction expense parser. Given messy notes about construction purchases, " +
    "extract a JSON array of expense rows. Each row: {date, category, description, quantity, unit, rate, total}. " +
    `Use ONLY these categories: [${categories.join(", ")}]. ` +
    "If date unclear, null. If rate/quantity unclear, just fill total. Return ONLY valid JSON, no markdown.";

  const messages: OpenRouterMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: text },
  ];

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages,
        temperature: 0.1,
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `OpenRouter API error (${response.status}): ${errorBody}`,
    );
  }

  const data = (await response.json()) as OpenRouterResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content in OpenRouter response");
  }

  // Strip potential markdown code fences in case the LLM wraps the response
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed: ExpenseRow[] = JSON.parse(cleaned);

  // Validate the shape of each row
  return parsed.map((row) => ({
    date: row.date ?? null,
    category: String(row.category),
    description: String(row.description),
    quantity: row.quantity ?? null,
    unit: row.unit ?? null,
    rate: row.rate ?? null,
    total: Number(row.total),
  }));
}
