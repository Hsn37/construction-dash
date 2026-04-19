import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import config from "../config.js";

const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

const ExpenseRowSchema = z.object({
  date: z.string().describe("DD-MM-YYYY"),
  category: z.string().describe("Category label, e.g. بجری (gravel)"),
  description: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  rate: z.number().nullable(),
  total: z.number(),
});

const ExpenseResponseSchema = z.object({
  rows: z.array(ExpenseRowSchema),
});

export type ExpenseRow = z.infer<typeof ExpenseRowSchema>;

/**
 * Send messy construction expense text to GPT-4o-mini and get back
 * structured expense rows using OpenAI structured outputs.
 */
export async function parseExpenses(
  text: string,
  categories: string[],
): Promise<ExpenseRow[]> {
  const systemPrompt = `
# Task
You are a construction expense parser. Given messy notes about construction purchases, extract expense rows.

# Instructions
- Use ONLY these categories: [${categories.join(", ")}].
- You can also suggest a new category if not already in the list.
  - Try to keep it urdu first. Categories should be <urdu> (<english>)
  - For example: بجری (gravel), اینٹ (bricks), سیمنٹ (cement)
- If date is unclear, use ${new Date().toISOString().split("T")[0]}.
- If rate/quantity unclear, just fill total.
`;

  const response = await openai.beta.chat.completions.parse({
    model: "gpt-4o-mini",
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: text },
    ],
    response_format: zodResponseFormat(ExpenseResponseSchema, "expenses"),
  });

  const parsed = response.choices[0].message.parsed;

  if (!parsed) {
    throw new Error("Failed to parse structured response from LLM");
  }

  return parsed.rows;
}
