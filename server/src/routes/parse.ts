import { Router, Request, Response } from "express";
import { parseExpenses } from "../services/llm.js";

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  try {
    const { text, categories } = req.body as {
      text: string;
      categories: string[];
    };

    if (!text || !categories || !Array.isArray(categories)) {
      res
        .status(400)
        .json({ error: "text and categories (array) are required" });
      return;
    }

    const rows = await parseExpenses(text, categories);
    res.json({ rows });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

export default router;
