import OpenAI from "openai";
import config from "../config.js";

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

interface ExpenseRow {
  date: string | null;
  category: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  total: number;
}

/**
 * Send messy construction expense text to GPT-4o and get back
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

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
  });

  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content in LLM response");
  }

  // Strip potential markdown code fences
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed: ExpenseRow[] = JSON.parse(cleaned);

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
